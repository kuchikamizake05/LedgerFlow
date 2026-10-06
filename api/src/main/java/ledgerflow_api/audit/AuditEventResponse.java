package ledgerflow_api.audit;

import java.time.Instant;
import java.util.UUID;

public record AuditEventResponse(
        UUID id,
        UUID actorId,
        String actorEmail,
        String actorRole,
        String action,
        UUID resourceId,
        String description,
        Instant createdAt) {
    public static AuditEventResponse from(AuditEvent event) {
        return new AuditEventResponse(event.getId(), event.getActorId(), event.getActorEmail(),
                event.getActorRole(), event.getAction(), event.getResourceId(), event.getDescription(), event.getCreatedAt());
    }
}
