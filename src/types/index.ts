export interface User {
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
  createdAt: Date;
}

export interface DiscoverUser {
  id: string;
  nickname: string;
  bio?: string | null;
  profilePictureUrl?: string | null;
  coverPhotoUrl?: string | null;
  avatarEmoji?: string | null;
  avatarColor?: string | null;
  nationality: 'KR' | 'JP' | 'OTHER';
  gender?: 'MALE' | 'FEMALE' | null;
  age?: number | null;
  online: boolean;
}

export interface Friendship {
  id: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  direction: 'INCOMING' | 'OUTGOING';
  friendId: string;
  nickname: string;
  profilePictureUrl?: string | null;
  avatarEmoji?: string | null;
  avatarColor?: string | null;
  lastActiveAt?: string | null;
  online: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DirectMessage {
  id: string;
  senderId: string;
  senderNickname: string;
  recipientId: string;
  recipientNickname: string;
  content: string;
  createdAt: string;
  readAt?: string | null;
}

export type AgreementCategory = 
  | 'romance'
  | 'gathering'
  | 'wedding'
  | 'protest'
  | 'study'
  | 'promise'
  | 'sports'
  | 'custom';

export interface CategoryInfo {
  id: AgreementCategory;
  emoji: string;
  label: string;
  labelKo: string;
  labelJa: string;
}

export const CATEGORIES: CategoryInfo[] = [
  { id: 'romance', emoji: '💕', label: 'Romance / Intimacy', labelKo: '로맨스 / 친밀함', labelJa: 'ロマンス / 親密さ' },
  { id: 'gathering', emoji: '🎉', label: 'Party / Gathering', labelKo: '파티 / 모임', labelJa: 'パーティー / 集まり' },
  { id: 'wedding', emoji: '💒', label: 'Wedding / Ceremony', labelKo: '결혼 / 행사', labelJa: '結婚 / セレモニー' },
  { id: 'protest', emoji: '📢', label: 'Protest / Rally / Event', labelKo: '시위 / 집회 / 이벤트', labelJa: 'デモ / 集会 / イベント' },
  { id: 'study', emoji: '📚', label: 'Study / Project', labelKo: '스터디 / 프로젝트', labelJa: '勉強 / プロジェクト' },
  { id: 'promise', emoji: '🤝', label: 'Simple Promise', labelKo: '간단한 약속', labelJa: 'シンプルな約束' },
  { id: 'sports', emoji: '⚽', label: 'Sports / Exercise', labelKo: '운동 / 스포츠', labelJa: '運動 / スポーツ' },
  { id: 'custom', emoji: '✨', label: 'Custom', labelKo: '사용자 지정', labelJa: 'カスタム' },
];

export type ParticipantStatusType = 'waiting' | 'agreed' | 'declined' | 'skipped';

export interface ParticipantStatus {
  id: string;
  agreementId: string;
  userName: string;
  status: ParticipantStatusType;
  updatedAt: Date | null;
}

export type AgreementStatusType = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
export type AgreementScheduleType = 'POINT' | 'RANGE';

export interface Agreement {
  id: string;
  title: string;
  description: string;
  emoji: string;
  category: AgreementCategory;
  customCategoryName?: string | null;
  status: AgreementStatusType;
  dateTime: Date | null;
  scheduleType?: AgreementScheduleType;
  endDateTime?: Date | null;
  creatorId: string;
  creatorName: string;
  participants: ParticipantStatus[];
  createdAt: Date;
}

export type AgreementStatus = 'pending' | 'completed' | 'declined' | 'cancelled';

export function getAgreementStatus(agreement: Agreement): AgreementStatus {
  const allAgreed = agreement.participants.every(p => p.status === 'agreed');
  const anyDeclined = agreement.participants.some(p => p.status === 'declined');
  
  if (allAgreed) return 'completed';
  if (anyDeclined) return 'declined';
  return 'pending';
}

export function getCategoryInfo(category: AgreementCategory): CategoryInfo {
  return CATEGORIES.find(c => c.id === category) || CATEGORIES[5];
}

export type RoomVisibility = 'PUBLIC' | 'PRIVATE';
export type RoomStatus = 'ACTIVE' | 'CLOSED' | 'CANCELLED';
export type RoomParticipantRole = 'OWNER' | 'MODERATOR' | 'MEMBER';
export type RoomParticipantStatus = 'INVITED' | 'JOINED' | 'LEFT' | 'BANNED';

export interface Room {
  id: string;
  title: string;
  description: string;
  category: string;
  emoji: string;
  visibility: RoomVisibility;
  creatorId: string;
  creatorName: string;
  latitude: number | null;
  longitude: number | null;
  locationName: string | null;
  startsAt: string | null;
  endsAt: string | null;
  maxParticipants: number | null;
  currentParticipants: number;
  status: RoomStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RoomParticipant {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  role: RoomParticipantRole;
  status: RoomParticipantStatus;
  joinedAt: string;
  leftAt: string | null;
}

export interface RoomMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  content: string;
  messageType: 'TEXT' | 'SYSTEM' | 'IMAGE';
  attachmentUrl?: string | null;
  createdAt: string;
  editedAt?: string | null;
  deleted?: boolean;
}

export type SubscriptionPlan = 'WEEKLY' | 'BIWEEKLY' | 'ANNUAL';
export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELED' | 'PENDING';

export interface Subscription {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  priceKrw: number;
  startedAt: string;
  expiresAt: string;
  platform: 'IOS' | 'ANDROID';
  autoRenew: boolean;
}

export interface SubscriptionPlanInfo {
  id: SubscriptionPlan;
  name: string;
  priceKrw: number;
  durationDays: number;
  description: string;
}

export interface SubscriptionStatusResponse {
  isPremium: boolean;
  plan: SubscriptionPlan | null;
  expiresAt: string | null;
  shouldShowAd: boolean;
}

export const ROOM_CATEGORIES = [
  { id: 'drinking', emoji: '🍺', label: '술 한잔' },
  { id: 'food', emoji: '🍽️', label: '맛집 탐방' },
  { id: 'hobby', emoji: '🎮', label: '취미 활동' },
  { id: 'sports', emoji: '⚽', label: '운동/스포츠' },
  { id: 'golf', emoji: '⛳', label: '골프' },
  { id: 'travel', emoji: '✈️', label: '여행' },
  { id: 'study', emoji: '📚', label: '스터디' },
  { id: 'networking', emoji: '🤝', label: '네트워킹' },
  { id: 'other', emoji: '💬', label: '기타' },
];

export const CHAT_EMOJIS = [
  '👍', '❤️', '😊', '😂', '🎉', '👏', '🙏', '💪',
  '✨', '🔥', '💯', '👀', '🤔', '😎', '🥳', '💕',
  '☕', '🍺', '🍽️', '⛳', '🏌️', '🎮', '📚', '✈️',
];

export type NotificationType = 
  | 'ROOM_MESSAGE'
  | 'AGREEMENT_CREATED'
  | 'AGREEMENT_RESPONSE'
  | 'AGREEMENT_STATUS_CHANGED'
  | 'AGREEMENT_UPDATED'
  | 'ROOM_JOINED'
  | 'ROOM_ANNOUNCEMENT'
  | 'GLOBAL_ANNOUNCEMENT'
  | 'SYSTEM';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  referenceId: string | null;
  referenceType: 'ROOM' | 'AGREEMENT' | 'GLOBAL_ANNOUNCEMENT' | null;
  senderName: string | null;
  senderId?: string | null;
  senderProfilePictureUrl?: string | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}

export interface UserPhoto {
  id: string;
  userId: string;
  photoUrl: string;
  caption: string | null;
  displayOrder: number;
  createdAt: string;
}
