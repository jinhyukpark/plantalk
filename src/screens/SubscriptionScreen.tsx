import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights } from '../constants/theme';
import { SubscriptionPlanInfo } from '../types';
import { apiService } from '../services/api';
import { purchaseService, PRODUCT_IDS } from '../services/purchaseService';
import { useApp } from '../context/AppContext';
import Card from '../components/Card';
import Button from '../components/Button';

interface ExtendedPlan extends SubscriptionPlanInfo {
  package?: any;
}

export default function SubscriptionScreen() {
  const navigation = useNavigation<any>();
  const bottomPadding = Spacing.lg;
  const { currentUser, subscriptionStatus, refreshSubscriptionStatus } = useApp();
  
  const [plans, setPlans] = useState<ExtendedPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isRevenueCatReady, setIsRevenueCatReady] = useState(false);

  useEffect(() => {
    initializeAndLoadPlans();
  }, []);

  const initializeAndLoadPlans = async () => {
    try {
      await purchaseService.initialize();
      
      if (currentUser) {
        await purchaseService.login(currentUser.id);
      }
      
      const [backendPlans, packages] = await Promise.all([
        apiService.getSubscriptionPlans(),
        purchaseService.getPackages(),
      ]);

      const mergedPlans: ExtendedPlan[] = backendPlans.map(plan => {
        const productId = PRODUCT_IDS[plan.id as keyof typeof PRODUCT_IDS];
        const pkg = packages.find(p => p.product.identifier === productId);
        
        return {
          ...plan,
          package: pkg,
          priceKrw: pkg ? parseFloat(pkg.product.price.toString()) : plan.priceKrw,
        };
      });

      setPlans(mergedPlans);
      setIsRevenueCatReady(packages.length > 0);
    } catch (error) {
      console.error('Failed to load plans:', error);
      try {
        const backendPlans = await apiService.getSubscriptionPlans();
        setPlans(backendPlans);
      } catch (e) {
        console.error('Failed to load backend plans:', e);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (plan: ExtendedPlan) => {
    if (!currentUser) {
      Alert.alert('알림', '로그인이 필요합니다');
      return;
    }

    if (Platform.OS === 'web') {
      Alert.alert('알림', '웹에서는 구독을 구매할 수 없습니다. 모바일 앱을 이용해주세요.');
      return;
    }

    if (!isRevenueCatReady || !plan.package) {
      Alert.alert(
        '결제 준비 중',
        '현재 결제 시스템이 준비되지 않았습니다.\n\n개발 빌드(EAS Build)를 사용하시거나, 잠시 후 다시 시도해주세요.',
        [{ text: '확인' }]
      );
      return;
    }

    setPurchasing(true);
    try {
      const result = await purchaseService.purchasePackage(plan.package);
      
      if (result.success) {
        const expirationDate = result.customerInfo 
          ? purchaseService.getSubscriptionExpirationDate(result.customerInfo)
          : null;
        
        await apiService.purchaseSubscription({
          userId: currentUser.id,
          plan: plan.id,
          platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
          productId: plan.package.product.identifier,
          transactionId: result.customerInfo?.originalAppUserId || `txn_${Date.now()}`,
          receiptData: JSON.stringify({
            customerId: result.customerInfo?.originalAppUserId,
            entitlements: result.customerInfo?.entitlements,
          }),
        });
        
        await refreshSubscriptionStatus();
        
        Alert.alert('성공', '프리미엄 구독이 완료되었습니다! 🎉');
      } else {
        if (result.error !== '구매가 취소되었습니다') {
          Alert.alert('오류', result.error || '구매에 실패했습니다');
        }
      }
    } catch (error: any) {
      console.error('Purchase failed:', error);
      Alert.alert('오류', error.message || '구매 처리 중 오류가 발생했습니다');
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('알림', '웹에서는 구매 복원을 할 수 없습니다.');
      return;
    }

    setRestoring(true);
    try {
      const result = await purchaseService.restorePurchases();
      
      if (result.success) {
        await refreshSubscriptionStatus();
        Alert.alert('성공', '구매가 복원되었습니다!');
      } else {
        Alert.alert('알림', result.error || '복원할 구매 내역이 없습니다');
      }
    } catch (error: any) {
      Alert.alert('오류', error.message || '구매 복원 중 오류가 발생했습니다');
    } finally {
      setRestoring(false);
    }
  };

  const formatPrice = (plan: ExtendedPlan) => {
    if (plan.package) {
      return plan.package.product.priceString;
    }
    return `₩${plan.priceKrw.toLocaleString()}`;
  };

  const getPlanBadge = (planId: string) => {
    if (planId === 'ANNUAL') return '베스트';
    if (planId === 'BIWEEKLY') return '인기';
    return null;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top', 'left', 'right', 'bottom']}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>구독 상품 불러오는 중...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>프리미엄 구독</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: bottomPadding }} showsVerticalScrollIndicator={false}>
        {subscriptionStatus?.isPremium ? (
          <Card style={styles.statusCard}>
            <View style={styles.premiumBadge}>
              <Text style={styles.premiumBadgeText}>PREMIUM</Text>
            </View>
            <Text style={styles.statusTitle}>프리미엄 이용중</Text>
            <Text style={styles.statusDescription}>
              {subscriptionStatus.plan === 'WEEKLY' && '1주일'}
              {subscriptionStatus.plan === 'BIWEEKLY' && '2주일'}
              {subscriptionStatus.plan === 'ANNUAL' && '1년'}
              {' '}구독 중
            </Text>
            {subscriptionStatus.expiresAt && (
              <Text style={styles.expiresText}>
                만료일: {new Date(subscriptionStatus.expiresAt).toLocaleDateString('ko-KR')}
              </Text>
            )}
          </Card>
        ) : (
          <Card style={styles.infoCard}>
            <Ionicons name="star" size={48} color={Colors.warning} style={{ marginBottom: Spacing.sm }} />
            <Text style={styles.infoTitle}>프리미엄 혜택</Text>
            <View style={styles.benefitList}>
              <Text style={styles.benefitItem}>• 광고 없이 사용</Text>
              <Text style={styles.benefitItem}>• 무제한 채팅</Text>
              <Text style={styles.benefitItem}>• 무제한 방 생성</Text>
              <Text style={styles.benefitItem}>• 프리미엄 배지</Text>
            </View>
          </Card>
        )}

        <Text style={styles.sectionTitle}>구독 플랜</Text>
        
        {!isRevenueCatReady && Platform.OS !== 'web' && (
          <View style={styles.previewBanner}>
            <Text style={styles.previewText}>
              📱 미리보기 모드 - 실제 결제를 위해서는 개발 빌드가 필요합니다
            </Text>
          </View>
        )}
        
        {plans.map((plan) => {
          const badge = getPlanBadge(plan.id);
          const isCurrentPlan = subscriptionStatus?.plan === plan.id;
          
          return (
            <TouchableOpacity
              key={plan.id}
              onPress={() => setSelectedPlan(plan.id)}
              disabled={isCurrentPlan}
            >
              <Card
                style={[
                  styles.planCard,
                  selectedPlan === plan.id ? styles.planCardSelected : undefined,
                  isCurrentPlan ? styles.planCardCurrent : undefined,
                ]}
              >
                {badge && (
                  <View style={[
                    styles.planBadge,
                    badge === '베스트' && styles.planBadgeBest,
                  ]}>
                    <Text style={styles.planBadgeText}>{badge}</Text>
                  </View>
                )}
                <View style={styles.planHeader}>
                  <View>
                    <Text style={styles.planName}>{plan.name}</Text>
                    <Text style={styles.planDuration}>{plan.durationDays}일</Text>
                  </View>
                  <View style={styles.planPriceContainer}>
                    <Text style={styles.planPrice}>{formatPrice(plan)}</Text>
                    {plan.id === 'ANNUAL' && (
                      <Text style={styles.planSaving}>58% 할인</Text>
                    )}
                  </View>
                </View>
                <Text style={styles.planDescription}>{plan.description}</Text>
                {isCurrentPlan && (
                  <View style={styles.currentPlanBadge}>
                    <Text style={styles.currentPlanText}>현재 플랜</Text>
                  </View>
                )}
              </Card>
            </TouchableOpacity>
          );
        })}

        {!subscriptionStatus?.isPremium && selectedPlan && (
          <View style={styles.purchaseContainer}>
            <Button
              title={purchasing ? '처리중...' : '구독하기'}
              onPress={() => {
                const plan = plans.find(p => p.id === selectedPlan);
                if (plan) handlePurchase(plan);
              }}
              disabled={purchasing || restoring}
            />
          </View>
        )}

        <TouchableOpacity 
          style={styles.restoreButton}
          onPress={handleRestore}
          disabled={restoring || purchasing}
        >
          <Text style={styles.restoreButtonText}>
            {restoring ? '복원 중...' : '구매 복원'}
          </Text>
        </TouchableOpacity>

        <View style={styles.noteContainer}>
          <Text style={styles.noteText}>
            * 구독은 구매일로부터 시작됩니다
          </Text>
          <Text style={styles.noteText}>
            * 구독은 취소할 때까지 자동으로 갱신됩니다
          </Text>
          <Text style={styles.noteText}>
            * {Platform.OS === 'ios' ? 'App Store' : 'Google Play'} 계정 설정에서 언제든 해지할 수 있습니다
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  backButton: {
    fontSize: 24,
    color: Colors.text,
  },
  headerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    color: Colors.text,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  statusCard: {
    padding: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    backgroundColor: Colors.primary,
  },
  premiumBadge: {
    backgroundColor: Colors.warning,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.sm,
  },
  premiumBadgeText: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.bold,
    color: Colors.card,
  },
  statusTitle: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.card,
    marginBottom: Spacing.xs,
  },
  statusDescription: {
    fontSize: FontSizes.md,
    color: 'rgba(255,255,255,0.8)',
  },
  expiresText: {
    fontSize: FontSizes.sm,
    color: 'rgba(255,255,255,0.6)',
    marginTop: Spacing.sm,
  },
  infoCard: {
    padding: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  infoEmoji: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  infoTitle: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  benefitList: {
    alignSelf: 'stretch',
  },
  benefitItem: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    lineHeight: 28,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  previewBanner: {
    backgroundColor: Colors.warning + '20',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  previewText: {
    fontSize: FontSizes.sm,
    color: Colors.warning,
    textAlign: 'center',
  },
  planCard: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
    position: 'relative',
  },
  planCardSelected: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  planCardCurrent: {
    opacity: 0.6,
  },
  planBadge: {
    position: 'absolute',
    top: -8,
    right: Spacing.md,
    backgroundColor: Colors.error,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  planBadgeBest: {
    backgroundColor: Colors.success,
  },
  planBadgeText: {
    fontSize: 10,
    fontWeight: FontWeights.bold,
    color: Colors.card,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  planName: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    color: Colors.text,
  },
  planDuration: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  planPriceContainer: {
    alignItems: 'flex-end',
  },
  planPrice: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.primary,
  },
  planSaving: {
    fontSize: FontSizes.xs,
    color: Colors.success,
    fontWeight: FontWeights.medium,
  },
  planDescription: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  currentPlanBadge: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.secondary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
  },
  currentPlanText: {
    fontSize: FontSizes.xs,
    color: Colors.primary,
    fontWeight: FontWeights.medium,
  },
  purchaseContainer: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  restoreButton: {
    alignItems: 'center',
    padding: Spacing.md,
  },
  restoreButtonText: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  noteContainer: {
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  noteText: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    lineHeight: 18,
  },
});
