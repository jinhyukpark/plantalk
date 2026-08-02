package com.unb.service;

import com.unb.entity.DirectMessage;
import com.unb.entity.Friendship;
import com.unb.entity.User;
import com.unb.repository.DirectMessageRepository;
import com.unb.repository.FriendshipRepository;
import com.unb.repository.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class FriendMessagingService {
    private static final int ONLINE_SECONDS = 120;
    private final FriendshipRepository friendshipRepository;
    private final DirectMessageRepository messageRepository;
    private final UserRepository userRepository;

    public FriendMessagingService(FriendshipRepository friendshipRepository,
                                  DirectMessageRepository messageRepository,
                                  UserRepository userRepository) {
        this.friendshipRepository = friendshipRepository;
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public void heartbeat(UUID userId) {
        User user = requireUser(userId);
        user.setLastActiveAt(LocalDateTime.now());
        userRepository.save(user);
    }

    @Transactional
    public Map<String, Object> requestFriend(UUID requesterId, UUID addresseeId) {
        if (requesterId.equals(addresseeId)) throw new IllegalArgumentException("자기 자신에게 친구 요청을 보낼 수 없습니다.");
        requireUser(requesterId);
        requireUser(addresseeId);
        UUID one = first(requesterId, addresseeId);
        UUID two = second(requesterId, addresseeId);
        Friendship friendship = friendshipRepository.findByUserOneIdAndUserTwoId(one, two).orElseGet(Friendship::new);
        if (friendship.getId() != null && friendship.getStatus() != Friendship.Status.REJECTED) {
            throw new IllegalArgumentException(friendship.getStatus() == Friendship.Status.ACCEPTED
                ? "이미 친구입니다." : "이미 친구 요청이 진행 중입니다.");
        }
        friendship.setUserOneId(one);
        friendship.setUserTwoId(two);
        friendship.setRequestedBy(requesterId);
        friendship.setStatus(Friendship.Status.PENDING);
        return friendshipMap(friendshipRepository.save(friendship), requesterId);
    }

    @Transactional
    public Map<String, Object> respond(UUID friendshipId, UUID userId, boolean accept) {
        Friendship friendship = friendshipRepository.findById(friendshipId)
            .orElseThrow(() -> new IllegalArgumentException("친구 요청을 찾을 수 없습니다."));
        if (!contains(friendship, userId) || friendship.getRequestedBy().equals(userId)) {
            throw new IllegalArgumentException("이 친구 요청을 처리할 권한이 없습니다.");
        }
        if (friendship.getStatus() != Friendship.Status.PENDING) {
            throw new IllegalArgumentException("이미 처리된 친구 요청입니다.");
        }
        friendship.setStatus(accept ? Friendship.Status.ACCEPTED : Friendship.Status.REJECTED);
        return friendshipMap(friendshipRepository.save(friendship), userId);
    }

    @Transactional
    public void remove(UUID friendshipId, UUID userId) {
        Friendship friendship = friendshipRepository.findById(friendshipId)
            .orElseThrow(() -> new IllegalArgumentException("친구 관계를 찾을 수 없습니다."));
        if (!contains(friendship, userId)) throw new IllegalArgumentException("친구 관계를 삭제할 권한이 없습니다.");
        friendshipRepository.delete(friendship);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> friends(UUID userId) {
        requireUser(userId);
        return friendshipRepository.findForUserByStatus(userId, Friendship.Status.ACCEPTED).stream()
            .map(f -> friendshipMap(f, userId)).toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> requests(UUID userId) {
        requireUser(userId);
        return friendshipRepository.findForUserByStatus(userId, Friendship.Status.PENDING).stream()
            .map(f -> friendshipMap(f, userId)).toList();
    }

    @Transactional
    public Map<String, Object> send(UUID senderId, UUID recipientId, String content) {
        requireAcceptedFriendship(senderId, recipientId);
        if (content == null || content.isBlank()) throw new IllegalArgumentException("메시지를 입력해 주세요.");
        DirectMessage message = new DirectMessage();
        message.setSenderId(senderId);
        message.setRecipientId(recipientId);
        message.setContent(content.strip());
        return messageMap(messageRepository.save(message));
    }

    @Transactional
    public List<Map<String, Object>> conversation(UUID userId, UUID friendId, int limit) {
        requireAcceptedFriendship(userId, friendId);
        List<DirectMessage> messages = messageRepository.findConversation(
            userId, friendId, PageRequest.of(0, Math.min(Math.max(limit, 1), 200)));
        LocalDateTime now = LocalDateTime.now();
        messages.stream()
            .filter(m -> m.getRecipientId().equals(userId) && m.getReadAt() == null)
            .forEach(m -> m.setReadAt(now));
        List<Map<String, Object>> result = new ArrayList<>(mapMessages(messages));
        Collections.reverse(result);
        return result;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> adminFriendships() {
        return friendshipRepository.findAllRecent().stream()
            .map(f -> friendshipMap(f, f.getUserOneId())).toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> adminMessages(int limit) {
        return mapMessages(messageRepository.findRecent(
            PageRequest.of(0, Math.min(Math.max(limit, 1), 500))));
    }

    @Transactional
    public void adminDeleteMessage(UUID id) {
        if (!messageRepository.existsById(id)) throw new IllegalArgumentException("메시지를 찾을 수 없습니다.");
        messageRepository.deleteById(id);
    }

    private Map<String, Object> friendshipMap(Friendship friendship, UUID viewerId) {
        UUID otherId = friendship.getUserOneId().equals(viewerId) ? friendship.getUserTwoId() : friendship.getUserOneId();
        User one = requireUser(friendship.getUserOneId());
        User two = requireUser(friendship.getUserTwoId());
        User other = otherId.equals(one.getId()) ? one : two;
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", friendship.getId());
        result.put("status", friendship.getStatus());
        result.put("direction", friendship.getRequestedBy().equals(viewerId) ? "OUTGOING" : "INCOMING");
        result.put("requestedBy", friendship.getRequestedBy());
        result.put("userOneId", one.getId());
        result.put("userOneNickname", one.getNickname());
        result.put("userTwoId", two.getId());
        result.put("userTwoNickname", two.getNickname());
        result.put("friendId", other.getId());
        result.put("nickname", other.getNickname());
        result.put("profilePictureUrl", other.getProfilePictureUrl());
        result.put("avatarEmoji", other.getAvatarEmoji());
        result.put("avatarColor", other.getAvatarColor());
        result.put("lastActiveAt", other.getLastActiveAt());
        result.put("online", isOnline(other));
        result.put("createdAt", friendship.getCreatedAt());
        result.put("updatedAt", friendship.getUpdatedAt());
        return result;
    }

    private Map<String, Object> messageMap(DirectMessage message) {
        return messageMap(message, loadUsers(List.of(message)));
    }

    private List<Map<String, Object>> mapMessages(List<DirectMessage> messages) {
        Map<UUID, User> users = loadUsers(messages);
        return messages.stream().map(message -> messageMap(message, users)).toList();
    }

    private Map<UUID, User> loadUsers(Collection<DirectMessage> messages) {
        Set<UUID> userIds = new HashSet<>();
        messages.forEach(message -> {
            userIds.add(message.getSenderId());
            userIds.add(message.getRecipientId());
        });
        Map<UUID, User> users = new HashMap<>();
        userRepository.findAllById(userIds).forEach(user -> users.put(user.getId(), user));
        if (users.size() != userIds.size()) {
            throw new IllegalArgumentException("사용자를 찾을 수 없습니다.");
        }
        return users;
    }

    private Map<String, Object> messageMap(DirectMessage message, Map<UUID, User> users) {
        User sender = users.get(message.getSenderId());
        User recipient = users.get(message.getRecipientId());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", message.getId());
        result.put("senderId", message.getSenderId());
        result.put("senderNickname", sender.getNickname());
        result.put("recipientId", message.getRecipientId());
        result.put("recipientNickname", recipient.getNickname());
        result.put("content", message.getContent());
        result.put("createdAt", message.getCreatedAt());
        result.put("readAt", message.getReadAt());
        return result;
    }

    private void requireAcceptedFriendship(UUID a, UUID b) {
        Friendship f = friendshipRepository.findByUserOneIdAndUserTwoId(first(a, b), second(a, b))
            .orElseThrow(() -> new IllegalArgumentException("친구에게만 메시지를 보낼 수 있습니다."));
        if (f.getStatus() != Friendship.Status.ACCEPTED) throw new IllegalArgumentException("친구에게만 메시지를 보낼 수 있습니다.");
    }

    private User requireUser(UUID id) {
        return userRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
    }

    private boolean isOnline(User user) {
        return user.getLastActiveAt() != null && user.getLastActiveAt().isAfter(LocalDateTime.now().minusSeconds(ONLINE_SECONDS));
    }

    private boolean contains(Friendship f, UUID userId) {
        return f.getUserOneId().equals(userId) || f.getUserTwoId().equals(userId);
    }

    private UUID first(UUID a, UUID b) { return a.toString().compareTo(b.toString()) < 0 ? a : b; }
    private UUID second(UUID a, UUID b) { return a.toString().compareTo(b.toString()) < 0 ? b : a; }
}
