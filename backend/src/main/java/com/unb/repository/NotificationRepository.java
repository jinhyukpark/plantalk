package com.unb.repository;

import com.unb.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, String> {
    
    List<Notification> findByUserIdOrderByCreatedAtDesc(String userId);
    
    @Query(value = """
        SELECT n.* FROM notifications n
        LEFT JOIN global_announcements ga
          ON n.reference_type = 'GLOBAL_ANNOUNCEMENT' AND ga.id = n.reference_id
        WHERE n.user_id = :userId
          AND n.is_read = false
          AND (
            COALESCE(n.reference_type, '') <> 'GLOBAL_ANNOUNCEMENT'
            OR (ga.id IS NOT NULL AND (ga.expires_at IS NULL OR ga.expires_at > CURRENT_TIMESTAMP))
          )
        ORDER BY n.created_at DESC
        """, nativeQuery = true)
    List<Notification> findVisibleUnreadByUserId(@Param("userId") String userId);
    
    @Query(value = """
        SELECT COUNT(*) FROM notifications n
        LEFT JOIN global_announcements ga
          ON n.reference_type = 'GLOBAL_ANNOUNCEMENT' AND ga.id = n.reference_id
        WHERE n.user_id = :userId
          AND n.is_read = false
          AND (
            COALESCE(n.reference_type, '') <> 'GLOBAL_ANNOUNCEMENT'
            OR (ga.id IS NOT NULL AND (ga.expires_at IS NULL OR ga.expires_at > CURRENT_TIMESTAMP))
          )
        """, nativeQuery = true)
    long countUnreadByUserId(@Param("userId") String userId);
    
    @Modifying
    @Query("UPDATE Notification n SET n.isRead = true, n.readAt = CURRENT_TIMESTAMP WHERE n.userId = :userId AND n.isRead = false")
    int markAllAsReadByUserId(@Param("userId") String userId);
    
    @Modifying
    @Query("UPDATE Notification n SET n.isRead = true, n.readAt = CURRENT_TIMESTAMP WHERE n.id = :id")
    int markAsRead(@Param("id") String id);
    
    @Query(value = """
        SELECT n.* FROM notifications n
        LEFT JOIN global_announcements ga
          ON n.reference_type = 'GLOBAL_ANNOUNCEMENT' AND ga.id = n.reference_id
        WHERE n.user_id = :userId
          AND (
            COALESCE(n.reference_type, '') <> 'GLOBAL_ANNOUNCEMENT'
            OR (ga.id IS NOT NULL AND (ga.expires_at IS NULL OR ga.expires_at > CURRENT_TIMESTAMP))
          )
        ORDER BY n.created_at DESC
        LIMIT 50
        """, nativeQuery = true)
    List<Notification> findTop50VisibleByUserId(@Param("userId") String userId);

    List<Notification> findByReferenceTypeAndReferenceId(String referenceType, String referenceId);

    @Modifying
    @Query("DELETE FROM Notification n WHERE n.referenceType = :referenceType AND n.referenceId = :referenceId")
    int deleteByReference(@Param("referenceType") String referenceType,
                          @Param("referenceId") String referenceId);
}
