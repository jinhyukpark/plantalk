import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { AgreementCard } from '../components/AgreementCard';
import { useApp } from '../context/AppContext';
import { getAgreementStatus } from '../types';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows, FontWeights, TAB_BAR_HEIGHT } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useNotification } from '../context/NotificationContext';

export function HomeScreen() {
  const navigation = useNavigation<any>();
  const { user, agreements, unreadNotificationCount, avatarSettings, refreshAgreements } = useApp();
  const { realtimeEvent } = useNotification();
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const bottomPadding = insets.bottom + TAB_BAR_HEIGHT + Spacing.lg;
  const [profileImageFailed, setProfileImageFailed] = useState(false);

  const profileImageUri = user?.profilePictureUrl
    || (avatarSettings?.type === 'photo' ? avatarSettings.photoUri : undefined);
  const profileEmoji = !profileImageUri ? (avatarSettings?.emoji || '') : '';
  const profileFallback = profileEmoji || user?.nickname?.charAt(0).toUpperCase() || '?';
  const profileBackgroundColor = profileEmoji
    ? (avatarSettings?.color || Colors.primary)
    : Colors.primary;

  useEffect(() => {
    setProfileImageFailed(false);
  }, [profileImageUri]);

  useFocusEffect(useCallback(() => {
    void refreshAgreements(true);
  }, [refreshAgreements]));

  useEffect(() => {
    if (realtimeEvent?.type === 'AGREEMENTS') {
      void refreshAgreements(true);
    }
  }, [realtimeEvent, refreshAgreements]);

  const { pendingAgreements, upcomingAgreements, stats } = useMemo(() => {
    // '대기중'은 약속 전체의 진행 상태가 아니라 현재 사용자가 아직
    // 수락/거절하지 않은 참여 요청만 의미한다.
    const pending = agreements.filter(agreement =>
      agreement.participants.some(participant =>
        participant.userName === user?.nickname && participant.status === 'waiting'
      )
    );
    
    const upcoming = agreements.filter(a => {
      if (!a.dateTime) return false;
      const agreementDate = new Date(a.dateTime);
      const now = new Date();
      const myParticipation = a.participants.find(
        participant => participant.userName === user?.nickname
      );
      return agreementDate > now
        && myParticipation?.status === 'agreed'
        && getAgreementStatus(a) !== 'completed';
    }).sort((a, b) => new Date(a.dateTime!).getTime() - new Date(b.dateTime!).getTime());
    
    const total = agreements.length;
    const completed = agreements.filter(a => getAgreementStatus(a) === 'completed').length;
    const declined = agreements.filter(a => getAgreementStatus(a) === 'declined').length;
    
    return {
      pendingAgreements: pending,
      upcomingAgreements: upcoming,
      stats: { total, completed, declined, pending: pending.length }
    };
  }, [agreements, user?.nickname]);

  const today = new Date();
  const dateString = today.toLocaleDateString(
    language === 'ko' ? 'ko-KR' : language === 'ja' ? 'ja-JP' : 'en-US',
    { month: 'long', day: 'numeric', weekday: 'long' }
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView 
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.dateText}>{dateString}</Text>
            <Text style={styles.greeting}>{t('home.greeting', { name: user?.nickname || '' })}</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={styles.notificationBtn}
              onPress={() => navigation.navigate('Notifications')}
            >
              <Ionicons name="notifications-outline" size={24} color={Colors.text} />
              {unreadNotificationCount > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.avatarSmall, { backgroundColor: profileBackgroundColor }]}
              onPress={() => navigation.getParent()?.navigate('ProfileTab')}
            >
              {profileImageUri && !profileImageFailed ? (
                <Image
                  source={{ uri: profileImageUri }}
                  style={styles.avatarSmallImage}
                  resizeMode="cover"
                  onError={() => setProfileImageFailed(true)}
                />
              ) : (
                <Text style={[styles.avatarSmallText, profileEmoji && styles.avatarSmallEmoji]}>
                  {profileFallback}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.total}</Text>
            <Text style={styles.statLabel}>{t('home.totalPromises')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: Colors.success }]}>{stats.completed}</Text>
            <Text style={styles.statLabel}>{t('home.completed')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: Colors.warning }]}>{stats.pending}</Text>
            <Text style={styles.statLabel}>{t('home.pending')}</Text>
          </View>
        </View>

        {pendingAgreements.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('home.awaitingResponse')}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingAgreements.length}</Text>
              </View>
            </View>
            {pendingAgreements.map(agreement => (
              <AgreementCard
                key={agreement.id}
                agreement={agreement}
                currentUserName={user?.nickname || ''}
                onPress={() => navigation.navigate('AgreementDetail', { agreementId: agreement.id })}
              />
            ))}
          </View>
        )}

        {upcomingAgreements.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('home.upcoming')}</Text>
            </View>
            {upcomingAgreements.slice(0, 3).map(agreement => (
              <AgreementCard
                key={agreement.id}
                agreement={agreement}
                currentUserName={user?.nickname || ''}
                onPress={() => navigation.navigate('AgreementDetail', { agreementId: agreement.id })}
              />
            ))}
          </View>
        )}

        {agreements.length === 0 && (
          <Card style={styles.emptyCard} variant="outlined">
            <View style={styles.emptyIconContainer}>
              <Ionicons name="calendar-outline" size={48} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>{t('home.firstPromise')}</Text>
            <Text style={styles.emptyText}>
              {t('home.firstPromiseHint')}
            </Text>
          </Card>
        )}

        {agreements.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('home.recentPromises')}</Text>
              <TouchableOpacity onPress={() => navigation.navigate('HomeHistory')} style={styles.seeAllBtn}>
                <Text style={styles.seeAllText}>{t('home.seeAll')}</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
              </TouchableOpacity>
            </View>
            {agreements.slice(0, 5).map(agreement => (
              <AgreementCard
                key={agreement.id}
                agreement={agreement}
                currentUserName={user?.nickname || ''}
                onPress={() => navigation.navigate('AgreementDetail', { agreementId: agreement.id })}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateAgreement')}
        activeOpacity={0.9}
      >
        <Ionicons name="add" size={32} color="#FFFFFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    paddingTop: Spacing.sm,
  },
  dateText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: 4,
    fontWeight: FontWeights.medium,
  },
  greeting: {
    fontSize: FontSizes.xl,
    color: Colors.text,
    fontWeight: FontWeights.medium,
  },
  userName: {
    fontWeight: FontWeights.bold,
    color: Colors.primary,
  },
  avatarSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    ...Shadows.small,
  },
  avatarSmallImage: {
    width: '100%',
    height: '100%',
  },
  avatarSmallText: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: '#FFFFFF',
  },
  avatarSmallEmoji: {
    fontSize: 24,
    fontWeight: FontWeights.regular,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    ...Shadows.small,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.divider,
    marginHorizontal: Spacing.md,
  },
  statNumber: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.bold,
    color: Colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeights.medium,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: Colors.text,
  },
  badge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.round,
  },
  badgeText: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.bold,
    color: '#FFFFFF',
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllText: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
    fontWeight: FontWeights.bold,
  },
  emptyCard: {
    alignItems: 'center',
    padding: Spacing.xxl,
    marginVertical: Spacing.xl,
    backgroundColor: Colors.card,
    borderWidth: 0,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: Spacing.xl,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.large,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...Shadows.small,
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: Colors.card,
  },
  notificationBadgeText: {
    fontSize: 10,
    fontWeight: FontWeights.bold,
    color: '#FFFFFF',
  },
});
