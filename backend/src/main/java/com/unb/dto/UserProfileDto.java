package com.unb.dto;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class UserProfileDto {
    private UUID id;
    private String nickname;
    private String bio;
    private String profilePictureUrl;
    private String avatarEmoji;
    private String avatarColor;
    private LocalDateTime createdAt;
    private long participatingCount;
    private long completedCount;
    private long followerCount;
    private long followingCount;
    private boolean online;
    private List<UserPhotoDto> photos;

    public UserProfileDto() {
        this.photos = new ArrayList<>();
    }

    public UserProfileDto(UUID id, String nickname, String bio, String profilePictureUrl,
                          LocalDateTime createdAt, long participatingCount, long completedCount) {
        this.id = id;
        this.nickname = nickname;
        this.bio = bio;
        this.profilePictureUrl = profilePictureUrl;
        this.createdAt = createdAt;
        this.participatingCount = participatingCount;
        this.completedCount = completedCount;
        this.photos = new ArrayList<>();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getNickname() { return nickname; }
    public void setNickname(String nickname) { this.nickname = nickname; }
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
    public long getParticipatingCount() { return participatingCount; }
    public void setParticipatingCount(long participatingCount) { this.participatingCount = participatingCount; }
    public long getCompletedCount() { return completedCount; }
    public void setCompletedCount(long completedCount) { this.completedCount = completedCount; }
    public long getFollowerCount() { return followerCount; }
    public void setFollowerCount(long followerCount) { this.followerCount = followerCount; }
    public long getFollowingCount() { return followingCount; }
    public void setFollowingCount(long followingCount) { this.followingCount = followingCount; }
    public boolean isOnline() { return online; }
    public void setOnline(boolean online) { this.online = online; }
    public List<UserPhotoDto> getPhotos() { return photos; }
    public void setPhotos(List<UserPhotoDto> photos) { this.photos = photos; }
}
