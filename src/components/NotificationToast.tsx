import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights, Shadows } from '../constants/theme';
import { Notification, NotificationType } from '../types';

const { width } = Dimensions.get('window');

interface NotificationToastProps {
  notification: Notification | null;
  onPress: (notification: Notification) => void;
  onDismiss: () => void;
  duration?: number;
}

const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case 'ROOM_MESSAGE':
      return <Ionicons name="chatbubble" size={20} color={Colors.primary} />;
    case 'AGREEMENT_CREATED':
      return <Ionicons name="document-text" size={20} color={Colors.accent} />;
    case 'AGREEMENT_RESPONSE':
      return <Ionicons name="checkmark-circle" size={20} color={Colors.success} />;
    case 'ROOM_ANNOUNCEMENT':
      return <Ionicons name="megaphone" size={20} color={Colors.warning} />;
    default:
      return <Ionicons name="notifications" size={20} color={Colors.primary} />;
  }
};

export default function NotificationToast({
  notification,
  onPress,
  onDismiss,
  duration = 4000,
}: NotificationToastProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (notification) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 12,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        dismissToast();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [notification]);

  const dismissToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  const handlePress = () => {
    if (notification) {
      dismissToast();
      onPress(notification);
    }
  };

  if (!notification) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: insets.top + Spacing.sm,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.toast}
        activeOpacity={0.9}
        onPress={handlePress}
      >
        <View style={styles.iconContainer}>
          {getNotificationIcon(notification.type)}
        </View>
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={1}>
            {notification.title}
          </Text>
          <Text style={styles.message} numberOfLines={2}>
            {notification.message}
          </Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={dismissToast}>
          <Ionicons name="close" size={18} color={Colors.textLight} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    ...Shadows.medium,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  content: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  title: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.bold,
    color: Colors.text,
    marginBottom: 2,
  },
  message: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  closeBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 16,
  },
});
