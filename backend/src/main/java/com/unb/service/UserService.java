package com.unb.service;

import com.unb.dto.CreateUserRequest;
import com.unb.dto.LoginRequest;
import com.unb.dto.UpdateNicknameRequest;
import com.unb.dto.UserDto;
import com.unb.dto.UserDiscoveryDto;
import com.unb.dto.UserProfileDto;
import com.unb.dto.UserPhotoDto;
import com.unb.dto.BlockedUserDto;
import com.unb.entity.User;
import com.unb.entity.UserPhoto;
import com.unb.entity.BlockedUser;
import com.unb.entity.PasswordResetCode;
import com.unb.repository.ParticipantRepository;
import com.unb.repository.UserRepository;
import com.unb.repository.UserPhotoRepository;
import com.unb.repository.BlockedUserRepository;
import com.unb.repository.PasswordResetCodeRepository;
import com.unb.repository.FriendshipRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import jakarta.persistence.criteria.Predicate;

@Service
@Transactional
public class UserService {
    private static final int ONLINE_SECONDS = 120;

    private static final Pattern EMAIL_PATTERN =
            Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final int MAX_EMAILS_PER_WINDOW = 3;
    private static final long RATE_WINDOW_MS = 15 * 60 * 1000L;
    private static final int MAX_CONFIRM_ATTEMPTS = 5;
    private static final long CODE_TTL_MINUTES = 10;

    private final UserRepository userRepository;
    private final ParticipantRepository participantRepository;
    private final BlockedUserRepository blockedUserRepository;
    private final UserPhotoRepository userPhotoRepository;
    private final PasswordResetCodeRepository passwordResetCodeRepository;
    private final FriendshipRepository friendshipRepository;
    private final EmailService emailService;
    private final SupabaseStorageService storageService;

    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final SecureRandom secureRandom = new SecureRandom();
    private final Map<String, Deque<Long>> emailSendTimestamps = new ConcurrentHashMap<>();

    public UserService(UserRepository userRepository, ParticipantRepository participantRepository, 
                       BlockedUserRepository blockedUserRepository, UserPhotoRepository userPhotoRepository,
                       PasswordResetCodeRepository passwordResetCodeRepository, EmailService emailService,
                       SupabaseStorageService storageService, FriendshipRepository friendshipRepository) {
        this.userRepository = userRepository;
        this.participantRepository = participantRepository;
        this.blockedUserRepository = blockedUserRepository;
        this.userPhotoRepository = userPhotoRepository;
        this.passwordResetCodeRepository = passwordResetCodeRepository;
        this.emailService = emailService;
        this.storageService = storageService;
        this.friendshipRepository = friendshipRepository;
    }

    public boolean isNicknameAvailable(String nickname) {
        return !userRepository.findByNickname(nickname).isPresent();
    }

    public UserDto createUser(CreateUserRequest request) {
        Optional<User> existingUser = userRepository.findByNickname(request.getNickname());
        if (existingUser.isPresent()) {
            throw new RuntimeException("이미 사용중인 닉네임입니다");
        }

        User user = new User(request.getNickname(), passwordEncoder.encode(request.getPassword()));
        user.setEmail(normalizeEmail(request.getEmail()));
        user.setNationality(parseNationality(request.getNationality()));
        user.setGender(parseGender(request.getGender()));
        user.setAge(request.getAge());
        user = userRepository.save(user);
        return toDto(user);
    }

    public UserDto login(LoginRequest request) {
        Optional<User> userOpt = userRepository.findByNickname(request.getNickname());
        if (userOpt.isEmpty()) {
            throw new RuntimeException("존재하지 않는 사용자입니다");
        }

        User user = userOpt.get();
        if (!verifyPassword(user, request.getPassword())) {
            throw new RuntimeException("비밀번호가 일치하지 않습니다");
        }

        return toDto(user);
    }

    private boolean verifyPassword(User user, String rawPassword) {
        String stored = user.getPassword();
        if (stored == null || rawPassword == null) {
            return false;
        }
        if (stored.startsWith("$2")) {
            return passwordEncoder.matches(rawPassword, stored);
        }
        // Legacy plaintext password — verify, then transparently upgrade to BCrypt.
        if (stored.equals(rawPassword)) {
            user.setPassword(passwordEncoder.encode(rawPassword));
            userRepository.save(user);
            return true;
        }
        return false;
    }

    public void changePassword(UUID userId, String currentPassword, String newPassword) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다"));
        if (currentPassword == null || currentPassword.isEmpty()) {
            throw new RuntimeException("현재 비밀번호를 입력해주세요");
        }
        if (!verifyPassword(user, currentPassword)) {
            throw new RuntimeException("현재 비밀번호가 일치하지 않습니다");
        }
        if (newPassword == null || newPassword.length() < 4) {
            throw new RuntimeException("새 비밀번호는 4자 이상이어야 합니다");
        }
        if (currentPassword.equals(newPassword)) {
            throw new RuntimeException("현재 비밀번호와 다른 비밀번호를 입력해주세요");
        }
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    public Optional<UserDto> findById(UUID id) {
        return userRepository.findById(id).map(this::toDto);
    }

    public Optional<UserDto> findByNickname(String nickname) {
        return userRepository.findByNickname(nickname).map(this::toDto);
    }

    public List<UserDto> searchByNickname(String query) {
        return userRepository.searchByNickname(query)
                .stream()
                .limit(20)
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public List<UserDiscoveryDto> discoverUsers(UUID viewerId, int page, int size, String nationality,
                                                 String gender, Integer minAge, Integer maxAge,
                                                 boolean onlineOnly) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 40);
        PageRequest pageable = PageRequest.of(safePage, safeSize);
        User.Nationality nationalityFilter = nationality == null || nationality.isBlank()
                ? null : parseNationality(nationality);
        User.Gender genderFilter = gender == null || gender.isBlank() ? null : parseGender(gender);
        LocalDateTime activeAfter = onlineOnly ? LocalDateTime.now().minusSeconds(ONLINE_SECONDS) : null;
        Specification<User> filters = (root, query, criteriaBuilder) -> {
            List<Predicate> predicates = new java.util.ArrayList<>();
            if (viewerId != null) {
                predicates.add(criteriaBuilder.notEqual(root.get("id"), viewerId));
            }
            if (nationalityFilter != null) {
                predicates.add(criteriaBuilder.equal(root.get("nationality"), nationalityFilter));
            }
            if (genderFilter != null) {
                predicates.add(criteriaBuilder.equal(root.get("gender"), genderFilter));
            }
            if (minAge != null) {
                predicates.add(criteriaBuilder.greaterThanOrEqualTo(root.get("age"), minAge));
            }
            if (maxAge != null) {
                predicates.add(criteriaBuilder.lessThanOrEqualTo(root.get("age"), maxAge));
            }
            if (activeAfter != null) {
                predicates.add(criteriaBuilder.greaterThanOrEqualTo(root.get("lastActiveAt"), activeAfter));
            }
            query.orderBy(criteriaBuilder.desc(root.get("createdAt")));
            return criteriaBuilder.and(predicates.toArray(Predicate[]::new));
        };
        List<User> users = userRepository.findAll(filters, pageable).getContent();

        return users.stream()
                .map(user -> {
                    String coverPhotoUrl = userPhotoRepository
                            .findByUserIdOrderByDisplayOrderAscCreatedAtDesc(user.getId())
                            .stream()
                            .findFirst()
                            .map(UserPhoto::getPhotoUrl)
                            .orElse(null);
                    return new UserDiscoveryDto(
                            user.getId(),
                            user.getNickname(),
                            user.getBio(),
                            user.getProfilePictureUrl(),
                            coverPhotoUrl,
                            user.getAvatarEmoji(),
                            user.getAvatarColor(),
                            user.getNationality().name(),
                            user.getGender() == null ? null : user.getGender().name(),
                            user.getAge(),
                            isOnline(user)
                    );
                })
                .collect(Collectors.toList());
    }

    public UserDto updateNickname(UpdateNicknameRequest request) {
        UUID userId = UUID.fromString(request.getUserId());
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다"));

        String oldNickname = user.getNickname();
        String newNickname = request.getNewNickname().trim();
        
        if (newNickname.equals(oldNickname)) {
            return toDto(user);
        }

        if (!isNicknameAvailable(newNickname)) {
            throw new RuntimeException("이미 사용중인 닉네임입니다");
        }

        participantRepository.updateUserName(oldNickname, newNickname);

        user.setNickname(newNickname);
        user = userRepository.save(user);
        return toDto(user);
    }

    private UserDto toDto(User user) {
        UserDto dto = new UserDto(user.getId(), user.getNickname(), user.getBio(),
                user.getProfilePictureUrl(), user.getEmail(), user.getCreatedAt());
        dto.setNationality(user.getNationality().name());
        dto.setAvatarEmoji(user.getAvatarEmoji());
        dto.setAvatarColor(user.getAvatarColor());
        dto.setGender(user.getGender() == null ? null : user.getGender().name());
        dto.setAge(user.getAge());
        return dto;
    }

    public UserDto updateAvatar(UUID userId, String emoji, String color) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다"));
        user.setAvatarEmoji(emoji == null || emoji.isBlank() ? null : emoji);
        user.setAvatarColor(color == null || color.isBlank() ? null : color);
        return toDto(userRepository.save(user));
    }

    public UserDto updateNationality(UUID userId, String nationality) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다"));
        user.setNationality(parseNationality(nationality));
        return toDto(userRepository.save(user));
    }

    private User.Nationality parseNationality(String value) {
        if (value == null || value.isBlank()) return User.Nationality.KR;
        try {
            return User.Nationality.valueOf(value.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new RuntimeException("지원하지 않는 국적입니다");
        }
    }

    private User.Gender parseGender(String value) {
        try {
            return User.Gender.valueOf(value.toUpperCase());
        } catch (Exception e) {
            throw new RuntimeException("지원하지 않는 성별입니다");
        }
    }

    public UserDto updateEmail(UUID userId, String rawEmail) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다"));

        String email = normalizeEmail(rawEmail);
        if (email == null) {
            throw new RuntimeException("이메일을 입력해주세요");
        }
        if (email.length() > 254) {
            throw new RuntimeException("이메일이 너무 깁니다");
        }
        if (!EMAIL_PATTERN.matcher(email).matches()) {
            throw new RuntimeException("올바른 이메일 형식이 아닙니다");
        }

        user.setEmail(email);
        user = userRepository.save(user);
        return toDto(user);
    }

    /**
     * Emails the nickname(s) registered under the given address.
     * Always silent (anti-enumeration): callers should return a generic success.
     */
    public void findId(String rawEmail) {
        String email = normalizeEmail(rawEmail);
        if (email == null || !EMAIL_PATTERN.matcher(email).matches()) {
            return;
        }
        requireEmailSendAllowed("findid:" + email);
        List<User> users = userRepository.findByEmail(email);
        if (users.isEmpty()) {
            return;
        }
        String nicknames = users.stream()
                .map(User::getNickname)
                .collect(Collectors.joining(", "));
        String subject = "[PlanTalk] 아이디(닉네임) 찾기 결과";
        String body = "안녕하세요, PlanTalk입니다.\n\n"
                + "요청하신 이메일로 가입된 아이디(닉네임)는 다음과 같습니다:\n\n"
                + nicknames + "\n\n"
                + "본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.\n\n"
                + "감사합니다.\nPlanTalk 팀";
        emailService.sendEmail(email, subject, body);
    }

    /**
     * Issues a password-reset code and emails it, only when nickname + email match.
     * Always silent (anti-enumeration): callers should return a generic success.
     */
    public void requestPasswordReset(String nickname, String rawEmail) {
        String email = normalizeEmail(rawEmail);
        if (nickname == null || nickname.trim().isEmpty() || email == null) {
            return;
        }
        requireEmailSendAllowed("reset:" + email);
        Optional<User> userOpt = userRepository.findByNickname(nickname.trim());
        if (userOpt.isEmpty()) {
            return;
        }
        User user = userOpt.get();
        if (user.getEmail() == null || !user.getEmail().equalsIgnoreCase(email)) {
            return;
        }
        passwordResetCodeRepository.invalidateAllForUser(user.getId());
        String code = generateCode();
        LocalDateTime expiresAt = LocalDateTime.now().plusMinutes(CODE_TTL_MINUTES);
        passwordResetCodeRepository.save(new PasswordResetCode(user.getId(), code, expiresAt));

        String subject = "[PlanTalk] 비밀번호 재설정 인증 코드";
        String body = "안녕하세요, PlanTalk입니다.\n\n"
                + "비밀번호 재설정 인증 코드는 다음과 같습니다:\n\n"
                + code + "\n\n"
                + "이 코드는 " + CODE_TTL_MINUTES + "분간 유효합니다.\n"
                + "본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.\n\n"
                + "감사합니다.\nPlanTalk 팀";
        emailService.sendEmail(email, subject, body);
    }

    public void confirmPasswordReset(String nickname, String rawEmail, String code, String newPassword) {
        if (newPassword == null || newPassword.length() < 4 || newPassword.length() > 50) {
            throw new RuntimeException("비밀번호는 4-50자 사이여야 합니다");
        }
        String email = normalizeEmail(rawEmail);
        if (nickname == null || email == null || code == null || code.trim().isEmpty()) {
            throw new RuntimeException("인증 코드가 올바르지 않습니다");
        }

        User user = userRepository.findByNickname(nickname.trim())
                .filter(u -> u.getEmail() != null && u.getEmail().equalsIgnoreCase(email))
                .orElseThrow(() -> new RuntimeException("인증 코드가 유효하지 않거나 만료되었습니다"));

        PasswordResetCode prc = passwordResetCodeRepository
                .findFirstByUserIdAndUsedFalseOrderByCreatedAtDesc(user.getId())
                .orElseThrow(() -> new RuntimeException("인증 코드가 유효하지 않거나 만료되었습니다"));

        if (prc.getExpiresAt().isBefore(LocalDateTime.now())) {
            prc.setUsed(true);
            passwordResetCodeRepository.save(prc);
            throw new RuntimeException("인증 코드가 만료되었습니다. 다시 요청해주세요");
        }

        if (prc.getAttempts() >= MAX_CONFIRM_ATTEMPTS) {
            prc.setUsed(true);
            passwordResetCodeRepository.save(prc);
            throw new RuntimeException("시도 횟수를 초과했습니다. 코드를 다시 요청해주세요");
        }

        if (!prc.getCode().equals(code.trim())) {
            prc.setAttempts(prc.getAttempts() + 1);
            if (prc.getAttempts() >= MAX_CONFIRM_ATTEMPTS) {
                prc.setUsed(true);
            }
            passwordResetCodeRepository.save(prc);
            throw new RuntimeException("인증 코드가 올바르지 않습니다");
        }

        prc.setUsed(true);
        passwordResetCodeRepository.save(prc);
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    private String normalizeEmail(String email) {
        if (email == null) {
            return null;
        }
        String normalized = email.trim().toLowerCase();
        return normalized.isEmpty() ? null : normalized;
    }

    private String generateCode() {
        return String.format("%06d", secureRandom.nextInt(1_000_000));
    }

    private synchronized void requireEmailSendAllowed(String key) {
        long now = System.currentTimeMillis();
        Deque<Long> timestamps = emailSendTimestamps.computeIfAbsent(key, k -> new ArrayDeque<>());
        while (!timestamps.isEmpty() && now - timestamps.peekFirst() > RATE_WINDOW_MS) {
            timestamps.pollFirst();
        }
        if (timestamps.size() >= MAX_EMAILS_PER_WINDOW) {
            throw new EmailRateLimitException();
        }
        timestamps.addLast(now);
    }

    public UserDto updateBio(UUID userId, String bio) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다"));
        
        if (bio != null && bio.length() > 200) {
            throw new RuntimeException("자기소개는 200자 이내로 작성해주세요");
        }
        
        user.setBio(bio);
        user = userRepository.save(user);
        return toDto(user);
    }

    public UserDto updateProfilePicture(UUID userId, MultipartFile file) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다"));

        String previousUrl = user.getProfilePictureUrl();
        String profilePictureUrl = storageService.uploadImage(file, "avatars/" + userId);
        user.setProfilePictureUrl(profilePictureUrl);
        user = userRepository.save(user);
        storageService.deleteByPublicUrl(previousUrl);
        return toDto(user);
    }

    public UserDto deleteProfilePicture(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다"));
        String previousUrl = user.getProfilePictureUrl();
        user.setProfilePictureUrl(null);
        user = userRepository.save(user);
        storageService.deleteByPublicUrl(previousUrl);
        return toDto(user);
    }

    public BlockedUserDto blockUser(UUID blockerId, UUID blockedId) {
        if (blockerId.equals(blockedId)) {
            throw new RuntimeException("자기 자신을 차단할 수 없습니다");
        }

        if (blockedUserRepository.existsByBlockerIdAndBlockedId(blockerId, blockedId)) {
            throw new RuntimeException("이미 차단된 사용자입니다");
        }

        User blockedUser = userRepository.findById(blockedId)
                .orElseThrow(() -> new RuntimeException("차단할 사용자를 찾을 수 없습니다"));

        BlockedUser blocked = new BlockedUser(blockerId, blockedId, blockedUser.getNickname());
        blocked = blockedUserRepository.save(blocked);
        return new BlockedUserDto(blocked);
    }

    public void unblockUser(UUID blockerId, UUID blockedId) {
        if (!blockedUserRepository.existsByBlockerIdAndBlockedId(blockerId, blockedId)) {
            throw new RuntimeException("차단되지 않은 사용자입니다");
        }
        blockedUserRepository.deleteByBlockerIdAndBlockedId(blockerId, blockedId);
    }

    public List<BlockedUserDto> getBlockedUsers(UUID blockerId) {
        return blockedUserRepository.findByBlockerId(blockerId)
                .stream()
                .map(BlockedUserDto::new)
                .collect(Collectors.toList());
    }

    public boolean isBlocked(UUID blockerId, UUID blockedId) {
        return blockedUserRepository.existsByBlockerIdAndBlockedId(blockerId, blockedId);
    }

    public List<UUID> getBlockedUserIds(UUID blockerId) {
        return blockedUserRepository.findByBlockerId(blockerId)
                .stream()
                .map(BlockedUser::getBlockedId)
                .collect(Collectors.toList());
    }

    public Optional<UserProfileDto> getUserProfile(UUID userId) {
        return userRepository.findById(userId).map(user -> {
            long participatingCount = participantRepository.countAgreementsByUserName(user.getNickname());
            long completedCount = participantRepository.countCompletedAgreementsByUserName(user.getNickname());
            List<UserPhotoDto> photos = getUserPhotos(user.getId());
            
            UserProfileDto profile = new UserProfileDto(
                user.getId(),
                user.getNickname(),
                user.getBio(),
                user.getProfilePictureUrl(),
                user.getCreatedAt(),
                participatingCount,
                completedCount
            );
            profile.setAvatarEmoji(user.getAvatarEmoji());
            profile.setAvatarColor(user.getAvatarColor());
            profile.setFollowerCount(friendshipRepository.countFollowers(user.getId()));
            profile.setFollowingCount(friendshipRepository.countFollowing(user.getId()));
            profile.setOnline(isOnline(user));
            profile.setPhotos(photos);
            return profile;
        });
    }

    public Optional<UserProfileDto> getUserProfileByNickname(String nickname) {
        return userRepository.findByNickname(nickname).map(user -> {
            long participatingCount = participantRepository.countAgreementsByUserName(user.getNickname());
            long completedCount = participantRepository.countCompletedAgreementsByUserName(user.getNickname());
            List<UserPhotoDto> photos = getUserPhotos(user.getId());
            
            UserProfileDto profile = new UserProfileDto(
                user.getId(),
                user.getNickname(),
                user.getBio(),
                user.getProfilePictureUrl(),
                user.getCreatedAt(),
                participatingCount,
                completedCount
            );
            profile.setAvatarEmoji(user.getAvatarEmoji());
            profile.setAvatarColor(user.getAvatarColor());
            profile.setFollowerCount(friendshipRepository.countFollowers(user.getId()));
            profile.setFollowingCount(friendshipRepository.countFollowing(user.getId()));
            profile.setOnline(isOnline(user));
            profile.setPhotos(photos);
            return profile;
        });
    }

    public List<UserPhotoDto> getUserPhotos(UUID userId) {
        return userPhotoRepository.findByUserIdOrderByDisplayOrderAscCreatedAtDesc(userId)
                .stream()
                .map(this::toPhotoDto)
                .collect(Collectors.toList());
    }

    private boolean isOnline(User user) {
        return user.getLastActiveAt() != null
            && user.getLastActiveAt().isAfter(LocalDateTime.now().minusSeconds(ONLINE_SECONDS));
    }

    public UserPhotoDto addUserPhoto(UUID userId, MultipartFile file, String caption) {
        int photoCount = userPhotoRepository.countByUserId(userId);
        if (photoCount >= 10) {
            throw new RuntimeException("일상사진은 최대 10장까지 등록할 수 있습니다");
        }

        String photoUrl = storageService.uploadImage(file, "user-photos/" + userId);
        UserPhoto photo = new UserPhoto(userId, photoUrl);
        if (caption != null && !caption.trim().isEmpty()) {
            if (caption.length() > 200) {
                throw new RuntimeException("사진 설명은 200자 이내로 작성해주세요");
            }
            photo.setCaption(caption.trim());
        }
        photo.setDisplayOrder(photoCount);
        
        photo = userPhotoRepository.save(photo);
        return toPhotoDto(photo);
    }

    public void deleteUserPhoto(UUID userId, UUID photoId) {
        UserPhoto photo = userPhotoRepository.findById(photoId)
                .filter(found -> found.getUserId().equals(userId))
                .orElseThrow(() -> new RuntimeException("사진을 찾을 수 없습니다"));
        userPhotoRepository.deleteByIdAndUserId(photoId, userId);
        storageService.deleteByPublicUrl(photo.getPhotoUrl());
    }

    private UserPhotoDto toPhotoDto(UserPhoto photo) {
        return new UserPhotoDto(
            photo.getId(),
            photo.getUserId(),
            photo.getPhotoUrl(),
            photo.getCaption(),
            photo.getDisplayOrder(),
            photo.getCreatedAt()
        );
    }
}
