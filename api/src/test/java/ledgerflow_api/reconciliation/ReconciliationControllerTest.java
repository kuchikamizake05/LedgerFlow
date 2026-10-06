package ledgerflow_api.reconciliation;

import java.util.UUID;
import ledgerflow_api.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@Import(TestcontainersConfiguration.class)
class ReconciliationControllerTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    @Test void requiresAuthentication() throws Exception {
        mvc.perform(get("/api/reconciliation")).andExpect(status().isUnauthorized());
    }

    @Test void allReadRolesCanCheckSeededTreasury() throws Exception {
        for (String role : new String[]{"AUDITOR", "OPERATOR", "TREASURY_ADMIN"}) {
            mvc.perform(get("/api/reconciliation").with(user("reader").roles(role)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("BALANCED"))
                .andExpect(jsonPath("$.accountCount").value(1))
                .andExpect(jsonPath("$.accounts[0].expectedBalance").value("1000000000.00"));
        }
    }

    @Test void detectsCorruptedBalanceWithoutRepairingIt() throws Exception {
        jdbc.update("UPDATE accounts SET current_balance = current_balance + 1");
        mvc.perform(get("/api/reconciliation").with(user("reader").roles("AUDITOR")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("MISMATCH"))
            .andExpect(jsonPath("$.mismatchedAccountCount").value(1))
            .andExpect(jsonPath("$.accounts[0].difference").value("1.00"));
    }

    @Test void detectsMissingUnequalAndDuplicateJournalPairs() throws Exception {
        UUID account = UUID.randomUUID();
        UUID treasury = UUID.fromString("00000000-0000-0000-0000-000000000001");
        jdbc.update("INSERT INTO accounts (id,name,type,opening_balance,current_balance) VALUES (?,'Target','BANK',0,0)", account);
        for (int count : new int[]{0, 1, 2, 4}) {
            UUID transfer = UUID.randomUUID();
            jdbc.update("INSERT INTO transfers (id,source_account_id,target_account_id,amount,status,idempotency_key) VALUES (?,?,?,10,'COMPLETED',?)", transfer, treasury, account, transfer.toString());
            for (int i = 0; i < count; i++) {
                jdbc.update("INSERT INTO ledger_entries (id,transfer_id,account_id,direction,amount) VALUES (?,?,?,?,?)", UUID.randomUUID(), transfer, i % 2 == 0 ? treasury : account, i % 2 == 0 ? "DEBIT" : "CREDIT", count == 2 && i == 1 ? 9 : 10);
            }
        }
        mvc.perform(get("/api/reconciliation").with(user("reader").roles("AUDITOR")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("MISMATCH"))
            .andExpect(jsonPath("$.unbalancedTransferCount").value(4));
    }

    @Test void acceptsCorrectTransferAndAccountBalances() throws Exception {
        UUID account = UUID.randomUUID();
        UUID treasury = UUID.fromString("00000000-0000-0000-0000-000000000001");
        UUID transfer = UUID.randomUUID();
        jdbc.update("INSERT INTO accounts (id,name,type,opening_balance,current_balance) VALUES (?,'Target','BANK',5,15)", account);
        jdbc.update("UPDATE accounts SET current_balance = current_balance - 10 WHERE id = ?", treasury);
        jdbc.update("INSERT INTO transfers (id,source_account_id,target_account_id,amount,status,idempotency_key) VALUES (?,?,?,10,'COMPLETED',?)", transfer, treasury, account, transfer.toString());
        jdbc.update("INSERT INTO ledger_entries (id,transfer_id,account_id,direction,amount) VALUES (?,?,?,'DEBIT',10)", UUID.randomUUID(), transfer, treasury);
        jdbc.update("INSERT INTO ledger_entries (id,transfer_id,account_id,direction,amount) VALUES (?,?,?,'CREDIT',10)", UUID.randomUUID(), transfer, account);
        mvc.perform(get("/api/reconciliation").with(user("reader").roles("AUDITOR")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("BALANCED"))
            .andExpect(jsonPath("$.unbalancedTransferCount").value(0))
            .andExpect(jsonPath("$.mismatchedAccountCount").value(0));
    }
}
