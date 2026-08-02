package com.unb.service;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/**
 * Sends account-recovery email through Gmail SMTP.
 * Credentials are supplied only through server environment variables.
 */
@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final String smtpHost;
    private final String mailFrom;
    private final String smtpUsername;
    private final boolean smtpAuth;

    public EmailService(
            ObjectProvider<JavaMailSender> mailSenderProvider,
            @Value("${spring.mail.host:}") String smtpHost,
            @Value("${plantalk.mail.from:}") String mailFrom,
            @Value("${spring.mail.username:}") String smtpUsername,
            @Value("${spring.mail.properties.mail.smtp.auth:true}") boolean smtpAuth) {
        this.mailSenderProvider = mailSenderProvider;
        this.smtpHost = smtpHost == null ? "" : smtpHost.trim();
        this.mailFrom = mailFrom == null ? "" : mailFrom.trim();
        this.smtpUsername = smtpUsername == null ? "" : smtpUsername.trim();
        this.smtpAuth = smtpAuth;
    }

    @PostConstruct
    void reportConfiguration() {
        if (smtpAuth && smtpUsername.isEmpty()) {
            log.error("Gmail account recovery email is NOT ready: set MAIL_USERNAME and MAIL_PASSWORD");
        } else if (mailFrom.isEmpty()) {
            log.error("Gmail account recovery email is NOT ready: set MAIL_FROM");
        } else {
            log.info("Gmail account recovery email is ready: host={}, from={}", smtpHost, maskEmail(mailFrom));
        }
    }

    /**
     * Send a plain-text email. Throws on failure so callers can decide whether to
     * swallow (e.g. anti-enumeration flows) or surface the error.
     */
    public void sendEmail(String to, String subject, String body) {
        sendWithSmtp(to, subject, body);
    }

    private void sendWithSmtp(String to, String subject, String body) {
        if (smtpAuth && smtpUsername.isEmpty()) {
            throw new IllegalStateException("SMTP 인증 계정이 설정되지 않았습니다");
        }
        if (mailFrom.isEmpty()) {
            throw new IllegalStateException("발신 이메일 주소가 설정되지 않았습니다");
        }
        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            throw new IllegalStateException("SMTP mail sender is not available");
        }

        SimpleMailMessage message = new SimpleMailMessage();
        if (!mailFrom.isEmpty()) {
            message.setFrom(mailFrom);
        }
        message.setTo(to);
        message.setSubject(subject);
        message.setText(body);
        try {
            mailSender.send(message);
        } catch (RuntimeException e) {
            log.error("SMTP email send failed: {}", e.getMessage());
            throw new RuntimeException("이메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요", e);
        }
    }

    private String maskEmail(String email) {
        int at = email.indexOf('@');
        if (at <= 1) return "***";
        return email.substring(0, 1) + "***" + email.substring(at);
    }
}
