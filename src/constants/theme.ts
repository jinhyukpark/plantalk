export const Colors = {
  primary: '#6B4EFF', // Vibrant Indigo
  primaryLight: '#8A73FF',
  primaryDark: '#4F33FF',
  secondary: '#F3F0FF',
  secondaryLight: '#F9F8FF',
  accent: '#FF4E7E', // Coral pink for accents
  accentLight: '#FFEBF0',
  
  background: '#F8F9FB', // Slightly cool off-white
  card: '#FFFFFF',
  cardBorder: '#EFEFEF',
  border: '#E8E8E8',
  
  text: '#1A1C29',
  textSecondary: '#6B7280',
  textLight: '#9CA3AF',
  textMuted: '#D1D5DB',
  textTertiary: '#9CA3AF',
  
  success: '#10B981',
  error: '#FF4E4E',
  warning: '#F59E0B',
  info: '#3B82F6',
  
  agreed: '#10B981',
  declined: '#FF4E4E',
  waiting: '#F59E0B',
  skipped: '#9CA3AF',
  
  divider: '#F1F2F4',
  overlay: 'rgba(10, 15, 30, 0.4)',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const TAB_BAR_HEIGHT = 64;
export const BOTTOM_CONTENT_PADDING = 140;
// Gesture navigation can occasionally report 0 inside a transparent Modal.
// Keep only a small fallback; three-button navigation reports its actual larger inset.
export const SYSTEM_NAV_BOTTOM_FALLBACK = 24;

export const getSafeBottomPadding = (bottomInset: number, extra = Spacing.lg) =>
  Math.max(bottomInset, SYSTEM_NAV_BOTTOM_FALLBACK) + extra;

export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 26,
  round: 9999,
  full: 9999,
};

export const FontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  huge: 36,
};

export const FontWeights = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const Shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  small: {
    shadowColor: '#1A1C29',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  medium: {
    shadowColor: '#1A1C29',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  large: {
    shadowColor: '#1A1C29',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
  },
};

export const Typography = {
  h1: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.bold,
    color: Colors.text,
    lineHeight: 38,
  },
  h2: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.text,
    lineHeight: 30,
  },
  h3: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    color: Colors.text,
    lineHeight: 26,
  },
  body: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.regular,
    color: Colors.text,
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.regular,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  caption: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.medium,
    color: Colors.textLight,
    lineHeight: 16,
  },
};
