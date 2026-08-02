package com.unb.controller;

import com.unb.dto.PurchaseSubscriptionRequest;
import com.unb.dto.RecordAdImpressionRequest;
import com.unb.entity.AdImpression;
import com.unb.entity.Subscription;
import com.unb.entity.Subscription.SubscriptionPlan;
import com.unb.service.SubscriptionService;
import com.unb.service.SubscriptionService.SubscriptionStatusResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/subscriptions")
public class SubscriptionController {
    
    private final SubscriptionService subscriptionService;
    
    public SubscriptionController(SubscriptionService subscriptionService) {
        this.subscriptionService = subscriptionService;
    }
    
    @GetMapping("/plans")
    public ResponseEntity<List<Map<String, Object>>> getPlans() {
        List<Map<String, Object>> plans = Arrays.stream(SubscriptionPlan.values())
            .map(plan -> {
                Map<String, Object> planInfo = new HashMap<>();
                planInfo.put("id", plan.name());
                planInfo.put("name", getPlanDisplayName(plan));
                planInfo.put("priceKrw", plan.getPriceKrw());
                planInfo.put("durationDays", plan.getDurationDays());
                planInfo.put("description", getPlanDescription(plan));
                return planInfo;
            })
            .collect(Collectors.toList());
        return ResponseEntity.ok(plans);
    }
    
    @GetMapping("/status/{userId}")
    public ResponseEntity<SubscriptionStatusResponse> getSubscriptionStatus(@PathVariable String userId) {
        SubscriptionStatusResponse status = subscriptionService.getSubscriptionStatus(userId);
        return ResponseEntity.ok(status);
    }
    
    @GetMapping("/user/{userId}")
    public ResponseEntity<List<Subscription>> getUserSubscriptions(@PathVariable String userId) {
        List<Subscription> subscriptions = subscriptionService.getUserSubscriptions(userId);
        return ResponseEntity.ok(subscriptions);
    }
    
    @PostMapping("/purchase")
    public ResponseEntity<?> purchaseSubscription(@RequestBody PurchaseSubscriptionRequest request) {
        try {
            Subscription subscription = subscriptionService.purchaseSubscription(request);
            return ResponseEntity.ok(subscription);
        } catch (RuntimeException e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    @PostMapping("/{subscriptionId}/cancel")
    public ResponseEntity<Void> cancelSubscription(
            @PathVariable String subscriptionId,
            @RequestParam String userId) {
        try {
            subscriptionService.cancelSubscription(subscriptionId, userId);
            return ResponseEntity.ok().build();
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }
    
    @GetMapping("/should-show-ad/{userId}")
    public ResponseEntity<Map<String, Boolean>> shouldShowAd(@PathVariable String userId) {
        boolean shouldShow = subscriptionService.shouldShowAd(userId);
        Map<String, Boolean> result = new HashMap<>();
        result.put("shouldShowAd", shouldShow);
        return ResponseEntity.ok(result);
    }
    
    @PostMapping("/ads/impression")
    public ResponseEntity<AdImpression> recordAdImpression(@RequestBody RecordAdImpressionRequest request) {
        AdImpression impression = subscriptionService.recordAdImpression(request);
        return ResponseEntity.ok(impression);
    }
    
    @GetMapping("/ads/recent/{userId}")
    public ResponseEntity<List<AdImpression>> getRecentAdImpressions(
            @PathVariable String userId,
            @RequestParam(defaultValue = "24") int hours) {
        List<AdImpression> impressions = subscriptionService.getRecentAdImpressions(userId, hours);
        return ResponseEntity.ok(impressions);
    }
    
    private String getPlanDisplayName(SubscriptionPlan plan) {
        switch (plan) {
            case WEEKLY: return "1주일";
            case BIWEEKLY: return "2주일";
            case ANNUAL: return "1년";
            default: return plan.name();
        }
    }
    
    private String getPlanDescription(SubscriptionPlan plan) {
        switch (plan) {
            case WEEKLY: return "광고 없이 모든 기능 이용 (7일)";
            case BIWEEKLY: return "광고 없이 모든 기능 이용 (14일)";
            case ANNUAL: return "광고 없이 모든 기능 이용 (365일) - 최고의 가치!";
            default: return "";
        }
    }
}
