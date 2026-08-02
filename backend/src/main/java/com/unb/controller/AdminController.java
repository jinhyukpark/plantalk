package com.unb.controller;

import com.unb.entity.Agreement;
import com.unb.entity.Participant;
import com.unb.entity.Room;
import com.unb.entity.RoomMessage;
import com.unb.entity.RoomParticipant;
import com.unb.entity.User;
import com.unb.repository.AgreementRepository;
import com.unb.repository.RoomMessageRepository;
import com.unb.repository.RoomParticipantRepository;
import com.unb.repository.RoomRepository;
import com.unb.repository.SubscriptionRepository;
import com.unb.repository.UserRepository;
import com.unb.service.AdminAnnouncementService;
import com.unb.service.AdminAuthService;
import com.unb.service.GlobalAnnouncementService;
import com.unb.service.FriendMessagingService;
import com.unb.service.LocalizedContentService;
import com.unb.entity.GlobalAnnouncement;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminAuthService adminAuthService;
    private final AdminAnnouncementService announcementService;
    private final GlobalAnnouncementService globalAnnouncementService;
    private final UserRepository userRepository;
    private final RoomRepository roomRepository;
    private final RoomMessageRepository roomMessageRepository;
    private final RoomParticipantRepository roomParticipantRepository;
    private final AgreementRepository agreementRepository;
    private final SubscriptionRepository subscriptionRepository;
    private final FriendMessagingService friendMessagingService;
    private final LocalizedContentService localizedContentService;

    public AdminController(AdminAuthService adminAuthService,
                           AdminAnnouncementService announcementService,
                           GlobalAnnouncementService globalAnnouncementService,
                           UserRepository userRepository,
                           RoomRepository roomRepository,
                           RoomMessageRepository roomMessageRepository,
                           RoomParticipantRepository roomParticipantRepository,
                           AgreementRepository agreementRepository,
                           SubscriptionRepository subscriptionRepository,
                           FriendMessagingService friendMessagingService,
                           LocalizedContentService localizedContentService) {
        this.adminAuthService = adminAuthService;
        this.announcementService = announcementService;
        this.globalAnnouncementService = globalAnnouncementService;
        this.userRepository = userRepository;
        this.roomRepository = roomRepository;
        this.roomMessageRepository = roomMessageRepository;
        this.roomParticipantRepository = roomParticipantRepository;
        this.agreementRepository = agreementRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.friendMessagingService = friendMessagingService;
        this.localizedContentService = localizedContentService;
    }

    @GetMapping("/localized-content/usage-guide")
    public Map<String, Object> usageGuide() {
        return localizedContentService.getAll(LocalizedContentService.USAGE_GUIDE);
    }

    @PutMapping("/localized-content/usage-guide")
    public ResponseEntity<?> updateUsageGuide(@RequestBody Map<String, String> request) {
        try {
            return ResponseEntity.ok(localizedContentService.updateUsageGuide(request));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> request) {
        if (!adminAuthService.isConfigured()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of("error", "NOT_CONFIGURED",
                    "message", "관리자 계정이 설정되지 않았습니다. ADMIN_PASSWORD 환경 변수를 설정해 주세요."));
        }
        if (adminAuthService.isLockedOut()) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .body(Map.of("error", "LOCKED_OUT",
                    "message", "로그인 시도가 너무 많습니다. " + adminAuthService.lockoutRemainingSeconds() + "초 후에 다시 시도해 주세요."));
        }
        String username = request.get("username");
        String password = request.get("password");
        if (!adminAuthService.checkCredentials(username, password)) {
            if (adminAuthService.isLockedOut()) {
                return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(Map.of("error", "LOCKED_OUT",
                        "message", "로그인 시도가 너무 많습니다. " + adminAuthService.lockoutRemainingSeconds() + "초 후에 다시 시도해 주세요."));
            }
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", "INVALID_CREDENTIALS",
                    "message", "아이디 또는 비밀번호가 올바르지 않습니다."));
        }
        return ResponseEntity.ok(Map.of("token", adminAuthService.createToken()));
    }

    @GetMapping("/stats")
    public Map<String, Object> stats() {
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalUsers", userRepository.count());
        stats.put("totalRooms", roomRepository.count());
        stats.put("activeRooms", roomRepository.countByStatus(Room.RoomStatus.ACTIVE));
        stats.put("totalMessages", roomMessageRepository.count());
        stats.put("totalAgreements", agreementRepository.count());
        stats.put("friendships", friendMessagingService.adminFriendships().stream()
            .filter(item -> "ACCEPTED".equals(String.valueOf(item.get("status")))).count());
        stats.put("directMessages", friendMessagingService.adminMessages(500).size());
        return stats;
    }

    @GetMapping("/users")
    public Map<String, Object> users(@RequestParam(defaultValue = "0") int page,
                                     @RequestParam(defaultValue = "20") int size,
                                     @RequestParam(required = false) String search) {
        Map<String, Object> result = new HashMap<>();
        LocalDateTime now = LocalDateTime.now();
        if (search != null && !search.isBlank()) {
            List<User> found = userRepository.searchByNickname(search.trim());
            result.put("users", found.stream().map(u -> userSummary(u, now)).toList());
            result.put("totalElements", found.size());
            result.put("totalPages", 1);
            result.put("page", 0);
        } else {
            Page<User> userPage = userRepository.findAll(
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
            result.put("users", userPage.getContent().stream().map(u -> userSummary(u, now)).toList());
            result.put("totalElements", userPage.getTotalElements());
            result.put("totalPages", userPage.getTotalPages());
            result.put("page", page);
        }
        return result;
    }

    @GetMapping("/users/{id}")
    @Transactional(readOnly = true)
    public ResponseEntity<?> userDetail(@PathVariable String id) {
        UUID userId;
        try {
            userId = UUID.fromString(id);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", "잘못된 사용자 ID입니다."));
        }
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "사용자를 찾을 수 없습니다."));
        }
        LocalDateTime now = LocalDateTime.now();
        Map<String, Object> detail = new LinkedHashMap<>(userSummary(user, now));
        detail.put("bio", user.getBio());
        detail.put("profilePictureUrl", user.getProfilePictureUrl());

        List<Map<String, Object>> rooms = new ArrayList<>();
        for (RoomParticipant rp : roomParticipantRepository.findByUserIdAndStatus(
                user.getId().toString(), RoomParticipant.ParticipantStatus.JOINED)) {
            Room room = rp.getRoom();
            if (room == null) continue;
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("id", room.getId());
            r.put("title", room.getTitle());
            r.put("emoji", room.getEmoji());
            r.put("status", room.getStatus().name());
            r.put("joinedAt", rp.getJoinedAt() != null ? rp.getJoinedAt().toString() : null);
            rooms.add(r);
        }
        detail.put("rooms", rooms);

        List<Map<String, Object>> agreements = new ArrayList<>();
        for (Agreement a : agreementRepository.findByParticipantUserName(user.getNickname())) {
            agreements.add(agreementSummary(a));
        }
        detail.put("agreements", agreements);
        detail.put("friends", friendMessagingService.friends(userId));
        return ResponseEntity.ok(detail);
    }

    @GetMapping("/friendships")
    public List<Map<String, Object>> friendships() {
        return friendMessagingService.adminFriendships();
    }

    @GetMapping("/direct-messages")
    public List<Map<String, Object>> directMessages(@RequestParam(defaultValue = "200") int limit) {
        return friendMessagingService.adminMessages(limit);
    }

    @DeleteMapping("/direct-messages/{id}")
    public ResponseEntity<?> deleteDirectMessage(@PathVariable UUID id) {
        try {
            friendMessagingService.adminDeleteMessage(id);
            return ResponseEntity.ok(Map.of("message", "메시지가 삭제되었습니다."));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/rooms")
    public Map<String, Object> rooms(@RequestParam(defaultValue = "0") int page,
                                     @RequestParam(defaultValue = "20") int size) {
        Page<Room> roomPage = roomRepository.findAll(
            PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        List<Map<String, Object>> rooms = new ArrayList<>();
        for (Room room : roomPage.getContent()) {
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("id", room.getId());
            r.put("title", room.getTitle());
            r.put("emoji", room.getEmoji());
            r.put("category", room.getCategory());
            r.put("visibility", room.getVisibility().name());
            r.put("status", room.getStatus().name());
            r.put("creatorName", room.getCreatorName());
            r.put("currentParticipants", room.getCurrentParticipants());
            r.put("maxParticipants", room.getMaxParticipants());
            r.put("messageCount", roomMessageRepository.countByRoomId(room.getId()));
            r.put("createdAt", room.getCreatedAt() != null ? room.getCreatedAt().toString() : null);
            rooms.add(r);
        }
        Map<String, Object> result = new HashMap<>();
        result.put("rooms", rooms);
        result.put("totalElements", roomPage.getTotalElements());
        result.put("totalPages", roomPage.getTotalPages());
        result.put("page", page);
        return result;
    }

    @GetMapping("/rooms/{id}/messages")
    public ResponseEntity<?> roomMessages(@PathVariable String id,
                                          @RequestParam(defaultValue = "0") int page,
                                          @RequestParam(defaultValue = "50") int size) {
        Room room = roomRepository.findById(id).orElse(null);
        if (room == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "채팅방을 찾을 수 없습니다."));
        }
        List<RoomMessage> messages = roomMessageRepository.findByRoomIdOrderByCreatedAtDesc(
            id, PageRequest.of(page, size));
        List<Map<String, Object>> messageList = new ArrayList<>();
        for (RoomMessage m : messages) {
            Map<String, Object> msg = new LinkedHashMap<>();
            msg.put("id", m.getId());
            msg.put("senderId", m.getSenderId());
            msg.put("senderName", m.getSenderName());
            msg.put("content", m.getContent());
            msg.put("messageType", m.getMessageType().name());
            msg.put("createdAt", m.getCreatedAt() != null ? m.getCreatedAt().toString() : null);
            messageList.add(msg);
        }

        List<Map<String, Object>> participants = new ArrayList<>();
        for (RoomParticipant rp : roomParticipantRepository.findByRoomId(id)) {
            Map<String, Object> p = new LinkedHashMap<>();
            p.put("userId", rp.getUserId());
            p.put("userName", rp.getUserName());
            p.put("role", rp.getRole().name());
            p.put("status", rp.getStatus().name());
            participants.add(p);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("roomTitle", room.getTitle());
        result.put("roomEmoji", room.getEmoji());
        result.put("messages", messageList);
        result.put("participants", participants);
        result.put("totalMessages", roomMessageRepository.countByRoomId(id));
        result.put("page", page);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/agreements")
    @Transactional(readOnly = true)
    public Map<String, Object> agreements(@RequestParam(defaultValue = "0") int page,
                                          @RequestParam(defaultValue = "20") int size) {
        Page<Agreement> agreementPage = agreementRepository.findAll(
            PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        List<Map<String, Object>> agreements = new ArrayList<>();
        for (Agreement a : agreementPage.getContent()) {
            agreements.add(agreementSummary(a));
        }
        Map<String, Object> result = new HashMap<>();
        result.put("agreements", agreements);
        result.put("totalElements", agreementPage.getTotalElements());
        result.put("totalPages", agreementPage.getTotalPages());
        result.put("page", page);
        return result;
    }

    @PostMapping("/announcements")
    public ResponseEntity<?> sendAnnouncement(@RequestBody Map<String, String> request) {
        String content = request.get("content");
        if (content == null || content.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "공지 내용을 입력해 주세요."));
        }
        String roomId = request.get("roomId");
        try {
            Map<String, Object> result = announcementService.sendAnnouncement(roomId, content);
            return ResponseEntity.ok(result);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/announcements")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> announcementHistory() {
        List<Map<String, Object>> history = new ArrayList<>();
        for (RoomMessage m : roomMessageRepository.findBySenderIdOrderByCreatedAtDesc(
                AdminAnnouncementService.ADMIN_SENDER_ID)) {
            Map<String, Object> h = new LinkedHashMap<>();
            h.put("id", m.getId());
            Room room = m.getRoom();
            h.put("roomId", room != null ? room.getId() : null);
            h.put("roomTitle", room != null ? room.getTitle() : null);
            h.put("content", m.getContent());
            h.put("createdAt", m.getCreatedAt() != null ? m.getCreatedAt().toString() : null);
            h.put("editedAt", m.getEditedAt() != null ? m.getEditedAt().toString() : null);
            history.add(h);
        }
        return history;
    }

    @PutMapping("/announcements/{id}")
    public ResponseEntity<?> updateAnnouncement(@PathVariable String id,
                                                @RequestBody Map<String, String> request) {
        String roomId = request.get("roomId");
        String content = request.get("content");
        if (roomId == null || roomId.isBlank() || content == null || content.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "채팅방과 공지 내용을 입력해 주세요."));
        }
        try {
            RoomMessage saved = announcementService.updateAnnouncement(id, roomId, content);
            return ResponseEntity.ok(Map.of("id", saved.getId(), "message", "수정되었습니다."));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @DeleteMapping("/announcements/{id}")
    public ResponseEntity<?> deleteAnnouncement(@PathVariable String id) {
        try {
            announcementService.deleteAnnouncement(id);
            return ResponseEntity.ok(Map.of("message", "삭제되었습니다."));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/global-announcements")
    public List<GlobalAnnouncement> globalAnnouncementHistory() {
        return globalAnnouncementService.findAll();
    }

    @PostMapping("/global-announcements")
    public ResponseEntity<?> createGlobalAnnouncement(@RequestBody Map<String, String> request) {
        String title = request.get("title");
        String content = request.get("content");
        if (title == null || title.isBlank() || content == null || content.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "제목과 내용을 입력해 주세요."));
        }
        LocalDateTime expiresAt;
        try {
            expiresAt = parseAnnouncementExpiry(request.get("expiresAt"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
        GlobalAnnouncement saved = globalAnnouncementService.create(title.strip(), content, expiresAt);
        return ResponseEntity.ok(Map.of("id", saved.getId(), "message", "전체 공지가 발송되었습니다."));
    }

    @PutMapping("/global-announcements/{id}")
    public ResponseEntity<?> updateGlobalAnnouncement(@PathVariable String id,
                                                      @RequestBody Map<String, String> request) {
        String title = request.get("title");
        String content = request.get("content");
        if (title == null || title.isBlank() || content == null || content.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "제목과 내용을 입력해 주세요."));
        }
        try {
            LocalDateTime expiresAt = parseAnnouncementExpiry(request.get("expiresAt"));
            GlobalAnnouncement saved = globalAnnouncementService.update(id, title.strip(), content, expiresAt);
            return ResponseEntity.ok(Map.of("id", saved.getId(), "message", "수정되었습니다."));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @DeleteMapping("/global-announcements/{id}")
    public ResponseEntity<?> deleteGlobalAnnouncement(@PathVariable String id) {
        try {
            globalAnnouncementService.delete(id);
            return ResponseEntity.ok(Map.of("message", "삭제되었습니다."));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    private LocalDateTime parseAnnouncementExpiry(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return LocalDateTime.parse(value);
        } catch (Exception e) {
            throw new IllegalArgumentException("게시 종료일 형식이 올바르지 않습니다.");
        }
    }

    private Map<String, Object> userSummary(User user, LocalDateTime now) {
        Map<String, Object> u = new LinkedHashMap<>();
        u.put("id", user.getId().toString());
        u.put("nickname", user.getNickname());
        u.put("nationality", user.getNationality().name());
        u.put("createdAt", user.getCreatedAt() != null ? user.getCreatedAt().toString() : null);
        u.put("isPremium", subscriptionRepository.hasActiveSubscription(user.getId().toString(), now));
        return u;
    }

    private Map<String, Object> agreementSummary(Agreement agreement) {
        Map<String, Object> a = new LinkedHashMap<>();
        a.put("id", agreement.getId().toString());
        a.put("title", agreement.getTitle());
        a.put("emoji", agreement.getEmoji());
        a.put("category", agreement.getCategory() != null ? agreement.getCategory().name() : null);
        a.put("status", agreement.getStatus().name());
        a.put("dateTime", agreement.getDateTime() != null ? agreement.getDateTime().toString() : null);
        a.put("scheduleType", agreement.getScheduleType().name());
        a.put("endDateTime", agreement.getEndDateTime() != null ? agreement.getEndDateTime().toString() : null);
        a.put("creatorNickname", agreement.getCreator() != null ? agreement.getCreator().getNickname() : null);
        a.put("createdAt", agreement.getCreatedAt() != null ? agreement.getCreatedAt().toString() : null);
        List<Map<String, String>> participants = new ArrayList<>();
        for (Participant p : agreement.getParticipants()) {
            Map<String, String> pm = new LinkedHashMap<>();
            pm.put("userName", p.getUserName());
            pm.put("status", p.getStatus() != null ? p.getStatus().name() : null);
            participants.add(pm);
        }
        a.put("participants", participants);
        return a;
    }
}
