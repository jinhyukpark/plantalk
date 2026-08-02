package com.unb.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "room_participants", indexes = {
    @Index(name = "idx_room_participants_room_status", columnList = "room_id, status"),
    @Index(name = "idx_room_participants_user_status", columnList = "user_id, status")
})
public class RoomParticipant {
    
    @Id
    private String id;
    
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;
    
    @Column(name = "room_id", insertable = false, updatable = false)
    private String roomId;
    
    @Column(name = "user_id", nullable = false)
    private String userId;
    
    @Column(name = "user_name")
    private String userName;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ParticipantRole role = ParticipantRole.MEMBER;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ParticipantStatus status = ParticipantStatus.JOINED;
    
    @Column(name = "joined_at")
    private LocalDateTime joinedAt;
    
    @Column(name = "left_at")
    private LocalDateTime leftAt;
    
    @PrePersist
    protected void onCreate() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
        if (joinedAt == null) {
            joinedAt = LocalDateTime.now();
        }
    }
    
    public enum ParticipantRole {
        OWNER, MODERATOR, MEMBER
    }
    
    public enum ParticipantStatus {
        INVITED, JOINED, LEFT, BANNED
    }
    
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    
    public Room getRoom() { return room; }
    public void setRoom(Room room) { this.room = room; }
    
    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }
    
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    
    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }
    
    public ParticipantRole getRole() { return role; }
    public void setRole(ParticipantRole role) { this.role = role; }
    
    public ParticipantStatus getStatus() { return status; }
    public void setStatus(ParticipantStatus status) { this.status = status; }
    
    public LocalDateTime getJoinedAt() { return joinedAt; }
    public void setJoinedAt(LocalDateTime joinedAt) { this.joinedAt = joinedAt; }
    
    public LocalDateTime getLeftAt() { return leftAt; }
    public void setLeftAt(LocalDateTime leftAt) { this.leftAt = leftAt; }
}
