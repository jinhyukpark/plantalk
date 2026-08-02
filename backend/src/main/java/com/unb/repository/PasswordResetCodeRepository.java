package com.unb.repository;

import com.unb.entity.PasswordResetCode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface PasswordResetCodeRepository extends JpaRepository<PasswordResetCode, UUID> {

    Optional<PasswordResetCode> findFirstByUserIdAndUsedFalseOrderByCreatedAtDesc(UUID userId);

    @Modifying
    @Query("UPDATE PasswordResetCode c SET c.used = true WHERE c.userId = :userId AND c.used = false")
    void invalidateAllForUser(@Param("userId") UUID userId);
}
