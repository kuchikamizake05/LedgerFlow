package ledgerflow_api.transfer;

/**
 * Hasil eksekusi transfer beserta informasi apakah respons berasal dari replay
 * idempotency key yang sudah pernah diproses.
 */
public record TransferExecutionResult(TransferResponse transfer, boolean replayed) {
}
