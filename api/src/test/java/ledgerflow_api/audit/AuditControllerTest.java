package ledgerflow_api.audit;

import ledgerflow_api.TestcontainersConfiguration;
import ledgerflow_api.account.*;
import ledgerflow_api.auth.*;
import ledgerflow_api.transfer.*;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @Import(TestcontainersConfiguration.class)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class AuditControllerTest {
    @Autowired MockMvc mvc;
    @Autowired JwtService jwt;
    @Autowired AccountRepository accounts;
    @Autowired TransferService transfers;
    @Autowired AuditService audit;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager transactionManager;

    @Test void recordsRealJwtActorAndAllowsEveryRoleToRead() throws Exception {
        AppUser actor = new AppUser(UUID.randomUUID()+"@test.local", "never-serialize", AppRole.TREASURY_ADMIN);
        String token = jwt.issue(actor).value();
        long before = jdbc.queryForObject("select count(*) from audit_events", Long.class);
        mvc.perform(post("/api/accounts").header("Authorization", "Bearer "+token)
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Audit account\",\"type\":\"BANK\",\"openingBalance\":0}"))
                .andExpect(status().isCreated());
        assertThat(jdbc.queryForObject("select count(*) from audit_events", Long.class)).isEqualTo(before+1);
        for (AppRole role : AppRole.values()) {
            mvc.perform(get("/api/audit").param("action","ACCOUNT_CREATED").param("size","1")
                    .header("Authorization", "Bearer "+jwt.issue(new AppUser("reader@test.local","unused",role)).value()))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].actorId").value(actor.getId().toString()))
                    .andExpect(jsonPath("$.content[0].actorEmail").value(actor.getEmail()))
                    .andExpect(jsonPath("$.content[0].actorRole").value("TREASURY_ADMIN"))
                    .andExpect(jsonPath("$.content[0].password").doesNotExist())
                    .andExpect(jsonPath("$.content[0].accessToken").doesNotExist());
        }
    }

    @Test void replayCreatesOneEventAndFiltersByResource() throws Exception {
        Account source=accounts.saveAndFlush(new Account("Source",AccountType.BANK,new BigDecimal("10")));
        Account target=accounts.saveAndFlush(new Account("Target",AccountType.BANK,BigDecimal.ZERO));
        CreateTransferRequest request=new CreateTransferRequest(source.getId(),target.getId(),BigDecimal.ONE,UUID.randomUUID().toString(),null);
        UUID id=transfers.executeTransfer(request).transfer().id();
        transfers.executeTransfer(request);
        String token=jwt.issue(new AppUser("reader@test.local","unused",AppRole.AUDITOR)).value();
        mvc.perform(get("/api/audit").param("resourceId",id.toString()).param("action","TRANSFER_COMPLETED")
                .header("Authorization","Bearer "+token)).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1)).andExpect(jsonPath("$.content[0].actorRole").value("SYSTEM"));
        mvc.perform(get("/api/audit").param("resourceId",id.toString()).param("page","1").param("size","1")
                .header("Authorization","Bearer "+token)).andExpect(status().isOk()).andExpect(jsonPath("$.content").isEmpty());
        mvc.perform(get("/api/audit").param("size","101").header("Authorization","Bearer "+token)).andExpect(status().isBadRequest());
        mvc.perform(get("/api/audit")).andExpect(status().isUnauthorized());
    }

    @Test void auditFailureRollsBackBusinessMutation() {
        UUID resource=UUID.randomUUID();
        assertThatThrownBy(()->new TransactionTemplate(transactionManager).executeWithoutResult(status->{
            accounts.saveAndFlush(new Account("Rollback",AccountType.BANK,BigDecimal.ZERO));
            audit.record("INVALID_ACTION",resource,"must fail");
        })).isInstanceOf(RuntimeException.class);
        assertThat(accounts.findAll().stream().filter(a->a.getName().equals("Rollback"))).isEmpty();
    }

    @Test void eventsCannotBeUpdatedOrDeleted() {
        UUID resource=UUID.randomUUID();
        new TransactionTemplate(transactionManager).executeWithoutResult(status->audit.record("ACCOUNT_CREATED",resource,"created"));
        assertThatThrownBy(()->jdbc.update("update audit_events set description='changed' where resource_id=?",resource)).isInstanceOf(RuntimeException.class);
        assertThatThrownBy(()->jdbc.update("delete from audit_events where resource_id=?",resource)).isInstanceOf(RuntimeException.class);
        assertThatThrownBy(()->jdbc.execute("truncate audit_events")).isInstanceOf(RuntimeException.class);
        assertThatThrownBy(()->audit.record("ACCOUNT_CREATED",UUID.randomUUID(),"outside transaction")).isInstanceOf(RuntimeException.class);
    }
}
