package ledgerflow_api.wallet;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.everyItem;

import java.util.UUID;
import java.math.BigDecimal;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.Future;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import ledgerflow_api.TestcontainersConfiguration;
import ledgerflow_api.account.AccountRepository;
import ledgerflow_api.auth.AppRole;
import ledgerflow_api.auth.AppUser;
import ledgerflow_api.auth.AppUserRepository;
import ledgerflow_api.auth.JwtService;
import ledgerflow_api.audit.AuditEventRepository;
import ledgerflow_api.transfer.LedgerEntryRepository;
import ledgerflow_api.transfer.TransferRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.security.crypto.password.PasswordEncoder;

@SpringBootTest(properties = "ledgerflow.simulator.topups-enabled=true")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class WalletControllerTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired AccountRepository accounts;
    @Autowired TransferRepository transfers;
    @Autowired LedgerEntryRepository entries;
    @Autowired AuditEventRepository audit;
    @Autowired AppUserRepository users;
    @Autowired JwtService jwt;
    @Autowired PasswordEncoder passwords;

    @Test
    void progressAndReceiptsAreScopedToTheWalletOwner() throws Exception {
        String suffix = UUID.randomUUID().toString();
        String sender = signup("receipt-sender-" + suffix + "@example.test");
        String recipient = signup("receipt-recipient-" + suffix + "@example.test");
        String outsider = signup("receipt-outsider-" + suffix + "@example.test");
        UUID senderId = walletId(sender);
        UUID recipientId = walletId(recipient);
        mvc.perform(get("/api/wallet/progress").header("Authorization", bearer(sender)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.funded").value(false))
                .andExpect(jsonPath("$.sent").value(false));
        MvcResult funded = mvc.perform(post("/api/wallet/topups").header("Authorization", bearer(sender))
                .contentType(MediaType.APPLICATION_JSON).content("{\"amount\":100,\"idempotencyKey\":\"receipt-topup\"}"))
                .andExpect(status().isOk()).andReturn();
        String topupId = mapper.readTree(funded.getResponse().getContentAsString()).get("transfer").get("id").asText();
        mvc.perform(get("/api/wallet/transactions/" + topupId).header("Authorization", bearer(sender)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.kind").value("TOPUP"))
                .andExpect(jsonPath("$.direction").value("CREDIT"))
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.idempotencyKey").doesNotExist());
        MvcResult sent = mvc.perform(post("/api/wallet/transfers").header("Authorization", bearer(sender))
                .contentType(MediaType.APPLICATION_JSON).content("{\"targetAccountId\":\"" + recipientId + "\",\"amount\":100,\"idempotencyKey\":\"receipt-send\"}"))
                .andExpect(status().isOk()).andReturn();
        String transferId = mapper.readTree(sent.getResponse().getContentAsString()).get("transfer").get("id").asText();
        mvc.perform(get("/api/wallet/progress").header("Authorization", bearer(sender)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.funded").value(true))
                .andExpect(jsonPath("$.sent").value(true));
        mvc.perform(get("/api/wallet/progress").header("Authorization", bearer(recipient)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.funded").value(false))
                .andExpect(jsonPath("$.sent").value(false));
        for (String owner : new String[] {sender, recipient}) {
            mvc.perform(get("/api/wallet/transactions/" + transferId).header("Authorization", bearer(owner)))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.source.id").value(senderId.toString()))
                    .andExpect(jsonPath("$.target.id").value(recipientId.toString()))
                    .andExpect(jsonPath("$.amount").value(100)).andExpect(jsonPath("$.kind").value("TRANSFER"));
        }
        mvc.perform(get("/api/wallet/transactions/" + transferId).header("Authorization", bearer(outsider)))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/wallet/transactions/" + UUID.randomUUID()).header("Authorization", bearer(sender)))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/wallet/transactions/" + transferId)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/wallet/transactions/" + transferId).header("Authorization", bearer(internalSignup("receipt-staff-" + suffix + "@example.test"))))
                .andExpect(status().isForbidden());
        AppUser admin = users.save(new AppUser("receipt-admin-" + suffix + "@example.test",
                passwords.encode("Long-strong-password-123!"), AppRole.TREASURY_ADMIN));
        MvcResult corrected = mvc.perform(post("/api/transfers/" + transferId + "/reversal")
                .header("Authorization", bearer(jwt.issue(admin).value())).contentType(MediaType.APPLICATION_JSON)
                .content("{\"idempotencyKey\":\"receipt-reversal-" + suffix + "\",\"reason\":\"Receipt regression correction\"}"))
                .andExpect(status().isCreated()).andReturn();
        String correctionId = mapper.readTree(corrected.getResponse().getContentAsString()).get("id").asText();
        mvc.perform(get("/api/wallet/transactions/" + transferId).header("Authorization", bearer(sender)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("REVERSED"));
        mvc.perform(get("/api/wallet/transactions/" + correctionId).header("Authorization", bearer(sender)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.kind").value("REVERSAL"))
                .andExpect(jsonPath("$.reversalOf").value(transferId));
        mvc.perform(get("/api/wallet/progress").header("Authorization", bearer(recipient)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.sent").value(false));
    }

    @Test
    void registrationFundingTransferRetriesAndIsolationUseTheLedger() throws Exception {
        String suffix = UUID.randomUUID().toString();
        String first = signup("first-" + suffix + "@example.test");
        String second = signup("second-" + suffix + "@example.test");
        String staff = internalSignup("staff-" + suffix + "@example.test");
        mvc.perform(get("/api/wallet/me").header("Authorization", bearer(staff))).andExpect(status().isForbidden());
        mvc.perform(post("/api/wallet/topups").header("Authorization", bearer(first)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"amount\":1000000.01,\"idempotencyKey\":\"cap-" + suffix + "\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/wallet/topups").header("Authorization", bearer(first)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"amount\":-1,\"idempotencyKey\":\"negative-" + suffix + "\"}"))
                .andExpect(status().isBadRequest());
        UUID firstWallet = walletId(first);
        UUID secondWallet = walletId(second);
        assertThat(firstWallet).isNotEqualTo(secondWallet);
        long transfersBefore = transfers.count();
        long entriesBefore = entries.count();
        long auditsBefore = audit.count();

        String topup = "{\"amount\":100,\"idempotencyKey\":\"topup-" + suffix + "\"}";
        mvc.perform(post("/api/wallet/topups").header("Authorization", bearer(first)).contentType(MediaType.APPLICATION_JSON).content(topup))
                .andExpect(status().isOk()).andExpect(jsonPath("$.replayed").value(false));
        mvc.perform(post("/api/wallet/topups").header("Authorization", bearer(first)).contentType(MediaType.APPLICATION_JSON).content(topup))
                .andExpect(status().isOk()).andExpect(jsonPath("$.replayed").value(true));

        String transfer = "{\"targetAccountId\":\"" + secondWallet + "\",\"amount\":35,\"idempotencyKey\":\"transfer-" + suffix + "\"}";
        mvc.perform(post("/api/wallet/transfers").header("Authorization", bearer(first)).contentType(MediaType.APPLICATION_JSON).content(transfer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.replayed").value(false));
        mvc.perform(post("/api/wallet/transfers").header("Authorization", bearer(first)).contentType(MediaType.APPLICATION_JSON).content(transfer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.replayed").value(true));
        String changedPayload = "{\"targetAccountId\":\"" + secondWallet + "\",\"amount\":36,\"idempotencyKey\":\"transfer-" + suffix + "\"}";
        mvc.perform(post("/api/wallet/transfers").header("Authorization", bearer(first)).contentType(MediaType.APPLICATION_JSON).content(changedPayload))
                .andExpect(status().isConflict());
        String sameKeyOtherCustomer = "{\"amount\":10,\"idempotencyKey\":\"topup-" + suffix + "\"}";
        mvc.perform(post("/api/wallet/topups").header("Authorization", bearer(second)).contentType(MediaType.APPLICATION_JSON).content(sameKeyOtherCustomer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.replayed").value(false));

        mvc.perform(get("/api/wallet/me").header("Authorization", bearer(first))).andExpect(status().isOk()).andExpect(jsonPath("$.balance").value(65));
        mvc.perform(get("/api/wallet/me").header("Authorization", bearer(second))).andExpect(status().isOk()).andExpect(jsonPath("$.balance").value(45));
        mvc.perform(get("/api/wallet/history").param("accountId", secondWallet.toString())
                .header("Authorization", bearer(first))).andExpect(status().isOk())
                .andExpect(jsonPath("$.content[*].accountId", everyItem(equalTo(firstWallet.toString()))));
        mvc.perform(get("/api/wallet/history").header("Authorization", bearer(second))).andExpect(status().isOk())
                .andExpect(jsonPath("$.content[*].accountId", everyItem(equalTo(secondWallet.toString()))));
        mvc.perform(get("/api/accounts/{id}", secondWallet).header("Authorization", bearer(first))).andExpect(status().isForbidden());
        mvc.perform(get("/api/wallet/me")).andExpect(status().isUnauthorized());
        assertThat(transfers.count() - transfersBefore).isEqualTo(3);
        assertThat(entries.count() - entriesBefore).isEqualTo(6);
        assertThat(audit.count() - auditsBefore).isEqualTo(3);
        assertThat(audit.findAll()).anyMatch(e -> e.getAction().equals("SIMULATOR_TOPUP"));
        assertThat(audit.findAll()).anyMatch(e -> e.getAction().equals("CUSTOMER_TRANSFER_COMPLETED"));
        assertThat(accounts.findById(firstWallet).orElseThrow().getCurrentBalance()).isEqualByComparingTo("65.00");
        var frozenAccount = accounts.findById(firstWallet).orElseThrow();
        frozenAccount.freeze();
        accounts.saveAndFlush(frozenAccount);
        String frozenTransfer = "{\"targetAccountId\":\"" + secondWallet + "\",\"amount\":1,\"idempotencyKey\":\"frozen-" + suffix + "\"}";
        mvc.perform(post("/api/wallet/transfers").header("Authorization", bearer(first)).contentType(MediaType.APPLICATION_JSON).content(frozenTransfer))
                .andExpect(status().isConflict());
        mvc.perform(get("/api/wallet/me").header("Authorization", bearer(first))).andExpect(jsonPath("$.frozen").value(true));
    }

    @Test
    void staffCannotAccessWalletAndRoleManagementCannotConvertCustomers() throws Exception {
        AppUser admin = users.save(new AppUser("admin-" + UUID.randomUUID() + "@example.test",
                passwords.encode("Long-strong-password-123!"), AppRole.TREASURY_ADMIN));
        AppUser staff = users.save(new AppUser("staff-" + UUID.randomUUID() + "@example.test",
                passwords.encode("Long-strong-password-123!"), AppRole.AUDITOR));
        String adminToken = jwt.issue(admin).value();
        String staffToken = jwt.issue(staff).value();
        String customerEmail = "customer-" + UUID.randomUUID() + "@example.test";
        String customerToken = signup(customerEmail);
        UUID customerId = users.findByEmail(customerEmail).orElseThrow().getId();

        mvc.perform(get("/api/wallet/me").header("Authorization", bearer(staffToken))).andExpect(status().isForbidden());
        mvc.perform(post("/api/users/{id}/role", customerId).header("Authorization", bearer(adminToken))
                .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"AUDITOR\",\"reason\":\"review\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/users/{id}/role", staff.getId()).header("Authorization", bearer(adminToken))
                .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"CUSTOMER\",\"reason\":\"review\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void simultaneousTransfersCannotOverspendAndSameKeyPostsOnlyOnce() throws Exception {
        String suffix = UUID.randomUUID().toString();
        String sender = signup("sender-" + suffix + "@example.test");
        String recipientA = signup("recipient-a-" + suffix + "@example.test");
        String recipientB = signup("recipient-b-" + suffix + "@example.test");
        UUID senderWallet = walletId(sender);
        UUID recipientAWallet = walletId(recipientA);
        UUID recipientBWallet = walletId(recipientB);
        mvc.perform(post("/api/wallet/topups").header("Authorization", bearer(sender)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"amount\":100,\"idempotencyKey\":\"fund-" + suffix + "\"}"))
                .andExpect(status().isOk());

        var pool = Executors.newFixedThreadPool(2);
        try {
            CountDownLatch start = new CountDownLatch(1);
            Future<Integer> first = pool.submit(() -> concurrentTransfer(sender, recipientAWallet, "70", "overspend-a-" + suffix, start));
            Future<Integer> second = pool.submit(() -> concurrentTransfer(sender, recipientBWallet, "70", "overspend-b-" + suffix, start));
            start.countDown();
            int firstStatus = first.get(20, TimeUnit.SECONDS);
            int secondStatus = second.get(20, TimeUnit.SECONDS);
            assertThat(java.util.List.of(firstStatus, secondStatus)).containsExactlyInAnyOrder(200, 400);
        } finally {
            pool.shutdownNow();
        }
        assertThat(accounts.findById(senderWallet).orElseThrow().getCurrentBalance()).isEqualByComparingTo("30.00");

        var sameKeyPool = Executors.newFixedThreadPool(2);
        try {
            CountDownLatch start = new CountDownLatch(1);
            Future<String> first = sameKeyPool.submit(() -> concurrentTransferBody(sender, recipientAWallet, "10", "same-key-" + suffix, start));
            Future<String> second = sameKeyPool.submit(() -> concurrentTransferBody(sender, recipientAWallet, "10", "same-key-" + suffix, start));
            start.countDown();
            JsonNode firstBody = mapper.readTree(first.get(20, TimeUnit.SECONDS));
            JsonNode secondBody = mapper.readTree(second.get(20, TimeUnit.SECONDS));
            assertThat(java.util.List.of(firstBody.get("replayed").asBoolean(), secondBody.get("replayed").asBoolean()))
                    .containsExactlyInAnyOrder(false, true);
        } finally {
            sameKeyPool.shutdownNow();
        }
        assertThat(accounts.findById(senderWallet).orElseThrow().getCurrentBalance()).isEqualByComparingTo("20.00");
        BigDecimal recipientBalances = accounts.findById(recipientAWallet).orElseThrow().getCurrentBalance()
                .add(accounts.findById(recipientBWallet).orElseThrow().getCurrentBalance());
        assertThat(recipientBalances).isEqualByComparingTo("80.00");
    }

    private int concurrentTransfer(String token, UUID target, String amount, String key, CountDownLatch start) throws Exception {
        return mapper.readTree(concurrentTransferBody(token, target, amount, key, start)).get("status").asInt();
    }

    private String concurrentTransferBody(String token, UUID target, String amount, String key, CountDownLatch start) throws Exception {
        start.await(10, TimeUnit.SECONDS);
        MvcResult result = mvc.perform(post("/api/wallet/transfers").header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"targetAccountId\":\"" + target + "\",\"amount\":" + amount + ",\"idempotencyKey\":\"" + key + "\"}"))
                .andReturn();
        if (result.getResponse().getStatus() != 200) {
            return "{\"status\":" + result.getResponse().getStatus() + "}";
        }
        JsonNode response = mapper.readTree(result.getResponse().getContentAsString());
        return "{\"status\":200,\"replayed\":" + response.get("replayed").asBoolean() + "}";
    }

    private String signup(String email) throws Exception {
        MvcResult result = mvc.perform(post("/api/wallet/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"Long-strong-password-123!\"}"))
                .andExpect(status().isCreated()).andReturn();
        return mapper.readTree(result.getResponse().getContentAsString()).get("accessToken").asText();
    }
    private String internalSignup(String email) throws Exception {
        MvcResult result = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"Long-strong-password-123!\"}"))
                .andExpect(status().isCreated()).andReturn();
        return mapper.readTree(result.getResponse().getContentAsString()).get("accessToken").asText();
    }
    private UUID walletId(String token) throws Exception {
        MvcResult result = mvc.perform(get("/api/wallet/me").header("Authorization", bearer(token))).andExpect(status().isOk()).andReturn();
        JsonNode body = mapper.readTree(result.getResponse().getContentAsString());
        return UUID.fromString(body.get("id").asText());
    }
    private String bearer(String token) { return "Bearer " + token; }
}
