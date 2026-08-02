package com.unb.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public class UserDto {
    private UUID id;
    private String nickname;
    private String bio;
    private String profilePictureUrl;
    private String avatarEmoji;
    private String avatarColor;
    private String email;
    private String nationality;
    private String gender;
    private Integer age;
    private LocalDateTime createdAt;

    public UserDto() {}

    public UserDto(UUID id, String nickname, String bio, String profilePictureUrl, LocalDateTime createdAt) {
        this.id = id;
        this.nickname = nickname;
        this.bio = bio;
        this.profilePictureUrl = profilePictureUrl;
        this.createdAt = createdAt;
    }

    public UserDto(UUID id, String nickname, String bio, String profilePictureUrl, String email, LocalDateTime createdAt) {
        this.id = id;
        this.nickname = nickname;
        this.bio = bio;
        this.profilePictureUrl = profilePictureUrl;
        this.email = email;
        this.createdAt = createdAt;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getNickname() { return nickname; }
    public void setNickname(String nickname) { this.nickname = nickname; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getNationality() { return nationality; }
    public void setNationality(String nationality) { this.nationality = nationality; }
    public String getGender() { return gender; }
    public void setGender(String gender) { this.gender = gender; }
    public Integer getAge() { return age; }
    public void setAge(Integer age) { this.age = age; }
    public String getBio() { return bio; }
    public void setBio(String bio) { this.bio = bio; }
    public String getProfilePictureUrl() { return profilePictureUrl; }
    public void setProfilePictureUrl(String profilePictureUrl) { this.profilePictureUrl = profilePictureUrl; }
    public String getAvatarEmoji() { return avatarEmoji; }
    public void setAvatarEmoji(String avatarEmoji) { this.avatarEmoji = avatarEmoji; }
    public String getAvatarColor() { return avatarColor; }
    public void setAvatarColor(String avatarColor) { this.avatarColor = avatarColor; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
