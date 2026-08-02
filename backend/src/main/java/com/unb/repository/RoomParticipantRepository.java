package com.unb.repository;

import com.unb.entity.RoomParticipant;
import com.unb.entity.RoomParticipant.ParticipantStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RoomParticipantRepository extends JpaRepository<RoomParticipant, String> {
    
    @Query("SELECT rp FROM RoomParticipant rp WHERE rp.room.id = :roomId AND rp.status = :status")
    List<RoomParticipant> findByRoomIdAndStatus(
        @Param("roomId") String roomId, 
        @Param("status") ParticipantStatus status);
    
    @Query("SELECT rp FROM RoomParticipant rp WHERE rp.room.id = :roomId")
    List<RoomParticipant> findByRoomId(@Param("roomId") String roomId);
    
    List<RoomParticipant> findByUserIdAndStatus(String userId, ParticipantStatus status);
    
    @Query("SELECT rp FROM RoomParticipant rp WHERE rp.room.id = :roomId AND rp.userId = :userId")
    Optional<RoomParticipant> findByRoomIdAndUserId(
        @Param("roomId") String roomId, 
        @Param("userId") String userId);
    
    @Query("SELECT COUNT(rp) FROM RoomParticipant rp WHERE rp.room.id = :roomId AND rp.status = 'JOINED'")
    long countActiveParticipants(@Param("roomId") String roomId);
    
    @Query("SELECT rp FROM RoomParticipant rp JOIN FETCH rp.room r " +
           "WHERE rp.userId = :userId AND rp.status = 'JOINED' AND r.status = 'ACTIVE' " +
           "ORDER BY r.createdAt DESC")
    List<RoomParticipant> findUserJoinedRooms(@Param("userId") String userId);
}
