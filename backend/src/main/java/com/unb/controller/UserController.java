package com.unb.controller;

import com.unb.dto.CreateUserRequest;
import com.unb.dto.LoginRequest;
import com.unb.dto.UpdateNicknameRequest;
import com.unb.dto.UserDto;
import com.unb.dto.UserDiscoveryDto;
import com.unb.dto.UserProfileDto;
import com.unb.dto.UserPhotoDto;
import com.unb.dto.BlockUserRequest;
import com.unb.dto.BlockedUserDto;
import com.unb.service.UserService;
import com.unb.service.EmailRateLimitException;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping
    public ResponseEntity<?> createUser(@Valid @RequestBody CreateUserRequest request) {
        try {
            UserDto user = userService.createUser(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(user);
        } catch (EmailRateLimitException e) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(Map.of("error", e.getMessage()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        try {
            UserDto user = userService.login(request);
            return ResponseEntity.ok(user);
        } catch (EmailRateLimitException e) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(Map.of("error", e.getMessage()));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/find-id")
    public ResponseEntity<?> findId(@RequestBody Map<String, String> body) {
        try {
            userService.findId(body.get("email"));
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "입력하신 이메일로 가입된 아이디가 있다면 메일을 보내드렸습니다"));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                    "error", "메일을 발송하지 못했습니다. 잠시 후 다시 시도해주세요"));
        }
    }

    @PostMapping("/password-reset/request")
    public ResponseEntity<?> requestPasswordReset(@RequestBody Map<String, String> body) {
        try {
            userService.requestPasswordReset(body.get("nickname"), body.get("email"));
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "입력하신 정보가 일치하면 인증 코드를 메일로 보내드렸습니다"));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                    "error", "인증 코드 메일을 발송하지 못했습니다. 잠시 후 다시 시도해주세요"));
        }
    }

    @PostMapping("/password-reset/confirm")
    public ResponseEntity<?> confirmPasswordReset(@RequestBody Map<String, String> body) {
        try {
            userService.confirmPasswordReset(
                    body.get("nickname"), body.get("email"),
                    body.get("code"), body.get("newPassword"));
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserDto> getUser(@PathVariable UUID id) {
        return userService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/nickname/{nickname}")
    public ResponseEntity<UserDto> getUserByNickname(@PathVariable String nickname) {
        return userService.findByNickname(nickname)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/check-nickname")
    public ResponseEntity<Map<String, Boolean>> checkNicknameAvailable(@RequestParam("nickname") String nickname) {
        if (nickname == null || nickname.trim().length() < 2) {
            return ResponseEntity.ok(Map.of("available", false));
        }
        boolean available = userService.isNicknameAvailable(nickname.trim());
        return ResponseEntity.ok(Map.of("available", available));
    }

    @GetMapping("/search")
    public ResponseEntity<List<UserDto>> searchUsers(@RequestParam("q") String query) {
        if (query == null || query.trim().length() < 2) {
            return ResponseEntity.ok(List.of());
        }
        List<UserDto> users = userService.searchByNickname(query.trim());
        return ResponseEntity.ok(users);
    }

    @GetMapping("/discover")
    public ResponseEntity<List<UserDiscoveryDto>> discoverUsers(
            @RequestParam(value = "viewerId", required = false) UUID viewerId,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "40") int size,
            @RequestParam(value = "country", required = false) String country,
            @RequestParam(value = "gender", required = false) String gender,
            @RequestParam(value = "minAge", required = false) Integer minAge,
            @RequestParam(value = "maxAge", required = false) Integer maxAge,
            @RequestParam(value = "onlineOnly", defaultValue = "false") boolean onlineOnly) {
        return ResponseEntity.ok(userService.discoverUsers(
                viewerId, page, size, country, gender, minAge, maxAge, onlineOnly));
    }

    @PutMapping("/nickname")
    public ResponseEntity<?> updateNickname(@Valid @RequestBody UpdateNicknameRequest request) {
        try {
            UserDto user = userService.updateNickname(request);
            return ResponseEntity.ok(user);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}/bio")
    public ResponseEntity<?> updateBio(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        try {
            String bio = body.get("bio");
            UserDto user = userService.updateBio(id, bio);
            return ResponseEntity.ok(user);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}/email")
    public ResponseEntity<?> updateEmail(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        try {
            UserDto user = userService.updateEmail(id, body.get("email"));
            return ResponseEntity.ok(user);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}/password")
    public ResponseEntity<?> changePassword(@PathVariable UUID id,
                                            @RequestBody Map<String, String> body) {
        try {
            userService.changePassword(id, body.get("currentPassword"), body.get("newPassword"));
            return ResponseEntity.ok(Map.of("success", true, "message", "비밀번호가 변경되었습니다"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}/nationality")
    public ResponseEntity<?> updateNationality(@PathVariable UUID id,
                                               @RequestBody Map<String, String> body) {
        try {
            return ResponseEntity.ok(userService.updateNationality(id, body.get("nationality")));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}/avatar")
    public ResponseEntity<?> updateAvatar(@PathVariable UUID id,
                                          @RequestBody Map<String, String> body) {
        try {
            return ResponseEntity.ok(userService.updateAvatar(
                    id, body.get("emoji"), body.get("color")));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/block")
    public ResponseEntity<?> blockUser(@Valid @RequestBody BlockUserRequest request) {
        try {
            BlockedUserDto blocked = userService.blockUser(request.getBlockerId(), request.getBlockedId());
            return ResponseEntity.status(HttpStatus.CREATED).body(blocked);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/block")
    public ResponseEntity<?> unblockUser(@RequestParam("blockerId") UUID blockerId, @RequestParam("blockedId") UUID blockedId) {
        try {
            userService.unblockUser(blockerId, blockedId);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{id}/blocked")
    public ResponseEntity<List<BlockedUserDto>> getBlockedUsers(@PathVariable UUID id) {
        List<BlockedUserDto> blockedUsers = userService.getBlockedUsers(id);
        return ResponseEntity.ok(blockedUsers);
    }

    @GetMapping("/{id}/blocked/ids")
    public ResponseEntity<List<UUID>> getBlockedUserIds(@PathVariable UUID id) {
        List<UUID> blockedIds = userService.getBlockedUserIds(id);
        return ResponseEntity.ok(blockedIds);
    }

    @GetMapping("/{id}/profile")
    public ResponseEntity<UserProfileDto> getUserProfile(@PathVariable UUID id) {
        return userService.getUserProfile(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/nickname/{nickname}/profile")
    public ResponseEntity<UserProfileDto> getUserProfileByNickname(@PathVariable String nickname) {
        return userService.getUserProfileByNickname(nickname)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping(value = "/{id}/profile-picture", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> updateProfilePicture(
            @PathVariable UUID id,
            @RequestPart("file") MultipartFile file) {
        try {
            UserDto user = userService.updateProfilePicture(id, file);
            return ResponseEntity.ok(user);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}/profile-picture")
    public ResponseEntity<?> deleteProfilePicture(@PathVariable UUID id) {
        try {
            return ResponseEntity.ok(userService.deleteProfilePicture(id));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{id}/photos")
    public ResponseEntity<List<UserPhotoDto>> getUserPhotos(@PathVariable UUID id) {
        List<UserPhotoDto> photos = userService.getUserPhotos(id);
        return ResponseEntity.ok(photos);
    }

    @PostMapping(value = "/{id}/photos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> addUserPhoto(
            @PathVariable UUID id,
            @RequestPart("file") MultipartFile file,
            @RequestPart(value = "caption", required = false) String caption) {
        try {
            UserPhotoDto photo = userService.addUserPhoto(id, file, caption);
            return ResponseEntity.status(HttpStatus.CREATED).body(photo);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}/photos/{photoId}")
    public ResponseEntity<?> deleteUserPhoto(@PathVariable UUID id, @PathVariable UUID photoId) {
        try {
            userService.deleteUserPhoto(id, photoId);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
