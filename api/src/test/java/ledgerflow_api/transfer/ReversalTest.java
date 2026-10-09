package ledgerflow_api.transfer;

import java.math.BigDecimal;
import java.util.UUID;
import java.util.List;
import java.util.concurrent.*;
import ledgerflow_api.TestcontainersConfiguration;
import ledgerflow_api.account.*;
import ledgerflow_api.auth.*;
import ledgerflow_api.reconciliation.ReconciliationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest @AutoConfigureMockMvc @Import(TestcontainersConfiguration.class)
class ReversalTest {
    @Autowired MockMvc mvc;
    @Autowired AccountRepository accounts;
    @Autowired TransferRepository transfers;
    @Autowired LedgerEntryRepository entries;
    @Autowired TransferService service;
    @Autowired JwtService jwt;
    @Autowired AppUserRepository users;
    @Autowired JdbcTemplate jdbc;
    @Autowired ReconciliationService reconciliation;
    Account account(String amount) { return accounts.saveAndFlush(new Account("Reversal", AccountType.BANK, new BigDecimal(amount))); }
    TransferResponse original() {
        return service.executeTransfer(new CreateTransferRequest(account("10").getId(), account("0").getId(), new BigDecimal("10"), UUID.randomUUID().toString(), "original")).transfer();
    }
    int reverse(UUID id, String key, String reason, AppRole role) throws Exception {
        String token = jwt.issue(users.saveAndFlush(new AppUser(UUID.randomUUID()+"@test.local", "unused", role))).value();
        return mvc.perform(post("/api/transfers/"+id+"/reversal").header("Authorization", "Bearer "+token).contentType(MediaType.APPLICATION_JSON)
            .content("{\"idempotencyKey\":\""+key+"\",\"reason\":\""+reason+"\"}")).andReturn().getResponse().getStatus();
    }
    @Test void compensatesOnceAndReplaysEvenWhenRefundSourceIsEmpty() throws Exception {
        TransferResponse original = original(); String key = UUID.randomUUID().toString();
        var originalEntries = entries.findByTransferIdOrderByCreatedAtAsc(original.id()).stream()
            .map(entry -> new EntrySnapshot(entry.getAccountId(), entry.getDirection(), entry.getAmount()))
            .toList();
        assertThat(reverse(original.id(), key, "Correction", AppRole.TREASURY_ADMIN)).isEqualTo(201);
        assertThat(reverse(original.id(), key, "Correction", AppRole.TREASURY_ADMIN)).isEqualTo(200);
        Transfer refund = transfers.findByIdempotencyKey(key).orElseThrow();
        assertThat(entries.findByTransferIdOrderByCreatedAtAsc(original.id())).hasSize(2);
        assertThat(entries.findByTransferIdOrderByCreatedAtAsc(original.id()).stream()
            .map(entry -> new EntrySnapshot(entry.getAccountId(), entry.getDirection(), entry.getAmount())).toList())
            .containsExactlyElementsOf(originalEntries);
        assertThat(entries.findByTransferIdOrderByCreatedAtAsc(refund.getId())).hasSize(2);
        assertThat(jdbc.queryForObject("select reversal_of from transfers where id=?", UUID.class, refund.getId()))
            .isEqualTo(original.id());
        assertThat(transfers.findById(original.id()).orElseThrow().getStatus()).isEqualTo(TransferStatus.REVERSED);
        assertThat(accounts.findById(original.sourceAccountId()).orElseThrow().getCurrentBalance()).isEqualByComparingTo("10");
        assertThat(accounts.findById(original.targetAccountId()).orElseThrow().getCurrentBalance()).isEqualByComparingTo("0");
        assertThat(reverse(original.id(), key, "Changed", AppRole.TREASURY_ADMIN)).isEqualTo(409);
        assertThat(reverse(original.id(), UUID.randomUUID().toString(), "Correction", AppRole.TREASURY_ADMIN)).isEqualTo(409);
        assertThat(reverse(refund.getId(), UUID.randomUUID().toString(), "Correction", AppRole.TREASURY_ADMIN)).isEqualTo(409);
        assertThat(reconciliation.check().status()).isEqualTo("BALANCED");
    }
    @Test void concurrentDistinctKeysAllowOnlyOneReversal() throws Exception {
        TransferResponse original = original();
        CountDownLatch start = new CountDownLatch(1);
        try (ExecutorService pool = Executors.newFixedThreadPool(2)) {
            Callable<Integer> first = () -> { start.await(); return reverse(original.id(), UUID.randomUUID().toString(), "First reason", AppRole.TREASURY_ADMIN); };
            Callable<Integer> second = () -> { start.await(); return reverse(original.id(), UUID.randomUUID().toString(), "Second reason", AppRole.TREASURY_ADMIN); };
            Future<Integer> a = pool.submit(first), b = pool.submit(second); start.countDown();
            assertThat(List.of(a.get(20, TimeUnit.SECONDS), b.get(20, TimeUnit.SECONDS)))
                .containsExactlyInAnyOrder(201, 409);
        }
        assertThat(jdbc.queryForObject("select count(*) from transfers where reversal_of=?", Long.class, original.id()))
            .isEqualTo(1L);
        assertThat(reconciliation.check().status()).isEqualTo("BALANCED");
    }
    @Test void ordinaryTransferCannotReplayAReversalIdempotencyKey() throws Exception {
        TransferResponse original = original();
        String key = UUID.randomUUID().toString();
        assertThat(reverse(original.id(), key, "Correction", AppRole.TREASURY_ADMIN)).isEqualTo(201);
        BigDecimal sourceBefore = accounts.findById(original.targetAccountId()).orElseThrow().getCurrentBalance();
        BigDecimal targetBefore = accounts.findById(original.sourceAccountId()).orElseThrow().getCurrentBalance();
        long ledgerCountBefore = entries.count();
        long transferCountBefore = transfers.count();
        String token = jwt.issue(users.saveAndFlush(new AppUser(UUID.randomUUID()+"@test.local", "unused", AppRole.OPERATOR))).value();

        mvc.perform(post("/api/transfer-requests").header("Authorization", "Bearer "+token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"sourceAccountId\":\""+original.targetAccountId()+"\","
                        +"\"targetAccountId\":\""+original.sourceAccountId()+"\","
                        +"\"amount\":10,\"idempotencyKey\":\""+key+"\",\"description\":\"Correction\"}"))
                .andExpect(status().isConflict());

        assertThat(accounts.findById(original.targetAccountId()).orElseThrow().getCurrentBalance()).isEqualByComparingTo(sourceBefore);
        assertThat(accounts.findById(original.sourceAccountId()).orElseThrow().getCurrentBalance()).isEqualByComparingTo(targetBefore);
        assertThat(entries.count()).isEqualTo(ledgerCountBefore);
        assertThat(transfers.count()).isEqualTo(transferCountBefore);
    }
    @Test void writesOneReversalAuditEventWithTheAuthenticatedAdminActor() throws Exception {
        TransferResponse original = original();
        AppUser actor = users.saveAndFlush(new AppUser(UUID.randomUUID()+"@test.local", "unused", AppRole.TREASURY_ADMIN));
        String token = jwt.issue(actor).value();
        long before = jdbc.queryForObject("select count(*) from audit_events where action='TRANSFER_REVERSED' and resource_id=?",
            Long.class, original.id());
        String payload = "{\"idempotencyKey\":\""+UUID.randomUUID()+"\",\"reason\":\"Correction\"}";
        mvc.perform(post("/api/transfers/"+original.id()+"/reversal").header("Authorization", "Bearer "+token)
            .contentType(MediaType.APPLICATION_JSON).content(payload)).andReturn().getResponse().getStatus();
        assertThat(jdbc.queryForObject("select count(*) from audit_events where action='TRANSFER_REVERSED' and resource_id=?",
            Long.class, original.id())).isEqualTo(before+1);
        assertThat(jdbc.queryForObject("select actor_id from audit_events where action='TRANSFER_REVERSED' and resource_id=?",
            UUID.class, original.id())).isEqualTo(actor.getId());
        assertThat(jdbc.queryForObject("select actor_email from audit_events where action='TRANSFER_REVERSED' and resource_id=?",
            String.class, original.id())).isEqualTo(actor.getEmail());
        assertThat(jdbc.queryForObject("select actor_role from audit_events where action='TRANSFER_REVERSED' and resource_id=?",
            String.class, original.id())).isEqualTo(AppRole.TREASURY_ADMIN.name());
    }
    @Test void rolesAndInsufficientRefundDoNotWrite() throws Exception {
        TransferResponse original = original();
        for (AppRole role : List.of(AppRole.OPERATOR, AppRole.AUDITOR))
            assertThat(reverse(original.id(), UUID.randomUUID().toString(), "Correction", role)).isEqualTo(403);
        service.executeTransfer(new CreateTransferRequest(original.targetAccountId(), account("0").getId(), new BigDecimal("10"), UUID.randomUUID().toString(), null));
        String key = UUID.randomUUID().toString();
        assertThat(reverse(original.id(), key, "Correction", AppRole.TREASURY_ADMIN)).isEqualTo(400);
        assertThat(transfers.findByIdempotencyKey(key)).isEmpty();
        assertThat(transfers.findById(original.id()).orElseThrow().getStatus()).isEqualTo(TransferStatus.COMPLETED);
    }
    @Test void concurrentDuplicateRequestsCommitOneCompensation() throws Exception {
        TransferResponse original = original(); String key = UUID.randomUUID().toString();
        CountDownLatch start = new CountDownLatch(1);
        try (ExecutorService pool = Executors.newFixedThreadPool(2)) {
            Callable<Integer> request = () -> { start.await(); return reverse(original.id(), key, "Correction", AppRole.TREASURY_ADMIN); };
            Future<Integer> a = pool.submit(request), b = pool.submit(request); start.countDown();
            assertThat(List.of(a.get(20, TimeUnit.SECONDS), b.get(20, TimeUnit.SECONDS))).containsExactlyInAnyOrder(201, 200);
        }
        assertThat(entries.findByTransferIdOrderByCreatedAtAsc(transfers.findByIdempotencyKey(key).orElseThrow().getId())).hasSize(2);
    }
    @Test void invalidReasonKeyCollisionAndMissingOriginalAreRejected() throws Exception {
        TransferResponse original = original();
        assertThat(reverse(original.id(), UUID.randomUUID().toString(), " ", AppRole.TREASURY_ADMIN)).isEqualTo(400);
        assertThat(reverse(original.id(), "x".repeat(101), "Correction", AppRole.TREASURY_ADMIN)).isEqualTo(400);
        assertThat(reverse(original.id(), UUID.randomUUID().toString(), "x".repeat(256), AppRole.TREASURY_ADMIN)).isEqualTo(400);
        assertThat(reverse(original.id(), original.idempotencyKey(), "Correction", AppRole.TREASURY_ADMIN)).isEqualTo(409);
        assertThat(reverse(UUID.randomUUID(), UUID.randomUUID().toString(), "Correction", AppRole.TREASURY_ADMIN)).isEqualTo(404);
    }
    @Test void refundDestinationOverflowDoesNotWrite() throws Exception {
        TransferResponse original = original();
        Account destination = accounts.findById(original.sourceAccountId()).orElseThrow();
        destination.credit(new BigDecimal("99999999999999999.99")); accounts.saveAndFlush(destination);
        String key = UUID.randomUUID().toString();
        assertThat(reverse(original.id(), key, "Correction", AppRole.TREASURY_ADMIN)).isEqualTo(400);
        assertThat(transfers.findByIdempotencyKey(key)).isEmpty();
        assertThat(transfers.findById(original.id()).orElseThrow().getStatus()).isEqualTo(TransferStatus.COMPLETED);
        assertThat(accounts.findById(original.targetAccountId()).orElseThrow().getCurrentBalance()).isEqualByComparingTo("10");
        destination.debit(new BigDecimal("99999999999999999.99")); accounts.saveAndFlush(destination);
    }

    private record EntrySnapshot(UUID accountId, LedgerDirection direction, BigDecimal amount) { }
}
