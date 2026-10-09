package ledgerflow_api.wallet;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record WalletOperationRequest(
        @NotNull @DecimalMin("0.01") @Digits(integer = 17, fraction = 2) BigDecimal amount,
        @NotBlank @Size(max = 100) String idempotencyKey,
        @Size(max = 255) String description) {
}
