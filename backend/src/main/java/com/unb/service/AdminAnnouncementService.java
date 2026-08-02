package com.unb.service;

import com.unb.controller.ChatWebSocketController.ChatMessageDTO;
import com.unb.dto.SendMessageRequest;
import com.unb.entity.Notification.NotificationType;
import com.unb.entity.Room;
import com.unb.entity.RoomMessage;
import com.unb.entity.RoomParticipant;
import com.unb.repository.RoomRepository;
import com.unb.repository.RoomMessageRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.time.LocalDateTime;

@Service
public class AdminAnnouncementService {

    public static final String ADMIN_SENDER_ID = "admin";
    public static final String ADMIN_SENDER_NAME = "관리자";

    private final RoomService roomService;
    private final RoomRepository roomRepository;
    private final RoomMessageRepository messageRepository;
    private final NotificationService notificationService;
    private final SimpMessagingTemplate messagingTemplate;

    public AdminAnnouncementService(RoomService roomService,
                                    RoomRepository roomRepository,
                                    RoomMessageRepository messageRepository,
                                    NotificationService notificationService,
                                    SimpMessagingTemplate messagingTemplate) {
        this.roomService = roomService;
        this.roomRepository = roomRepository;
        this.messageRepository = messageRepository;
        this.notificationService = notificationService;
        this.messagingTemplate = messagingTemplate;
    }

    @Transactional
    public Map<String, Object> sendAnnouncement(String roomId, String content) {
        List<Room> targetRooms;
        if (roomId == null || roomId.isBlank() || "ALL".equalsIgnoreCase(roomId)) {
            targetRooms = roomRepository.findByStatusOrderByCreatedAtDesc(Room.RoomStatus.ACTIVE);
        } else {
            Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("채팅방을 찾을 수 없습니다: " + roomId));
            targetRooms = List.of(room);
        }

        Set<String> notifiedUserIds = new HashSet<>();
        List<String> roomTitles = new ArrayList<>();

        for (Room room : targetRooms) {
            SendMessageRequest request = new SendMessageRequest();
            request.setSenderId(ADMIN_SENDER_ID);
            request.setSenderName(ADMIN_SENDER_NAME);
            request.setContent(content);
            request.setMessageType("SYSTEM");

            RoomMessage saved = roomService.sendMessage(room.getId(), request);

            ChatMessageDTO dto = new ChatMessageDTO(
                saved.getId(),
                room.getId(),
                ADMIN_SENDER_ID,
                ADMIN_SENDER_NAME,
                content,
                "SYSTEM",
                null,
                saved.getCreatedAt().toString()
            );
            try {
                messagingTemplate.convertAndSend("/topic/rooms/" + room.getId(), dto);
            } catch (Exception e) {
                System.err.println("Failed to broadcast announcement to room " + room.getId() + ": " + e.getMessage());
            }

            String preview = content.length() > 80 ? content.substring(0, 80) + "..." : content;
            for (RoomParticipant participant : roomService.getRoomParticipants(room.getId())) {
                if (notifiedUserIds.add(participant.getUserId())) {
                    try {
                        notificationService.createNotification(
                            participant.getUserId(),
                            NotificationType.ROOM_ANNOUNCEMENT,
                            "📢 관리자 공지",
                            preview,
                            room.getId(),
                            "ROOM",
                            ADMIN_SENDER_NAME
                        );
                        notificationService.sendUnreadCountUpdate(participant.getUserId());
                    } catch (Exception e) {
                        System.err.println("Failed to notify user " + participant.getUserId() + ": " + e.getMessage());
                    }
                }
            }

            roomTitles.add(room.getTitle());
        }

        Map<String, Object> result = new HashMap<>();
        result.put("roomCount", targetRooms.size());
        result.put("notifiedUserCount", notifiedUserIds.size());
        result.put("roomTitles", roomTitles);
        return result;
    }

    @Transactional
    public RoomMessage updateAnnouncement(String messageId, String roomId, String content) {
        RoomMessage message = findAdminMessage(messageId);
        Room oldRoom = message.getRoom();
        Room targetRoom = roomRepository.findById(roomId)
            .orElseThrow(() -> new RuntimeException("채팅방을 찾을 수 없습니다."));

        if (!oldRoom.getId().equals(targetRoom.getId())) {
            broadcastDeletion(oldRoom.getId(), message);
            message.setRoom(targetRoom);
        }
        message.setContent(content);
        message.setEditedAt(LocalDateTime.now());
        RoomMessage saved = messageRepository.save(message);
        broadcastMessage(targetRoom.getId(), saved);
        return saved;
    }

    @Transactional
    public void deleteAnnouncement(String messageId) {
        RoomMessage message = findAdminMessage(messageId);
        String roomId = message.getRoom().getId();
        messageRepository.delete(message);
        broadcastDeletion(roomId, message);
    }

    private RoomMessage findAdminMessage(String messageId) {
        RoomMessage message = messageRepository.findById(messageId)
            .orElseThrow(() -> new RuntimeException("채팅방 공지를 찾을 수 없습니다."));
        if (!ADMIN_SENDER_ID.equals(message.getSenderId())) {
            throw new RuntimeException("관리자 공지만 수정할 수 있습니다.");
        }
        return message;
    }

    private void broadcastMessage(String roomId, RoomMessage message) {
        ChatMessageDTO dto = new ChatMessageDTO(
            message.getId(), roomId, ADMIN_SENDER_ID, ADMIN_SENDER_NAME,
            message.getContent(), "SYSTEM", null, message.getCreatedAt().toString()
        );
        dto.setEditedAt(message.getEditedAt() != null ? message.getEditedAt().toString() : null);
        messagingTemplate.convertAndSend("/topic/rooms/" + roomId, dto);
    }

    private void broadcastDeletion(String roomId, RoomMessage message) {
        ChatMessageDTO dto = new ChatMessageDTO(
            message.getId(), roomId, ADMIN_SENDER_ID, ADMIN_SENDER_NAME,
            message.getContent(), "SYSTEM", null, message.getCreatedAt().toString()
        );
        dto.setDeleted(true);
        messagingTemplate.convertAndSend("/topic/rooms/" + roomId, dto);
    }
}
