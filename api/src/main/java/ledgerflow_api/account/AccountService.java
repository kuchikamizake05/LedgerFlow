package ledgerflow_api.account;

import java.util.List;
import java.util.UUID;
import ledgerflow_api.audit.AuditService;
import ledgerflow_api.transfer.TransferService;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AccountService {
    private final AccountRepository accountRepository;
    private final AuditService auditService;

    public AccountService(AccountRepository accountRepository, AuditService auditService) {
        this.accountRepository = accountRepository;
        this.auditService = auditService;
    }

    @Transactional
    public AccountResponse createAccount(CreateAccountRequest request) {
        Account account = new Account(request.name(), request.type(), request.openingBalance());
        Account savedAccount = accountRepository.save(account);
        auditService.record("ACCOUNT_CREATED", savedAccount.getId(), "Created account " + savedAccount.getName());
        return AccountResponse.fromAccount(account);
    }

    @Transactional
    public AccountResponse getAccountById(UUID id) {
        Account account = accountRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found"));
        return AccountResponse.fromAccount(account);
    }

    @Transactional
    public AccountResponse freeze(UUID id, FreezeAccountRequest request) {
        if (TransferService.SYSTEM_TREASURY_ID.equals(id)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "System treasury cannot be frozen");
        }
        Account account = accountRepository.findByIdWithLock(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found"));
        if (!account.isFrozen()) {
            account.freeze();
            accountRepository.save(account);
            auditService.record("ACCOUNT_FROZEN", account.getId(), request.reason());
        }
        return AccountResponse.fromAccount(account);
    }

    @Transactional
    public AccountResponse unfreeze(UUID id, FreezeAccountRequest request) {
        Account account = accountRepository.findByIdWithLock(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found"));
        if (account.isFrozen()) {
            account.unfreeze();
            accountRepository.save(account);
            auditService.record("ACCOUNT_UNFROZEN", account.getId(), request.reason());
        }
        return AccountResponse.fromAccount(account);
    }

    @Transactional(readOnly = true)
    public List<AccountResponse> getAllAccounts() {
        return accountRepository.findAll().stream()
                .map(AccountResponse::fromAccount)
                .toList();
    }
}
