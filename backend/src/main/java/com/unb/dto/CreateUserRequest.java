package com.unb.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class CreateUserRequest {
    @NotBlank(message = "닉네임은 필수입니다")
    @Size(min = 2, max = 20, message = "닉네임은 2-20자 사이여야 합니다")
    private String nickname;

    @NotBlank(message = "비밀번호는 필수입니다")
    @Size(min = 4, max = 50, message = "비밀번호는 4-50자 사이여야 합니다")
    private String password;

    @NotBlank(message = "이메일은 필수입니다")
    @Email(message = "올바른 이메일 형식이 아닙니다")
    @Size(max = 254, message = "이메일이 너무 깁니다")
    private String email;
    private String nationality;

    @NotBlank(message = "성별은 필수입니다")
    private String gender;

    @NotNull(message = "나이는 필수입니다")
    @Min(value = 18, message = "만 18세 이상만 가입할 수 있습니다")
    @Max(value = 100, message = "나이는 100세 이하로 입력해주세요")
    private Integer age;

    public CreateUserRequest() {}

    public CreateUserRequest(String nickname, String password) {
        this.nickname = nickname;
        this.password = password;
    }

    public CreateUserRequest(String nickname, String password, String email) {
        this.nickname = nickname;
        this.password = password;
        this.email = email;
    }

    public String getNickname() { return nickname; }
    public void setNickname(String nickname) { this.nickname = nickname; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getNationality() { return nationality; }
    public void setNationality(String nationality) { this.nationality = nationality; }
    public String getGender() { return gender; }
    public void setGender(String gender) { this.gender = gender; }
    public Integer getAge() { return age; }
    public void setAge(Integer age) { this.age = age; }
}
