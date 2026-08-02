package com.unb.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class UpdateNicknameRequest {
    @NotBlank(message = "User ID is required")
    private String userId;

    @NotBlank(message = "New nickname is required")
    @Size(min = 2, max = 20, message = "Nickname must be between 2 and 20 characters")
    private String newNickname;

    public UpdateNicknameRequest() {}

    public UpdateNicknameRequest(String userId, String newNickname) {
        this.userId = userId;
        this.newNickname = newNickname;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getNewNickname() {
        return newNickname;
    }

    public void setNewNickname(String newNickname) {
        this.newNickname = newNickname;
    }
}
