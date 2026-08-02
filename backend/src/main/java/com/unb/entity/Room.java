package com.unb.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "rooms", indexes = {
    @Index(name = "idx_rooms_visibility_starts_at", columnList = "visibility, starts_at"),
    @Index(name = "idx_rooms_creator", columnList = "creator_id"),
    @Index(name = "idx_rooms_location", columnList = "latitude, longitude")
})
public class Room {
    
    @Id
    private String id;
    
    @Column(nullable = false)
    private String title;
    
    @Column(columnDefinition = "TEXT")
    private String description;
    
    @Column(nullable = false)
    private String category;
    
    @Column(nullable = false)
    private String emoji;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RoomVisibility visibility = RoomVisibility.PUBLIC;
    
    @Column(name = "creator_id", nullable = false)
    private String creatorId;
    
    @Column(name = "creator_name")
    private String creatorName;
    
    private Double latitude;
    
    private Double longitude;
    
    @Column(name = "location_name")
    private String locationName;
    
    @Column(name = "starts_at")
    private LocalDateTime startsAt;
    
    @Column(name = "ends_at")
    private LocalDateTime endsAt;
    
    @Column(name = "max_participants")
    private Integer maxParticipants;
    
    @Column(name = "current_participants")
    private Integer currentParticipants = 0;
    
    @Column(name = "requires_license")
    private Boolean requiresLicense = false;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RoomStatus status = RoomStatus.ACTIVE;
    
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    @JsonIgnore
    @OneToMany(mappedBy = "room", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<RoomParticipant> participants = new ArrayList<>();
    
    @JsonIgnore
    @OneToMany(mappedBy = "room", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<RoomMessage> messages = new ArrayList<>();
    
    @PrePersist
    protected void onCreate() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
    
    public enum RoomVisibility {
        PUBLIC, PRIVATE
    }
    
    public enum RoomStatus {
        ACTIVE, CLOSED, CANCELLED
    }
    
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    
    public String getEmoji() { return emoji; }
    public void setEmoji(String emoji) { this.emoji = emoji; }
    
    public RoomVisibility getVisibility() { return visibility; }
    public void setVisibility(RoomVisibility visibility) { this.visibility = visibility; }
    
    public String getCreatorId() { return creatorId; }
    public void setCreatorId(String creatorId) { this.creatorId = creatorId; }
    
    public String getCreatorName() { return creatorName; }
    public void setCreatorName(String creatorName) { this.creatorName = creatorName; }
    
    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }
    
    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }
    
    public String getLocationName() { return locationName; }
    public void setLocationName(String locationName) { this.locationName = locationName; }
    
    public LocalDateTime getStartsAt() { return startsAt; }
    public void setStartsAt(LocalDateTime startsAt) { this.startsAt = startsAt; }
    
    public LocalDateTime getEndsAt() { return endsAt; }
    public void setEndsAt(LocalDateTime endsAt) { this.endsAt = endsAt; }
    
    public Integer getMaxParticipants() { return maxParticipants; }
    public void setMaxParticipants(Integer maxParticipants) { this.maxParticipants = maxParticipants; }
    
    public Integer getCurrentParticipants() { return currentParticipants; }
    public void setCurrentParticipants(Integer currentParticipants) { this.currentParticipants = currentParticipants; }
    
    public Boolean getRequiresLicense() { return requiresLicense; }
    public void setRequiresLicense(Boolean requiresLicense) { this.requiresLicense = requiresLicense; }
    
    public RoomStatus getStatus() { return status; }
    public void setStatus(RoomStatus status) { this.status = status; }
    
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    
    public List<RoomParticipant> getParticipants() { return participants; }
    public void setParticipants(List<RoomParticipant> participants) { this.participants = participants; }
    
    public List<RoomMessage> getMessages() { return messages; }
    public void setMessages(List<RoomMessage> messages) { this.messages = messages; }
}
