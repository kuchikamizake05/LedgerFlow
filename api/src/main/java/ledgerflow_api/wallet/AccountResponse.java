package ledgerflow_api.wallet;
import java.math.BigDecimal;
import java.util.UUID;
public record AccountResponse(UUID id, String name, BigDecimal balance, boolean frozen) {}
