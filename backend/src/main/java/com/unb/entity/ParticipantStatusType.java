package com.unb.entity;

public enum ParticipantStatusType {
    WAITING("waiting"),
    AGREED("agreed"),
    DECLINED("declined"),
    SKIPPED("skipped");

    private final String code;

    ParticipantStatusType(String code) {
        this.code = code;
    }

    public String getCode() { return code; }
}
