package ledgerflow_api.reconciliation;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReconciliationService {
    private final JdbcTemplate jdbc;

    public ReconciliationService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Report check() {
        List<AccountResult> accounts = jdbc.query("""
                SELECT a.id, a.opening_balance, a.current_balance,
                       a.opening_balance + COALESCE(SUM(CASE WHEN l.direction = 'CREDIT'
                           THEN l.amount ELSE -l.amount END), 0) AS expected_balance
                FROM accounts a LEFT JOIN ledger_entries l ON l.account_id = a.id
                GROUP BY a.id, a.opening_balance, a.current_balance ORDER BY a.id
                """, (rs, row) -> {
                    BigDecimal expected = rs.getBigDecimal("expected_balance");
                    BigDecimal current = rs.getBigDecimal("current_balance");
                    BigDecimal difference = current.subtract(expected);
                    return new AccountResult(rs.getObject("id", UUID.class),
                            money(rs.getBigDecimal("opening_balance")), money(current),
                            money(expected), money(difference), difference.signum() == 0 ? "BALANCED" : "MISMATCH");
                });
        List<TransferResult> transfers = jdbc.query("""
                SELECT t.id,
                       COALESCE(SUM(CASE WHEN l.direction = 'DEBIT' THEN l.amount ELSE 0 END), 0) AS debits,
                       COALESCE(SUM(CASE WHEN l.direction = 'CREDIT' THEN l.amount ELSE 0 END), 0) AS credits,
                       COUNT(l.id) AS entry_count
                FROM transfers t LEFT JOIN ledger_entries l ON l.transfer_id = t.id
                GROUP BY t.id, t.source_account_id, t.target_account_id, t.amount
                HAVING COUNT(l.id) <> 2
                    OR COUNT(CASE WHEN l.direction = 'DEBIT' AND l.account_id = t.source_account_id
                        AND l.amount = t.amount THEN 1 END) <> 1
                    OR COUNT(CASE WHEN l.direction = 'CREDIT' AND l.account_id = t.target_account_id
                        AND l.amount = t.amount THEN 1 END) <> 1
                ORDER BY t.id
                """, (rs, row) -> {
                    BigDecimal debit = rs.getBigDecimal("debits");
                    BigDecimal credit = rs.getBigDecimal("credits");
                    return new TransferResult(rs.getObject("id", UUID.class), money(debit), money(credit),
                            money(debit.subtract(credit)), rs.getInt("entry_count"));
                });
        long mismatchCount = accounts.stream().filter(account -> account.status().equals("MISMATCH")).count();
        return new Report(Instant.now().toString(), mismatchCount == 0 && transfers.isEmpty() ? "BALANCED" : "MISMATCH",
                accounts.size(), (int) mismatchCount, transfers.size(), accounts, transfers);
    }

    private static String money(BigDecimal value) {
        return value.setScale(2).toPlainString();
    }

    public record Report(String checkedAt, String status, int accountCount, int mismatchedAccountCount,
                         int unbalancedTransferCount, List<AccountResult> accounts,
                         List<TransferResult> unbalancedTransfers) {}

    public record AccountResult(UUID accountId, String openingBalance, String currentBalance,
                                String expectedBalance, String difference, String status) {}

    public record TransferResult(UUID transferId, String debitTotal, String creditTotal,
                                 String difference, int entryCount) {}
}
