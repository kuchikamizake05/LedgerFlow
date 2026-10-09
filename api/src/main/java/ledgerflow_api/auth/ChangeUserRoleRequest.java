package ledgerflow_api.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ChangeUserRoleRequest(
        @NotNull AppRole role,
        @NotBlank @Size(max = 255) String reason) {
}
