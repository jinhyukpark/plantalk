package com.unb.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "notifications", indexes = {
    @Index(name = "idx_notifications_user", columnList = "user_id, created_at DESC"),
    @Index(name = "idx_notifications_unread", columnList = "user_id, is_read")
})
public class Notification {
    
    @Id
    private String id;
    
    @Column(name = "user_id", nullable = false)
    private String userId;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "notification_type", nullable = false)
    private NotificationType type;
    
    @Column(nullable = false)
    private String title;
    
    @Column(columnDefinition = "TEXT", nullable = false)
    private String message;
    
    @Column(name = "reference_id")
    private String referenceId;
    
    @Column(name = "reference_type")
    private String referenceType;
    
    @Column(name = "sender_name")
    private String senderName;

    @Column(name = "sender_id")
    private String senderId;

    @Transient
    private String senderProfilePictureUrl;
    
    @Column(name = "is_read")
    private boolean isRead = false;
    
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    @Column(name = "read_at")
    private LocalDateTime readAt;
    
    @PrePersist
    protected void onCreate() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
        createdAt = LocalDateTime.now();
    }
    
    public enum NotificationType {
        ROOM_MESSAGE,
        AGREEMENT_CREATED,
        AGREEMENT_RESPONSE,
        AGREEMENT_STATUS_CHANGED,
        AGREEMENT_UPDATED,
        ROOM_JOINED,
        ROOM_ANNOUNCEMENT,
        GLOBAL_ANNOUNCEMENT,
        SYSTEM
    }
    
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    
    public NotificationType getType() { return type; }
    public void setType(NotificationType type) { this.type = type; }
    
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    
    public String getReferenceId() { return referenceId; }
    public void setReferenceId(String referenceId) { this.referenceId = referenceId; }
    
    public String getReferenceType() { return referenceType; }
    public void setReferenceType(String referenceType) { this.referenceType = referenceType; }
    
    public String getSenderName() { return senderName; }
    public void setSenderName(String senderName) { this.senderName = senderName; }

    public String getSenderId() { return senderId; }
    public void setSenderId(String senderId) { this.senderId = senderId; }

    public String getSenderProfilePictureUrl() { return senderProfilePictureUrl; }
    public void setSenderProfilePictureUrl(String senderProfilePictureUrl) {
        this.senderProfilePictureUrl = senderProfilePictureUrl;
    }
    
    public boolean isRead() { return isRead; }
    public void setRead(boolean read) { isRead = read; }
    
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    
    public LocalDateTime getReadAt() { return readAt; }
    public void setReadAt(LocalDateTime readAt) { this.readAt = readAt; }
}
