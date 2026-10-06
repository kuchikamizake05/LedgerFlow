package ledgerflow_api.security;

import java.util.List;
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
    JwtDecoder jwtDecoder(JwtService jwtService) {
        return jwtService.decoder();
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
                        .requestMatchers(HttpMethod.GET, "/actuator/health").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/transfers/*/reversal")
                        .hasRole(AppRole.TREASURY_ADMIN.name())
                        .requestMatchers(HttpMethod.GET, "/api/**").hasAnyRole(
                                AppRole.AUDITOR.name(), AppRole.OPERATOR.name(), AppRole.TREASURY_ADMIN.name())
                        .requestMatchers(HttpMethod.POST, "/api/transfers").hasAnyRole(
                                AppRole.OPERATOR.name(), AppRole.TREASURY_ADMIN.name())
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
