package ledgerflow_api.audit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "audit_events")
public class AuditEvent {
    @Id
    private UUID id;

    @Column(name = "actor_id")
    private UUID actorId;

    @Column(name = "actor_email", nullable = false, length = 320)
    private String actorEmail;

    @Column(name = "actor_role", nullable = false, length = 30)
    private String actorRole;

    @Column(nullable = false, length = 64)
    private String action;

    @Column(name = "resource_id", nullable = false)
    private UUID resourceId;

    @Column(nullable = false, length = 255)
    private String description;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected AuditEvent() {}

    AuditEvent(UUID actorId, String actorEmail, String actorRole, String action, UUID resourceId, String description) {
        this.id = UUID.randomUUID();
        this.actorId = actorId;
        this.actorEmail = actorEmail;
        this.actorRole = actorRole;
        this.action = action;
        this.resourceId = resourceId;
        this.description = description;
        this.createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public UUID getActorId() { return actorId; }
    public String getActorEmail() { return actorEmail; }
    public String getActorRole() { return actorRole; }
    public String getAction() { return action; }
    public UUID getResourceId() { return resourceId; }
    public String getDescription() { return description; }
    public Instant getCreatedAt() { return createdAt; }
}
