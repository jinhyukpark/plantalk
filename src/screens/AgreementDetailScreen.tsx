import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { ProfilePopup } from '../components/ProfilePopup';
import { useApp } from '../context/AppContext';
import { getAgreementStatus, getCategoryInfo, AgreementStatusType } from '../types';
import { Colors, Spacing, FontSizes, BorderRadius, FontWeights, Shadows, getSafeBottomPadding } from '../constants/theme';
import { apiService, AgreementEvent } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SearchedUser {
  id: string;
  nickname: string;
  avatarEmoji?: string;
  avatarColor?: string;
  avatarPhotoUri?: string;
}

const STATUS_OPTIONS: { value: AgreementStatusType; label: string; emoji: string }[] = [
  { value: 'PENDING', label: '대기중', emoji: '⏳' },
  { value: 'IN_PROGRESS', label: '진행중', emoji: '🔄' },
  { value: 'COMPLETED', label: '완료', emoji: '✅' },
];

export function AgreementDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { user, agreements, updateParticipantStatus, refreshAgreements } = useApp();
  const { t, language } = useLanguage();
  const { agreementId } = route.params;
  const insets = useSafeAreaInsets();
  const bottomPadding = Spacing.lg;

  const [showAddModal, setShowAddModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchedUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isUpdatingContent, setIsUpdatingContent] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiRef = useRef<any>(null);

  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [timelineEvents, setTimelineEvents] = useState<AgreementEvent[]>([]);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);
  const [selectedProfileNickname, setSelectedProfileNickname] = useState<string | null>(null);

  const agreement = useMemo(() => 
    agreements.find(a => a.id === agreementId),
    [agreements, agreementId]
  );

  const loadTimeline = useCallback(async () => {
    if (!agreementId) return;
    setIsLoadingTimeline(true);
    try {
      const events = await apiService.getAgreementTimeline(agreementId);
      setTimelineEvents(events);
    } catch (error) {
      console.error('Failed to load timeline:', error);
    } finally {
      setIsLoadingTimeline(false);
    }
  }, [agreementId]);

  useEffect(() => {
    // 빠른 초기 렌더링을 위해 순차 실행이 아닌 병렬 실행
    Promise.all([
      refreshAgreements(),
      loadTimeline()
    ]);
  }, [refreshAgreements, loadTimeline]);

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

  const searchUsers = async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      if (!user) return;
      const [results, friends] = await Promise.all([
        apiService.searchUsers(query.trim()),
        apiService.getFriends(user.id),
      ]);
      const friendIds = new Set(friends.map(friend => friend.friendId));
      const existingNames = agreement?.participants.map(p => p.userName) || [];
      const filteredResults = results.filter(
        (u: SearchedUser) => friendIds.has(u.id) && !existingNames.includes(u.nickname)
      );
      setSearchResults(filteredResults);
    } catch (error) {
      console.error('User search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const addParticipant = async (searchedUser: SearchedUser) => {
    if (!agreement || !user) return;
    
    setIsAdding(true);
    try {
      await apiService.addParticipantToAgreement(agreement.id, searchedUser.nickname, user.id);
      await refreshAgreements();
      setShowAddModal(false);
      setSearchQuery('');
      setSearchResults([]);
      Alert.alert('완료', `${searchedUser.nickname}님이 참여자로 추가되었습니다.`);
    } catch (error: any) {
      console.error('Failed to add participant:', error);
      const message = error.message || '참여자 추가에 실패했습니다.';
      Alert.alert('오류', message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleStatusChange = async (newStatus: AgreementStatusType) => {
    if (!agreement || !user) return;
    
    setIsUpdatingStatus(true);
    try {
      await apiService.updateAgreementStatus(agreement.id, user.id, newStatus);
      await refreshAgreements();
      await loadTimeline();
      setShowStatusModal(false);
      
      if (newStatus === 'COMPLETED') {
        setShowConfetti(true);
        setTimeout(() => {
          Alert.alert('🎉 축하합니다!', '약속이 완료되었습니다!');
        }, 500);
      } else {
        Alert.alert('완료', '약속 상태가 변경되었습니다.');
      }
    } catch (error: any) {
      console.error('Failed to update status:', error);
      const message = error.message || '상태 변경에 실패했습니다.';
      Alert.alert('오류', message);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const openEditModal = () => {
    if (agreement) {
      setEditTitle(agreement.title);
      setEditDescription(agreement.description || '');
      setShowEditModal(true);
    }
  };

  const handleContentUpdate = async () => {
    if (!agreement || !user) return;
    
    const hasChanges = editTitle !== agreement.title || editDescription !== (agreement.description || '');
    
    if (!hasChanges) {
      setShowEditModal(false);
      return;
    }

    const otherAgreedParticipants = agreement.participants.filter(
      p => p.userName !== user.nickname && p.status === 'agreed'
    );

    if (otherAgreedParticipants.length > 0) {
      Alert.alert(
        '⚠️ 동의 초기화 알림',
        `내용을 수정하면 ${otherAgreedParticipants.length}명의 동의가 초기화됩니다. 참여자들이 다시 동의해야 합니다.\n\n계속하시겠습니까?`,
        [
          { text: '취소', style: 'cancel' },
          { 
            text: '수정', 
            style: 'destructive',
            onPress: performContentUpdate 
          },
        ]
      );
    } else {
      performContentUpdate();
    }
  };

  const performContentUpdate = async () => {
    if (!agreement || !user) return;
    
    setIsUpdatingContent(true);
    try {
      await apiService.updateAgreementContent(
        agreement.id,
        user.id,
        editTitle !== agreement.title ? editTitle : undefined,
        editDescription !== (agreement.description || '') ? editDescription : undefined
      );
      await refreshAgreements();
      await loadTimeline();
      setShowEditModal(false);
      Alert.alert('완료', '약속 내용이 수정되었습니다.');
    } catch (error: any) {
      console.error('Failed to update content:', error);
      const message = error.message || '내용 수정에 실패했습니다.';
      Alert.alert('오류', message);
    } finally {
      setIsUpdatingContent(false);
    }
  };

  if (!agreement) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorEmoji}>😢</Text>
          <Text style={styles.errorText}>약속을 찾을 수 없습니다.</Text>
          <Button title="돌아가기" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  const categoryInfo = getCategoryInfo(agreement.category);
  const derivedStatus = getAgreementStatus(agreement);
  const userParticipant = agreement.participants.find(
    p => p.userName === user?.nickname
  );
  const canRespond = userParticipant?.status === 'waiting';
  const isCreator = agreement.creatorId === user?.id;

  const getStatusLabel = (status: AgreementStatusType) => {
    const option = STATUS_OPTIONS.find(o => o.value === status);
    return option ? `${option.emoji} ${option.label}` : status;
  };

  const formatDateTime = (date: Date | null) => {
    if (!date) return '';
    const d = new Date(date);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? '오후' : '오전';
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${month}월 ${day}일 ${ampm} ${displayHours}:${minutes}`;
  };

  const calculateDDay = (date: Date | null) => {
    if (!date) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'D-Day';
    if (diffDays > 0) return `D-${diffDays}`;
    return `D+${Math.abs(diffDays)}`;
  };

  const getDDayColor = (date: Date | null) => {
    if (!date) return Colors.textSecondary;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return '#EF4444'; // D-Day - red
    if (diffDays > 0 && diffDays <= 3) return '#F59E0B'; // Soon - orange
    if (diffDays > 0) return Colors.primary; // Future - blue
    return Colors.textSecondary; // Past - gray
  };

  const handleResponse = (response: 'agreed' | 'declined' | 'skipped') => {
    const messages = {
      agreed: '이 약속에 동의하시겠습니까?',
      declined: '이 약속을 거절하시겠습니까?',
      skipped: '나중에 결정하시겠습니까?',
    };

    Alert.alert('확인', messages[response], [
      { text: '취소', style: 'cancel' },
      {
        text: '확인',
        onPress: async () => {
          await updateParticipantStatus(agreementId, response);
          await refreshAgreements();
          await loadTimeline();
          Alert.alert('완료', '응답이 기록되었습니다!');
        },
      },
    ]);
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'created': return '🎉';
      case 'participant_added': return '👤';
      case 'participant_responded': return '✋';
      case 'status_changed': return '🔄';
      case 'content_updated': return '✏️';
      case 'consent_reset': return '⚠️';
      default: return '📌';
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'created': return Colors.success;
      case 'participant_added': return Colors.primary;
      case 'participant_responded': return '#8B5CF6';
      case 'status_changed': return '#F59E0B';
      case 'content_updated': return '#3B82F6';
      case 'consent_reset': return Colors.error;
      default: return Colors.textSecondary;
    }
  };

  const formatTimelineDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? '오후' : '오전';
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${month}/${day} ${ampm} ${displayHours}:${minutes}`;
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
    if (searchedUser.avatarPhotoUri) {
      return (
        <Image 
          source={{ uri: searchedUser.avatarPhotoUri }} 
          style={[styles.searchAvatar, { width: size, height: size, borderRadius: size / 2 }]} 
        />
      );
    }
    
    const defaultAvatar = getDefaultAvatar(searchedUser.nickname);
    const emoji = searchedUser.avatarEmoji || defaultAvatar.emoji;
    const color = searchedUser.avatarColor || defaultAvatar.color;
    
    return (
      <View style={[styles.searchAvatarPlaceholder, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
        <Text style={[styles.searchAvatarEmoji, { fontSize: size * 0.5 }]}>{emoji}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerEmoji}>{agreement.emoji || categoryInfo.emoji}</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>{agreement.title}</Text>
          </View>
          <Text style={styles.headerSubtitle}>
            👤 {agreement.creatorName} · 👥 {agreement.participants.length}명
          </Text>
        </View>
        {agreement.dateTime && (
          <View style={[styles.ddayBadge, { backgroundColor: getDDayColor(agreement.dateTime) + '20' }]}>
            <Text style={[styles.ddayText, { color: getDDayColor(agreement.dateTime) }]}>
              {calculateDDay(agreement.dateTime)}
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {agreement.status === 'COMPLETED' && (
          <View style={styles.completedBanner}>
            <Text style={styles.completedBannerText}>✅ 약속이 완료되었습니다!</Text>
          </View>
        )}
        {agreement.status === 'IN_PROGRESS' && (
          <View style={styles.inProgressBanner}>
            <Text style={styles.inProgressBannerText}>🔄 약속이 진행중입니다</Text>
          </View>
        )}

        {isCreator && (
          <Card style={styles.statusCard}>
            <View style={styles.statusCardHeader}>
              <Text style={styles.statusCardTitle}>📋 약속 상태</Text>
              <TouchableOpacity 
                style={styles.changeStatusBtn}
                onPress={() => setShowStatusModal(true)}
              >
                <Text style={styles.changeStatusText}>변경</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.currentStatus}>
              <Text style={styles.currentStatusLabel}>현재 상태:</Text>
              <View style={[
                styles.statusBadge,
                agreement.status === 'COMPLETED' && styles.statusBadgeCompleted,
                agreement.status === 'IN_PROGRESS' && styles.statusBadgeInProgress,
                agreement.status === 'PENDING' && styles.statusBadgePending,
              ]}>
                <Text style={styles.statusBadgeText}>{getStatusLabel(agreement.status)}</Text>
              </View>
            </View>
          </Card>
        )}

        <Card style={styles.card}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>제목</Text>
            <View style={styles.editableRow}>
              <Text style={[styles.infoValue, { flex: 1, textAlign: 'right' }]} numberOfLines={2}>
                {agreement.title}
              </Text>
              {isCreator && (
                <TouchableOpacity style={styles.editButton} onPress={openEditModal}>
                  <Ionicons name="pencil" size={16} color={Colors.primary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>카테고리</Text>
            <View style={styles.categoryTag}>
              <Text style={styles.categoryText}>
                {agreement.emoji || categoryInfo.emoji}{' '}
                {agreement.category === 'custom' && agreement.customCategoryName
                  ? agreement.customCategoryName
                  : language === 'ko'
                    ? categoryInfo.labelKo
                    : language === 'ja'
                      ? categoryInfo.labelJa
                      : categoryInfo.label}
              </Text>
            </View>
          </View>
          <View style={[styles.infoRow]}>
            <Text style={styles.infoLabel}>설명</Text>
            <View style={styles.editableRow}>
              <Text style={[styles.infoValue, { flex: 1, textAlign: 'right' }]} numberOfLines={3}>
                {agreement.description || '(없음)'}
              </Text>
              {isCreator && (
                <TouchableOpacity style={styles.editButton} onPress={openEditModal}>
                  <Ionicons name="pencil" size={16} color={Colors.primary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
          {agreement.dateTime && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{agreement.scheduleType === 'RANGE' ? '기간' : '일시'}</Text>
              <Text style={[styles.infoValue, styles.infoValueHighlight]}>
                {agreement.scheduleType === 'RANGE' && agreement.endDateTime
                  ? `${formatDateTime(agreement.dateTime)}\n~ ${formatDateTime(agreement.endDateTime)}`
                  : formatDateTime(agreement.dateTime)}
              </Text>
            </View>
          )}
          <View style={[styles.infoRow, styles.infoRowLast]}>
            <Text style={styles.infoLabel}>생성일</Text>
            <Text style={styles.infoValue}>{formatDateTime(agreement.createdAt)}</Text>
          </View>
        </Card>

        <View style={styles.participantsSection}>
          <View style={styles.participantsHeader}>
            <Text style={styles.sectionTitle}>참여자 ({agreement.participants.length}명)</Text>
            {isCreator && (
              <TouchableOpacity 
                style={styles.addParticipantButton}
                onPress={() => setShowAddModal(true)}
              >
                <Ionicons name="person-add" size={16} color={Colors.primary} />
                <Text style={styles.addParticipantText}>추가</Text>
              </TouchableOpacity>
            )}
          </View>
          {agreement.participants.map(participant => (
            <TouchableOpacity 
              key={participant.id} 
              style={styles.participantRow}
              onPress={() => setSelectedProfileNickname(participant.userName)}
              activeOpacity={0.7}
            >
              <View style={styles.participantInfo}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {participant.userName.charAt(0)}
                  </Text>
                </View>
                <View>
                  <Text style={styles.participantName}>
                    {participant.userName}
                    {participant.userName === agreement.creatorName && (
                      <Text style={styles.creatorBadge}> (생성자)</Text>
                    )}
                  </Text>
                  {participant.updatedAt && (
                    <Text style={styles.participantTime}>
                      {formatDateTime(participant.updatedAt)}
                    </Text>
                  )}
                </View>
              </View>
              <StatusBadge status={participant.status} />
            </TouchableOpacity>
          ))}
        </View>

        {canRespond && (
          <View style={styles.responseSection}>
            <Text style={styles.responseTitle}>당신의 응답을 선택하세요</Text>
            <Text style={styles.responseHint}>
              모든 참여자가 동의해야 약속이 완료됩니다.
            </Text>
            <View style={styles.responseButtons}>
              <Button
                title="동의"
                onPress={() => handleResponse('agreed')}
                variant="success"
                size="medium"
                style={styles.responseButton}
              />
              <Button
                title="거절"
                onPress={() => handleResponse('declined')}
                variant="danger"
                size="medium"
                style={styles.responseButton}
              />
              <Button
                title="나중에"
                onPress={() => handleResponse('skipped')}
                variant="outline"
                size="medium"
                style={styles.responseButton}
              />
            </View>
          </View>
        )}

        <View style={styles.timelineSection}>
          <Text style={styles.sectionTitle}>활동 기록</Text>
          {isLoadingTimeline ? (
            <View style={styles.timelineLoading}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={styles.timelineLoadingText}>기록 불러오는 중...</Text>
            </View>
          ) : timelineEvents.length > 0 ? (
            timelineEvents.map((event, index) => (
              <View key={event.id} style={styles.timelineItem}>
                <View style={styles.timelineIndicator}>
                  <View style={[
                    styles.timelineDot,
                    { backgroundColor: getEventColor(event.eventType) }
                  ]}>
                    <Text style={styles.timelineDotIcon}>{getEventIcon(event.eventType)}</Text>
                  </View>
                  {index < timelineEvents.length - 1 && (
                    <View style={styles.timelineLine} />
                  )}
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineText}>
                    {event.description}
                  </Text>
                  {event.oldValue && event.newValue && event.eventType === 'content_updated' && (
                    <View style={styles.timelineChange}>
                      <Text style={styles.timelineChangeOld}>변경 전: {event.oldValue}</Text>
                      <Text style={styles.timelineChangeNew}>변경 후: {event.newValue}</Text>
                    </View>
                  )}
                  <Text style={styles.timelineDate}>
                    {formatTimelineDate(event.createdAt)}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyTimeline}>
              <Text style={styles.emptyTimelineEmoji}>📝</Text>
              <Text style={styles.emptyTimelineText}>아직 활동 기록이 없습니다</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={showStatusModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStatusModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.statusModalContent}>
            <Text style={styles.modalTitle}>📋 상태 변경</Text>
            <Text style={styles.modalSubtitle}>약속의 진행 상태를 선택하세요</Text>
            
            {STATUS_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.statusOption,
                  agreement.status === option.value && styles.statusOptionActive,
                ]}
                onPress={() => handleStatusChange(option.value)}
                disabled={isUpdatingStatus}
              >
                <Text style={styles.statusOptionEmoji}>{option.emoji}</Text>
                <Text style={[
                  styles.statusOptionLabel,
                  agreement.status === option.value && styles.statusOptionLabelActive,
                ]}>
                  {option.label}
                </Text>
                {agreement.status === option.value && (
                  <Text style={styles.checkMark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
            
            {isUpdatingStatus && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator color={Colors.primary} size="large" />
              </View>
            )}
            
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setShowStatusModal(false)}
            >
              <Text style={styles.modalCancelText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.searchModal, { paddingBottom: getSafeBottomPadding(insets.bottom) }]}> 
            <View style={styles.searchHeader}>
              <Text style={styles.searchTitle}>참여자 추가</Text>
              <TouchableOpacity onPress={() => {
                setShowAddModal(false);
                setSearchQuery('');
                setSearchResults([]);
              }}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.searchInputContainer}>
              <Text style={styles.searchIcon}>🔍</Text>
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
                }}>
                  <Text style={styles.clearSearch}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {isSearching ? (
              <View style={styles.searchLoading}>
                <ActivityIndicator color={Colors.primary} />
                <Text style={styles.searchLoadingText}>검색 중...</Text>
              </View>
            ) : searchResults.length > 0 ? (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={styles.searchResultItem}
                    onPress={() => addParticipant(item)}
                    disabled={isAdding}
                  >
                    {renderUserAvatar(item, 44)}
                    <View style={styles.searchResultInfo}>
                      <Text style={styles.searchResultName}>{item.nickname}</Text>
                      <Text style={styles.searchResultId}>@{item.id.substring(0, 8)}</Text>
                    </View>
                    {isAdding ? (
                      <ActivityIndicator size="small" color={Colors.primary} />
                    ) : (
                      <Text style={styles.addIcon}>+</Text>
                    )}
                  </TouchableOpacity>
                )}
                contentContainerStyle={styles.searchResultList}
              />
            ) : searchQuery.length >= 2 ? (
              <View style={styles.noResults}>
                <Text style={styles.noResultsEmoji}>🔍</Text>
                <Text style={styles.noResultsText}>검색 결과가 없습니다</Text>
              </View>
            ) : (
              <View style={styles.searchHint}>
                <Text style={styles.searchHintEmoji}>👆</Text>
                <Text style={styles.searchHintText}>닉네임을 2자 이상 입력하세요</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.editModal, { paddingBottom: getSafeBottomPadding(insets.bottom) }]}> 
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>✏️ 내용 수정</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.editWarning}>
              <Text style={styles.editWarningIcon}>⚠️</Text>
              <Text style={styles.editWarningText}>
                내용을 수정하면 참여자들의 동의가 초기화되어 다시 동의를 받아야 합니다.
              </Text>
            </View>

            <View style={styles.editField}>
              <Text style={styles.editLabel}>제목</Text>
              <TextInput
                style={styles.editInput}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder={t('agreement.titlePlaceholder')}
                placeholderTextColor={Colors.textMuted}
                maxLength={50}
              />
              <Text style={styles.editCharCount}>{editTitle.length}/50</Text>
            </View>

            <View style={styles.editField}>
              <Text style={styles.editLabel}>설명</Text>
              <TextInput
                style={[styles.editInput, styles.editTextArea]}
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder={t('agreement.descriptionOptionalPlaceholder')}
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={200}
              />
              <Text style={styles.editCharCount}>{editDescription.length}/200</Text>
            </View>

            <View style={styles.editButtons}>
              <TouchableOpacity 
                style={styles.editCancelBtn}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={styles.editCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.editSaveBtn,
                  (!editTitle.trim() || isUpdatingContent) && styles.editSaveBtnDisabled
                ]}
                onPress={handleContentUpdate}
                disabled={!editTitle.trim() || isUpdatingContent}
              >
                {isUpdatingContent ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.editSaveText}>저장</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {showConfetti && (
        <ConfettiCannon
          ref={confettiRef}
          count={150}
          origin={{ x: SCREEN_WIDTH / 2, y: -20 }}
          autoStart={true}
          fadeOut={true}
          fallSpeed={3000}
          explosionSpeed={350}
          colors={['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8']}
          onAnimationEnd={() => setShowConfetti(false)}
        />
      )}

      <ProfilePopup
        visible={selectedProfileNickname !== null}
        nickname={selectedProfileNickname}
        onClose={() => setSelectedProfileNickname(null)}
      />
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
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
    minHeight: 56,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    fontSize: 28,
    color: Colors.primary,
    fontWeight: FontWeights.medium,
    marginTop: -2,
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: Spacing.md,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  headerEmoji: {
    fontSize: 20,
  },
  headerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    color: Colors.text,
    flex: 1,
  },
  headerSubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  ddayBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    minWidth: 60,
    alignItems: 'center',
  },
  ddayText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.bold,
  },
  content: {
    padding: Spacing.lg,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  errorText: {
    fontSize: FontSizes.lg,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  completedBanner: {
    backgroundColor: Colors.success,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
    alignItems: 'center',
  },
  completedBannerText: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: '#FFFFFF',
  },
  inProgressBanner: {
    backgroundColor: Colors.primary,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
    alignItems: 'center',
  },
  inProgressBannerText: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: '#FFFFFF',
  },
  statusCard: {
    marginBottom: Spacing.md,
  },
  statusCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  statusCardTitle: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: Colors.text,
  },
  changeStatusBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
  },
  changeStatusText: {
    fontSize: FontSizes.sm,
    color: '#FFFFFF',
    fontWeight: FontWeights.medium,
  },
  currentStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  currentStatusLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.secondary,
  },
  statusBadgeCompleted: {
    backgroundColor: Colors.success + '20',
  },
  statusBadgeInProgress: {
    backgroundColor: Colors.primary + '20',
  },
  statusBadgePending: {
    backgroundColor: Colors.warning + '20',
  },
  statusBadgeText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
    color: Colors.text,
  },
  card: {
    marginBottom: Spacing.md,
  },
  categoryTag: {
    backgroundColor: Colors.secondary,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.round,
  },
  categoryText: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
    fontWeight: FontWeights.medium,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  infoValue: {
    fontSize: FontSizes.sm,
    color: Colors.text,
    fontWeight: FontWeights.medium,
  },
  infoValueHighlight: {
    color: Colors.primary,
    fontWeight: FontWeights.semibold,
  },
  participantsSection: {
    marginBottom: Spacing.lg,
  },
  participantsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: Colors.text,
  },
  addParticipantButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.secondary,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.round,
    gap: Spacing.xs,
  },
  addParticipantIcon: {
    fontSize: 18,
    color: Colors.primary,
    fontWeight: FontWeights.bold,
  },
  addParticipantText: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
    fontWeight: FontWeights.semibold,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    ...Shadows.small,
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    color: Colors.primary,
  },
  participantName: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.medium,
    color: Colors.text,
  },
  creatorBadge: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeights.regular,
  },
  participantTime: {
    fontSize: FontSizes.xs,
    color: Colors.textLight,
    marginTop: 2,
  },
  responseSection: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.medium,
  },
  responseTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  responseHint: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  responseButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  responseButton: {
    flex: 1,
    paddingHorizontal: Spacing.sm,
  },
  timelineSection: {
    marginTop: Spacing.lg,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  timelineIndicator: {
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.divider,
    marginTop: Spacing.xs,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: Spacing.md,
  },
  timelineText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  timelineName: {
    fontWeight: FontWeights.semibold,
    color: Colors.text,
  },
  timelineDate: {
    fontSize: FontSizes.xs,
    color: Colors.textLight,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    width: '85%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  modalSubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.secondary,
    marginBottom: Spacing.sm,
  },
  statusOptionActive: {
    backgroundColor: Colors.primary + '15',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  statusOptionEmoji: {
    fontSize: 24,
    marginRight: Spacing.md,
  },
  statusOptionLabel: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.medium,
    color: Colors.text,
    flex: 1,
  },
  statusOptionLabelActive: {
    color: Colors.primary,
    fontWeight: FontWeights.semibold,
  },
  checkMark: {
    fontSize: FontSizes.lg,
    color: Colors.primary,
    fontWeight: FontWeights.bold,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.xl,
  },
  modalCancelBtn: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    fontWeight: FontWeights.medium,
  },
  searchModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    height: '70%',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  searchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  searchTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    color: Colors.text,
  },
  closeButton: {
    fontSize: 24,
    color: Colors.textSecondary,
    fontWeight: FontWeights.medium,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: Spacing.lg,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.lg,
    height: 48,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.text,
  },
  clearSearch: {
    fontSize: 18,
    color: Colors.textSecondary,
    padding: Spacing.xs,
  },
  searchLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  searchLoadingText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  searchResultList: {
    padding: Spacing.lg,
    paddingTop: 0,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    ...Shadows.small,
  },
  searchAvatar: {
    backgroundColor: Colors.secondary,
  },
  searchAvatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchAvatarEmoji: {
    color: '#FFFFFF',
    fontWeight: FontWeights.bold,
  },
  searchResultInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  searchResultName: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.medium,
    color: Colors.text,
  },
  searchResultId: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  addIcon: {
    fontSize: 24,
    color: Colors.primary,
    fontWeight: FontWeights.bold,
  },
  noResults: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  noResultsEmoji: {
    fontSize: 48,
  },
  noResultsText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  searchHint: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  searchHintEmoji: {
    fontSize: 36,
  },
  searchHintText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  editableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: Spacing.md,
    gap: Spacing.xs,
  },
  editButton: {
    padding: Spacing.xs,
    marginLeft: Spacing.xs,
  },
  editButtonText: {
    fontSize: 16,
  },
  editModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    height: '65%',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.lg,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  editModalTitle: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.text,
  },
  editWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.warning + '15',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  editWarningIcon: {
    fontSize: 18,
  },
  editWarningText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.text,
    lineHeight: 20,
  },
  editField: {
    marginBottom: Spacing.lg,
  },
  editLabel: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  editInput: {
    backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.text,
  },
  editTextArea: {
    minHeight: 100,
    paddingTop: Spacing.md,
  },
  editCharCount: {
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
    textAlign: 'right',
    marginTop: Spacing.xs,
  },
  editButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  editCancelBtn: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
  },
  editCancelText: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.medium,
    color: Colors.textSecondary,
  },
  editSaveBtn: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  editSaveBtnDisabled: {
    backgroundColor: Colors.primary + '50',
  },
  editSaveText: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: '#FFFFFF',
  },
  timelineLoading: {
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  timelineLoadingText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  timelineDotIcon: {
    fontSize: 10,
  },
  timelineChange: {
    marginTop: Spacing.xs,
    backgroundColor: Colors.secondary,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  timelineChangeOld: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  timelineChangeNew: {
    fontSize: FontSizes.xs,
    color: Colors.primary,
    fontWeight: FontWeights.medium,
    marginTop: 2,
  },
  emptyTimeline: {
    padding: Spacing.xl,
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  emptyTimelineEmoji: {
    fontSize: 36,
  },
  emptyTimelineText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
});
