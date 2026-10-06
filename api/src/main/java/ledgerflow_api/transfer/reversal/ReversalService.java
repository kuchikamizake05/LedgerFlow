package ledgerflow_api.transfer.reversal;

import java.math.BigDecimal;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import ledgerflow_api.account.Account;
import ledgerflow_api.account.AccountRepository;
import ledgerflow_api.audit.AuditService;
import ledgerflow_api.transfer.LedgerDirection;
import ledgerflow_api.transfer.LedgerEntry;
import ledgerflow_api.transfer.LedgerEntryRepository;
import ledgerflow_api.transfer.Transfer;
import ledgerflow_api.transfer.TransferRepository;
import ledgerflow_api.transfer.TransferResponse;
import ledgerflow_api.transfer.TransferStatus;

@Service
public class ReversalService {
    private static final BigDecimal MAX_BALANCE = new BigDecimal("99999999999999999.99");

    private final TransferRepository transferRepository;
    private final AccountRepository accountRepository;
    private final LedgerEntryRepository ledgerEntryRepository;
    private final AuditService auditService;

    public ReversalService(TransferRepository transferRepository, AccountRepository accountRepository,
            LedgerEntryRepository ledgerEntryRepository, AuditService auditService) {
        this.transferRepository = transferRepository;
        this.accountRepository = accountRepository;
        this.ledgerEntryRepository = ledgerEntryRepository;
        this.auditService = auditService;
    }

    @Transactional
    public ReversalExecutionResult reverse(UUID originalId, ReverseTransferRequest request) {
        Transfer original = transferRepository.findByIdWithLock(originalId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transfer not found"));

        Optional<Transfer> keyedTransfer = transferRepository.findByIdempotencyKey(request.idempotencyKey());
        if (keyedTransfer.isPresent()) {
            return replayOrConflict(keyedTransfer.get(), original, request);
        }

        if (original.getReversalOf() != null || original.getStatus() != TransferStatus.COMPLETED
                || transferRepository.findByReversalOf(originalId).isPresent()) {
            throw conflict("Transfer has already been reversed or cannot be reversed");
        }

        UUID refundSourceId = original.getTargetAccountId();
        UUID refundTargetId = original.getSourceAccountId();
        UUID firstId = refundSourceId.compareTo(refundTargetId) < 0 ? refundSourceId : refundTargetId;
        UUID secondId = refundSourceId.compareTo(refundTargetId) < 0 ? refundTargetId : refundSourceId;
        Account first = accountRepository.findByIdWithLock(firstId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found"));
        Account second = accountRepository.findByIdWithLock(secondId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found"));
        Account source = firstId.equals(refundSourceId) ? first : second;
        Account target = firstId.equals(refundTargetId) ? first : second;

        if (source.getCurrentBalance().compareTo(original.getAmount()) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Insufficient balance to refund transfer");
        }
        if (target.getCurrentBalance().add(original.getAmount()).compareTo(MAX_BALANCE) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Refund destination balance exceeds the supported maximum");
        }

        source.debit(original.getAmount());
        target.credit(original.getAmount());
        accountRepository.save(source);
        accountRepository.save(target);

        Transfer refund = transferRepository.save(new Transfer(source.getId(), target.getId(), original.getAmount(),
                request.idempotencyKey(), request.reason(), original.getId()));
        ledgerEntryRepository.save(new LedgerEntry(refund.getId(), source.getId(), LedgerDirection.DEBIT,
                original.getAmount()));
        ledgerEntryRepository.save(new LedgerEntry(refund.getId(), target.getId(), LedgerDirection.CREDIT,
                original.getAmount()));

        original.markReversed();
        transferRepository.save(original);
        auditService.record("TRANSFER_REVERSED", original.getId(), request.reason());
        return new ReversalExecutionResult(TransferResponse.from(refund), false);
    }

    @Transactional(readOnly = true)
    public Optional<ReversalExecutionResult> findReplayAfterDuplicateKey(UUID originalId,
            ReverseTransferRequest request) {
        return transferRepository.findByIdempotencyKey(request.idempotencyKey())
                .map(transfer -> {
                    Transfer original = transferRepository.findById(originalId)
                            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transfer not found"));
                    return replayOrConflict(transfer, original, request);
                });
    }

    private ReversalExecutionResult replayOrConflict(Transfer existing, Transfer original,
            ReverseTransferRequest request) {
        boolean matches = original.getId().equals(existing.getReversalOf())
                && existing.getSourceAccountId().equals(original.getTargetAccountId())
                && existing.getTargetAccountId().equals(original.getSourceAccountId())
                && existing.getAmount().compareTo(original.getAmount()) == 0
                && Objects.equals(existing.getDescription(), request.reason());
        if (!matches) {
            throw conflict("Idempotency key was already used for a different operation");
        }
        return new ReversalExecutionResult(TransferResponse.from(existing), true);
    }

    private static ResponseStatusException conflict(String reason) {
        return new ResponseStatusException(HttpStatus.CONFLICT, reason);
    }
}
