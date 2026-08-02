package com.unb.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;

@Service
public class AdminAuthService {

    private static final long TOKEN_VALIDITY_MILLIS = 8L * 60 * 60 * 1000;
    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final long LOCKOUT_MILLIS = 5L * 60 * 1000;

    private final java.util.concurrent.atomic.AtomicInteger failedAttempts =
        new java.util.concurrent.atomic.AtomicInteger(0);
    private volatile long lockedUntil = 0;

    @Value("${ADMIN_USERNAME:admin}")
    private String adminUsername;

    @Value("${ADMIN_PASSWORD:}")
    private String adminPassword;

    public boolean isConfigured() {
        return adminPassword != null && !adminPassword.isBlank();
    }

    public boolean isLockedOut() {
        return System.currentTimeMillis() < lockedUntil;
    }

    public long lockoutRemainingSeconds() {
        long remaining = lockedUntil - System.currentTimeMillis();
        return remaining > 0 ? (remaining + 999) / 1000 : 0;
    }

    public boolean checkCredentials(String username, String password) {
        if (!isConfigured() || username == null || password == null || isLockedOut()) {
            return false;
        }
        boolean userOk = MessageDigest.isEqual(
            username.getBytes(StandardCharsets.UTF_8),
            adminUsername.getBytes(StandardCharsets.UTF_8));
        boolean passOk = MessageDigest.isEqual(
            password.getBytes(StandardCharsets.UTF_8),
            adminPassword.getBytes(StandardCharsets.UTF_8));
        boolean ok = userOk && passOk;
        if (ok) {
            failedAttempts.set(0);
        } else {
            if (failedAttempts.incrementAndGet() >= MAX_FAILED_ATTEMPTS) {
                lockedUntil = System.currentTimeMillis() + LOCKOUT_MILLIS;
                failedAttempts.set(0);
            }
        }
        return ok;
    }

    public String createToken() {
        long expiry = System.currentTimeMillis() + TOKEN_VALIDITY_MILLIS;
        String payload = adminUsername + "|" + expiry;
        String encodedPayload = Base64.getUrlEncoder().withoutPadding()
            .encodeToString(payload.getBytes(StandardCharsets.UTF_8));
        return encodedPayload + "." + sign(payload);
    }

    public boolean validateToken(String token) {
        if (!isConfigured() || token == null || token.isBlank()) {
            return false;
        }
        String[] parts = token.split("\\.");
        if (parts.length != 2) {
            return false;
        }
        String payload;
        try {
            payload = new String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            return false;
        }
        String expectedSig = sign(payload);
        if (!MessageDigest.isEqual(
                parts[1].getBytes(StandardCharsets.UTF_8),
                expectedSig.getBytes(StandardCharsets.UTF_8))) {
            return false;
        }
        String[] payloadParts = payload.split("\\|");
        if (payloadParts.length != 2) {
            return false;
        }
        try {
            long expiry = Long.parseLong(payloadParts[1]);
            return System.currentTimeMillis() < expiry;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    private String sign(String payload) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] key = digest.digest(("plantalk-admin-hmac:" + adminPassword)
                .getBytes(StandardCharsets.UTF_8));
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            byte[] sig = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(sig);
        } catch (NoSuchAlgorithmException | java.security.InvalidKeyException e) {
            throw new IllegalStateException("Failed to sign admin token", e);
        }
    }
}
