package com.unb.dto;

import jakarta.validation.constraints.NotBlank;

public class UpdateParticipantStatusRequest {
    @NotBlank(message = "사용자 이름은 필수입니다")
    private String userName;

    @NotBlank(message = "상태는 필수입니다")
    private String status;

    public UpdateParticipantStatusRequest() {}

    public UpdateParticipantStatusRequest(String userName, String status) {
        this.userName = userName;
        this.status = status;
    }

    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
