package com.unb.dto;

public class UpdateAgreementContentRequest {
    private String requesterId;
    private String title;
    private String description;

    public UpdateAgreementContentRequest() {}

    public String getRequesterId() { return requesterId; }
    public void setRequesterId(String requesterId) { this.requesterId = requesterId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
