package ledgerflow_api.wallet;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Locale;
import java.util.UUID;

import ledgerflow_api.account.Account;
import ledgerflow_api.account.AccountRepository;
import ledgerflow_api.account.AccountType;
import ledgerflow_api.audit.AuditService;
import ledgerflow_api.auth.AppRole;
import ledgerflow_api.auth.AppUser;
import ledgerflow_api.auth.AppUserRepository;
import ledgerflow_api.auth.AuthResponse;
import ledgerflow_api.auth.JwtService;
import ledgerflow_api.auth.LoginRequest;
import ledgerflow_api.auth.RegisterRequest;
import ledgerflow_api.auth.UserResponse;
import ledgerflow_api.common.PageResponse;
import ledgerflow_api.transfer.CreateTransferRequest;
import ledgerflow_api.transfer.LedgerEntryRepository;
import ledgerflow_api.transfer.LedgerEntryResponse;
import ledgerflow_api.transfer.TransferExecutionResult;
import ledgerflow_api.transfer.TransferService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class WalletService {
    private final AppUserRepository users;
    private final AccountRepository accounts;
    private final PasswordEncoder passwords;
    private final JwtService jwt;
    private final TransferService transfers;
    private final LedgerEntryRepository ledger;
    private final AuditService audit;
    private final boolean topupsEnabled;

    public WalletService(AppUserRepository users, AccountRepository accounts, PasswordEncoder passwords,
            JwtService jwt, TransferService transfers, LedgerEntryRepository ledger, AuditService audit,
            @Value("${ledgerflow.simulator.topups-enabled:false}") boolean topupsEnabled) {
        this.users = users;
        this.accounts = accounts;
        this.passwords = passwords;
        this.jwt = jwt;
        this.transfers = transfers;
        this.ledger = ledger;
        this.audit = audit;
        this.topupsEnabled = topupsEnabled;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        if (users.findByEmail(email).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email is already registered");
        }
        AppUser user = users.save(new AppUser(email, passwords.encode(request.password()), AppRole.CUSTOMER));
        String displayName = email.length() > 100 ? email.substring(0, 100) : email;
        Account account = new Account(displayName, AccountType.EWALLET, BigDecimal.ZERO);
        account.setOwner(user);
        accounts.save(account);
        return auth(user);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        AppUser user = users.findByEmail(request.email().trim().toLowerCase(Locale.ROOT))
                .filter(AppUser::isEnabled)
                .filter(candidate -> candidate.getRole() == AppRole.CUSTOMER)
                .filter(candidate -> passwords.matches(request.password(), candidate.getPasswordHash()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password"));
        return auth(user);
    }

    private AuthResponse auth(AppUser user) {
        JwtService.IssuedToken token = jwt.issue(user);
        return new AuthResponse(UserResponse.from(user), token.value(), "Bearer", token.expiresAt());
    }

    private UUID customerId() {
        AuditService.Actor actor = audit.currentAuthenticatedActor();
        if (!AppRole.CUSTOMER.name().equals(actor.role())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Customer access required");
        }
        return actor.id();
    }

    @Transactional(readOnly = true)
    public AccountResponse me() {
        Account account = owned(customerId());
        return new AccountResponse(account.getId(), account.getName(), account.getCurrentBalance(), account.isFrozen());
    }

    @Transactional(readOnly = true)
    public RecipientResponse recipient(UUID id) {
        customerId();
        Account account = accounts.findById(id)
                .filter(candidate -> candidate.getOwner() != null)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Wallet recipient not found"));
        return new RecipientResponse(account.getId(), account.getName());
    }

    @Transactional
    public TransferExecutionResult topup(WalletOperationRequest request) {
        UUID customerId = customerId();
        if (!topupsEnabled) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Simulator top ups are disabled");
        }
        if (request.amount().compareTo(new BigDecimal("1000000.00")) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Top up limit is 1,000,000 simulated units");
        }
        UUID accountId = ownedAccountId(customerId);
        CreateTransferRequest transfer = new CreateTransferRequest(TransferService.SYSTEM_TREASURY_ID,
                accountId, request.amount(), namespacedKey(customerId, "topup", request.idempotencyKey()),
                description(request.description(), "Simulated wallet top up"));
        return transfers.executeCustomerTransfer(transfer, "SIMULATOR_TOPUP");
    }

    @Transactional
    public TransferExecutionResult transfer(WalletTransferRequest request) {
        UUID customerId = customerId();
        UUID sourceId = ownedAccountId(customerId);
        if (!accounts.existsByIdAndOwnerIsNotNull(request.targetAccountId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Wallet recipient not found");
        }
        CreateTransferRequest transfer = new CreateTransferRequest(sourceId, request.targetAccountId(), request.amount(),
                namespacedKey(customerId, "transfer", request.idempotencyKey()),
                description(request.description(), "Customer wallet transfer"));
        return transfers.executeCustomerTransfer(transfer, "CUSTOMER_TRANSFER_COMPLETED");
    }

    @Transactional(readOnly = true)
    public PageResponse<LedgerEntryResponse> history(int page, int size) {
        Account account = owned(customerId());
        if (page < 0 || size < 1 || size > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Page must be zero or greater and size must be between 1 and 100");
        }
        var results = ledger.findByAccountId(account.getId(),
                PageRequest.of(page, size, Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))))
                .map(LedgerEntryResponse::from);
        return PageResponse.from(results);
    }

    private Account owned(UUID userId) {
        return accounts.findByOwner_Id(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Wallet not found"));
    }

    private UUID ownedAccountId(UUID userId) {
        return accounts.findIdByOwnerId(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Wallet not found"));
    }

    private String namespacedKey(UUID userId, String operation, String clientKey) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest((userId + ":" + operation + ":" + clientKey).getBytes(StandardCharsets.UTF_8));
            return "customer:" + HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private String description(String description, String fallback) {
        return description == null || description.isBlank() ? fallback : description.trim();
    }
}
