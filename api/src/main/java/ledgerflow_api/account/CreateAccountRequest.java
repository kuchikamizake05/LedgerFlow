package ledgerflow_api.account;

import java.math.BigDecimal;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record CreateAccountRequest(
        @NotBlank(message = "Account name is required") @Size(max = 100, message = "Account name must not exceed 100 characters") String name,

        @NotNull(message = "Account type is required") AccountType type,

        @NotNull(message = "Opening balance is required") @PositiveOrZero(message = "Opening balance must be zero or positive") BigDecimal openingBalance) {

}
