package ledgerflow_api.account;

import jakarta.validation.Valid;
import ledgerflow_api.transfer.LedgerEntryResponse;
import ledgerflow_api.transfer.TransferService;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/accounts")
public class AccountController {
    private final AccountService accountService;
    private final TransferService transferService;

    public AccountController(AccountService accountService, TransferService transferService) {
        this.accountService = accountService;
        this.transferService = transferService;
    }

    @PostMapping
    public ResponseEntity<AccountResponse> createAccount(@Valid @RequestBody CreateAccountRequest request) {
        AccountResponse response = accountService.createAccount(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{id}")
    public AccountResponse getAccountById(@PathVariable UUID id) {
        return accountService.getAccountById(id);
    }

    @GetMapping
    public List<AccountResponse> getAllAccounts() {
        return accountService.getAllAccounts();
    }

    @GetMapping("/{id}/statement")
    public List<LedgerEntryResponse> getAccountStatement(@PathVariable UUID id) {
        return transferService.getAccountStatement(id);
    }
}
