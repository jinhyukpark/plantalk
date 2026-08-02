package com.unb.service;

import com.unb.entity.User;
import com.unb.entity.UserPhoto;
import com.unb.repository.UserPhotoRepository;
import com.unb.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Base64;

@Service
public class LegacyImageMigrationService {

    private static final Logger log = LoggerFactory.getLogger(LegacyImageMigrationService.class);

    private final UserRepository userRepository;
    private final UserPhotoRepository userPhotoRepository;
    private final SupabaseStorageService storageService;

    public LegacyImageMigrationService(
            UserRepository userRepository,
            UserPhotoRepository userPhotoRepository,
            SupabaseStorageService storageService) {
        this.userRepository = userRepository;
        this.userPhotoRepository = userPhotoRepository;
        this.storageService = storageService;
    }

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void migrateEmbeddedImages() {
        if (!storageService.isConfigured()) {
            return;
        }

        int migrated = 0;
        for (User user : userRepository.findAll()) {
            String value = user.getProfilePictureUrl();
            if (isEmbeddedImage(value)) {
                try {
                    EmbeddedImage image = decode(value);
                    String url = storageService.uploadImageBytes(
                            image.bytes(), image.contentType(), "avatars/" + user.getId());
                    user.setProfilePictureUrl(url);
                    userRepository.save(user);
                    migrated++;
                } catch (RuntimeException exception) {
                    log.error("프로필 사진 Storage 마이그레이션 실패: user={}", user.getId(), exception);
                }
            }
        }

        for (UserPhoto photo : userPhotoRepository.findAll()) {
            if (isEmbeddedImage(photo.getPhotoUrl())) {
                try {
                    EmbeddedImage image = decode(photo.getPhotoUrl());
                    String url = storageService.uploadImageBytes(
                            image.bytes(), image.contentType(), "user-photos/" + photo.getUserId());
                    photo.setPhotoUrl(url);
                    userPhotoRepository.save(photo);
                    migrated++;
                } catch (RuntimeException exception) {
                    log.error("일상 사진 Storage 마이그레이션 실패: photo={}", photo.getId(), exception);
                }
            }
        }

        if (migrated > 0) {
            log.info("기존 DB 이미지 {}개를 Supabase Storage로 이전했습니다", migrated);
        }
    }

    private static boolean isEmbeddedImage(String value) {
        return value != null && value.startsWith("data:image/") && value.contains(";base64,");
    }

    private static EmbeddedImage decode(String value) {
        int separator = value.indexOf(";base64,");
        String contentType = value.substring("data:".length(), separator);
        byte[] bytes = Base64.getDecoder().decode(value.substring(separator + ";base64,".length()));
        return new EmbeddedImage(contentType, bytes);
    }

    private record EmbeddedImage(String contentType, byte[] bytes) {}
}
