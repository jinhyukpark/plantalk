package com.unb.repository;

import com.unb.entity.Payment;
import com.unb.entity.Payment.PaymentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, String> {
    
    List<Payment> findByUserIdOrderByCreatedAtDesc(String userId);
    
    List<Payment> findBySubscriptionId(String subscriptionId);
    
    Optional<Payment> findByTransactionId(String transactionId);
    
    List<Payment> findByUserIdAndStatus(String userId, PaymentStatus status);
}
