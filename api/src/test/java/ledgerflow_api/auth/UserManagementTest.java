package ledgerflow_api.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executors;
import ledgerflow_api.TestcontainersConfiguration;
import ledgerflow_api.audit.AuditEventRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class UserManagementTest {

    @Autowired MockMvc mvc;
    @Autowired JwtService jwt;
    @Autowired AppUserRepository users;
    @Autowired AuditEventRepository auditEvents;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void clearTestRows() {
        jdbc.update("delete from audit_events");
        jdbc.update("delete from app_users");
    }

    @Test
    void adminCanListUsersWithoutPasswordFields() throws Exception {
        AppUser admin = user(AppRole.TREASURY_ADMIN);
        AppUser auditor = user(AppRole.AUDITOR);

        mvc.perform(get("/api/users?page=0&size=1").header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(1))
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[0].passwordHash").doesNotExist())
                .andExpect(jsonPath("$.content[0].password").doesNotExist());
    }

    @Test
    void nonAdminCannotListOrChangeRoles() throws Exception {
        AppUser auditor = user(AppRole.AUDITOR);
        AppUser target = user(AppRole.OPERATOR);

        mvc.perform(get("/api/users").header("Authorization", bearer(auditor)))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/users/{id}/role", target.getId())
                        .header("Authorization", bearer(auditor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"AUDITOR\",\"reason\":\"review\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void roleChangeRecordsOldAndNewRoleAndReasonAndSameRoleDoesNotAddAudit() throws Exception {
        AppUser admin = user(AppRole.TREASURY_ADMIN);
        AppUser target = user(AppRole.OPERATOR);
        long before = auditEvents.count();

        mvc.perform(post("/api/users/{id}/role", target.getId())
                        .header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"AUDITOR\",\"reason\":\"Quarterly access review\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(target.getId().toString()))
                .andExpect(jsonPath("$.role").value("AUDITOR"))
                .andExpect(jsonPath("$.passwordHash").doesNotExist());

        assertThat(auditEvents.count()).isEqualTo(before + 1);
        var event = auditEvents.findAll().stream().filter(e -> e.getAction().equals("USER_ROLE_CHANGED")).findFirst().orElseThrow();
        assertThat(event.getActorId()).isEqualTo(admin.getId());
        assertThat(event.getActorRole()).isEqualTo("TREASURY_ADMIN");
        assertThat(event.getResourceId()).isEqualTo(target.getId());
        assertThat(event.getDescription()).contains("OPERATOR", "AUDITOR", "Quarterly access review");

        mvc.perform(post("/api/users/{id}/role", target.getId())
                        .header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"AUDITOR\",\"reason\":\"No change\"}"))
                .andExpect(status().isOk());
        assertThat(auditEvents.count()).isEqualTo(before + 1);
    }

    @Test
    void rejectsUnknownRoleBlankReasonAndReasonOver255Characters() throws Exception {
        AppUser admin = user(AppRole.TREASURY_ADMIN);
        AppUser target = user(AppRole.OPERATOR);
        String path = "/api/users/" + target.getId() + "/role";

        mvc.perform(post(path).header("Authorization", bearer(admin)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"OWNER\",\"reason\":\"review\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post(path).header("Authorization", bearer(admin)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"AUDITOR\",\"reason\":\"   \"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post(path).header("Authorization", bearer(admin)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"AUDITOR\",\"reason\":\"" + "x".repeat(256) + "\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void onlyEnabledPersistedUsersCanAuthenticateAndMeUsesCurrentRole() throws Exception {
        AppUser promoted = user(AppRole.AUDITOR);
        String staleAuditorToken = bearer(promoted);
        jdbc.update("update app_users set role = ? where id = ?", AppRole.TREASURY_ADMIN.name(), promoted.getId());

        mvc.perform(get("/api/users").header("Authorization", staleAuditorToken))
                .andExpect(status().isOk());
        mvc.perform(get("/api/auth/me").header("Authorization", staleAuditorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("TREASURY_ADMIN"));

        AppUser unsaved = new AppUser("missing-" + UUID.randomUUID() + "@example.com", "unused", AppRole.TREASURY_ADMIN);
        mvc.perform(get("/api/auth/me").header("Authorization", jwt.issue(unsaved).value()))
                .andExpect(status().isUnauthorized());

        AppUser disabled = user(AppRole.AUDITOR);
        jdbc.update("update app_users set enabled = false where id = ?", disabled.getId());
        mvc.perform(get("/api/auth/me").header("Authorization", bearer(disabled)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void staleAdminTokenLosesAccessAfterDemotionAndCannotChangeAnotherRole() throws Exception {
        AppUser admin = user(AppRole.TREASURY_ADMIN);
        String staleToken = bearer(admin);
        AppUser target = user(AppRole.OPERATOR);
        jdbc.update("update app_users set role = ? where id = ?", AppRole.AUDITOR.name(), admin.getId());

        mvc.perform(get("/api/users").header("Authorization", staleToken))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/users/{id}/role", target.getId()).header("Authorization", staleToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"AUDITOR\",\"reason\":\"review\"}"))
                .andExpect(status().isForbidden());
        assertThat(users.findById(target.getId()).orElseThrow().getRole()).isEqualTo(AppRole.OPERATOR);
    }

    @Test
    void cannotDemoteTheLastEnabledAdmin() throws Exception {
        AppUser admin = user(AppRole.TREASURY_ADMIN);

        mvc.perform(post("/api/users/{id}/role", admin.getId()).header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"AUDITOR\",\"reason\":\"access review\"}"))
                .andExpect(status().isConflict());
        assertThat(users.findById(admin.getId()).orElseThrow().getRole()).isEqualTo(AppRole.TREASURY_ADMIN);
    }

    @Test
    void simultaneousMutualDemotionsLeaveOneEnabledAdmin() throws Exception {
        AppUser first = user(AppRole.TREASURY_ADMIN);
        AppUser second = user(AppRole.TREASURY_ADMIN);

        try (var executor = Executors.newFixedThreadPool(2)) {
            var firstRequest = CompletableFuture.supplyAsync(() -> changeRole(first, second), executor);
            var secondRequest = CompletableFuture.supplyAsync(() -> changeRole(second, first), executor);
            int firstStatus = firstRequest.join();
            int secondStatus = secondRequest.join();
            assertThat(java.util.List.of(firstStatus, secondStatus)).contains(200, 403);
            assertThat(users.findAll().stream().filter(u -> u.isEnabled() && u.getRole() == AppRole.TREASURY_ADMIN)).hasSize(1);
        }
    }

    @Test
    void auditFailureRollsBackRoleChange() throws Exception {
        AppUser admin = user(AppRole.TREASURY_ADMIN);
        AppUser target = user(AppRole.OPERATOR);
        jdbc.execute("alter table audit_events add constraint reject_user_role_audit check (action <> 'USER_ROLE_CHANGED')");
        try {
            mvc.perform(post("/api/users/{id}/role", target.getId()).header("Authorization", bearer(admin))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"role\":\"AUDITOR\",\"reason\":\"access review\"}"))
                    .andExpect(status().is5xxServerError());
            assertThat(users.findById(target.getId()).orElseThrow().getRole()).isEqualTo(AppRole.OPERATOR);
        } finally {
            jdbc.execute("alter table audit_events drop constraint reject_user_role_audit");
        }
    }

    private AppUser user(AppRole role) {
        return users.saveAndFlush(new AppUser(UUID.randomUUID() + "@example.com", "test-password-hash", role));
    }

    private String bearer(AppUser user) {
        return "Bearer " + jwt.issue(user).value();
    }

    private int changeRole(AppUser actor, AppUser target) {
        try {
            return mvc.perform(post("/api/users/{id}/role", target.getId())
                            .header("Authorization", bearer(actor))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"role\":\"AUDITOR\",\"reason\":\"concurrent review\"}"))
                    .andReturn().getResponse().getStatus();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
