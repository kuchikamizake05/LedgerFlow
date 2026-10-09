package ledgerflow_api.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.util.UUID;
import tools.jackson.databind.ObjectMapper;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import ledgerflow_api.TestcontainersConfiguration;
import ledgerflow_api.auth.AppRole;
import ledgerflow_api.auth.AppUser;
import ledgerflow_api.auth.JwtService;
import ledgerflow_api.auth.AppUserRepository;
import ledgerflow_api.transfer.CreateTransferRequest;
import ledgerflow_api.transfer.LedgerEntryRepository;
import ledgerflow_api.transfer.TransferRepository;
import ledgerflow_api.transfer.TransferService;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class AccountFreezeTest {
    @Autowired MockMvc mvc;
    @Autowired AccountRepository accounts;
    @Autowired TransferRepository transfers;
    @Autowired LedgerEntryRepository entries;
    @Autowired TransferService transferService;
    @Autowired JwtService jwt;
    @Autowired AppUserRepository users;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper objectMapper;

    @Test
    void freezesAndUnfreezesWithAdminAuditAndIdempotentStateChanges() throws Exception {
        Account account = account("Operations", "100.00");
        AppUser admin = user(AppRole.TREASURY_ADMIN);

        mvc.perform(post("/api/accounts/{id}/freeze", account.getId())
                        .header("Authorization", bearer(admin)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"investigation\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.frozen").value(true))
                .andExpect(jsonPath("$.currentBalance").value(100.0));
        mvc.perform(post("/api/accounts/{id}/freeze", account.getId())
                        .header("Authorization", bearer(admin)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"duplicate request\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.frozen").value(true));

        assertThat(auditCount("ACCOUNT_FROZEN", account.getId())).isEqualTo(1);
        assertThat(auditDescription("ACCOUNT_FROZEN", account.getId())).isEqualTo("investigation");
        assertThat(auditActorEmail("ACCOUNT_FROZEN", account.getId())).isEqualTo(admin.getEmail());
        assertThat(auditActorRole("ACCOUNT_FROZEN", account.getId())).isEqualTo("TREASURY_ADMIN");
        assertThat(auditActorId("ACCOUNT_FROZEN", account.getId())).isEqualTo(admin.getId());

        mvc.perform(post("/api/accounts/{id}/unfreeze", account.getId())
                        .header("Authorization", bearer(admin)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"review cleared\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.frozen").value(false));
        mvc.perform(post("/api/accounts/{id}/unfreeze", account.getId())
                        .header("Authorization", bearer(admin)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"duplicate request\"}"))
                .andExpect(status().isOk());
        assertThat(auditCount("ACCOUNT_UNFROZEN", account.getId())).isEqualTo(1);
        assertThat(auditDescription("ACCOUNT_UNFROZEN", account.getId())).isEqualTo("review cleared");
    }

    @Test
    void newTransfersAndDepositsCannotMoveMoneyThroughFrozenAccounts() throws Exception {
        Account frozenSource = account("Frozen source", "100.00");
        Account target = account("Target", "0.00");
        Account source = account("Source", "100.00");
        Account frozenTarget = account("Frozen target", "0.00");
        AppUser admin = user(AppRole.TREASURY_ADMIN);
        AppUser operator = user(AppRole.OPERATOR);
        freeze(frozenSource, admin, "source review");
        freeze(frozenTarget, admin, "target review");

        long transfersBefore = transfers.count();
        long entriesBefore = entries.count();
        assertThat(transfer(sourceToken(operator), admin, frozenSource, target)).isEqualTo(409);
        assertThat(transfer(sourceToken(operator), admin, source, frozenTarget)).isEqualTo(409);
        assertThat(deposit(admin, frozenTarget)).isEqualTo(409);
        assertThat(transfers.count()).isEqualTo(transfersBefore);
        assertThat(entries.count()).isEqualTo(entriesBefore);
        assertThat(balance(source)).isEqualByComparingTo("100.00");
        assertThat(balance(frozenSource)).isEqualByComparingTo("100.00");
        assertThat(balance(frozenTarget)).isEqualByComparingTo("0.00");

        unfreeze(frozenTarget, admin, "review cleared");
        assertThat(deposit(admin, frozenTarget)).isEqualTo(201);
        assertThat(balance(frozenTarget)).isEqualByComparingTo("25.00");
    }

    @Test
    void completedTransferReplayStillSucceedsAfterAnAccountIsFrozen() throws Exception {
        Account source = account("Replay source", "100.00");
        Account target = account("Replay target", "0.00");
        String key = UUID.randomUUID().toString();
        AppUser operator = user(AppRole.OPERATOR);
        String payload = transferPayload(source, target, key);
        String requestId = submitTransfer(operator, payload);
        mvc.perform(post("/api/transfer-requests/{id}/approve", requestId)
                        .header("Authorization", bearer(user(AppRole.TREASURY_ADMIN)))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"approved payment\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"));

        freeze(source, user(AppRole.TREASURY_ADMIN), "subsequent hold");
        long transferCount = transfers.count();
        long entryCount = entries.count();
        mvc.perform(post("/api/transfer-requests").header("Authorization", bearer(operator))
                        .contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"))
                .andExpect(jsonPath("$.idempotencyKey").value(key));
        assertThat(transfers.count()).isEqualTo(transferCount);
        assertThat(entries.count()).isEqualTo(entryCount);
        assertThat(balance(source)).isEqualByComparingTo("75.00");
        assertThat(balance(target)).isEqualByComparingTo("25.00");
    }

    @Test
    void completedDepositReplayStillSucceedsAfterTheDestinationIsFrozen() throws Exception {
        Account target = account("Deposit replay target", "0.00");
        AppUser admin = user(AppRole.TREASURY_ADMIN);
        String key = UUID.randomUUID().toString();
        String payload = "{\"amount\":25.00,\"idempotencyKey\":\"" + key + "\"}";
        mvc.perform(post("/api/accounts/{id}/deposits", target.getId()).header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isCreated());

        freeze(target, admin, "deposit hold");
        long transferCount = transfers.count();
        long entryCount = entries.count();
        mvc.perform(post("/api/accounts/{id}/deposits", target.getId()).header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isOk());
        assertThat(transfers.count()).isEqualTo(transferCount);
        assertThat(entries.count()).isEqualTo(entryCount);
        assertThat(balance(target)).isEqualByComparingTo("25.00");
    }

    @Test
    void reversalIsBlockedWhenEitherRefundAccountIsFrozenAndWorksAfterUnfreeze() throws Exception {
        Account source = account("Original source", "100.00");
        Account target = account("Original target", "0.00");
        var original = transferService.executeTransfer(new CreateTransferRequest(source.getId(), target.getId(),
                new BigDecimal("25.00"), UUID.randomUUID().toString(), "original payment")).transfer();
        AppUser admin = user(AppRole.TREASURY_ADMIN);
        freeze(target, admin, "refund source hold");

        long transferCount = transfers.count();
        long entryCount = entries.count();
        String blockedKey = UUID.randomUUID().toString();
        assertThat(reverse(original.id(), blockedKey, admin)).isEqualTo(409);
        assertThat(transfers.count()).isEqualTo(transferCount);
        assertThat(entries.count()).isEqualTo(entryCount);
        assertThat(transfers.findById(original.id()).orElseThrow().getStatus().name()).isEqualTo("COMPLETED");
        assertThat(balance(source)).isEqualByComparingTo("75.00");
        assertThat(balance(target)).isEqualByComparingTo("25.00");

        unfreeze(target, admin, "refund approved");
        freeze(source, admin, "refund destination hold");
        assertThat(reverse(original.id(), UUID.randomUUID().toString(), admin)).isEqualTo(409);
        assertThat(transfers.count()).isEqualTo(transferCount);
        assertThat(entries.count()).isEqualTo(entryCount);
        unfreeze(source, admin, "refund destination approved");
        assertThat(reverse(original.id(), UUID.randomUUID().toString(), admin)).isEqualTo(201);
        assertThat(balance(source)).isEqualByComparingTo("100.00");
        assertThat(balance(target)).isEqualByComparingTo("0.00");
    }

    @Test
    void freezeEndpointsAreAdminOnlyRejectInvalidReasonsAndProtectTreasury() throws Exception {
        Account account = account("Protected", "10.00");
        String url = "/api/accounts/" + account.getId() + "/freeze";
        assertThat(mvc.perform(post(url).contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"hold\"}")).andReturn().getResponse().getStatus()).isEqualTo(401);
        for (AppRole role : new AppRole[] { AppRole.OPERATOR, AppRole.AUDITOR }) {
            assertThat(mvc.perform(post(url).header("Authorization", bearer(user(role)))
                    .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"hold\"}"))
                    .andReturn().getResponse().getStatus()).isEqualTo(403);
        }
        AppUser admin = user(AppRole.TREASURY_ADMIN);
        for (String body : new String[] { "{}", "{\"reason\":\" \"}", "{\"reason\":\"" + "x".repeat(256) + "\"}" }) {
            assertThat(mvc.perform(post(url).header("Authorization", bearer(admin))
                    .contentType(MediaType.APPLICATION_JSON).content(body)).andReturn().getResponse().getStatus())
                    .isEqualTo(400);
        }
        mvc.perform(post("/api/accounts/00000000-0000-0000-0000-000000000001/freeze")
                        .header("Authorization", bearer(admin)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"cannot freeze treasury\"}"))
                .andExpect(status().isBadRequest());
        assertThat(auditCount("ACCOUNT_FROZEN", account.getId())).isZero();
    }

    @Test
    void newAccountsExposeUnfrozenStateAndMissingAccountReturnsNotFound() throws Exception {
        Account account = account("Default state", "0.00");
        mvc.perform(get("/api/accounts/{id}", account.getId())
                        .header("Authorization", bearer(user(AppRole.AUDITOR))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.frozen").value(false));
        mvc.perform(post("/api/accounts/{id}/freeze", UUID.randomUUID())
                        .header("Authorization", bearer(user(AppRole.TREASURY_ADMIN)))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"hold\"}"))
                .andExpect(status().isNotFound());
    }

    private Account account(String name, String openingBalance) {
        return accounts.saveAndFlush(new Account(name, AccountType.BANK, new BigDecimal(openingBalance)));
    }

    private AppUser user(AppRole role) {
        return new AppUser(UUID.randomUUID() + "@freeze.test", "unused", role);
    }

    private String bearer(AppUser user) {
        return "Bearer " + jwt.issue(users.saveAndFlush(user)).value();
    }

    private String sourceToken(AppUser user) { return bearer(user); }

    private void freeze(Account account, AppUser admin, String reason) throws Exception {
        mvc.perform(post("/api/accounts/{id}/freeze", account.getId()).header("Authorization", bearer(admin))
                .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"" + reason + "\"}"))
                .andExpect(status().isOk());
    }

    private void unfreeze(Account account, AppUser admin, String reason) throws Exception {
        mvc.perform(post("/api/accounts/{id}/unfreeze", account.getId()).header("Authorization", bearer(admin))
                .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"" + reason + "\"}"))
                .andExpect(status().isOk());
    }

    private int transfer(String token, AppUser admin, Account source, Account target) throws Exception {
        String payload = transferPayload(source, target, UUID.randomUUID().toString());
        String requestId = submitTransfer(token, payload);
        return mvc.perform(post("/api/transfer-requests/{id}/approve", requestId).header("Authorization", bearer(admin))
                .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"freeze test approval\"}"))
                .andReturn().getResponse().getStatus();
    }

    private String submitTransfer(AppUser requester, String payload) throws Exception {
        return submitTransfer(bearer(requester), payload);
    }

    private String submitTransfer(String token, String payload) throws Exception {
        String body = mvc.perform(post("/api/transfer-requests").header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).path("id").asText();
    }

    private String transferPayload(Account source, Account target, String key) {
        return "{\"sourceAccountId\":\"" + source.getId() + "\",\"targetAccountId\":\"" + target.getId()
                + "\",\"amount\":25.00,\"idempotencyKey\":\"" + key + "\",\"description\":\"freeze test\"}";
    }

    private int deposit(AppUser admin, Account target) throws Exception {
        return mvc.perform(post("/api/accounts/{id}/deposits", target.getId()).header("Authorization", bearer(admin))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"amount\":25.00,\"idempotencyKey\":\"" + UUID.randomUUID() + "\"}"))
                .andReturn().getResponse().getStatus();
    }

    private int reverse(UUID originalId, String key, AppUser admin) throws Exception {
        return mvc.perform(post("/api/transfers/{id}/reversal", originalId).header("Authorization", bearer(admin))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"idempotencyKey\":\"" + key + "\",\"reason\":\"freeze test reversal\"}"))
                .andReturn().getResponse().getStatus();
    }

    private BigDecimal balance(Account account) {
        return accounts.findById(account.getId()).orElseThrow().getCurrentBalance();
    }

    private long auditCount(String action, UUID resourceId) {
        return jdbc.queryForObject("select count(*) from audit_events where action=? and resource_id=?", Long.class,
                action, resourceId);
    }

    private String auditDescription(String action, UUID resourceId) {
        return jdbc.queryForObject("select description from audit_events where action=? and resource_id=? order by created_at desc limit 1",
                String.class, action, resourceId);
    }

    private String auditActorEmail(String action, UUID resourceId) {
        return jdbc.queryForObject("select actor_email from audit_events where action=? and resource_id=?", String.class,
                action, resourceId);
    }

    private String auditActorRole(String action, UUID resourceId) {
        return jdbc.queryForObject("select actor_role from audit_events where action=? and resource_id=?", String.class,
                action, resourceId);
    }

    private UUID auditActorId(String action, UUID resourceId) {
        return jdbc.queryForObject("select actor_id from audit_events where action=? and resource_id=?", UUID.class,
                action, resourceId);
    }
}
