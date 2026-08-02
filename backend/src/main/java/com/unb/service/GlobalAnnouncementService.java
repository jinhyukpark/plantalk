package com.unb.service;

import com.unb.entity.GlobalAnnouncement;
import com.unb.entity.Notification;
import com.unb.entity.Notification.NotificationType;
import com.unb.entity.User;
import com.unb.repository.GlobalAnnouncementRepository;
import com.unb.repository.NotificationRepository;
import com.unb.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class GlobalAnnouncementService {

    public static final String REFERENCE_TYPE = "GLOBAL_ANNOUNCEMENT";
    private final GlobalAnnouncementRepository announcementRepository;
    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    public GlobalAnnouncementService(GlobalAnnouncementRepository announcementRepository,
                                     NotificationRepository notificationRepository,
                                     UserRepository userRepository,
                                     NotificationService notificationService) {
        this.announcementRepository = announcementRepository;
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
    }

    public List<GlobalAnnouncement> findAll() {
        return announcementRepository.findAllByOrderByCreatedAtDesc();
    }

    @Transactional
    public GlobalAnnouncement create(String title, String content, LocalDateTime expiresAt) {
        GlobalAnnouncement announcement = new GlobalAnnouncement();
        announcement.setTitle(title);
        announcement.setContent(content);
        announcement.setExpiresAt(expiresAt);
        GlobalAnnouncement saved = announcementRepository.save(announcement);

        for (User user : userRepository.findAll()) {
            notificationService.createNotification(
                user.getId().toString(),
                NotificationType.GLOBAL_ANNOUNCEMENT,
                title,
                content,
                saved.getId(),
                REFERENCE_TYPE,
                AdminAnnouncementService.ADMIN_SENDER_NAME
            );
            notificationService.sendUnreadCountUpdate(user.getId().toString());
        }
        return saved;
    }

    @Transactional
    public GlobalAnnouncement update(String id, String title, String content, LocalDateTime expiresAt) {
        GlobalAnnouncement announcement = announcementRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("전체 공지를 찾을 수 없습니다."));
        announcement.setTitle(title);
        announcement.setContent(content);
        announcement.setExpiresAt(expiresAt);
        announcement.setUpdatedAt(LocalDateTime.now());
        GlobalAnnouncement saved = announcementRepository.save(announcement);

        for (Notification notification :
                notificationRepository.findByReferenceTypeAndReferenceId(REFERENCE_TYPE, id)) {
            notification.setTitle(title);
            notification.setMessage(content);
            Notification updated = notificationRepository.save(notification);
            notificationService.sendRealTimeNotification(updated.getUserId(), updated);
        }
        return saved;
    }

    @Transactional
    public void delete(String id) {
        if (!announcementRepository.existsById(id)) {
            throw new RuntimeException("전체 공지를 찾을 수 없습니다.");
        }
        List<String> affectedUsers = notificationRepository
            .findByReferenceTypeAndReferenceId(REFERENCE_TYPE, id)
            .stream().map(Notification::getUserId).distinct().toList();
        notificationRepository.deleteByReference(REFERENCE_TYPE, id);
        announcementRepository.deleteById(id);
        affectedUsers.forEach(notificationService::sendUnreadCountUpdate);
    }
}
