package ledgerflow_api.transfer;

import java.util.UUID;

import ledgerflow_api.common.PageResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/transfer-requests")
public class TransferRequestController {
    private final TransferRequestService transferRequestService;

    public TransferRequestController(TransferRequestService transferRequestService) {
        this.transferRequestService = transferRequestService;
    }

    @PostMapping
    public ResponseEntity<TransferRequestResponse> submit(@Valid @RequestBody CreateTransferRequest request) {
        TransferRequestService.SubmissionResult result = transferRequestService.submit(request);
        return ResponseEntity.status(result.replayed() ? HttpStatus.OK : HttpStatus.CREATED).body(result.request());
    }

    @GetMapping
    public PageResponse<TransferRequestResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) TransferRequestStatus status) {
        return transferRequestService.list(page, size, status);
    }

    @GetMapping("/{id}")
    public TransferRequestResponse get(@PathVariable UUID id) {
        return transferRequestService.get(id);
    }

    @PostMapping("/{id}/approve")
    public TransferRequestResponse approve(@PathVariable UUID id,
            @Valid @RequestBody TransferRequestDecision decision) {
        return transferRequestService.approve(id, decision);
    }

    @PostMapping("/{id}/reject")
    public TransferRequestResponse reject(@PathVariable UUID id,
            @Valid @RequestBody TransferRequestDecision decision) {
        return transferRequestService.reject(id, decision);
    }
}
