package com.unb.controller;

import com.unb.service.SupabaseStorageService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/images")
public class ImageController {

    private final SupabaseStorageService storageService;

    public ImageController(SupabaseStorageService storageService) {
        this.storageService = storageService;
    }

    @PostMapping(value = "/rooms/{roomId}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadRoomImage(
            @PathVariable String roomId,
            @RequestPart("file") MultipartFile file) {
        try {
            String url = storageService.uploadImage(file, "room-images/" + roomId);
            return ResponseEntity.ok(Map.of("url", url));
        } catch (RuntimeException exception) {
            return ResponseEntity.badRequest().body(Map.of("error", exception.getMessage()));
        }
    }
}
