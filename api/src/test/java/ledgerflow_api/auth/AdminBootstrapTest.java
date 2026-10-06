package ledgerflow_api.auth;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.password.PasswordEncoder;

class AdminBootstrapTest {
    private final AppUserRepository users = mock(AppUserRepository.class);
    private final PasswordEncoder encoder = mock(PasswordEncoder.class);

    @Test
    void absentConfigurationDoesNothing() {
        new AdminBootstrap(users, encoder, "", "").run(null);
        verifyNoInteractions(users, encoder);
    }

    @Test
    void createsEnabledAdminWithNormalizedEmailAndEncodedPassword() {
        when(users.findByEmail("admin@example.com")).thenReturn(Optional.empty());
        when(encoder.encode("strong-password-123")).thenReturn("encoded");
        new AdminBootstrap(users, encoder, " ADMIN@example.com ", "strong-password-123").run(null);
        var saved = ArgumentCaptor.forClass(AppUser.class);
        verify(users).save(saved.capture());
        assertEquals("admin@example.com", saved.getValue().getEmail());
        assertEquals("encoded", saved.getValue().getPasswordHash());
        assertEquals(AppRole.TREASURY_ADMIN, saved.getValue().getRole());
        assertTrue(saved.getValue().isEnabled());
    }

    @Test
    void repeatStartupPreservesExistingAdminPassword() {
        when(users.findByEmail("admin@example.com")).thenReturn(Optional.of(
                new AppUser("admin@example.com", "original-hash", AppRole.TREASURY_ADMIN)));
        new AdminBootstrap(users, encoder, "admin@example.com", "new-password-123").run(null);
        verify(users, never()).save(any());
        verifyNoInteractions(encoder);
    }

    @Test
    void rejectsExistingNonAdminWithoutPromoting() {
        when(users.findByEmail("admin@example.com")).thenReturn(Optional.of(
                new AppUser("admin@example.com", "original-hash", AppRole.AUDITOR)));
        assertThrows(IllegalStateException.class,
                () -> new AdminBootstrap(users, encoder, "admin@example.com", "strong-password-123").run(null));
        verify(users, never()).save(any());
        verifyNoInteractions(encoder);
    }

    @Test
    void rejectsDisabledAdminWithoutEnabling() {
        AppUser disabled = mock(AppUser.class);
        when(disabled.getRole()).thenReturn(AppRole.TREASURY_ADMIN);
        when(disabled.isEnabled()).thenReturn(false);
        when(users.findByEmail("admin@example.com")).thenReturn(Optional.of(disabled));
        assertThrows(IllegalStateException.class,
                () -> new AdminBootstrap(users, encoder, "admin@example.com", "strong-password-123").run(null));
        verify(users, never()).save(any());
        verifyNoInteractions(encoder);
    }

    @Test
    void rejectsMissingOrInvalidConfigurationBeforeDatabaseAccess() {
        String[][] invalid = {
            {"admin@example.com", ""}, {"", "strong-password-123"},
            {"invalid", "strong-password-123"}, {"admin@example.com", "short"},
            {"admin@example.com", "x".repeat(73)}, {"admin@example.com", "é".repeat(37)},
            {"a".repeat(310) + "@example.com", "strong-password-123"},
            {"admin@example.com", " ".repeat(12)}
        };
        for (String[] values : invalid) {
            var error = assertThrows(IllegalStateException.class,
                    () -> new AdminBootstrap(users, encoder, values[0], values[1]).run(null));
            if (!values[1].isEmpty()) assertFalse(error.getMessage().contains(values[1]));
        }
        verifyNoInteractions(users, encoder);
    }

    @Test
    void acceptsSeventyTwoUtf8Bytes() {
        when(users.findByEmail("admin@example.com")).thenReturn(Optional.empty());
        new AdminBootstrap(users, encoder, "admin@example.com", "é".repeat(36)).run(null);
        verify(encoder).encode("é".repeat(36));
    }
}
