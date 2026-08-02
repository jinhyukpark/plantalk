package com.unb.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public class AgreementDto {
    private UUID id;
    private String title;
    private String description;
    private String emoji;
    private String category;
    private String customCategoryName;
    private String status;
    private LocalDateTime dateTime;
    private String scheduleType;
    private LocalDateTime endDateTime;
    private UUID creatorId;
    private String creatorName;
    private List<ParticipantDto> participants;
    private LocalDateTime createdAt;

    public AgreementDto() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getEmoji() { return emoji; }
    public void setEmoji(String emoji) { this.emoji = emoji; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getCustomCategoryName() { return customCategoryName; }
    public void setCustomCategoryName(String customCategoryName) { this.customCategoryName = customCategoryName; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getDateTime() { return dateTime; }
    public void setDateTime(LocalDateTime dateTime) { this.dateTime = dateTime; }
    public String getScheduleType() { return scheduleType; }
    public void setScheduleType(String scheduleType) { this.scheduleType = scheduleType; }
    public LocalDateTime getEndDateTime() { return endDateTime; }
    public void setEndDateTime(LocalDateTime endDateTime) { this.endDateTime = endDateTime; }
    public UUID getCreatorId() { return creatorId; }
    public void setCreatorId(UUID creatorId) { this.creatorId = creatorId; }
    public String getCreatorName() { return creatorName; }
    public void setCreatorName(String creatorName) { this.creatorName = creatorName; }
    public List<ParticipantDto> getParticipants() { return participants; }
    public void setParticipants(List<ParticipantDto> participants) { this.participants = participants; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
