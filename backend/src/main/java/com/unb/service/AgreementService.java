package com.unb.service;

import com.unb.dto.*;
import com.unb.entity.*;
import com.unb.repository.AgreementRepository;
import com.unb.repository.AgreementEventRepository;
import com.unb.repository.ParticipantRepository;
import com.unb.repository.UserRepository;
import com.unb.repository.FriendshipRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class AgreementService {

    private final AgreementRepository agreementRepository;
    private final UserRepository userRepository;
    private final ParticipantRepository participantRepository;
    private final AgreementEventRepository agreementEventRepository;
    private final FriendshipRepository friendshipRepository;

    public AgreementService(AgreementRepository agreementRepository,
                           UserRepository userRepository,
                           ParticipantRepository participantRepository,
                           AgreementEventRepository agreementEventRepository,
                           FriendshipRepository friendshipRepository) {
        this.agreementRepository = agreementRepository;
        this.userRepository = userRepository;
        this.participantRepository = participantRepository;
        this.agreementEventRepository = agreementEventRepository;
        this.friendshipRepository = friendshipRepository;
    }

    public AgreementDto createAgreement(CreateAgreementRequest request) {
        User creator = userRepository.findById(UUID.fromString(request.getCreatorId()))
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다"));

        Agreement agreement = new Agreement();
        agreement.setTitle(request.getTitle());
        agreement.setDescription(request.getDescription());
        agreement.setEmoji(request.getEmoji());
        agreement.setCategory(AgreementCategory.valueOf(request.getCategory().toUpperCase()));
        if (agreement.getCategory() == AgreementCategory.CUSTOM) {
            String customName = request.getCustomCategoryName() == null
                    ? "" : request.getCustomCategoryName().trim();
            if (customName.isEmpty()) {
                throw new IllegalArgumentException("사용자 지정 카테고리 이름을 입력해주세요");
            }
            if (customName.length() > 30) {
                throw new IllegalArgumentException("사용자 지정 카테고리 이름은 30자 이하여야 합니다");
            }
            agreement.setCustomCategoryName(customName);
        }
        agreement.setDateTime(request.getDateTime());
        Agreement.ScheduleType scheduleType = request.getScheduleType() == null
            ? Agreement.ScheduleType.POINT
            : Agreement.ScheduleType.valueOf(request.getScheduleType().toUpperCase());
        if (scheduleType == Agreement.ScheduleType.RANGE) {
            if (request.getDateTime() == null || request.getEndDateTime() == null) {
                throw new IllegalArgumentException("기간 일정은 시작과 종료 일시가 모두 필요합니다");
            }
            if (!request.getEndDateTime().isAfter(request.getDateTime())) {
                throw new IllegalArgumentException("종료 일시는 시작 일시보다 늦어야 합니다");
            }
        }
        agreement.setScheduleType(scheduleType);
        agreement.setEndDateTime(scheduleType == Agreement.ScheduleType.RANGE
            ? request.getEndDateTime() : null);
        agreement.setCreator(creator);

        Participant creatorParticipant = new Participant(creator.getNickname(), ParticipantStatusType.AGREED);
        agreement.addParticipant(creatorParticipant);

        if (request.getParticipantNames() != null) {
            for (String name : request.getParticipantNames()) {
                if (!name.equals(creator.getNickname())) {
                    User invitedUser = userRepository.findByNickname(name)
                            .orElseThrow(() -> new RuntimeException("존재하지 않는 사용자입니다: " + name));
                    requireAcceptedFriendship(creator.getId(), invitedUser.getId());
                    Participant participant = new Participant(invitedUser.getNickname());
                    agreement.addParticipant(participant);
                }
            }
        }

        agreement = agreementRepository.save(agreement);

        recordEvent(agreement, AgreementEventType.CREATED, creator.getNickname(), null,
                null, null, "약속이 생성되었습니다");

        if (request.getParticipantNames() != null) {
            for (String name : request.getParticipantNames()) {
                if (!name.equals(creator.getNickname())) {
                    recordEvent(agreement, AgreementEventType.PARTICIPANT_ADDED, creator.getNickname(), name,
                            null, null, creator.getNickname() + "님이 " + name + "님을 초대했습니다");
                }
            }
        }

        return toDto(agreement);
    }

    @Transactional(readOnly = true)
    public List<AgreementDto> getAllAgreements() {
        return agreementRepository.findAllOrderByCreatedAtDesc().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public AgreementDto getAgreementById(UUID id) {
        Agreement agreement = agreementRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("약속을 찾을 수 없습니다"));
        return toDto(agreement);
    }

    @Transactional(readOnly = true)
    public List<AgreementDto> getPendingAgreements(String userName) {
        return agreementRepository.findPendingByParticipantUserName(userName).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<AgreementDto> getUpcomingAgreements(String userName) {
        return agreementRepository.findUpcomingByParticipantUserName(userName, LocalDateTime.now()).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<AgreementDto> getAgreementsByCategory(String category) {
        AgreementCategory cat = AgreementCategory.valueOf(category.toUpperCase());
        return agreementRepository.findByCategoryOrderByCreatedAtDesc(cat).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<AgreementDto> getUserAgreements(String userName) {
        return agreementRepository.findByParticipantUserName(userName).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public AgreementDto updateParticipantStatus(UUID agreementId, UpdateParticipantStatusRequest request) {
        Participant participant = participantRepository.findByAgreementIdAndUserName(agreementId, request.getUserName())
                .orElseThrow(() -> new RuntimeException("참여자를 찾을 수 없습니다"));

        ParticipantStatusType oldStatus = participant.getStatus();
        ParticipantStatusType newStatus = ParticipantStatusType.valueOf(request.getStatus().toUpperCase());
        participant.setStatus(newStatus);
        participantRepository.save(participant);

        Agreement agreement = participant.getAgreement();

        String statusKo = getStatusKorean(newStatus);
        recordEvent(agreement, AgreementEventType.PARTICIPANT_RESPONDED, request.getUserName(), null,
                oldStatus.getCode(), newStatus.getCode(),
                request.getUserName() + "님이 '" + statusKo + "' 상태로 응답했습니다");

        return toDto(agreement);
    }

    public AgreementDto addParticipant(UUID agreementId, AddParticipantRequest request) {
        Agreement agreement = agreementRepository.findById(agreementId)
                .orElseThrow(() -> new RuntimeException("약속을 찾을 수 없습니다"));

        if (!agreement.getCreator().getId().toString().equals(request.getRequesterId())) {
            throw new RuntimeException("생성자만 참여자를 추가할 수 있습니다");
        }

        User userToAdd = userRepository.findByNickname(request.getParticipantName())
                .orElseThrow(() -> new RuntimeException("존재하지 않는 사용자입니다: " + request.getParticipantName()));
        requireAcceptedFriendship(agreement.getCreator().getId(), userToAdd.getId());

        boolean exists = agreement.getParticipants().stream()
                .anyMatch(p -> p.getUserName().equals(request.getParticipantName()));
        if (exists) {
            throw new RuntimeException("이미 참여자로 등록되어 있습니다: " + request.getParticipantName());
        }

        Participant participant = new Participant(userToAdd.getNickname());
        agreement.addParticipant(participant);
        agreement = agreementRepository.save(agreement);

        recordEvent(agreement, AgreementEventType.PARTICIPANT_ADDED, agreement.getCreator().getNickname(),
                request.getParticipantName(), null, null,
                agreement.getCreator().getNickname() + "님이 " + request.getParticipantName() + "님을 초대했습니다");

        return toDto(agreement);
    }

    private void requireAcceptedFriendship(UUID requesterId, UUID invitedUserId) {
        UUID one = requesterId.toString().compareTo(invitedUserId.toString()) < 0 ? requesterId : invitedUserId;
        UUID two = one.equals(requesterId) ? invitedUserId : requesterId;
        Friendship friendship = friendshipRepository.findByUserOneIdAndUserTwoId(one, two)
                .orElseThrow(() -> new IllegalArgumentException("친구만 초대할 수 있습니다."));
        if (friendship.getStatus() != Friendship.Status.ACCEPTED) {
            throw new IllegalArgumentException("친구만 초대할 수 있습니다.");
        }
    }

    @Transactional(readOnly = true)
    public StatsDto getStats(String userName) {
        List<Agreement> userAgreements = agreementRepository.findByParticipantUserName(userName);

        int total = userAgreements.size();
        int completed = 0;
        int declined = 0;
        int created = 0;
        int agreed = 0;

        for (Agreement agreement : userAgreements) {
            if (agreement.getCreator().getNickname().equals(userName)) {
                created++;
            }

            boolean allAgreed = agreement.getParticipants().stream()
                    .allMatch(p -> p.getStatus() == ParticipantStatusType.AGREED);
            boolean anyDeclined = agreement.getParticipants().stream()
                    .anyMatch(p -> p.getStatus() == ParticipantStatusType.DECLINED);

            if (allAgreed) completed++;
            if (anyDeclined) declined++;

            agreement.getParticipants().stream()
                    .filter(p -> p.getUserName().equals(userName) && p.getStatus() == ParticipantStatusType.AGREED)
                    .findFirst()
                    .ifPresent(p -> {});
        }

        agreed = (int) userAgreements.stream()
                .flatMap(a -> a.getParticipants().stream())
                .filter(p -> p.getUserName().equals(userName) && p.getStatus() == ParticipantStatusType.AGREED)
                .count();

        return new StatsDto(total, completed, declined, created, agreed);
    }

    public AgreementDto updateAgreementStatus(UUID agreementId, String requesterId, String newStatus) {
        Agreement agreement = agreementRepository.findById(agreementId)
                .orElseThrow(() -> new RuntimeException("약속을 찾을 수 없습니다"));

        if (!agreement.getCreator().getId().toString().equals(requesterId)) {
            throw new RuntimeException("생성자만 상태를 변경할 수 있습니다");
        }

        String oldStatus = agreement.getStatus().name();
        AgreementStatus status = AgreementStatus.valueOf(newStatus.toUpperCase());
        agreement.setStatus(status);
        agreement = agreementRepository.save(agreement);

        String oldStatusKo = getAgreementStatusKorean(AgreementStatus.valueOf(oldStatus));
        String newStatusKo = getAgreementStatusKorean(status);
        recordEvent(agreement, AgreementEventType.STATUS_CHANGED, agreement.getCreator().getNickname(), null,
                oldStatus, newStatus,
                agreement.getCreator().getNickname() + "님이 상태를 '" + oldStatusKo + "'에서 '" + newStatusKo + "'(으)로 변경했습니다");

        return toDto(agreement);
    }

    public AgreementDto updateAgreementContent(UUID agreementId, UpdateAgreementContentRequest request) {
        Agreement agreement = agreementRepository.findById(agreementId)
                .orElseThrow(() -> new RuntimeException("약속을 찾을 수 없습니다"));

        if (!agreement.getCreator().getId().toString().equals(request.getRequesterId())) {
            throw new RuntimeException("생성자만 내용을 수정할 수 있습니다");
        }

        String creatorName = agreement.getCreator().getNickname();
        boolean contentChanged = false;

        if (request.getTitle() != null && !request.getTitle().equals(agreement.getTitle())) {
            String oldTitle = agreement.getTitle();
            agreement.setTitle(request.getTitle());
            recordEvent(agreement, AgreementEventType.CONTENT_UPDATED, creatorName, null,
                    oldTitle, request.getTitle(),
                    creatorName + "님이 제목을 '" + oldTitle + "'에서 '" + request.getTitle() + "'(으)로 변경했습니다");
            contentChanged = true;
        }

        if (request.getDescription() != null && !request.getDescription().equals(agreement.getDescription())) {
            String oldDesc = agreement.getDescription() != null ? agreement.getDescription() : "(없음)";
            String newDesc = request.getDescription().isEmpty() ? "(없음)" : request.getDescription();
            agreement.setDescription(request.getDescription());
            recordEvent(agreement, AgreementEventType.CONTENT_UPDATED, creatorName, null,
                    oldDesc, newDesc,
                    creatorName + "님이 설명을 변경했습니다");
            contentChanged = true;
        }

        if (contentChanged) {
            int resetCount = 0;
            for (Participant p : agreement.getParticipants()) {
                if (!p.getUserName().equals(creatorName) && p.getStatus() == ParticipantStatusType.AGREED) {
                    p.setStatus(ParticipantStatusType.WAITING);
                    resetCount++;
                }
            }

            if (resetCount > 0) {
                recordEvent(agreement, AgreementEventType.CONSENT_RESET, creatorName, null,
                        null, String.valueOf(resetCount),
                        "내용 변경으로 인해 " + resetCount + "명의 동의가 초기화되었습니다. 다시 동의가 필요합니다.");
            }
        }

        agreement = agreementRepository.save(agreement);
        return toDto(agreement);
    }

    @Transactional(readOnly = true)
    public List<AgreementEventDto> getAgreementTimeline(UUID agreementId) {
        List<AgreementEvent> events = agreementEventRepository.findByAgreementIdOrderByCreatedAtAsc(agreementId);
        return events.stream()
                .map(this::toEventDto)
                .collect(Collectors.toList());
    }

    private void recordEvent(Agreement agreement, AgreementEventType eventType, String actorName,
                             String targetName, String oldValue, String newValue, String description) {
        AgreementEvent event = new AgreementEvent();
        event.setAgreement(agreement);
        event.setEventType(eventType);
        event.setActorName(actorName);
        event.setTargetName(targetName);
        event.setOldValue(oldValue);
        event.setNewValue(newValue);
        event.setDescription(description);
        agreementEventRepository.save(event);
    }

    private String getStatusKorean(ParticipantStatusType status) {
        return switch (status) {
            case WAITING -> "대기중";
            case AGREED -> "동의";
            case DECLINED -> "거절";
            case SKIPPED -> "보류";
        };
    }

    private String getAgreementStatusKorean(AgreementStatus status) {
        return switch (status) {
            case PENDING -> "대기중";
            case IN_PROGRESS -> "진행중";
            case COMPLETED -> "완료";
        };
    }

    private AgreementEventDto toEventDto(AgreementEvent event) {
        return new AgreementEventDto(
                event.getId(),
                event.getAgreement().getId(),
                event.getEventType().getCode(),
                event.getActorName(),
                event.getTargetName(),
                event.getOldValue(),
                event.getNewValue(),
                event.getDescription(),
                event.getCreatedAt()
        );
    }

    private AgreementDto toDto(Agreement agreement) {
        AgreementDto dto = new AgreementDto();
        dto.setId(agreement.getId());
        dto.setTitle(agreement.getTitle());
        dto.setDescription(agreement.getDescription());
        dto.setEmoji(agreement.getEmoji());
        dto.setCategory(agreement.getCategory().getCode());
        dto.setCustomCategoryName(agreement.getCustomCategoryName());
        dto.setStatus(agreement.getStatus().name());
        dto.setDateTime(agreement.getDateTime());
        dto.setScheduleType(agreement.getScheduleType().name());
        dto.setEndDateTime(agreement.getEndDateTime());
        dto.setCreatorId(agreement.getCreator().getId());
        dto.setCreatorName(agreement.getCreator().getNickname());
        dto.setCreatedAt(agreement.getCreatedAt());

        List<ParticipantDto> participants = agreement.getParticipants().stream()
                .map(p -> new ParticipantDto(
                        p.getId(),
                        agreement.getId(),
                        p.getUserName(),
                        p.getStatus().getCode(),
                        p.getUpdatedAt()
                ))
                .collect(Collectors.toList());
        dto.setParticipants(participants);

        return dto;
    }
}
