package com.unb.controller;

import com.unb.service.SubscriptionService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/webhooks/revenuecat")
public class RevenueCatWebhookController {
    
    private final SubscriptionService subscriptionService;
    
    @Value("${revenuecat.webhook.secret:}")
    private String webhookSecret;
    
    public RevenueCatWebhookController(SubscriptionService subscriptionService) {
        this.subscriptionService = subscriptionService;
    }
    
    @PostMapping
    public ResponseEntity<Map<String, String>> handleWebhook(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, Object> payload) {
        
        if (webhookSecret != null && !webhookSecret.isEmpty()) {
            String expectedAuth = "Bearer " + webhookSecret;
            if (authHeader == null || !authHeader.equals(expectedAuth)) {
                System.err.println("RevenueCat webhook: Invalid or missing authorization");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("status", "error", "message", "Invalid authorization"));
            }
        }
        
        try {
            String eventType = (String) payload.get("type");
            @SuppressWarnings("unchecked")
            Map<String, Object> event = (Map<String, Object>) payload.get("event");
            
            if (event == null) {
                return ResponseEntity.badRequest()
                    .body(Map.of("status", "error", "reason", "no event data"));
            }
            
            String appUserId = (String) event.get("app_user_id");
            String productId = (String) event.get("product_id");
            String store = (String) event.get("store");
            
            System.out.println("RevenueCat webhook received: " + eventType + " for user: " + appUserId + " store: " + store);
            
            String platform = "GOOGLE".equalsIgnoreCase(store) ? "ANDROID" : "IOS";
            
            switch (eventType) {
                case "INITIAL_PURCHASE":
                case "RENEWAL":
                case "PRODUCT_CHANGE":
                    handleSubscriptionActive(appUserId, productId, event, platform);
                    break;
                    
                case "CANCELLATION":
                case "EXPIRATION":
                    handleSubscriptionEnded(appUserId);
                    break;
                    
                case "BILLING_ISSUE":
                    handleBillingIssue(appUserId, event);
                    break;
                    
                case "SUBSCRIBER_ALIAS":
                    break;
                    
                default:
                    System.out.println("Unhandled RevenueCat event type: " + eventType);
            }
            
            return ResponseEntity.ok(Map.of("status", "success"));
            
        } catch (Exception e) {
            System.err.println("Error processing RevenueCat webhook: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("status", "error", "message", e.getMessage()));
        }
    }
    
    private void handleSubscriptionActive(String appUserId, String productId, Map<String, Object> event, String platform) {
        String plan = mapProductIdToPlan(productId);
        if (plan != null) {
            Object expirationObj = event.get("expiration_at_ms");
            Long expirationMs = null;
            if (expirationObj != null) {
                expirationMs = Long.parseLong(expirationObj.toString());
            }
            
            String transactionId = (String) event.get("transaction_id");
            
            subscriptionService.syncSubscriptionFromRevenueCat(
                appUserId,
                plan,
                expirationMs,
                true,
                platform,
                transactionId
            );
        }
    }
    
    private void handleSubscriptionEnded(String appUserId) {
        subscriptionService.handleSubscriptionExpired(appUserId);
    }
    
    private void handleBillingIssue(String appUserId, Map<String, Object> event) {
        System.out.println("Billing issue for user: " + appUserId);
    }
    
    private String mapProductIdToPlan(String productId) {
        if (productId == null) return null;
        
        if (productId.contains("weekly") && !productId.contains("biweekly")) return "WEEKLY";
        if (productId.contains("biweekly")) return "BIWEEKLY";
        if (productId.contains("annual")) return "ANNUAL";
        
        return null;
    }
}
