import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { getAgreementStatus, getCategoryInfo } from '../types';
import {
  Colors,
  Spacing,
  FontSizes,
  BorderRadius,
  FontWeights,
  Shadows,
  TAB_BAR_HEIGHT,
} from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';

type PeriodFilter = 'all' | '1month' | '3months' | '1year';

export function CalendarScreen() {
  const navigation = useNavigation<any>();
  const { agreements } = useApp();
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const bottomPadding = insets.bottom + TAB_BAR_HEIGHT + Spacing.lg;
  const [selectedTab, setSelectedTab] = useState<'all' | 'pending' | 'completed'>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodFilter>('all');

  const filteredAgreements = agreements.filter(agreement => {
    const status = getAgreementStatus(agreement);
    if (selectedTab === 'pending' && status !== 'pending') return false;
    if (selectedTab === 'completed' && status !== 'completed') return false;
    if (selectedPeriod === 'all') return true;
    if (!agreement.dateTime) return false;

    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    if (selectedPeriod === '1month') cutoff.setMonth(cutoff.getMonth() - 1);
    if (selectedPeriod === '3months') cutoff.setMonth(cutoff.getMonth() - 3);
    if (selectedPeriod === '1year') cutoff.setFullYear(cutoff.getFullYear() - 1);
    return new Date(agreement.dateTime) >= cutoff;
  });

  const groupedAgreements = filteredAgreements.reduce((groups, agreement) => {
    const date = agreement.dateTime
      ? new Date(agreement.dateTime).toLocaleDateString(
          language === 'ko' ? 'ko-KR' : language === 'ja' ? 'ja-JP' : 'en-US', {
          month: 'long',
          day: 'numeric',
          weekday: 'short',
        })
      : t('history.noDate');
    if (!groups[date]) groups[date] = [];
    groups[date].push(agreement);
    return groups;
  }, {} as Record<string, typeof agreements>);

  const sortedDates = Object.keys(groupedAgreements).sort((a, b) => {
    if (a === t('history.noDate')) return 1;
    if (b === t('history.noDate')) return -1;
    return 0;
  });

  const statusFilters = [
    { id: 'all', label: t('history.all'), icon: 'list' },
    { id: 'pending', label: t('history.pending'), icon: 'time' },
    { id: 'completed', label: t('history.completed'), icon: 'checkmark-circle' },
  ] as const;

  const periodFilters: { id: PeriodFilter; label: string }[] = [
    { id: 'all', label: t('history.allPeriods') },
    { id: '1month', label: t('history.oneMonth') },
    { id: '3months', label: t('history.threeMonths') },
    { id: '1year', label: t('history.oneYear') },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={27} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('history.title')}</Text>
      </View>

      <View style={styles.statusFilterRow}>
        {statusFilters.map(filter => (
          <TouchableOpacity
            key={filter.id}
            style={[
              styles.statusChip,
              selectedTab === filter.id && styles.statusChipActive,
            ]}
            onPress={() => setSelectedTab(filter.id)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={filter.icon}
              size={16}
              color={selectedTab === filter.id ? Colors.primary : Colors.textSecondary}
            />
            <Text
              style={[
                styles.statusText,
                selectedTab === filter.id && styles.statusTextActive,
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.periodFilterRow}>
        <Ionicons name="calendar-outline" size={16} color={Colors.textSecondary} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.periodFilterContent}
        >
          {periodFilters.map(filter => (
            <TouchableOpacity
              key={filter.id}
              style={[
                styles.periodChip,
                selectedPeriod === filter.id && styles.periodChipActive,
              ]}
              onPress={() => setSelectedPeriod(filter.id)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.periodText,
                  selectedPeriod === filter.id && styles.periodTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {filteredAgreements.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-clear-outline" size={64} color={Colors.textLight} />
            <Text style={styles.emptyText}>{t('history.empty')}</Text>
          </View>
        ) : (
          sortedDates.map(date => (
            <View key={date} style={styles.dateGroup}>
              <Text style={styles.dateHeader}>{date}</Text>
              {groupedAgreements[date].map(agreement => {
                const status = getAgreementStatus(agreement);
                const categoryInfo = getCategoryInfo(agreement.category);

                return (
                  <TouchableOpacity
                    key={agreement.id}
                    onPress={() =>
                      navigation.navigate('AgreementDetail', { agreementId: agreement.id })
                    }
                    activeOpacity={0.7}
                  >
                    <View style={styles.agreementCard}>
                      <View style={styles.avatarContainer}>
                        <Text style={styles.agreementEmoji}>
                          {agreement.emoji || categoryInfo.emoji}
                        </Text>
                      </View>

                      <View style={styles.agreementInfo}>
                        <View style={styles.titleRow}>
                          <Text style={styles.agreementTitle} numberOfLines={2}>
                            {agreement.title}
                          </Text>
                          <View style={styles.trailingMeta}>
                            {agreement.dateTime && (
                              <Text style={styles.agreementTime}>
                                {new Date(agreement.dateTime).toLocaleTimeString('ko-KR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </Text>
                            )}
                            <View
                              style={[
                                styles.statusIndicator,
                                {
                                  backgroundColor:
                                    status === 'completed'
                                      ? Colors.success
                                      : status === 'declined'
                                        ? Colors.error
                                        : Colors.warning,
                                },
                              ]}
                            />
                          </View>
                        </View>

                        <Text style={styles.participantInfo} numberOfLines={1}>
                          {agreement.participants.map(participant => participant.userName).join(', ')}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.bold,
    color: Colors.text,
  },
  statusFilterRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: 8,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  statusChipActive: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.primary,
  },
  statusText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: FontWeights.bold,
  },
  statusTextActive: {
    color: Colors.primary,
  },
  periodFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: 8,
  },
  periodFilterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: Spacing.lg,
    gap: 8,
  },
  periodChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.card,
  },
  periodChipActive: {
    backgroundColor: Colors.secondary,
  },
  periodText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: FontWeights.medium,
  },
  periodTextActive: {
    color: Colors.primary,
    fontWeight: FontWeights.bold,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 0,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl * 2,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    fontWeight: FontWeights.medium,
  },
  dateGroup: {
    marginBottom: Spacing.lg,
  },
  dateHeader: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.bold,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  agreementCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
    marginBottom: Spacing.sm,
    ...Shadows.small,
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  agreementEmoji: {
    fontSize: 22,
  },
  agreementInfo: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  agreementTitle: {
    flex: 1,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
    color: Colors.text,
    lineHeight: 21,
  },
  trailingMeta: {
    minWidth: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    paddingTop: 2,
  },
  agreementTime: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeights.medium,
  },
  participantInfo: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeights.medium,
    marginTop: 5,
  },
  statusIndicator: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
});
