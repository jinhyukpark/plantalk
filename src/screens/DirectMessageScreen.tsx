import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Dimensions, FlatList, Image, Keyboard, KeyboardAvoidingView, Platform, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { apiService, API_BASE_URL } from '../services/api';
import { adService } from '../services/adService';
import { DirectMessage, Friendship } from '../types';
import { useApp } from '../context/AppContext';
import { Colors } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';

export function DirectMessageScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useApp();
  const { t } = useLanguage();
  const friend = route.params.friend as Friendship;
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const listRef = useRef<FlatList<DirectMessage>>(null);

  const mergeMessages = useCallback((incoming: DirectMessage[]) => {
    setMessages((current) => {
      const byId = new Map(current.map((message) => [message.id, message]));
      incoming.forEach((message) => byId.set(message.id, message));
      return Array.from(byId.values()).sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    });
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      mergeMessages(await apiService.getDirectMessages(user.id, friend.friendId));
    } catch (error) {
      console.error('Failed to load direct messages:', error);
    }
  }, [friend.friendId, mergeMessages, user]);

  useFocusEffect(useCallback(() => {
    if (!user) return undefined;

    load();
    const ids = [user.id, friend.friendId].sort();
    const client = new Client({
      webSocketFactory: () => new SockJS(`${API_BASE_URL}/ws`),
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      debug: () => {},
    });

    client.onConnect = () => {
      client.subscribe(`/topic/direct-messages/${ids[0]}/${ids[1]}`, (frame) => {
        try {
          mergeMessages([JSON.parse(frame.body) as DirectMessage]);
          requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
        } catch (error) {
          console.error('Failed to parse direct message:', error);
        }
      });
    };
    client.activate();

    return () => {
      if (client.active) {
        void client.deactivate();
      }
    };
  }, [friend.friendId, load, mergeMessages, user]));

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      if (Platform.OS === 'android') {
        const windowHeight = Dimensions.get('window').height;
        setKeyboardHeight(Math.max(0, windowHeight - event.endCoordinates.screenY));
      }
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const send = async () => {
    if (!user || !text.trim() || sending) return;
    const content = text.trim();
    setText('');
    setSending(true);
    try {
      const saved = await apiService.sendDirectMessage(user.id, friend.friendId, content);
      mergeMessages([saved]);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
      await adService.onChatMessageSent();
    } catch (sendError) {
      setText(content);
      Alert.alert(
        '메시지를 보낼 수 없습니다',
        sendError instanceof Error
          ? sendError.message.replace(/^API Error: \d+ - /, '')
          : '친구 관계를 확인한 뒤 다시 시도해 주세요.',
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View
          style={[
            styles.content,
            Platform.OS === 'android' && keyboardHeight > 0
              ? { paddingBottom: keyboardHeight }
              : null,
          ]}
        >
          <View style={styles.header}>
            <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={25} color={Colors.text} />
            </TouchableOpacity>
            {friend.profilePictureUrl ? (
              <Image source={{ uri: friend.profilePictureUrl }} style={styles.avatar} />
            ) : (
              <View
                style={[
                  styles.avatar,
                  styles.avatarFallback,
                  friend.avatarColor ? { backgroundColor: friend.avatarColor } : null,
                ]}
              >
                <Text style={friend.avatarEmoji ? styles.avatarEmoji : styles.avatarLetter}>
                  {friend.avatarEmoji || friend.nickname.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.headerInfo}>
              <Text style={styles.name}>{friend.nickname}</Text>
              <View style={styles.presence}>
                <View style={[styles.dot, friend.online ? styles.online : styles.offline]} />
                <Text style={styles.presenceText}>{friend.online ? '접속 중' : '오프라인'}</Text>
              </View>
            </View>
          </View>

          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messages}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>첫 메시지를 보내 대화를 시작해 보세요.</Text></View>}
            renderItem={({ item }) => {
              const mine = item.senderId === user?.id;
              return (
                <View style={[styles.messageRow, mine && styles.messageRowMine]}>
                  <View style={[styles.bubble, mine ? styles.myBubble : styles.theirBubble]}>
                    <Text style={[styles.messageText, mine && styles.myMessageText]}>{item.content}</Text>
                    <Text style={[styles.time, mine && styles.myTime]}>
                      {new Date(item.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              );
            }}
          />

          <View style={styles.composer}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={t('messages.sendPlaceholder')}
              placeholderTextColor={Colors.textLight}
              style={styles.input}
              multiline
              maxLength={2000}
            />
            <TouchableOpacity style={[styles.send, !text.trim() && styles.sendDisabled]} onPress={send} disabled={!text.trim() || sending}>
              <Ionicons name="arrow-up" size={21} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F7FB' },
  content: { flex: 1 },
  header: { height: 70, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E6E3EC' },
  back: { width: 38, height: 38, justifyContent: 'center' },
  avatar: { width: 42, height: 42, borderRadius: 14 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFE9FF' },
  avatarLetter: { color: Colors.primary, fontWeight: '800', fontSize: 17 },
  avatarEmoji: { fontSize: 24 },
  headerInfo: { marginLeft: 11 },
  name: { color: Colors.text, fontSize: 16, fontWeight: '800' },
  presence: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  online: { backgroundColor: '#19C48A' },
  offline: { backgroundColor: '#B8B5C2' },
  presenceText: { color: Colors.textLight, fontSize: 11 },
  messages: { flexGrow: 1, padding: 18, gap: 8 },
  messageRow: { alignItems: 'flex-start' },
  messageRowMine: { alignItems: 'flex-end' },
  bubble: { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 7 },
  myBubble: { backgroundColor: Colors.primary, borderBottomRightRadius: 5 },
  theirBubble: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 5 },
  messageText: { color: Colors.text, fontSize: 15, lineHeight: 21 },
  myMessageText: { color: '#FFFFFF' },
  time: { color: Colors.textLight, fontSize: 9, marginTop: 4, textAlign: 'right' },
  myTime: { color: 'rgba(255,255,255,.7)' },
  empty: { flex: 1, minHeight: 300, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: Colors.textLight, fontSize: 13 },
  composer: { paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'flex-end', gap: 9, backgroundColor: '#FFFFFF', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E6E3EC' },
  input: { flex: 1, minHeight: 43, maxHeight: 110, borderRadius: 17, backgroundColor: '#F2F0F5', color: Colors.text, paddingHorizontal: 15, paddingTop: 11, paddingBottom: 10, fontSize: 15 },
  send: { width: 43, height: 43, borderRadius: 16, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { opacity: .35 },
});
