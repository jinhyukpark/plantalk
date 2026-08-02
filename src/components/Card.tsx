import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Colors, BorderRadius, Shadows, Spacing } from '../constants/theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'outlined' | 'elevated' | 'glass';
}

export function Card({ children, style, variant = 'default' }: CardProps) {
  const cardStyle = [
    styles.card,
    variant === 'outlined' && styles.outlined,
    variant === 'elevated' && styles.elevated,
    variant === 'glass' && styles.glass,
    style,
  ];

  return (
    <View style={cardStyle}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.small,
  },
  outlined: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    ...Shadows.none,
  },
  elevated: {
    backgroundColor: Colors.card,
    ...Shadows.medium,
  },
  glass: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    ...Shadows.none,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  }
});

export default Card;
