package com.unb.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "blocked_users", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"blocker_id", "blocked_id"})
})
public class BlockedUser {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "blocker_id", nullable = false)
    private UUID blockerId;

    @Column(name = "blocked_id", nullable = false)
    private UUID blockedId;

    @Column(name = "blocked_nickname", nullable = false)
    private String blockedNickname;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public BlockedUser() {}

    public BlockedUser(UUID blockerId, UUID blockedId, String blockedNickname) {
        this.blockerId = blockerId;
        this.blockedId = blockedId;
        this.blockedNickname = blockedNickname;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getBlockerId() { return blockerId; }
    public void setBlockerId(UUID blockerId) { this.blockerId = blockerId; }
    public UUID getBlockedId() { return blockedId; }
    public void setBlockedId(UUID blockedId) { this.blockedId = blockedId; }
    public String getBlockedNickname() { return blockedNickname; }
    public void setBlockedNickname(String blockedNickname) { this.blockedNickname = blockedNickname; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
