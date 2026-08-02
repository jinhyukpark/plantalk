package com.unb.repository;

import com.unb.entity.AdImpression;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AdImpressionRepository extends JpaRepository<AdImpression, String> {
    
    List<AdImpression> findByUserIdOrderByServedAtDesc(String userId);
    
    @Query("SELECT ai FROM AdImpression ai WHERE ai.userId = :userId AND ai.servedAt > :since")
    List<AdImpression> findRecentImpressions(
        @Param("userId") String userId, 
        @Param("since") LocalDateTime since);
    
    @Query("SELECT COUNT(ai) FROM AdImpression ai WHERE ai.userId = :userId AND ai.servedAt > :since")
    long countRecentImpressions(
        @Param("userId") String userId, 
        @Param("since") LocalDateTime since);
    
    @Query("SELECT ai FROM AdImpression ai WHERE ai.userId = :userId ORDER BY ai.servedAt DESC LIMIT 1")
    AdImpression findLastImpression(@Param("userId") String userId);
}
