import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights, Shadows, TAB_BAR_HEIGHT } from '../constants/theme';
import { Room, ROOM_CATEGORIES } from '../types';
import { apiService } from '../services/api';
import { useApp } from '../context/AppContext';
import { locationService, Coordinates } from '../services/locationService';
import Card from '../components/Card';
import { useLanguage } from '../context/LanguageContext';
import { getRoomCategoryTranslationKey } from '../i18n/translations';
import { useNotification } from '../context/NotificationContext';

type SortOption = 'newest' | 'nearest' | 'farthest';
type VisibilityFilter = 'ALL' | 'PUBLIC' | 'PRIVATE';

interface RoomWithDistance extends Room {
  distance?: number;
}

const formatDistanceKm = (distance: number): string => {
  if (distance < 0.1) return '<0.1km';
  if (distance < 10) return `${distance.toFixed(1)}km`;
  return `${Math.round(distance)}km`;
};

export default function PublicRoomsScreen() {
  const navigation = useNavigation<any>();
  const { currentUser } = useApp();
  const { t } = useLanguage();
  const { realtimeEvent } = useNotification();
  const insets = useSafeAreaInsets();
  const bottomPadding = insets.bottom + TAB_BAR_HEIGHT + Spacing.lg;
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [locationLoading, setLocationLoading] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('ALL');
  const [draftVisibility, setDraftVisibility] = useState<VisibilityFilter>('ALL');
  const [maxDistance, setMaxDistance] = useState<number | null>(null);
  const [draftMaxDistance, setDraftMaxDistance] = useState<number | null>(null);

  const fetchUserLocation = useCallback(async () => {
    setLocationLoading(true);
    try {
      const result = await locationService.getCurrentLocation();
      if (result.success && result.coordinates) {
        setUserLocation(result.coordinates);
      }
    } catch {
      setUserLocation(null);
    } finally {
      setLocationLoading(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [roomsData, countsData] = await Promise.all([
        apiService.getPublicRooms(selectedCategory || undefined, currentUser?.id, visibilityFilter),
        apiService.getRoomCounts(currentUser?.id, visibilityFilter),
      ]);
      setRooms(roomsData);
      setCategoryCounts(countsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory, currentUser?.id, visibilityFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (realtimeEvent?.type === 'ROOM_LIST' || realtimeEvent?.type === 'ROOM_MEMBERS') {
      void loadData();
    }
  }, [realtimeEvent, loadData]);

  useEffect(() => {
    fetchUserLocation();
  }, [fetchUserLocation]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
    if (sortBy !== 'newest' || userLocation) {
      fetchUserLocation();
    }
  };

  const handleSortChange = async (newSort: SortOption) => {
    setSortBy(newSort);
    if ((newSort === 'nearest' || newSort === 'farthest') && !userLocation) {
      await fetchUserLocation();
    }
  };

  const roomsWithDistance: RoomWithDistance[] = useMemo(() => {
    return rooms.map(room => {
      let distance: number | undefined = undefined;
      if (userLocation && room.latitude != null && room.longitude != null) {
        distance = locationService.calculateDistance(
          userLocation,
          { latitude: room.latitude, longitude: room.longitude }
        );
      }
      return { ...room, distance };
    });
  }, [rooms, userLocation]);

  const sortedRooms = useMemo(() => {
    const sorted = roomsWithDistance.filter(room =>
      maxDistance === null || (room.distance !== undefined && room.distance <= maxDistance)
    );
    
    switch (sortBy) {
      case 'nearest':
        return sorted.sort((a, b) => {
          if (a.distance === undefined && b.distance === undefined) return 0;
          if (a.distance === undefined) return 1;
          if (b.distance === undefined) return -1;
          return a.distance - b.distance;
        });
      case 'farthest':
        return sorted.sort((a, b) => {
          if (a.distance === undefined && b.distance === undefined) return 0;
          if (a.distance === undefined) return 1;
          if (b.distance === undefined) return -1;
          return b.distance - a.distance;
        });
      case 'newest':
      default:
        return sorted;
    }
  }, [roomsWithDistance, sortBy, maxDistance]);

  const applyFilters = async () => {
    setVisibilityFilter(draftVisibility);
    setMaxDistance(draftMaxDistance);
    setFilterVisible(false);
    if (draftMaxDistance !== null && !userLocation) {
      await fetchUserLocation();
    }
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return `오늘 ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const getCategoryEmoji = (category: string) => {
    const cat = ROOM_CATEGORIES.find(c => c.id === category);
    return cat?.emoji || '💬';
  };

  const renderRoomCard = useCallback(({ item }: { item: RoomWithDistance }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('RoomDetail', { roomId: item.id })}
      activeOpacity={0.7}
    >
      <Card style={styles.roomCard}>
        <View style={styles.roomHeader}>
          <View style={styles.emojiContainer}>
            <Text style={styles.roomEmoji}>{item.emoji || getCategoryEmoji(item.category)}</Text>
          </View>
          <View style={styles.roomInfo}>
            <Text style={styles.roomTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.roomCreator}>@{item.creatorName}</Text>
          </View>
          <View style={styles.headerBadges}>
            {item.distance !== undefined && (
              <View style={styles.distanceBadge}>
                <Ionicons name="location" size={12} color={Colors.accent} style={styles.distanceIcon} />
                <Text style={styles.distanceText}>
                  {formatDistanceKm(item.distance)}
                </Text>
              </View>
            )}
            <View style={styles.participantsBadge}>
              <Ionicons name="people" size={12} color={Colors.primary} style={styles.participantsIcon} />
              <Text style={styles.participantsText}>
                {item.currentParticipants}/{item.maxParticipants || '∞'}
              </Text>
            </View>
          </View>
        </View>
        
        {item.description && (
          <Text style={styles.roomDescription} numberOfLines={2}>{item.description}</Text>
        )}
        
        <View style={styles.roomFooter}>
          <View style={[styles.tag, item.visibility === 'PRIVATE' && styles.privateTag]}>
            <Ionicons
              name={item.visibility === 'PRIVATE' ? 'lock-closed' : 'earth'}
              size={12}
              color={item.visibility === 'PRIVATE' ? Colors.accent : Colors.primary}
            />
            <Text style={[styles.tagText, item.visibility === 'PRIVATE' && styles.privateTagText]}>
              {t(item.visibility === 'PRIVATE' ? 'rooms.private' : 'rooms.public')}
            </Text>
          </View>
          {item.startsAt && (
            <View style={styles.tag}>
              <Ionicons name="time-outline" size={12} color={Colors.primary} style={styles.tagIcon} />
              <Text style={styles.tagText}>{formatDateTime(item.startsAt)}</Text>
            </View>
          )}
          {item.locationName && (
            <View style={[styles.tag, styles.locationTag]}>
              <Ionicons name="location-outline" size={12} color={Colors.primary} style={styles.tagIcon} />
              <Text style={styles.tagText} numberOfLines={1}>
                {item.locationName}
                {item.distance !== undefined
                  ? ` · ${formatDistanceKm(item.distance)}`
                  : ''}
              </Text>
            </View>
          )}
        </View>
      </Card>
    </TouchableOpacity>
  ), [navigation, t]);

  const renderSortOptions = () => (
    <View style={styles.sortContainer}>
      <TouchableOpacity
        style={[styles.sortChip, sortBy === 'newest' && styles.sortChipActive]}
        onPress={() => handleSortChange('newest')}
      >
        <Ionicons name="time-outline" size={14} color={sortBy === 'newest' ? Colors.card : Colors.textSecondary} style={styles.sortChipIcon} />
        <Text style={[styles.sortChipText, sortBy === 'newest' && styles.sortChipTextActive]}>
          {t('rooms.latest')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.sortChip, sortBy === 'nearest' && styles.sortChipActive]}
        onPress={() => handleSortChange('nearest')}
        disabled={locationLoading}
      >
        {locationLoading && sortBy === 'nearest' ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : (
          <>
            <Ionicons name="location-outline" size={14} color={sortBy === 'nearest' ? Colors.card : Colors.textSecondary} style={styles.sortChipIcon} />
            <Text style={[styles.sortChipText, sortBy === 'nearest' && styles.sortChipTextActive]}>
              {t('rooms.nearest')}
            </Text>
          </>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.sortChip, sortBy === 'farthest' && styles.sortChipActive]}
        onPress={() => handleSortChange('farthest')}
        disabled={locationLoading}
      >
        {locationLoading && sortBy === 'farthest' ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : (
          <>
            <Ionicons name="globe-outline" size={14} color={sortBy === 'farthest' ? Colors.card : Colors.textSecondary} style={styles.sortChipIcon} />
            <Text style={[styles.sortChipText, sortBy === 'farthest' && styles.sortChipTextActive]}>
              {t('rooms.farthest')}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderCategoryFilter = () => (
    <View style={styles.filterWrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesContainer}
      >
        <TouchableOpacity
          style={[styles.categoryChip, !selectedCategory && styles.categoryChipActive]}
          onPress={() => setSelectedCategory(null)}
        >
          <Text style={[styles.categoryChipText, !selectedCategory && styles.categoryChipTextActive]}>
            {t('rooms.all')}
          </Text>
          <View style={[styles.countBadge, !selectedCategory && styles.countBadgeActive]}>
            <Text style={[styles.countText, !selectedCategory && styles.countTextActive]}>
              {categoryCounts.total || 0}
            </Text>
          </View>
        </TouchableOpacity>
        {ROOM_CATEGORIES.map((cat) => {
          const count = categoryCounts[cat.id] || 0;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryChip, selectedCategory === cat.id && styles.categoryChipActive]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
              <Text style={[styles.categoryChipText, selectedCategory === cat.id && styles.categoryChipTextActive]}>
                {t(getRoomCategoryTranslationKey(cat.id))}
              </Text>
              {count > 0 && (
                <View style={[styles.countBadge, selectedCategory === cat.id && styles.countBadgeActive]}>
                  <Text style={[styles.countText, selectedCategory === cat.id && styles.countTextActive]}>
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('rooms.title')}</Text>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => {
            setDraftVisibility(visibilityFilter);
            setDraftMaxDistance(maxDistance);
            setFilterVisible(true);
          }}
          accessibilityLabel={t('rooms.filter')}
        >
          <Ionicons name="options-outline" size={24} color={Colors.text} />
          {(visibilityFilter !== 'ALL' || maxDistance !== null) && <View style={styles.filterActiveDot} />}
        </TouchableOpacity>
      </View>

      {renderCategoryFilter()}
      {renderSortOptions()}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : sortedRooms.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="home-outline" size={64} color={Colors.textLight} style={styles.emptyIcon} />
          <Text style={styles.emptyText}>{t('rooms.empty')}</Text>
          <Text style={styles.emptySubtext}>{t('rooms.emptyHint')}</Text>
        </View>
      ) : (
        <FlatList
          data={sortedRooms}
          renderItem={renderRoomCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContainer, { paddingBottom: bottomPadding }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
          }
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          initialNumToRender={10}
          windowSize={5}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateRoom')}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={32} color={Colors.card} />
      </TouchableOpacity>

      <Modal visible={filterVisible} transparent animationType="slide" onRequestClose={() => setFilterVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setFilterVisible(false)} />
          <View style={[styles.filterSheet, { paddingBottom: insets.bottom + Spacing.lg }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t('rooms.filter')}</Text>
            <Text style={styles.sheetLabel}>{t('rooms.visibilityFilter')}</Text>
            <View style={styles.optionRow}>
              {(['ALL', 'PUBLIC', 'PRIVATE'] as VisibilityFilter[]).map(value => (
                <TouchableOpacity
                  key={value}
                  style={[styles.optionChip, draftVisibility === value && styles.optionChipActive]}
                  onPress={() => setDraftVisibility(value)}
                >
                  <Ionicons
                    name={value === 'ALL' ? 'apps' : value === 'PUBLIC' ? 'earth' : 'lock-closed'}
                    size={16}
                    color={draftVisibility === value ? Colors.primary : Colors.textSecondary}
                  />
                  <Text style={[styles.optionText, draftVisibility === value && styles.optionTextActive]}>
                    {t(value === 'ALL' ? 'rooms.allRooms' : value === 'PUBLIC' ? 'rooms.publicRooms' : 'rooms.privateRooms')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.sheetLabel}>{t('rooms.distanceFilter')}</Text>
            <View style={styles.optionRow}>
              {[1, 5, 10, 25, 50, null].map(value => (
                <TouchableOpacity
                  key={value ?? 'any'}
                  style={[styles.distanceOption, draftMaxDistance === value && styles.optionChipActive]}
                  onPress={() => setDraftMaxDistance(value)}
                >
                  <Text style={[styles.optionText, draftMaxDistance === value && styles.optionTextActive]}>
                    {value === null ? t('rooms.anyDistance') : `${value}km`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.applyButton} onPress={applyFilters}>
              <Text style={styles.applyButtonText}>{t('rooms.applyFilter')}</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.bold,
    color: Colors.text,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
    ...Shadows.small,
  },
  filterActiveDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  filterWrapper: {
    backgroundColor: Colors.background,
  },
  sortContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: 8,
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  sortChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  sortChipIcon: {
  },
  sortChipText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: FontWeights.bold,
  },
  sortChipTextActive: {
    color: Colors.card,
  },
  categoriesContainer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.round,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  categoryChipText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: FontWeights.bold,
  },
  categoryChipTextActive: {
    color: Colors.card,
  },
  countBadge: {
    marginLeft: 6,
    backgroundColor: Colors.secondary,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  countBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  countText: {
    fontSize: 10,
    fontWeight: FontWeights.bold,
    color: Colors.primary,
  },
  countTextActive: {
    color: Colors.card,
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
  emptyIcon: {
    marginBottom: Spacing.md,
  },
  emptyText: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  emptySubtext: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  listContainer: {
    padding: Spacing.md,
    paddingTop: Spacing.xs,
  },
  roomCard: {
    marginBottom: Spacing.sm,
    padding: Spacing.lg,
  },
  roomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  emojiContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  roomEmoji: {
    fontSize: 24,
  },
  roomInfo: {
    flex: 1,
  },
  roomTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: Colors.text,
    marginBottom: 2,
  },
  roomCreator: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeights.medium,
  },
  headerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
    gap: 4,
  },
  distanceIcon: {
  },
  distanceText: {
    fontSize: 11,
    fontWeight: FontWeights.bold,
    color: Colors.accent,
  },
  participantsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.secondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
    gap: 4,
  },
  participantsIcon: {
  },
  participantsText: {
    fontSize: 11,
    fontWeight: FontWeights.bold,
    color: Colors.primary,
  },
  roomDescription: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  roomFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.round,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  locationTag: {
    maxWidth: '60%',
  },
  privateTag: {
    backgroundColor: '#FFF0F0',
    borderColor: '#FFD7D7',
  },
  privateTagText: {
    color: Colors.accent,
  },
  tagIcon: {
  },
  tagText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: FontWeights.bold,
  },
  fab: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: Spacing.xl,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.large,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  filterSheet: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: Colors.card,
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
    backgroundColor: Colors.border,
  },
  sheetTitle: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  sheetLabel: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.bold,
    color: Colors.text,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.round,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  optionChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.secondary,
  },
  distanceOption: {
    minWidth: 70,
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.round,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  optionText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.bold,
    color: Colors.textSecondary,
  },
  optionTextActive: {
    color: Colors.primary,
  },
  applyButton: {
    marginTop: Spacing.xl,
    minHeight: 54,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  applyButtonText: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
    color: Colors.card,
  },
});
