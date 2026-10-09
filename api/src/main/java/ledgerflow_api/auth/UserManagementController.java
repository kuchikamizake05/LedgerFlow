package ledgerflow_api.auth;

import jakarta.validation.Valid;
import java.util.UUID;
import ledgerflow_api.common.PageResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
public class UserManagementController {
    private final UserManagementService users;

    public UserManagementController(UserManagementService users) {
        this.users = users;
    }

    @GetMapping
    public PageResponse<UserResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return users.list(page, size);
    }

    @PostMapping("/{id}/role")
    public ResponseEntity<UserResponse> changeRole(
            @PathVariable UUID id,
            @Valid @RequestBody ChangeUserRoleRequest request) {
        return ResponseEntity.ok(users.changeRole(id, request));
    }
}
