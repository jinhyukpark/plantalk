import { 
  Agreement, AgreementCategory, ParticipantStatus, User,
  Room, RoomParticipant, RoomMessage, 
  SubscriptionPlanInfo, SubscriptionStatusResponse, Subscription,
  Notification, Friendship, DirectMessage, DiscoverUser
} from '../types';

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

if (!configuredApiBaseUrl) {
  throw new Error('EXPO_PUBLIC_API_URL이 설정되지 않았습니다. .env.local에서 백엔드 주소를 지정해주세요.');
}

export const API_BASE_URL = configuredApiBaseUrl.replace(/\/+$/, '');

interface UserDto {
  id: string;
  nickname: string;
  bio?: string;
  profilePictureUrl?: string;
  avatarEmoji?: string;
  avatarColor?: string;
  email?: string;
  nationality?: 'KR' | 'JP' | 'OTHER';
  gender?: 'MALE' | 'FEMALE';
  age?: number;
  createdAt: string;
}

interface ParticipantDto {
  id: string;
  agreementId: string;
  userName: string;
  status: string;
  updatedAt: string | null;
}

interface AgreementDto {
  id: string;
  title: string;
  description: string;
  emoji: string;
  category: string;
  customCategoryName?: string | null;
  status: string;
  dateTime: string | null;
  scheduleType?: 'POINT' | 'RANGE';
  endDateTime?: string | null;
  creatorId: string;
  creatorName: string;
  participants: ParticipantDto[];
  createdAt: string;
}

interface StatsDto {
  total: number;
  completed: number;
  declined: number;
  created: number;
  agreed: number;
}

export interface UserPhotoData {
  id: string;
  userId: string;
  photoUrl: string;
  caption: string | null;
  displayOrder: number;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  nickname: string;
  bio: string;
  profilePictureUrl: string | null;
  avatarEmoji?: string | null;
  avatarColor?: string | null;
  createdAt: Date;
  participatingCount: number;
  completedCount: number;
  followerCount: number;
  followingCount: number;
  online: boolean;
  photos: UserPhotoData[];
}

const toUser = (dto: UserDto): User => ({
  id: dto.id,
  nickname: dto.nickname,
  bio: dto.bio,
  profilePictureUrl: dto.profilePictureUrl,
  avatarEmoji: dto.avatarEmoji,
  avatarColor: dto.avatarColor,
  email: dto.email,
  nationality: dto.nationality || 'KR',
  gender: dto.gender,
  age: dto.age,
  createdAt: new Date(dto.createdAt),
});

const imagePartFromUri = (uri: string) => {
  const cleanUri = uri.split('?')[0];
  const extension = cleanUri.split('.').pop()?.toLowerCase();
  const type = extension === 'png'
    ? 'image/png'
    : extension === 'webp'
      ? 'image/webp'
      : 'image/jpeg';

  return {
    uri,
    name: `image-${Date.now()}.${type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'}`,
    type,
  };
};

const toParticipantStatus = (dto: ParticipantDto): ParticipantStatus => ({
  id: dto.id,
  agreementId: dto.agreementId,
  userName: dto.userName,
  status: dto.status as 'waiting' | 'agreed' | 'declined' | 'skipped',
  updatedAt: dto.updatedAt ? new Date(dto.updatedAt) : null,
});

const toAgreement = (dto: AgreementDto): Agreement => ({
  id: dto.id,
  title: dto.title,
  description: dto.description,
  emoji: dto.emoji,
  category: dto.category as AgreementCategory,
  customCategoryName: dto.customCategoryName || null,
  status: dto.status as 'PENDING' | 'IN_PROGRESS' | 'COMPLETED',
  dateTime: dto.dateTime ? new Date(dto.dateTime) : null,
  scheduleType: dto.scheduleType || 'POINT',
  endDateTime: dto.endDateTime ? new Date(dto.endDateTime) : null,
  creatorId: dto.creatorId,
  creatorName: dto.creatorName,
  participants: dto.participants.map(toParticipantStatus),
  createdAt: new Date(dto.createdAt),
});

class ApiService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}/api/v1${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = errorText;
      try {
        const parsed = JSON.parse(errorText) as { message?: string; error?: string };
        errorMessage = parsed.message || parsed.error || errorText;
      } catch {
        // Plain-text server errors are already suitable for display.
      }
      throw new Error(`API Error: ${response.status} - ${errorMessage}`);
    }

    return response.json();
  }

  async checkNicknameAvailable(nickname: string): Promise<boolean> {
    try {
      const result = await this.request<{ available: boolean }>(`/users/check-nickname?nickname=${encodeURIComponent(nickname)}`);
      return result.available;
    } catch (error) {
      return false;
    }
  }

  async getUsageGuide(language: 'ko' | 'en' | 'ja'): Promise<string> {
    const result = await this.request<{ content: string }>(
      `/content/usage-guide?lang=${encodeURIComponent(language)}`
    );
    return result.content;
  }

  async createUser(nickname: string, password: string, email: string, nationality: 'KR' | 'JP' | 'OTHER', gender: 'MALE' | 'FEMALE', age: number): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/api/v1/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, password, email, nationality, gender, age }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || '회원가입에 실패했습니다');
    }

    const dto = await response.json();
    return toUser(dto);
  }

  async login(nickname: string, password: string): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/api/v1/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, password }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || '로그인에 실패했습니다');
    }

    const dto = await response.json();
    return toUser(dto);
  }

  async updateNickname(userId: string, newNickname: string): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/api/v1/users/nickname`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, newNickname }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || '닉네임 변경에 실패했습니다');
    }

    const dto = await response.json();
    return toUser(dto);
  }

  async updateBio(userId: string, bio: string): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/api/v1/users/${userId}/bio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bio }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || '자기소개 저장에 실패했습니다');
    }

    const dto = await response.json();
    return toUser(dto);
  }

  async updateNationality(userId: string, nationality: 'KR' | 'JP' | 'OTHER'): Promise<User> {
    const dto = await this.request<UserDto>(`/users/${userId}/nationality`, {
      method: 'PUT',
      body: JSON.stringify({ nationality }),
    });
    return toUser(dto);
  }

  async updateProfilePicture(userId: string, photoUri: string | null): Promise<User> {
    const formData = new FormData();
    if (photoUri) {
      formData.append('file', imagePartFromUri(photoUri) as unknown as Blob);
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/users/${userId}/profile-picture`, {
      method: photoUri ? 'PUT' : 'DELETE',
      body: photoUri ? formData : undefined,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || '프로필 사진 저장에 실패했습니다');
    }

    const dto = await response.json();
    return toUser(dto);
  }

  async updateAvatar(userId: string, emoji: string, color: string): Promise<User> {
    const dto = await this.request<UserDto>(`/users/${userId}/avatar`, {
      method: 'PUT',
      body: JSON.stringify({ emoji, color }),
    });
    return toUser(dto);
  }

  async updateEmail(userId: string, email: string): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/api/v1/users/${userId}/email`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || '이메일 저장에 실패했습니다');
    }

    const dto = await response.json();
    return toUser(dto);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/v1/users/${userId}/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || '비밀번호 변경에 실패했습니다');
    }
  }

  async findId(email: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/api/v1/users/find-id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || '요청에 실패했습니다');
    }

    return response.json();
  }

  async requestPasswordReset(nickname: string, email: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/api/v1/users/password-reset/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, email }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || '요청에 실패했습니다');
    }

    return response.json();
  }

  async confirmPasswordReset(nickname: string, email: string, code: string, newPassword: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/v1/users/password-reset/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, email, code, newPassword }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || '비밀번호 재설정에 실패했습니다');
    }
  }

  async getUserById(id: string): Promise<User | null> {
    try {
      const dto = await this.request<UserDto>(`/users/${id}`);
      return toUser(dto);
    } catch (error) {
      return null;
    }
  }

  async getUserByNickname(nickname: string): Promise<User | null> {
    try {
      const dto = await this.request<UserDto>(`/users/nickname/${encodeURIComponent(nickname)}`);
      return toUser(dto);
    } catch (error) {
      return null;
    }
  }

  async getUserProfile(nickname: string): Promise<UserProfile | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/users/nickname/${encodeURIComponent(nickname)}/profile`);
      if (!response.ok) return null;
      const dto = await response.json();
      return {
        id: dto.id,
        nickname: dto.nickname,
        bio: dto.bio || '',
        profilePictureUrl: dto.profilePictureUrl || null,
        avatarEmoji: dto.avatarEmoji || null,
        avatarColor: dto.avatarColor || null,
        createdAt: new Date(dto.createdAt),
        participatingCount: dto.participatingCount || 0,
        completedCount: dto.completedCount || 0,
        followerCount: dto.followerCount || 0,
        followingCount: dto.followingCount || 0,
        online: Boolean(dto.online),
        photos: dto.photos || [],
      };
    } catch (error) {
      console.error('Failed to get user profile:', error);
      return null;
    }
  }

  async getUserPhotos(userId: string): Promise<UserPhotoData[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/users/${userId}/photos`);
      if (!response.ok) return [];
      return await response.json();
    } catch (error) {
      console.error('Failed to get user photos:', error);
      return [];
    }
  }

  async addUserPhoto(userId: string, photoUri: string, caption?: string): Promise<UserPhotoData> {
    const formData = new FormData();
    formData.append('file', imagePartFromUri(photoUri) as unknown as Blob);
    if (caption) {
      formData.append('caption', caption);
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/users/${userId}/photos`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || '사진 추가에 실패했습니다');
    }

    return await response.json();
  }

  async deleteUserPhoto(userId: string, photoId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/v1/users/${userId}/photos/${photoId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || '사진 삭제에 실패했습니다');
    }
  }

  async uploadRoomImage(roomId: string, photoUri: string): Promise<string> {
    const formData = new FormData();
    formData.append('file', imagePartFromUri(photoUri) as unknown as Blob);
    const response = await fetch(`${API_BASE_URL}/api/v1/images/rooms/${roomId}`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || '채팅 이미지 업로드에 실패했습니다');
    }

    const result = await response.json();
    return result.url;
  }

  async getAllAgreements(): Promise<Agreement[]> {
    const dtos = await this.request<AgreementDto[]>('/agreements');
    return dtos.map(toAgreement);
  }

  async getAgreementById(id: string): Promise<Agreement | null> {
    try {
      const dto = await this.request<AgreementDto>(`/agreements/${id}`);
      return toAgreement(dto);
    } catch (error) {
      return null;
    }
  }

  async getPendingAgreements(userName: string): Promise<Agreement[]> {
    const dtos = await this.request<AgreementDto[]>(
      `/agreements?userName=${encodeURIComponent(userName)}&filter=pending`
    );
    return dtos.map(toAgreement);
  }

  async getUpcomingAgreements(userName: string): Promise<Agreement[]> {
    const dtos = await this.request<AgreementDto[]>(
      `/agreements?userName=${encodeURIComponent(userName)}&filter=upcoming`
    );
    return dtos.map(toAgreement);
  }

  async getUserAgreements(userName: string): Promise<Agreement[]> {
    const dtos = await this.request<AgreementDto[]>(
      `/agreements?userName=${encodeURIComponent(userName)}`
    );
    return dtos.map(toAgreement);
  }

  async getAgreementsByCategory(category: string): Promise<Agreement[]> {
    const dtos = await this.request<AgreementDto[]>(
      `/agreements?category=${encodeURIComponent(category)}`
    );
    return dtos.map(toAgreement);
  }

  async createAgreement(
    title: string,
    description: string,
    category: AgreementCategory,
    emoji: string,
    customCategoryName: string | null,
    dateTime: Date | null,
    scheduleType: 'POINT' | 'RANGE',
    endDateTime: Date | null,
    creatorId: string,
    participantNames: string[]
  ): Promise<Agreement> {
    const dto = await this.request<AgreementDto>('/agreements', {
      method: 'POST',
      body: JSON.stringify({
        title,
        description,
        category: category.toUpperCase(),
        emoji,
        customCategoryName,
        dateTime: dateTime?.toISOString() || null,
        scheduleType,
        endDateTime: scheduleType === 'RANGE' ? endDateTime?.toISOString() || null : null,
        creatorId,
        participantNames,
      }),
    });
    return toAgreement(dto);
  }

  async updateParticipantStatus(
    agreementId: string,
    userName: string,
    status: 'agreed' | 'declined' | 'skipped'
  ): Promise<Agreement> {
    const dto = await this.request<AgreementDto>(
      `/agreements/${agreementId}/participants`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          userName,
          status: status.toUpperCase(),
        }),
      }
    );
    return toAgreement(dto);
  }

  async getStats(userName: string): Promise<StatsDto> {
    return this.request<StatsDto>(
      `/agreements/stats?userName=${encodeURIComponent(userName)}`
    );
  }

  async getPublicRooms(
    category?: string,
    userId?: string,
    visibility: 'ALL' | 'PUBLIC' | 'PRIVATE' = 'ALL'
  ): Promise<Room[]> {
    const params = [
      category ? `category=${encodeURIComponent(category)}` : '',
      userId ? `userId=${encodeURIComponent(userId)}` : '',
      `visibility=${visibility}`,
    ].filter(Boolean).join('&');
    return this.request<Room[]>(`/rooms?${params}`);
  }

  async getRoomCounts(
    userId?: string,
    visibility: 'ALL' | 'PUBLIC' | 'PRIVATE' = 'ALL'
  ): Promise<Record<string, number>> {
    const params = [
      userId ? `userId=${encodeURIComponent(userId)}` : '',
      `visibility=${visibility}`,
    ].filter(Boolean).join('&');
    return this.request<Record<string, number>>(`/rooms/counts?${params}`);
  }

  async getNearbyRooms(latitude: number, longitude: number, radius: number = 10): Promise<Room[]> {
    return this.request<Room[]>(
      `/rooms/nearby?latitude=${latitude}&longitude=${longitude}&radius=${radius}`
    );
  }

  async getRoomById(roomId: string, userId?: string): Promise<Room | null> {
    try {
      const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
      return await this.request<Room>(`/rooms/${roomId}${query}`);
    } catch (error) {
      return null;
    }
  }

  async getUserRooms(userId: string): Promise<{ created: Room[]; joined: RoomParticipant[] }> {
    return this.request<{ created: Room[]; joined: RoomParticipant[] }>(`/rooms/user/${userId}`);
  }

  async createRoom(data: {
    title: string;
    description: string;
    category: string;
    emoji: string;
    visibility: 'PUBLIC' | 'PRIVATE';
    creatorId: string;
    creatorName: string;
    latitude?: number;
    longitude?: number;
    locationName?: string;
    startsAt?: string;
    endsAt?: string;
    maxParticipants?: number;
  }): Promise<Room> {
    return this.request<Room>('/rooms', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async joinRoom(roomId: string, userId: string, userName: string): Promise<RoomParticipant> {
    return this.request<RoomParticipant>(`/rooms/${roomId}/join`, {
      method: 'POST',
      body: JSON.stringify({ userId, userName }),
    });
  }

  async leaveRoom(roomId: string, userId: string): Promise<void> {
    await this.request<void>(`/rooms/${roomId}/leave?userId=${userId}`, {
      method: 'POST',
    });
  }

  async getRoomParticipants(roomId: string, userId?: string): Promise<RoomParticipant[]> {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    return this.request<RoomParticipant[]>(`/rooms/${roomId}/participants${query}`);
  }

  async inviteFriendToRoom(
    roomId: string,
    requesterId: string,
    friendId: string,
  ): Promise<RoomParticipant> {
    return this.request<RoomParticipant>(`/rooms/${roomId}/participants/invite`, {
      method: 'POST',
      body: JSON.stringify({ requesterId, friendId }),
    });
  }

  async getRoomMessages(roomId: string, limit: number = 50, userId?: string): Promise<RoomMessage[]> {
    const userQuery = userId ? `&userId=${encodeURIComponent(userId)}` : '';
    return this.request<RoomMessage[]>(`/rooms/${roomId}/messages?limit=${limit}${userQuery}`);
  }

  async getOlderRoomMessages(
    roomId: string,
    before: string,
    limit: number = 30,
    userId?: string,
  ): Promise<RoomMessage[]> {
    const userQuery = userId ? `&userId=${encodeURIComponent(userId)}` : '';
    return this.request<RoomMessage[]>(
      `/rooms/${roomId}/messages?limit=${limit}&before=${encodeURIComponent(before)}${userQuery}`,
    );
  }

  async sendMessage(
    roomId: string,
    senderId: string,
    senderName: string,
    content: string,
    messageType: string = 'TEXT',
    attachmentUrl?: string,
  ): Promise<RoomMessage> {
    return this.request<RoomMessage>(`/rooms/${roomId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ senderId, senderName, content, messageType, attachmentUrl }),
    });
  }

  async getRoomAnnouncements(roomId: string, userId: string): Promise<RoomMessage[]> {
    return this.request<RoomMessage[]>(
      `/rooms/${roomId}/announcements?userId=${encodeURIComponent(userId)}`
    );
  }

  async updateRoomAnnouncement(
    roomId: string,
    messageId: string,
    userId: string,
    content: string,
  ): Promise<RoomMessage> {
    return this.request<RoomMessage>(
      `/rooms/${roomId}/announcements/${messageId}?userId=${encodeURIComponent(userId)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ content }),
      }
    );
  }

  async deleteRoomAnnouncement(roomId: string, messageId: string, userId: string): Promise<void> {
    await this.request<void>(
      `/rooms/${roomId}/announcements/${messageId}?userId=${encodeURIComponent(userId)}`,
      { method: 'DELETE' }
    );
  }

  async closeRoom(roomId: string, userId: string): Promise<Room> {
    return this.request<Room>(`/rooms/${roomId}/close?userId=${userId}`, {
      method: 'POST',
    });
  }

  async getSubscriptionPlans(): Promise<SubscriptionPlanInfo[]> {
    return this.request<SubscriptionPlanInfo[]>('/subscriptions/plans');
  }

  async getSubscriptionStatus(userId: string): Promise<SubscriptionStatusResponse> {
    return this.request<SubscriptionStatusResponse>(`/subscriptions/status/${userId}`);
  }

  async getUserSubscriptions(userId: string): Promise<Subscription[]> {
    return this.request<Subscription[]>(`/subscriptions/user/${userId}`);
  }

  async purchaseSubscription(data: {
    userId: string;
    plan: string;
    platform: 'IOS' | 'ANDROID';
    productId: string;
    transactionId: string;
    receiptData: string;
  }): Promise<Subscription> {
    return this.request<Subscription>('/subscriptions/purchase', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async cancelSubscription(subscriptionId: string, userId: string): Promise<void> {
    await this.request<void>(`/subscriptions/${subscriptionId}/cancel?userId=${userId}`, {
      method: 'POST',
    });
  }

  async shouldShowAd(userId: string): Promise<boolean> {
    const result = await this.request<{ shouldShowAd: boolean }>(`/subscriptions/should-show-ad/${userId}`);
    return result.shouldShowAd;
  }

  async recordAdImpression(data: {
    userId: string;
    adType: 'VIDEO' | 'INTERSTITIAL' | 'REWARDED';
    adUnitId?: string;
    durationSeconds?: number;
    completed?: boolean;
  }): Promise<void> {
    await this.request<void>('/subscriptions/ads/impression', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async searchUsers(query: string): Promise<User[]> {
    const users = await this.request<UserDto[]>(`/users/search?q=${encodeURIComponent(query)}`);
    return users.map(toUser);
  }

  async discoverUsers(viewerId: string, page = 0, size = 40, filters: {
    onlineOnly?: boolean;
    country?: 'KR' | 'JP' | 'OTHER';
    gender?: 'MALE' | 'FEMALE';
    minAge?: number;
    maxAge?: number;
  } = {}): Promise<DiscoverUser[]> {
    const query = [
      `viewerId=${encodeURIComponent(viewerId)}`,
      `page=${page}`,
      `size=${size}`,
      filters.onlineOnly ? 'onlineOnly=true' : '',
      filters.country ? `country=${filters.country}` : '',
      filters.gender ? `gender=${filters.gender}` : '',
      filters.minAge != null ? `minAge=${filters.minAge}` : '',
      filters.maxAge != null ? `maxAge=${filters.maxAge}` : '',
    ].filter(Boolean).join('&');
    return this.request<DiscoverUser[]>(
      `/users/discover?${query}`,
    );
  }

  async addParticipantToAgreement(agreementId: string, participantName: string, requesterId: string): Promise<Agreement> {
    const dto = await this.request<AgreementDto>(`/agreements/${agreementId}/participants/add`, {
      method: 'POST',
      body: JSON.stringify({ participantName, requesterId }),
    });
    return toAgreement(dto);
  }

  async updateAgreementStatus(agreementId: string, requesterId: string, status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'): Promise<Agreement> {
    const dto = await this.request<AgreementDto>(`/agreements/${agreementId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ requesterId, status }),
    });
    return toAgreement(dto);
  }

  async updateAgreementContent(agreementId: string, requesterId: string, title?: string, description?: string): Promise<Agreement> {
    const dto = await this.request<AgreementDto>(`/agreements/${agreementId}/content`, {
      method: 'PATCH',
      body: JSON.stringify({ requesterId, title, description }),
    });
    return toAgreement(dto);
  }

  async getAgreementTimeline(agreementId: string): Promise<AgreementEvent[]> {
    return this.request<AgreementEvent[]>(`/agreements/${agreementId}/timeline`);
  }

  async getNotifications(userId: string): Promise<Notification[]> {
    const url = `${API_BASE_URL}/api/notifications/user/${userId}`;
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error('Failed to fetch notifications');
    return response.json();
  }

  async getUnreadNotifications(userId: string): Promise<Notification[]> {
    const url = `${API_BASE_URL}/api/notifications/user/${userId}/unread`;
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error('Failed to fetch unread notifications');
    return response.json();
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const url = `${API_BASE_URL}/api/notifications/user/${userId}/count`;
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) return 0;
    const data = await response.json();
    return data.count || 0;
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    const url = `${API_BASE_URL}/api/notifications/${notificationId}/read`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    const url = `${API_BASE_URL}/api/notifications/user/${userId}/read-all`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async blockUser(blockerId: string, blockedId: string): Promise<BlockedUserResponse> {
    return this.request<BlockedUserResponse>('/users/block', {
      method: 'POST',
      body: JSON.stringify({ blockerId, blockedId }),
    });
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    await this.request<void>(`/users/block?blockerId=${blockerId}&blockedId=${blockedId}`, {
      method: 'DELETE',
    });
  }

  async getBlockedUsers(userId: string): Promise<BlockedUserResponse[]> {
    return this.request<BlockedUserResponse[]>(`/users/${userId}/blocked`);
  }

  async getBlockedUserIds(userId: string): Promise<string[]> {
    return this.request<string[]>(`/users/${userId}/blocked/ids`);
  }

  async heartbeat(userId: string): Promise<void> {
    await this.request<{ online: boolean }>(`/users/${userId}/heartbeat`, { method: 'POST' });
  }

  async getFriends(userId: string): Promise<Friendship[]> {
    return this.request<Friendship[]>(`/friends/${userId}`);
  }

  async getFriendRequests(userId: string): Promise<Friendship[]> {
    return this.request<Friendship[]>(`/friends/${userId}/requests`);
  }

  async requestFriend(requesterId: string, addresseeId: string): Promise<Friendship> {
    return this.request<Friendship>('/friends/requests', {
      method: 'POST',
      body: JSON.stringify({ requesterId, addresseeId }),
    });
  }

  async respondFriendRequest(id: string, userId: string, accept: boolean): Promise<Friendship> {
    return this.request<Friendship>(`/friends/requests/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ userId, accept }),
    });
  }

  async removeFriend(id: string, userId: string): Promise<void> {
    await this.request<{ message: string }>(`/friends/${id}?userId=${userId}`, { method: 'DELETE' });
  }

  async getDirectMessages(userId: string, friendId: string): Promise<DirectMessage[]> {
    return this.request<DirectMessage[]>(`/direct-messages/${userId}/${friendId}?limit=150`);
  }

  async sendDirectMessage(senderId: string, recipientId: string, content: string): Promise<DirectMessage> {
    return this.request<DirectMessage>('/direct-messages', {
      method: 'POST',
      body: JSON.stringify({ senderId, recipientId, content }),
    });
  }
}

export interface AgreementEvent {
  id: string;
  agreementId: string;
  eventType: string;
  actorName: string | null;
  targetName: string | null;
  oldValue: string | null;
  newValue: string | null;
  description: string;
  createdAt: string;
}

export interface BlockedUserResponse {
  id: string;
  blockedId: string;
  blockedNickname: string;
  createdAt: string;
}

export const apiService = new ApiService();
