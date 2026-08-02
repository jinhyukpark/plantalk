package com.unb.dto;

public class InviteRoomParticipantRequest {
    private String requesterId;
    private String friendId;

    public String getRequesterId() { return requesterId; }
    public void setRequesterId(String requesterId) { this.requesterId = requesterId; }
    public String getFriendId() { return friendId; }
    public void setFriendId(String friendId) { this.friendId = friendId; }
}
