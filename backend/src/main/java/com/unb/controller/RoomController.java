package com.unb.controller;

import com.unb.dto.CreateRoomRequest;
import com.unb.dto.JoinRoomRequest;
import com.unb.dto.InviteRoomParticipantRequest;
import com.unb.dto.SendMessageRequest;
import com.unb.entity.Room;
import com.unb.entity.RoomMessage;
import com.unb.entity.RoomParticipant;
import com.unb.service.RoomService;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/rooms")
public class RoomController {
    
    private final RoomService roomService;
    private final SimpMessagingTemplate messagingTemplate;
    
    public RoomController(RoomService roomService, SimpMessagingTemplate messagingTemplate) {
        this.roomService = roomService;
        this.messagingTemplate = messagingTemplate;
    }
    
    @PostMapping
    public ResponseEntity<Room> createRoom(@RequestBody CreateRoomRequest request) {
        Room room = roomService.createRoom(request);
        broadcastChange("ROOM_LIST", room.getId());
        return ResponseEntity.ok(room);
    }
    
    @GetMapping
    public ResponseEntity<List<Room>> getPublicRooms(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String userId,
            @RequestParam(defaultValue = "ALL") String visibility) {
        return ResponseEntity.ok(roomService.getVisibleRooms(userId, category, visibility));
    }
    
    @GetMapping("/counts")
    public ResponseEntity<Map<String, Long>> getRoomCounts(
            @RequestParam(required = false) String userId,
            @RequestParam(defaultValue = "ALL") String visibility) {
        return ResponseEntity.ok(roomService.getVisibleRoomCountsByCategory(userId, visibility));
    }
    
    @GetMapping("/nearby")
    public ResponseEntity<List<Room>> getNearbyRooms(
            @RequestParam double latitude,
            @RequestParam double longitude,
            @RequestParam(defaultValue = "10") double radius) {
        List<Room> rooms = roomService.getNearbyRooms(latitude, longitude, radius);
        return ResponseEntity.ok(rooms);
    }
    
    @GetMapping("/user/{userId}")
    public ResponseEntity<Map<String, Object>> getUserRooms(@PathVariable String userId) {
        List<Room> created = roomService.getUserCreatedRooms(userId);
        List<RoomParticipant> joined = roomService.getUserJoinedRooms(userId);
        
        Map<String, Object> result = new HashMap<>();
        result.put("created", created);
        result.put("joined", joined);
        return ResponseEntity.ok(result);
    }
    
    @GetMapping("/{roomId}")
    public ResponseEntity<Room> getRoomById(
            @PathVariable String roomId,
            @RequestParam(required = false) String userId) {
        return roomService.getRoomByIdForUser(roomId, userId)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }
    
    @PostMapping("/{roomId}/join")
    public ResponseEntity<RoomParticipant> joinRoom(
            @PathVariable String roomId,
            @RequestBody JoinRoomRequest request) {
        try {
            RoomParticipant participant = roomService.joinRoom(roomId, request);
            broadcastChange("ROOM_MEMBERS", roomId);
            return ResponseEntity.ok(participant);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }
    
    @PostMapping("/{roomId}/leave")
    public ResponseEntity<Void> leaveRoom(
            @PathVariable String roomId,
            @RequestParam String userId) {
        try {
            roomService.leaveRoom(roomId, userId);
            broadcastChange("ROOM_MEMBERS", roomId);
            return ResponseEntity.ok().build();
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }
    
    @GetMapping("/{roomId}/participants")
    public ResponseEntity<?> getRoomParticipants(
            @PathVariable String roomId,
            @RequestParam(required = false) String userId) {
        try {
            roomService.requireRoomAccess(roomId, userId);
            return ResponseEntity.ok(roomService.getRoomParticipants(roomId));
        } catch (RuntimeException e) {
            return ResponseEntity.status(403).body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/{roomId}/participants/invite")
    public ResponseEntity<?> inviteRoomParticipant(
            @PathVariable String roomId,
            @RequestBody InviteRoomParticipantRequest request) {
        try {
            RoomParticipant participant = roomService.inviteFriend(roomId, request);
            broadcastChange("ROOM_MEMBERS", roomId);
            return ResponseEntity.ok(participant);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
    
    @PostMapping("/{roomId}/messages")
    public ResponseEntity<RoomMessage> sendMessage(
            @PathVariable String roomId,
            @RequestBody SendMessageRequest request) {
        try {
            RoomMessage message = roomService.sendMessage(roomId, request);
            return ResponseEntity.ok(message);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }
    
    @GetMapping("/{roomId}/messages")
    public ResponseEntity<List<RoomMessage>> getRoomMessages(
            @PathVariable String roomId,
            @RequestParam(defaultValue = "50") int limit,
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String after,
            @RequestParam(required = false) String before) {
        roomService.requireRoomAccess(roomId, userId);
        List<RoomMessage> messages;
        if (before != null) {
            LocalDateTime beforeTime = LocalDateTime.parse(before);
            messages = roomService.getMessagesBefore(roomId, beforeTime, limit);
        } else if (after != null) {
            LocalDateTime afterTime = LocalDateTime.parse(after);
            messages = roomService.getMessagesAfter(roomId, afterTime);
        } else {
            messages = roomService.getRoomMessages(roomId, limit);
        }
        return ResponseEntity.ok(messages);
    }

    @GetMapping("/{roomId}/announcements")
    public ResponseEntity<?> getOwnerAnnouncements(
            @PathVariable String roomId,
            @RequestParam String userId) {
        try {
            return ResponseEntity.ok(roomService.getOwnerAnnouncements(roomId, userId));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PutMapping("/{roomId}/announcements/{messageId}")
    public ResponseEntity<?> updateOwnerAnnouncement(
            @PathVariable String roomId,
            @PathVariable String messageId,
            @RequestParam String userId,
            @RequestBody Map<String, String> body) {
        try {
            RoomMessage message = roomService.updateOwnerAnnouncement(
                roomId, messageId, userId, body.get("content"));
            broadcastChange("ROOM_MESSAGES", roomId);
            return ResponseEntity.ok(message);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @DeleteMapping("/{roomId}/announcements/{messageId}")
    public ResponseEntity<?> deleteOwnerAnnouncement(
            @PathVariable String roomId,
            @PathVariable String messageId,
            @RequestParam String userId) {
        try {
            roomService.deleteOwnerAnnouncement(roomId, messageId, userId);
            broadcastChange("ROOM_MESSAGES", roomId);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
    
    @PostMapping("/{roomId}/close")
    public ResponseEntity<Room> closeRoom(
            @PathVariable String roomId,
            @RequestParam String userId) {
        try {
            Room room = roomService.closeRoom(roomId, userId);
            broadcastChange("ROOM_LIST", roomId);
            return ResponseEntity.ok(room);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    private void broadcastChange(String type, String roomId) {
        Map<String, Object> event = new HashMap<>();
        event.put("type", type);
        event.put("roomId", roomId);
        event.put("occurredAt", Instant.now().toString());
        messagingTemplate.convertAndSend("/topic/app-events", event);
        if ("ROOM_MEMBERS".equals(type)) {
            messagingTemplate.convertAndSend(
                "/topic/rooms/" + roomId + "/members",
                Map.of("type", "REFRESH", "roomId", roomId)
            );
        }
    }
}
