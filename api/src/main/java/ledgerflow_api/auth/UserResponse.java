package ledgerflow_api.auth;

import java.util.UUID;

public record UserResponse(UUID id, String email, AppRole role) {
    public static UserResponse from(AppUser user) {
        return new UserResponse(user.getId(), user.getEmail(), user.getRole());
    }
}
