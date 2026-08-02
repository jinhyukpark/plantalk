package com.unb.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "friendships", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"user_one_id", "user_two_id"})
}, indexes = {
    @Index(name = "idx_friendships_user_one", columnList = "user_one_id"),
    @Index(name = "idx_friendships_user_two", columnList = "user_two_id")
})
public class Friendship {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_one_id", nullable = false)
    private UUID userOneId;

    @Column(name = "user_two_id", nullable = false)
    private UUID userTwoId;

    @Column(name = "requested_by", nullable = false)
    private UUID requestedBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.PENDING;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public UUID getId() { return id; }
    public UUID getUserOneId() { return userOneId; }
    public void setUserOneId(UUID userOneId) { this.userOneId = userOneId; }
    public UUID getUserTwoId() { return userTwoId; }
    public void setUserTwoId(UUID userTwoId) { this.userTwoId = userTwoId; }
    public UUID getRequestedBy() { return requestedBy; }
    public void setRequestedBy(UUID requestedBy) { this.requestedBy = requestedBy; }
    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }

    public enum Status { PENDING, ACCEPTED, REJECTED }
}
