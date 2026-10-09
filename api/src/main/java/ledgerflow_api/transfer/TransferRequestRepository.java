package ledgerflow_api.transfer;

import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TransferRequestRepository extends JpaRepository<TransferRequest, UUID> {
    Optional<TransferRequest> findByIdempotencyKey(String idempotencyKey);

    @Query("SELECT request.idempotencyKey FROM TransferRequest request WHERE request.id = :id")
    Optional<String> findIdempotencyKeyById(@Param("id") UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT request FROM TransferRequest request WHERE request.id = :id")
    Optional<TransferRequest> findByIdWithLock(@Param("id") UUID id);

    Page<TransferRequest> findAllByStatus(TransferRequestStatus status, Pageable pageable);
}
