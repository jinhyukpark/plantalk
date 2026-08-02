package com.unb.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "agreements")
public class Agreement {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    private String emoji;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AgreementCategory category;

    @Column(name = "custom_category_name", length = 30)
    private String customCategoryName;

    @Column(name = "date_time")
    private LocalDateTime dateTime;

    @Enumerated(EnumType.STRING)
    @Column(name = "schedule_type")
    private ScheduleType scheduleType = ScheduleType.POINT;

    @Column(name = "end_date_time")
    private LocalDateTime endDateTime;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "creator_id", nullable = false)
    private User creator;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AgreementStatus status = AgreementStatus.PENDING;

    @OneToMany(mappedBy = "agreement", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Participant> participants = new ArrayList<>();

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public Agreement() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getEmoji() { return emoji; }
    public void setEmoji(String emoji) { this.emoji = emoji; }
    public AgreementCategory getCategory() { return category; }
    public void setCategory(AgreementCategory category) { this.category = category; }
    public String getCustomCategoryName() { return customCategoryName; }
    public void setCustomCategoryName(String customCategoryName) { this.customCategoryName = customCategoryName; }
    public LocalDateTime getDateTime() { return dateTime; }
    public void setDateTime(LocalDateTime dateTime) { this.dateTime = dateTime; }
    public ScheduleType getScheduleType() { return scheduleType != null ? scheduleType : ScheduleType.POINT; }
    public void setScheduleType(ScheduleType scheduleType) { this.scheduleType = scheduleType; }
    public LocalDateTime getEndDateTime() { return endDateTime; }
    public void setEndDateTime(LocalDateTime endDateTime) { this.endDateTime = endDateTime; }
    public User getCreator() { return creator; }
    public void setCreator(User creator) { this.creator = creator; }
    public AgreementStatus getStatus() { return status; }
    public void setStatus(AgreementStatus status) { this.status = status; }
    public List<Participant> getParticipants() { return participants; }
    public void setParticipants(List<Participant> participants) { this.participants = participants; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public void addParticipant(Participant participant) {
        participants.add(participant);
        participant.setAgreement(this);
    }

    public void removeParticipant(Participant participant) {
        participants.remove(participant);
        participant.setAgreement(null);
    }

    public enum ScheduleType {
        POINT, RANGE
    }
}
