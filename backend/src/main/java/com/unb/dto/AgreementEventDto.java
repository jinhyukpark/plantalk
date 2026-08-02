package com.unb.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public class AgreementEventDto {
    private UUID id;
    private UUID agreementId;
    private String eventType;
    private String actorName;
    private String targetName;
    private String oldValue;
    private String newValue;
    private String description;
    private LocalDateTime createdAt;

    public AgreementEventDto() {}

    public AgreementEventDto(UUID id, UUID agreementId, String eventType, String actorName,
                             String targetName, String oldValue, String newValue,
                             String description, LocalDateTime createdAt) {
        this.id = id;
        this.agreementId = agreementId;
        this.eventType = eventType;
        this.actorName = actorName;
        this.targetName = targetName;
        this.oldValue = oldValue;
        this.newValue = newValue;
        this.description = description;
        this.createdAt = createdAt;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getAgreementId() { return agreementId; }
    public void setAgreementId(UUID agreementId) { this.agreementId = agreementId; }
    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }
    public String getActorName() { return actorName; }
    public void setActorName(String actorName) { this.actorName = actorName; }
    public String getTargetName() { return targetName; }
    public void setTargetName(String targetName) { this.targetName = targetName; }
    public String getOldValue() { return oldValue; }
    public void setOldValue(String oldValue) { this.oldValue = oldValue; }
    public String getNewValue() { return newValue; }
    public void setNewValue(String newValue) { this.newValue = newValue; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
