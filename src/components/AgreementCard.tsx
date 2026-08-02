import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Agreement, getAgreementStatus, getCategoryInfo } from '../types';
import { Card } from './Card';
import { StatusBadge } from './StatusBadge';
import { Colors, Spacing, FontSizes, BorderRadius, FontWeights, Shadows } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';

interface AgreementCardProps {
  agreement: Agreement;
  currentUserName: string;
  onPress: () => void;
}

export function AgreementCard({ agreement, currentUserName, onPress }: AgreementCardProps) {
  const { t, language } = useLanguage();
  const categoryInfo = getCategoryInfo(agreement.category);
  const status = getAgreementStatus(agreement);
  const userParticipant = agreement.participants.find(p => p.userName === currentUserName);
  
  const formatDate = (date: Date | null) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleString(
      language === 'ko' ? 'ko-KR' : language === 'ja' ? 'ja-JP' : 'en-US',
      { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
    );
  };

  const formatSchedule = () => {
    if (!agreement.dateTime) return '';
    const start = formatDate(agreement.dateTime);
    if (agreement.scheduleType !== 'RANGE' || !agreement.endDateTime) return start;
    return `${start} ~ ${formatDate(agreement.endDateTime)}`;
  };

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.card} variant="default">
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatar}>{agreement.emoji || categoryInfo.emoji}</Text>
          </View>
          <View style={styles.headerContent}>
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={1}>{agreement.title}</Text>
              {status === 'completed' && (
                <View style={styles.completedBadge}>
                  <Ionicons name="checkmark-circle" size={14} color="#FFF" />
                  <Text style={styles.completedText}>{t('agreement.completed')}</Text>
                </View>
              )}
            </View>
            <View style={styles.dateRow}>
              <Ionicons name="time-outline" size={14} color={agreement.dateTime ? Colors.primary : Colors.textLight} />
              {agreement.dateTime ? (
                <Text style={styles.dateTime} numberOfLines={2}>{formatSchedule()}</Text>
              ) : (
                <Text style={styles.noDate}>{t('agreement.noDate')}</Text>
              )}
            </View>
          </View>
        </View>
        
        {agreement.description && (
          <Text style={styles.description} numberOfLines={2}>
            {agreement.description}
          </Text>
        )}
        
        <View style={styles.footer}>
          <View style={styles.participantsContainer}>
            {agreement.participants.slice(0, 4).map((p, index) => (
              <View 
                key={p.id} 
                style={[
                  styles.participantAvatar,
                  { marginLeft: index > 0 ? -8 : 0, zIndex: 10 - index }
                ]}
              >
                <Text style={styles.participantInitial}>
                  {p.userName.charAt(0).toUpperCase()}
                </Text>
              </View>
            ))}
            {agreement.participants.length > 4 && (
              <View style={[styles.participantAvatar, styles.moreAvatar, { marginLeft: -8 }]}>
                <Text style={styles.moreText}>+{agreement.participants.length - 4}</Text>
              </View>
            )}
            <Text style={styles.participantCount}>
              {t('agreement.peopleCount', { count: String(agreement.participants.length) })}
            </Text>
          </View>
          
          {userParticipant && (
            <StatusBadge status={userParticipant.status} size="small" />
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  avatar: {
    fontSize: 24,
  },
  headerContent: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 4,
  },
  title: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: Colors.text,
    flex: 1,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateTime: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
    fontWeight: FontWeights.medium,
  },
  noDate: {
    fontSize: FontSizes.sm,
    color: Colors.textLight,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.round,
    gap: 2,
  },
  completedText: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.bold,
    color: '#FFFFFF',
  },
  description: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  participantsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.secondaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.card,
  },
  participantInitial: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.bold,
    color: Colors.primary,
  },
  moreAvatar: {
    backgroundColor: Colors.border,
  },
  moreText: {
    fontSize: 10,
    fontWeight: FontWeights.bold,
    color: Colors.textSecondary,
  },
  participantCount: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginLeft: Spacing.sm,
    fontWeight: FontWeights.medium,
  },
});
