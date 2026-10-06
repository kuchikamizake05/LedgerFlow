package ledgerflow_api.transfer.reversal;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ReverseTransferRequest(
        @NotBlank(message = "Idempotency key is required")
        @Size(max = 100, message = "Idempotency key must not exceed 100 characters")
        String idempotencyKey,

        @NotBlank(message = "Reason is required")
        @Size(max = 255, message = "Reason must not exceed 255 characters")
        String reason) {
}
