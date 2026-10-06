package ledgerflow_api.transfer.reversal;

import java.util.UUID;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import jakarta.validation.Valid;
import ledgerflow_api.transfer.TransferResponse;

@RestController
@RequestMapping("/api/transfers")
public class ReversalController {
    private final ReversalService reversalService;

    public ReversalController(ReversalService reversalService) {
        this.reversalService = reversalService;
    }

    @PostMapping("/{id}/reversal")
    public ResponseEntity<TransferResponse> reverse(@PathVariable UUID id,
            @Valid @RequestBody ReverseTransferRequest request) {
        try {
            ReversalExecutionResult result = reversalService.reverse(id, request);
            return ResponseEntity.status(result.replayed() ? HttpStatus.OK : HttpStatus.CREATED)
                    .body(result.transfer());
        } catch (DataIntegrityViolationException exception) {
            return reversalService.findReplayAfterDuplicateKey(id, request)
                    .map(result -> ResponseEntity.ok(result.transfer()))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT,
                            "Transfer could not be reversed because it conflicts with another operation", exception));
        }
    }
}
