package ledgerflow_api.auth;

import java.sql.Connection;
import java.sql.Statement;
import java.util.UUID;
import ledgerflow_api.audit.AuditService;
import ledgerflow_api.common.PageResponse;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class UserManagementService {
    private static final String USER_ROLE_CHANGED = "USER_ROLE_CHANGED";
    private static final String ROLE_CHANGE_LOCK_SQL = "select pg_advisory_xact_lock(1279675733, 1)";

    private final AppUserRepository users;
    private final JdbcTemplate jdbc;
    private final AuditService audit;

    public UserManagementService(AppUserRepository users, JdbcTemplate jdbc, AuditService audit) {
        this.users = users;
        this.jdbc = jdbc;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public PageResponse<UserResponse> list(int page, int size) {
        validatePage(page, size);
        return PageResponse.from(users.findAllByOrderByCreatedAtDescIdDesc(
                PageRequest.of(page, size, Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))))
                .map(UserResponse::from));
    }

    @Transactional
    public UserResponse changeRole(UUID targetId, ChangeUserRoleRequest request) {
        AuditService.Actor jwtActor = audit.currentAuthenticatedActor();
        acquireRoleChangeLock();

        users.findById(jwtActor.id())
                .filter(AppUser::isEnabled)
                .filter(user -> user.getRole() == AppRole.TREASURY_ADMIN)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "You do not have permission to perform this action"));

        AppUser target = users.findByIdForUpdate(targetId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User was not found"));
        AppRole oldRole = target.getRole();
        if (oldRole == request.role()) {
            return UserResponse.from(target);
        }

        if (target.isEnabled() && oldRole == AppRole.TREASURY_ADMIN
                && request.role() != AppRole.TREASURY_ADMIN
                && users.countByEnabledTrueAndRole(AppRole.TREASURY_ADMIN) <= 1) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "The last enabled treasury admin cannot be demoted");
        }

        target.changeRole(request.role());
        audit.record(USER_ROLE_CHANGED, targetId, auditDescription(oldRole, request.role(), request.reason()));
        return UserResponse.from(target);
    }

    private void acquireRoleChangeLock() {
        jdbc.execute((ConnectionCallback<Void>) connection -> {
            try (Statement statement = connection.createStatement()) {
                statement.execute(ROLE_CHANGE_LOCK_SQL);
            }
            return null;
        });
    }

    private void validatePage(int page, int size) {
        if (page < 0 || size < 1 || size > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Page must be zero or greater and size must be between 1 and 100");
        }
    }

    private String auditDescription(AppRole oldRole, AppRole newRole, String reason) {
        String prefix = "Role changed from " + oldRole.name() + " to " + newRole.name() + ". Reason: ";
        String cleanReason = reason.trim();
        return prefix + cleanReason;
    }
}
