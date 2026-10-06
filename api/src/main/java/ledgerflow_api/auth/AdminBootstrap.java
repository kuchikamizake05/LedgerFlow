package ledgerflow_api.auth;

import jakarta.validation.Validation;
import jakarta.validation.constraints.Email;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Explicit opt-in provisioning; never changes an existing user's credentials or access. */
@Component
public class AdminBootstrap implements ApplicationRunner {
    private final AppUserRepository users;
    private final PasswordEncoder encoder;
    private final String email;
    private final String password;

    public AdminBootstrap(AppUserRepository users, PasswordEncoder encoder,
            @Value("${ledgerflow.bootstrap-admin.email:}") String email,
            @Value("${ledgerflow.bootstrap-admin.password:}") String password) {
        this.users = users;
        this.encoder = encoder;
        this.email = email;
        this.password = password;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (email.isEmpty() && password.isEmpty()) return;
        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);
        if (normalizedEmail.isBlank() || password.isBlank()) {
            throw new IllegalStateException("Admin bootstrap requires both email and password environment variables");
        }
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            if (normalizedEmail.length() > 320
                    || !factory.getValidator().validate(new BootstrapEmail(normalizedEmail)).isEmpty()) {
                throw new IllegalStateException("Admin bootstrap email must be a valid email with at most 320 characters");
            }
        }
        if (password.codePointCount(0, password.length()) < 12
                || password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new IllegalStateException("Admin bootstrap password must contain at least 12 characters and at most 72 UTF-8 bytes");
        }
        var existing = users.findByEmail(normalizedEmail);
        if (existing.isPresent()) {
            var user = existing.get();
            if (user.getRole() != AppRole.TREASURY_ADMIN || !user.isEnabled()) {
                throw new IllegalStateException("Admin bootstrap email conflicts with an existing user; credentials and role were preserved");
            }
            return;
        }
        users.save(new AppUser(normalizedEmail, encoder.encode(password), AppRole.TREASURY_ADMIN));
    }

    private record BootstrapEmail(@Email String value) { }
}
