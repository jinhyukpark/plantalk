import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights } from '../constants/theme';
import { Notification, NotificationType } from '../types';
import { apiService } from '../services/api';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';

const getNotificationIcon = (type: NotificationType): string => {
  switch (type) {
    case 'ROOM_MESSAGE':
      return '💬';
    case 'AGREEMENT_CREATED':
      return '📝';
    case 'AGREEMENT_RESPONSE':
      return '✅';
    case 'AGREEMENT_STATUS_CHANGED':
      return '🔄';
    case 'AGREEMENT_UPDATED':
      return '✏️';
    case 'ROOM_JOINED':
      return '👋';
    case 'ROOM_ANNOUNCEMENT':
      return '📢';
    case 'GLOBAL_ANNOUNCEMENT':
      return '🔔';
    case 'SYSTEM':
      return '🔔';
    default:
      return '🔔';
  }
};

const isUserEvent = (type: NotificationType): boolean =>
  type === 'ROOM_MESSAGE' || type === 'ROOM_JOINED';

const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '방금 전';
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
};

export default function NotificationScreen() {
  const navigation = useNavigation<any>();
  const { currentUser, refreshUnreadCount } = useApp();
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!currentUser) return;
    try {
      const data = await apiService.getNotifications(currentUser.id);
      setNotifications(data);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser]);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const handleMarkAllAsRead = async () => {
    if (!currentUser) return;
    try {
      await apiService.markAllNotificationsAsRead(currentUser.id);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      refreshUnreadCount?.();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleNotificationPress = async (notification: Notification) => {
    try {
      if (!notification.isRead) {
        await apiService.markNotificationAsRead(notification.id);
        setNotifications(prev =>
          prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n)
        );
        refreshUnreadCount?.();
      }

      if (notification.referenceType === 'ROOM' && notification.referenceId) {
        navigation.navigate('RoomDetail', { roomId: notification.referenceId });
      } else if (notification.referenceType === 'AGREEMENT' && notification.referenceId) {
        navigation.navigate('AgreementDetail', { agreementId: notification.referenceId });
      }
    } catch (error) {
      console.error('Failed to handle notification press:', error);
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[styles.notificationItem, !item.isRead && styles.unreadItem]}
      onPress={() => handleNotificationPress(item)}
      activeOpacity={0.7}
    >
      {isUserEvent(item.type) && item.senderProfilePictureUrl ? (
        <Image
          source={{ uri: item.senderProfilePictureUrl }}
          style={styles.avatarImage}
        />
      ) : isUserEvent(item.type) && item.senderName ? (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarInitial}>{item.senderName.trim().charAt(0).toUpperCase()}</Text>
        </View>
      ) : (
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>{getNotificationIcon(item.type)}</Text>
        </View>
      )}
      <View style={styles.contentContainer}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, !item.isRead && styles.unreadTitle]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.time}>{formatTimeAgo(item.createdAt)}</Text>
        </View>
        <Text style={styles.message} numberOfLines={1} ellipsizeMode="tail">
          {item.message}
        </Text>
      </View>
      {!item.isRead && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('notifications.title')}</Text>
        {unreadCount > 0 && (
          <TouchableOpacity style={styles.markAllBtn} onPress={handleMarkAllAsRead}>
            <Text style={styles.markAllBtnText}>{t('notifications.readAll')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off-outline" size={64} color={Colors.textTertiary} style={{ marginBottom: Spacing.md }} />
          <Text style={styles.emptyText}>{t('notifications.empty')}</Text>
          <Text style={styles.emptySubtext}>{t('notifications.emptyHint')}</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.listContainer, { paddingBottom: Spacing.lg }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
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
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnText: {
    fontSize: 32,
    color: Colors.primary,
    fontWeight: FontWeights.medium,
  },
  headerTitle: {
    flex: 1,
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    color: Colors.text,
    marginLeft: Spacing.xs,
  },
  markAllBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  markAllBtnText: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
    fontWeight: FontWeights.medium,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: Spacing.md,
  },
  emptyText: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  emptySubtext: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  listContainer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  notificationItem: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 12,
    marginBottom: 4,
    alignItems: 'center',
  },
  unreadItem: {
    backgroundColor: '#F7F4FF',
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 19,
  },
  avatarImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 12,
    backgroundColor: Colors.border,
  },
  avatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEE9FF',
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: FontWeights.semibold,
    color: Colors.primary,
  },
  contentContainer: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  title: {
    flex: 1,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
    color: Colors.text,
    marginRight: 8,
  },
  unreadTitle: {
    fontWeight: FontWeights.semibold,
  },
  time: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  message: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    lineHeight: 17,
    includeFontPadding: false,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
    position: 'absolute',
    top: 10,
    right: 8,
  },
});
