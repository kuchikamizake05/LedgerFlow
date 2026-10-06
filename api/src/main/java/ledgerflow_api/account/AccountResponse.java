package ledgerflow_api.account;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record AccountResponse(
        UUID id,
        String name,
        AccountType type,
        BigDecimal openingBalance,
        BigDecimal currentBalance,
        boolean frozen,
        Instant createdAt) {
    public static AccountResponse fromAccount(Account account) {
        return new AccountResponse(
                account.getId(),
                account.getName(),
                account.getType(),
                account.getOpeningBalance(),
                account.getCurrentBalance(),
                account.isFrozen(),
                account.getCreatedAt());
    }
}
