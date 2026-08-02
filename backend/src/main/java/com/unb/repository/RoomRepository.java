package com.unb.repository;

import com.unb.entity.Room;
import com.unb.entity.Room.RoomVisibility;
import com.unb.entity.Room.RoomStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface RoomRepository extends JpaRepository<Room, String> {
    
    List<Room> findByVisibilityAndStatusOrderByCreatedAtDesc(RoomVisibility visibility, RoomStatus status);
    
    List<Room> findByStatusOrderByCreatedAtDesc(RoomStatus status);
    
    long countByStatus(RoomStatus status);
    
    List<Room> findByCreatorIdOrderByCreatedAtDesc(String creatorId);
    
    List<Room> findByCategoryAndVisibilityAndStatusOrderByCreatedAtDesc(
        String category, RoomVisibility visibility, RoomStatus status);
    
    @Query("SELECT r FROM Room r WHERE r.visibility = :visibility AND r.status = :status " +
           "AND r.startsAt >= :now ORDER BY r.startsAt ASC")
    List<Room> findUpcomingPublicRooms(
        @Param("visibility") RoomVisibility visibility,
        @Param("status") RoomStatus status,
        @Param("now") LocalDateTime now);
    
    @Query(value = "SELECT *, " +
           "(6371 * acos(cos(radians(:lat)) * cos(radians(latitude)) * " +
           "cos(radians(longitude) - radians(:lng)) + sin(radians(:lat)) * " +
           "sin(radians(latitude)))) AS distance " +
           "FROM rooms WHERE visibility = 'PUBLIC' AND status = 'ACTIVE' " +
           "AND latitude IS NOT NULL AND longitude IS NOT NULL " +
           "HAVING distance < :radius ORDER BY distance", nativeQuery = true)
    List<Room> findNearbyPublicRooms(
        @Param("lat") double latitude,
        @Param("lng") double longitude,
        @Param("radius") double radiusKm);
    
    @Query("SELECT r FROM Room r WHERE r.visibility = 'PUBLIC' AND r.status = 'ACTIVE' " +
           "AND r.latitude IS NOT NULL AND r.longitude IS NOT NULL " +
           "ORDER BY r.createdAt DESC")
    List<Room> findAllPublicRoomsWithLocation();
}
