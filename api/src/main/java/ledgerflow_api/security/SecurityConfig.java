package ledgerflow_api.security;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import ledgerflow_api.auth.AppUser;
import ledgerflow_api.auth.AppUserRepository;
import ledgerflow_api.auth.AppRole;
import ledgerflow_api.auth.JwtService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    JwtDecoder jwtDecoder(JwtService jwtService, AppUserRepository users) {
        JwtDecoder signatureDecoder = jwtService.decoder();
        return token -> {
            Jwt verified = signatureDecoder.decode(token);
            final UUID userId;
            try {
                userId = UUID.fromString(verified.getSubject());
            } catch (IllegalArgumentException exception) {
                throw new BadJwtException("Token subject is invalid", exception);
            }
            AppUser user = users.findById(userId)
                    .filter(AppUser::isEnabled)
                    .orElseThrow(() -> new BadJwtException("Token user is missing or disabled"));

            Map<String, Object> effectiveClaims = new HashMap<>(verified.getClaims());
            effectiveClaims.put("email", user.getEmail());
            effectiveClaims.put("role", user.getRole().name());
            return Jwt.withTokenValue(verified.getTokenValue())
                    .headers(headers -> headers.putAll(verified.getHeaders()))
                    .claims(claims -> claims.putAll(effectiveClaims))
                    .build();
        };
    }

    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            JwtDecoder jwtDecoder,
            RestSecurityErrorWriter restSecurityErrorWriter) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers(HttpMethod.POST, "/api/auth/register", "/api/auth/login").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/wallet/auth/register", "/api/wallet/auth/login").permitAll()
                        .requestMatchers("/api/wallet/**").hasRole(AppRole.CUSTOMER.name())
                        .requestMatchers(HttpMethod.GET, "/api/auth/me").hasAnyRole(
                                AppRole.AUDITOR.name(), AppRole.OPERATOR.name(), AppRole.TREASURY_ADMIN.name(),
                                AppRole.CUSTOMER.name())
                        .requestMatchers(HttpMethod.GET, "/actuator/health").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/users").hasRole(AppRole.TREASURY_ADMIN.name())
                        .requestMatchers(HttpMethod.POST, "/api/users/*/role").hasRole(AppRole.TREASURY_ADMIN.name())
                        .requestMatchers(HttpMethod.POST, "/api/transfers/*/reversal")
                        .hasRole(AppRole.TREASURY_ADMIN.name())
                        .requestMatchers(HttpMethod.GET, "/api/**").hasAnyRole(
                                AppRole.AUDITOR.name(), AppRole.OPERATOR.name(), AppRole.TREASURY_ADMIN.name())
                        .requestMatchers(HttpMethod.POST, "/api/transfers").hasAnyRole(
                                AppRole.OPERATOR.name(), AppRole.TREASURY_ADMIN.name())
                        .requestMatchers(HttpMethod.POST, "/api/transfer-requests").hasAnyRole(
                                AppRole.OPERATOR.name(), AppRole.TREASURY_ADMIN.name())
                        .requestMatchers(HttpMethod.POST,
                                "/api/transfer-requests/*/approve", "/api/transfer-requests/*/reject")
                        .hasRole(AppRole.TREASURY_ADMIN.name())
                        .requestMatchers(HttpMethod.POST, "/api/accounts/*/deposits").hasRole(AppRole.TREASURY_ADMIN.name())
                        .requestMatchers(HttpMethod.POST, "/api/accounts/*/freeze", "/api/accounts/*/unfreeze")
                        .hasRole(AppRole.TREASURY_ADMIN.name())
                        .requestMatchers(HttpMethod.POST, "/api/accounts").hasRole(AppRole.TREASURY_ADMIN.name())
                        .anyRequest().denyAll())
                .oauth2ResourceServer(resourceServer -> resourceServer
                        .jwt(jwt -> jwt.decoder(jwtDecoder).jwtAuthenticationConverter(jwtAuthenticationConverter()))
                        .authenticationEntryPoint(restSecurityErrorWriter.authenticationEntryPoint())
                        .accessDeniedHandler(restSecurityErrorWriter.accessDeniedHandler()))
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint(restSecurityErrorWriter.authenticationEntryPoint())
                        .accessDeniedHandler(restSecurityErrorWriter.accessDeniedHandler()));
        return http.build();
    }

    private Converter<Jwt, AbstractAuthenticationToken> jwtAuthenticationConverter() {
        return jwt -> {
            String role = jwt.getClaimAsString("role");
            if (role == null) {
                return new JwtAuthenticationToken(jwt, List.of(), jwt.getSubject());
            }
            try {
                AppRole parsedRole = AppRole.valueOf(role);
                return new JwtAuthenticationToken(
                        jwt,
                        List.of(new SimpleGrantedAuthority("ROLE_" + parsedRole.name())),
                        jwt.getSubject());
            } catch (IllegalArgumentException exception) {
                return new JwtAuthenticationToken(jwt, List.of(), jwt.getSubject());
            }
        };
    }
}
