package com.unb.repository;

import com.unb.entity.Participant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ParticipantRepository extends JpaRepository<Participant, UUID> {
    Optional<Participant> findByAgreementIdAndUserName(UUID agreementId, String userName);

    @Modifying
    @Query("UPDATE Participant p SET p.userName = :newNickname WHERE p.userName = :oldNickname")
    int updateUserName(@Param("oldNickname") String oldNickname, @Param("newNickname") String newNickname);

    @Query("SELECT COUNT(DISTINCT p.agreement.id) FROM Participant p WHERE p.userName = :nickname")
    long countAgreementsByUserName(@Param("nickname") String nickname);

    @Query("SELECT COUNT(DISTINCT p.agreement.id) FROM Participant p WHERE p.userName = :nickname AND p.agreement.status = 'COMPLETED'")
    long countCompletedAgreementsByUserName(@Param("nickname") String nickname);
}
