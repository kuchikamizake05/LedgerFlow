package ledgerflow_api.transfer;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "transfer_requests")
public class TransferRequest {
    @Id
    private UUID id;

    @Column(name = "source_account_id", nullable = false)
    private UUID sourceAccountId;

    @Column(name = "target_account_id", nullable = false)
    private UUID targetAccountId;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal amount;

    @Column(name = "idempotency_key", nullable = false, unique = true, length = 100)
    private String idempotencyKey;

    @Column(length = 255)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TransferRequestStatus status;

    @Column(name = "requester_id", nullable = false)
    private UUID requesterId;

    @Column(name = "requester_email", nullable = false, length = 320)
    private String requesterEmail;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "decision_actor_id")
    private UUID decisionActorId;

    @Column(name = "decision_actor_email", length = 320)
    private String decisionActorEmail;

    @Column(name = "decision_reason", length = 255)
    private String decisionReason;

    @Column(name = "decided_at")
    private Instant decidedAt;

    @Column(name = "completed_transfer_id")
    private UUID completedTransferId;

    protected TransferRequest() {
    }

    public TransferRequest(CreateTransferRequest request, UUID requesterId, String requesterEmail) {
        this.id = UUID.randomUUID();
        this.sourceAccountId = request.sourceAccountId();
        this.targetAccountId = request.targetAccountId();
        this.amount = request.amount();
        this.idempotencyKey = request.idempotencyKey();
        this.description = request.description();
        this.status = TransferRequestStatus.PENDING;
        this.requesterId = requesterId;
        this.requesterEmail = requesterEmail;
        this.createdAt = Instant.now();
    }

    public void decide(TransferRequestStatus decision, UUID actorId, String actorEmail, String reason,
            UUID transferId) {
        if (status != TransferRequestStatus.PENDING) {
            throw new IllegalStateException("Only pending requests can be decided");
        }
        this.status = decision;
        this.decisionActorId = actorId;
        this.decisionActorEmail = actorEmail;
        this.decisionReason = reason;
        this.decidedAt = Instant.now();
        this.completedTransferId = transferId;
    }

    public UUID getId() { return id; }
    public UUID getSourceAccountId() { return sourceAccountId; }
    public UUID getTargetAccountId() { return targetAccountId; }
    public BigDecimal getAmount() { return amount; }
    public String getIdempotencyKey() { return idempotencyKey; }
    public String getDescription() { return description; }
    public TransferRequestStatus getStatus() { return status; }
    public UUID getRequesterId() { return requesterId; }
    public String getRequesterEmail() { return requesterEmail; }
    public Instant getCreatedAt() { return createdAt; }
    public UUID getDecisionActorId() { return decisionActorId; }
    public String getDecisionActorEmail() { return decisionActorEmail; }
    public String getDecisionReason() { return decisionReason; }
    public Instant getDecidedAt() { return decidedAt; }
    public UUID getCompletedTransferId() { return completedTransferId; }

    public CreateTransferRequest toCreateTransferRequest() {
        return new CreateTransferRequest(sourceAccountId, targetAccountId, amount, idempotencyKey, description);
    }
}
