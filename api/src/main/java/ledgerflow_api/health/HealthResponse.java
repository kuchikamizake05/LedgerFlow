package ledgerflow_api.health;

public record HealthResponse(
        String status,
        String service
) {
}