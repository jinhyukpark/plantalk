package com.unb.repository;

import com.unb.entity.AgreementEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AgreementEventRepository extends JpaRepository<AgreementEvent, UUID> {
    List<AgreementEvent> findByAgreementIdOrderByCreatedAtAsc(UUID agreementId);
    List<AgreementEvent> findByAgreementIdOrderByCreatedAtDesc(UUID agreementId);
}
