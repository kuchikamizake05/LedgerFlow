package ledgerflow_api.audit;

import java.util.UUID;
import ledgerflow_api.common.PageResponse;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuditService {
    private final AuditEventRepository repository;

    public AuditService(AuditEventRepository repository) {
        this.repository = repository;
    }

    /** Records an event in the caller's transaction; audit failures abort the business operation. */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public void record(String action, UUID resourceId, String description) {
        if (!TransactionSynchronizationManager.isActualTransactionActive()) {
            throw new IllegalStateException("Audit events must be recorded inside a business transaction");
        }
        Actor actor = currentActor();
        repository.save(new AuditEvent(actor.id(), actor.email(), actor.role(), action, resourceId, description));
    }

    @Transactional(readOnly = true)
    public PageResponse<AuditEventResponse> search(int page, int size, String action, UUID resourceId) {
        if (page < 0 || size < 1 || size > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Page must be zero or greater and size must be between 1 and 100");
        }
        Specification<AuditEvent> filter = (root, query, cb) -> cb.conjunction();
        if (action != null) {
            filter = filter.and((root, query, cb) -> cb.equal(root.get("action"), action));
        }
        if (resourceId != null) {
            filter = filter.and((root, query, cb) -> cb.equal(root.get("resourceId"), resourceId));
        }
        var results = repository.findAll(filter, PageRequest.of(page, size,
                Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))));
        return PageResponse.from(results.map(AuditEventResponse::from));
    }

    public Actor currentAuthenticatedActor() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken
                || !(authentication instanceof JwtAuthenticationToken jwtAuthentication)) {
            throw new IllegalStateException("Authenticated audit actor must be a JWT");
        }
        Jwt jwt = jwtAuthentication.getToken();
        try {
            UUID id = UUID.fromString(jwt.getSubject());
            String email = jwt.getClaimAsString("email");
            String role = jwt.getClaimAsString("role");
            if (email == null || email.isBlank() || role == null || role.isBlank()) {
                throw new IllegalStateException("JWT is missing audit attribution claims");
            }
            return new Actor(id, email, role);
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException("JWT has invalid audit attribution claims", exception);
        }
    }

    private Actor currentActor() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            return new Actor(null, "system@ledgerflow.internal", "SYSTEM");
        }
        return currentAuthenticatedActor();
    }

    public record Actor(UUID id, String email, String role) {}
}
