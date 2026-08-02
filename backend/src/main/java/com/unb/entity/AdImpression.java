package com.unb.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "ad_impressions", indexes = {
    @Index(name = "idx_ad_impressions_user", columnList = "user_id"),
    @Index(name = "idx_ad_impressions_served_at", columnList = "served_at")
})
public class AdImpression {
    
    @Id
    private String id;
    
    @Column(name = "user_id")
    private String userId;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "ad_type", nullable = false)
    private AdType adType;
    
    @Column(name = "ad_unit_id")
    private String adUnitId;
    
    @Column(name = "served_at")
    private LocalDateTime servedAt;
    
    @Column(name = "duration_seconds")
    private Integer durationSeconds;
    
    @Column(name = "completed")
    private Boolean completed = false;
    
    @PrePersist
    protected void onCreate() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
        if (servedAt == null) {
            servedAt = LocalDateTime.now();
        }
    }
    
    public enum AdType {
        VIDEO, INTERSTITIAL, REWARDED
    }
    
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    
    public AdType getAdType() { return adType; }
    public void setAdType(AdType adType) { this.adType = adType; }
    
    public String getAdUnitId() { return adUnitId; }
    public void setAdUnitId(String adUnitId) { this.adUnitId = adUnitId; }
    
    public LocalDateTime getServedAt() { return servedAt; }
    public void setServedAt(LocalDateTime servedAt) { this.servedAt = servedAt; }
    
    public Integer getDurationSeconds() { return durationSeconds; }
    public void setDurationSeconds(Integer durationSeconds) { this.durationSeconds = durationSeconds; }
    
    public Boolean getCompleted() { return completed; }
    public void setCompleted(Boolean completed) { this.completed = completed; }
}
