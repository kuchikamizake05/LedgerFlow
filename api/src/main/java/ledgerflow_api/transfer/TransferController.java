package ledgerflow_api.transfer;

import java.util.UUID;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/transfers")
public class TransferController {

    private final TransferService transferService;

    public TransferController(TransferService transferService) {
        this.transferService = transferService;
    }

    @PostMapping
    public ResponseEntity<TransferResponse> createTransfer(@Valid @RequestBody CreateTransferRequest request) {
        if (!TransferService.SYSTEM_TREASURY_ID.equals(request.sourceAccountId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Approval required");
        }
        try {
            TransferExecutionResult result = transferService.executeTransfer(request);
            HttpStatus status = result.replayed() ? HttpStatus.OK : HttpStatus.CREATED;
            return ResponseEntity.status(status).body(result.transfer());
        } catch (DataIntegrityViolationException exception) {
            // Bila dua request identik lolos pengecekan awal secara bersamaan,
            // unique constraint database memilih satu pemenang. Request yang kalah
            // mengambil hasil pemenang sebagai replay, bukan mengembalikan 500.
            return transferService.findReplayAfterDuplicateKey(request)
                    .map(replay -> ResponseEntity.ok(replay.transfer()))
                    .orElseThrow(() -> exception);
        }
    }

    @GetMapping("/{id}")
    public TransferResponse getTransferById(@PathVariable UUID id) {
        return transferService.getTransferById(id);
    }

    @GetMapping("/{id}/entries")
    public List<LedgerEntryResponse> getTransferEntries(@PathVariable UUID id) {
        return transferService.getTransferEntries(id);
    }
}
