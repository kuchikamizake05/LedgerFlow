package ledgerflow_api.wallet;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import ledgerflow_api.transfer.LedgerDirection;
import ledgerflow_api.transfer.TransferStatus;

public record WalletReceiptResponse(UUID id, String kind, LedgerDirection direction,
        BigDecimal amount, TransferStatus status, Instant createdAt, Participant source,
        Participant target, String description, UUID reversalOf) {
    public record Participant(UUID id, String name) {}
}
