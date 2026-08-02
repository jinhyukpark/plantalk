package com.unb.service;

import com.unb.entity.Notification;
import com.unb.entity.Notification.NotificationType;
import com.unb.entity.User;
import com.unb.repository.NotificationRepository;
import com.unb.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class NotificationService {
    
    @Autowired
    private NotificationRepository notificationRepository;
    
    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private UserRepository userRepository;
    
    public List<Notification> getNotificationsByUserId(String userId) {
        return enrichSenderProfiles(notificationRepository.findTop50VisibleByUserId(userId));
    }
    
    public List<Notification> getUnreadNotifications(String userId) {
        return enrichSenderProfiles(notificationRepository.findVisibleUnreadByUserId(userId));
    }
    
    public long getUnreadCount(String userId) {
        return notificationRepository.countUnreadByUserId(userId);
    }
    
    @Transactional
    public void markAsRead(String notificationId) {
        notificationRepository.markAsRead(notificationId);
    }
    
    @Transactional
    public void markAllAsRead(String userId) {
        notificationRepository.markAllAsReadByUserId(userId);
    }
    
    @Transactional
    public Notification createNotification(String userId, NotificationType type, String title, 
            String message, String referenceId, String referenceType, String senderName) {
        return createNotification(userId, type, title, message, referenceId, referenceType, senderName, null);
    }

    @Transactional
    public Notification createNotification(String userId, NotificationType type, String title,
            String message, String referenceId, String referenceType, String senderName, String senderId) {
        Notification notification = new Notification();
        notification.setUserId(userId);
        notification.setType(type);
        notification.setTitle(title);
        notification.setMessage(message);
        notification.setReferenceId(referenceId);
        notification.setReferenceType(referenceType);
        notification.setSenderName(senderName);
        notification.setSenderId(senderId);
        
        Notification saved = notificationRepository.save(notification);
        
        sendRealTimeNotification(userId, saved);
        
        return saved;
    }
    
    public Notification createRoomMessageNotification(String userId, String roomId, String roomTitle,
            String senderId, String senderName, String message) {
        String title = roomTitle;
        String content = senderName + ": " + (message.length() > 50 ? message.substring(0, 50) + "..." : message);
        
        return createNotification(userId, NotificationType.ROOM_MESSAGE, title, content,
                roomId, "ROOM", senderName, senderId);
    }
    
    public Notification createAgreementNotification(String userId, NotificationType type, 
            String agreementId, String agreementTitle, String message, String senderName) {
        return createNotification(userId, type, agreementTitle, message, 
                agreementId, "AGREEMENT", senderName);
    }
    
    public void sendRealTimeNotification(String userId, Notification notification) {
        try {
            messagingTemplate.convertAndSend("/topic/notifications/" + userId, notification);
        } catch (Exception e) {
            System.err.println("Failed to send real-time notification: " + e.getMessage());
        }
    }
    
    public void sendUnreadCountUpdate(String userId) {
        try {
            long count = getUnreadCount(userId);
            messagingTemplate.convertAndSend("/topic/notifications/" + userId + "/count", count);
        } catch (Exception e) {
            System.err.println("Failed to send unread count update: " + e.getMessage());
        }
    }

    private List<Notification> enrichSenderProfiles(List<Notification> notifications) {
        for (Notification notification : notifications) {
            if (notification.getType() != NotificationType.ROOM_MESSAGE) {
                continue;
            }

            Optional<User> sender = Optional.empty();
            if (notification.getSenderId() != null && !notification.getSenderId().isBlank()) {
                try {
                    sender = userRepository.findById(UUID.fromString(notification.getSenderId()));
                } catch (IllegalArgumentException ignored) {
                    // Older data may not contain a UUID sender id.
                }
            }
            if (sender.isEmpty() && notification.getSenderName() != null) {
                sender = userRepository.findByNickname(notification.getSenderName());
            }
            sender.map(User::getProfilePictureUrl)
                .filter(url -> !url.isBlank())
                .ifPresent(notification::setSenderProfilePictureUrl);
        }
        return notifications;
    }
}
