package ledgerflow_api.transfer;

import java.util.UUID;
import java.util.Optional;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import ledgerflow_api.account.Account;
import ledgerflow_api.account.AccountRepository;

@Service
public class TransferService {

    private final TransferRepository transferRepository;
    private final LedgerEntryRepository ledgerEntryRepository;
    private final AccountRepository accountRepository;

    public TransferService(TransferRepository transferRepository,
            LedgerEntryRepository ledgerEntryRepository,
            AccountRepository accountRepository) {
        this.transferRepository = transferRepository;
        this.ledgerEntryRepository = ledgerEntryRepository;
        this.accountRepository = accountRepository;
    }
    public static final UUID SYSTEM_TREASURY_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @Transactional
    public TransferResponse deposit(UUID targetAccountId, DepositRequest request) {
        CreateTransferRequest transferRequest = new CreateTransferRequest(
                SYSTEM_TREASURY_ID,
                targetAccountId,
                request.amount(),
                request.idempotencyKey(),
                request.description() != null ? request.description() : "Deposit / Top-up"
        );
        return executeTransfer(transferRequest);
    }

    @Transactional
    public TransferResponse executeTransfer(CreateTransferRequest request) {
        // 1. Idempotency Check: Jika key sudah ada, return response lama
        Optional<Transfer> existing = transferRepository.findByIdempotencyKey(request.idempotencyKey());
        if (existing.isPresent()) {
            return TransferResponse.from(existing.get());
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

        Account source = firstId.equals(request.sourceAccountId()) ? firstLocked : secondLocked;
        Account target = firstId.equals(request.targetAccountId()) ? firstLocked : secondLocked;
        // 4. Cek kecukupan saldo
        if (source.getCurrentBalance().compareTo(request.amount()) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Insufficient balance");
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

        return TransferResponse.from(savedTransfer);
    }

    @Transactional(readOnly = true)
    public List<LedgerEntryResponse> getAccountStatement(UUID accountId) {
        if (!accountRepository.existsById(accountId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found");
        }
        return ledgerEntryRepository.findByAccountIdOrderByCreatedAtDesc(accountId)
                .stream()
                .map(LedgerEntryResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public TransferResponse getTransferById(UUID id) {
        return transferRepository.findById(id)
                .map(TransferResponse::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Transfer not found"));
    }
}