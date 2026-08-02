package com.unb.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "subscriptions", indexes = {
    @Index(name = "idx_subscriptions_user", columnList = "user_id"),
    @Index(name = "idx_subscriptions_status_expires", columnList = "status, expires_at")
})
public class Subscription {
    
    @Id
    private String id;
    
    @Column(name = "user_id", nullable = false)
    private String userId;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SubscriptionPlan plan;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SubscriptionStatus status = SubscriptionStatus.ACTIVE;
    
    @Column(name = "price_krw")
    private Integer priceKrw;
    
    @Column(name = "started_at")
    private LocalDateTime startedAt;
    
    @Column(name = "expires_at")
    private LocalDateTime expiresAt;
    
    @Column(name = "last_transaction_id")
    private String lastTransactionId;
    
    @Enumerated(EnumType.STRING)
    private Platform platform;
    
    @Column(name = "auto_renew")
    private Boolean autoRenew = false;
    
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    @PrePersist
    protected void onCreate() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (startedAt == null) {
            startedAt = LocalDateTime.now();
        }
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
    
    public enum SubscriptionPlan {
        WEEKLY(5000, 7),
        BIWEEKLY(10000, 14),
        ANNUAL(50000, 365);
        
        private final int priceKrw;
        private final int durationDays;
        
        SubscriptionPlan(int priceKrw, int durationDays) {
            this.priceKrw = priceKrw;
            this.durationDays = durationDays;
        }
        
        public int getPriceKrw() { return priceKrw; }
        public int getDurationDays() { return durationDays; }
    }
    
    public enum SubscriptionStatus {
        ACTIVE, EXPIRED, CANCELED, PENDING
    }
    
    public enum Platform {
        IOS, ANDROID
    }
    
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    
    public SubscriptionPlan getPlan() { return plan; }
    public void setPlan(SubscriptionPlan plan) { this.plan = plan; }
    
    public SubscriptionStatus getStatus() { return status; }
    public void setStatus(SubscriptionStatus status) { this.status = status; }
    
    public Integer getPriceKrw() { return priceKrw; }
    public void setPriceKrw(Integer priceKrw) { this.priceKrw = priceKrw; }
    
    public LocalDateTime getStartedAt() { return startedAt; }
    public void setStartedAt(LocalDateTime startedAt) { this.startedAt = startedAt; }
    
    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }
    
    public String getLastTransactionId() { return lastTransactionId; }
    public void setLastTransactionId(String lastTransactionId) { this.lastTransactionId = lastTransactionId; }
    
    public Platform getPlatform() { return platform; }
    public void setPlatform(Platform platform) { this.platform = platform; }
    
    public Boolean getAutoRenew() { return autoRenew; }
    public void setAutoRenew(Boolean autoRenew) { this.autoRenew = autoRenew; }
    
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
