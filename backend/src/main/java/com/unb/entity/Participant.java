package com.unb.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "participants")
public class Participant {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agreement_id", nullable = false)
    private Agreement agreement;

    @Column(name = "user_name", nullable = false)
    private String userName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ParticipantStatusType status = ParticipantStatusType.WAITING;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public Participant() {}

    public Participant(String userName) {
        this.userName = userName;
        this.status = ParticipantStatusType.WAITING;
    }

    public Participant(String userName, ParticipantStatusType status) {
        this.userName = userName;
        this.status = status;
        if (status != ParticipantStatusType.WAITING) {
            this.updatedAt = LocalDateTime.now();
        }
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public Agreement getAgreement() { return agreement; }
    public void setAgreement(Agreement agreement) { this.agreement = agreement; }
    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }
    public ParticipantStatusType getStatus() { return status; }
    public void setStatus(ParticipantStatusType status) {
        this.status = status;
        this.updatedAt = LocalDateTime.now();
    }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
