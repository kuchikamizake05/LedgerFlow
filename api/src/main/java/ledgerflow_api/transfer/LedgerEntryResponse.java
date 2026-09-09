package ledgerflow_api.transfer;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record LedgerEntryResponse(
        UUID id,
        UUID transferId,
        UUID accountId,
        LedgerDirection direction,
        BigDecimal amount,
        Instant createdAt
) {
    public static LedgerEntryResponse from(LedgerEntry entry) {
        return new LedgerEntryResponse(
                entry.getId(),
                entry.getTransferId(),
                entry.getAccountId(),
                entry.getDirection(),
                entry.getAmount(),
                entry.getCreatedAt()
        );
    }
}