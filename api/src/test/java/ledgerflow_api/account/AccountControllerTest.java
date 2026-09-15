package ledgerflow_api.account;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.context.annotation.Import;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import ledgerflow_api.transfer.LedgerDirection;
import ledgerflow_api.transfer.LedgerEntry;
import ledgerflow_api.transfer.LedgerEntryRepository;
import ledgerflow_api.transfer.Transfer;
import ledgerflow_api.transfer.TransferRepository;
import ledgerflow_api.TestcontainersConfiguration;
import java.math.BigDecimal;
import java.util.UUID;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@Transactional
@Import(TestcontainersConfiguration.class)

class AccountControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private TransferRepository transferRepository;

    @Autowired
    private LedgerEntryRepository ledgerEntryRepository;
    @Test
    void shouldCreateAccountSuccessfully() throws Exception {
        String payload = """
                {
                    "name": "Test Account",
                    "type": "BANK",
                    "openingBalance": 10000.0
                }
                """;

        mockMvc.perform(post("/api/accounts")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.name").value("Test Account"))
                .andExpect(jsonPath("$.type").value("BANK"))
                .andExpect(jsonPath("$.currentBalance").value(10000.0));
    }

    @Test
    void shouldFailValidationWhenInputIsInvalid() throws Exception {
        String invalidPayload = """
                {
                    "name": "",
                    "type": "CASH",
                    "openingBalance": -50000.00
                }
                """;

        mockMvc.perform(post("/api/accounts")
                .contentType(MediaType.APPLICATION_JSON)
                .content(invalidPayload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message").value("Validation failed"))
                .andExpect(jsonPath("$.fieldErrors.name").exists())
                .andExpect(jsonPath("$.fieldErrors.openingBalance").exists());
    }

    @Test
    void shouldReturn404WhenAccountNotFound() throws Exception {
        mockMvc.perform(get("/api/accounts/00000000-0000-0000-0000-000000000000"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value("Account not found"));
    }

    @Test
    void shouldReturnAccountStatementSuccessfully() throws Exception {
        Account source = accountRepository.save(new Account("Bank", AccountType.BANK, new BigDecimal("100000.00")));
        Account target = accountRepository.save(new Account("Wallet", AccountType.CASH, new BigDecimal("0.00")));
        Transfer transfer = transferRepository.save(new Transfer(
                source.getId(),
                target.getId(),
                new BigDecimal("50000.00"),
                "idemp-stmt-test",
                "Deposit"
        ));
        ledgerEntryRepository.save(new LedgerEntry(transfer.getId(), target.getId(), LedgerDirection.CREDIT, new BigDecimal("50000.00")));
        Transfer secondTransfer = transferRepository.save(new Transfer(
                source.getId(),
                target.getId(),
                new BigDecimal("10000.00"),
                "idemp-stmt-test-second",
                "Second deposit"
        ));
        ledgerEntryRepository.save(new LedgerEntry(secondTransfer.getId(), target.getId(), LedgerDirection.CREDIT, new BigDecimal("10000.00")));

        mockMvc.perform(get("/api/accounts/" + target.getId() + "/statement")
                        .param("page", "0")
                        .param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].accountId").value(target.getId().toString()))
                .andExpect(jsonPath("$.content[0].direction").value("CREDIT"))
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(1))
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.hasNext").value(true));
    }

    @Test
    void shouldFilterAccountStatementOnTheServer() throws Exception {
        Account account = accountRepository.save(new Account("Statement Account", AccountType.BANK, new BigDecimal("100000.00")));
        Account counterparty = accountRepository.save(new Account("Counterparty", AccountType.CASH, new BigDecimal("0.00")));
        Transfer creditTransfer = transferRepository.save(new Transfer(
                account.getId(),
                counterparty.getId(),
                new BigDecimal("25000.00"),
                "idemp-filter-credit",
                "Credit posting"
        ));
        Transfer debitTransfer = transferRepository.save(new Transfer(
                account.getId(),
                counterparty.getId(),
                new BigDecimal("15000.00"),
                "idemp-filter-debit",
                "Debit posting"
        ));
        ledgerEntryRepository.save(new LedgerEntry(creditTransfer.getId(), account.getId(), LedgerDirection.CREDIT, new BigDecimal("25000.00")));
        ledgerEntryRepository.save(new LedgerEntry(debitTransfer.getId(), account.getId(), LedgerDirection.DEBIT, new BigDecimal("15000.00")));

        mockMvc.perform(get("/api/accounts/" + account.getId() + "/statement")
                        .param("direction", "DEBIT")
                        .param("transferId", debitTransfer.getId().toString())
                        .param("from", "2026-01-01")
                        .param("to", "2026-12-31"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].id").exists())
                .andExpect(jsonPath("$.content[0].transferId").value(debitTransfer.getId().toString()))
                .andExpect(jsonPath("$.content[0].direction").value("DEBIT"))
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void shouldRejectAnInvertedStatementDateRange() throws Exception {
        Account account = accountRepository.save(new Account("Range Account", AccountType.BANK, new BigDecimal("0.00")));

        mockMvc.perform(get("/api/accounts/" + account.getId() + "/statement")
                        .param("from", "2026-09-30")
                        .param("to", "2026-09-01"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("From date must be on or before to date"));
    }

    @Test
    void shouldRejectInvalidStatementPagination() throws Exception {
        mockMvc.perform(get("/api/accounts/00000000-0000-0000-0000-000000000000/statement")
                        .param("page", "-1")
                        .param("size", "101"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message").value(
                        "Page must be zero or greater and size must be between 1 and 100"));
    }

    @Test
    void shouldReturn404WhenStatementAccountNotFound() throws Exception {
        mockMvc.perform(get("/api/accounts/00000000-0000-0000-0000-000000000000/statement"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value("Account not found"));
    }

    @Test
    void shouldDepositToAccountSuccessfully() throws Exception {
        Account account = accountRepository.save(new Account("Deposit Target", AccountType.EWALLET, new BigDecimal("10000.00")));

        String idempotencyKey = "dep-test-" + UUID.randomUUID();
        String payload = """
                {
                    "amount": 50000.00,
                    "idempotencyKey": "%s",
                    "description": "Top-up balance"
                }
                """.formatted(idempotencyKey);

        mockMvc.perform(post("/api/accounts/" + account.getId() + "/deposits")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.sourceAccountId").value("00000000-0000-0000-0000-000000000001"))
                .andExpect(jsonPath("$.targetAccountId").value(account.getId().toString()))
                .andExpect(jsonPath("$.amount").value(50000.0))
                .andExpect(jsonPath("$.status").value("COMPLETED"));

        Account updatedAccount = accountRepository.findById(account.getId()).orElseThrow();
        assertThat(updatedAccount.getCurrentBalance()).isEqualByComparingTo("60000.00");
    }
}
