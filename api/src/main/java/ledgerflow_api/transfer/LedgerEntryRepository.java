package ledgerflow_api.transfer;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

@Repository
public interface LedgerEntryRepository extends JpaRepository<LedgerEntry, UUID>, JpaSpecificationExecutor<LedgerEntry> {
    List<LedgerEntry> findByTransferIdOrderByCreatedAtAsc(UUID transferId);
    org.springframework.data.domain.Page<LedgerEntry> findByAccountId(UUID accountId, org.springframework.data.domain.Pageable pageable);
}
