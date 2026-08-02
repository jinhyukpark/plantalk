package com.unb.repository;

import com.unb.entity.RoomMessage;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface RoomMessageRepository extends JpaRepository<RoomMessage, String> {
    
    @Query("SELECT m FROM RoomMessage m WHERE m.room.id = :roomId ORDER BY m.createdAt DESC")
    List<RoomMessage> findByRoomIdOrderByCreatedAtDesc(
        @Param("roomId") String roomId, 
        Pageable pageable);
    
    @Query("SELECT m FROM RoomMessage m WHERE m.room.id = :roomId ORDER BY m.createdAt ASC")
    List<RoomMessage> findByRoomIdOrderByCreatedAtAsc(@Param("roomId") String roomId);
    
    @Query("SELECT m FROM RoomMessage m WHERE m.room.id = :roomId AND m.createdAt > :after ORDER BY m.createdAt ASC")
    List<RoomMessage> findByRoomIdAfter(
        @Param("roomId") String roomId, 
        @Param("after") LocalDateTime after);

    @Query("SELECT m FROM RoomMessage m WHERE m.room.id = :roomId AND m.createdAt < :before ORDER BY m.createdAt DESC")
    List<RoomMessage> findByRoomIdBefore(
        @Param("roomId") String roomId,
        @Param("before") LocalDateTime before,
        Pageable pageable);
    
    @Query("SELECT COUNT(m) FROM RoomMessage m WHERE m.room.id = :roomId")
    long countByRoomId(@Param("roomId") String roomId);
    
    List<RoomMessage> findBySenderId(String senderId);
    
    List<RoomMessage> findBySenderIdOrderByCreatedAtDesc(String senderId);
}
