package com.unb.dto;

public class RecordAdImpressionRequest {
    private String userId;
    private String adType;
    private String adUnitId;
    private Integer durationSeconds;
    private Boolean completed;
    
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    
    public String getAdType() { return adType; }
    public void setAdType(String adType) { this.adType = adType; }
    
    public String getAdUnitId() { return adUnitId; }
    public void setAdUnitId(String adUnitId) { this.adUnitId = adUnitId; }
    
    public Integer getDurationSeconds() { return durationSeconds; }
    public void setDurationSeconds(Integer durationSeconds) { this.durationSeconds = durationSeconds; }
    
    public Boolean getCompleted() { return completed; }
    public void setCompleted(Boolean completed) { this.completed = completed; }
}
