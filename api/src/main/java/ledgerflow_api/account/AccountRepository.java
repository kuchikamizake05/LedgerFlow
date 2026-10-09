package ledgerflow_api.account;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import jakarta.persistence.LockModeType;

@Repository
public interface AccountRepository extends JpaRepository<Account, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT a FROM Account a WHERE a.id = :id")
    Optional<Account> findByIdWithLock(@Param("id") UUID id);

    Optional<Account> findByOwner_Id(UUID ownerId);

    @Query("select account.id from Account account where account.owner.id = :ownerId")
    Optional<UUID> findIdByOwnerId(@Param("ownerId") UUID ownerId);

    boolean existsByIdAndOwnerIsNotNull(UUID id);
}
