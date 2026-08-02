package com.unb.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "payments", indexes = {
    @Index(name = "idx_payments_user", columnList = "user_id"),
    @Index(name = "idx_payments_subscription", columnList = "subscription_id")
})
public class Payment {
    
    @Id
    private String id;
    
    @Column(name = "user_id", nullable = false)
    private String userId;
    
    @Column(name = "subscription_id")
    private String subscriptionId;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PaymentProvider provider;
    
    @Column(name = "product_id")
    private String productId;
    
    @Column(name = "amount_krw")
    private Integer amountKrw;
    
    private String currency = "KRW";
    
    @Column(name = "receipt_data", columnDefinition = "TEXT")
    private String receiptData;
    
    @Column(name = "transaction_id")
    private String transactionId;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PaymentStatus status = PaymentStatus.COMPLETED;
    
    @Column(name = "purchased_at")
    private LocalDateTime purchasedAt;
    
    @Column(name = "refunded_at")
    private LocalDateTime refundedAt;
    
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    @PrePersist
    protected void onCreate() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
        createdAt = LocalDateTime.now();
        if (purchasedAt == null) {
            purchasedAt = LocalDateTime.now();
        }
    }
    
    public enum PaymentProvider {
        APPLE, GOOGLE
    }
    
    public enum PaymentStatus {
        PENDING, COMPLETED, REFUNDED, FAILED
    }
    
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    
    public String getSubscriptionId() { return subscriptionId; }
    public void setSubscriptionId(String subscriptionId) { this.subscriptionId = subscriptionId; }
    
    public PaymentProvider getProvider() { return provider; }
    public void setProvider(PaymentProvider provider) { this.provider = provider; }
    
    public String getProductId() { return productId; }
    public void setProductId(String productId) { this.productId = productId; }
    
    public Integer getAmountKrw() { return amountKrw; }
    public void setAmountKrw(Integer amountKrw) { this.amountKrw = amountKrw; }
    
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    
    public String getReceiptData() { return receiptData; }
    public void setReceiptData(String receiptData) { this.receiptData = receiptData; }
    
    public String getTransactionId() { return transactionId; }
    public void setTransactionId(String transactionId) { this.transactionId = transactionId; }
    
    public PaymentStatus getStatus() { return status; }
    public void setStatus(PaymentStatus status) { this.status = status; }
    
    public LocalDateTime getPurchasedAt() { return purchasedAt; }
    public void setPurchasedAt(LocalDateTime purchasedAt) { this.purchasedAt = purchasedAt; }
    
    public LocalDateTime getRefundedAt() { return refundedAt; }
    public void setRefundedAt(LocalDateTime refundedAt) { this.refundedAt = refundedAt; }
    
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
