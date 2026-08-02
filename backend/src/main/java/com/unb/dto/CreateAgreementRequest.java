package com.unb.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;
import java.util.List;

public class CreateAgreementRequest {
    @NotBlank(message = "제목은 필수입니다")
    private String title;

    private String description;

    @NotBlank(message = "이모지는 필수입니다")
    private String emoji;

    @NotBlank(message = "카테고리는 필수입니다")
    private String category;

    private String customCategoryName;

    private LocalDateTime dateTime;
    private String scheduleType;
    private LocalDateTime endDateTime;

    @NotNull(message = "생성자 ID는 필수입니다")
    private String creatorId;

    private List<String> participantNames;

    public CreateAgreementRequest() {}

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
    public LocalDateTime getDateTime() { return dateTime; }
    public void setDateTime(LocalDateTime dateTime) { this.dateTime = dateTime; }
    public String getScheduleType() { return scheduleType; }
    public void setScheduleType(String scheduleType) { this.scheduleType = scheduleType; }
    public LocalDateTime getEndDateTime() { return endDateTime; }
    public void setEndDateTime(LocalDateTime endDateTime) { this.endDateTime = endDateTime; }
    public String getCreatorId() { return creatorId; }
    public void setCreatorId(String creatorId) { this.creatorId = creatorId; }
    public List<String> getParticipantNames() { return participantNames; }
    public void setParticipantNames(List<String> participantNames) { this.participantNames = participantNames; }
}
