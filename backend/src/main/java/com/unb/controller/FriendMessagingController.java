package com.unb.controller;

import com.unb.service.FriendMessagingService;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.time.Instant;
import java.util.HashMap;

@RestController
@RequestMapping("/api/v1")
public class FriendMessagingController {
    private final FriendMessagingService service;
    private final SimpMessagingTemplate messagingTemplate;

    public FriendMessagingController(FriendMessagingService service,
                                     SimpMessagingTemplate messagingTemplate) {
        this.service = service;
        this.messagingTemplate = messagingTemplate;
    }

    @PostMapping("/users/{userId}/heartbeat")
    public ResponseEntity<?> heartbeat(@PathVariable UUID userId) {
        service.heartbeat(userId);
        return ResponseEntity.ok(Map.of("online", true));
    }

    @GetMapping("/friends/{userId}")
    public List<Map<String, Object>> friends(@PathVariable UUID userId) { return service.friends(userId); }

    @GetMapping("/friends/{userId}/requests")
    public List<Map<String, Object>> requests(@PathVariable UUID userId) { return service.requests(userId); }

    @PostMapping("/friends/requests")
    public ResponseEntity<?> request(@RequestBody Map<String, String> body) {
        try {
            Map<String, Object> friendship = service.requestFriend(
                UUID.fromString(body.get("requesterId")), UUID.fromString(body.get("addresseeId")));
            broadcastChange("FRIENDS", null);
            return ResponseEntity.ok(friendship);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PutMapping("/friends/requests/{id}")
    public ResponseEntity<?> respond(@PathVariable UUID id, @RequestBody Map<String, Object> body) {
        try {
            Map<String, Object> friendship = service.respond(id,
                UUID.fromString(String.valueOf(body.get("userId"))),
                Boolean.parseBoolean(String.valueOf(body.get("accept"))));
            broadcastChange("FRIENDS", null);
            return ResponseEntity.ok(friendship);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @DeleteMapping("/friends/{id}")
    public ResponseEntity<?> remove(@PathVariable UUID id, @RequestParam UUID userId) {
        try {
            service.remove(id, userId);
            broadcastChange("FRIENDS", null);
            return ResponseEntity.ok(Map.of("message", "친구 관계가 삭제되었습니다."));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/direct-messages/{userId}/{friendId}")
    public ResponseEntity<?> conversation(@PathVariable UUID userId, @PathVariable UUID friendId,
                                          @RequestParam(defaultValue = "100") int limit) {
        try {
            return ResponseEntity.ok(service.conversation(userId, friendId, limit));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/direct-messages")
    public ResponseEntity<?> send(@RequestBody Map<String, String> body) {
        try {
            UUID senderId = UUID.fromString(body.get("senderId"));
            UUID recipientId = UUID.fromString(body.get("recipientId"));
            Map<String, Object> message = service.send(senderId, recipientId, body.get("content"));
            messagingTemplate.convertAndSend(conversationTopic(senderId, recipientId), message);
            return ResponseEntity.ok(message);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    private String conversationTopic(UUID a, UUID b) {
        UUID first = a.toString().compareTo(b.toString()) < 0 ? a : b;
        UUID second = first.equals(a) ? b : a;
        return "/topic/direct-messages/" + first + "/" + second;
    }

    private void broadcastChange(String type, String roomId) {
        Map<String, Object> event = new HashMap<>();
        event.put("type", type);
        if (roomId != null) event.put("roomId", roomId);
        event.put("occurredAt", Instant.now().toString());
        messagingTemplate.convertAndSend("/topic/app-events", event);
    }
}
