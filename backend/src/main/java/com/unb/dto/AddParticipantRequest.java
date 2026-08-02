package com.unb.dto;

import jakarta.validation.constraints.NotBlank;

public class AddParticipantRequest {
    @NotBlank(message = "Participant name is required")
    private String participantName;

    @NotBlank(message = "Requester ID is required")
    private String requesterId;

    public AddParticipantRequest() {}

    public AddParticipantRequest(String participantName, String requesterId) {
        this.participantName = participantName;
        this.requesterId = requesterId;
    }

    public String getParticipantName() {
        return participantName;
    }

    public void setParticipantName(String participantName) {
        this.participantName = participantName;
    }

    public String getRequesterId() {
        return requesterId;
    }

    public void setRequesterId(String requesterId) {
        this.requesterId = requesterId;
    }
}
