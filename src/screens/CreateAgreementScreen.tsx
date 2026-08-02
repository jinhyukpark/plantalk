import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { useApp } from '../context/AppContext';
import { CATEGORIES, AgreementCategory } from '../types';
import { Colors, Spacing, FontSizes, BorderRadius, FontWeights, Shadows } from '../constants/theme';
import { apiService } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

interface SearchedUser {
  id: string;
  nickname: string;
  avatarEmoji?: string;
  avatarColor?: string;
  avatarPhotoUri?: string;
  profilePictureUrl?: string;
  relationship?: 'FRIEND' | 'PENDING_OUTGOING' | 'PENDING_INCOMING' | 'NONE';
}

const AGREEMENT_EMOJI_OPTIONS = [
  '✨', '⭐', '❤️', '💛', '💚', '💙', '💜', '🎉',
  '☕', '🍽️', '🍻', '🎬', '🎵', '🎨', '📷', '🎮',
  '⚽', '🏀', '⚾', '🎾', '🏸', '🏊', '🚴', '🏃',
  '⛰️', '🏕️', '✈️', '🚗', '📚', '💼', '🛒', '🐶',
];

export function CreateAgreementScreen() {
  const navigation = useNavigation<any>();
  const bottomPadding = Spacing.lg;
  const { createAgreement, user } = useApp();
  const { t, language } = useLanguage();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<AgreementCategory>('promise');
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [customCategoryEmoji, setCustomCategoryEmoji] = useState('✨');
  const [showCategoryEmojiModal, setShowCategoryEmojiModal] = useState(false);
  const [scheduleType, setScheduleType] = useState<'POINT' | 'RANGE'>('POINT');
  const [dateTime, setDateTime] = useState<Date | null>(null);
  const [endDateTime, setEndDateTime] = useState<Date | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [pickerTarget, setPickerTarget] = useState<'start' | 'end'>('start');
  const [participants, setParticipants] = useState<SearchedUser[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchedUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [requestingFriendIds, setRequestingFriendIds] = useState<Set<string>>(new Set());

  const selectedCategory = CATEGORIES.find(c => c.id === category)!;
  const selectedEmoji = category === 'custom' ? customCategoryEmoji : selectedCategory.emoji;

  const searchUsers = async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      if (!user) return;
      const [results, friends, friendRequests] = await Promise.all([
        apiService.searchUsers(query.trim()),
        apiService.getFriends(user.id),
        apiService.getFriendRequests(user.id),
      ]);
      const friendIds = new Set(friends.map(friend => friend.friendId));
      const requestByUserId = new Map(
        friendRequests.map(request => [request.friendId, request.direction])
      );
      const filteredResults = results.filter(
        (u: SearchedUser) => 
          u.id !== user?.id && 
          !participants.some(p => p.id === u.id)
      ).map((u: SearchedUser): SearchedUser => ({
        ...u,
        relationship: friendIds.has(u.id)
          ? 'FRIEND'
          : requestByUserId.get(u.id) === 'OUTGOING'
            ? 'PENDING_OUTGOING'
            : requestByUserId.get(u.id) === 'INCOMING'
              ? 'PENDING_INCOMING'
              : 'NONE',
      }));
      setSearchResults(filteredResults);
    } catch (error) {
      console.error('User search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        searchUsers(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const addParticipant = (searchedUser: SearchedUser) => {
    if (searchedUser.relationship !== 'FRIEND') return;
    if (!participants.some(p => p.id === searchedUser.id)) {
      setParticipants([...participants, searchedUser]);
      setSearchQuery('');
      setSearchResults([]);
      setShowSearchModal(false);
    }
  };

  const sendFriendRequest = async (searchedUser: SearchedUser) => {
    if (!user || searchedUser.relationship !== 'NONE') return;
    setRequestingFriendIds((current) => new Set(current).add(searchedUser.id));
    try {
      await apiService.requestFriend(user.id, searchedUser.id);
      setSearchResults((current) => current.map((candidate) => (
        candidate.id === searchedUser.id
          ? { ...candidate, relationship: 'PENDING_OUTGOING' }
          : candidate
      )));
      Alert.alert('친구 요청', `${searchedUser.nickname}님에게 친구 요청을 보냈습니다.`);
    } catch (error) {
      Alert.alert(
        '요청 실패',
        error instanceof Error
          ? error.message.replace(/^API Error: \d+ - /, '')
          : '친구 요청을 보내지 못했습니다.',
      );
    } finally {
      setRequestingFriendIds((current) => {
        const next = new Set(current);
        next.delete(searchedUser.id);
        return next;
      });
    }
  };

  const removeParticipant = (userId: string) => {
    setParticipants(participants.filter(p => p.id !== userId));
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('알림', '제목을 입력해주세요.');
      return;
    }
    if (scheduleType === 'RANGE') {
      if (!dateTime || !endDateTime) {
        Alert.alert('알림', '기간 일정의 시작 일시와 종료 일시를 모두 선택해주세요.');
        return;
      }
      if (endDateTime.getTime() <= dateTime.getTime()) {
        Alert.alert('알림', '종료 일시는 시작 일시보다 늦어야 합니다.');
        return;
      }
    }
    if (category === 'custom' && !customCategoryName.trim()) {
      Alert.alert(t('agreement.customCategory'), t('agreement.customCategoryRequired'));
      return;
    }

    setIsSubmitting(true);
    try {
      const participantNames = participants.map(p => p.nickname);
      const agreement = await createAgreement(
        title.trim(),
        description.trim(),
        category,
        selectedEmoji,
        category === 'custom' ? customCategoryName.trim() : null,
        dateTime,
        scheduleType,
        scheduleType === 'RANGE' ? endDateTime : null,
        participantNames
      );

      navigation.replace('AgreementDetail', { agreementId: agreement.id });
    } catch (error) {
      Alert.alert('오류', '약속 생성에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (date: Date) => {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}월 ${day}일`;
  };

  const formatTime = (date: Date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? '오후' : '오전';
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${ampm} ${displayHours}:${minutes}`;
  };

  const openDatePicker = (target: 'start' | 'end' = 'start') => {
    setPickerTarget(target);
    setPickerMode('date');
    setPickerVisible(true);
  };

  const openTimePicker = (target: 'start' | 'end' = 'start') => {
    setPickerTarget(target);
    setPickerMode('time');
    setPickerVisible(true);
  };

  const handlePickerConfirm = (selectedDate: Date) => {
    setPickerVisible(false);
    const currentValue = pickerTarget === 'start' ? dateTime : endDateTime;
    let nextValue: Date;
    if (pickerMode === 'date') {
      nextValue = currentValue ? new Date(currentValue) : new Date(selectedDate);
      nextValue.setFullYear(selectedDate.getFullYear());
      nextValue.setMonth(selectedDate.getMonth());
      nextValue.setDate(selectedDate.getDate());
    } else {
      nextValue = currentValue ? new Date(currentValue) : new Date(selectedDate);
      nextValue.setHours(selectedDate.getHours());
      nextValue.setMinutes(selectedDate.getMinutes());
    }
    nextValue.setSeconds(0, 0);
    if (pickerTarget === 'start') {
      setDateTime(nextValue);
      if (scheduleType === 'RANGE' && (!endDateTime || endDateTime <= nextValue)) {
        setEndDateTime(new Date(nextValue.getTime() + 60 * 60 * 1000));
      }
    } else {
      setEndDateTime(nextValue);
    }
  };

  const handlePickerCancel = () => {
    setPickerVisible(false);
  };

  const getDefaultAvatar = (nickname: string) => {
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
    const colorIndex = nickname.charCodeAt(0) % colors.length;
    return {
      emoji: nickname.charAt(0).toUpperCase(),
      color: colors[colorIndex],
    };
  };

  const renderUserAvatar = (searchedUser: SearchedUser, size: number = 40) => {
    const photoUri = searchedUser.profilePictureUrl || searchedUser.avatarPhotoUri;
    if (photoUri) {
      return (
        <Image 
          source={{ uri: photoUri }}
          style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]} 
        />
      );
    }
    
    const defaultAvatar = getDefaultAvatar(searchedUser.nickname);
    const emoji = searchedUser.avatarEmoji || defaultAvatar.emoji;
    const color = searchedUser.avatarColor || defaultAvatar.color;
    
    return (
      <View style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
        <Text style={[styles.avatarEmoji, { fontSize: size * 0.5 }]}>{emoji}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('agreement.new')}</Text>
        <View style={styles.headerSpacer} />
      </View>
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.screenTitle}>{t('agreement.newTitle')}</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('agreement.title')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('agreement.titlePlaceholder')}
              placeholderTextColor={Colors.textMuted}
              value={title}
              onChangeText={setTitle}
              maxLength={50}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('agreement.description')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t('agreement.descriptionPlaceholder')}
              placeholderTextColor={Colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              maxLength={200}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('agreement.category')}</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryButton,
                    category === cat.id && styles.categoryButtonActive,
                  ]}
                  onPress={() => setCategory(cat.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                  <Text
                    style={[
                      styles.categoryLabel,
                      category === cat.id && styles.categoryLabelActive,
                    ]}
                    numberOfLines={1}
                  >
                    {language === 'ko' ? cat.labelKo : language === 'ja' ? cat.labelJa : cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {category === 'custom' && (
              <View style={styles.customCategoryEditor}>
                <TouchableOpacity
                  style={styles.customEmojiButton}
                  onPress={() => setShowCategoryEmojiModal(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.customEmoji}>{customCategoryEmoji}</Text>
                  <View style={styles.customEmojiCopy}>
                    <Text style={styles.customEmojiTitle}>{t('agreement.chooseIcon')}</Text>
                    <Text style={styles.customEmojiHint}>{t('agreement.chooseIconHint')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.textLight} />
                </TouchableOpacity>
                <TextInput
                  style={styles.customCategoryInput}
                  value={customCategoryName}
                  onChangeText={setCustomCategoryName}
                  placeholder={t('agreement.customCategoryPlaceholder')}
                  placeholderTextColor={Colors.textMuted}
                  maxLength={30}
                />
              </View>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('agreement.schedule')}</Text>
            <View style={styles.scheduleTypeRow}>
              <TouchableOpacity
                style={[styles.scheduleTypeButton, scheduleType === 'POINT' && styles.scheduleTypeButtonActive]}
                onPress={() => setScheduleType('POINT')}
              >
                <Ionicons name="location-outline" size={19} color={scheduleType === 'POINT' ? Colors.primary : Colors.textSecondary} />
                <View>
                  <Text style={[styles.scheduleTypeTitle, scheduleType === 'POINT' && styles.scheduleTypeTitleActive]}>{t('agreement.point')}</Text>
                  <Text style={styles.scheduleTypeDescription}>{t('agreement.pointHint')}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.scheduleTypeButton, scheduleType === 'RANGE' && styles.scheduleTypeButtonActive]}
                onPress={() => {
                  setScheduleType('RANGE');
                  if (dateTime && !endDateTime) {
                    setEndDateTime(new Date(dateTime.getTime() + 60 * 60 * 1000));
                  }
                }}
              >
                <Ionicons name="calendar-number-outline" size={19} color={scheduleType === 'RANGE' ? Colors.primary : Colors.textSecondary} />
                <View>
                  <Text style={[styles.scheduleTypeTitle, scheduleType === 'RANGE' && styles.scheduleTypeTitleActive]}>{t('agreement.range')}</Text>
                  <Text style={styles.scheduleTypeDescription}>{t('agreement.rangeHint')}</Text>
                </View>
              </TouchableOpacity>
            </View>
            {scheduleType === 'RANGE' && <Text style={styles.dateSectionLabel}>{t('agreement.start')}</Text>}
            <View style={styles.dateTimeRow}>
              <TouchableOpacity
                style={[styles.dateButton, dateTime && styles.dateButtonActive]}
                onPress={() => openDatePicker('start')}
                activeOpacity={0.7}
              >
                <Ionicons name="calendar-outline" size={18} color={dateTime ? Colors.primary : Colors.textSecondary} />
                <Text style={[styles.dateButtonText, dateTime && styles.dateButtonTextActive]}>
                  {dateTime ? formatDate(dateTime) : '날짜 선택'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dateButton, dateTime && styles.dateButtonActive]}
                onPress={() => openTimePicker('start')}
                activeOpacity={0.7}
              >
                <Ionicons name="time-outline" size={18} color={dateTime ? Colors.primary : Colors.textSecondary} />
                <Text style={[styles.dateButtonText, dateTime && styles.dateButtonTextActive]}>
                  {dateTime ? formatTime(dateTime) : '시간 선택'}
                </Text>
              </TouchableOpacity>
            </View>
            {scheduleType === 'RANGE' && (
              <>
                <Text style={styles.dateSectionLabel}>{t('agreement.end')}</Text>
                <View style={styles.dateTimeRow}>
                  <TouchableOpacity
                    style={[styles.dateButton, endDateTime && styles.dateButtonActive]}
                    onPress={() => openDatePicker('end')}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="calendar-outline" size={18} color={endDateTime ? Colors.primary : Colors.textSecondary} />
                    <Text style={[styles.dateButtonText, endDateTime && styles.dateButtonTextActive]}>
                      {endDateTime ? formatDate(endDateTime) : '종료 날짜'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dateButton, endDateTime && styles.dateButtonActive]}
                    onPress={() => openTimePicker('end')}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="time-outline" size={18} color={endDateTime ? Colors.primary : Colors.textSecondary} />
                    <Text style={[styles.dateButtonText, endDateTime && styles.dateButtonTextActive]}>
                      {endDateTime ? formatTime(endDateTime) : '종료 시간'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            {(dateTime || endDateTime) && (
              <TouchableOpacity onPress={() => { setDateTime(null); setEndDateTime(null); }} style={styles.clearButton} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={16} color={Colors.error} />
                <Text style={styles.clearText}>초기화</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('agreement.participants')}</Text>
            <TouchableOpacity 
              style={styles.searchButton}
              onPress={() => setShowSearchModal(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="search" size={18} color={Colors.textSecondary} />
              <Text style={styles.searchButtonText}>사용자 검색하여 추가</Text>
            </TouchableOpacity>
            
            {participants.length > 0 && (
              <View style={styles.participantList}>
                {participants.map(p => (
                  <View key={p.id} style={styles.participantChip}>
                    {renderUserAvatar(p, 28)}
                    <Text style={styles.participantName}>{p.nickname}</Text>
                    <TouchableOpacity onPress={() => removeParticipant(p.id)}>
                      <Ionicons name="close-circle" size={20} color={Colors.textSecondary} style={styles.removeButton} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            <Text style={styles.hint}>
              참여자는 나중에 약속 상세 화면에서도 추가할 수 있습니다.
            </Text>
          </View>

          <Button
            title={isSubmitting ? t('auth.processing') : t('agreement.create')}
            onPress={handleSubmit}
            variant="primary"
            size="large"
            disabled={isSubmitting}
            style={styles.submitButton}
            fullWidth
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Date/Time Picker Modal */}
      <DateTimePickerModal
        isVisible={pickerVisible}
        mode={pickerMode}
        date={(pickerTarget === 'end' ? endDateTime : dateTime) || new Date()}
        onConfirm={handlePickerConfirm}
        onCancel={handlePickerCancel}
        locale={language === 'ko' ? 'ko-KR' : language === 'ja' ? 'ja-JP' : 'en-US'}
        confirmTextIOS="확인"
        cancelTextIOS="취소"
      />

      <Modal
        visible={showCategoryEmojiModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCategoryEmojiModal(false)}
      >
        <TouchableOpacity
          style={styles.emojiModalOverlay}
          activeOpacity={1}
          onPress={() => setShowCategoryEmojiModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.emojiModalContent}>
            <View style={styles.emojiModalHeader}>
              <Text style={styles.emojiModalTitle}>{t('agreement.chooseIcon')}</Text>
              <TouchableOpacity onPress={() => setShowCategoryEmojiModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.emojiOptionGrid}>
              {AGREEMENT_EMOJI_OPTIONS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={[
                    styles.emojiOption,
                    customCategoryEmoji === emoji && styles.emojiOptionActive,
                  ]}
                  onPress={() => {
                    setCustomCategoryEmoji(emoji);
                    setShowCategoryEmojiModal(false);
                  }}
                >
                  <Text style={styles.emojiOptionText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* User Search Modal */}
      <Modal
        visible={showSearchModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSearchModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.searchModal}>
            <View style={styles.searchHeader}>
              <Text style={styles.searchTitle}>사용자 검색</Text>
              <TouchableOpacity onPress={() => {
                setShowSearchModal(false);
                setSearchQuery('');
                setSearchResults([]);
              }} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color={Colors.textLight} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder={t('agreement.participantSearchPlaceholder')}
                placeholderTextColor={Colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }} style={styles.clearSearch}>
                  <Ionicons name="close-circle" size={20} color={Colors.textLight} />
                </TouchableOpacity>
              )}
            </View>

            {isSearching ? (
              <View style={styles.searchLoading}>
                <ActivityIndicator color={Colors.primary} size="large" />
                <Text style={styles.searchLoadingText}>검색 중...</Text>
              </View>
            ) : searchResults.length > 0 ? (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View
                    style={styles.searchResultItem}
                  >
                    {renderUserAvatar(item, 44)}
                    <View style={styles.searchResultInfo}>
                      <Text style={styles.searchResultName}>{item.nickname}</Text>
                      <View style={styles.relationshipRow}>
                        <View style={[
                          styles.relationshipBadge,
                          item.relationship === 'FRIEND'
                            ? styles.friendBadge
                            : styles.nonFriendBadge,
                        ]}>
                          <Ionicons
                            name={item.relationship === 'FRIEND' ? 'checkmark' : 'person-outline'}
                            size={11}
                            color={item.relationship === 'FRIEND' ? Colors.primary : Colors.textSecondary}
                          />
                          <Text style={[
                            styles.relationshipBadgeText,
                            item.relationship === 'FRIEND' && styles.friendBadgeText,
                          ]}>
                            {item.relationship === 'FRIEND' ? '친구' : '친구 아님'}
                          </Text>
                        </View>
                        <Text style={styles.searchResultId}>@{item.id.substring(0, 8)}</Text>
                      </View>
                    </View>
                    {item.relationship === 'FRIEND' ? (
                      <TouchableOpacity
                        style={styles.addParticipantButton}
                        onPress={() => addParticipant(item)}
                      >
                        <Ionicons name="add" size={17} color="#FFFFFF" />
                        <Text style={styles.addParticipantButtonText}>추가</Text>
                      </TouchableOpacity>
                    ) : item.relationship === 'NONE' ? (
                      <TouchableOpacity
                        style={styles.friendRequestButton}
                        onPress={() => sendFriendRequest(item)}
                        disabled={requestingFriendIds.has(item.id)}
                      >
                        {requestingFriendIds.has(item.id) ? (
                          <ActivityIndicator size="small" color={Colors.primary} />
                        ) : (
                          <>
                            <Ionicons name="person-add-outline" size={15} color={Colors.primary} />
                            <Text style={styles.friendRequestButtonText}>친구 요청</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.pendingRequestBadge}>
                        <Text style={styles.pendingRequestText}>
                          {item.relationship === 'PENDING_INCOMING' ? '요청 받음' : '요청 보냄'}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
                contentContainerStyle={styles.searchResultList}
              />
            ) : searchQuery.length >= 2 ? (
              <View style={styles.noResults}>
                <Ionicons name="search-outline" size={48} color={Colors.textLight} style={styles.noResultsEmoji} />
                <Text style={styles.noResultsText}>검색 결과가 없습니다</Text>
              </View>
            ) : (
              <View style={styles.searchHint}>
                <Ionicons name="information-circle-outline" size={32} color={Colors.textLight} style={styles.searchHintEmoji} />
                <Text style={styles.searchHintText}>닉네임을 2자 이상 입력하세요</Text>
              </View>
            )}
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
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: Colors.text,
  },
  headerSpacer: {
    width: 40,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
  },
  screenTitle: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.bold,
    color: Colors.text,
    marginBottom: Spacing.xl,
    marginTop: Spacing.sm,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.bold,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    fontSize: FontSizes.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
    paddingTop: Spacing.lg,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  categoryButton: {
    width: '31%',
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.card,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  categoryButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.secondary,
  },
  categoryEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  categoryLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontWeight: FontWeights.medium,
  },
  categoryLabelActive: {
    color: Colors.primary,
    fontWeight: FontWeights.bold,
  },
  customCategoryEditor: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  customEmojiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.background,
  },
  customEmoji: {
    width: 48,
    fontSize: 32,
    textAlign: 'center',
  },
  customEmojiCopy: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  customEmojiTitle: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.bold,
    color: Colors.text,
  },
  customEmojiHint: {
    marginTop: 2,
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  customCategoryInput: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    fontSize: FontSizes.md,
    backgroundColor: Colors.card,
  },
  emojiModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  emojiModalContent: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.card,
    ...Shadows.large,
  },
  emojiModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  emojiModalTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: Colors.text,
  },
  emojiOptionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  emojiOption: {
    width: '21.5%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  emojiOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.secondary,
  },
  emojiOptionText: {
    fontSize: 28,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  scheduleTypeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  scheduleTypeButton: {
    flex: 1,
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  scheduleTypeButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.secondary,
  },
  scheduleTypeTitle: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.bold,
    color: Colors.text,
  },
  scheduleTypeTitleActive: {
    color: Colors.primary,
  },
  scheduleTypeDescription: {
    marginTop: 2,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  dateSectionLabel: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeights.semibold,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  dateButtonActive: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.primary,
  },
  dateButtonText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    fontWeight: FontWeights.medium,
  },
  dateButtonTextActive: {
    color: Colors.primary,
    fontWeight: FontWeights.bold,
  },
  clearButton: {
    marginTop: Spacing.md,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    backgroundColor: '#FEF2F2',
    borderRadius: BorderRadius.md,
  },
  clearText: {
    fontSize: FontSizes.sm,
    color: Colors.error,
    fontWeight: FontWeights.bold,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  searchButtonText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    fontWeight: FontWeights.medium,
  },
  participantList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  participantChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.secondary,
    paddingVertical: Spacing.xs,
    paddingLeft: Spacing.xs,
    paddingRight: Spacing.sm,
    borderRadius: BorderRadius.round,
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  participantName: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
    fontWeight: FontWeights.bold,
  },
  removeButton: {
    marginLeft: 4,
  },
  hint: {
    fontSize: FontSizes.xs,
    color: Colors.textLight,
    marginTop: Spacing.sm,
  },
  submitButton: {
    marginTop: Spacing.xl,
  },
  
  // Search Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  searchModal: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    height: '80%',
    ...Shadows.large,
  },
  searchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchTitle: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.text,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: Spacing.lg,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.text,
  },
  clearSearch: {
    padding: Spacing.xs,
  },
  searchLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  searchLoadingText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    fontWeight: FontWeights.medium,
  },
  searchResultList: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    textAlign: 'center',
  },
  avatar: {
    backgroundColor: Colors.border,
  },
  searchResultInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  searchResultName: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
    color: Colors.text,
    marginBottom: 2,
  },
  searchResultId: {
    fontSize: FontSizes.xs,
    color: Colors.textLight,
  },
  relationshipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  relationshipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: BorderRadius.round,
  },
  friendBadge: {
    backgroundColor: Colors.secondary,
  },
  nonFriendBadge: {
    backgroundColor: Colors.background,
  },
  relationshipBadgeText: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: FontWeights.semibold,
  },
  friendBadgeText: {
    color: Colors.primary,
  },
  addParticipantButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.primary,
  },
  addParticipantButtonText: {
    color: '#FFFFFF',
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.bold,
  },
  friendRequestButton: {
    minWidth: 82,
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.card,
  },
  friendRequestButtonText: {
    color: Colors.primary,
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.bold,
  },
  pendingRequestBadge: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.background,
  },
  pendingRequestText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.semibold,
  },
  noResults: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResultsEmoji: {
    marginBottom: Spacing.md,
  },
  noResultsText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    fontWeight: FontWeights.medium,
  },
  searchHint: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchHintEmoji: {
    marginBottom: Spacing.md,
  },
  searchHintText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    fontWeight: FontWeights.medium,
  },
});
