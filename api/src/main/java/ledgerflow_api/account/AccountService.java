package ledgerflow_api.account;

import java.util.List;
import java.util.UUID;
import ledgerflow_api.audit.AuditService;

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

    @Transactional(readOnly = true)
    public List<AccountResponse> getAllAccounts() {
        return accountRepository.findAll().stream()
                .map(AccountResponse::fromAccount)
                .toList();
    }
}
