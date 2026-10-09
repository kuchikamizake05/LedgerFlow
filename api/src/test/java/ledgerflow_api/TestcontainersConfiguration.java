package ledgerflow_api;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.jdbc.autoconfigure.JdbcConnectionDetails;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Profile;
import org.springframework.context.annotation.Primary;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

    @Bean
    @ServiceConnection
    @Profile("!local-test-db")
    PostgreSQLContainer<?> postgresContainer() {
        return new PostgreSQLContainer<>(DockerImageName.parse("postgres:17-alpine"));
    }

    @Bean(destroyMethod = "dropSchema")
    @Primary
    @Profile("local-test-db")
    LocalTestJdbcConnectionDetails localTestJdbcConnectionDetails(
            @Value("${LEDGERFLOW_TEST_DB_URL:jdbc:postgresql://localhost:5432/ledgerflow_test}") String baseUrl,
            @Value("${LEDGERFLOW_TEST_DB_USERNAME:ledgerflow_test}") String username,
            @Value("${LEDGERFLOW_TEST_DB_PASSWORD:}") String password) {
        return new LocalTestJdbcConnectionDetails(baseUrl, username, password);
    }

    static final class LocalTestJdbcConnectionDetails implements JdbcConnectionDetails {
        private final String baseUrl;
        private final String username;
        private final String password;
        private final String schema;

        LocalTestJdbcConnectionDetails(String baseUrl, String username, String password) {
            this.baseUrl = baseUrl;
            this.username = username;
            this.password = password;
            this.schema = "ledgerflow_test_" + UUID.randomUUID().toString().replace("-", "");
            createSchema();
        }

        @Override
        public String getUsername() {
            return username;
        }

        @Override
        public String getPassword() {
            return password;
        }

        @Override
        public String getJdbcUrl() {
            return baseUrl + (baseUrl.contains("?") ? "&" : "?") + "currentSchema=" + schema;
        }

        void dropSchema() {
            try (Connection connection = DriverManager.getConnection(baseUrl, username, password);
                    Statement statement = connection.createStatement()) {
                statement.execute("DROP SCHEMA IF EXISTS \"" + schema + "\" CASCADE");
            } catch (Exception exception) {
                throw new IllegalStateException("Could not clean up the local test database schema", exception);
            }
        }

        private void createSchema() {
            try (Connection connection = DriverManager.getConnection(baseUrl, username, password);
                    Statement statement = connection.createStatement()) {
                statement.execute("CREATE SCHEMA \"" + schema + "\"");
            } catch (Exception exception) {
                throw new IllegalStateException("Could not create an isolated local test database schema", exception);
            }
        }
    }
}
