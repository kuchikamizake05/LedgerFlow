package ledgerflow_api.transfer;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record TransferResponse(
        UUID id,
        UUID sourceAccountId,
        UUID targetAccountId,
        BigDecimal amount,
        TransferStatus status,
        String idempotencyKey,
        String description,
        Instant createdAt,
        UUID reversalOf
) {
    public static TransferResponse from(Transfer transfer) {
        return new TransferResponse(
                transfer.getId(),
                transfer.getSourceAccountId(),
                transfer.getTargetAccountId(),
                transfer.getAmount(),
                transfer.getStatus(),
                transfer.getIdempotencyKey(),
                transfer.getDescription(),
                transfer.getCreatedAt(),
                transfer.getReversalOf()
        );
    }
}
