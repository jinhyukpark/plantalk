package com.unb.service;

public class EmailRateLimitException extends RuntimeException {
    public EmailRateLimitException() {
        super("인증 메일 요청이 너무 많습니다. 15분 후 다시 시도해주세요");
    }
}
