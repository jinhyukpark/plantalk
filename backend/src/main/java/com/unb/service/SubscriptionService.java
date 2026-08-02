package com.unb.service;

import com.unb.dto.PurchaseSubscriptionRequest;
import com.unb.dto.RecordAdImpressionRequest;
import com.unb.entity.AdImpression;
import com.unb.entity.AdImpression.AdType;
import com.unb.entity.Payment;
import com.unb.entity.Payment.PaymentProvider;
import com.unb.entity.Payment.PaymentStatus;
import com.unb.entity.Subscription;
import com.unb.entity.Subscription.Platform;
import com.unb.entity.Subscription.SubscriptionPlan;
import com.unb.entity.Subscription.SubscriptionStatus;
import com.unb.repository.AdImpressionRepository;
import com.unb.repository.PaymentRepository;
import com.unb.repository.SubscriptionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class SubscriptionService {
    
    private final SubscriptionRepository subscriptionRepository;
    private final PaymentRepository paymentRepository;
    private final AdImpressionRepository adImpressionRepository;
    
    private static final int AD_INTERVAL_MINUTES = 10;
    
    public SubscriptionService(SubscriptionRepository subscriptionRepository,
                               PaymentRepository paymentRepository,
                               AdImpressionRepository adImpressionRepository) {
        this.subscriptionRepository = subscriptionRepository;
        this.paymentRepository = paymentRepository;
        this.adImpressionRepository = adImpressionRepository;
    }
    
    public boolean hasActiveSubscription(String userId) {
        return subscriptionRepository.hasActiveSubscription(userId, LocalDateTime.now());
    }
    
    public Optional<Subscription> getActiveSubscription(String userId) {
        return subscriptionRepository.findActiveSubscription(userId, LocalDateTime.now());
    }
    
    public List<Subscription> getUserSubscriptions(String userId) {
        return subscriptionRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }
    
    @Transactional
    public Subscription purchaseSubscription(PurchaseSubscriptionRequest request) {
        Optional<Subscription> existingActive = subscriptionRepository
            .findActiveSubscription(request.getUserId(), LocalDateTime.now());
        
        if (existingActive.isPresent()) {
            throw new RuntimeException("User already has an active subscription");
        }
        
        SubscriptionPlan plan = SubscriptionPlan.valueOf(request.getPlan().toUpperCase());
        
        Subscription subscription = new Subscription();
        subscription.setUserId(request.getUserId());
        subscription.setPlan(plan);
        subscription.setStatus(SubscriptionStatus.ACTIVE);
        subscription.setPriceKrw(plan.getPriceKrw());
        subscription.setStartedAt(LocalDateTime.now());
        subscription.setExpiresAt(LocalDateTime.now().plusDays(plan.getDurationDays()));
        subscription.setLastTransactionId(request.getTransactionId());
        subscription.setPlatform(Platform.valueOf(request.getPlatform().toUpperCase()));
        
        Subscription savedSubscription = subscriptionRepository.save(subscription);
        
        Payment payment = new Payment();
        payment.setUserId(request.getUserId());
        payment.setSubscriptionId(savedSubscription.getId());
        payment.setProvider(request.getPlatform().equalsIgnoreCase("IOS") ? 
            PaymentProvider.APPLE : PaymentProvider.GOOGLE);
        payment.setProductId(request.getProductId());
        payment.setAmountKrw(plan.getPriceKrw());
        payment.setTransactionId(request.getTransactionId());
        payment.setReceiptData(request.getReceiptData());
        payment.setStatus(PaymentStatus.COMPLETED);
        
        paymentRepository.save(payment);
        
        return savedSubscription;
    }
    
    @Transactional
    public void cancelSubscription(String subscriptionId, String userId) {
        Subscription subscription = subscriptionRepository.findById(subscriptionId)
            .orElseThrow(() -> new RuntimeException("Subscription not found"));
        
        if (!subscription.getUserId().equals(userId)) {
            throw new RuntimeException("Unauthorized");
        }
        
        subscription.setStatus(SubscriptionStatus.CANCELED);
        subscription.setAutoRenew(false);
        subscriptionRepository.save(subscription);
    }
    
    @Transactional
    public void expireSubscriptions() {
        List<Subscription> expired = subscriptionRepository
            .findExpiredSubscriptions(LocalDateTime.now());
        
        for (Subscription subscription : expired) {
            subscription.setStatus(SubscriptionStatus.EXPIRED);
            subscriptionRepository.save(subscription);
        }
    }
    
    public boolean shouldShowAd(String userId) {
        if (hasActiveSubscription(userId)) {
            return false;
        }
        
        AdImpression lastImpression = adImpressionRepository.findLastImpression(userId);
        if (lastImpression == null) {
            return true;
        }
        
        LocalDateTime threshold = LocalDateTime.now().minusMinutes(AD_INTERVAL_MINUTES);
        return lastImpression.getServedAt().isBefore(threshold);
    }
    
    @Transactional
    public AdImpression recordAdImpression(RecordAdImpressionRequest request) {
        AdImpression impression = new AdImpression();
        impression.setUserId(request.getUserId());
        impression.setAdType(AdType.valueOf(request.getAdType().toUpperCase()));
        impression.setAdUnitId(request.getAdUnitId());
        impression.setDurationSeconds(request.getDurationSeconds());
        impression.setCompleted(request.getCompleted() != null ? request.getCompleted() : false);
        
        return adImpressionRepository.save(impression);
    }
    
    public List<AdImpression> getRecentAdImpressions(String userId, int hours) {
        LocalDateTime since = LocalDateTime.now().minusHours(hours);
        return adImpressionRepository.findRecentImpressions(userId, since);
    }
    
    public SubscriptionStatusResponse getSubscriptionStatus(String userId) {
        Optional<Subscription> active = getActiveSubscription(userId);
        boolean isPremium = active.isPresent();
        boolean shouldShowAd = !isPremium && shouldShowAd(userId);
        
        return new SubscriptionStatusResponse(
            isPremium,
            active.map(Subscription::getPlan).map(Enum::name).orElse(null),
            active.map(Subscription::getExpiresAt).orElse(null),
            shouldShowAd
        );
    }
    
    @Transactional
    public void syncSubscriptionFromRevenueCat(String userId, String planName, Long expirationMs, 
                                                boolean isActive, String platformStr, String transactionId) {
        SubscriptionPlan plan = SubscriptionPlan.valueOf(planName.toUpperCase());
        Platform platform = "IOS".equalsIgnoreCase(platformStr) ? Platform.IOS : Platform.ANDROID;
        
        LocalDateTime expirationDate = expirationMs != null 
            ? LocalDateTime.ofInstant(java.time.Instant.ofEpochMilli(expirationMs), java.time.ZoneId.systemDefault())
            : LocalDateTime.now().plusDays(plan.getDurationDays());
        
        List<Subscription> userSubscriptions = subscriptionRepository.findByUserIdOrderByCreatedAtDesc(userId);
        Optional<Subscription> existingForPlan = userSubscriptions.stream()
            .filter(s -> s.getPlan() == plan)
            .findFirst();
        
        Subscription subscription;
        if (existingForPlan.isPresent()) {
            subscription = existingForPlan.get();
            subscription.setExpiresAt(expirationDate);
            subscription.setStatus(isActive ? SubscriptionStatus.ACTIVE : SubscriptionStatus.EXPIRED);
            subscription.setPlatform(platform);
            if (transactionId != null) {
                subscription.setLastTransactionId(transactionId);
            }
        } else if (isActive) {
            subscription = new Subscription();
            subscription.setUserId(userId);
            subscription.setPlan(plan);
            subscription.setStatus(SubscriptionStatus.ACTIVE);
            subscription.setPriceKrw(plan.getPriceKrw());
            subscription.setStartedAt(LocalDateTime.now());
            subscription.setExpiresAt(expirationDate);
            subscription.setPlatform(platform);
            subscription.setLastTransactionId(transactionId);
        } else {
            return;
        }
        
        Subscription savedSubscription = subscriptionRepository.save(subscription);
        
        if (isActive && transactionId != null) {
            boolean paymentExists = paymentRepository.findByTransactionId(transactionId).isPresent();
            if (!paymentExists) {
                Payment payment = new Payment();
                payment.setUserId(userId);
                payment.setSubscriptionId(savedSubscription.getId());
                payment.setProvider(platform == Platform.IOS ? PaymentProvider.APPLE : PaymentProvider.GOOGLE);
                payment.setProductId("plantalk_premium_" + planName.toLowerCase());
                payment.setAmountKrw(plan.getPriceKrw());
                payment.setTransactionId(transactionId);
                payment.setReceiptData("revenuecat_webhook");
                payment.setStatus(PaymentStatus.COMPLETED);
                paymentRepository.save(payment);
            }
        }
    }
    
    @Transactional
    public void handleSubscriptionExpired(String userId) {
        List<Subscription> activeSubscriptions = subscriptionRepository.findByUserIdOrderByCreatedAtDesc(userId)
            .stream()
            .filter(s -> s.getStatus() == SubscriptionStatus.ACTIVE)
            .toList();
        
        for (Subscription subscription : activeSubscriptions) {
            subscription.setStatus(SubscriptionStatus.EXPIRED);
            subscriptionRepository.save(subscription);
        }
    }
    
    public static class SubscriptionStatusResponse {
        private boolean isPremium;
        private String plan;
        private LocalDateTime expiresAt;
        private boolean shouldShowAd;
        
        public SubscriptionStatusResponse(boolean isPremium, String plan, 
                                          LocalDateTime expiresAt, boolean shouldShowAd) {
            this.isPremium = isPremium;
            this.plan = plan;
            this.expiresAt = expiresAt;
            this.shouldShowAd = shouldShowAd;
        }
        
        public boolean isPremium() { return isPremium; }
        public String getPlan() { return plan; }
        public LocalDateTime getExpiresAt() { return expiresAt; }
        public boolean isShouldShowAd() { return shouldShowAd; }
    }
}
