import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, FlatList, Image, RefreshControl, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { apiService } from '../services/api';
import { Friendship } from '../types';
import { Colors, Spacing, TAB_BAR_HEIGHT } from '../constants/theme';
import { ProfilePopup } from '../components/ProfilePopup';
import { useLanguage } from '../context/LanguageContext';
import { useNotification } from '../context/NotificationContext';

type Section = 'friends' | 'requests';

const FRIEND_AVATAR_COLORS = [
  Colors.primary,
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
];

const getDefaultFriendEmoji = (nickname: string) => {
  const emojiMap: Record<string, string> = {
    a: '😀', b: '😎', c: '🥳', d: '😊', e: '🤗', f: '😇',
    g: '🤔', h: '🧐', i: '👨', j: '👩', k: '🐱', l: '🐶',
    m: '🦊', n: '🐼', o: '🐨', p: '🦁', q: '🐯', r: '🐻',
    s: '⭐', t: '🌟', u: '💫', v: '✨', w: '🔥', x: '💎',
    y: '🎯', z: '🎨',
  };
  return emojiMap[nickname.charAt(0).toLowerCase()]
    || nickname.charAt(0).toUpperCase()
    || '?';
};

const getDefaultFriendColor = (nickname: string) => (
  FRIEND_AVATAR_COLORS[nickname.charCodeAt(0) % FRIEND_AVATAR_COLORS.length]
  || Colors.primary
);

export function FriendsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useApp();
  const { t } = useLanguage();
  const { realtimeEvent } = useNotification();
  const insets = useSafeAreaInsets();
  const [section, setSection] = useState<Section>(route.params?.initialSection === 'requests' ? 'requests' : 'friends');
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [requests, setRequests] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedProfileNickname, setSelectedProfileNickname] = useState<string | null>(null);

  useEffect(() => {
    if (route.params?.initialSection === 'friends' || route.params?.initialSection === 'requests') {
      setSection(route.params.initialSection);
    }
  }, [route.params?.initialSection]);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [friendData, requestData] = await Promise.all([
        apiService.getFriends(user.id),
        apiService.getFriendRequests(user.id),
      ]);
      setFriends(friendData);
      setRequests(requestData);
    } catch (error) {
      console.error('Failed to load friends:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
  }, [load]));

  useEffect(() => {
    if (realtimeEvent?.type === 'FRIENDS') {
      void load();
    }
  }, [realtimeEvent, load]);

  const respond = async (friendship: Friendship, accept: boolean) => {
    if (!user) return;
    setRequests((current) => current.filter((item) => item.id !== friendship.id));
    if (accept) {
      setFriends((current) => (
        current.some((item) => item.id === friendship.id)
          ? current
          : [...current, { ...friendship, status: 'ACCEPTED' }]
      ));
      setSection('friends');
    }
    try {
      await apiService.respondFriendRequest(friendship.id, user.id, accept);
      await load();
    } catch {
      await load();
      Alert.alert('처리 실패', '친구 요청을 처리하지 못했습니다.');
    }
  };

  const renderAvatar = (
    nickname: string,
    uri?: string | null,
    emoji?: string | null,
    color?: string | null,
  ) => (
    <View style={styles.avatarWrap}>
      {uri ? <Image source={{ uri }} style={styles.avatar} /> : (
        <View
          style={[
            styles.avatar,
            styles.avatarFallback,
            { backgroundColor: color || getDefaultFriendColor(nickname) },
          ]}
        >
          <Text style={styles.avatarEmoji}>
            {emoji || getDefaultFriendEmoji(nickname)}
          </Text>
        </View>
      )}
    </View>
  );

  const data = useMemo(() => {
    const source = section === 'friends' ? friends : requests;
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return source;
    return source.filter((item) => item.nickname.toLocaleLowerCase().includes(normalizedQuery));
  }, [friends, query, requests, section]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={25} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('friends.myFriends')}</Text>
        </View>
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={19} color={Colors.textLight} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('friends.searchPlaceholder')}
          placeholderTextColor={Colors.textLight}
          returnKeyType="search"
          style={styles.searchInput}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} accessibilityRole="button">
            <Ionicons name="close-circle" size={20} color={Colors.textLight} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, section === 'friends' && styles.tabActive]} onPress={() => setSection('friends')}>
          <Text style={[styles.tabText, section === 'friends' && styles.tabTextActive]}>{t('friends.myFriends')} {friends.length}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, section === 'requests' && styles.tabActive]} onPress={() => setSection('requests')}>
          <Text style={[styles.tabText, section === 'requests' && styles.tabTextActive]}>
            {t('friends.requests')} {requests.length}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + Spacing.lg }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={Colors.primary} />}
        ListEmptyComponent={!loading ? (
          <View style={styles.empty}>
            <Ionicons name={section === 'friends' ? 'people-outline' : 'mail-open-outline'} size={45} color="#C8C4D8" />
            <Text style={styles.emptyTitle}>{section === 'friends' ? t('friends.noFriends') : t('friends.noRequests')}</Text>
            <Text style={styles.emptyText}>{t('friends.emptyHint')}</Text>
          </View>
        ) : null}
        renderItem={({ item }) => (
          <View style={styles.friendCard}>
            <TouchableOpacity
              style={styles.friendProfileArea}
              activeOpacity={0.72}
              onPress={() => setSelectedProfileNickname(item.nickname)}
              accessibilityRole="button"
              accessibilityLabel={`${item.nickname} 프로필 보기`}
            >
              {renderAvatar(
                item.nickname,
                item.profilePictureUrl,
                item.avatarEmoji,
                item.avatarColor,
              )}
              <View style={styles.friendInfo}>
                <Text style={styles.friendName}>{item.nickname}</Text>
                {section === 'friends' ? (
                  <View style={styles.presenceRow}>
                    <View style={[styles.presenceDot, item.online ? styles.online : styles.offline]} />
                    <Text style={[styles.presenceText, item.online && styles.onlineText]}>
                      {item.online ? t('friends.online') : t('friends.offline')}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.requestState}>{item.direction === 'INCOMING' ? t('friends.incoming') : t('friends.outgoing')}</Text>
                )}
              </View>
            </TouchableOpacity>
            {section === 'friends' ? (
              <TouchableOpacity
                style={styles.messageButton}
                onPress={() => navigation.navigate('DirectMessage', { friend: item })}
              >
                <Ionicons name="chatbubble-ellipses" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            ) : item.direction === 'INCOMING' ? (
              <View style={styles.requestActions}>
                <TouchableOpacity style={styles.rejectButton} onPress={() => respond(item, false)}>
                  <Ionicons name="close" size={20} color={Colors.textLight} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.acceptButton} onPress={() => respond(item, true)}>
                  <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ) : <Ionicons name="time-outline" size={22} color={Colors.textLight} />}
          </View>
        )}
      />
      <ProfilePopup
        visible={selectedProfileNickname !== null}
        nickname={selectedProfileNickname}
        onClose={() => setSelectedProfileNickname(null)}
        onFriendshipChanged={load}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 24, paddingTop: 18, paddingBottom: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center' },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  title: { color: Colors.text, fontSize: 30, fontWeight: '800' },
  searchRow: { marginHorizontal: 24, height: 50, borderRadius: 16, backgroundColor: '#FFFFFF', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text },
  discoverButton: { marginHorizontal: 24, marginTop: 12, borderRadius: 18, backgroundColor: '#F0EBFF', minHeight: 72, padding: 13, flexDirection: 'row', alignItems: 'center' },
  discoverIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  discoverCopy: { flex: 1, marginHorizontal: 12 },
  discoverTitle: { color: Colors.text, fontSize: 15, fontWeight: '800' },
  discoverSubtitle: { color: Colors.textLight, fontSize: 11, lineHeight: 16, marginTop: 3 },
  tabs: { marginHorizontal: 24, marginTop: 18, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E9E6F0' },
  tab: { flex: 1, alignItems: 'center', paddingHorizontal: 2, paddingBottom: 12 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  tabText: { fontSize: 13, color: Colors.textLight, fontWeight: '600', textAlign: 'center' },
  tabTextActive: { color: Colors.primary, fontWeight: '800' },
  list: { paddingHorizontal: 24, paddingTop: 12, gap: 10, flexGrow: 1 },
  friendCard: { minHeight: 82, padding: 14, borderRadius: 20, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center' },
  friendProfileArea: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  avatarWrap: { position: 'relative' },
  avatar: { width: 50, height: 50, borderRadius: 17 },
  avatarFallback: { backgroundColor: '#F0EBFF', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: Colors.primary, fontSize: 20, fontWeight: '800' },
  avatarEmoji: { color: '#FFFFFF', fontSize: 25, fontWeight: '400' },
  friendInfo: { flex: 1, marginLeft: 13 },
  friendName: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  presenceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  presenceDot: { width: 8, height: 8, borderRadius: 4 },
  online: { backgroundColor: '#19C48A' },
  offline: { backgroundColor: '#B8B5C2' },
  presenceText: { color: Colors.textLight, fontSize: 12 },
  onlineText: { color: '#0E9F6E', fontWeight: '600' },
  requestState: { color: Colors.textLight, fontSize: 12, marginTop: 5 },
  messageButton: { width: 44, height: 44, borderRadius: 15, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  requestActions: { flexDirection: 'row', gap: 8 },
  rejectButton: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#F1EFF4', alignItems: 'center', justifyContent: 'center' },
  acceptButton: { width: 38, height: 38, borderRadius: 13, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, minHeight: 300, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: Colors.text, fontSize: 17, fontWeight: '700', marginTop: 14 },
  emptyText: { color: Colors.textLight, fontSize: 13, marginTop: 6 },
});
