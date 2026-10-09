package ledgerflow_api.transfer;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record TransferRequestDecision(
        @NotBlank(message = "Reason is required")
        @Size(max = 255, message = "Reason must not exceed 255 characters")
        String reason) {
}
