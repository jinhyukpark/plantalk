import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ParticipantStatusType } from '../types';
import { Colors, BorderRadius, Spacing, FontSizes, FontWeights } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';

interface StatusBadgeProps {
  status: ParticipantStatusType;
  size?: 'small' | 'medium';
}

const statusConfig = {
  waiting: { color: Colors.warning, bgColor: 'rgba(245, 158, 11, 0.12)' },
  agreed: { color: Colors.success, bgColor: 'rgba(16, 185, 129, 0.12)' },
  declined: { color: Colors.error, bgColor: 'rgba(255, 78, 78, 0.12)' },
  skipped: { color: Colors.textSecondary, bgColor: 'rgba(156, 163, 175, 0.12)' },
};

export function StatusBadge({ status, size = 'medium' }: StatusBadgeProps) {
  const { t } = useLanguage();
  const config = statusConfig[status];
  
  return (
    <View style={[
      styles.badge, 
      { backgroundColor: config.bgColor },
      size === 'small' && styles.badgeSmall
    ]}>
      <View style={[styles.dot, { backgroundColor: config.color }]} />
      <Text style={[
        styles.text, 
        { color: config.color },
        size === 'small' && styles.textSmall
      ]}>
        {t(`agreement.status.${status}`)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.sm + 4,
    borderRadius: BorderRadius.round,
    gap: 6,
  },
  badgeSmall: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.bold,
  },
  textSmall: {
    fontSize: FontSizes.xs,
  },
});
