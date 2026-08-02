package com.unb.service;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.multipart.MultipartFile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class SupabaseStorageService {

    private static final Logger log = LoggerFactory.getLogger(SupabaseStorageService.class);
    private static final long MAX_IMAGE_SIZE = 6 * 1024 * 1024;

    private final String supabaseUrl;
    private final String serviceRoleKey;
    private final String bucket;
    private final RestClient restClient;
    private volatile boolean storageReady;

    public SupabaseStorageService(
            @Value("${supabase.url:}") String supabaseUrl,
            @Value("${supabase.service-role-key:}") String serviceRoleKey,
            @Value("${supabase.storage.bucket:plantalk-images}") String bucket) {
        this.supabaseUrl = removeTrailingSlash(supabaseUrl);
        this.serviceRoleKey = serviceRoleKey;
        this.bucket = bucket;
        this.restClient = RestClient.builder()
                .baseUrl(this.supabaseUrl)
                .defaultHeader("apikey", serviceRoleKey)
                .defaultHeader("Authorization", "Bearer " + serviceRoleKey)
                .build();
    }

    @PostConstruct
    void ensureBucketExists() {
        if (!isConfigured()) {
            log.warn("Supabase Storage 설정이 없어 이미지 기능을 비활성화합니다.");
            return;
        }

        try {
            restClient.get()
                    .uri("/storage/v1/bucket/{bucket}", bucket)
                    .retrieve()
                    .toBodilessEntity();
            storageReady = true;
            return;
        } catch (RestClientResponseException exception) {
            if (!isBucketNotFound(exception)) {
                log.error("Supabase Storage 버킷 확인 실패. 이미지 기능만 비활성화합니다. status={}, body={}",
                        exception.getStatusCode(), exception.getResponseBodyAsString());
                return;
            }
        }

        try {
            log.info("Supabase Storage 버킷 '{}'이 없어 자동 생성합니다.", bucket);
            restClient.post()
                    .uri("/storage/v1/bucket")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "id", bucket,
                            "name", bucket,
                            "public", true,
                            "file_size_limit", MAX_IMAGE_SIZE,
                            "allowed_mime_types", List.of("image/jpeg", "image/png", "image/webp")))
                    .retrieve()
                    .toBodilessEntity();
            storageReady = true;
            log.info("Supabase Storage 버킷 '{}' 준비 완료", bucket);
        } catch (RestClientResponseException exception) {
            if (exception.getStatusCode().value() == 409) {
                storageReady = true;
                return;
            }
            log.error("Supabase Storage 버킷 생성 실패. 백엔드는 계속 실행하지만 이미지 기능은 비활성화됩니다. status={}, body={}",
                    exception.getStatusCode(), exception.getResponseBodyAsString());
        }
    }

    public String uploadImage(MultipartFile file, String folder) {
        validateConfiguration();
        validateImage(file);

        try {
            return uploadImageBytes(file.getBytes(), file.getContentType(), folder);
        } catch (IOException exception) {
            throw new RuntimeException("이미지 데이터를 읽지 못했습니다", exception);
        }
    }

    public String uploadImageBytes(byte[] bytes, String contentType, String folder) {
        validateConfiguration();
        validateImage(bytes, contentType);
        String objectPath = sanitizeFolder(folder) + "/" + UUID.randomUUID()
                + extensionFor(contentType);
        try {
            restClient.post()
                    .uri("/storage/v1/object/{bucket}/{path}", bucket, objectPath)
                    .contentType(MediaType.parseMediaType(contentType))
                    .header("x-upsert", "false")
                    .body(bytes)
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException exception) {
            throw new RuntimeException("Supabase Storage 업로드에 실패했습니다: "
                    + exception.getResponseBodyAsString(), exception);
        }
        return publicUrlPrefix() + objectPath;
    }

    public void deleteByPublicUrl(String publicUrl) {
        if (publicUrl == null || publicUrl.isBlank() || !isConfigured()) {
            return;
        }
        String prefix = publicUrlPrefix();
        if (!publicUrl.startsWith(prefix)) {
            return;
        }

        String objectPath = publicUrl.substring(prefix.length());
        try {
            restClient.delete()
                    .uri("/storage/v1/object/{bucket}/{path}", bucket, objectPath)
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException exception) {
            if (exception.getStatusCode().value() != 404) {
                throw new RuntimeException("Supabase Storage 이미지 삭제에 실패했습니다", exception);
            }
        }
    }

    private void validateImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new RuntimeException("이미지 파일이 필요합니다");
        }
        if (file.getSize() > MAX_IMAGE_SIZE) {
            throw new RuntimeException("이미지는 6MB 이하여야 합니다");
        }
        if (!List.of("image/jpeg", "image/png", "image/webp").contains(file.getContentType())) {
            throw new RuntimeException("JPEG, PNG, WebP 이미지만 업로드할 수 있습니다");
        }
    }

    private void validateImage(byte[] bytes, String contentType) {
        if (bytes == null || bytes.length == 0) {
            throw new RuntimeException("이미지 파일이 필요합니다");
        }
        if (bytes.length > MAX_IMAGE_SIZE) {
            throw new RuntimeException("이미지는 6MB 이하여야 합니다");
        }
        if (!List.of("image/jpeg", "image/png", "image/webp").contains(contentType)) {
            throw new RuntimeException("JPEG, PNG, WebP 이미지만 업로드할 수 있습니다");
        }
    }

    private String publicUrlPrefix() {
        return supabaseUrl + "/storage/v1/object/public/" + bucket + "/";
    }

    private void validateConfiguration() {
        if (!isConfigured()) {
            throw new RuntimeException("Supabase Storage 환경변수가 설정되지 않았습니다");
        }
        if (!storageReady) {
            throw new RuntimeException("Supabase Storage 버킷을 사용할 수 없습니다. service role key와 버킷 설정을 확인해주세요");
        }
    }

    public boolean isConfigured() {
        return !supabaseUrl.isBlank() && !serviceRoleKey.isBlank();
    }

    private boolean isBucketNotFound(RestClientResponseException exception) {
        if (exception.getStatusCode().value() == 404) {
            return true;
        }
        String body = exception.getResponseBodyAsString();
        return body != null && (body.contains("\"statusCode\":\"404\"")
                || body.contains("\"statusCode\":404")
                || body.contains("Bucket not found"));
    }

    private static String sanitizeFolder(String folder) {
        if (folder == null || !folder.matches("[a-zA-Z0-9/_-]+")) {
            throw new RuntimeException("올바르지 않은 Storage 경로입니다");
        }
        return folder.replaceAll("^/+|/+$", "");
    }

    private static String extensionFor(String contentType) {
        return switch (contentType) {
            case "image/png" -> ".png";
            case "image/webp" -> ".webp";
            default -> ".jpg";
        };
    }

    private static String removeTrailingSlash(String value) {
        return value == null ? "" : value.replaceAll("/+$", "");
    }
}
