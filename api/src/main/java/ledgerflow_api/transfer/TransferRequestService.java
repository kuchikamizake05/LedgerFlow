package ledgerflow_api.transfer;

import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import ledgerflow_api.audit.AuditService;
import ledgerflow_api.audit.AuditService.Actor;
import ledgerflow_api.account.AccountRepository;
import ledgerflow_api.common.PageResponse;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TransferRequestService {
    private final TransferRequestRepository requestRepository;
    private final TransferRepository transferRepository;
    private final TransferService transferService;
    private final IdempotencyLockService idempotencyLockService;
    private final AuditService auditService;
    private final AccountRepository accountRepository;

    public TransferRequestService(TransferRequestRepository requestRepository,
            TransferRepository transferRepository, TransferService transferService,
            IdempotencyLockService idempotencyLockService, AuditService auditService,
            AccountRepository accountRepository) {
        this.requestRepository = requestRepository;
        this.transferRepository = transferRepository;
        this.transferService = transferService;
        this.idempotencyLockService = idempotencyLockService;
        this.auditService = auditService;
        this.accountRepository = accountRepository;
    }

    @Transactional
    public SubmissionResult submit(CreateTransferRequest payload) {
        if (TransferService.SYSTEM_TREASURY_ID.equals(payload.sourceAccountId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Treasury allocations must use the deposit endpoint");
        }
        if (payload.sourceAccountId().equals(payload.targetAccountId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Source and target account must be different");
        }

        Actor actor = auditService.currentAuthenticatedActor();
        if (!"OPERATOR".equals(actor.role()) && !"TREASURY_ADMIN".equals(actor.role())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Transfer request role is required");
        }
        idempotencyLockService.acquire(payload.idempotencyKey());

        Optional<TransferRequest> existingRequest = requestRepository.findByIdempotencyKey(payload.idempotencyKey());
        if (existingRequest.isPresent()) {
            TransferRequest existing = existingRequest.get();
            boolean matches = existing.getRequesterId().equals(actor.id())
                    && Objects.equals(existing.getRequesterEmail(), actor.email())
                    && matchesPayload(existing, payload);
            if (!matches) {
                throw conflict("Idempotency key was already used for a different request");
            }
            return new SubmissionResult(TransferRequestResponse.from(existing), true);
        }
        if (transferRepository.findByIdempotencyKey(payload.idempotencyKey()).isPresent()) {
            throw conflict("Idempotency key was already used for a transfer");
        }
        if (!accountRepository.existsById(payload.sourceAccountId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Source account not found");
        }
        if (!accountRepository.existsById(payload.targetAccountId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Target account not found");
        }

        TransferRequest saved = requestRepository.save(new TransferRequest(payload, actor.id(), actor.email()));
        auditService.record("TRANSFER_REQUESTED", saved.getId(), "Transfer approval requested");
        return new SubmissionResult(TransferRequestResponse.from(saved), false);
    }

    @Transactional(readOnly = true)
    public PageResponse<TransferRequestResponse> list(int page, int size, TransferRequestStatus status) {
        validatePage(page, size);
        var pageable = PageRequest.of(page, size,
                Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")));
        var result = status == null
                ? requestRepository.findAll(pageable)
                : requestRepository.findAllByStatus(status, pageable);
        return PageResponse.from(result.map(TransferRequestResponse::from));
    }

    @Transactional(readOnly = true)
    public TransferRequestResponse get(UUID id) {
        return requestRepository.findById(id)
                .map(TransferRequestResponse::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transfer request not found"));
    }

    @Transactional
    public TransferRequestResponse approve(UUID id, TransferRequestDecision decision) {
        return decide(id, TransferRequestStatus.APPROVED, decision.reason());
    }

    @Transactional
    public TransferRequestResponse reject(UUID id, TransferRequestDecision decision) {
        return decide(id, TransferRequestStatus.REJECTED, decision.reason());
    }

    private TransferRequestResponse decide(UUID id, TransferRequestStatus action, String reason) {
        String key = requestRepository.findIdempotencyKeyById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transfer request not found"));

        // Do not load the entity before waiting for this lock. The locked row must be the first state loaded.
        idempotencyLockService.acquire(key);
        TransferRequest request = requestRepository.findByIdWithLock(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transfer request not found"));
        Actor actor = auditService.currentAuthenticatedActor();
        if (request.getRequesterId().equals(actor.id())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "A requester cannot decide their own request");
        }
        if (!"TREASURY_ADMIN".equals(actor.role())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Administrator role is required");
        }

        if (request.getStatus() != TransferRequestStatus.PENDING) {
            if (request.getStatus() == action && request.getDecisionActorId().equals(actor.id())
                    && Objects.equals(request.getDecisionReason(), reason)) {
                return TransferRequestResponse.from(request);
            }
            throw conflict("Transfer request has already been decided differently");
        }

        UUID completedTransferId = null;
        if (action == TransferRequestStatus.APPROVED) {
            TransferExecutionResult execution = transferService.executeApprovedTransfer(
                    request.toCreateTransferRequest(), request.getId());
            completedTransferId = execution.transfer().id();
        }

        request.decide(action, actor.id(), actor.email(), reason, completedTransferId);
        TransferRequest saved = requestRepository.save(request);
        auditService.record(action == TransferRequestStatus.APPROVED ? "TRANSFER_APPROVED" : "TRANSFER_REJECTED",
                saved.getId(), reason);
        return TransferRequestResponse.from(saved);
    }

    private static boolean matchesPayload(TransferRequest existing, CreateTransferRequest payload) {
        return existing.getSourceAccountId().equals(payload.sourceAccountId())
                && existing.getTargetAccountId().equals(payload.targetAccountId())
                && existing.getAmount().compareTo(payload.amount()) == 0
                && Objects.equals(existing.getDescription(), payload.description());
    }

    private static void validatePage(int page, int size) {
        if (page < 0 || size < 1 || size > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Page must be zero or greater and size must be between 1 and 100");
        }
    }

    private static ResponseStatusException conflict(String message) {
        return new ResponseStatusException(HttpStatus.CONFLICT, message);
    }

    public record SubmissionResult(TransferRequestResponse request, boolean replayed) {
    }
}
