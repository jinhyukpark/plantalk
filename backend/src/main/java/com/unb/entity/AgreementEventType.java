package com.unb.entity;

public enum AgreementEventType {
    CREATED("created"),
    PARTICIPANT_ADDED("participant_added"),
    PARTICIPANT_RESPONDED("participant_responded"),
    STATUS_CHANGED("status_changed"),
    CONTENT_UPDATED("content_updated"),
    CONSENT_RESET("consent_reset");

    private final String code;

    AgreementEventType(String code) {
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
