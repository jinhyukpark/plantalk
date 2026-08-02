import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Pressable,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
  Switch,
  Keyboard,
  Image,
  useWindowDimensions,
  KeyboardAvoidingView,
  AppState,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { adService } from '../services/adService';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights, Shadows, getSafeBottomPadding } from '../constants/theme';
import { Friendship, Room, RoomMessage, RoomParticipant, ROOM_CATEGORIES, CHAT_EMOJIS } from '../types';
import { apiService, API_BASE_URL } from '../services/api';
import { useApp } from '../context/AppContext';
import { useNotification } from '../context/NotificationContext';
import Card from '../components/Card';
import { Button } from '../components/Button';
import { ProfilePopup } from '../components/ProfilePopup';
import { useLanguage } from '../context/LanguageContext';

const CHAT_PAGE_SIZE = 30;

export default function RoomDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { roomId } = route.params;
  const { currentUser } = useApp();
  const { t, language } = useLanguage();
  const { setCurrentRoomId, subscribeToRoom, realtimeEvent } = useNotification();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const imageViewerWidth = screenWidth - 32;
  const imageViewerHeight = Math.min(
    screenHeight * 0.78,
    screenHeight - insets.top - insets.bottom - 48,
  );
  const bottomPadding = getSafeBottomPadding(insets.bottom, 8);
  
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'info' | 'settings'>('chat');
  const [isConnected, setIsConnected] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  const [autoWelcome, setAutoWelcome] = useState(true);
  const [welcomeMessage, setWelcomeMessage] = useState('환영합니다! 🎉');
  const [announcement, setAnnouncement] = useState('');
  const [roomAnnouncements, setRoomAnnouncements] = useState<RoomMessage[]>([]);
  const [expandedAnnouncementIds, setExpandedAnnouncementIds] = useState<Set<string>>(new Set());
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [selectedProfileNickname, setSelectedProfileNickname] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [imageViewerStartIndex, setImageViewerStartIndex] = useState(0);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteFriends, setInviteFriends] = useState<Friendship[]>([]);
  const [loadingInviteFriends, setLoadingInviteFriends] = useState(false);
  const [invitingFriendId, setInvitingFriendId] = useState<string | null>(null);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(true);
  
  const flatListRef = useRef<FlatList>(null);
  const didInitialScrollRef = useRef(false);
  const userHasScrolledMessagesRef = useRef(false);
  const stompClientRef = useRef<Client | null>(null);
  const inputRef = useRef<TextInput>(null);

  const loadBlockedUsers = useCallback(async () => {
    if (!currentUser) return;
    try {
      const ids = await apiService.getBlockedUserIds(currentUser.id);
      setBlockedUserIds(ids);
    } catch (error) {
      console.error('Failed to load blocked users:', error);
    }
  }, [currentUser]);

  const loadRoomData = useCallback(async () => {
    try {
      const [roomData, messagesData, participantsData] = await Promise.all([
        apiService.getRoomById(roomId, currentUser?.id),
        apiService.getRoomMessages(roomId, CHAT_PAGE_SIZE, currentUser?.id),
        apiService.getRoomParticipants(roomId, currentUser?.id),
      ]);
      
      if (roomData) {
        setRoom(roomData);
      }
      setMessages([...messagesData].reverse());
      setHasOlderMessages(messagesData.length === CHAT_PAGE_SIZE);
      setParticipants(participantsData);
      
      if (currentUser) {
        const userParticipant = participantsData.find(
          p => p.userId === currentUser.id && p.status === 'JOINED'
        );
        setIsJoined(!!userParticipant);
      }
    } catch (error) {
      console.error('Failed to load room data:', error);
    } finally {
      setLoading(false);
    }
  }, [roomId, currentUser]);

  const loadOlderMessages = useCallback(async () => {
    if (loadingOlderMessages || !hasOlderMessages || messages.length === 0) return;

    const oldestMessage = messages[0];
    setLoadingOlderMessages(true);
    try {
      const olderMessages = await apiService.getOlderRoomMessages(
        roomId,
        oldestMessage.createdAt,
        CHAT_PAGE_SIZE,
        currentUser?.id,
      );
      const chronologicalMessages = [...olderMessages].reverse();
      setMessages(currentMessages => {
        const existingIds = new Set(currentMessages.map(message => message.id));
        const uniqueOlderMessages = chronologicalMessages.filter(message => !existingIds.has(message.id));
        return [...uniqueOlderMessages, ...currentMessages];
      });
      setHasOlderMessages(olderMessages.length === CHAT_PAGE_SIZE);
    } catch (error) {
      console.error('Failed to load older room messages:', error);
    } finally {
      setLoadingOlderMessages(false);
    }
  }, [currentUser?.id, hasOlderMessages, loadingOlderMessages, messages, roomId]);

  useEffect(() => {
    didInitialScrollRef.current = false;
    userHasScrolledMessagesRef.current = false;
  }, [roomId]);

  const loadRoomAnnouncements = useCallback(async () => {
    if (!currentUser) return;
    setLoadingAnnouncements(true);
    try {
      const items = await apiService.getRoomAnnouncements(roomId, currentUser.id);
      setRoomAnnouncements(items);
    } catch (error) {
      console.error('Failed to load room announcements:', error);
    } finally {
      setLoadingAnnouncements(false);
    }
  }, [currentUser, roomId]);

  const connectWebSocket = useCallback(() => {
    if (!currentUser || !isJoined) return;

    const wsUrl = `${API_BASE_URL}/ws`;
    
    const client = new Client({
      webSocketFactory: () => new SockJS(wsUrl),
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      debug: (str) => {
        console.log('STOMP Debug:', str);
      },
      onConnect: () => {
        console.log('WebSocket Connected');
        setIsConnected(true);
        
        client.subscribe(`/topic/rooms/${roomId}`, (message: IMessage) => {
          try {
            const newMessage = JSON.parse(message.body) as RoomMessage;
            setMessages(prev => {
              if (newMessage.deleted) {
                return prev.filter(existing => existing.id !== newMessage.id);
              }
              const existingIndex = prev.findIndex(existing => existing.id === newMessage.id);
              if (existingIndex < 0) return [...prev, newMessage];
              return prev.map(existing => existing.id === newMessage.id ? newMessage : existing);
            });
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
          } catch (error) {
            console.error('Failed to parse message:', error);
          }
        });

        client.subscribe(`/topic/rooms/${roomId}/members`, () => {
          void loadRoomData();
        });
      },
      onDisconnect: () => {
        console.log('WebSocket Disconnected');
        setIsConnected(false);
      },
      onStompError: (frame) => {
        console.error('STOMP Error:', frame);
        setIsConnected(false);
      },
    });

    stompClientRef.current = client;
    client.activate();
  }, [roomId, currentUser, isJoined]);

  const disconnectWebSocket = useCallback(() => {
    if (stompClientRef.current?.connected) {
      stompClientRef.current.deactivate();
      stompClientRef.current = null;
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    loadRoomData();
    loadBlockedUsers();
    
    return () => {
      disconnectWebSocket();
    };
  }, [loadRoomData, loadBlockedUsers, disconnectWebSocket]);

  useEffect(() => {
    if (
      realtimeEvent?.type === 'ROOM_MEMBERS'
      && (!realtimeEvent.roomId || realtimeEvent.roomId === roomId)
    ) {
      void loadRoomData();
    }
  }, [realtimeEvent, roomId, loadRoomData]);

  useEffect(() => {
    if (isJoined && currentUser && !stompClientRef.current) {
      connectWebSocket();
    }
    
    return () => {
      if (!isJoined) {
        disconnectWebSocket();
      }
    };
  }, [isJoined, currentUser, connectWebSocket, disconnectWebSocket]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const vv = typeof window !== 'undefined' ? window.visualViewport : null;
      if (!vv) return;
      const handleViewport = () => {
        const overlap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        setKeyboardHeight(overlap);
        setIsKeyboardVisible(overlap > 0);
        if (overlap > 0) {
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
      };
      vv.addEventListener('resize', handleViewport);
      vv.addEventListener('scroll', handleViewport);
      return () => {
        vv.removeEventListener('resize', handleViewport);
        vv.removeEventListener('scroll', handleViewport);
      };
    }

    const updateKeyboardLayout = (keyboardTop?: number, fallbackHeight = 0) => {
      const overlap =
        keyboardTop != null
          ? Math.max(0, screenHeight - keyboardTop)
          : Math.max(0, fallbackHeight);
      setKeyboardHeight(overlap);
      setIsKeyboardVisible(overlap > 0);
    };

    const resetKeyboardLayout = () => {
      setIsKeyboardVisible(false);
      setKeyboardHeight(0);
    };

    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        updateKeyboardLayout(e.endCoordinates?.screenY, e.endCoordinates?.height);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    );
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      resetKeyboardLayout
    );

    // iOS may skip keyboardWillHide while the app is being backgrounded. Keep
    // the padding in sync with intermediate/resumed keyboard frame changes too.
    const keyboardFrameChange = Platform.OS === 'ios'
      ? Keyboard.addListener('keyboardWillChangeFrame', (e) => {
          updateKeyboardLayout(e.endCoordinates?.screenY, e.endCoordinates?.height);
        })
      : null;

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        Keyboard.dismiss();
        resetKeyboardLayout();
        return;
      }

      // Native keyboard notifications are not guaranteed during an app-state
      // transition, so re-read the current frame after iOS becomes active.
      requestAnimationFrame(() => {
        const metrics = Keyboard.metrics();
        if (!metrics) {
          resetKeyboardLayout();
          return;
        }
        updateKeyboardLayout(metrics.screenY, metrics.height);
      });
    });

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
      keyboardFrameChange?.remove();
      appStateSubscription.remove();
    };
  }, [screenHeight]);

  useEffect(() => {
    setCurrentRoomId(roomId);
    
    return () => {
      setCurrentRoomId(null);
    };
  }, [roomId, setCurrentRoomId]);

  useEffect(() => {
    if (isJoined) {
      subscribeToRoom(roomId);
    }
  }, [isJoined, roomId, subscribeToRoom]);

  const handleJoinRoom = async () => {
    if (!currentUser) {
      Alert.alert('알림', '로그인이 필요합니다');
      return;
    }

    try {
      await apiService.joinRoom(roomId, currentUser.id, currentUser.nickname);
      setIsJoined(true);
      loadRoomData();
    } catch (error) {
      console.error('Failed to join room:', error);
      Alert.alert('오류', '방에 참여하는 데 실패했습니다');
    }
  };

  const handleLeaveRoom = async () => {
    if (!currentUser) return;

    Alert.alert(
      '방 나가기',
      '정말 이 방을 나가시겠어요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '나가기',
          style: 'destructive',
          onPress: async () => {
            try {
              disconnectWebSocket();
              await apiService.leaveRoom(roomId, currentUser.id);
              navigation.goBack();
            } catch (error) {
              console.error('Failed to leave room:', error);
            }
          },
        },
      ]
    );
  };

  const handleBlockUser = async (userId: string, userName: string) => {
    if (!currentUser) return;

    Alert.alert(
      '사용자 차단',
      `${userName}님을 차단하시겠어요?\n차단된 사용자의 메시지는 보이지 않습니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '차단',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.blockUser(currentUser.id, userId);
              setBlockedUserIds(prev => [...prev, userId]);
              Alert.alert('완료', `${userName}님을 차단했습니다.`);
            } catch (error: any) {
              Alert.alert('오류', error.message || '차단에 실패했습니다.');
            }
          },
        },
      ]
    );
  };

  const handleUnblockUser = async (userId: string, userName: string) => {
    if (!currentUser) return;

    Alert.alert(
      '차단 해제',
      `${userName}님의 차단을 해제하시겠어요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '해제',
          onPress: async () => {
            try {
              await apiService.unblockUser(currentUser.id, userId);
              setBlockedUserIds(prev => prev.filter(id => id !== userId));
              Alert.alert('완료', `${userName}님의 차단을 해제했습니다.`);
            } catch (error: any) {
              Alert.alert('오류', error.message || '차단 해제에 실패했습니다.');
            }
          },
        },
      ]
    );
  };

  const sendMessageInternal = async (
    content: string,
    messageType: string = 'TEXT',
    attachmentUrl?: string,
  ) => {
    if ((!content.trim() && !attachmentUrl) || !currentUser) return;
    
    try {
      if (stompClientRef.current?.connected) {
        const messagePayload = {
          roomId,
          senderId: currentUser.id,
          senderName: currentUser.nickname,
          content: content.trim(),
          messageType,
          attachmentUrl,
        };
        
        stompClientRef.current.publish({
          destination: `/app/rooms/${roomId}/message`,
          body: JSON.stringify(messagePayload),
        });
      } else {
        await apiService.sendMessage(
          roomId,
          currentUser.id,
          currentUser.nickname,
          content.trim(),
          messageType,
          attachmentUrl,
        );
        await loadRoomData();
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !currentUser || sending) return;

    const text = messageText.trim();
    setMessageText('');
    setSending(true);

    await sendMessageInternal(text);
    setSending(false);

    adService.onChatMessageSent();
  };

  const handleSendAnnouncement = async () => {
    if (!announcement.trim() || !currentUser) return;

    try {
      if (editingAnnouncementId) {
        await apiService.updateRoomAnnouncement(
          roomId,
          editingAnnouncementId,
          currentUser.id,
          announcement.trim(),
        );
        await Promise.all([loadRoomAnnouncements(), loadRoomData()]);
      } else {
        const announcementText = `📢 공지사항\n${announcement.trim()}`;
        await sendMessageInternal(announcementText, 'SYSTEM');
        setTimeout(() => {
          void loadRoomAnnouncements();
          void loadRoomData();
        }, 350);
      }
      setAnnouncement('');
      setEditingAnnouncementId(null);
      setShowAnnouncementModal(false);
    } catch (error: any) {
      Alert.alert('오류', error.message || '공지를 저장하지 못했습니다.');
    }
  };

  const openNewAnnouncement = () => {
    setEditingAnnouncementId(null);
    setAnnouncement('');
    setShowAnnouncementModal(true);
  };

  const openEditAnnouncement = (item: RoomMessage) => {
    setEditingAnnouncementId(item.id);
    setAnnouncement(item.content.replace(/^\s*📢\s*공지사항\s*\n?/, ''));
    setShowAnnouncementModal(true);
  };

  const handleDeleteAnnouncement = (item: RoomMessage) => {
    if (!currentUser) return;
    Alert.alert(
      '공지 삭제',
      '이 공지를 삭제하시겠어요? 삭제한 공지는 다시 복구할 수 없습니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteRoomAnnouncement(roomId, item.id, currentUser.id);
              setRoomAnnouncements(prev => prev.filter(value => value.id !== item.id));
              setMessages(prev => prev.filter(value => value.id !== item.id));
            } catch (error: any) {
              Alert.alert('오류', error.message || '공지를 삭제하지 못했습니다.');
            }
          },
        },
      ],
    );
  };

  const handlePickChatImage = async () => {
    if (!currentUser || sending) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;

    setSending(true);
    try {
      const attachmentUrl = await apiService.uploadRoomImage(roomId, result.assets[0].uri);
      await sendMessageInternal('사진', 'IMAGE', attachmentUrl);
    } catch (error: any) {
      Alert.alert('오류', error.message || '이미지 전송에 실패했습니다.');
    } finally {
      setSending(false);
    }
  };

  const insertEmoji = (emoji: string) => {
    setMessageText(prev => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const getCategoryEmoji = (category: string) => {
    const cat = ROOM_CATEGORIES.find(c => c.id === category);
    return cat?.emoji || '💬';
  };

  const isRoomAnnouncement = useCallback(
    (message: RoomMessage) => message.messageType === 'SYSTEM'
      && (message.senderId === 'admin' || message.content.trimStart().startsWith('📢 공지사항')),
    []
  );

  const getAnnouncementContent = useCallback(
    (content: string) => content.replace(/^\s*📢\s*공지사항\s*\n?/, '').trim(),
    []
  );

  const pinnedAnnouncements = useMemo(
    () => messages
      .filter(isRoomAnnouncement)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [isRoomAnnouncement, messages]
  );

  const chatMessages = useMemo(
    () => messages.filter(message => !isRoomAnnouncement(message)),
    [isRoomAnnouncement, messages]
  );

  const toggleAnnouncement = useCallback((announcementId: string) => {
    setExpandedAnnouncementIds(previous => {
      const next = new Set(previous);
      if (next.has(announcementId)) {
        next.delete(announcementId);
      } else {
        next.add(announcementId);
      }
      return next;
    });
  }, []);

  const formatAnnouncementDate = useCallback((dateStr: string) => {
    const locale = language === 'en' ? 'en-US' : language === 'ja' ? 'ja-JP' : 'ko-KR';
    return new Date(dateStr).toLocaleString(locale, {
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }, [language]);

  const imageMessages = useMemo(
    () => chatMessages.filter(
      message => message.messageType === 'IMAGE'
        && Boolean(message.attachmentUrl)
        && !blockedUserIds.includes(message.senderId)
    ),
    [blockedUserIds, chatMessages]
  );

  const openImageViewer = (messageId: string) => {
    const imageIndex = imageMessages.findIndex(message => message.id === messageId);
    if (imageIndex >= 0) {
      setImageViewerStartIndex(imageIndex);
      setSelectedImageIndex(imageIndex);
    }
  };

  const isOwner = Boolean(room && currentUser && room.creatorId === currentUser.id);
  const isRoomFull = Boolean(
    room?.maxParticipants != null && participants.length >= room.maxParticipants
  );

  const roomInviteText = useCallback((ko: string, en: string, ja: string) => {
    if (language === 'en') return en;
    if (language === 'ja') return ja;
    return ko;
  }, [language]);

  const openInviteModal = useCallback(async () => {
    if (!currentUser || !isOwner || isRoomFull) return;
    setShowInviteModal(true);
    setLoadingInviteFriends(true);
    try {
      const friends = await apiService.getFriends(currentUser.id);
      const participantIds = new Set(participants.map(participant => participant.userId));
      setInviteFriends(friends.filter(friend => !participantIds.has(friend.friendId)));
    } catch (error) {
      console.error('Failed to load invite friends:', error);
      Alert.alert(
        roomInviteText('친구 불러오기 실패', 'Could not load friends', '友達を読み込めませんでした'),
        roomInviteText('잠시 후 다시 시도해 주세요.', 'Please try again shortly.', 'しばらくしてからもう一度お試しください。'),
      );
      setShowInviteModal(false);
    } finally {
      setLoadingInviteFriends(false);
    }
  }, [currentUser, isOwner, isRoomFull, participants, roomInviteText]);

  const handleInviteFriend = useCallback(async (friend: Friendship) => {
    if (!currentUser || invitingFriendId) return;
    setInvitingFriendId(friend.friendId);
    try {
      const participant = await apiService.inviteFriendToRoom(
        roomId,
        currentUser.id,
        friend.friendId,
      );
      setParticipants(previous => [
        ...previous.filter(item => item.userId !== participant.userId),
        participant,
      ]);
      setRoom(previous => previous ? {
        ...previous,
        currentParticipants: previous.currentParticipants + 1,
      } : previous);
      setInviteFriends(previous => previous.filter(item => item.friendId !== friend.friendId));
      Alert.alert(
        roomInviteText('초대 완료', 'Friend added', '招待しました'),
        roomInviteText(
          `${friend.nickname}님을 참여자로 추가했습니다.`,
          `${friend.nickname} was added to the room.`,
          `${friend.nickname}さんを参加者に追加しました。`,
        ),
      );
    } catch (error) {
      console.error('Failed to invite friend:', error);
      Alert.alert(
        roomInviteText('초대 실패', 'Invite failed', '招待できませんでした'),
        error instanceof Error
          ? error.message
          : roomInviteText('친구를 초대하지 못했습니다.', 'Could not invite this friend.', '友達を招待できませんでした。'),
      );
    } finally {
      setInvitingFriendId(null);
    }
  }, [currentUser, invitingFriendId, roomId, roomInviteText]);

  useEffect(() => {
    if (!isOwner && activeTab === 'settings') {
      setActiveTab('chat');
      return;
    }
    if (isOwner && activeTab === 'settings') {
      void loadRoomAnnouncements();
    }
  }, [activeTab, isOwner, loadRoomAnnouncements]);

  const renderMessage = ({ item, index }: { item: RoomMessage; index: number }) => {
    const isBlockedUser = blockedUserIds.includes(item.senderId);
    if (isBlockedUser && item.messageType !== 'SYSTEM') {
      return null;
    }

    const isMyMessage = currentUser && item.senderId === currentUser.id;
    const showAvatar = index === 0 || chatMessages[index - 1]?.senderId !== item.senderId;
    const showTime = index === chatMessages.length - 1 ||
      chatMessages[index + 1]?.senderId !== item.senderId ||
      (item.createdAt && chatMessages[index + 1]?.createdAt &&
       formatTime(item.createdAt) !== formatTime(chatMessages[index + 1].createdAt));

    if (item.messageType === 'SYSTEM') {
      const isAnnouncement = item.content.trimStart().startsWith('📢 공지사항');
      const systemContent = isAnnouncement
        ? item.content.replace(/^\s*📢\s*공지사항\s*\n?/, '')
        : item.content;

      return (
        <View style={[styles.systemMessage, isAnnouncement && styles.announcementMessage]}>
          <View style={[styles.systemMessageBox, isAnnouncement && styles.announcementMessageBox]}>
            {isAnnouncement && (
              <View style={styles.announcementHeader}>
                <View style={styles.announcementIcon}>
                  <Ionicons name="megaphone" size={16} color={Colors.primary} />
                </View>
                <Text style={styles.announcementLabel}>채팅방 공지</Text>
              </View>
            )}
            <Text style={[styles.systemMessageText, isAnnouncement && styles.announcementMessageText]}>
              {systemContent}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.messageRow, isMyMessage && styles.messageRowMine]}>
        {!isMyMessage && showAvatar && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.senderName?.[0]?.toUpperCase() || '?'}</Text>
          </View>
        )}
        {!isMyMessage && !showAvatar && <View style={styles.avatarPlaceholder} />}
        
        <View style={styles.messageContent}>
          {!isMyMessage && showAvatar && (
            <Text style={styles.senderName}>{item.senderName}</Text>
          )}
          <View style={[styles.messageBubble, isMyMessage && styles.messageBubbleMine]}>
            {item.messageType === 'IMAGE' && item.attachmentUrl && (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => openImageViewer(item.id)}
                accessibilityRole="imagebutton"
                accessibilityLabel="채팅 사진 크게 보기"
              >
                <Image source={{ uri: item.attachmentUrl }} style={styles.messageImage} />
              </TouchableOpacity>
            )}
            <Text style={[styles.messageText, isMyMessage && styles.messageTextMine]}>
              {item.content}
            </Text>
          </View>
          {showTime && item.createdAt && (
            <Text style={[styles.messageTime, isMyMessage && styles.messageTimeMine]}>
              {formatTime(item.createdAt)}
            </Text>
          )}
        </View>
      </View>
    );
  };

  const renderParticipant = ({ item }: { item: RoomParticipant }) => {
    const isBlocked = blockedUserIds.includes(item.userId);
    const isMe = currentUser?.id === item.userId;
    
    return (
      <TouchableOpacity 
        style={styles.participantItem}
        onPress={() => setSelectedProfileNickname(item.userName)}
        activeOpacity={0.7}
      >
        <View style={[styles.participantAvatar, item.role === 'OWNER' && styles.ownerAvatar]}>
          <Text style={styles.participantAvatarText}>{item.userName?.[0]?.toUpperCase() || '?'}</Text>
        </View>
        <View style={styles.participantInfo}>
          <View style={styles.participantNameRow}>
            <Text style={styles.participantName}>{item.userName}</Text>
            {isBlocked && <Text style={styles.blockedBadge}>차단됨</Text>}
          </View>
          {item.role === 'OWNER' && (
            <Text style={styles.participantRole}>방장</Text>
          )}
        </View>
        {isOwner && !isMe && (
          <TouchableOpacity
            style={[styles.blockButton, isBlocked && styles.unblockButton]}
            onPress={(e) => {
              e.stopPropagation();
              isBlocked 
                ? handleUnblockUser(item.userId, item.userName)
                : handleBlockUser(item.userId, item.userName);
            }}
          >
            <Text style={[styles.blockButtonText, isBlocked && styles.unblockButtonText]}>
              {isBlocked ? '해제' : '차단'}
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmojiPicker = () => (
    <View style={styles.emojiPicker}>
      <View style={styles.emojiGrid}>
        {CHAT_EMOJIS.map((emoji, index) => (
          <TouchableOpacity
            key={index}
            style={styles.emojiButton}
            onPress={() => insertEmoji(emoji)}
          >
            <Text style={styles.emojiText}>{emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderSettingsTab = () => (
    <View style={styles.settingsContainer}>
      <Card style={styles.settingsCard}>
        <Text style={styles.settingsTitle}>🤖 자동화 설정</Text>
        
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>입장 인사</Text>
            <Text style={styles.settingDesc}>새 참여자 입장 시 자동 인사</Text>
          </View>
          <Switch
            value={autoWelcome}
            onValueChange={setAutoWelcome}
            trackColor={{ false: Colors.border, true: Colors.primaryLight }}
            thumbColor={autoWelcome ? Colors.primary : Colors.textTertiary}
          />
        </View>
        
        {autoWelcome && (
          <View style={styles.welcomeInputContainer}>
            <TextInput
              style={styles.welcomeInput}
              value={welcomeMessage}
              onChangeText={setWelcomeMessage}
                placeholder={t('rooms.welcomePlaceholder')}
              placeholderTextColor={Colors.textTertiary}
            />
          </View>
        )}
      </Card>
      
      {isOwner && (
        <Card style={styles.settingsCard}>
          <View style={styles.announcementSectionHeader}>
            <View>
              <Text style={styles.settingsTitle}>📢 공지사항</Text>
              <Text style={styles.announcementSectionDesc}>작성한 공지를 수정하거나 삭제할 수 있어요.</Text>
            </View>
          </View>

          {loadingAnnouncements ? (
            <ActivityIndicator style={styles.announcementLoader} color={Colors.primary} />
          ) : roomAnnouncements.length === 0 ? (
            <View style={styles.announcementEmpty}>
              <Ionicons name="megaphone-outline" size={25} color={Colors.textLight} />
              <Text style={styles.announcementEmptyText}>아직 작성한 공지가 없어요.</Text>
            </View>
          ) : (
            <View style={styles.announcementList}>
              {roomAnnouncements.map(item => (
                <View key={item.id} style={styles.announcementListItem}>
                  <Text style={styles.announcementListContent} numberOfLines={4}>
                    {item.content.replace(/^\s*📢\s*공지사항\s*\n?/, '')}
                  </Text>
                  <View style={styles.announcementListFooter}>
                    <Text style={styles.announcementListDate}>
                      {new Date(item.editedAt || item.createdAt).toLocaleString('ko-KR', {
                        month: 'numeric',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                      {item.editedAt ? ' · 수정됨' : ''}
                    </Text>
                    <View style={styles.announcementActions}>
                      <TouchableOpacity
                        style={styles.announcementActionButton}
                        onPress={() => openEditAnnouncement(item)}
                      >
                        <Ionicons name="pencil-outline" size={15} color={Colors.primary} />
                        <Text style={styles.announcementEditText}>수정</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.announcementActionButton}
                        onPress={() => handleDeleteAnnouncement(item)}
                      >
                        <Ionicons name="trash-outline" size={15} color={Colors.error} />
                        <Text style={styles.announcementDeleteText}>삭제</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={styles.announcementBtn}
            onPress={openNewAnnouncement}
          >
            <Ionicons name="add" size={20} color={Colors.card} />
            <Text style={styles.announcementBtnText}>새 공지 작성하기</Text>
          </TouchableOpacity>
        </Card>
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top', 'left', 'right']}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  if (!room) {
    return (
      <SafeAreaView style={styles.errorContainer} edges={['top', 'left', 'right']}>
        <Text style={styles.errorEmoji}>😢</Text>
        <Text style={styles.errorText}>방을 찾을 수 없습니다</Text>
        <Button title="돌아가기" onPress={() => navigation.goBack()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerEmoji}>{room.emoji || getCategoryEmoji(room.category)}</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>{room.title}</Text>
            {isConnected && <View style={styles.connectedDot} />}
          </View>
          <Text style={styles.headerSubtitle}>
            👥 {room.currentParticipants}명 참여중
          </Text>
        </View>
        {isJoined && (
          <TouchableOpacity style={styles.leaveBtn} onPress={handleLeaveRoom}>
            <Text style={styles.leaveBtnText}>나가기</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'chat' && styles.tabActive]}
          onPress={() => setActiveTab('chat')}
        >
          <Ionicons name="chatbubbles-outline" size={20} color={activeTab === 'chat' ? Colors.primary : Colors.textSecondary} style={styles.tabIcon} />
          <Text style={[styles.tabText, activeTab === 'chat' && styles.tabTextActive]}>채팅</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'info' && styles.tabActive]}
          onPress={() => setActiveTab('info')}
        >
          <Ionicons name="information-circle-outline" size={20} color={activeTab === 'info' ? Colors.primary : Colors.textSecondary} style={styles.tabIcon} />
          <Text style={[styles.tabText, activeTab === 'info' && styles.tabTextActive]}>정보</Text>
        </TouchableOpacity>
        {isOwner && (
          <TouchableOpacity
            style={[styles.tab, activeTab === 'settings' && styles.tabActive]}
            onPress={() => setActiveTab('settings')}
          >
            <Ionicons name="settings-outline" size={20} color={activeTab === 'settings' ? Colors.primary : Colors.textSecondary} style={styles.tabIcon} />
            <Text style={[styles.tabText, activeTab === 'settings' && styles.tabTextActive]}>설정</Text>
          </TouchableOpacity>
        )}
      </View>

      {activeTab === 'chat' ? (
        <View
          style={[
            styles.chatContainer,
            isKeyboardVisible && keyboardHeight > 0 && { paddingBottom: keyboardHeight },
          ]}
        >
          {pinnedAnnouncements.length > 0 && (
            <View style={styles.pinnedAnnouncementsContainer}>
              {pinnedAnnouncements.map(item => {
                const expanded = expandedAnnouncementIds.has(item.id);
                const content = getAnnouncementContent(item.content);

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.pinnedAnnouncement, expanded && styles.pinnedAnnouncementExpanded]}
                    activeOpacity={0.75}
                    onPress={() => toggleAnnouncement(item.id)}
                    accessibilityRole="button"
                    accessibilityLabel={expanded ? '공지사항 접기' : '공지사항 펼치기'}
                  >
                    <View style={styles.pinnedAnnouncementIcon}>
                      <Ionicons name="megaphone" size={14} color={Colors.primary} />
                    </View>
                    <View style={styles.pinnedAnnouncementContent}>
                      <View style={styles.pinnedAnnouncementSummary}>
                        <Text
                          style={styles.pinnedAnnouncementText}
                          numberOfLines={expanded ? undefined : 1}
                        >
                          {content}
                        </Text>
                        {!expanded && (
                          <Text style={styles.pinnedAnnouncementDate}>
                            {formatAnnouncementDate(item.createdAt)}
                          </Text>
                        )}
                      </View>
                      {expanded && (
                        <Text style={styles.pinnedAnnouncementDateExpanded}>
                          {formatAnnouncementDate(item.editedAt || item.createdAt)}
                        </Text>
                      )}
                    </View>
                    <Ionicons
                      name={expanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={Colors.textSecondary}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {chatMessages.length === 0 ? (
            <View style={styles.emptyChatContainer}>
              <Text style={styles.emptyChatEmoji}>💬</Text>
              <Text style={styles.emptyChatText}>아직 대화가 없어요</Text>
              <Text style={styles.emptyChatSubtext}>첫 메시지를 보내보세요!</Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={chatMessages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.messageList}
              maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
              ListHeaderComponent={loadingOlderMessages ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : null}
              onScrollBeginDrag={() => {
                userHasScrolledMessagesRef.current = true;
              }}
              onScroll={({ nativeEvent }) => {
                if (userHasScrolledMessagesRef.current && nativeEvent.contentOffset.y <= 80) {
                  void loadOlderMessages();
                }
              }}
              scrollEventThrottle={100}
              onContentSizeChange={() => {
                if (!didInitialScrollRef.current) {
                  didInitialScrollRef.current = true;
                  flatListRef.current?.scrollToEnd({ animated: false });
                }
              }}
              showsVerticalScrollIndicator={false}
            />
          )}

          {showEmojiPicker && renderEmojiPicker()}

          {isJoined ? (
            <View style={[styles.inputBar, { paddingBottom: isKeyboardVisible ? 8 : bottomPadding }]}>
              <TouchableOpacity
                style={styles.imageToggle}
                onPress={handlePickChatImage}
                disabled={sending}
              >
                <Ionicons name="image-outline" size={24} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.emojiToggle}
                onPress={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                <Text style={styles.emojiToggleText}>{showEmojiPicker ? '⌨️' : '😊'}</Text>
              </TouchableOpacity>
              <View style={styles.inputWrapper}>
                <TextInput
                  ref={inputRef}
                  style={styles.messageInput}
              placeholder={t('rooms.messagePlaceholder')}
                  placeholderTextColor={Colors.textTertiary}
                  value={messageText}
                  onChangeText={setMessageText}
                  multiline
                  maxLength={500}
                  onFocus={() => setShowEmojiPicker(false)}
                />
              </View>
              <TouchableOpacity
                style={[styles.sendBtn, (!messageText.trim() || sending) && styles.sendBtnDisabled]}
                onPress={handleSendMessage}
                disabled={!messageText.trim() || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={Colors.card} />
                ) : (
                  <Text style={styles.sendBtnText}>전송</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.joinBar, { paddingBottom: isKeyboardVisible ? 8 : bottomPadding }]}>
              <Text style={styles.joinText}>채팅에 참여하려면 방에 입장하세요</Text>
              <TouchableOpacity style={styles.joinBtn} onPress={handleJoinRoom}>
                <Text style={styles.joinBtnText}>입장하기</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : activeTab === 'info' ? (
        <View style={styles.infoContainer}>
          <Card style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <View style={styles.infoEmojiBox}>
                <Text style={styles.infoEmoji}>{room.emoji || getCategoryEmoji(room.category)}</Text>
              </View>
              <View style={styles.infoHeaderText}>
                <Text style={styles.infoTitle}>{room.title}</Text>
                <Text style={styles.infoCreator}>@{room.creatorName}</Text>
              </View>
            </View>
            
            {room.description && (
              <Text style={styles.infoDescription}>{room.description}</Text>
            )}
            
            <View style={styles.infoStats}>
              {room.locationName && (
                <View style={styles.infoStatItem}>
                  <Text style={styles.infoStatIcon}>📍</Text>
                  <Text style={styles.infoStatText}>{room.locationName}</Text>
                </View>
              )}
              {room.startsAt && (
                <View style={styles.infoStatItem}>
                  <Text style={styles.infoStatIcon}>🕐</Text>
                  <Text style={styles.infoStatText}>
                    {new Date(room.startsAt).toLocaleString('ko-KR', { 
                      month: 'short', 
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Text>
                </View>
              )}
              <View style={styles.infoStatItem}>
                <Text style={styles.infoStatIcon}>👥</Text>
                <Text style={styles.infoStatText}>
                  {room.currentParticipants} / {room.maxParticipants || '무제한'}
                </Text>
              </View>
            </View>
          </Card>

          <View style={styles.participantsSection}>
            <View style={styles.participantsHeadingRow}>
              <Text style={styles.participantsTitle}>
                {roomInviteText('참여자', 'Participants', '参加者')} ({participants.length})
              </Text>
              {isOwner && (
                <TouchableOpacity
                  style={[styles.inviteFriendsButton, isRoomFull && styles.inviteFriendsButtonDisabled]}
                  onPress={openInviteModal}
                  disabled={isRoomFull}
                  accessibilityRole="button"
                >
                  <Ionicons name="person-add-outline" size={17} color={isRoomFull ? Colors.textTertiary : Colors.primary} />
                  <Text style={[styles.inviteFriendsButtonText, isRoomFull && styles.inviteFriendsButtonTextDisabled]}>
                    {isRoomFull
                      ? roomInviteText('정원 마감', 'Room full', '満員')
                      : roomInviteText('친구 초대', 'Invite friends', '友達を招待')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <FlatList
              data={participants}
              renderItem={renderParticipant}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.participantsList}
            />
          </View>
        </View>
      ) : isOwner ? (
        renderSettingsTab()
      ) : (
        <View style={styles.settingsContainer} />
      )}

      <Modal
        visible={showInviteModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowInviteModal(false)}
      >
        <Pressable style={styles.inviteModalOverlay} onPress={() => setShowInviteModal(false)}>
          <Pressable style={[styles.inviteModalSheet, { paddingBottom: bottomPadding + 12 }]}>
            <View style={styles.inviteModalHandle} />
            <View style={styles.inviteModalHeader}>
              <View>
                <Text style={styles.inviteModalTitle}>
                  {roomInviteText('친구 초대', 'Invite friends', '友達を招待')}
                </Text>
                <Text style={styles.inviteModalDescription}>
                  {roomInviteText('현재 방에 없는 친구만 표시됩니다.', 'Only friends outside this room are shown.', 'このルームにいない友達のみ表示されます。')}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowInviteModal(false)} style={styles.inviteModalClose}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {loadingInviteFriends ? (
              <ActivityIndicator size="large" color={Colors.primary} style={styles.inviteModalLoader} />
            ) : inviteFriends.length === 0 ? (
              <View style={styles.inviteEmptyState}>
                <Ionicons name="people-outline" size={38} color={Colors.textTertiary} />
                <Text style={styles.inviteEmptyText}>
                  {roomInviteText('초대할 수 있는 친구가 없어요.', 'No friends are available to invite.', '招待できる友達はいません。')}
                </Text>
              </View>
            ) : (
              <FlatList
                data={inviteFriends}
                keyExtractor={item => item.id}
                style={styles.inviteFriendList}
                renderItem={({ item }) => (
                  <View style={styles.inviteFriendRow}>
                    {item.profilePictureUrl ? (
                      <Image source={{ uri: item.profilePictureUrl }} style={styles.inviteFriendAvatar} />
                    ) : (
                      <View style={[styles.inviteFriendAvatar, { backgroundColor: item.avatarColor || Colors.accentLight }]}>
                        <Text style={styles.inviteFriendEmoji}>
                          {item.avatarEmoji || item.nickname?.[0]?.toUpperCase() || '?'}
                        </Text>
                      </View>
                    )}
                    <View style={styles.inviteFriendInfo}>
                      <Text style={styles.inviteFriendName}>{item.nickname}</Text>
                      <Text style={styles.inviteFriendStatus}>
                        {item.online
                          ? roomInviteText('현재 접속 중', 'Online', 'オンライン')
                          : roomInviteText('오프라인', 'Offline', 'オフライン')}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.inviteFriendAction}
                      onPress={() => handleInviteFriend(item)}
                      disabled={invitingFriendId !== null}
                    >
                      {invitingFriendId === item.friendId ? (
                        <ActivityIndicator size="small" color={Colors.card} />
                      ) : (
                        <Text style={styles.inviteFriendActionText}>
                          {roomInviteText('초대', 'Invite', '招待')}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showAnnouncementModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowAnnouncementModal(false);
          setEditingAnnouncementId(null);
        }}
      >
        <KeyboardAvoidingView style={styles.keyboardModal} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingAnnouncementId ? '📢 공지사항 수정' : '📢 새 공지 작성'}
            </Text>
            <TextInput
              style={styles.modalInput}
                placeholder={t('rooms.announcementPlaceholder')}
              placeholderTextColor={Colors.textTertiary}
              value={announcement}
              onChangeText={setAnnouncement}
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowAnnouncementModal(false);
                  setEditingAnnouncementId(null);
                  setAnnouncement('');
                }}
              >
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, !announcement.trim() && styles.modalConfirmBtnDisabled]}
                onPress={handleSendAnnouncement}
                disabled={!announcement.trim()}
              >
                <Text style={styles.modalConfirmText}>{editingAnnouncementId ? '저장' : '등록'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={selectedImageIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedImageIndex(null)}
      >
        <View
          style={[
            styles.imageViewerOverlay,
            {
              paddingTop: Math.max(insets.top, 16),
              paddingBottom: getSafeBottomPadding(insets.bottom, 16),
            },
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setSelectedImageIndex(null)}
            accessibilityRole="button"
            accessibilityLabel="사진 닫기"
          />
          <View
            style={[
              styles.imageViewerPopup,
              { width: imageViewerWidth, height: imageViewerHeight },
            ]}
          >
            <View style={styles.imageViewerHeader}>
              <TouchableOpacity
                style={styles.imageViewerClose}
                onPress={() => setSelectedImageIndex(null)}
                accessibilityRole="button"
                accessibilityLabel="사진 닫기"
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.imageViewerCount}>
                {(selectedImageIndex ?? 0) + 1} / {imageMessages.length}
              </Text>
              <View style={styles.imageViewerHeaderSpacer} />
            </View>

            {selectedImageIndex !== null && imageMessages.length > 0 && (
              <FlatList
                key={`image-viewer-${imageViewerStartIndex}-${imageViewerWidth}`}
                style={styles.imageViewerList}
                data={imageMessages}
                horizontal
                pagingEnabled
                scrollEnabled={imageMessages.length > 1}
                directionalLockEnabled
                nestedScrollEnabled
                decelerationRate="fast"
                snapToInterval={imageViewerWidth}
                snapToAlignment="start"
                disableIntervalMomentum
                initialScrollIndex={imageViewerStartIndex}
                getItemLayout={(_, index) => ({
                  length: imageViewerWidth,
                  offset: imageViewerWidth * index,
                  index,
                })}
                keyExtractor={item => item.id}
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(event) => {
                  const nextIndex = Math.round(event.nativeEvent.contentOffset.x / imageViewerWidth);
                  setSelectedImageIndex(Math.max(0, Math.min(nextIndex, imageMessages.length - 1)));
                }}
                renderItem={({ item }) => (
                  <View style={[styles.imageViewerPage, { width: imageViewerWidth }]}>
                    <Image
                      source={{ uri: item.attachmentUrl! }}
                      style={{
                        width: imageViewerWidth,
                        height: Math.max(220, imageViewerHeight - 150),
                      }}
                      resizeMode="contain"
                    />
                    <Text style={styles.imageViewerMeta} numberOfLines={1}>
                      {item.senderName} · {formatTime(item.createdAt)}
                    </Text>
                  </View>
                )}
              />
            )}

            {imageMessages.length > 1 && (
              <View style={styles.imageViewerHint}>
                <Ionicons name="swap-horizontal" size={17} color="rgba(255,255,255,.75)" />
                <Text style={styles.imageViewerHintText}>좌우로 밀어 사진 보기</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <ProfilePopup
        visible={selectedProfileNickname !== null}
        nickname={selectedProfileNickname}
        onClose={() => setSelectedProfileNickname(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  keyboardModal: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    backgroundColor: Colors.background,
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
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnText: {
    fontSize: 28,
    color: Colors.primary,
    fontWeight: FontWeights.medium,
  },
  headerCenter: {
    flex: 1,
    marginLeft: Spacing.xs,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerEmoji: {
    fontSize: 18,
    marginRight: 6,
  },
  headerTitle: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: Colors.text,
    flex: 1,
  },
  connectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
    marginLeft: 6,
  },
  headerSubtitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  leaveBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  leaveBtnText: {
    fontSize: FontSizes.sm,
    color: Colors.error,
    fontWeight: FontWeights.medium,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  tabIcon: {
    marginRight: 6,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeights.medium,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  chatContainer: {
    flex: 1,
  },
  pinnedAnnouncementsContainer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 6,
  },
  pinnedAnnouncement: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: BorderRadius.md,
    backgroundColor: '#F5F2FF',
  },
  pinnedAnnouncementExpanded: {
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  pinnedAnnouncementIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    backgroundColor: '#E9E2FF',
  },
  pinnedAnnouncementContent: {
    flex: 1,
    marginRight: 6,
  },
  pinnedAnnouncementSummary: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pinnedAnnouncementText: {
    flex: 1,
    fontSize: FontSizes.sm,
    lineHeight: 20,
    color: Colors.text,
    includeFontPadding: false,
  },
  pinnedAnnouncementDate: {
    marginLeft: 8,
    fontSize: 10,
    color: Colors.textTertiary,
  },
  pinnedAnnouncementDateExpanded: {
    marginTop: 6,
    fontSize: 10,
    color: Colors.textTertiary,
  },
  emptyChatContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyChatEmoji: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  emptyChatText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    fontWeight: FontWeights.medium,
  },
  emptyChatSubtext: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    marginTop: 4,
  },
  messageList: {
    padding: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 4,
    alignItems: 'flex-start',
  },
  messageRowMine: {
    flexDirection: 'row-reverse',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  avatarPlaceholder: {
    width: 32,
    marginRight: 8,
  },
  avatarText: {
    fontSize: 13,
    fontWeight: FontWeights.semibold,
    color: Colors.primary,
  },
  messageContent: {
    maxWidth: '75%',
  },
  senderName: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: 3,
    marginLeft: 4,
  },
  messageBubble: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    borderTopLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...Shadows.small,
  },
  messageBubbleMine: {
    backgroundColor: Colors.primary,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 4,
  },
  messageText: {
    fontSize: FontSizes.md,
    color: Colors.text,
    lineHeight: 20,
  },
  messageTextMine: {
    color: Colors.card,
  },
  messageImage: {
    width: 220,
    height: 220,
    borderRadius: BorderRadius.md,
    marginBottom: 6,
  },
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,.62)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  imageViewerPopup: {
    backgroundColor: '#111114',
    borderRadius: 24,
    overflow: 'hidden',
    ...Shadows.large,
  },
  imageViewerHeader: {
    height: 58,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  imageViewerClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageViewerCount: {
    color: '#FFFFFF',
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
  },
  imageViewerHeaderSpacer: {
    width: 36,
  },
  imageViewerList: {
    flex: 1,
  },
  imageViewerPage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageViewerMeta: {
    maxWidth: '82%',
    color: 'rgba(255,255,255,.72)',
    fontSize: FontSizes.sm,
    marginTop: 4,
  },
  imageViewerHint: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  imageViewerHintText: {
    color: 'rgba(255,255,255,.72)',
    fontSize: FontSizes.sm,
  },
  messageTime: {
    fontSize: 10,
    color: Colors.textTertiary,
    marginTop: 4,
    marginLeft: 4,
  },
  messageTimeMine: {
    textAlign: 'right',
    marginRight: 4,
    marginLeft: 0,
  },
  systemMessage: {
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  systemMessageBox: {
    backgroundColor: Colors.accentLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    maxWidth: '85%',
    alignSelf: 'center',
  },
  systemMessageText: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
    textAlign: 'left',
    lineHeight: 21,
    includeFontPadding: false,
  },
  announcementMessage: {
    width: '100%',
    paddingHorizontal: 12,
    alignItems: 'stretch',
  },
  announcementMessageBox: {
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    backgroundColor: '#F5F2FF',
  },
  announcementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  announcementIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    backgroundColor: '#E9E2FF',
  },
  announcementLabel: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    color: Colors.text,
  },
  announcementMessageText: {
    color: Colors.text,
    lineHeight: 22,
  },
  emojiPicker: {
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingVertical: Spacing.sm,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  emojiButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiText: {
    fontSize: 24,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 8,
  },
  emojiToggle: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageToggle: {
    width: 36,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiToggleText: {
    fontSize: 24,
  },
  inputWrapper: {
    flex: 1,
  },
  messageInput: {
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: FontSizes.md,
    color: Colors.text,
    maxHeight: 100,
    minHeight: 40,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: Colors.textTertiary,
  },
  sendBtnText: {
    fontSize: FontSizes.sm,
    color: Colors.card,
    fontWeight: FontWeights.semibold,
  },
  joinBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  joinText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  joinBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  joinBtnText: {
    fontSize: FontSizes.sm,
    color: Colors.card,
    fontWeight: FontWeights.semibold,
  },
  infoContainer: {
    flex: 1,
    padding: Spacing.md,
  },
  infoCard: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  infoEmojiBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  infoEmoji: {
    fontSize: 24,
  },
  infoHeaderText: {
    flex: 1,
  },
  infoTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    color: Colors.text,
  },
  infoCreator: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  infoDescription: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  infoStats: {
    gap: Spacing.sm,
  },
  infoStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoStatIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  infoStatText: {
    fontSize: FontSizes.sm,
    color: Colors.text,
  },
  participantsSection: {
    flex: 1,
  },
  participantsHeadingRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
    paddingHorizontal: 4,
  },
  participantsTitle: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: Colors.text,
  },
  inviteFriendsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.accentLight,
  },
  inviteFriendsButtonDisabled: {
    backgroundColor: Colors.border,
  },
  inviteFriendsButtonText: {
    color: Colors.primary,
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.semibold,
  },
  inviteFriendsButtonTextDisabled: {
    color: Colors.textTertiary,
  },
  participantsList: {
    gap: 4,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
  },
  participantAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  ownerAvatar: {
    backgroundColor: Colors.warning,
  },
  participantAvatarText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    color: Colors.primary,
  },
  participantInfo: {
    flex: 1,
  },
  participantNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  participantName: {
    fontSize: FontSizes.md,
    color: Colors.text,
    fontWeight: FontWeights.medium,
  },
  blockedBadge: {
    fontSize: 10,
    color: Colors.error,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
    overflow: 'hidden',
  },
  blockButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: '#FEE2E2',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  unblockButton: {
    backgroundColor: Colors.background,
    borderColor: Colors.border,
  },
  blockButtonText: {
    fontSize: FontSizes.xs,
    color: Colors.error,
    fontWeight: FontWeights.medium,
  },
  unblockButtonText: {
    color: Colors.textSecondary,
  },
  participantRole: {
    fontSize: 11,
    color: Colors.warning,
    fontWeight: FontWeights.medium,
  },
  settingsContainer: {
    flex: 1,
    padding: Spacing.md,
  },
  settingsCard: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  settingsTitle: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: FontSizes.md,
    color: Colors.text,
    fontWeight: FontWeights.medium,
  },
  settingDesc: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  welcomeInputContainer: {
    marginTop: Spacing.md,
  },
  welcomeInput: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSizes.sm,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  announcementBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  announcementBtnText: {
    fontSize: FontSizes.sm,
    color: Colors.card,
    fontWeight: FontWeights.semibold,
  },
  announcementSectionHeader: {
    marginBottom: Spacing.md,
  },
  announcementSectionDesc: {
    marginTop: -Spacing.sm,
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  announcementLoader: {
    marginVertical: Spacing.lg,
  },
  announcementEmpty: {
    minHeight: 92,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
  },
  announcementEmptyText: {
    marginTop: Spacing.xs,
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  announcementList: {
    gap: Spacing.sm,
  },
  announcementListItem: {
    padding: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  announcementListContent: {
    fontSize: FontSizes.sm,
    lineHeight: 21,
    color: Colors.text,
  },
  announcementListFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  announcementListDate: {
    flex: 1,
    fontSize: 11,
    color: Colors.textTertiary,
  },
  announcementActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  announcementActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 5,
  },
  announcementEditText: {
    fontSize: FontSizes.xs,
    color: Colors.primary,
    fontWeight: FontWeights.semibold,
  },
  announcementDeleteText: {
    fontSize: FontSizes.xs,
    color: Colors.error,
    fontWeight: FontWeights.semibold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  inviteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  inviteModalSheet: {
    maxHeight: '72%',
    minHeight: 360,
    paddingTop: 10,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  inviteModalHandle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: Spacing.md,
    backgroundColor: Colors.border,
  },
  inviteModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  inviteModalTitle: {
    color: Colors.text,
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
  },
  inviteModalDescription: {
    color: Colors.textSecondary,
    fontSize: FontSizes.xs,
    marginTop: 4,
  },
  inviteModalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  inviteModalLoader: {
    marginTop: 80,
  },
  inviteEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 72,
    gap: Spacing.sm,
  },
  inviteEmptyText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
  },
  inviteFriendList: {
    flexGrow: 0,
  },
  inviteFriendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  inviteFriendAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteFriendEmoji: {
    fontSize: 22,
    color: Colors.text,
    fontWeight: FontWeights.semibold,
  },
  inviteFriendInfo: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  inviteFriendName: {
    color: Colors.text,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
  },
  inviteFriendStatus: {
    color: Colors.textTertiary,
    fontSize: FontSizes.xs,
    marginTop: 3,
  },
  inviteFriendAction: {
    minWidth: 62,
    minHeight: 38,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: Colors.primary,
  },
  inviteFriendActionText: {
    color: Colors.card,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  modalInput: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSizes.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeights.medium,
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  modalConfirmBtnDisabled: {
    backgroundColor: Colors.textTertiary,
  },
  modalConfirmText: {
    fontSize: FontSizes.sm,
    color: Colors.card,
    fontWeight: FontWeights.semibold,
  },
});
