import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  PanResponder,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  View,
  ViewToken,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import { apiService } from '../services/api';
import { adService } from '../services/adService';
import { DiscoverUser, Friendship } from '../types';
import { Colors, Spacing, getSafeBottomPadding } from '../constants/theme';
import { ProfilePopup } from '../components/ProfilePopup';

type Relationship = 'FRIEND' | 'REQUESTED' | 'AVAILABLE';
type CountryFilter = 'ALL' | 'KR' | 'JP' | 'OTHER';
type GenderFilter = 'ALL' | 'MALE' | 'FEMALE';
const DISCOVERY_PAGE_SIZE = 40;
const MIN_FILTER_AGE = 18;
const MAX_FILTER_AGE = 100;
const FILTER_STORAGE_PREFIX = '@plantalk/discover-filters';

type StoredDiscoveryFilters = {
  onlineOnly: boolean;
  country: CountryFilter;
  gender: GenderFilter;
  minAge: number;
  maxAge: number;
};

function AgeRangeSlider({
  min,
  max,
  onChange,
}: {
  min: number;
  max: number;
  onChange: (min: number, max: number) => void;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const minRef = useRef(min);
  const maxRef = useRef(max);
  const onChangeRef = useRef(onChange);
  const dragStartRef = useRef(min);
  const ageSpan = MAX_FILTER_AGE - MIN_FILTER_AGE;

  useEffect(() => {
    minRef.current = min;
    maxRef.current = max;
    onChangeRef.current = onChange;
  }, [max, min, onChange]);

  const ageFromDrag = useCallback((startAge: number, distance: number) => {
    if (trackWidth <= 0) return startAge;
    return Math.round(startAge + (distance / trackWidth) * ageSpan);
  }, [ageSpan, trackWidth]);

  const minResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      dragStartRef.current = minRef.current;
    },
    onPanResponderMove: (_, gesture) => {
      const next = Math.max(
        MIN_FILTER_AGE,
        Math.min(maxRef.current, ageFromDrag(dragStartRef.current, gesture.dx)),
      );
      minRef.current = next;
      onChangeRef.current(next, maxRef.current);
    },
  }), [ageFromDrag]);

  const maxResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      dragStartRef.current = maxRef.current;
    },
    onPanResponderMove: (_, gesture) => {
      const next = Math.min(
        MAX_FILTER_AGE,
        Math.max(minRef.current, ageFromDrag(dragStartRef.current, gesture.dx)),
      );
      maxRef.current = next;
      onChangeRef.current(minRef.current, next);
    },
  }), [ageFromDrag]);

  const minPercent = ((min - MIN_FILTER_AGE) / ageSpan) * 100;
  const maxPercent = ((max - MIN_FILTER_AGE) / ageSpan) * 100;

  return (
    <View
      style={styles.ageSlider}
      onLayout={event => setTrackWidth(event.nativeEvent.layout.width)}
    >
      <View style={styles.ageSliderTrack} />
      <View
        style={[
          styles.ageSliderSelected,
          { left: `${minPercent}%`, width: `${maxPercent - minPercent}%` },
        ]}
      />
      <View
        accessibilityRole="adjustable"
        accessibilityLabel="Minimum age"
        accessibilityValue={{ min: MIN_FILTER_AGE, max, now: min }}
        style={[styles.ageSliderThumbHitArea, { left: `${minPercent}%` }]}
        {...minResponder.panHandlers}
      >
        <View style={styles.ageSliderThumb} />
      </View>
      <View
        accessibilityRole="adjustable"
        accessibilityLabel="Maximum age"
        accessibilityValue={{ min, max: MAX_FILTER_AGE, now: max }}
        style={[styles.ageSliderThumbHitArea, { left: `${maxPercent}%` }]}
        {...maxResponder.panHandlers}
      >
        <View style={styles.ageSliderThumb} />
      </View>
    </View>
  );
}

const COUNTRY_OPTIONS: { code: CountryFilter; flag: string }[] = [
  { code: 'ALL', flag: '🌐' },
  { code: 'KR', flag: '🇰🇷' },
  { code: 'JP', flag: '🇯🇵' },
  { code: 'OTHER', flag: '🌍' },
];

export function DiscoverFriendsScreen({ embedded = false }: { embedded?: boolean }) {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { user } = useApp();
  const { t } = useLanguage();
  const listRef = useRef<FlatList<DiscoverUser>>(null);
  const loadingMoreRef = useRef(false);
  const lastViewedPersonIdRef = useRef<string | null>(null);
  const skipNextSlideCountRef = useRef(true);
  const [people, setPeople] = useState<DiscoverUser[]>([]);
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [requests, setRequests] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [discoveryPage, setDiscoveryPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [selectedNickname, setSelectedNickname] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [filterVisible, setFilterVisible] = useState(false);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [country, setCountry] = useState<CountryFilter>('ALL');
  const [gender, setGender] = useState<GenderFilter>('ALL');
  const [minAge, setMinAge] = useState(MIN_FILTER_AGE);
  const [maxAge, setMaxAge] = useState(MAX_FILTER_AGE);
  const [filtersHydrated, setFiltersHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    setFiltersHydrated(false);
    setOnlineOnly(false);
    setCountry('ALL');
    setGender('ALL');
    setMinAge(MIN_FILTER_AGE);
    setMaxAge(MAX_FILTER_AGE);

    if (!user?.id) return () => { active = false; };

    const restoreFilters = async () => {
      try {
        const saved = await AsyncStorage.getItem(`${FILTER_STORAGE_PREFIX}:${user.id}`);
        if (!saved || !active) return;

        const parsed = JSON.parse(saved) as Partial<StoredDiscoveryFilters>;
        const restoredCountry = COUNTRY_OPTIONS.some(option => option.code === parsed.country)
          ? parsed.country as CountryFilter
          : 'ALL';
        const restoredGender = ['ALL', 'MALE', 'FEMALE'].includes(parsed.gender || '')
          ? parsed.gender as GenderFilter
          : 'ALL';
        const restoredMinAge = Math.max(MIN_FILTER_AGE, Math.min(MAX_FILTER_AGE, Number(parsed.minAge) || MIN_FILTER_AGE));
        const restoredMaxAge = Math.max(restoredMinAge, Math.min(MAX_FILTER_AGE, Number(parsed.maxAge) || MAX_FILTER_AGE));

        setOnlineOnly(parsed.onlineOnly === true);
        setCountry(restoredCountry);
        setGender(restoredGender);
        setMinAge(restoredMinAge);
        setMaxAge(restoredMaxAge);
      } catch (error) {
        console.warn('Failed to restore discovery filters:', error);
      } finally {
        if (active) setFiltersHydrated(true);
      }
    };

    void restoreFilters();
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !filtersHydrated) return;
    const filters: StoredDiscoveryFilters = { onlineOnly, country, gender, minAge, maxAge };
    void AsyncStorage.setItem(
      `${FILTER_STORAGE_PREFIX}:${user.id}`,
      JSON.stringify(filters),
    ).catch(error => console.warn('Failed to save discovery filters:', error));
  }, [country, filtersHydrated, gender, maxAge, minAge, onlineOnly, user?.id]);

  const discoveryFilters = useMemo(() => ({
    onlineOnly,
    country: country === 'ALL' ? undefined : country,
    gender: gender === 'ALL' ? undefined : gender,
    minAge: minAge === MIN_FILTER_AGE ? undefined : minAge,
    maxAge: maxAge === MAX_FILTER_AGE ? undefined : maxAge,
  }), [country, gender, maxAge, minAge, onlineOnly]);

  const cardWidth = width - 32;
  const cardHeight = embedded
    ? Math.max(500, Math.min(680, height - insets.top - insets.bottom - 155))
    : Math.max(500, Math.min(700, height - insets.top - insets.bottom - 170));

  const load = useCallback(async (refresh = false) => {
    if (!user || !filtersHydrated) return;
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [discovered, friendData, requestData] = await Promise.all([
        apiService.discoverUsers(user.id, 0, DISCOVERY_PAGE_SIZE, discoveryFilters),
        apiService.getFriends(user.id),
        apiService.getFriendRequests(user.id),
      ]);
      setPeople(discovered);
      setDiscoveryPage(0);
      setHasMore(discovered.length === DISCOVERY_PAGE_SIZE);
      setFriends(friendData);
      setRequests(requestData);
    } catch (error) {
      console.error('Failed to discover users:', error);
      Alert.alert(
        t('friends.discover'),
        '새 친구 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [discoveryFilters, filtersHydrated, t, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = useCallback(async (): Promise<DiscoverUser[]> => {
    if (!user || loadingMoreRef.current || loading || !hasMore) return [];

    loadingMoreRef.current = true;
    setLoadingMore(true);
    const nextPage = discoveryPage + 1;
    try {
      const discovered = await apiService.discoverUsers(user.id, nextPage, DISCOVERY_PAGE_SIZE, discoveryFilters);
      setPeople(current => {
        const knownIds = new Set(current.map(person => person.id));
        return [...current, ...discovered.filter(person => !knownIds.has(person.id))];
      });
      setDiscoveryPage(nextPage);
      setHasMore(discovered.length === DISCOVERY_PAGE_SIZE);
      return discovered;
    } catch (error) {
      console.error('Failed to load more discovered users:', error);
      return [];
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [discoveryFilters, discoveryPage, hasMore, loading, user]);

  const relationships = useMemo(() => {
    const state = new Map<string, Relationship>();
    friends.forEach((friend) => state.set(friend.friendId, 'FRIEND'));
    requests.forEach((request) => state.set(request.friendId, 'REQUESTED'));
    return state;
  }, [friends, requests]);

  const filteredPeople = people;

  useEffect(() => {
    skipNextSlideCountRef.current = true;
    lastViewedPersonIdRef.current = null;
    setCurrentIndex(0);
    requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: false }));
  }, [country, gender, maxAge, minAge, onlineOnly]);

  useEffect(() => {
    const personId = filteredPeople[currentIndex]?.id;
    if (!personId) return;

    if (skipNextSlideCountRef.current || lastViewedPersonIdRef.current === null) {
      skipNextSlideCountRef.current = false;
      lastViewedPersonIdRef.current = personId;
      return;
    }

    if (lastViewedPersonIdRef.current === personId) return;
    lastViewedPersonIdRef.current = personId;
    void adService.onDiscoverySlide(user?.id);
  }, [currentIndex, filteredPeople, user?.id]);

  const relationshipFor = (personId: string): Relationship => (
    relationships.get(personId) || 'AVAILABLE'
  );

  const friendshipFor = (personId: string) => (
    friends.find(friend => friend.friendId === personId) || null
  );

  const requestFor = (personId: string) => (
    requests.find(request => request.friendId === personId) || null
  );

  const sendRequest = async (person: DiscoverUser) => {
    if (!user || requestingId || relationshipFor(person.id) !== 'AVAILABLE') return;
    setRequestingId(person.id);
    try {
      const saved = await apiService.requestFriend(user.id, person.id);
      setRequests((current) => [...current, saved]);
    } catch (error) {
      const message = error instanceof Error
        ? error.message.replace(/^API Error: \d+ - /, '')
        : '';
      if (/이미 친구 요청|이미 친구|already.*(?:request|friend)/i.test(message)) {
        await load(true);
        return;
      }
      Alert.alert(
        t('friends.request'),
        message || t('friends.discoverEmpty'),
      );
    } finally {
      setRequestingId(null);
    }
  };

  const confirmRemoveFriend = (person: DiscoverUser) => {
    if (!user || requestingId) return;
    const friendship = friendshipFor(person.id);
    if (!friendship) return;

    Alert.alert(
      t('friends.removeConfirmTitle'),
      t('friends.removeConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('friends.removeFriend'),
          style: 'destructive',
          onPress: async () => {
            setRequestingId(person.id);
            try {
              await apiService.removeFriend(friendship.id, user.id);
              setFriends(current => current.filter(item => item.id !== friendship.id));
            } catch (error) {
              Alert.alert(
                t('friends.removeFailed'),
                error instanceof Error
                  ? error.message.replace(/^API Error: \d+ - /, '')
                  : t('friends.removeFailedMessage'),
              );
            } finally {
              setRequestingId(null);
            }
          },
        },
      ],
    );
  };

  const confirmCancelRequest = (person: DiscoverUser) => {
    if (!user || requestingId) return;
    const request = requestFor(person.id);
    if (!request || request.direction !== 'OUTGOING') return;

    Alert.alert(
      t('friends.cancelRequestConfirmTitle'),
      t('friends.cancelRequestConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('friends.cancelRequest'),
          style: 'destructive',
          onPress: async () => {
            setRequestingId(person.id);
            try {
              await apiService.removeFriend(request.id, user.id);
              setRequests(current => current.filter(item => item.id !== request.id));
            } catch (error) {
              Alert.alert(
                t('friends.cancelRequestFailed'),
                error instanceof Error
                  ? error.message.replace(/^API Error: \d+ - /, '')
                  : t('friends.removeFailedMessage'),
              );
            } finally {
              setRequestingId(null);
            }
          },
        },
      ],
    );
  };

  const goNext = async (fromIndex = currentIndex) => {
    if (filteredPeople.length === 0) return;
    if (fromIndex >= filteredPeople.length - 1 && hasMore) {
      const loaded = await loadMore();
      const hasMatchingUser = loaded.some(person => (
        (!onlineOnly || person.online)
        && (country === 'ALL' || person.nationality === country)
      ));
      if (hasMatchingUser) {
        requestAnimationFrame(() => {
          listRef.current?.scrollToIndex({ index: fromIndex + 1, animated: true });
          setCurrentIndex(fromIndex + 1);
        });
        return;
      }
    }
    const nextIndex = fromIndex >= filteredPeople.length - 1 ? 0 : fromIndex + 1;
    listRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    setCurrentIndex(nextIndex);
  };

  const onViewableItemsChanged = useRef((info: { viewableItems: ViewToken[] }) => {
    const index = info.viewableItems[0]?.index;
    if (index != null) setCurrentIndex(index);
  }).current;

  const countryLabel = (code: CountryFilter) => (
    code === 'ALL' ? t('friends.all') : t(`nationality.${code}`)
  );

  const renderPerson = ({ item, index }: { item: DiscoverUser; index: number }) => {
    const relationship = relationshipFor(item.id);
    const pendingRequest = requestFor(item.id);
    const friendActionDisabled = requestingId !== null
      || (relationship === 'REQUESTED' && pendingRequest?.direction === 'INCOMING');
    const imageUri = item.coverPhotoUrl || item.profilePictureUrl;
    const showImage = imageUri && !failedImages[item.id];
    const bio = item.bio || '';
    const isFemale = /여성|female|woman|女性|女/.test(bio.toLowerCase());
    const isMale = /남성|male|man|男性|男/.test(bio.toLowerCase());
    const gradientColors: [string, string, string, string] = isFemale
      ? ['rgba(255,93,156,0)', 'rgba(237,75,145,0.24)', 'rgba(163,39,109,0.78)', 'rgba(73,18,55,0.96)']
      : isMale
        ? ['rgba(48,131,255,0)', 'rgba(39,112,224,0.22)', 'rgba(21,69,145,0.78)', 'rgba(10,28,70,0.96)']
        : ['rgba(106,70,255,0)', 'rgba(106,70,255,0.22)', 'rgba(55,34,133,0.78)', 'rgba(25,17,66,0.96)'];

    return (
      <View style={[styles.slide, { width: cardWidth }]}>
        <TouchableOpacity
          style={[styles.card, { height: cardHeight }]}
          activeOpacity={0.96}
          onPress={() => setSelectedNickname(item.nickname)}
        >
          {showImage ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.photo}
              resizeMode="cover"
              onError={() => setFailedImages((current) => ({ ...current, [item.id]: true }))}
            />
          ) : (
            <View style={[styles.photo, styles.photoFallback, { backgroundColor: item.avatarColor || Colors.primary }]}>
              <Text style={styles.fallbackEmoji}>
                {item.avatarEmoji || item.nickname.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          <View style={styles.shade} />
          <LinearGradient
            colors={gradientColors}
            locations={[0, 0.28, 0.65, 1]}
            style={styles.bottomGradient}
            pointerEvents="none"
          />

          <View style={styles.statusActions}>
            <View style={styles.onlineBadge}>
              <View style={[styles.onlineDot, !item.online && styles.offlineDot]} />
              <Text style={styles.onlineLabel}>
                {item.online ? t('friends.online') : t('friends.offline')}
              </Text>
            </View>
            {relationship === 'REQUESTED' && (
              <View style={styles.requestedStatusBadge}>
                <Ionicons name="person-remove-outline" size={14} color="#FFFFFF" />
                <Text style={styles.requestedStatusText}>{t('friends.cancelRequest')}</Text>
              </View>
            )}
            {relationship === 'FRIEND' && (
              <TouchableOpacity
                style={styles.removeFriendButton}
                disabled={requestingId !== null}
                onPress={(event) => {
                  event.stopPropagation();
                  confirmRemoveFriend(item);
                }}
              >
                {requestingId === item.id ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="people" size={14} color="#FFFFFF" />
                    <Text style={styles.removeFriendButtonText}>{t('friends.removeFriend')}</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.countryActions}>
            <View style={styles.countryBadge}>
              <Text style={styles.countryFlag}>
                {item.nationality === 'KR' ? '🇰🇷' : item.nationality === 'JP' ? '🇯🇵' : '🌍'}
              </Text>
            </View>
          </View>

          <View style={styles.cardContent}>
            <Text style={styles.nickname}>{item.nickname}</Text>
            {!!item.bio && <Text style={styles.bio} numberOfLines={2}>{item.bio}</Text>}
          </View>

          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.cardAction}
              onPress={(event) => {
                event.stopPropagation();
                void goNext(index);
              }}
            >
              <View style={[styles.actionCircle, styles.nextCircle]}>
                <Ionicons name="close" size={31} color="#667087" />
              </View>
              <Text style={styles.cardActionLabel}>{t('friends.next')}</Text>
            </TouchableOpacity>

            <Text style={styles.pageCount}>{index + 1} / {filteredPeople.length}</Text>

            <TouchableOpacity
              style={styles.cardAction}
              accessibilityRole="button"
              accessibilityState={{ disabled: friendActionDisabled }}
              onPress={(event) => {
                event.stopPropagation();
                // 비활성 상태에서도 터치는 이 버튼이 소비해야 카드의 프로필 열기로
                // 전달되지 않는다. 실제 친구 요청은 가능한 상태에서만 실행한다.
                if (friendActionDisabled) return;
                if (relationship === 'FRIEND') confirmRemoveFriend(item);
                else if (relationship === 'REQUESTED') confirmCancelRequest(item);
                else void sendRequest(item);
              }}
            >
              <View
                style={[
                  styles.actionCircle,
                  styles.friendCircle,
                  relationship === 'REQUESTED' && styles.cancelRequestCircle,
                  relationship === 'FRIEND' && styles.removeFriendCircle,
                  friendActionDisabled && styles.friendCircleDisabled,
                ]}
              >
                {requestingId === item.id ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Ionicons
                    name="heart"
                    size={29}
                    color={relationship === 'REQUESTED'
                      ? '#E6DCFF'
                      : relationship === 'FRIEND'
                        ? '#FFE8E4'
                        : '#FFFFFF'}
                  />
                )}
              </View>
              <Text style={[styles.cardActionLabel, friendActionDisabled && styles.cardActionLabelDisabled]}>
                {relationship === 'FRIEND'
                  ? t('friends.removeFriend')
                  : relationship === 'REQUESTED'
                    ? t('friends.cancelRequest')
                    : t('friends.sendRequest')}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const filterCount = Number(onlineOnly) + Number(country !== 'ALL') + Number(gender !== 'ALL') + Number(minAge !== 18 || maxAge !== 100);
  const resetFilters = () => { setOnlineOnly(false); setCountry('ALL'); setGender('ALL'); setMinAge(18); setMaxAge(100); };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        {!embedded && (
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={26} color={Colors.text} />
          </TouchableOpacity>
        )}
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{t('friends.discoverEyebrow')}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.filterButton} onPress={() => setFilterVisible(true)}>
            <Ionicons name="options-outline" size={22} color={Colors.text} />
            {filterCount > 0 && (
              <View style={styles.filterCount}><Text style={styles.filterCountText}>{filterCount}</Text></View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : filteredPeople.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={48} color="#C8C4D8" />
          <Text style={styles.emptyText}>{t('friends.discoverEmpty')}</Text>
          <TouchableOpacity style={styles.resetFilter} onPress={resetFilters}>
            <Text style={styles.resetFilterText}>{t('friends.all')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            ref={listRef}
            data={filteredPeople}
            horizontal
            pagingEnabled
            snapToInterval={cardWidth + 12}
            decelerationRate="fast"
            disableIntervalMomentum
            keyExtractor={(item) => item.id}
            renderItem={renderPerson}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={{ itemVisiblePercentThreshold: 70 }}
            onEndReached={() => void loadMore()}
            onEndReachedThreshold={0.6}
            ListFooterComponent={loadingMore ? (
              <View style={[styles.loadingMore, { width: cardWidth }]}>
                <ActivityIndicator size="large" color={Colors.primary} />
              </View>
            ) : null}
            refreshControl={(
              <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={Colors.primary} />
            )}
            getItemLayout={(_, index) => ({
              length: cardWidth + 12,
              offset: (cardWidth + 12) * index,
              index,
            })}
          />
        </>
      )}

      <Modal visible={filterVisible} transparent animationType="slide" onRequestClose={() => setFilterVisible(false)}>
        <KeyboardAvoidingView style={styles.keyboardModal} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setFilterVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.filterSheet, { paddingBottom: getSafeBottomPadding(insets.bottom) }]}> 
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t('friends.filterTitle')}</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.filterSectionTitle}>{t('friends.status')}</Text>
            <View style={styles.filterOptions}>
              {[false, true].map((value) => (
                <TouchableOpacity
                  key={String(value)}
                  style={[styles.filterOption, onlineOnly === value && styles.filterOptionActive]}
                  onPress={() => setOnlineOnly(value)}
                >
                  <Text style={[styles.filterOptionText, onlineOnly === value && styles.filterOptionTextActive]}>
                    {value ? t('friends.onlineOnly') : t('friends.all')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterSectionTitle}>{t('friends.country')}</Text>
            <View style={styles.countryOptions}>
              {COUNTRY_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.code}
                  style={[styles.countryOption, country === option.code && styles.filterOptionActive]}
                  onPress={() => setCountry(option.code)}
                >
                  <Text style={styles.countryOptionFlag}>{option.flag}</Text>
                  <Text style={[styles.countryOptionText, country === option.code && styles.filterOptionTextActive]}>
                    {countryLabel(option.code)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterSectionTitle}>{t('friends.gender')}</Text>
            <View style={styles.filterOptions}>
              {(['ALL', 'MALE', 'FEMALE'] as const).map(value => (
                <TouchableOpacity
                  key={value}
                  style={[styles.filterOption, gender === value && styles.filterOptionActive]}
                  onPress={() => setGender(value)}
                >
                  <Text style={[styles.filterOptionText, gender === value && styles.filterOptionTextActive]}>
                    {t(value === 'ALL' ? 'friends.all' : value === 'MALE' ? 'friends.male' : 'friends.female')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterSectionTitle}>{t('friends.ageRange')}</Text>
            <View style={styles.ageInputs}>
              <View style={styles.ageBox}>
                <Text style={styles.ageBoxLabel}>{t('friends.minAge')}</Text>
                <TextInput style={styles.ageBoxInput} value={String(minAge)} keyboardType="number-pad" maxLength={3}
                  onChangeText={value => setMinAge(Math.min(maxAge, Math.max(18, Number(value.replace(/\D/g, '')) || 18)))} />
              </View>
              <AgeRangeSlider
                min={minAge}
                max={maxAge}
                onChange={(nextMin, nextMax) => {
                  setMinAge(nextMin);
                  setMaxAge(nextMax);
                }}
              />
              <View style={styles.ageBox}>
                <Text style={styles.ageBoxLabel}>{t('friends.maxAge')}</Text>
                <TextInput style={styles.ageBoxInput} value={String(maxAge)} keyboardType="number-pad" maxLength={3}
                  onChangeText={value => setMaxAge(Math.max(minAge, Math.min(100, Number(value.replace(/\D/g, '')) || 100)))} />
              </View>
            </View>
            <TouchableOpacity style={styles.applyButton} onPress={() => setFilterVisible(false)}>
              <Text style={styles.applyButtonText}>{t('friends.applyFilter')}</Text>
            </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      <ProfilePopup
        visible={selectedNickname !== null}
        nickname={selectedNickname}
        onClose={() => setSelectedNickname(null)}
        onFriendshipChanged={() => void load(true)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  keyboardModal: { flex: 1 },
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 16, paddingTop: 6, flexDirection: 'row', alignItems: 'center' },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  headerCopy: { flex: 1 },
  title: { color: Colors.text, fontSize: 29, fontWeight: '900' },
  filterButton: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterCount: { position: 'absolute', top: -2, right: -2, width: 19, height: 19, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  filterCountText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingMore: { alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 16 },
  slide: { justifyContent: 'center' },
  card: { width: '100%', borderRadius: 30, overflow: 'hidden', backgroundColor: '#E8E3F4', position: 'relative' },
  photo: { width: '100%', height: '100%' },
  photoFallback: { alignItems: 'center', justifyContent: 'center' },
  fallbackEmoji: { fontSize: 104, color: '#FFFFFF', fontWeight: '800' },
  shade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(13, 8, 31, 0.07)' },
  bottomGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' },
  statusActions: { position: 'absolute', top: 18, left: 18, right: 68, zIndex: 3, flexDirection: 'row', alignItems: 'center', gap: 7 },
  onlineBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(20, 16, 33, 0.58)', paddingHorizontal: 11, height: 30, borderRadius: 15 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#18D59B', marginRight: 6 },
  offlineDot: { backgroundColor: '#B7B4C0' },
  onlineLabel: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  countryActions: { position: 'absolute', top: 18, right: 18, flexDirection: 'row-reverse', alignItems: 'center', gap: 7 },
  countryBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(20, 16, 33, 0.58)', alignItems: 'center', justifyContent: 'center' },
  countryFlag: { fontSize: 19 },
  requestedStatusBadge: { height: 30, paddingHorizontal: 10, borderRadius: 15, backgroundColor: 'rgba(106, 70, 255, 0.88)', flexDirection: 'row', alignItems: 'center', gap: 4 },
  requestedStatusText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  removeFriendButton: { minWidth: 68, height: 30, paddingHorizontal: 10, borderRadius: 15, backgroundColor: 'rgba(232, 93, 85, 0.94)', borderWidth: 1, borderColor: 'rgba(255, 215, 211, 0.9)', flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center' },
  removeFriendButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  cardContent: { position: 'absolute', left: 23, right: 23, bottom: 118 },
  nickname: { color: '#FFFFFF', fontSize: 31, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.28)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  bio: { color: 'rgba(255,255,255,0.92)', fontSize: 14, lineHeight: 20, marginTop: 6, paddingRight: 4 },
  cardActions: { position: 'absolute', left: 30, right: 30, bottom: 17, height: 86, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  cardAction: { width: 92, alignItems: 'center' },
  actionCircle: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', shadowColor: '#080717', shadowOpacity: 0.28, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  nextCircle: { backgroundColor: 'rgba(255,255,255,0.94)' },
  friendCircle: { backgroundColor: '#168AF4' },
  cancelRequestCircle: {
    backgroundColor: '#6C4DFF',
    shadowColor: '#3C238F',
  },
  removeFriendCircle: {
    backgroundColor: '#E85D55',
    shadowColor: '#8E2924',
  },
  friendCircleDisabled: {
    backgroundColor: '#AEB4BF',
    shadowColor: '#555D69',
    shadowOpacity: 0.12,
    elevation: 2,
  },
  cardActionLabel: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', marginTop: 5, textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  cardActionLabelDisabled: { color: '#C8CDD5', textShadowColor: 'rgba(0,0,0,0.18)' },
  pageCount: { color: 'rgba(255,255,255,0.82)', fontSize: 12, fontWeight: '800', marginTop: 21 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: Colors.textLight, fontSize: 14, marginTop: 12 },
  resetFilter: { marginTop: 18, paddingHorizontal: 18, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  resetFilterText: { color: Colors.primary, fontSize: 13, fontWeight: '800' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(11, 9, 22, 0.48)', justifyContent: 'flex-end' },
  filterSheet: { maxHeight: '92%', backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 22, paddingTop: 10 },
  sheetHandle: { width: 42, height: 5, borderRadius: 3, backgroundColor: '#D7D4DE', alignSelf: 'center', marginBottom: 17 },
  sheetTitle: { color: Colors.text, fontSize: 23, fontWeight: '900', marginBottom: 22 },
  filterSectionTitle: { color: Colors.text, fontSize: 14, fontWeight: '800', marginBottom: 10 },
  filterOptions: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  filterOption: { paddingHorizontal: 20, height: 42, borderRadius: 21, backgroundColor: '#F2F0F6', alignItems: 'center', justifyContent: 'center' },
  filterOptionActive: { backgroundColor: '#EEE9FF', borderWidth: 1.5, borderColor: Colors.primary },
  filterOptionText: { color: Colors.textLight, fontSize: 13, fontWeight: '700' },
  filterOptionTextActive: { color: Colors.primary },
  countryOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  countryOption: { minWidth: '46%', flexGrow: 1, height: 52, paddingHorizontal: 14, borderRadius: 16, backgroundColor: '#F6F5F8', flexDirection: 'row', alignItems: 'center' },
  countryOptionFlag: { fontSize: 20, marginRight: 9 },
  countryOptionText: { color: Colors.textLight, fontSize: 13, fontWeight: '700' },
  ageInputs: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 },
  ageBox: { width: 82, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14, backgroundColor: '#F6F5F8', borderWidth: 1, borderColor: Colors.border },
  ageBoxLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '700' },
  ageBoxInput: { color: Colors.text, fontSize: 17, fontWeight: '900', padding: 0, marginTop: 2 },
  ageSlider: { flex: 1, height: 42, justifyContent: 'center', position: 'relative' },
  ageSliderTrack: { position: 'absolute', left: 0, right: 0, height: 6, borderRadius: 3, backgroundColor: '#E8E4F1' },
  ageSliderSelected: { position: 'absolute', height: 6, borderRadius: 3, backgroundColor: Colors.primary },
  ageSliderThumbHitArea: { position: 'absolute', width: 42, height: 42, marginLeft: -21, alignItems: 'center', justifyContent: 'center' },
  ageSliderThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 4, borderColor: Colors.primary, shadowColor: Colors.primary, shadowOpacity: 0.24, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  applyButton: { height: 54, borderRadius: 18, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  applyButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
});
