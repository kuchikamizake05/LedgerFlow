package ledgerflow_api.transfer;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import java.util.Optional;
import java.util.List;
import java.util.Objects;

import org.springframework.http.HttpStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import ledgerflow_api.account.Account;
import ledgerflow_api.account.AccountRepository;
import ledgerflow_api.common.PageResponse;
import ledgerflow_api.audit.AuditService;

@Service
public class TransferService {

    private final TransferRepository transferRepository;
    private final LedgerEntryRepository ledgerEntryRepository;
    private final AccountRepository accountRepository;
    private final AuditService auditService;
    private final TransferRequestRepository transferRequestRepository;
    private final IdempotencyLockService idempotencyLockService;

    public TransferService(TransferRepository transferRepository,
            LedgerEntryRepository ledgerEntryRepository,
            AccountRepository accountRepository,
            AuditService auditService,
            TransferRequestRepository transferRequestRepository,
            IdempotencyLockService idempotencyLockService) {
        this.transferRepository = transferRepository;
        this.ledgerEntryRepository = ledgerEntryRepository;
        this.accountRepository = accountRepository;
        this.auditService = auditService;
        this.transferRequestRepository = transferRequestRepository;
        this.idempotencyLockService = idempotencyLockService;
    }
    public static final UUID SYSTEM_TREASURY_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @Transactional
    public TransferResponse deposit(UUID targetAccountId, DepositRequest request) {
        return executeDeposit(targetAccountId, request).transfer();
    }

    @Transactional
    public TransferExecutionResult executeDeposit(UUID targetAccountId, DepositRequest request) {
        return executeInternalTransfer(depositTransferRequest(targetAccountId, request), null);
    }

    private CreateTransferRequest depositTransferRequest(UUID targetAccountId, DepositRequest request) {
        return new CreateTransferRequest(SYSTEM_TREASURY_ID, targetAccountId,
                request.amount(), request.idempotencyKey(),
                request.description() != null ? request.description() : "Deposit / Top-up");
    }

    @Transactional(readOnly = true)
    public Optional<TransferExecutionResult> findDepositReplayAfterDuplicateKey(UUID targetAccountId, DepositRequest request) {
        return findReplayAfterDuplicateKey(depositTransferRequest(targetAccountId, request));
    }

    @Transactional
    public TransferExecutionResult executeTransfer(CreateTransferRequest request) {
        if (SYSTEM_TREASURY_ID.equals(request.sourceAccountId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Treasury allocations must use the deposit endpoint");
        }
        return executeInternalTransfer(request, null);
    }

    @Transactional
    public TransferExecutionResult executeApprovedTransfer(CreateTransferRequest request, UUID approvalRequestId) {
        if (SYSTEM_TREASURY_ID.equals(request.sourceAccountId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Treasury allocations must use the deposit endpoint");
        }
        return executeInternalTransfer(request, approvalRequestId);
    }

    private TransferExecutionResult executeInternalTransfer(CreateTransferRequest request, UUID approvalRequestId) {
        idempotencyLockService.acquire(request.idempotencyKey());

        // 1. Idempotency check: key yang sama hanya boleh dipakai untuk payload yang sama.
        Optional<Transfer> existing = transferRepository.findByIdempotencyKey(request.idempotencyKey());
        if (existing.isPresent()) {
            validateMatchingIdempotencyPayload(existing.get(), request);
            return new TransferExecutionResult(TransferResponse.from(existing.get()), true);
        }

        Optional<TransferRequest> requestCollision = transferRequestRepository
                .findByIdempotencyKey(request.idempotencyKey());
        if (requestCollision.isPresent() && !requestCollision.get().getId().equals(approvalRequestId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Idempotency key was already used for a transfer request");
        }

        // 2. Cegah transfer ke akun sendiri
        if (request.sourceAccountId().equals(request.targetAccountId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Source and target account must be different");
        }

        // 3. Ambil akun dengan Pessimistic Lock + Lock Ordering (cegah deadlock)
        UUID firstId = request.sourceAccountId().compareTo(request.targetAccountId()) < 0
                ? request.sourceAccountId()
                : request.targetAccountId();
        UUID secondId = request.sourceAccountId().compareTo(request.targetAccountId()) < 0
                ? request.targetAccountId()
                : request.sourceAccountId();

        Account firstLocked = accountRepository.findByIdWithLock(firstId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        firstId.equals(request.sourceAccountId()) ? "Source account not found" : "Target account not found"));

        Account secondLocked = accountRepository.findByIdWithLock(secondId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        secondId.equals(request.sourceAccountId()) ? "Source account not found" : "Target account not found"));

        // A competing request may have committed while this transaction waited for the locks.
        existing = transferRepository.findByIdempotencyKey(request.idempotencyKey());
        if (existing.isPresent()) {
            validateMatchingIdempotencyPayload(existing.get(), request);
            return new TransferExecutionResult(TransferResponse.from(existing.get()), true);
        }

        Account source = firstId.equals(request.sourceAccountId()) ? firstLocked : secondLocked;
        Account target = firstId.equals(request.targetAccountId()) ? firstLocked : secondLocked;
        if (source.isFrozen() || target.isFrozen()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Transfers cannot use frozen accounts");
        }
        // 4. Cek kecukupan saldo
        if (source.getCurrentBalance().compareTo(request.amount()) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Insufficient balance");
        }
        if (target.getCurrentBalance().add(request.amount())
                .compareTo(new java.math.BigDecimal("99999999999999999.99")) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Destination balance exceeds the supported maximum");
        }

        // 5. Update saldo (In-memory projection)
        source.debit(request.amount());
        target.credit(request.amount());
        accountRepository.save(source);
        accountRepository.save(target);

        // 6. Catat Transfer
        Transfer transfer = new Transfer(
                source.getId(),
                target.getId(),
                request.amount(),
                request.idempotencyKey(),
                request.description());
        Transfer savedTransfer = transferRepository.save(transfer);

        // 7. Catat Double-Entry Ledger (DEBIT source, CREDIT target)
        LedgerEntry debitEntry = new LedgerEntry(
                savedTransfer.getId(),
                source.getId(),
                LedgerDirection.DEBIT,
                request.amount());
        LedgerEntry creditEntry = new LedgerEntry(
                savedTransfer.getId(),
                target.getId(),
                LedgerDirection.CREDIT,
                request.amount());
        ledgerEntryRepository.save(debitEntry);
        ledgerEntryRepository.save(creditEntry);

        String auditAction = SYSTEM_TREASURY_ID.equals(source.getId()) ? "TREASURY_DEPOSIT" : "TRANSFER_COMPLETED";
        auditService.record(auditAction, savedTransfer.getId(), "Completed transfer " + savedTransfer.getId());

        return new TransferExecutionResult(TransferResponse.from(savedTransfer), false);
    }

    private void validateMatchingIdempotencyPayload(Transfer existing, CreateTransferRequest request) {
        boolean matches = existing.getReversalOf() == null
                && existing.getSourceAccountId().equals(request.sourceAccountId())
                && existing.getTargetAccountId().equals(request.targetAccountId())
                && existing.getAmount().compareTo(request.amount()) == 0
                && Objects.equals(existing.getDescription(), request.description());

        if (!matches) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Idempotency key was already used for a different transfer");
        }
    }

    @Transactional(readOnly = true)
    public Optional<TransferExecutionResult> findReplayAfterDuplicateKey(CreateTransferRequest request) {
        return transferRepository.findByIdempotencyKey(request.idempotencyKey())
                .map(existing -> {
                    validateMatchingIdempotencyPayload(existing, request);
                    return new TransferExecutionResult(TransferResponse.from(existing), true);
                });
    }

    @Transactional(readOnly = true)
    public PageResponse<LedgerEntryResponse> getAccountStatement(
            UUID accountId,
            int page,
            int size,
            LedgerDirection direction,
            UUID transferId,
            LocalDate from,
            LocalDate to) {
        if (page < 0 || size < 1 || size > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Page must be zero or greater and size must be between 1 and 100");
        }
        if (from != null && to != null && from.isAfter(to)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "From date must be on or before to date");
        }
        if (!accountRepository.existsById(accountId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found");
        }

        ZoneId jakarta = ZoneId.of("Asia/Jakarta");
        Instant fromTimestamp = from == null ? null : from.atStartOfDay(jakarta).toInstant();
        Instant toTimestampExclusive = to == null ? null : to.plusDays(1).atStartOfDay(jakarta).toInstant();
        Specification<LedgerEntry> statement = (root, criteriaQuery, criteriaBuilder) ->
                criteriaBuilder.equal(root.get("accountId"), accountId);
        if (direction != null) {
            statement = statement.and((root, criteriaQuery, criteriaBuilder) ->
                    criteriaBuilder.equal(root.get("direction"), direction));
        }
        if (transferId != null) {
            statement = statement.and((root, criteriaQuery, criteriaBuilder) ->
                    criteriaBuilder.equal(root.get("transferId"), transferId));
        }
        if (fromTimestamp != null) {
            statement = statement.and((root, criteriaQuery, criteriaBuilder) ->
                    criteriaBuilder.greaterThanOrEqualTo(root.get("createdAt"), fromTimestamp));
        }
        if (toTimestampExclusive != null) {
            statement = statement.and((root, criteriaQuery, criteriaBuilder) ->
                    criteriaBuilder.lessThan(root.get("createdAt"), toTimestampExclusive));
        }

        Page<LedgerEntryResponse> statementPage = ledgerEntryRepository
                .findAll(statement, PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")))
                .map(LedgerEntryResponse::from);
        return PageResponse.from(statementPage);
    }

    @Transactional(readOnly = true)
    public TransferResponse getTransferById(UUID id) {
        return transferRepository.findById(id)
                .map(TransferResponse::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Transfer not found"));
    }

    @Transactional(readOnly = true)
    public List<LedgerEntryResponse> getTransferEntries(UUID transferId) {
        if (!transferRepository.existsById(transferId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Transfer not found");
        }
        return ledgerEntryRepository.findByTransferIdOrderByCreatedAtAsc(transferId)
                .stream()
                .map(LedgerEntryResponse::from)
                .toList();
    }
}
