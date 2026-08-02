import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Agreement, User, AgreementCategory } from '../types';
import { apiService } from '../services/api';
import { DataStore } from '../store/dataStore';

const USE_API = true;

interface AvatarSettings {
  type: 'emoji' | 'photo';
  emoji: string;
  color: string;
  photoUri?: string;
}

interface AppContextType {
  user: User | null;
  currentUser: User | null;
  isSessionRestoring: boolean;
  isOnboarded: boolean;
  agreements: Agreement[];
  isLoading: boolean;
  error: string | null;
  avatarSettings: AvatarSettings | null;
  dailyPhotos: string[];
  unreadNotificationCount: number;
  signUp: (nickname: string, password: string, email: string, nationality: 'KR' | 'JP' | 'OTHER', gender: 'MALE' | 'FEMALE', age: number) => Promise<void>;
  login: (nickname: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserNickname: (newNickname: string) => Promise<void>;
  updateUserBio: (bio: string) => Promise<void>;
  updateUserEmail: (email: string) => Promise<void>;
  updateUserProfilePicture: (profilePictureData: string | null) => Promise<void>;
  updateUserNationality: (nationality: 'KR' | 'JP' | 'OTHER') => Promise<void>;
  completeOnboarding: () => void;
  refreshAgreements: (forceRefresh?: boolean) => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
  updateAvatarSettings: (settings: Partial<AvatarSettings>) => Promise<void>;
  addDailyPhoto: (photoUri: string) => Promise<boolean>;
  removeDailyPhoto: (index: number) => Promise<void>;
  createAgreement: (
    title: string,
    description: string,
    category: AgreementCategory,
    emoji: string,
    customCategoryName: string | null,
    dateTime: Date | null,
    scheduleType: 'POINT' | 'RANGE',
    endDateTime: Date | null,
    participants: string[]
  ) => Promise<Agreement>;
  updateParticipantStatus: (
    agreementId: string,
    status: 'agreed' | 'declined' | 'skipped'
  ) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const MAX_DAILY_PHOTOS = 20;
const SESSION_USER_KEY = '@plantalk_session_user';

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(DataStore.getCurrentUser());
  const [isSessionRestoring, setIsSessionRestoring] = useState(true);
  const [isOnboarded, setIsOnboarded] = useState(DataStore.isOnboarded());
  const [agreements, setAgreements] = useState<Agreement[]>(DataStore.getAgreements());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarSettings, setAvatarSettings] = useState<AvatarSettings | null>(null);
  const [dailyPhotos, setDailyPhotos] = useState<string[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  
  // 중복 API 호출 방지를 위한 ref
  const isRefreshingAgreements = useRef(false);
  const lastAgreementsFetch = useRef<number>(0);
  const CACHE_DURATION = 30000; // 30초

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedUser = await AsyncStorage.getItem(SESSION_USER_KEY);
        if (savedUser) {
          const parsedUser = JSON.parse(savedUser);
          const restoredUser: User = {
            ...parsedUser,
            createdAt: new Date(parsedUser.createdAt),
          };
          setUserState(restoredUser);
          DataStore.setOnboarded(true);
          setIsOnboarded(true);
        }

        const savedAvatar = await AsyncStorage.getItem('avatarSettings');
        if (savedAvatar) {
          const parsed = JSON.parse(savedAvatar);
          if (!parsed.type) {
            parsed.type = 'emoji';
          }
          setAvatarSettings(parsed);
        }

        const savedPhotos = await AsyncStorage.getItem('dailyPhotos');
        if (savedPhotos) {
          setDailyPhotos(JSON.parse(savedPhotos));
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setIsSessionRestoring(false);
      }
    };
    loadSettings();
  }, []);

  const persistUser = useCallback(async (authenticatedUser: User) => {
    setUserState(authenticatedUser);
    DataStore.setOnboarded(true);
    setIsOnboarded(true);
    await AsyncStorage.setItem(SESSION_USER_KEY, JSON.stringify(authenticatedUser));
  }, []);

  useEffect(() => {
    if (!isSessionRestoring && user) {
      AsyncStorage.setItem(SESSION_USER_KEY, JSON.stringify(user)).catch((err) => {
        console.error('Failed to persist user session:', err);
      });
    }
  }, [isSessionRestoring, user]);

  useEffect(() => {
    if (
      isSessionRestoring
      || !user
      || !avatarSettings?.emoji
      || (
        user.avatarEmoji === avatarSettings.emoji
        && user.avatarColor === avatarSettings.color
      )
    ) {
      return;
    }

    apiService.updateAvatar(
      user.id,
      avatarSettings.emoji,
      avatarSettings.color || ''
    )
      .then(persistUser)
      .catch((err) => {
        console.error('Failed to migrate local avatar settings:', err);
      });
  }, [avatarSettings, isSessionRestoring, persistUser, user]);

  const updateAvatarSettings = useCallback(async (newSettings: Partial<AvatarSettings>) => {
    const current = avatarSettings || { type: 'emoji', emoji: '', color: '' };
    const updated = { ...current, ...newSettings };
    if (user) {
      const updatedUser = await apiService.updateAvatar(
        user.id,
        updated.emoji || '',
        updated.color || ''
      );
      await persistUser(updatedUser);
    }
    setAvatarSettings(updated);
    try {
      await AsyncStorage.setItem('avatarSettings', JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to save avatar settings:', err);
    }
  }, [avatarSettings, persistUser, user]);

  const addDailyPhoto = useCallback(async (photoUri: string): Promise<boolean> => {
    if (dailyPhotos.length >= MAX_DAILY_PHOTOS) {
      return false;
    }
    const updated = [...dailyPhotos, photoUri];
    setDailyPhotos(updated);
    try {
      await AsyncStorage.setItem('dailyPhotos', JSON.stringify(updated));
      return true;
    } catch (err) {
      console.error('Failed to save daily photos:', err);
      return false;
    }
  }, [dailyPhotos]);

  const removeDailyPhoto = useCallback(async (index: number) => {
    const updated = dailyPhotos.filter((_, i) => i !== index);
    setDailyPhotos(updated);
    try {
      await AsyncStorage.setItem('dailyPhotos', JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to save daily photos:', err);
    }
  }, [dailyPhotos]);

  const refreshUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const count = await apiService.getUnreadNotificationCount(user.id);
      setUnreadNotificationCount(count);
    } catch (err) {
      console.error('Failed to fetch unread notification count:', err);
    }
  }, [user]);

  useEffect(() => {
    if (user && USE_API) {
      refreshUnreadCount();
    }
  }, [user, refreshUnreadCount]);

  useEffect(() => {
    if (!user || !USE_API) return;
    const sendHeartbeat = () => apiService.heartbeat(user.id).catch((err) => {
      console.warn('Failed to update online status:', err);
    });
    sendHeartbeat();
    const timer = setInterval(sendHeartbeat, 60000);
    return () => clearInterval(timer);
  }, [user]);

  useEffect(() => {
    if (user && USE_API) {
      const fetchAgreements = async () => {
        try {
          const fetchedAgreements = await apiService.getUserAgreements(user.nickname);
          setAgreements(fetchedAgreements);
        } catch (err) {
          console.error('Failed to fetch user agreements:', err);
        }
      };
      fetchAgreements();
    }
  }, [user]);

  const signUp = useCallback(async (nickname: string, password: string, email: string, nationality: 'KR' | 'JP' | 'OTHER', gender: 'MALE' | 'FEMALE', age: number) => {
    setIsLoading(true);
    setError(null);
    try {
      if (USE_API) {
        const newUser = await apiService.createUser(nickname, password, email, nationality, gender, age);
        await persistUser(newUser);
      } else {
        const newUser = DataStore.setCurrentUser(nickname);
        await persistUser(newUser);
        DataStore.loadMockData();
        setAgreements(DataStore.getAgreements());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '회원가입 실패');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [persistUser]);

  const login = useCallback(async (nickname: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      if (USE_API) {
        const existingUser = await apiService.login(nickname, password);
        await persistUser(existingUser);
      } else {
        const newUser = DataStore.setCurrentUser(nickname);
        await persistUser(newUser);
        DataStore.loadMockData();
        setAgreements(DataStore.getAgreements());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인 실패');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [persistUser]);

  const logout = useCallback(async () => {
    await AsyncStorage.multiRemove([SESSION_USER_KEY, 'avatarSettings', 'dailyPhotos']);
    DataStore.clearCurrentUser();
    DataStore.setOnboarded(false);
    setUserState(null);
    setIsOnboarded(false);
    setAgreements([]);
    setAvatarSettings(null);
    setDailyPhotos([]);
    setUnreadNotificationCount(0);
    setError(null);
  }, []);

  const updateUserNickname = useCallback(async (newNickname: string) => {
    if (!user) throw new Error('User not logged in');
    
    setIsLoading(true);
    setError(null);
    try {
      if (USE_API) {
        const updatedUser = await apiService.updateNickname(user.id, newNickname);
        await persistUser(updatedUser);
        // 닉네임 변경 후 참여자 표시도 즉시 갱신한다.
        await refreshAgreements(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '닉네임 변경 실패');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [user, persistUser]);

  const updateUserBio = useCallback(async (bio: string) => {
    if (!user) throw new Error('User not logged in');
    
    setIsLoading(true);
    setError(null);
    try {
      if (USE_API) {
        const updatedUser = await apiService.updateBio(user.id, bio);
        await persistUser(updatedUser);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '자기소개 저장 실패');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [user, persistUser]);

  const updateUserEmail = useCallback(async (email: string) => {
    if (!user) throw new Error('User not logged in');

    setIsLoading(true);
    setError(null);
    try {
      if (USE_API) {
        const updatedUser = await apiService.updateEmail(user.id, email);
        await persistUser(updatedUser);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '이메일 저장 실패');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [user, persistUser]);

  const updateUserProfilePicture = useCallback(async (profilePictureData: string | null) => {
    if (!user) throw new Error('User not logged in');

    setIsLoading(true);
    setError(null);
    try {
      if (USE_API) {
        const updatedUser = await apiService.updateProfilePicture(user.id, profilePictureData);
        await persistUser(updatedUser);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '프로필 사진 저장 실패');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [user, persistUser]);

  const updateUserNationality = useCallback(async (nationality: 'KR' | 'JP' | 'OTHER') => {
    if (!user) throw new Error('User not logged in');
    const updatedUser = USE_API
      ? await apiService.updateNationality(user.id, nationality)
      : { ...user, nationality };
    await persistUser(updatedUser);
  }, [user, persistUser]);

  const completeOnboarding = useCallback(() => {
    DataStore.setOnboarded(true);
    setIsOnboarded(true);
  }, []);

  const refreshAgreements = useCallback(async (forceRefresh = false) => {
    if (!user) return;
    
    // 중복 호출 방지
    if (isRefreshingAgreements.current) return;
    
    // 캐시 확인 (강제 새로고침이 아닌 경우)
    const now = Date.now();
    if (!forceRefresh && (now - lastAgreementsFetch.current) < CACHE_DURATION) {
      return;
    }
    
    isRefreshingAgreements.current = true;
    setIsLoading(true);
    setError(null);
    try {
      if (USE_API) {
        const fetchedAgreements = await apiService.getUserAgreements(user.nickname);
        setAgreements(fetchedAgreements);
        lastAgreementsFetch.current = now;
      } else {
        setAgreements([...DataStore.getAgreements()]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '약속 목록 불러오기 실패');
    } finally {
      setIsLoading(false);
      isRefreshingAgreements.current = false;
    }
  }, [user]);

  const createAgreement = useCallback(async (
    title: string,
    description: string,
    category: AgreementCategory,
    emoji: string,
    customCategoryName: string | null,
    dateTime: Date | null,
    scheduleType: 'POINT' | 'RANGE',
    endDateTime: Date | null,
    participants: string[]
  ): Promise<Agreement> => {
    if (!user) throw new Error('User not logged in');
    
    setIsLoading(true);
    setError(null);
    try {
      let agreement: Agreement;
      if (USE_API) {
        agreement = await apiService.createAgreement(
          title,
          description,
          category,
          emoji,
          customCategoryName,
          dateTime,
          scheduleType,
          endDateTime,
          user.id,
          participants
        );
        // 생성 직후 캐시 여부와 관계없이 초대/참여 상태를 즉시 반영한다.
        await refreshAgreements(true);
      } else {
        agreement = DataStore.createAgreement(
          title,
          description,
          category,
          emoji,
          customCategoryName,
          dateTime,
          scheduleType,
          endDateTime,
          participants
        );
        setAgreements([...DataStore.getAgreements()]);
      }
      return agreement;
    } catch (err) {
      setError(err instanceof Error ? err.message : '약속 생성 실패');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [user, refreshAgreements]);

  const updateParticipantStatus = useCallback(async (
    agreementId: string,
    status: 'agreed' | 'declined' | 'skipped'
  ) => {
    if (!user) return;
    
    setIsLoading(true);
    setError(null);
    try {
      if (USE_API) {
        await apiService.updateParticipantStatus(agreementId, user.nickname, status);
        // 수락·거절 직후 대기 목록과 참여 목록을 즉시 갱신한다.
        await refreshAgreements(true);
      } else {
        DataStore.updateParticipantStatus(agreementId, status);
        setAgreements([...DataStore.getAgreements()]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '상태 업데이트 실패');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [user, refreshAgreements]);

  return (
    <AppContext.Provider
      value={{
        user,
        currentUser: user,
        isSessionRestoring,
        isOnboarded,
        agreements,
        isLoading,
        error,
        avatarSettings,
        dailyPhotos,
        unreadNotificationCount,
        signUp,
        login,
        logout,
        updateUserNickname,
        updateUserBio,
        updateUserEmail,
        updateUserProfilePicture,
        updateUserNationality,
        completeOnboarding,
        refreshAgreements,
        refreshUnreadCount,
        updateAvatarSettings,
        addDailyPhoto,
        removeDailyPhoto,
        createAgreement,
        updateParticipantStatus,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
