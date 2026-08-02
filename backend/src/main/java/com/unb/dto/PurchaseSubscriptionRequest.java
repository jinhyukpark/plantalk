package com.unb.dto;

public class PurchaseSubscriptionRequest {
    private String userId;
    private String plan;
    private String platform;
    private String productId;
    private String transactionId;
    private String receiptData;
    
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    
    public String getPlan() { return plan; }
    public void setPlan(String plan) { this.plan = plan; }
    
    public String getPlatform() { return platform; }
    public void setPlatform(String platform) { this.platform = platform; }
    
    public String getProductId() { return productId; }
    public void setProductId(String productId) { this.productId = productId; }
    
    public String getTransactionId() { return transactionId; }
    public void setTransactionId(String transactionId) { this.transactionId = transactionId; }
    
    public String getReceiptData() { return receiptData; }
    public void setReceiptData(String receiptData) { this.receiptData = receiptData; }
}
