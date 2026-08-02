package com.unb.controller;

import com.unb.dto.SendMessageRequest;
import com.unb.entity.Room;
import com.unb.entity.RoomMessage;
import com.unb.entity.RoomParticipant;
import com.unb.service.NotificationService;
import com.unb.service.RoomService;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.util.List;

@Controller
public class ChatWebSocketController {
    
    private final RoomService roomService;
    private final SimpMessagingTemplate messagingTemplate;
    private final NotificationService notificationService;
    
    public ChatWebSocketController(RoomService roomService, SimpMessagingTemplate messagingTemplate,
                                   NotificationService notificationService) {
        this.roomService = roomService;
        this.messagingTemplate = messagingTemplate;
        this.notificationService = notificationService;
    }
    
    @MessageMapping("/rooms/{roomId}/message")
    @SendTo("/topic/rooms/{roomId}")
    public ChatMessageDTO sendMessage(@DestinationVariable String roomId, SendMessageRequest request) {
        RoomMessage message = roomService.sendMessage(roomId, request);
        
        sendNotificationsToParticipants(roomId, request.getSenderId(), request.getSenderName(), request.getContent());
        
        return new ChatMessageDTO(
            message.getId(),
            message.getRoomId(),
            message.getSenderId(),
            message.getSenderName(),
            message.getContent(),
            message.getMessageType().name(),
            message.getAttachmentUrl(),
            message.getCreatedAt().toString()
        );
    }
    
    private void sendNotificationsToParticipants(String roomId, String senderId, String senderName, String content) {
        try {
            Room room = roomService.getRoomById(roomId).orElse(null);
            if (room == null) return;
            
            List<RoomParticipant> participants = roomService.getRoomParticipants(roomId);
            for (RoomParticipant participant : participants) {
                if (!participant.getUserId().equals(senderId)) {
                    notificationService.createRoomMessageNotification(
                        participant.getUserId(),
                        roomId,
                        room.getTitle(),
                        senderId,
                        senderName,
                        content
                    );
                }
            }
        } catch (Exception e) {
            System.err.println("Failed to send notifications: " + e.getMessage());
        }
    }
    
    @MessageMapping("/rooms/{roomId}/join")
    public void notifyJoin(@DestinationVariable String roomId, JoinNotification notification) {
        messagingTemplate.convertAndSend("/topic/rooms/" + roomId + "/members", notification);
    }
    
    @MessageMapping("/rooms/{roomId}/leave")
    public void notifyLeave(@DestinationVariable String roomId, LeaveNotification notification) {
        messagingTemplate.convertAndSend("/topic/rooms/" + roomId + "/members", notification);
    }
    
    public static class ChatMessageDTO {
        private String id;
        private String roomId;
        private String senderId;
        private String senderName;
        private String content;
        private String messageType;
        private String attachmentUrl;
        private String createdAt;
        private String editedAt;
        private boolean deleted;
        
        public ChatMessageDTO(String id, String roomId, String senderId, String senderName, 
                              String content, String messageType, String attachmentUrl, String createdAt) {
            this.id = id;
            this.roomId = roomId;
            this.senderId = senderId;
            this.senderName = senderName;
            this.content = content;
            this.messageType = messageType;
            this.attachmentUrl = attachmentUrl;
            this.createdAt = createdAt;
        }
        
        public String getId() { return id; }
        public String getRoomId() { return roomId; }
        public String getSenderId() { return senderId; }
        public String getSenderName() { return senderName; }
        public String getContent() { return content; }
        public String getMessageType() { return messageType; }
        public String getAttachmentUrl() { return attachmentUrl; }
        public String getCreatedAt() { return createdAt; }
        public String getEditedAt() { return editedAt; }
        public void setEditedAt(String editedAt) { this.editedAt = editedAt; }
        public boolean isDeleted() { return deleted; }
        public void setDeleted(boolean deleted) { this.deleted = deleted; }
    }
    
    public static class JoinNotification {
        private String userId;
        private String userName;
        private String type = "JOIN";
        
        public String getUserId() { return userId; }
        public void setUserId(String userId) { this.userId = userId; }
        public String getUserName() { return userName; }
        public void setUserName(String userName) { this.userName = userName; }
        public String getType() { return type; }
    }
    
    public static class LeaveNotification {
        private String userId;
        private String userName;
        private String type = "LEAVE";
        
        public String getUserId() { return userId; }
        public void setUserId(String userId) { this.userId = userId; }
        public String getUserName() { return userName; }
        public void setUserName(String userName) { this.userName = userName; }
        public String getType() { return type; }
    }
}
