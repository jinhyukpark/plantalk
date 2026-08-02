package com.unb.repository;

import com.unb.entity.Agreement;
import com.unb.entity.AgreementCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface AgreementRepository extends JpaRepository<Agreement, UUID> {

    List<Agreement> findByCreatorIdOrderByCreatedAtDesc(UUID creatorId);

    @Query("SELECT DISTINCT a FROM Agreement a JOIN a.participants p WHERE p.userName = :userName ORDER BY a.createdAt DESC")
    List<Agreement> findByParticipantUserName(@Param("userName") String userName);

    @Query("SELECT DISTINCT a FROM Agreement a JOIN a.participants p WHERE p.userName = :userName AND p.status = 'WAITING' ORDER BY a.createdAt DESC")
    List<Agreement> findPendingByParticipantUserName(@Param("userName") String userName);

    @Query("SELECT DISTINCT a FROM Agreement a JOIN a.participants p WHERE p.userName = :userName AND a.dateTime > :now AND NOT EXISTS (SELECT 1 FROM Participant p2 WHERE p2.agreement = a AND p2.status = 'DECLINED') ORDER BY a.dateTime ASC")
    List<Agreement> findUpcomingByParticipantUserName(@Param("userName") String userName, @Param("now") LocalDateTime now);

    List<Agreement> findByCategoryOrderByCreatedAtDesc(AgreementCategory category);

    @Query("SELECT a FROM Agreement a ORDER BY a.createdAt DESC")
    List<Agreement> findAllOrderByCreatedAtDesc();
}
