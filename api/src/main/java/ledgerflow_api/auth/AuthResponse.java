package ledgerflow_api.auth;

import java.time.Instant;

public record AuthResponse(UserResponse user, String accessToken, String tokenType, Instant expiresAt) {
}
