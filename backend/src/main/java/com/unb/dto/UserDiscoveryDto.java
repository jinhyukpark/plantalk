package com.unb.dto;

import java.util.UUID;

public record UserDiscoveryDto(
        UUID id,
        String nickname,
        String bio,
        String profilePictureUrl,
        String coverPhotoUrl,
        String avatarEmoji,
        String avatarColor,
        String nationality,
        String gender,
        Integer age,
        boolean online
) {}
