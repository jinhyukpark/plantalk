import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  FlatList,
  Image,
  Dimensions,
  Alert,
  Animated,
  PanResponder,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  Colors,
  Spacing,
  FontSizes,
  BorderRadius,
  FontWeights,
  Shadows,
  getSafeBottomPadding,
} from '../constants/theme';
import { apiService, UserProfile } from '../services/api';
import { useApp } from '../context/AppContext';
import { Friendship } from '../types';
import { useLanguage } from '../context/LanguageContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_SIZE = (SCREEN_WIDTH - Spacing.xl * 2 - Spacing.lg * 2 - Spacing.sm * 2) / 3;
const PROFILE_EMOJIS: Record<string, string> = {
  a: '😀', b: '😎', c: '🥳', d: '😊', e: '🤗', f: '😇',
  g: '🤔', h: '🧐', i: '👨', j: '👩', k: '🐱', l: '🐶',
  m: '🦊', n: '🐼', o: '🐨', p: '🦁', q: '🐯', r: '🐻',
  s: '⭐', t: '🌟', u: '💫', v: '✨', w: '🔥', x: '💎',
  y: '🎯', z: '🎨',
};

interface ProfilePopupProps {
  visible: boolean;
  nickname: string | null;
  onClose: () => void;
  onFriendshipChanged?: () => void | Promise<void>;
}

export function ProfilePopup({ visible, nickname, onClose, onFriendshipChanged }: ProfilePopupProps) {
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const { t, language } = useLanguage();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [friendActionLoading, setFriendActionLoading] = useState(false);
  const [relationship, setRelationship] = useState<Friendship | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPhotoDetail, setShowPhotoDetail] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(1)).current;
  const isClosingRef = useRef(false);

  const closeWithDragAnimation = () => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    sheetTranslateY.stopAnimation();
    backdropOpacity.stopAnimation();
    // 시트가 내려가기 시작하는 즉시 배경 딤을 제거한다.
    backdropOpacity.setValue(0);
    Animated.timing(sheetTranslateY, {
      toValue: Dimensions.get('window').height,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        onClose();
      } else {
        isClosingRef.current = false;
        backdropOpacity.setValue(1);
      }
    });
  };

  const handlePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => (
        gestureState.dy > 3 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
      ),
      onPanResponderMove: (_, gestureState) => {
        sheetTranslateY.setValue(Math.max(0, gestureState.dy));
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 110 || gestureState.vy > 0.85) {
          closeWithDragAnimation();
          return;
        }
        Animated.spring(sheetTranslateY, {
          toValue: 0,
          speed: 22,
          bounciness: 4,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () => {
        if (isClosingRef.current) return;
        Animated.spring(sheetTranslateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;

  useEffect(() => {
    if (visible && nickname) {
      isClosingRef.current = false;
      sheetTranslateY.stopAnimation();
      backdropOpacity.stopAnimation();
      sheetTranslateY.setValue(Dimensions.get('window').height);
      backdropOpacity.setValue(0);
      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(sheetTranslateY, {
            toValue: 0,
            duration: 220,
            useNativeDriver: true,
          }),
          Animated.timing(backdropOpacity, {
            toValue: 1,
            duration: 140,
            useNativeDriver: true,
          }),
        ]).start();
      });
      loadProfile(nickname);
    } else if (!visible) {
      setShowPhotoDetail(false);
      setSelectedPhotoIndex(0);
      setProfile(null);
      setRelationship(null);
      setError(null);
    }
  }, [visible, nickname]);

  const loadProfile = async (name: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiService.getUserProfile(name);
      console.log('Profile data loaded:', JSON.stringify(data, null, 2));
      if (data) {
        setProfile(data);
        if (user && data.id !== user.id) {
          const [friends, requests] = await Promise.all([
            apiService.getFriends(user.id),
            apiService.getFriendRequests(user.id),
          ]);
          setRelationship(
            friends.find((item) => item.friendId === data.id)
              || requests.find((item) => item.friendId === data.id)
              || null,
          );
        } else {
          setRelationship(null);
        }
      } else {
        setError('사용자 정보를 찾을 수 없습니다');
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
      setError('프로필을 불러오는데 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFriendAction = async () => {
    if (!user || !profile || user.id === profile.id || friendActionLoading) return;
    setFriendActionLoading(true);
    try {
      if (!relationship) {
        const requested = await apiService.requestFriend(user.id, profile.id);
        setRelationship(requested);
        await onFriendshipChanged?.();
      } else if (relationship.status === 'PENDING' && relationship.direction === 'INCOMING') {
        const accepted = await apiService.respondFriendRequest(relationship.id, user.id, true);
        setRelationship(accepted);
        await onFriendshipChanged?.();
      }
    } catch (actionError) {
      const message = actionError instanceof Error
        ? actionError.message.replace(/^API Error: \d+ - /, '')
        : '';
      if (/이미 친구 요청|이미 친구|already.*(?:request|friend)/i.test(message)) {
        await loadProfile(profile.nickname);
        await onFriendshipChanged?.();
        return;
      }
      Alert.alert(
        '친구 등록 실패',
        message || '잠시 후 다시 시도해 주세요.',
      );
    } finally {
      setFriendActionLoading(false);
    }
  };

  const removeFriend = () => {
    if (!user || !profile || relationship?.status !== 'ACCEPTED') return;
    Alert.alert(
      '친구를 해제할까요?',
      '친구를 해제하면 서로 메시지를 보내거나 약속과 방에 초대할 수 없습니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '친구 해제',
          style: 'destructive',
          onPress: async () => {
            setFriendActionLoading(true);
            try {
              const previousRelationship = relationship;
              await apiService.removeFriend(previousRelationship.id, user.id);
              setRelationship(null);
              setProfile(current => {
                if (!current) return current;
                return {
                  ...current,
                  followerCount: previousRelationship.direction === 'OUTGOING'
                    ? Math.max(0, current.followerCount - 1)
                    : current.followerCount,
                  followingCount: previousRelationship.direction === 'INCOMING'
                    ? Math.max(0, current.followingCount - 1)
                    : current.followingCount,
                };
              });
              await onFriendshipChanged?.();
            } catch (removeError) {
              Alert.alert(
                '친구 해제 실패',
                removeError instanceof Error ? removeError.message.replace(/^API Error: \d+ - /, '') : '잠시 후 다시 시도해 주세요.',
              );
            } finally {
              setFriendActionLoading(false);
            }
          },
        },
      ],
    );
  };

  const cancelFriendRequest = () => {
    if (!user || !profile || relationship?.status !== 'PENDING' || relationship.direction !== 'OUTGOING') return;
    Alert.alert(
      t('friends.cancelRequestConfirmTitle'),
      t('friends.cancelRequestConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('friends.cancelRequest'),
          style: 'destructive',
          onPress: async () => {
            setFriendActionLoading(true);
            try {
              await apiService.removeFriend(relationship.id, user.id);
              setRelationship(null);
              await onFriendshipChanged?.();
            } catch (cancelError) {
              Alert.alert(
                t('friends.cancelRequestFailed'),
                cancelError instanceof Error
                  ? cancelError.message.replace(/^API Error: \d+ - /, '')
                  : t('friends.removeFailedMessage'),
              );
            } finally {
              setFriendActionLoading(false);
            }
          },
        },
      ],
    );
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={closeWithDragAnimation}
    >
      <View style={styles.overlay}>
        <Animated.View
          pointerEvents="none"
          style={[styles.backdrop, { opacity: backdropOpacity }]}
        />
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={closeWithDragAnimation}
          accessibilityLabel={t('common.close')}
        />
        <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetTranslateY }] }] }>
          <View
            style={styles.sheetHandleTouchArea}
            {...handlePanResponder.panHandlers}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            accessibilityHint="아래로 밀어 닫기"
          >
            <View style={styles.sheetHandle} />
          </View>
          {profile && user && user.id !== profile.id && (
            <View style={styles.friendStatusPanel}>
              <TouchableOpacity
                style={[
                  styles.relationshipButton,
                  relationship?.status === 'ACCEPTED' && styles.relationshipButtonRemove,
                  relationship?.status === 'PENDING'
                    && relationship.direction === 'OUTGOING'
                    && styles.relationshipButtonPending,
                ]}
                onPress={relationship?.status === 'ACCEPTED'
                  ? removeFriend
                  : relationship?.status === 'PENDING' && relationship.direction === 'OUTGOING'
                    ? cancelFriendRequest
                    : handleFriendAction}
                disabled={friendActionLoading}
                accessibilityRole="button"
                accessibilityLabel={relationship?.status === 'ACCEPTED'
                  ? t('friends.removeFriend')
                  : relationship?.status === 'PENDING' && relationship.direction === 'OUTGOING'
                    ? t('friends.cancelRequest')
                    : relationship?.status === 'PENDING'
                      ? t('profile.acceptFriend')
                      : t('friends.sendRequest')}
              >
                {friendActionLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={relationship?.status === 'ACCEPTED' ? '#E85D55' : Colors.primary}
                  />
                ) : (
                  <Ionicons
                    name={relationship?.status === 'ACCEPTED'
                      ? 'people'
                      : relationship?.status === 'PENDING' && relationship.direction === 'OUTGOING'
                        ? 'person-remove-outline'
                        : 'person-add'}
                    size={15}
                    color={relationship?.status === 'ACCEPTED'
                      ? '#E85D55'
                      : relationship?.status === 'PENDING' && relationship.direction === 'OUTGOING'
                        ? '#6C4DFF'
                        : Colors.primary}
                  />
                )}
                <Text style={[
                  styles.relationshipButtonText,
                  relationship?.status === 'ACCEPTED' && styles.relationshipButtonRemoveText,
                  relationship?.status === 'PENDING'
                    && relationship.direction === 'OUTGOING'
                    && styles.relationshipButtonPendingText,
                ]}>
                  {relationship?.status === 'ACCEPTED'
                    ? t('friends.removeFriend')
                    : relationship?.status === 'PENDING' && relationship.direction === 'OUTGOING'
                      ? t('friends.cancelRequest')
                      : relationship?.status === 'PENDING'
                        ? t('profile.acceptFriend')
                        : t('friends.sendRequest')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>{t('common.loading')}</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={48} color={Colors.error} style={styles.errorIcon} />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => nickname && loadProfile(nickname)}>
                <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : profile ? (
            <ScrollView 
              showsVerticalScrollIndicator={true}
              contentContainerStyle={styles.scrollContent}
              style={styles.scrollView}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              bounces
            >
              <View style={styles.header}>
                <View style={styles.avatarStage}>
                  {profile.profilePictureUrl ? (
                    <Image 
                      source={{ uri: profile.profilePictureUrl }} 
                      style={styles.avatarImage}
                    />
                  ) : (
                    <View
                      style={[
                        styles.avatarContainer,
                        profile.avatarColor ? { backgroundColor: profile.avatarColor } : null,
                      ]}
                    >
                      <Text style={styles.avatarEmoji}>
                        {profile.avatarEmoji
                          || PROFILE_EMOJIS[profile.nickname.charAt(0).toLowerCase()]
                          || profile.nickname.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.nickname}>{profile.nickname}</Text>
                <View style={styles.onlineRow}>
                  <View style={[styles.onlineDot, profile.online ? styles.online : styles.offline]} />
                  <Text style={[styles.onlineText, profile.online && styles.onlineTextActive]}>
                    {profile.online ? t('profile.online') : t('profile.offline')}
                  </Text>
                </View>
                <Text style={styles.joinDate}>
                  {t('profile.joinedAt', { date: new Date(profile.createdAt).toLocaleDateString(
                    language === 'ko' ? 'ko-KR' : language === 'ja' ? 'ja-JP' : 'en-US'
                  ) })}
                </Text>
              </View>

              <View style={styles.bioSection}>
                <Text style={styles.sectionTitle}>{t('profile.bio')}</Text>
                <View style={styles.bioBox}>
                  <Text style={styles.bioText}>
                    {profile.bio || t('profile.noBio')}
                  </Text>
                </View>
              </View>

              <View style={styles.photosSection}>
                <Text style={styles.sectionTitle}>{t('profile.dailyPhotos')}</Text>
                {profile.photos && profile.photos.length > 0 ? (
                  <View style={styles.photoGrid}>
                    {profile.photos.map((photo, index) => (
                      <TouchableOpacity 
                        key={photo.id} 
                        style={styles.photoContainer}
                        activeOpacity={0.8}
                        onPress={() => {
                          setSelectedPhotoIndex(index);
                          setShowPhotoDetail(true);
                        }}
                      >
                        <Image 
                          source={{ uri: photo.photoUrl }} 
                          style={styles.photoImage}
                          resizeMode="cover"
                        />
                        {photo.caption && (
                          <View style={styles.photoCaptionOverlay}>
                            <Text style={styles.photoCaption} numberOfLines={1}>
                              {photo.caption}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <View style={styles.noPhotosContainer}>
                    <Ionicons name="images-outline" size={32} color={Colors.textLight} style={styles.noPhotosIcon} />
                    <Text style={styles.noPhotosText}>{t('profile.noPhotos')}</Text>
                  </View>
                )}
              </View>

            </ScrollView>
          ) : null}

          <View style={[styles.sheetFooter, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            <TouchableOpacity style={styles.closeButton} onPress={closeWithDragAnimation}>
              <Text style={styles.closeButtonText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Modal
          visible={showPhotoDetail}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setShowPhotoDetail(false)}
        >
          <SafeAreaView style={styles.photoDetailPage} edges={['top', 'bottom']}>
            <View style={styles.photoDetailHeader}>
              <TouchableOpacity
                style={styles.photoDetailBack}
                onPress={() => setShowPhotoDetail(false)}
                accessibilityLabel={t('common.back')}
              >
                <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.photoDetailCounter}>
                {selectedPhotoIndex + 1} / {profile?.photos?.length || 0}
              </Text>
              <View style={styles.photoDetailHeaderSpacer} />
            </View>

            <FlatList
              data={profile?.photos || []}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={selectedPhotoIndex}
              getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
              keyExtractor={(item) => String(item.id)}
              onMomentumScrollEnd={(event) => {
                setSelectedPhotoIndex(Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH));
              }}
              renderItem={({ item }) => (
                <View style={styles.photoDetailSlide}>
                  <Image source={{ uri: item.photoUrl }} style={styles.photoDetailImage} resizeMode="contain" />
                  {!!item.caption && (
                    <View style={[
                      styles.photoDetailCaptionWrap,
                      { paddingBottom: getSafeBottomPadding(insets.bottom, 12) },
                    ]}>
                      <Text style={styles.photoDetailCaption}>{item.caption}</Text>
                    </View>
                  )}
                </View>
              )}
            />
          </SafeAreaView>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    width: '100%',
    height: '92%',
    position: 'relative',
    overflow: 'hidden',
    ...Shadows.large,
  },
  sheetHandle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D8D8DE',
    alignSelf: 'center',
  },
  sheetHandleTouchArea: {
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  friendStatusPanel: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    zIndex: 10,
    alignItems: 'flex-end',
  },
  relationshipButton: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    backgroundColor: '#F0EBFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: '#DED4FF',
  },
  relationshipButtonRemove: {
    backgroundColor: '#FFF0EE',
    borderColor: '#FFC9C4',
  },
  relationshipButtonPending: {
    backgroundColor: '#F0EBFF',
    borderColor: '#D5C9FF',
  },
  relationshipButtonText: {
    color: Colors.primary,
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.bold,
  },
  relationshipButtonRemoveText: {
    color: '#D94D45',
  },
  relationshipButtonPendingText: {
    color: '#6C4DFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: Spacing.md,
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.medium,
  },
  errorContainer: {
    flex: 1,
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorIcon: {
    marginBottom: Spacing.md,
  },
  errorText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  retryButtonText: {
    color: Colors.card,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  avatarStage: {
    width: 80,
    height: 80,
    position: 'relative',
    marginBottom: Spacing.md,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.small,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    ...Shadows.small,
  },
  avatarText: {
    fontSize: 36,
    color: Colors.card,
    fontWeight: FontWeights.bold,
  },
  avatarEmoji: {
    fontSize: 42,
  },
  nickname: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  joinDate: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeights.medium,
  },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.xs,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  online: {
    backgroundColor: Colors.success,
  },
  offline: {
    backgroundColor: Colors.textLight,
  },
  onlineText: {
    color: Colors.textLight,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
  },
  onlineTextActive: {
    color: Colors.success,
  },
  bioSection: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  bioBox: {
    backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    minHeight: 60,
  },
  bioText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  photosSection: {
    marginBottom: Spacing.lg,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  photoContainer: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    backgroundColor: Colors.secondary,
    ...Shadows.small,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoCaptionOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  photoCaption: {
    color: '#fff',
    fontSize: 10,
    textAlign: 'center',
    fontWeight: FontWeights.medium,
  },
  noPhotosContainer: {
    backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  noPhotosIcon: {
    marginBottom: Spacing.sm,
  },
  noPhotosText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeights.medium,
  },
  closeButton: {
    backgroundColor: '#F1F2F4',
    borderRadius: BorderRadius.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeButtonText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
  },
  sheetFooter: {
    flexShrink: 0,
    backgroundColor: Colors.card,
    paddingTop: 10,
    paddingHorizontal: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  photoDetailPage: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  photoDetailHeader: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  photoDetailBack: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoDetailCounter: {
    color: '#FFFFFF',
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
  },
  photoDetailHeaderSpacer: {
    width: 44,
  },
  photoDetailSlide: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: 'center',
  },
  photoDetailImage: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
  photoDetailCaptionWrap: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    backgroundColor: 'rgba(9, 9, 11, 0.96)',
  },
  photoDetailCaption: {
    color: '#FFFFFF',
    fontSize: FontSizes.sm,
    lineHeight: 21,
    textAlign: 'center',
  },
});
