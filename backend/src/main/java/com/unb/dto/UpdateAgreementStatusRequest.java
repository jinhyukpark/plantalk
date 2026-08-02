package com.unb.dto;

import jakarta.validation.constraints.NotBlank;

public class UpdateAgreementStatusRequest {
    @NotBlank
    private String requesterId;
    
    @NotBlank
    private String status;

    public UpdateAgreementStatusRequest() {}

    public String getRequesterId() { return requesterId; }
    public void setRequesterId(String requesterId) { this.requesterId = requesterId; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
