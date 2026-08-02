import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Notification, RoomMessage } from '../types';
import { apiService, API_BASE_URL } from '../services/api';
import { useApp } from './AppContext';

interface NotificationContextType {
  showToast: (notification: Notification) => void;
  hideToast: () => void;
  currentToast: Notification | null;
  subscribeToRoom: (roomId: string) => void;
  unsubscribeFromRoom: (roomId: string) => void;
  currentRoomId: string | null;
  setCurrentRoomId: (roomId: string | null) => void;
  realtimeEvent: RealtimeAppEvent | null;
}

export interface RealtimeAppEvent {
  type: 'FRIENDS' | 'AGREEMENTS' | 'ROOM_LIST' | 'ROOM_MEMBERS';
  roomId?: string;
  occurredAt?: string;
  sequence: number;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { currentUser, refreshUnreadCount } = useApp();
  const [currentToast, setCurrentToast] = useState<Notification | null>(null);
  const [currentRoomId, setCurrentRoomIdState] = useState<string | null>(null);
  const [subscribedRooms, setSubscribedRooms] = useState<Set<string>>(new Set());
  const [isConnected, setIsConnected] = useState(false);
  const [realtimeEvent, setRealtimeEvent] = useState<RealtimeAppEvent | null>(null);
  const stompClientRef = useRef<Client | null>(null);
  const subscriptionsRef = useRef<Map<string, any>>(new Map());
  const currentRoomIdRef = useRef<string | null>(null);
  const currentUserRef = useRef(currentUser);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const setCurrentRoomId = useCallback((roomId: string | null) => {
    currentRoomIdRef.current = roomId;
    setCurrentRoomIdState(roomId);
  }, []);

  const showToast = useCallback((notification: Notification) => {
    setCurrentToast(notification);
  }, []);

  const hideToast = useCallback(() => {
    setCurrentToast(null);
  }, []);

  const doSubscribe = useCallback((client: Client, roomId: string) => {
    if (!client.connected || subscriptionsRef.current.has(roomId)) return;

    const subscription = client.subscribe(`/topic/rooms/${roomId}`, (message) => {
      try {
        const roomMessage: RoomMessage = JSON.parse(message.body);

        if (roomMessage.deleted || roomMessage.editedAt) return;
        
        if (roomMessage.senderId === currentUserRef.current?.id) return;
        
        if (currentRoomIdRef.current === roomId) return;
        
        const notification: Notification = {
          id: `toast-${Date.now()}`,
          userId: currentUserRef.current?.id || '',
          type: 'ROOM_MESSAGE',
          title: `💬 ${roomMessage.senderName}`,
          message: roomMessage.content,
          referenceId: roomId,
          referenceType: 'ROOM',
          senderName: roomMessage.senderName,
          senderId: roomMessage.senderId,
          senderProfilePictureUrl: null,
          isRead: false,
          createdAt: roomMessage.createdAt,
          readAt: null,
        };
        
        setCurrentToast(notification);
        refreshUnreadCount?.();
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    });

    subscriptionsRef.current.set(roomId, subscription);
  }, [refreshUnreadCount]);

  useEffect(() => {
    if (!currentUser) return;

    const loadUserRooms = async () => {
      try {
        const userRooms = await apiService.getUserRooms(currentUser.id);
        const joinedRoomIds = userRooms.joined
          .filter(p => p.status === 'JOINED')
          .map(p => p.roomId);
        
        setSubscribedRooms(new Set(joinedRoomIds));
      } catch (error) {
        console.log('Failed to load user rooms for notifications:', error);
      }
    };

    loadUserRooms();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    const client = new Client({
      webSocketFactory: () => new SockJS(`${API_BASE_URL}/ws`),
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      debug: () => {},
    });

    client.onConnect = () => {
      console.log('Global WebSocket Connected for notifications');
      setIsConnected(true);

      const notificationSubscription = client.subscribe(
        `/topic/notifications/${currentUser.id}`,
        (message) => {
          try {
            const notification = JSON.parse(message.body) as Notification;
            if (notification.type === 'ROOM_MESSAGE' || notification.type === 'ROOM_ANNOUNCEMENT') {
              refreshUnreadCount?.();
              return;
            }
            setCurrentToast(notification);
            refreshUnreadCount?.();
          } catch (error) {
            console.error('Failed to parse notification:', error);
          }
        }
      );
      subscriptionsRef.current.set('__notifications__', notificationSubscription);

      const appEventSubscription = client.subscribe('/topic/app-events', (message) => {
        try {
          const event = JSON.parse(message.body) as Omit<RealtimeAppEvent, 'sequence'>;
          setRealtimeEvent({ ...event, sequence: Date.now() });
        } catch (error) {
          console.error('Failed to parse realtime app event:', error);
        }
      });
      subscriptionsRef.current.set('__app_events__', appEventSubscription);
      
      subscribedRooms.forEach(roomId => {
        doSubscribe(client, roomId);
      });
    };

    client.onDisconnect = () => {
      console.log('Global WebSocket Disconnected');
      setIsConnected(false);
    };

    client.activate();
    stompClientRef.current = client;

    return () => {
      subscriptionsRef.current.forEach((sub) => {
        try { sub.unsubscribe(); } catch (e) {}
      });
      subscriptionsRef.current.clear();
      if (client.active) {
        client.deactivate();
      }
    };
  }, [currentUser, doSubscribe]);

  useEffect(() => {
    const client = stompClientRef.current;
    if (!client?.connected || !isConnected) return;

    subscribedRooms.forEach(roomId => {
      if (!subscriptionsRef.current.has(roomId)) {
        doSubscribe(client, roomId);
      }
    });
  }, [subscribedRooms, isConnected, doSubscribe]);

  const subscribeToRoom = useCallback((roomId: string) => {
    setSubscribedRooms(prev => new Set(prev).add(roomId));
    
    if (stompClientRef.current?.connected) {
      doSubscribe(stompClientRef.current, roomId);
    }
  }, [doSubscribe]);

  const unsubscribeFromRoom = useCallback((roomId: string) => {
    const subscription = subscriptionsRef.current.get(roomId);
    if (subscription) {
      subscription.unsubscribe();
      subscriptionsRef.current.delete(roomId);
    }
    setSubscribedRooms(prev => {
      const next = new Set(prev);
      next.delete(roomId);
      return next;
    });
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        showToast,
        hideToast,
        currentToast,
        subscribeToRoom,
        unsubscribeFromRoom,
        currentRoomId,
        setCurrentRoomId,
        realtimeEvent,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
}
