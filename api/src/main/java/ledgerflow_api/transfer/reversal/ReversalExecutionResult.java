package ledgerflow_api.transfer.reversal;

import ledgerflow_api.transfer.TransferResponse;

public record ReversalExecutionResult(TransferResponse transfer, boolean replayed) {
}
