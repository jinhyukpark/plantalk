package com.unb.service;

import com.unb.dto.CreateRoomRequest;
import com.unb.dto.JoinRoomRequest;
import com.unb.dto.InviteRoomParticipantRequest;
import com.unb.dto.SendMessageRequest;
import com.unb.entity.Room;
import com.unb.entity.Room.RoomVisibility;
import com.unb.entity.Room.RoomStatus;
import com.unb.entity.RoomMessage;
import com.unb.entity.RoomMessage.MessageType;
import com.unb.entity.RoomParticipant;
import com.unb.entity.Friendship;
import com.unb.entity.User;
import com.unb.entity.RoomParticipant.ParticipantRole;
import com.unb.entity.RoomParticipant.ParticipantStatus;
import com.unb.repository.RoomMessageRepository;
import com.unb.repository.RoomParticipantRepository;
import com.unb.repository.RoomRepository;
import com.unb.repository.FriendshipRepository;
import com.unb.repository.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class RoomService {
    
    private final RoomRepository roomRepository;
    private final RoomParticipantRepository participantRepository;
    private final RoomMessageRepository messageRepository;
    private final FriendshipRepository friendshipRepository;
    private final UserRepository userRepository;
    
    public RoomService(RoomRepository roomRepository, 
                       RoomParticipantRepository participantRepository,
                       RoomMessageRepository messageRepository,
                       FriendshipRepository friendshipRepository,
                       UserRepository userRepository) {
        this.roomRepository = roomRepository;
        this.participantRepository = participantRepository;
        this.messageRepository = messageRepository;
        this.friendshipRepository = friendshipRepository;
        this.userRepository = userRepository;
    }
    
    @Transactional
    public Room createRoom(CreateRoomRequest request) {
        Room room = new Room();
        room.setTitle(request.getTitle());
        room.setDescription(request.getDescription());
        room.setCategory(request.getCategory());
        room.setEmoji(request.getEmoji() != null ? request.getEmoji() : "🎉");
        room.setVisibility(request.getVisibility() != null ? 
            RoomVisibility.valueOf(request.getVisibility().toUpperCase()) : RoomVisibility.PUBLIC);
        room.setCreatorId(request.getCreatorId());
        room.setCreatorName(request.getCreatorName());
        room.setLatitude(request.getLatitude());
        room.setLongitude(request.getLongitude());
        room.setLocationName(request.getLocationName());
        room.setStartsAt(request.getStartsAt());
        room.setEndsAt(request.getEndsAt());
        int maxParticipants = request.getMaxParticipants() != null ? request.getMaxParticipants() : 5;
        room.setMaxParticipants(Math.max(1, Math.min(maxParticipants, 10)));
        room.setCurrentParticipants(1);
        
        Room savedRoom = roomRepository.save(room);
        
        RoomParticipant owner = new RoomParticipant();
        owner.setRoom(savedRoom);
        owner.setUserId(request.getCreatorId());
        owner.setUserName(request.getCreatorName());
        owner.setRole(ParticipantRole.OWNER);
        owner.setStatus(ParticipantStatus.JOINED);
        participantRepository.save(owner);
        
        return savedRoom;
    }
    
    public List<Room> getPublicRooms() {
        return roomRepository.findByVisibilityAndStatusOrderByCreatedAtDesc(
            RoomVisibility.PUBLIC, RoomStatus.ACTIVE);
    }
    
    public List<Room> getPublicRoomsByCategory(String category) {
        return roomRepository.findByCategoryAndVisibilityAndStatusOrderByCreatedAtDesc(
            category, RoomVisibility.PUBLIC, RoomStatus.ACTIVE);
    }

    public List<Room> getVisibleRooms(String userId, String category, String visibility) {
        RoomVisibility requestedVisibility = parseVisibilityFilter(visibility);
        return roomRepository.findByStatusOrderByCreatedAtDesc(RoomStatus.ACTIVE).stream()
            .filter(room -> category == null || category.isBlank() || category.equals(room.getCategory()))
            .filter(room -> requestedVisibility == null || room.getVisibility() == requestedVisibility)
            .filter(room -> room.getVisibility() == RoomVisibility.PUBLIC || canAccessPrivateRoom(room, userId))
            .collect(Collectors.toList());
    }

    public Map<String, Long> getVisibleRoomCountsByCategory(String userId, String visibility) {
        List<Room> rooms = getVisibleRooms(userId, null, visibility);
        Map<String, Long> counts = new HashMap<>();
        counts.put("total", (long) rooms.size());
        for (Room room : rooms) {
            counts.put(room.getCategory(), counts.getOrDefault(room.getCategory(), 0L) + 1);
        }
        return counts;
    }

    private RoomVisibility parseVisibilityFilter(String visibility) {
        if (visibility == null || visibility.isBlank() || "ALL".equalsIgnoreCase(visibility)) {
            return null;
        }
        try {
            return RoomVisibility.valueOf(visibility.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new RuntimeException("Invalid room visibility filter");
        }
    }

    private boolean canAccessPrivateRoom(Room room, String userId) {
        if (userId == null || userId.isBlank()) {
            return false;
        }
        if (userId.equals(room.getCreatorId())) {
            return true;
        }
        return participantRepository.findByRoomIdAndUserId(room.getId(), userId)
            .map(participant -> participant.getStatus() == ParticipantStatus.JOINED
                || participant.getStatus() == ParticipantStatus.INVITED)
            .orElse(false);
    }
    
    public Map<String, Long> getRoomCountsByCategory() {
        List<Room> rooms = getPublicRooms();
        Map<String, Long> counts = new HashMap<>();
        counts.put("total", (long) rooms.size());
        for (Room room : rooms) {
            String cat = room.getCategory();
            counts.put(cat, counts.getOrDefault(cat, 0L) + 1);
        }
        return counts;
    }
    
    public List<Room> getNearbyRooms(double latitude, double longitude, double radiusKm) {
        return roomRepository.findAllPublicRoomsWithLocation();
    }
    
    public List<Room> getUserCreatedRooms(String userId) {
        return roomRepository.findByCreatorIdOrderByCreatedAtDesc(userId);
    }
    
    public List<RoomParticipant> getUserJoinedRooms(String userId) {
        return participantRepository.findUserJoinedRooms(userId);
    }
    
    public Optional<Room> getRoomById(String roomId) {
        return roomRepository.findById(roomId);
    }

    public Optional<Room> getRoomByIdForUser(String roomId, String userId) {
        return roomRepository.findById(roomId)
            .filter(room -> room.getVisibility() == RoomVisibility.PUBLIC || canAccessPrivateRoom(room, userId));
    }

    public void requireRoomAccess(String roomId, String userId) {
        Room room = roomRepository.findById(roomId)
            .orElseThrow(() -> new RuntimeException("Room not found"));
        if (room.getVisibility() == RoomVisibility.PRIVATE && !canAccessPrivateRoom(room, userId)) {
            throw new RuntimeException("This private room is available to invited participants only");
        }
    }
    
    @Transactional
    public RoomParticipant joinRoom(String roomId, JoinRoomRequest request) {
        Room room = roomRepository.findById(roomId)
            .orElseThrow(() -> new RuntimeException("Room not found"));
        
        Optional<RoomParticipant> existing = participantRepository.findByRoomIdAndUserId(roomId, request.getUserId());
        if (existing.isPresent()) {
            RoomParticipant participant = existing.get();
            if (participant.getStatus() == ParticipantStatus.JOINED) {
                return participant;
            }
            if (participant.getStatus() == ParticipantStatus.BANNED) {
                throw new RuntimeException("You cannot join this room");
            }
            if (room.getMaxParticipants() != null && room.getCurrentParticipants() >= room.getMaxParticipants()) {
                throw new RuntimeException("Room is full");
            }
            participant.setStatus(ParticipantStatus.JOINED);
            participant.setJoinedAt(LocalDateTime.now());
            participant.setLeftAt(null);
            room.setCurrentParticipants(room.getCurrentParticipants() + 1);
            roomRepository.save(room);
            return participantRepository.save(participant);
        }

        if (room.getVisibility() == RoomVisibility.PRIVATE) {
            throw new RuntimeException("This private room is available to invited participants only");
        }
        
        if (room.getMaxParticipants() != null && room.getCurrentParticipants() >= room.getMaxParticipants()) {
            throw new RuntimeException("Room is full");
        }
        
        RoomParticipant participant = new RoomParticipant();
        participant.setRoom(room);
        participant.setUserId(request.getUserId());
        participant.setUserName(request.getUserName());
        participant.setRole(ParticipantRole.MEMBER);
        participant.setStatus(ParticipantStatus.JOINED);
        
        room.setCurrentParticipants(room.getCurrentParticipants() + 1);
        roomRepository.save(room);
        
        return participantRepository.save(participant);
    }
    
    @Transactional
    public void leaveRoom(String roomId, String userId) {
        Room room = roomRepository.findById(roomId)
            .orElseThrow(() -> new RuntimeException("Room not found"));
        
        RoomParticipant participant = participantRepository.findByRoomIdAndUserId(roomId, userId)
            .orElseThrow(() -> new RuntimeException("Participant not found"));
        
        participant.setStatus(ParticipantStatus.LEFT);
        participant.setLeftAt(LocalDateTime.now());
        participantRepository.save(participant);
        
        room.setCurrentParticipants(Math.max(0, room.getCurrentParticipants() - 1));
        roomRepository.save(room);
    }
    
    public List<RoomParticipant> getRoomParticipants(String roomId) {
        return participantRepository.findByRoomIdAndStatus(roomId, ParticipantStatus.JOINED);
    }

    @Transactional
    public RoomParticipant inviteFriend(String roomId, InviteRoomParticipantRequest request) {
        Room room = roomRepository.findById(roomId)
            .orElseThrow(() -> new RuntimeException("Room not found"));
        if (request.getRequesterId() == null || !room.getCreatorId().equals(request.getRequesterId())) {
            throw new RuntimeException("방장만 친구를 초대할 수 있습니다.");
        }
        if (request.getFriendId() == null || request.getFriendId().equals(request.getRequesterId())) {
            throw new RuntimeException("초대할 친구를 확인해 주세요.");
        }

        UUID requesterId = parseUserId(request.getRequesterId());
        UUID friendId = parseUserId(request.getFriendId());
        requireAcceptedFriendship(requesterId, friendId);
        User friend = userRepository.findById(friendId)
            .orElseThrow(() -> new RuntimeException("친구 정보를 찾을 수 없습니다."));

        Optional<RoomParticipant> existing = participantRepository
            .findByRoomIdAndUserId(roomId, friendId.toString());
        if (existing.isPresent() && existing.get().getStatus() == ParticipantStatus.JOINED) {
            throw new RuntimeException("이미 참여 중인 친구입니다.");
        }
        if (room.getMaxParticipants() != null
                && participantRepository.countActiveParticipants(roomId) >= room.getMaxParticipants()) {
            throw new RuntimeException("참여 인원이 가득 찼습니다.");
        }

        RoomParticipant participant = existing.orElseGet(RoomParticipant::new);
        participant.setRoom(room);
        participant.setUserId(friendId.toString());
        participant.setUserName(friend.getNickname());
        participant.setRole(ParticipantRole.MEMBER);
        participant.setStatus(ParticipantStatus.JOINED);
        participant.setJoinedAt(LocalDateTime.now());
        participant.setLeftAt(null);

        long joinedCount = participantRepository.countActiveParticipants(roomId);
        room.setCurrentParticipants((int) joinedCount + 1);
        roomRepository.save(room);
        return participantRepository.save(participant);
    }

    private UUID parseUserId(String id) {
        try {
            return UUID.fromString(id);
        } catch (IllegalArgumentException e) {
            throw new RuntimeException("사용자 정보가 올바르지 않습니다.");
        }
    }

    private void requireAcceptedFriendship(UUID requesterId, UUID friendId) {
        UUID one = requesterId.toString().compareTo(friendId.toString()) < 0 ? requesterId : friendId;
        UUID two = one.equals(requesterId) ? friendId : requesterId;
        Friendship friendship = friendshipRepository.findByUserOneIdAndUserTwoId(one, two)
            .orElseThrow(() -> new RuntimeException("친구만 초대할 수 있습니다."));
        if (friendship.getStatus() != Friendship.Status.ACCEPTED) {
            throw new RuntimeException("친구만 초대할 수 있습니다.");
        }
    }
    
    @Transactional
    public RoomMessage sendMessage(String roomId, SendMessageRequest request) {
        Room room = roomRepository.findById(roomId)
            .orElseThrow(() -> new RuntimeException("Room not found"));

        boolean isCreator = room.getCreatorId().equals(request.getSenderId());
        boolean isJoined = participantRepository.findByRoomIdAndUserId(roomId, request.getSenderId())
            .map(participant -> participant.getStatus() == ParticipantStatus.JOINED)
            .orElse(false);
        if (!isCreator && !isJoined) {
            throw new RuntimeException("Only joined participants can send messages");
        }
        
        RoomMessage message = new RoomMessage();
        message.setRoom(room);
        message.setSenderId(request.getSenderId());
        message.setSenderName(request.getSenderName());
        message.setContent(request.getContent());
        message.setAttachmentUrl(request.getAttachmentUrl());
        message.setMessageType(request.getMessageType() != null ? 
            MessageType.valueOf(request.getMessageType().toUpperCase()) : MessageType.TEXT);
        
        return messageRepository.save(message);
    }
    
    public List<RoomMessage> getRoomMessages(String roomId, int limit) {
        return messageRepository.findByRoomIdOrderByCreatedAtDesc(roomId, PageRequest.of(0, limit));
    }
    
    public List<RoomMessage> getMessagesAfter(String roomId, LocalDateTime after) {
        return messageRepository.findByRoomIdAfter(roomId, after);
    }

    public List<RoomMessage> getMessagesBefore(String roomId, LocalDateTime before, int limit) {
        return messageRepository.findByRoomIdBefore(roomId, before, PageRequest.of(0, limit));
    }

    public List<RoomMessage> getOwnerAnnouncements(String roomId, String userId) {
        Room room = requireRoomOwner(roomId, userId);
        return messageRepository.findByRoomIdOrderByCreatedAtAsc(room.getId()).stream()
            .filter(message -> userId.equals(message.getSenderId()) && isOwnerAnnouncement(message))
            .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
            .toList();
    }

    @Transactional
    public RoomMessage updateOwnerAnnouncement(String roomId, String messageId, String userId, String content) {
        requireRoomOwner(roomId, userId);
        RoomMessage message = requireOwnerAnnouncement(roomId, messageId, userId);
        if (content == null || content.trim().isEmpty()) {
            throw new RuntimeException("Announcement content is required");
        }
        message.setContent("📢 공지사항\n" + content.trim());
        message.setEditedAt(LocalDateTime.now());
        return messageRepository.save(message);
    }

    @Transactional
    public void deleteOwnerAnnouncement(String roomId, String messageId, String userId) {
        requireRoomOwner(roomId, userId);
        RoomMessage message = requireOwnerAnnouncement(roomId, messageId, userId);
        messageRepository.delete(message);
    }

    private Room requireRoomOwner(String roomId, String userId) {
        Room room = roomRepository.findById(roomId)
            .orElseThrow(() -> new RuntimeException("Room not found"));
        if (userId == null || !room.getCreatorId().equals(userId)) {
            throw new RuntimeException("Only the creator can manage announcements");
        }
        return room;
    }

    private RoomMessage requireOwnerAnnouncement(String roomId, String messageId, String userId) {
        RoomMessage message = messageRepository.findById(messageId)
            .orElseThrow(() -> new RuntimeException("Announcement not found"));
        if (!roomId.equals(message.getRoomId())
                || !userId.equals(message.getSenderId())
                || !isOwnerAnnouncement(message)) {
            throw new RuntimeException("Announcement cannot be managed by this user");
        }
        return message;
    }

    private boolean isOwnerAnnouncement(RoomMessage message) {
        return message.getMessageType() == MessageType.SYSTEM
            && message.getContent() != null
            && message.getContent().trim().startsWith("📢 공지사항");
    }
    
    @Transactional
    public Room closeRoom(String roomId, String userId) {
        Room room = roomRepository.findById(roomId)
            .orElseThrow(() -> new RuntimeException("Room not found"));
        
        if (!room.getCreatorId().equals(userId)) {
            throw new RuntimeException("Only the creator can close the room");
        }
        
        room.setStatus(RoomStatus.CLOSED);
        return roomRepository.save(room);
    }
}
