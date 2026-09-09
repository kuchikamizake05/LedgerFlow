package ledgerflow_api.account;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import ledgerflow_api.transfer.LedgerDirection;
import ledgerflow_api.transfer.LedgerEntry;
import ledgerflow_api.transfer.LedgerEntryRepository;
import ledgerflow_api.transfer.Transfer;
import ledgerflow_api.transfer.TransferRepository;
import java.math.BigDecimal;
import java.util.UUID;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional

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

        mockMvc.perform(get("/api/accounts/" + target.getId() + "/statement"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].accountId").value(target.getId().toString()))
                .andExpect(jsonPath("$[0].direction").value("CREDIT"))
                .andExpect(jsonPath("$[0].amount").value(50000.0));
    }

    @Test
    void shouldReturn404WhenStatementAccountNotFound() throws Exception {
        mockMvc.perform(get("/api/accounts/00000000-0000-0000-0000-000000000000/statement"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value("Account not found"));
    }
}
