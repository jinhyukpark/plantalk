package com.unb.dto;

import jakarta.validation.constraints.NotBlank;

public class LoginRequest {
    @NotBlank(message = "닉네임은 필수입니다")
    private String nickname;

    @NotBlank(message = "비밀번호는 필수입니다")
    private String password;

    public LoginRequest() {}

    public LoginRequest(String nickname, String password) {
        this.nickname = nickname;
        this.password = password;
    }

    public String getNickname() { return nickname; }
    public void setNickname(String nickname) { this.nickname = nickname; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
}
