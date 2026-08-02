import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  Image,
  Dimensions,
  TextInput,
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { useApp } from '../context/AppContext';
import { apiService, UserPhotoData } from '../services/api';
import { Friendship, getAgreementStatus, getCategoryInfo } from '../types';
import {
  Colors,
  Spacing,
  FontSizes,
  BorderRadius,
  FontWeights,
  Shadows,
} from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { NATIONALITIES } from '../i18n/translations';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_SIZE = (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.sm * 3) / 4;

const AVATAR_EMOJIS = [
  '😀', '😎', '🥳', '😊', '🤗', '😇', '🤔', '🧐',
  '👨', '👩', '👴', '👵', '👦', '👧', '🧑', '👱',
  '🐱', '🐶', '🦊', '🐼', '🐨', '🦁', '🐯', '🐻',
  '⭐', '🌟', '💫', '✨', '🔥', '💎', '🎯', '🎨',
];

const AVATAR_COLORS = [
  Colors.primary,
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
];

const PHOTOS_DIR = (FileSystem.documentDirectory || '') + 'photos/';

export function ProfileScreen() {
  const navigation = useNavigation<any>();
  // MainTabs already reserves both the tab bar and Android system-navigation
  // inset. Adding those values again here leaves a blank overlay above the
  // menu and can hide the final profile cards.
  const bottomPadding = Spacing.lg;
  const { 
    user, 
    agreements, 
    avatarSettings, 
    updateAvatarSettings,
    updateUserNickname,
    updateUserBio,
    updateUserEmail,
    updateUserProfilePicture,
    updateUserNationality,
    logout,
  } = useApp();
  const { t, nationality, language } = useLanguage();
  const [friendCount, setFriendCount] = useState(0);
  const [recentFriends, setRecentFriends] = useState<Friendship[]>([]);
  const [serverPhotos, setServerPhotos] = useState<UserPhotoData[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [avatarType, setAvatarType] = useState<'emoji' | 'photo'>('emoji');
  const [selectedEmoji, setSelectedEmoji] = useState('');
  const [selectedColor, setSelectedColor] = useState(Colors.primary);
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | undefined>();
  
  const [newNickname, setNewNickname] = useState('');
  const [isCheckingNickname, setIsCheckingNickname] = useState(false);
  const [nicknameStatus, setNicknameStatus] = useState<'idle' | 'available' | 'taken' | 'same'>('idle');
  const [nicknameMessage, setNicknameMessage] = useState('');
  const [isSavingNickname, setIsSavingNickname] = useState(false);

  const [showBioModal, setShowBioModal] = useState(false);
  const [newBio, setNewBio] = useState('');
  const [isSavingBio, setIsSavingBio] = useState(false);

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showNationalityModal, setShowNationalityModal] = useState(false);
  const [isSavingNationality, setIsSavingNationality] = useState(false);
  const [usageGuide, setUsageGuide] = useState(t('profile.usageGuideDefault'));

  useEffect(() => {
    ensurePhotosDirectory();
  }, []);

  useEffect(() => {
    let active = true;
    setUsageGuide(t('profile.usageGuideDefault'));
    apiService.getUsageGuide(language)
      .then(content => {
        if (active && content?.trim()) setUsageGuide(content);
      })
      .catch(() => {
        // 네트워크가 끊겨도 번역 사전에 포함된 기본 안내를 표시합니다.
      });
    return () => {
      active = false;
    };
  }, [language, t]);

  const loadServerPhotos = useCallback(async () => {
    if (!user?.id) return;
    setIsLoadingPhotos(true);
    try {
      const photos = await apiService.getUserPhotos(user.id);
      setServerPhotos(photos);
    } catch (error) {
      console.error('Failed to load photos:', error);
    } finally {
      setIsLoadingPhotos(false);
    }
  }, [user?.id]);

  const loadFriendCount = useCallback(async () => {
    if (!user?.id) {
      setFriendCount(0);
      setRecentFriends([]);
      return;
    }
    try {
      const friends = await apiService.getFriends(user.id);
      setFriendCount(friends.length);
      setRecentFriends(
        [...friends]
          .sort((a, b) => {
            const bTime = new Date(b.updatedAt || b.createdAt).getTime();
            const aTime = new Date(a.updatedAt || a.createdAt).getTime();
            return bTime - aTime;
          })
          .slice(0, 4)
      );
    } catch (error) {
      console.error('Failed to load friend count:', error);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadServerPhotos();
      void loadFriendCount();
    }, [loadFriendCount, loadServerPhotos])
  );

  useFocusEffect(
    useCallback(() => {
      const onHardwareBack = () => {
        if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          navigation.navigate('MainTabs', { screen: 'Friends' });
        }
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
      return () => subscription.remove();
    }, [navigation])
  );

  useEffect(() => {
    if (avatarSettings || user?.profilePictureUrl) {
      setAvatarType(user?.profilePictureUrl ? 'photo' : (avatarSettings?.type || 'emoji'));
      setSelectedEmoji(avatarSettings?.emoji || '');
      setSelectedColor(avatarSettings?.color || Colors.primary);
      setProfilePhotoUri(user?.profilePictureUrl || avatarSettings?.photoUri);
    }
  }, [avatarSettings, user?.profilePictureUrl]);

  useEffect(() => {
    if (!newNickname.trim()) {
      setNicknameStatus('idle');
      setNicknameMessage('');
      return;
    }

    if (newNickname.trim().length < 2) {
      setNicknameStatus('idle');
      setNicknameMessage('2자 이상 입력해주세요');
      return;
    }

    if (newNickname.trim() === user?.nickname) {
      setNicknameStatus('same');
      setNicknameMessage('현재 사용중인 닉네임입니다');
      return;
    }

    const debounce = setTimeout(async () => {
      setIsCheckingNickname(true);
      try {
        const available = await apiService.checkNicknameAvailable(newNickname.trim());
        setNicknameStatus(available ? 'available' : 'taken');
        setNicknameMessage(available ? '사용 가능한 닉네임입니다' : '이미 사용중인 닉네임입니다');
      } catch (error) {
        setNicknameStatus('idle');
        setNicknameMessage('');
      } finally {
        setIsCheckingNickname(false);
      }
    }, 500);

    return () => clearTimeout(debounce);
  }, [newNickname, user?.nickname]);

  const openNicknameModal = () => {
    setNewNickname(user?.nickname || '');
    setNicknameStatus('same');
    setNicknameMessage('현재 사용중인 닉네임입니다');
    setShowNicknameModal(true);
  };

  const handleSaveNickname = async () => {
    if (nicknameStatus !== 'available') return;
    
    setIsSavingNickname(true);
    try {
      await updateUserNickname(newNickname.trim());
      setShowNicknameModal(false);
      Alert.alert('완료', '닉네임이 변경되었습니다. 관련된 모든 약속이 업데이트됩니다.');
    } catch (error: any) {
      Alert.alert('오류', error.message || '닉네임 변경에 실패했습니다');
    } finally {
      setIsSavingNickname(false);
    }
  };

  const openBioModal = () => {
    setNewBio(user?.bio || '');
    setShowBioModal(true);
  };

  const handleSaveBio = async () => {
    if (!user?.id) return;
    
    setIsSavingBio(true);
    try {
      await updateUserBio(newBio.trim());
      setShowBioModal(false);
      Alert.alert('완료', '자기소개가 저장되었습니다.');
    } catch (error: any) {
      Alert.alert('오류', error.message || '자기소개 저장에 실패했습니다');
    } finally {
      setIsSavingBio(false);
    }
  };

  const openEmailModal = () => {
    setNewEmail(user?.email || '');
    setShowEmailModal(true);
  };

  const handleSaveEmail = async () => {
    if (!user?.id) return;

    const isValidEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail.trim());
    if (!isValidEmail) {
      Alert.alert('오류', '올바른 이메일 주소를 입력해주세요');
      return;
    }

    setIsSavingEmail(true);
    try {
      await updateUserEmail(newEmail.trim());
      setShowEmailModal(false);
      Alert.alert('완료', '이메일이 저장되었습니다.');
    } catch (error: any) {
      Alert.alert('오류', error.message || '이메일 저장에 실패했습니다');
    } finally {
      setIsSavingEmail(false);
    }
  };

  const openPasswordModal = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setShowPasswordModal(true);
  };

  const handleChangePassword = async () => {
    if (!user?.id || isChangingPassword) return;
    if (newPassword.length < 4) {
      Alert.alert('확인', '새 비밀번호는 4자 이상이어야 합니다.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      Alert.alert('확인', '새 비밀번호가 일치하지 않습니다.');
      return;
    }

    setIsChangingPassword(true);
    try {
      await apiService.changePassword(user.id, currentPassword, newPassword);
      setShowPasswordModal(false);
      Alert.alert('완료', '비밀번호가 변경되었습니다.');
    } catch (error: any) {
      Alert.alert('오류', error.message || '비밀번호 변경에 실패했습니다.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const ensurePhotosDirectory = async () => {
    try {
      const dirInfo = await FileSystem.getInfoAsync(PHOTOS_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
      }
    } catch (err) {
      console.error('Failed to create photos directory:', err);
    }
  };

  const userAgreements = agreements.filter(
    a => a.creatorId === user?.id || 
    a.participants.some(p => p.userName === user?.nickname)
  );

  const formatDate = (date: Date) => {
    const d = new Date(date);
    const locale = language === 'ko' ? 'ko-KR' : language === 'ja' ? 'ja-JP' : 'en-US';
    return d.toLocaleDateString(locale, {
      year: 'numeric',
      month: language === 'en' ? 'long' : 'numeric',
      day: 'numeric',
    });
  };

  const pickProfilePhoto = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        presentationStyle: ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN,
      });

      if (!result.canceled && result.assets[0]) {
        setProfilePhotoUri(result.assets[0].uri);
        setAvatarType('photo');
      }
    } catch (err) {
      console.error('Failed to pick profile photo:', err);
      Alert.alert('오류', '사진을 불러오는데 실패했습니다.');
    }
  };

  const pickDailyPhoto = async () => {
    if (!user?.id) return;
    
    if (serverPhotos.length >= 10) {
      Alert.alert(t('profile.photoLimitTitle'), t('profile.photoLimitMessage'));
      return;
    }

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        presentationStyle: ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setIsUploadingPhoto(true);
        try {
          await apiService.addUserPhoto(user.id, asset.uri);
          await loadServerPhotos();
          Alert.alert('완료', '사진이 Supabase Storage에 업로드되었습니다.');
        } catch (error: any) {
          console.error('Upload error:', error);
          Alert.alert('오류', error.message || '사진 업로드에 실패했습니다.');
        } finally {
          setIsUploadingPhoto(false);
        }
      }
    } catch (err) {
      console.error('Failed to pick daily photo:', err);
      Alert.alert('오류', '사진을 불러오는데 실패했습니다.');
    }
  };

  const handleDeleteDailyPhoto = (photo: UserPhotoData) => {
    if (!user?.id) return;
    
    Alert.alert(
      '사진 삭제',
      '이 사진을 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        { 
          text: '삭제', 
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteUserPhoto(user.id, photo.id);
              await loadServerPhotos();
              if (showPhotoViewer) {
                setShowPhotoViewer(false);
              }
            } catch (err: any) {
              console.error('Failed to delete photo:', err);
              Alert.alert('오류', err.message || '사진 삭제에 실패했습니다.');
            }
          }
        },
      ]
    );
  };

  const handleSaveAvatar = async () => {
    if (!user?.id) return;
    if (avatarType === 'photo' && !profilePhotoUri) {
      Alert.alert('알림', '프로필 사진을 선택해주세요.');
      return;
    }

    try {
      await updateUserProfilePicture(avatarType === 'photo' ? profilePhotoUri! : null);
      await updateAvatarSettings({
        type: avatarType,
        emoji: selectedEmoji,
        color: selectedColor,
        photoUri: undefined,
      });
      setShowAvatarModal(false);
      Alert.alert('완료', '프로필이 DB에 저장되었습니다!');
    } catch (error: any) {
      Alert.alert('오류', error.message || '프로필 저장에 실패했습니다.');
    }
  };

  const getDefaultEmoji = (nickname: string | undefined) => {
    if (!nickname) return '😊';
    const firstChar = nickname.charAt(0).toLowerCase();
    const emojiMap: Record<string, string> = {
      'a': '😀', 'b': '😎', 'c': '🥳', 'd': '😊', 'e': '🤗', 'f': '😇',
      'g': '🤔', 'h': '🧐', 'i': '👨', 'j': '👩', 'k': '🐱', 'l': '🐶',
      'm': '🦊', 'n': '🐼', 'o': '🐨', 'p': '🦁', 'q': '🐯', 'r': '🐻',
      's': '⭐', 't': '🌟', 'u': '💫', 'v': '✨', 'w': '🔥', 'x': '💎',
      'y': '🎯', 'z': '🎨',
    };
    return emojiMap[firstChar] || '😊';
  };

  const getDefaultColor = (nickname: string | undefined) => {
    if (!nickname) return Colors.primary;
    const colors = AVATAR_COLORS;
    const index = nickname.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const displayEmoji = avatarSettings?.emoji || getDefaultEmoji(user?.nickname);
  const displayColor = avatarSettings?.color || getDefaultColor(user?.nickname);
  const displayPhotoUri = avatarSettings?.photoUri;
  const isPhotoAvatar = avatarSettings?.type === 'photo' && displayPhotoUri;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <TouchableOpacity
              style={[
                styles.avatar, 
                !isPhotoAvatar && { backgroundColor: displayColor }
              ]}
              onPress={() => setShowAvatarModal(true)}
              activeOpacity={0.8}
            >
              {isPhotoAvatar ? (
                <Image source={{ uri: displayPhotoUri }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>
                  {displayEmoji}
                </Text>
              )}
            </TouchableOpacity>
            <View style={styles.editBadge}>
              <Text style={styles.editBadgeText}>✏️</Text>
            </View>
          </View>
          <TouchableOpacity onPress={openNicknameModal} style={styles.nicknameRow}>
            <Text style={styles.nickname}>{user?.nickname}</Text>
            <Ionicons name="pencil" size={14} color={Colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.joinDate}>
            {t('profile.joinedAt', { date: user?.createdAt ? formatDate(user.createdAt) : '' })}
          </Text>
          
          <TouchableOpacity onPress={openBioModal} style={styles.bioContainer}>
            {user?.bio ? (
              <Text style={styles.bioText}>{user.bio}</Text>
            ) : (
              <Text style={styles.bioPlaceholder}>{t('profile.bioEmptyPrompt')}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={openEmailModal} style={styles.emailRow}>
            <Ionicons name="mail-outline" size={16} color={Colors.textSecondary} style={{ marginRight: 6 }} />
            {user?.email ? (
              <Text style={styles.emailText}>{user.email}</Text>
            ) : (
              <Text style={styles.emailPlaceholder}>{t('profile.emailAddPrompt')}</Text>
            )}
            <Ionicons name="pencil" size={13} color={Colors.textSecondary} style={{ marginLeft: 6 }} />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowNationalityModal(true)} style={styles.emailRow}>
            <Ionicons name="globe-outline" size={16} color={Colors.textSecondary} style={{ marginRight: 6 }} />
            <Text style={styles.emailText}>
              {NATIONALITIES.find(item => item.code === nationality)?.flag} {t(`nationality.${nationality}`)}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.textSecondary} style={{ marginLeft: 6 }} />
          </TouchableOpacity>

          <TouchableOpacity onPress={openPasswordModal} style={styles.emailRow}>
            <Ionicons name="lock-closed-outline" size={16} color={Colors.textSecondary} style={{ marginRight: 6 }} />
            <Text style={styles.emailText}>비밀번호 변경</Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.textSecondary} style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>

        <View style={styles.statsBar}>
          <View style={styles.statCompact}>
            <View style={[styles.statIcon, styles.promiseStatIcon]}>
              <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
            </View>
            <Text style={styles.statLabel}>{t('profile.promisesCount')}</Text>
            <Text style={styles.statNumber}>{userAgreements.length}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCompact}>
            <View style={[styles.statIcon, styles.friendStatIcon]}>
              <Ionicons name="people-outline" size={19} color="#0AAE7A" />
            </View>
            <Text style={styles.statLabel}>{t('profile.friendsCount')}</Text>
            <Text style={[styles.statNumber, styles.friendStatNumber]}>{friendCount}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionIconBadge}>
                <Ionicons name="images" size={19} color={Colors.primary} />
              </View>
              <Text style={styles.sectionTitle}>{t('profile.dailyPhotos')}</Text>
            </View>
            <Text style={styles.photoCount}>{serverPhotos.length}/10</Text>
          </View>
          {isLoadingPhotos ? (
            <View style={styles.photoLoadingContainer}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.photoLoadingText}>{t('profile.loadingPhotos')}</Text>
            </View>
          ) : (
            <View style={styles.photoGrid}>
              {serverPhotos.map((photo, index) => (
                <TouchableOpacity
                  key={photo.id}
                  style={styles.photoItem}
                  onPress={() => {
                    setSelectedPhotoIndex(index);
                    setShowPhotoViewer(true);
                  }}
                  onLongPress={() => handleDeleteDailyPhoto(photo)}
                >
                  <Image source={{ uri: photo.photoUrl }} style={styles.photoImage} />
                  {photo.caption && (
                    <View style={styles.photoCaptionBadge}>
                      <Text style={styles.photoCaptionText} numberOfLines={1}>{photo.caption}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
              {serverPhotos.length < 10 && !isUploadingPhoto && (
                <TouchableOpacity
                  style={styles.addPhotoButton}
                  onPress={pickDailyPhoto}
                >
                  <Text style={styles.addPhotoIcon}>+</Text>
                  <Text style={styles.addPhotoText}>{t('profile.addPhoto')}</Text>
                </TouchableOpacity>
              )}
              {isUploadingPhoto && (
                <View style={styles.uploadingPhotoItem}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={styles.uploadingText}>{t('profile.uploadingPhoto')}</Text>
                </View>
              )}
            </View>
          )}
          {serverPhotos.length > 0 && (
            <Text style={styles.photoHint}>{t('profile.longPressDelete')}</Text>
          )}
        </View>

        <Card style={styles.infoCard} variant="outlined">
          <View style={styles.infoHeader}>
            <Text style={styles.infoIcon}>📋</Text>
            <Text style={styles.infoTitle}>{t('profile.usageGuide')}</Text>
          </View>
          <Text style={styles.infoText}>
            {usageGuide}
          </Text>
        </Card>

        <Card style={styles.infoCard} variant="outlined">
          <View style={styles.infoHeader}>
            <Text style={styles.infoIcon}>🚨</Text>
            <Text style={styles.infoTitle}>{t('profile.reportGuide')}</Text>
          </View>
          <Text style={styles.infoText}>
            {t('profile.reportGuideText')}
          </Text>
        </Card>

        <View style={[styles.section, styles.recentSection]}>
          <Text style={[styles.sectionTitle, styles.recentTitle]}>{t('profile.recentPromises')}</Text>
          {userAgreements.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{t('profile.noRecentPromises')}</Text>
            </View>
          ) : (
            userAgreements.slice(0, 10).map(agreement => {
              const status = getAgreementStatus(agreement);
              const categoryInfo = getCategoryInfo(agreement.category);
              
              return (
                <TouchableOpacity
                  key={agreement.id}
                  onPress={() => navigation.navigate('AgreementDetail', { agreementId: agreement.id })}
                  activeOpacity={0.7}
                >
                  <View style={styles.agreementCard}>
                    <View style={styles.agreementAvatar}>
                      <Text style={styles.agreementEmoji}>
                        {agreement.emoji || categoryInfo.emoji}
                      </Text>
                    </View>
                    <View style={styles.agreementInfo}>
                      <Text style={styles.agreementTitle} numberOfLines={1}>
                        {agreement.title}
                      </Text>
                      <Text style={styles.agreementDate}>
                        {new Date(agreement.createdAt).toLocaleDateString(
                          language === 'ko' ? 'ko-KR' : language === 'ja' ? 'ja-JP' : 'en-US'
                        )}
                      </Text>
                    </View>
                    <View style={[
                      styles.statusDot,
                      { backgroundColor: 
                        status === 'completed' ? Colors.success :
                        status === 'declined' ? Colors.error :
                        Colors.warning
                      }
                    ]} />
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={[styles.section, styles.friendsPreviewSection]}>
          <View style={styles.friendsPreviewHeader}>
            <Text style={styles.sectionTitle}>{t('friends.myFriends')}</Text>
            <TouchableOpacity
              style={styles.viewMoreFriendsButton}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('ProfileFriends', { initialSection: 'friends' })}
              accessibilityRole="button"
              accessibilityLabel={t('profile.viewMoreFriends')}
            >
              <Text style={styles.viewMoreFriendsText}>{t('profile.viewMoreFriends')}</Text>
              <Ionicons name="chevron-forward" size={17} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          {recentFriends.length === 0 ? (
            <View style={styles.friendsPreviewEmpty}>
              <Ionicons name="people-outline" size={30} color={Colors.textLight} />
              <Text style={styles.friendsPreviewEmptyText}>{t('friends.noFriends')}</Text>
            </View>
          ) : (
            <View style={styles.friendsPreviewRow}>
              {recentFriends.map(friend => (
                <TouchableOpacity
                  key={friend.id}
                  style={styles.friendPreviewItem}
                  activeOpacity={0.75}
                  onPress={() => navigation.navigate('ProfileFriends', { initialSection: 'friends' })}
                  accessibilityRole="button"
                  accessibilityLabel={friend.nickname}
                >
                  <View style={styles.friendPreviewAvatarWrap}>
                    {friend.profilePictureUrl ? (
                      <Image
                        source={{ uri: friend.profilePictureUrl }}
                        style={styles.friendPreviewAvatarImage}
                      />
                    ) : (
                      <View
                        style={[
                          styles.friendPreviewAvatarFallback,
                          { backgroundColor: friend.avatarColor || Colors.primary },
                        ]}
                      >
                        <Text style={styles.friendPreviewAvatarText}>
                          {friend.avatarEmoji || friend.nickname?.charAt(0).toUpperCase() || '?'}
                        </Text>
                      </View>
                    )}
                    <View
                      style={[
                        styles.friendPreviewStatusDot,
                        { backgroundColor: friend.online ? Colors.success : Colors.textLight },
                      ]}
                    />
                    <View style={styles.friendPreviewNameOverlay}>
                      <Text style={styles.friendPreviewName} numberOfLines={1}>
                        {friend.nickname}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          activeOpacity={0.75}
          onPress={() => {
            Alert.alert(
              t('profile.logout'),
              t('profile.logoutConfirm'),
              [
                { text: t('profile.logoutCancel'), style: 'cancel' },
                {
                  text: t('profile.logout'),
                  style: 'destructive',
                  onPress: () => { void logout(); },
                },
              ]
            );
          }}
        >
          <Text style={styles.logoutButtonText}>{t('profile.logout')}</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={showAvatarModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAvatarModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScrollView}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>프로필 수정</Text>
                <TouchableOpacity onPress={() => setShowAvatarModal(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.previewContainer}>
                {avatarType === 'photo' && profilePhotoUri ? (
                  <Image source={{ uri: profilePhotoUri }} style={styles.previewPhoto} />
                ) : (
                  <View style={[styles.previewAvatar, { backgroundColor: selectedColor }]}>
                    <Text style={styles.previewAvatarText}>
                      {selectedEmoji || user?.nickname?.charAt(0).toUpperCase() || '?'}
                    </Text>
                  </View>
                )}
              </View>

              <Text style={styles.sectionLabel}>프로필 타입 선택</Text>
              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[
                    styles.typeOption,
                    avatarType === 'emoji' && styles.typeOptionSelected
                  ]}
                  onPress={() => setAvatarType('emoji')}
                >
                  <Text style={styles.typeOptionEmoji}>😀</Text>
                  <Text style={[
                    styles.typeOptionText,
                    avatarType === 'emoji' && styles.typeOptionTextSelected
                  ]}>이모지</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeOption,
                    avatarType === 'photo' && styles.typeOptionSelected
                  ]}
                  onPress={pickProfilePhoto}
                >
                  <Text style={styles.typeOptionEmoji}>📷</Text>
                  <Text style={[
                    styles.typeOptionText,
                    avatarType === 'photo' && styles.typeOptionTextSelected
                  ]}>사진</Text>
                </TouchableOpacity>
              </View>

              {avatarType === 'emoji' && (
                <>
                  <Text style={styles.sectionLabel}>이모지 선택</Text>
                  <View style={styles.emojiGrid}>
                    {AVATAR_EMOJIS.map((emoji, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.emojiOption,
                          selectedEmoji === emoji && styles.emojiOptionSelected
                        ]}
                        onPress={() => setSelectedEmoji(emoji)}
                      >
                        <Text style={styles.emojiOptionText}>{emoji}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.sectionLabel}>배경 색상</Text>
                  <View style={styles.colorGrid}>
                    {AVATAR_COLORS.map((color, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.colorOption,
                          { backgroundColor: color },
                          selectedColor === color && styles.colorOptionSelected
                        ]}
                        onPress={() => setSelectedColor(color)}
                      >
                        {selectedColor === color && (
                          <Text style={styles.colorCheck}>✓</Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {avatarType === 'photo' && (
                <TouchableOpacity
                  style={styles.changePhotoButton}
                  onPress={pickProfilePhoto}
                >
                  <Text style={styles.changePhotoButtonText}>다른 사진 선택</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveAvatar}
              >
                <Text style={styles.saveButtonText}>저장하기</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={showPhotoViewer}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPhotoViewer(false)}
      >
        <View style={styles.photoViewerOverlay}>
          <TouchableOpacity
            style={styles.photoViewerClose}
            onPress={() => setShowPhotoViewer(false)}
          >
            <Text style={styles.photoViewerCloseText}>✕</Text>
          </TouchableOpacity>
          {serverPhotos[selectedPhotoIndex] && (
            <Image
              source={{ uri: serverPhotos[selectedPhotoIndex].photoUrl }}
              style={styles.photoViewerImage}
              resizeMode="contain"
            />
          )}
          <View style={styles.photoViewerActions}>
            <TouchableOpacity
              style={styles.photoViewerDeleteButton}
              onPress={() => serverPhotos[selectedPhotoIndex] && handleDeleteDailyPhoto(serverPhotos[selectedPhotoIndex])}
            >
              <Text style={styles.photoViewerDeleteText}>🗑️ 삭제</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.photoViewerCounter}>
            {selectedPhotoIndex + 1} / {serverPhotos.length}
          </Text>
        </View>
      </Modal>

      <Modal
        visible={showNicknameModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNicknameModal(false)}
      >
        <KeyboardAvoidingView style={styles.keyboardAvoidingModal} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.nicknameModalOverlay}>
            <View style={styles.nicknameModalContent}>
            <View style={styles.nicknameModalHeader}>
              <Text style={styles.nicknameModalTitle}>닉네임 변경</Text>
              <TouchableOpacity onPress={() => setShowNicknameModal(false)}>
                <Text style={styles.nicknameModalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.nicknameModalSubtitle}>
              새로운 닉네임을 입력해주세요
            </Text>

            <View style={styles.nicknameInputContainer}>
              <TextInput
                style={[
                  styles.nicknameInput,
                  nicknameStatus === 'available' && styles.nicknameInputValid,
                  nicknameStatus === 'taken' && styles.nicknameInputInvalid,
                ]}
              placeholder={t('auth.nicknamePlaceholder')}
                placeholderTextColor={Colors.textMuted}
                value={newNickname}
                onChangeText={setNewNickname}
                maxLength={20}
                autoFocus
              />
              {isCheckingNickname && (
                <View style={styles.nicknameInputIcon}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                </View>
              )}
              {!isCheckingNickname && nicknameStatus === 'available' && (
                <View style={styles.nicknameInputIcon}>
                  <Text style={styles.nicknameCheckIcon}>✓</Text>
                </View>
              )}
              {!isCheckingNickname && nicknameStatus === 'taken' && (
                <View style={styles.nicknameInputIcon}>
                  <Text style={styles.nicknameErrorIcon}>✕</Text>
                </View>
              )}
            </View>

            {nicknameMessage !== '' && (
              <Text style={[
                styles.nicknameValidationMessage,
                nicknameStatus === 'available' && styles.nicknameValidationSuccess,
                (nicknameStatus === 'taken' || nicknameStatus === 'same') && styles.nicknameValidationInfo,
              ]}>
                {nicknameMessage}
              </Text>
            )}

            <Text style={styles.nicknameNote}>
              닉네임을 변경하면 기존에 생성한 모든 약속의 소유자 이름도 함께 변경됩니다.
            </Text>

            <TouchableOpacity
              style={[
                styles.nicknameSaveButton,
                nicknameStatus !== 'available' && styles.nicknameSaveButtonDisabled,
              ]}
              onPress={handleSaveNickname}
              disabled={nicknameStatus !== 'available' || isSavingNickname}
            >
              {isSavingNickname ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.nicknameSaveButtonText}>변경하기</Text>
              )}
            </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showBioModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBioModal(false)}
      >
        <KeyboardAvoidingView style={styles.keyboardAvoidingModal} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.nicknameModalOverlay}>
            <View style={styles.nicknameModalContent}>
            <View style={styles.nicknameModalHeader}>
              <Text style={styles.nicknameModalTitle}>자기소개</Text>
              <TouchableOpacity onPress={() => setShowBioModal(false)}>
                <Text style={styles.nicknameModalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.nicknameModalSubtitle}>
              {t('profile.bioEditHint')}
            </Text>

            <View style={styles.bioInputContainer}>
              <TextInput
                style={styles.bioInput}
              placeholder={t('profile.bioInputPlaceholder')}
                placeholderTextColor={Colors.textMuted}
                value={newBio}
                onChangeText={setNewBio}
                maxLength={200}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                autoFocus
              />
            </View>

            <Text style={styles.bioCharCount}>
              {newBio.length}/200
            </Text>

            <TouchableOpacity
              style={styles.nicknameSaveButton}
              onPress={handleSaveBio}
              disabled={isSavingBio}
            >
              {isSavingBio ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.nicknameSaveButtonText}>저장하기</Text>
              )}
            </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showEmailModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEmailModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingModal}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.nicknameModalOverlay}>
            <View style={styles.nicknameModalContent}>
            <View style={styles.nicknameModalHeader}>
              <Text style={styles.nicknameModalTitle}>이메일</Text>
              <TouchableOpacity onPress={() => setShowEmailModal(false)}>
                <Text style={styles.nicknameModalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.nicknameModalSubtitle}>
              비밀번호를 잊었을 때 계정을 찾는 데 사용됩니다
            </Text>

            <View style={styles.bioInputContainer}>
              <TextInput
                style={styles.emailModalInput}
              placeholder={t('profile.emailInputPlaceholder')}
                placeholderTextColor={Colors.textMuted}
                value={newEmail}
                onChangeText={setNewEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                maxLength={254}
                autoFocus
              />
            </View>

            <TouchableOpacity
              style={styles.nicknameSaveButton}
              onPress={handleSaveEmail}
              disabled={isSavingEmail}
            >
              {isSavingEmail ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.nicknameSaveButtonText}>저장하기</Text>
              )}
            </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showPasswordModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingModal}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.nicknameModalOverlay}>
            <View style={styles.nicknameModalContent}>
              <View style={styles.nicknameModalHeader}>
                <Text style={styles.nicknameModalTitle}>비밀번호 변경</Text>
                <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
                  <Text style={styles.nicknameModalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.nicknameModalSubtitle}>
                안전한 변경을 위해 현재 비밀번호를 확인합니다
              </Text>

              <TextInput
                style={[styles.emailModalInput, styles.passwordModalInput]}
                placeholder="현재 비밀번호"
                placeholderTextColor={Colors.textMuted}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                autoCapitalize="none"
                autoFocus
              />
              <TextInput
                style={[styles.emailModalInput, styles.passwordModalInput]}
                placeholder="새 비밀번호 (4자 이상)"
                placeholderTextColor={Colors.textMuted}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoCapitalize="none"
              />
              <TextInput
                style={[styles.emailModalInput, styles.passwordModalInput]}
                placeholder="새 비밀번호 다시 입력"
                placeholderTextColor={Colors.textMuted}
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
                secureTextEntry
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={() => void handleChangePassword()}
              />

              {confirmNewPassword.length > 0 && newPassword !== confirmNewPassword && (
                <Text style={styles.passwordMismatchText}>새 비밀번호가 일치하지 않습니다.</Text>
              )}

              <TouchableOpacity
                style={[
                  styles.nicknameSaveButton,
                  (!currentPassword || newPassword.length < 4 || newPassword !== confirmNewPassword) && styles.nicknameSaveButtonDisabled,
                ]}
                onPress={handleChangePassword}
                disabled={isChangingPassword || !currentPassword || newPassword.length < 4 || newPassword !== confirmNewPassword}
              >
                {isChangingPassword ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.nicknameSaveButtonText}>변경하기</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showNationalityModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNationalityModal(false)}
      >
        <View style={styles.nicknameModalOverlay}>
          <View style={styles.nicknameModalContent}>
            <View style={styles.nicknameModalHeader}>
              <Text style={styles.nicknameModalTitle}>{t('profile.changeNationality')}</Text>
              <TouchableOpacity onPress={() => setShowNationalityModal(false)}>
                <Text style={styles.nicknameModalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.nicknameModalSubtitle}>{t('profile.changeNationalityHint')}</Text>
            {NATIONALITIES.map(item => (
              <TouchableOpacity
                key={item.code}
                style={[styles.countryOption, nationality === item.code && styles.countryOptionActive]}
                disabled={isSavingNationality}
                onPress={async () => {
                  setIsSavingNationality(true);
                  try {
                    await updateUserNationality(item.code);
                    setShowNationalityModal(false);
                  } catch {
                    Alert.alert('Error', 'Failed to update nationality.');
                  } finally {
                    setIsSavingNationality(false);
                  }
                }}
              >
                <Text style={styles.countryFlag}>{item.flag}</Text>
                <Text style={[styles.countryText, nationality === item.code && styles.countryTextActive]}>
                  {t(`nationality.${item.code}`)}
                </Text>
                {nationality === item.code && <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
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
    alignItems: 'center',
    marginVertical: Spacing.xl,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...Shadows.medium,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  editBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
    ...Shadows.small,
  },
  editBadgeText: {
    fontSize: 14,
  },
  premiumBadge: {
    position: 'absolute',
    bottom: -4,
    left: -10,
    backgroundColor: Colors.warning,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    ...Shadows.small,
  },
  premiumBadgeText: {
    fontSize: 10,
    fontWeight: FontWeights.bold,
    color: Colors.card,
  },
  subscriptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...Shadows.small,
  },
  subscriptionButtonPremium: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  subscriptionIcon: {
    fontSize: 28,
    marginRight: Spacing.md,
  },
  subscriptionInfo: {
    flex: 1,
  },
  subscriptionTitle: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: Colors.text,
  },
  subscriptionTitlePremium: {
    color: Colors.card,
  },
  subscriptionSubtitle: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  subscriptionSubtitlePremium: {
    color: 'rgba(255,255,255,0.7)',
  },
  subscriptionArrow: {
    fontSize: FontSizes.lg,
    color: Colors.textSecondary,
  },
  subscriptionArrowPremium: {
    color: Colors.card,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: FontWeights.bold,
    color: '#FFFFFF',
  },
  nickname: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.bold,
    color: Colors.text,
  },
  joinDate: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xl,
    ...Shadows.small,
  },
  statCompact: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.sm,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  promiseStatIcon: {
    backgroundColor: Colors.secondary,
  },
  friendStatIcon: {
    backgroundColor: '#E8FAF4',
  },
  statNumber: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: Colors.text,
    marginLeft: 8,
  },
  friendStatNumber: {
    color: '#0AAE7A',
  },
  statLabel: {
    fontSize: FontSizes.sm,
    color: Colors.text,
    fontWeight: FontWeights.semibold,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  friendsPreviewSection: {
    marginTop: Spacing.xs,
  },
  friendsPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  viewMoreFriendsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  viewMoreFriendsText: {
    fontSize: FontSizes.xs,
    color: Colors.primary,
    fontWeight: FontWeights.semibold,
  },
  friendsPreviewRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  friendPreviewItem: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE * 1.28,
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    ...Shadows.small,
  },
  friendPreviewAvatarWrap: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  friendPreviewAvatarImage: {
    width: '100%',
    height: '100%',
  },
  friendPreviewAvatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendPreviewAvatarText: {
    fontSize: 34,
    color: '#FFFFFF',
    fontWeight: FontWeights.bold,
  },
  friendPreviewStatusDot: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    zIndex: 2,
  },
  friendPreviewNameOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    backgroundColor: 'rgba(22, 24, 35, 0.58)',
  },
  friendPreviewName: {
    width: '100%',
    fontSize: FontSizes.xs,
    color: '#FFFFFF',
    fontWeight: FontWeights.bold,
    textAlign: 'center',
  },
  friendsPreviewEmpty: {
    minHeight: 104,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
  },
  friendsPreviewEmptyText: {
    marginTop: Spacing.xs,
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  logoutButton: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  logoutButtonText: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    fontWeight: FontWeights.medium,
    textDecorationLine: 'underline',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: Colors.text,
  },
  photoCount: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeights.medium,
  },
  recentSection: {
    marginTop: Spacing.sm,
  },
  recentTitle: {
    marginBottom: 14,
    letterSpacing: -0.2,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  photoItem: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    ...Shadows.small,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  addPhotoButton: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.cardBorder,
    borderStyle: 'dashed',
  },
  addPhotoIcon: {
    fontSize: 24,
    color: Colors.primary,
    fontWeight: FontWeights.bold,
  },
  addPhotoText: {
    fontSize: FontSizes.xs,
    color: Colors.primary,
    marginTop: 2,
  },
  photoHint: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  photoLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  photoLoadingText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  photoCaptionBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  photoCaptionText: {
    color: '#fff',
    fontSize: 8,
    textAlign: 'center',
  },
  uploadingPhotoItem: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
  },
  uploadingText: {
    fontSize: FontSizes.xs,
    color: Colors.primary,
    marginTop: Spacing.xs,
  },
  infoCard: {
    marginBottom: Spacing.xl,
    backgroundColor: Colors.background,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  infoIcon: {
    fontSize: FontSizes.lg,
    marginRight: Spacing.xs,
  },
  infoTitle: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: Colors.text,
  },
  infoText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  emptyText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  agreementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    marginBottom: 10,
    ...Shadows.small,
  },
  agreementAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
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
  },
  agreementTitle: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: Colors.text,
    lineHeight: 22,
  },
  agreementDate: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 5,
    lineHeight: 17,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: Spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalScrollView: {
    flex: 1,
    marginTop: 100,
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.lg,
    minHeight: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.text,
  },
  modalClose: {
    fontSize: 20,
    color: Colors.textSecondary,
    padding: Spacing.xs,
  },
  previewContainer: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  previewAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.medium,
  },
  previewPhoto: {
    width: 80,
    height: 80,
    borderRadius: 40,
    ...Shadows.medium,
  },
  previewAvatarText: {
    fontSize: 36,
    color: Colors.card,
  },
  sectionLabel: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  typeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.card,
  },
  typeOptionEmoji: {
    fontSize: 24,
    marginRight: Spacing.sm,
  },
  typeOptionText: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.medium,
    color: Colors.textSecondary,
  },
  typeOptionTextSelected: {
    color: Colors.primary,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: Spacing.lg,
  },
  emojiOption: {
    width: '12.5%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
  },
  emojiOptionSelected: {
    backgroundColor: Colors.secondary,
  },
  emojiOptionText: {
    fontSize: 24,
  },
  colorGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorOptionSelected: {
    borderWidth: 3,
    borderColor: Colors.text,
  },
  colorCheck: {
    color: Colors.card,
    fontSize: 18,
    fontWeight: FontWeights.bold,
  },
  changePhotoButton: {
    backgroundColor: Colors.secondary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  changePhotoButtonText: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.medium,
    color: Colors.primary,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  saveButtonText: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: Colors.card,
  },
  photoViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoViewerClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoViewerCloseText: {
    fontSize: 20,
    color: Colors.card,
  },
  photoViewerImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
  },
  photoViewerActions: {
    position: 'absolute',
    bottom: 100,
  },
  photoViewerDeleteButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
  photoViewerDeleteText: {
    fontSize: FontSizes.md,
    color: Colors.card,
    fontWeight: FontWeights.medium,
  },
  photoViewerCounter: {
    position: 'absolute',
    bottom: 50,
    fontSize: FontSizes.md,
    color: Colors.card,
  },
  nicknameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  nicknameEditIcon: {
    fontSize: 14,
  },
  nicknameModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  keyboardAvoidingModal: {
    flex: 1,
  },
  nicknameModalContent: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  countryOption: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.background,
  },
  countryOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.secondary,
  },
  countryFlag: {
    fontSize: 26,
    marginRight: Spacing.md,
  },
  countryText: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.text,
    fontWeight: FontWeights.medium,
  },
  countryTextActive: {
    color: Colors.primary,
    fontWeight: FontWeights.bold,
  },
  nicknameModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  nicknameModalTitle: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.text,
  },
  nicknameModalClose: {
    fontSize: 24,
    color: Colors.textSecondary,
    padding: Spacing.xs,
  },
  nicknameModalSubtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  nicknameInputContainer: {
    position: 'relative',
    marginBottom: Spacing.sm,
  },
  nicknameInput: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    paddingRight: 50,
    fontSize: FontSizes.lg,
    color: Colors.text,
    borderWidth: 2,
    borderColor: Colors.cardBorder,
  },
  nicknameInputValid: {
    borderColor: Colors.success,
    backgroundColor: '#F0FDF4',
  },
  nicknameInputInvalid: {
    borderColor: Colors.error,
    backgroundColor: '#FEF2F2',
  },
  nicknameInputIcon: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -10,
  },
  nicknameCheckIcon: {
    fontSize: 20,
    color: Colors.success,
    fontWeight: FontWeights.bold,
  },
  nicknameErrorIcon: {
    fontSize: 20,
    color: Colors.error,
    fontWeight: FontWeights.bold,
  },
  nicknameValidationMessage: {
    fontSize: FontSizes.sm,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  nicknameValidationSuccess: {
    color: Colors.success,
  },
  nicknameValidationInfo: {
    color: Colors.textSecondary,
  },
  nicknameNote: {
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: 18,
  },
  nicknameSaveButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  nicknameSaveButtonDisabled: {
    backgroundColor: Colors.cardBorder,
  },
  nicknameSaveButtonText: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: Colors.card,
  },
  bioContainer: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    minWidth: 200,
    maxWidth: 300,
  },
  bioText: {
    fontSize: FontSizes.sm,
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 20,
  },
  bioPlaceholder: {
    fontSize: FontSizes.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  emailText: {
    fontSize: FontSizes.sm,
    color: Colors.text,
  },
  emailPlaceholder: {
    fontSize: FontSizes.sm,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  emailModalInput: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    fontSize: FontSizes.md,
    color: Colors.text,
    borderWidth: 2,
    borderColor: Colors.cardBorder,
  },
  passwordModalInput: {
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  passwordMismatchText: {
    color: Colors.error,
    fontSize: FontSizes.sm,
    marginBottom: Spacing.sm,
  },
  bioInputContainer: {
    marginBottom: Spacing.sm,
  },
  bioInput: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    fontSize: FontSizes.md,
    color: Colors.text,
    borderWidth: 2,
    borderColor: Colors.cardBorder,
    minHeight: 120,
  },
  bioCharCount: {
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
    textAlign: 'right',
    marginBottom: Spacing.lg,
  },
});
