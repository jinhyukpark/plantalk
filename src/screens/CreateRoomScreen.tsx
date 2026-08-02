import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights, Shadows } from '../constants/theme';
import { ROOM_CATEGORIES } from '../types';
import { apiService } from '../services/api';
import { useApp } from '../context/AppContext';
import { locationService, Coordinates } from '../services/locationService';
import Card from '../components/Card';
import Button from '../components/Button';
import { useLanguage } from '../context/LanguageContext';
import { getRoomCategoryTranslationKey } from '../i18n/translations';

const ROOM_EMOJI_OPTIONS = [
  '🍻', '🥂', '🍷', '🍸', '☕', '🍵', '🥤', '🍕',
  '🍔', '🍜', '🍣', '🍰', '🎮', '🎨', '🎸', '🎤',
  '🎬', '📷', '🧩', '🎲', '⚽', '🏀', '🏐', '🎾',
  '🏸', '🏓', '🥊', '🏃', '🚴', '🏕️', '🏖️', '⛰️',
  '🚗', '🚆', '✈️', '🗺️', '📚', '✏️', '💻', '🧠',
  '💼', '🤝', '💬', '🎉', '🎂', '❤️', '🐶', '🐱',
  '🌸', '🌿', '⭐', '🔥', '✨', '🚀', '💡', '📌',
];

export default function CreateRoomScreen() {
  const navigation = useNavigation<any>();
  const bottomPadding = Spacing.lg;
  const { currentUser } = useApp();
  const { t } = useLanguage();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('drinking');
  const [roomEmoji, setRoomEmoji] = useState('🍺');
  const [showEmojiModal, setShowEmojiModal] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [maxParticipants, setMaxParticipants] = useState('5');
  const [locationName, setLocationName] = useState('');
  const [startsAt, setStartsAt] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);

  const selectedCategory = ROOM_CATEGORIES.find(c => c.id === category);

  const fetchCurrentLocation = async () => {
    setLocationLoading(true);
    try {
      const result = await locationService.getCurrentLocation();
      if (result.success && result.coordinates) {
        setUserLocation(result.coordinates);
        setUseCurrentLocation(true);
      } else {
        setUseCurrentLocation(false);
        if (result.error !== 'permission_denied') {
          Alert.alert('알림', '현재 위치를 가져올 수 없습니다');
        }
      }
    } catch (error) {
      console.error('Error fetching location:', error);
      setUseCurrentLocation(false);
    } finally {
      setLocationLoading(false);
    }
  };

  const handleToggleLocation = async () => {
    if (!useCurrentLocation) {
      await fetchCurrentLocation();
    } else {
      setUseCurrentLocation(false);
      setUserLocation(null);
    }
  };

  const handleCreateRoom = async () => {
    if (!title.trim()) {
      Alert.alert('알림', '방 제목을 입력해주세요');
      return;
    }

    if (!currentUser) {
      Alert.alert('알림', '로그인이 필요합니다');
      return;
    }

    if (!maxParticipants) {
      Alert.alert('알림', t('rooms.maxParticipantsRequired'));
      return;
    }

    setLoading(true);
    try {
      const room = await apiService.createRoom({
        title: title.trim(),
        description: description.trim(),
        category,
        emoji: roomEmoji,
        visibility: isPublic ? 'PUBLIC' : 'PRIVATE',
        creatorId: currentUser.id,
        creatorName: currentUser.nickname,
        locationName: locationName.trim() || undefined,
        latitude: useCurrentLocation && userLocation ? userLocation.latitude : undefined,
        longitude: useCurrentLocation && userLocation ? userLocation.longitude : undefined,
        startsAt: startsAt?.toISOString(),
        maxParticipants: parseInt(maxParticipants, 10),
      });
      
      navigation.replace('RoomDetail', { roomId: room.id });
    } catch (error) {
      console.error('Failed to create room:', error);
      Alert.alert('오류', '방을 만드는 데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleMaxParticipantsChange = (value: string) => {
    const digitsOnly = value.replace(/\D/g, '');
    if (!digitsOnly) {
      setMaxParticipants('');
      return;
    }

    setMaxParticipants(String(Math.min(parseInt(digitsOnly, 10), 10)));
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const newDate = startsAt || new Date();
      newDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      setStartsAt(new Date(newDate));
      setShowTimePicker(true);
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime && startsAt) {
      const newDate = new Date(startsAt);
      newDate.setHours(selectedTime.getHours(), selectedTime.getMinutes());
      setStartsAt(newDate);
    }
  };

  const formatDateTime = (date: Date) => {
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('rooms.create')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: bottomPadding }} showsVerticalScrollIndicator={false}>
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>{t('rooms.info')}</Text>
          
          <Text style={styles.label}>{t('rooms.titleLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('rooms.titlePlaceholder')}
            placeholderTextColor={Colors.textMuted}
            value={title}
            onChangeText={setTitle}
            maxLength={50}
          />

          <Text style={styles.label}>{t('rooms.description')}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={t('rooms.descriptionPlaceholder')}
            placeholderTextColor={Colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            maxLength={200}
          />
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>{t('rooms.categoryRequired')}</Text>
          <View style={styles.categoryGrid}>
            {ROOM_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryItem, category === cat.id && styles.categoryItemActive]}
                onPress={() => {
                  setCategory(cat.id);
                  setRoomEmoji(cat.emoji);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                <Text style={[styles.categoryLabel, category === cat.id && styles.categoryLabelActive]}>
                  {t(getRoomCategoryTranslationKey(cat.id))}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[
                styles.categoryItem,
                styles.moreEmojiItem,
                roomEmoji !== selectedCategory?.emoji && styles.categoryItemActive,
              ]}
              onPress={() => setShowEmojiModal(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.categoryEmoji}>
                {roomEmoji !== selectedCategory?.emoji ? roomEmoji : '＋'}
              </Text>
              <Text
                style={[
                  styles.categoryLabel,
                  roomEmoji !== selectedCategory?.emoji && styles.categoryLabelActive,
                ]}
              >
                {t('rooms.chooseEmoji')}
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>{t('rooms.settings')}</Text>
          
          <Text style={styles.label}>{t('rooms.visibilityRequired')}</Text>
          <View style={styles.visibilitySelector}>
            <TouchableOpacity
              style={[styles.visibilityOption, isPublic && styles.visibilityOptionActive]}
              onPress={() => setIsPublic(true)}
            >
              <Ionicons name="earth" size={22} color={isPublic ? Colors.primary : Colors.textSecondary} />
              <Text style={[styles.visibilityTitle, isPublic && styles.visibilityTitleActive]}>
                {t('rooms.public')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.visibilityOption, !isPublic && styles.visibilityOptionActive]}
              onPress={() => setIsPublic(false)}
            >
              <Ionicons name="lock-closed" size={22} color={!isPublic ? Colors.primary : Colors.textSecondary} />
              <Text style={[styles.visibilityTitle, !isPublic && styles.visibilityTitleActive]}>
                {t('rooms.private')}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>{t('rooms.maxParticipants')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('rooms.maxParticipantsPlaceholder')}
            placeholderTextColor={Colors.textMuted}
            value={maxParticipants}
            onChangeText={handleMaxParticipantsChange}
            keyboardType="number-pad"
            maxLength={2}
          />

          <View style={styles.settingRow}>
            <View style={styles.settingLabelContainer}>
              <View style={styles.settingLabelWithIcon}>
                <Ionicons name="location" size={18} color={Colors.primary} />
                <Text style={styles.settingLabel}>{t('rooms.useLocation')}</Text>
              </View>
              <Text style={styles.settingDescription}>
                {userLocation 
                  ? t('rooms.locationNearbyHint')
                  : t('rooms.locationSearchHint')}
              </Text>
            </View>
            {locationLoading ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Switch
                value={useCurrentLocation}
                onValueChange={handleToggleLocation}
                trackColor={{ false: Colors.border, true: 'rgba(107, 78, 255, 0.3)' }}
                thumbColor={useCurrentLocation ? Colors.primary : '#f4f3f4'}
              />
            )}
          </View>

          <Text style={styles.label}>{t('rooms.locationName')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('rooms.locationPlaceholder')}
            placeholderTextColor={Colors.textMuted}
            value={locationName}
            onChangeText={setLocationName}
            maxLength={50}
          />

          <Text style={styles.label}>{t('rooms.startTime')}</Text>
          <TouchableOpacity
            style={[styles.dateButton, startsAt && styles.dateButtonActive]}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={20} color={startsAt ? Colors.primary : Colors.textSecondary} />
            <Text style={startsAt ? styles.dateText : styles.datePlaceholder}>
              {startsAt ? formatDateTime(startsAt) : t('rooms.selectDateTime')}
            </Text>
          </TouchableOpacity>
          
          {startsAt && (
            <TouchableOpacity
              style={styles.clearDateButton}
              onPress={() => setStartsAt(null)}
            >
              <Ionicons name="close-circle" size={16} color={Colors.error} />
              <Text style={styles.clearDateText}>{t('rooms.resetDate')}</Text>
            </TouchableOpacity>
          )}
        </Card>

        <View style={styles.buttonContainer}>
          {loading ? (
            <View style={[styles.createButton, styles.loadingButton]}>
              <ActivityIndicator color={Colors.card} />
            </View>
          ) : (
            <Button
              title={t('rooms.create')}
              onPress={handleCreateRoom}
              disabled={!title.trim() || !maxParticipants}
              style={styles.createButton}
              size="large"
            />
          )}
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      {showDatePicker && (
        <DateTimePicker
          value={startsAt || new Date()}
          mode="date"
          display="default"
          onChange={handleDateChange}
          minimumDate={new Date()}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={startsAt || new Date()}
          mode="time"
          display="default"
          onChange={handleTimeChange}
        />
      )}

      <Modal
        visible={showEmojiModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEmojiModal(false)}
      >
        <View style={styles.emojiModalOverlay}>
          <View style={styles.emojiModalContent}>
            <View style={styles.emojiModalHeader}>
              <View>
                <Text style={styles.emojiModalTitle}>{t('rooms.chooseIcon')}</Text>
                <Text style={styles.emojiModalDescription}>{t('rooms.chooseIconHint')}</Text>
              </View>
              <TouchableOpacity
                style={styles.emojiModalClose}
                onPress={() => setShowEmojiModal(false)}
              >
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.emojiOptionsScroll}
              contentContainerStyle={styles.emojiOptionsGrid}
              showsVerticalScrollIndicator={false}
            >
              {ROOM_EMOJI_OPTIONS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={[
                    styles.emojiOption,
                    roomEmoji === emoji && styles.emojiOptionActive,
                  ]}
                  onPress={() => {
                    setRoomEmoji(emoji);
                    setShowEmojiModal(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.emojiOptionText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.defaultEmojiButton}
              onPress={() => {
                setRoomEmoji(selectedCategory?.emoji || '💬');
                setShowEmojiModal(false);
              }}
            >
              <Text style={styles.defaultEmojiButtonText}>
                {t('rooms.useCategoryIcon', { icon: selectedCategory?.emoji || '💬' })}
              </Text>
            </TouchableOpacity>
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
  keyboardView: {
    flex: 1,
  },
  header: {
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
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.bold,
    color: Colors.text,
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  categoryItemActive: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.primary,
  },
  categoryEmoji: {
    fontSize: 18,
    marginRight: Spacing.xs,
  },
  categoryLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeights.medium,
  },
  categoryLabelActive: {
    color: Colors.primary,
    fontWeight: FontWeights.bold,
  },
  moreEmojiItem: {
    borderStyle: 'dashed',
  },
  emojiModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  emojiModalContent: {
    maxHeight: '72%',
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: Colors.card,
  },
  emojiModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  emojiModalTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: Colors.text,
  },
  emojiModalDescription: {
    marginTop: 4,
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  emojiModalClose: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: Colors.background,
  },
  emojiOptionsScroll: {
    flexGrow: 0,
  },
  emojiOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: Spacing.md,
  },
  emojiOption: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    backgroundColor: Colors.background,
  },
  emojiOptionActive: {
    borderWidth: 2,
    borderColor: Colors.primary,
    backgroundColor: Colors.secondary,
  },
  emojiOptionText: {
    fontSize: 24,
  },
  defaultEmojiButton: {
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.background,
  },
  defaultEmojiButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
    color: Colors.textSecondary,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  visibilitySelector: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  visibilityOption: {
    flex: 1,
    minHeight: 58,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  visibilityOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.secondary,
  },
  visibilityTitle: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.bold,
    color: Colors.textSecondary,
  },
  visibilityTitleActive: {
    color: Colors.primary,
  },
  settingLabelContainer: {
    flex: 1,
    marginRight: Spacing.md,
  },
  settingLabelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  settingLabel: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
    color: Colors.text,
  },
  settingDescription: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  dateButtonActive: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.primary,
  },
  dateText: {
    fontSize: FontSizes.md,
    color: Colors.primary,
    fontWeight: FontWeights.bold,
  },
  datePlaceholder: {
    fontSize: FontSizes.md,
    color: Colors.textMuted,
  },
  clearDateButton: {
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: BorderRadius.md,
  },
  clearDateText: {
    fontSize: FontSizes.sm,
    color: Colors.error,
    fontWeight: FontWeights.bold,
  },
  buttonContainer: {
    paddingVertical: Spacing.xl,
  },
  createButton: {
  },
  loadingButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
  },
});
