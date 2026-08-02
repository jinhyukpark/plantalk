package com.unb.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public class ParticipantDto {
    private UUID id;
    private UUID agreementId;
    private String userName;
    private String status;
    private LocalDateTime updatedAt;

    public ParticipantDto() {}

    public ParticipantDto(UUID id, UUID agreementId, String userName, String status, LocalDateTime updatedAt) {
        this.id = id;
        this.agreementId = agreementId;
        this.userName = userName;
        this.status = status;
        this.updatedAt = updatedAt;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getAgreementId() { return agreementId; }
    public void setAgreementId(UUID agreementId) { this.agreementId = agreementId; }
    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
