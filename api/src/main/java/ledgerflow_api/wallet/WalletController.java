package ledgerflow_api.wallet;

import java.util.UUID;

import jakarta.validation.Valid;
import ledgerflow_api.auth.AuthResponse;
import ledgerflow_api.auth.LoginRequest;
import ledgerflow_api.auth.RegisterRequest;
import ledgerflow_api.common.PageResponse;
import ledgerflow_api.transfer.LedgerEntryResponse;
import ledgerflow_api.transfer.TransferExecutionResult;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/wallet")
public class WalletController {
    private final WalletService service;

    public WalletController(WalletService service) {
        this.service = service;
    }

    @PostMapping("/auth/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.register(request));
    }

    @PostMapping("/auth/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return service.login(request);
    }

    @GetMapping("/me")
    public AccountResponse me() {
        return service.me();
    }

    @GetMapping("/recipient/{id}")
    public RecipientResponse recipient(@PathVariable UUID id) {
        return service.recipient(id);
    }

    @PostMapping("/topups")
    public TransferExecutionResult topup(@Valid @RequestBody WalletOperationRequest request) {
        return service.topup(request);
    }

    @PostMapping("/transfers")
    public TransferExecutionResult transfer(@Valid @RequestBody WalletTransferRequest request) {
        return service.transfer(request);
    }

    @GetMapping("/history")
    public PageResponse<LedgerEntryResponse> history(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return service.history(page, size);
    }
}
