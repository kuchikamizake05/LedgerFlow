package ledgerflow_api.transfer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.util.UUID;

import ledgerflow_api.TestcontainersConfiguration;
import ledgerflow_api.account.Account;
import ledgerflow_api.account.AccountRepository;
import ledgerflow_api.account.AccountType;
import ledgerflow_api.audit.AuditEventRepository;
import ledgerflow_api.auth.AppRole;
import ledgerflow_api.auth.AppUser;
import ledgerflow_api.auth.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class TransferApprovalControllerTest {
    @Autowired MockMvc mvc;
    @Autowired AccountRepository accounts;
    @Autowired TransferRepository transfers;
    @Autowired LedgerEntryRepository entries;
    @Autowired AuditEventRepository auditEvents;
    @Autowired JwtService jwt;

    @Test
    void operatorSubmitsPendingRequestWithoutMovingMoneyAndCanReplayIt() throws Exception {
        Account source = account("100");
        Account target = account("0");
        AppUser requester = user(AppRole.OPERATOR);
        String key = UUID.randomUUID().toString();
        String payload = request(source, target, key, "25.00");

        mvc.perform(post("/api/transfer-requests")
                        .header("Authorization", bearer(requester))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.requesterId").value(requester.getId().toString()))
                .andExpect(jsonPath("$.requesterEmail").value(requester.getEmail()))
                .andExpect(jsonPath("$.completedTransferId").doesNotExist());

        mvc.perform(post("/api/transfer-requests")
                        .header("Authorization", bearer(requester))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"));

        assertThat(accounts.findById(source.getId()).orElseThrow().getCurrentBalance()).isEqualByComparingTo("100");
        assertThat(accounts.findById(target.getId()).orElseThrow().getCurrentBalance()).isEqualByComparingTo("0");
        assertThat(transfers.findByIdempotencyKey(key)).isEmpty();
        assertThat(entries.count()).isZero();
    }

    @Test
    void onlyAnotherAdminCanApproveAndApprovalReplayDoesNotPostTwice() throws Exception {
        Account source = account("100");
        Account target = account("0");
        AppUser requester = user(AppRole.OPERATOR);
        AppUser administrator = user(AppRole.TREASURY_ADMIN);
        String key = UUID.randomUUID().toString();
        String payload = request(source, target, key, "25.00");

        String requestId = submit(payload, requester);
        mvc.perform(post("/api/transfer-requests/{id}/approve", requestId)
                        .header("Authorization", bearer(requester))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Reviewed\"}"))
                .andExpect(status().isForbidden());

        String approval = "{\"reason\":\"Reviewed\"}";
        mvc.perform(post("/api/transfer-requests/{id}/approve", requestId)
                        .header("Authorization", bearer(administrator))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(approval))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"))
                .andExpect(jsonPath("$.decisionActorId").value(administrator.getId().toString()))
                .andExpect(jsonPath("$.decisionReason").value("Reviewed"))
                .andExpect(jsonPath("$.completedTransferId").isNotEmpty());

        mvc.perform(post("/api/transfer-requests/{id}/approve", requestId)
                        .header("Authorization", bearer(administrator))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(approval))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"));

        assertThat(accounts.findById(source.getId()).orElseThrow().getCurrentBalance()).isEqualByComparingTo("75");
        assertThat(accounts.findById(target.getId()).orElseThrow().getCurrentBalance()).isEqualByComparingTo("25");
        assertThat(transfers.findByIdempotencyKey(key)).hasValueSatisfying(transfer ->
                assertThat(entries.findByTransferIdOrderByCreatedAtAsc(transfer.getId())).hasSize(2));
    }

    @Test
    void ordinaryTransferEndpointCannotBypassApproval() throws Exception {
        Account source = account("100");
        Account target = account("0");
        AppUser requester = user(AppRole.OPERATOR);
        String payload = request(source, target, UUID.randomUUID().toString(), "25.00");

        mvc.perform(post("/api/transfers")
                        .header("Authorization", bearer(requester))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Approval required"));

        assertThat(accounts.findById(source.getId()).orElseThrow().getCurrentBalance()).isEqualByComparingTo("100");
        assertThat(entries.count()).isZero();
    }

    @Test
    void allAuthenticatedRolesCanReadPagedRequestsAndDetails() throws Exception {
        Account source = account("100");
        Account target = account("0");
        AppUser requester = user(AppRole.OPERATOR);
        String requestId = submit(request(source, target, UUID.randomUUID().toString(), "5.00"), requester);

        mvc.perform(get("/api/transfer-requests?page=0&size=1&status=PENDING")
                        .header("Authorization", bearer(user(AppRole.AUDITOR))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].id").value(requestId))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(1));

        mvc.perform(get("/api/transfer-requests/{id}", requestId)
                        .header("Authorization", bearer(user(AppRole.AUDITOR))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(requestId));
    }

    @Test
    void replayWithChangedPayloadOrDifferentRequesterConflicts() throws Exception {
        Account source = account("100");
        Account target = account("0");
        AppUser requester = user(AppRole.OPERATOR);
        String key = UUID.randomUUID().toString();
        String payload = request(source, target, key, "5.00");
        submit(payload, requester);

        mvc.perform(post("/api/transfer-requests")
                        .header("Authorization", bearer(requester))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload.replace("5.00", "6.00")))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/transfer-requests")
                        .header("Authorization", bearer(user(AppRole.OPERATOR)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isConflict());
    }

    @Test
    void adminCannotDecideOwnRequestAndRejectDoesNotCreateFinancialEntries() throws Exception {
        Account source = account("100");
        Account target = account("0");
        AppUser administrator = user(AppRole.TREASURY_ADMIN);
        String key = UUID.randomUUID().toString();
        String requestId = submit(request(source, target, key, "5.00"), administrator);
        String rejection = "{\"reason\":\"Duplicate invoice\"}";

        mvc.perform(post("/api/transfer-requests/{id}/reject", requestId)
                        .header("Authorization", bearer(administrator))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(rejection))
                .andExpect(status().isForbidden());

        AppUser otherAdministrator = user(AppRole.TREASURY_ADMIN);
        mvc.perform(post("/api/transfer-requests/{id}/reject", requestId)
                        .header("Authorization", bearer(otherAdministrator))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(rejection))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"))
                .andExpect(jsonPath("$.decisionActorId").value(otherAdministrator.getId().toString()))
                .andExpect(jsonPath("$.decisionReason").value("Duplicate invoice"))
                .andExpect(jsonPath("$.completedTransferId").value(org.hamcrest.Matchers.nullValue()));

        mvc.perform(post("/api/transfer-requests/{id}/reject", requestId)
                        .header("Authorization", bearer(otherAdministrator))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(rejection))
                .andExpect(status().isOk());
        mvc.perform(post("/api/transfer-requests/{id}/reject", requestId)
                        .header("Authorization", bearer(otherAdministrator))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Changed reason\"}"))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/transfer-requests/{id}/approve", requestId)
                        .header("Authorization", bearer(user(AppRole.TREASURY_ADMIN)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Approve instead\"}"))
                .andExpect(status().isConflict());

        assertThat(accounts.findById(source.getId()).orElseThrow().getCurrentBalance()).isEqualByComparingTo("100");
        assertThat(accounts.findById(target.getId()).orElseThrow().getCurrentBalance()).isEqualByComparingTo("0");
        assertThat(transfers.findByIdempotencyKey(key)).isEmpty();
        assertThat(entries.count()).isZero();
    }

    @Test
    void aSubmissionKeyCannotCollideWithATreasuryDeposit() throws Exception {
        Account source = account("100");
        Account target = account("0");
        String key = UUID.randomUUID().toString();
        AppUser admin = user(AppRole.TREASURY_ADMIN);
        mvc.perform(post("/api/accounts/{id}/deposits", target.getId())
                        .header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\":5.00,\"idempotencyKey\":\"" + key + "\"}"))
                .andExpect(status().isCreated());

        mvc.perform(post("/api/transfer-requests")
                        .header("Authorization", bearer(user(AppRole.OPERATOR)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request(source, target, key, "5.00")))
                .andExpect(status().isConflict());
    }

    private Account account(String amount) {
        return accounts.saveAndFlush(new Account("Approval test", AccountType.BANK, new BigDecimal(amount)));
    }

    private AppUser user(AppRole role) {
        return new AppUser(UUID.randomUUID() + "@approval.test", "unused", role);
    }

    private String bearer(AppUser user) {
        return "Bearer " + jwt.issue(user).value();
    }

    private String request(Account source, Account target, String key, String amount) {
        return """
                {"sourceAccountId":"%s","targetAccountId":"%s","amount":%s,"idempotencyKey":"%s","description":"Approval test"}
                """.formatted(source.getId(), target.getId(), amount, key);
    }

    private String submit(String payload, AppUser requester) throws Exception {
        return mvc.perform(post("/api/transfer-requests")
                        .header("Authorization", bearer(requester))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString().replaceAll(".*\\\"id\\\":\\\"([^\\\"]+)\\\".*", "$1");
    }
}
