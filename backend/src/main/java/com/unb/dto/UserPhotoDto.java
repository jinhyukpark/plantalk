package com.unb.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public class UserPhotoDto {
    private UUID id;
    private UUID userId;
    private String photoUrl;
    private String caption;
    private Integer displayOrder;
    private LocalDateTime createdAt;

    public UserPhotoDto() {}

    public UserPhotoDto(UUID id, UUID userId, String photoUrl, String caption, 
                        Integer displayOrder, LocalDateTime createdAt) {
        this.id = id;
        this.userId = userId;
        this.photoUrl = photoUrl;
        this.caption = caption;
        this.displayOrder = displayOrder;
        this.createdAt = createdAt;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }
    public String getPhotoUrl() { return photoUrl; }
    public void setPhotoUrl(String photoUrl) { this.photoUrl = photoUrl; }
    public String getCaption() { return caption; }
    public void setCaption(String caption) { this.caption = caption; }
    public Integer getDisplayOrder() { return displayOrder; }
    public void setDisplayOrder(Integer displayOrder) { this.displayOrder = displayOrder; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
