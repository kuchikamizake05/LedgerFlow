package ledgerflow_api.transfer;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

import ledgerflow_api.account.Account;
import ledgerflow_api.account.AccountRepository;
import ledgerflow_api.account.AccountType;
import ledgerflow_api.TestcontainersConfiguration;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@Transactional
@Import(TestcontainersConfiguration.class)
class TransferControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private TransferRepository transferRepository;

    @Autowired
    private LedgerEntryRepository ledgerEntryRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void shouldCreateIndexForAccountStatementLookup() {
        String indexDefinition = jdbcTemplate.queryForObject("""
                SELECT indexdef
                FROM pg_indexes
                WHERE schemaname = 'public'
                  AND indexname = 'idx_ledger_entries_account_created_at'
                """, String.class);

        assertThat(indexDefinition).contains("account_id, created_at DESC");
    }

    @Test
    void shouldCreateApplicationUsersTable() {
        Integer tableCount = jdbcTemplate.queryForObject("""
                SELECT count(*)
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'app_users'
                """, Integer.class);

        assertThat(tableCount).isEqualTo(1);
    }

    @Test
    void shouldExecuteTransferSuccessfully() throws Exception {
        Account source = accountRepository.save(new Account("Sender", AccountType.BANK, new
BigDecimal("100000.00")));
        Account target = accountRepository.save(new Account("Receiver", AccountType.BANK,
new BigDecimal("0.00")));

        String idempotencyKey = "tx-" + java.util.UUID.randomUUID();
        String payload = """
                {
                    "sourceAccountId": "%s",
                    "targetAccountId": "%s",
                    "amount": 30000.00,
                    "idempotencyKey": "%s",
                    "description": "Payment for lunch"
                }
                """.formatted(source.getId(), target.getId(), idempotencyKey);

        mockMvc.perform(post("/api/transfers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.amount").value(30000.00));

        // Verifikasi saldo kedua akun
        Account updatedSource = accountRepository.findById(source.getId()).orElseThrow();
        Account updatedTarget = accountRepository.findById(target.getId()).orElseThrow();
        assertThat(updatedSource.getCurrentBalance()).isEqualByComparingTo("70000.00");
        assertThat(updatedTarget.getCurrentBalance()).isEqualByComparingTo("30000.00");

        // Verifikasi entri ledger berpasangan (Double-Entry)
        Transfer transfer = transferRepository.findByIdempotencyKey(idempotencyKey).orElseThrow();
        List<LedgerEntry> entries = ledgerEntryRepository.findByTransferIdOrderByCreatedAtAsc(transfer.getId());
        assertThat(entries).hasSize(2);

        LedgerEntry debit = entries.stream().filter(e -> e.getDirection() ==
LedgerDirection.DEBIT).findFirst().orElseThrow();
        LedgerEntry credit = entries.stream().filter(e -> e.getDirection() ==
LedgerDirection.CREDIT).findFirst().orElseThrow();

        assertThat(debit.getAccountId()).isEqualTo(source.getId());
        assertThat(debit.getAmount()).isEqualByComparingTo("30000.00");
        assertThat(credit.getAccountId()).isEqualTo(target.getId());
        assertThat(credit.getAmount()).isEqualByComparingTo("30000.00");
    }

    @Test
    void shouldReturnTheBalancedJournalPostingsForATransfer() throws Exception {
        Account source = accountRepository.save(new Account("Journal Sender", AccountType.BANK, new BigDecimal("100000.00")));
        Account target = accountRepository.save(new Account("Journal Receiver", AccountType.CASH, new BigDecimal("0.00")));
        String idempotencyKey = "journal-entries-" + java.util.UUID.randomUUID();
        String payload = """
                {
                    "sourceAccountId": "%s",
                    "targetAccountId": "%s",
                    "amount": 30000.00,
                    "idempotencyKey": "%s",
                    "description": "Journal detail test"
                }
                """.formatted(source.getId(), target.getId(), idempotencyKey);

        mockMvc.perform(post("/api/transfers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated());

        Transfer transfer = transferRepository.findByIdempotencyKey(idempotencyKey).orElseThrow();
        mockMvc.perform(get("/api/transfers/" + transfer.getId() + "/entries"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[?(@.direction == 'DEBIT')].accountId").value(source.getId().toString()))
                .andExpect(jsonPath("$[?(@.direction == 'CREDIT')].accountId").value(target.getId().toString()))
                .andExpect(jsonPath("$[?(@.direction == 'DEBIT')].amount").value(30000.00))
                .andExpect(jsonPath("$[?(@.direction == 'CREDIT')].amount").value(30000.00));
    }

    @Test
    void shouldReturn404WhenJournalTransferDoesNotExist() throws Exception {
        mockMvc.perform(get("/api/transfers/00000000-0000-0000-0000-000000000000/entries"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Transfer not found"));
    }

    @Test
    void shouldReturnSameTransferWhenIdempotencyKeyRepeated() throws Exception {
        Account source = accountRepository.save(new Account("Sender", AccountType.BANK, new
BigDecimal("100000.00")));
        Account target = accountRepository.save(new Account("Receiver", AccountType.BANK,
new BigDecimal("0.00")));

        String idempotencyKey = "same-key-" + java.util.UUID.randomUUID();
        String payload = """
                {
                    "sourceAccountId": "%s",
                    "targetAccountId": "%s",
                    "amount": 25000.00,
                    "idempotencyKey": "%s",
                    "description": "First attempt"
                }
                """.formatted(source.getId(), target.getId(), idempotencyKey);

        // Request 1
        mockMvc.perform(post("/api/transfers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated());

        // Request 2 dengan idempotency key yang sama
        mockMvc.perform(post("/api/transfers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk());

        // Saldo hanya terpotong satu kali (25.000, bukan 50.000)
        Account updatedSource = accountRepository.findById(source.getId()).orElseThrow();
        assertThat(updatedSource.getCurrentBalance()).isEqualByComparingTo("75000.00");
    }

    @Test
    void shouldRejectIdempotencyKeyWhenPayloadDiffers() throws Exception {
        Account source = accountRepository.save(new Account("Sender", AccountType.BANK, new BigDecimal("100000.00")));
        Account target = accountRepository.save(new Account("Receiver", AccountType.BANK, new BigDecimal("0.00")));

        String idempotencyKey = "payload-conflict-" + java.util.UUID.randomUUID();
        String firstPayload = """
                {
                    "sourceAccountId": "%s",
                    "targetAccountId": "%s",
                    "amount": 25000.00,
                    "idempotencyKey": "%s",
                    "description": "First attempt"
                }
                """.formatted(source.getId(), target.getId(), idempotencyKey);
        String changedPayload = """
                {
                    "sourceAccountId": "%s",
                    "targetAccountId": "%s",
                    "amount": 50000.00,
                    "idempotencyKey": "%s",
                    "description": "Different amount"
                }
                """.formatted(source.getId(), target.getId(), idempotencyKey);

        mockMvc.perform(post("/api/transfers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(firstPayload))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/transfers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(changedPayload))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));

        Account updatedSource = accountRepository.findById(source.getId()).orElseThrow();
        assertThat(updatedSource.getCurrentBalance()).isEqualByComparingTo("75000.00");
    }

    @Test
    void shouldFailWhenInsufficientBalance() throws Exception {
        Account source = accountRepository.save(new Account("Sender", AccountType.BANK, new
BigDecimal("10000.00")));
        Account target = accountRepository.save(new Account("Receiver", AccountType.BANK,
new BigDecimal("0.00")));

        String idempotencyKey = "insufficient-" + java.util.UUID.randomUUID();
        String payload = """
                {
                    "sourceAccountId": "%s",
                    "targetAccountId": "%s",
                    "amount": 50000.00,
                    "idempotencyKey": "%s",
                    "description": "Overspend attempt"
                }
                """.formatted(source.getId(), target.getId(), idempotencyKey);

        mockMvc.perform(post("/api/transfers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message").value("Insufficient balance"));

        // Pastikan saldo tidak berubah
        Account unchangedSource = accountRepository.findById(source.getId()).orElseThrow();
        assertThat(unchangedSource.getCurrentBalance()).isEqualByComparingTo("10000.00");
    }

    @Test
    void shouldGetTransferByIdSuccessfully() throws Exception {
        Account source = accountRepository.save(new Account("Source", AccountType.BANK, new BigDecimal("100000.00")));
        Account target = accountRepository.save(new Account("Target", AccountType.CASH, new BigDecimal("0.00")));

        Transfer transfer = transferRepository.save(new Transfer(
                source.getId(),
                target.getId(),
                new BigDecimal("25000.00"),
                "idemp-get-" + java.util.UUID.randomUUID(),
                "Payment"
        ));

        mockMvc.perform(get("/api/transfers/" + transfer.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(transfer.getId().toString()))
                .andExpect(jsonPath("$.amount").value(25000.0))
                .andExpect(jsonPath("$.status").value("COMPLETED"));
    }

    @Test
    void shouldReturn404WhenTransferNotFound() throws Exception {
        mockMvc.perform(get("/api/transfers/00000000-0000-0000-0000-000000000000"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value("Transfer not found"));
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void shouldReplayConcurrentRequestsWithTheSameIdempotencyKey() throws Exception {
        Account source = accountRepository.saveAndFlush(new Account("Idempotent Source", AccountType.BANK,
                new BigDecimal("100000.00")));
        Account target = accountRepository.saveAndFlush(new Account("Idempotent Target", AccountType.CASH,
                new BigDecimal("0.00")));

        String idempotencyKey = "concurrent-same-key-" + java.util.UUID.randomUUID();
        String payload = """
                {
                    "sourceAccountId": "%s",
                    "targetAccountId": "%s",
                    "amount": 25000.00,
                    "idempotencyKey": "%s",
                    "description": "A retried request"
                }
                """.formatted(source.getId(), target.getId(), idempotencyKey);

        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch readyLatch = new CountDownLatch(2);
        CountDownLatch startLatch = new CountDownLatch(1);
        AtomicInteger createdCount = new AtomicInteger();
        AtomicInteger replayCount = new AtomicInteger();
        AtomicInteger unexpectedCount = new AtomicInteger();

        Runnable requestTask = () -> {
            readyLatch.countDown();
            try {
                startLatch.await();
                int responseStatus = mockMvc.perform(post("/api/transfers")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(payload))
                        .andReturn()
                        .getResponse()
                        .getStatus();

                if (responseStatus == 201) {
                    createdCount.incrementAndGet();
                } else if (responseStatus == 200) {
                    replayCount.incrementAndGet();
                } else {
                    unexpectedCount.incrementAndGet();
                }
            } catch (Exception exception) {
                unexpectedCount.incrementAndGet();
            }
        };

        Future<?> firstRequest = executor.submit(requestTask);
        Future<?> secondRequest = executor.submit(requestTask);
        readyLatch.await();
        startLatch.countDown();
        firstRequest.get();
        secondRequest.get();
        executor.shutdown();

        assertThat(createdCount.get()).isEqualTo(1);
        assertThat(replayCount.get()).isEqualTo(1);
        assertThat(unexpectedCount.get()).isZero();

        Account updatedSource = accountRepository.findById(source.getId()).orElseThrow();
        Account updatedTarget = accountRepository.findById(target.getId()).orElseThrow();
        assertThat(updatedSource.getCurrentBalance()).isEqualByComparingTo("75000.00");
        assertThat(updatedTarget.getCurrentBalance()).isEqualByComparingTo("25000.00");

        Transfer transfer = transferRepository.findByIdempotencyKey(idempotencyKey).orElseThrow();
        assertThat(ledgerEntryRepository.findByTransferIdOrderByCreatedAtAsc(transfer.getId())).hasSize(2);
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void shouldPreventDoubleSpendingUnderConcurrentTransfers() throws Exception {
        Account source = accountRepository.saveAndFlush(new Account("Conc Source", AccountType.BANK, new BigDecimal("100000.00")));
        Account target = accountRepository.saveAndFlush(new Account("Conc Target", AccountType.CASH, new BigDecimal("0.00")));

        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch readyLatch = new CountDownLatch(2);
        CountDownLatch startLatch = new CountDownLatch(1);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failCount = new AtomicInteger(0);

        String key1 = "conc-1-" + java.util.UUID.randomUUID();
        String key2 = "conc-2-" + java.util.UUID.randomUUID();

        Runnable task1 = () -> {
            readyLatch.countDown();
            try {
                startLatch.await();
                String payload = String.format("""
                        {
                            "sourceAccountId": "%s",
                            "targetAccountId": "%s",
                            "amount": 80000.00,
                            "idempotencyKey": "%s",
                            "description": "Concurrent 1"
                        }
                        """, source.getId(), target.getId(), key1);
                int status = mockMvc.perform(post("/api/transfers")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(payload))
                        .andReturn().getResponse().getStatus();
                if (status == 201) successCount.incrementAndGet();
                else if (status == 400) failCount.incrementAndGet();
            } catch (Exception e) {
                failCount.incrementAndGet();
            }
        };

        Runnable task2 = () -> {
            readyLatch.countDown();
            try {
                startLatch.await();
                String payload = String.format("""
                        {
                            "sourceAccountId": "%s",
                            "targetAccountId": "%s",
                            "amount": 80000.00,
                            "idempotencyKey": "%s",
                            "description": "Concurrent 2"
                        }
                        """, source.getId(), target.getId(), key2);
                int status = mockMvc.perform(post("/api/transfers")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(payload))
                        .andReturn().getResponse().getStatus();
                if (status == 201) successCount.incrementAndGet();
                else if (status == 400) failCount.incrementAndGet();
            } catch (Exception e) {
                failCount.incrementAndGet();
            }
        };

        Future<?> f1 = executor.submit(task1);
        Future<?> f2 = executor.submit(task2);

        readyLatch.await();
        startLatch.countDown();

        f1.get();
        f2.get();
        executor.shutdown();

        assertThat(successCount.get()).isEqualTo(1);
        assertThat(failCount.get()).isEqualTo(1);

        Account updatedSource = accountRepository.findById(source.getId()).orElseThrow();
        Account updatedTarget = accountRepository.findById(target.getId()).orElseThrow();

        assertThat(updatedSource.getCurrentBalance()).isEqualByComparingTo("20000.00");
        assertThat(updatedTarget.getCurrentBalance()).isEqualByComparingTo("80000.00");
    }
}
