package com.unb.repository;

import com.unb.entity.Subscription;
import com.unb.entity.Subscription.SubscriptionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface SubscriptionRepository extends JpaRepository<Subscription, String> {
    
    List<Subscription> findByUserIdOrderByCreatedAtDesc(String userId);
    
    Optional<Subscription> findByUserIdAndStatus(String userId, SubscriptionStatus status);
    
    @Query("SELECT s FROM Subscription s WHERE s.userId = :userId AND s.status = 'ACTIVE' " +
           "AND s.expiresAt > :now ORDER BY s.expiresAt DESC")
    Optional<Subscription> findActiveSubscription(
        @Param("userId") String userId, 
        @Param("now") LocalDateTime now);
    
    @Query("SELECT s FROM Subscription s WHERE s.status = 'ACTIVE' AND s.expiresAt <= :now")
    List<Subscription> findExpiredSubscriptions(@Param("now") LocalDateTime now);
    
    @Query("SELECT CASE WHEN COUNT(s) > 0 THEN true ELSE false END FROM Subscription s " +
           "WHERE s.userId = :userId AND s.status = 'ACTIVE' AND s.expiresAt > :now")
    boolean hasActiveSubscription(@Param("userId") String userId, @Param("now") LocalDateTime now);
}
