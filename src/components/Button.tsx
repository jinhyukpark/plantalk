import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, BorderRadius, Spacing, FontSizes, FontWeights } from '../constants/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  emoji?: string;
  fullWidth?: boolean;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  style,
  textStyle,
  emoji,
  fullWidth = false,
}: ButtonProps) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const buttonStyles = [
    styles.button,
    styles[variant],
    styles[size],
    disabled && styles.disabled,
    fullWidth && styles.fullWidth,
    style,
  ];

  const textStyles = [
    styles.text,
    styles[`${variant}Text` as keyof typeof styles],
    styles[`${size}Text` as keyof typeof styles],
    disabled && styles.disabledText,
    textStyle,
  ];

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      {emoji && <Text style={styles.emoji}>{emoji}</Text>}
      <Text style={textStyles} numberOfLines={1}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.xl,
    gap: Spacing.sm,
  },
  text: {
    fontWeight: FontWeights.bold,
  },
  emoji: {
    fontSize: FontSizes.lg,
  },
  fullWidth: {
    width: '100%',
  },
  
  primary: {
    backgroundColor: Colors.primary,
  },
  primaryText: {
    color: '#FFFFFF',
  },
  
  secondary: {
    backgroundColor: Colors.secondary,
  },
  secondaryText: {
    color: Colors.primary,
  },
  
  success: {
    backgroundColor: Colors.success,
  },
  successText: {
    color: '#FFFFFF',
  },
  
  danger: {
    backgroundColor: Colors.error,
  },
  dangerText: {
    color: '#FFFFFF',
  },
  
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  outlineText: {
    color: Colors.text,
  },
  
  ghost: {
    backgroundColor: 'transparent',
  },
  ghostText: {
    color: Colors.primary,
  },
  
  small: {
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    minHeight: 36,
    borderRadius: BorderRadius.lg,
  },
  smallText: {
    fontSize: FontSizes.sm,
  },
  
  medium: {
    paddingVertical: Spacing.sm + 4,
    paddingHorizontal: Spacing.lg,
    minHeight: 48,
  },
  mediumText: {
    fontSize: FontSizes.md,
  },
  
  large: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    minHeight: 56,
  },
  largeText: {
    fontSize: FontSizes.lg,
  },
  
  disabled: {
    opacity: 0.5,
  },
  disabledText: {
    opacity: 0.8,
  },
});

export default Button;
