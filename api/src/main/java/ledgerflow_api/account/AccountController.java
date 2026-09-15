package ledgerflow_api.account;

import jakarta.validation.Valid;
import ledgerflow_api.transfer.LedgerEntryResponse;
import ledgerflow_api.transfer.LedgerDirection;
import ledgerflow_api.transfer.TransferService;
import ledgerflow_api.transfer.DepositRequest;
import ledgerflow_api.transfer.TransferResponse;
import ledgerflow_api.common.PageResponse;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.time.LocalDate;
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
    public PageResponse<LedgerEntryResponse> getAccountStatement(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) LedgerDirection direction,
            @RequestParam(required = false) UUID transferId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return transferService.getAccountStatement(id, page, size, direction, transferId, from, to);
    }

    @PostMapping("/{id}/deposits")
    public ResponseEntity<TransferResponse> deposit(
            @PathVariable UUID id,
            @Valid @RequestBody DepositRequest request
    ) {
        TransferResponse response = transferService.deposit(id, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}
