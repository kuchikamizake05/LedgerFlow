package ledgerflow_api.transfer;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record TransferRequestResponse(
        UUID id,
        UUID sourceAccountId,
        UUID targetAccountId,
        BigDecimal amount,
        String idempotencyKey,
        String description,
        TransferRequestStatus status,
        UUID requesterId,
        String requesterEmail,
        Instant createdAt,
        UUID decisionActorId,
        String decisionActorEmail,
        String decisionReason,
        Instant decidedAt,
        UUID completedTransferId) {

    public static TransferRequestResponse from(TransferRequest request) {
        return new TransferRequestResponse(
                request.getId(), request.getSourceAccountId(), request.getTargetAccountId(), request.getAmount(),
                request.getIdempotencyKey(), request.getDescription(), request.getStatus(), request.getRequesterId(),
                request.getRequesterEmail(), request.getCreatedAt(), request.getDecisionActorId(),
                request.getDecisionActorEmail(), request.getDecisionReason(), request.getDecidedAt(),
                request.getCompletedTransferId());
    }
}
