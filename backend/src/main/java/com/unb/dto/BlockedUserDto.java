package com.unb.dto;

import com.unb.entity.BlockedUser;
import java.time.LocalDateTime;
import java.util.UUID;

public class BlockedUserDto {
    private UUID id;
    private UUID blockedId;
    private String blockedNickname;
    private LocalDateTime createdAt;

    public BlockedUserDto() {}

    public BlockedUserDto(BlockedUser entity) {
        this.id = entity.getId();
        this.blockedId = entity.getBlockedId();
        this.blockedNickname = entity.getBlockedNickname();
        this.createdAt = entity.getCreatedAt();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getBlockedId() { return blockedId; }
    public void setBlockedId(UUID blockedId) { this.blockedId = blockedId; }
    public String getBlockedNickname() { return blockedNickname; }
    public void setBlockedNickname(String blockedNickname) { this.blockedNickname = blockedNickname; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
