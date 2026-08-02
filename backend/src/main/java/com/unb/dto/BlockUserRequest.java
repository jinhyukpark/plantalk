package com.unb.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public class BlockUserRequest {
    @NotNull(message = "차단하는 사용자 ID가 필요합니다")
    private UUID blockerId;

    @NotNull(message = "차단할 사용자 ID가 필요합니다")
    private UUID blockedId;

    public BlockUserRequest() {}

    public BlockUserRequest(UUID blockerId, UUID blockedId) {
        this.blockerId = blockerId;
        this.blockedId = blockedId;
    }

    public UUID getBlockerId() { return blockerId; }
    public void setBlockerId(UUID blockerId) { this.blockerId = blockerId; }
    public UUID getBlockedId() { return blockedId; }
    public void setBlockedId(UUID blockedId) { this.blockedId = blockedId; }
}
