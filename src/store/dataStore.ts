import { Agreement, AgreementCategory, ParticipantStatus, User, getAgreementStatus } from '../types';

let currentUser: User | null = null;
let agreements: Agreement[] = [];
let isOnboarded = false;

const generateId = () => Math.random().toString(36).substring(2, 15);

export const DataStore = {
  isOnboarded: () => isOnboarded,
  
  setOnboarded: (value: boolean) => {
    isOnboarded = value;
  },
  
  getCurrentUser: (): User | null => currentUser,

  clearCurrentUser: () => {
    currentUser = null;
  },
  
  setCurrentUser: (nickname: string): User => {
    currentUser = {
      id: generateId(),
      nickname,
      createdAt: new Date(),
    };
    return currentUser;
  },
  
  getAgreements: (): Agreement[] => agreements,
  
  getAgreementById: (id: string): Agreement | undefined => {
    return agreements.find(a => a.id === id);
  },
  
  getPendingAgreements: (): Agreement[] => {
    if (!currentUser) return [];
    return agreements.filter(a => {
      const userParticipant = a.participants.find(
        p => p.userName === currentUser?.nickname
      );
      return userParticipant && userParticipant.status === 'waiting';
    });
  },
  
  getUpcomingAgreements: (): Agreement[] => {
    const now = new Date();
    return agreements.filter(a => {
      const status = getAgreementStatus(a);
      return status === 'completed' && a.dateTime && new Date(a.dateTime) > now;
    }).sort((a, b) => {
      if (!a.dateTime || !b.dateTime) return 0;
      return new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime();
    });
  },
  
  getStats: () => {
    if (!currentUser) return { total: 0, completed: 0, declined: 0 };
    
    const userAgreements = agreements.filter(a => 
      a.creatorId === currentUser?.id || 
      a.participants.some(p => p.userName === currentUser?.nickname)
    );
    
    let completed = 0;
    let declined = 0;
    
    userAgreements.forEach(a => {
      const status = getAgreementStatus(a);
      if (status === 'completed') completed++;
      if (status === 'declined') declined++;
    });
    
    return {
      total: userAgreements.length,
      completed,
      declined,
    };
  },
  
  createAgreement: (
    title: string,
    description: string,
    category: AgreementCategory,
    emoji: string,
    customCategoryName: string | null,
    dateTime: Date | null,
    scheduleType: 'POINT' | 'RANGE',
    endDateTime: Date | null,
    participantNames: string[]
  ): Agreement => {
    if (!currentUser) throw new Error('User not logged in');
    
    const participants: ParticipantStatus[] = [
      {
        id: generateId(),
        agreementId: '',
        userName: currentUser.nickname,
        status: 'agreed',
        updatedAt: new Date(),
      },
      ...participantNames.map(name => ({
        id: generateId(),
        agreementId: '',
        userName: name,
        status: 'waiting' as const,
        updatedAt: null,
      })),
    ];
    
    const agreement: Agreement = {
      id: generateId(),
      title,
      description,
      emoji,
      category,
      customCategoryName,
      status: 'PENDING',
      dateTime,
      scheduleType,
      endDateTime,
      creatorId: currentUser.id,
      creatorName: currentUser.nickname,
      participants,
      createdAt: new Date(),
    };
    
    agreement.participants.forEach(p => p.agreementId = agreement.id);
    agreements.unshift(agreement);
    
    return agreement;
  },
  
  updateParticipantStatus: (
    agreementId: string,
    status: 'agreed' | 'declined' | 'skipped'
  ): Agreement | null => {
    if (!currentUser) return null;
    
    const agreement = agreements.find(a => a.id === agreementId);
    if (!agreement) return null;
    
    const participant = agreement.participants.find(
      p => p.userName === currentUser?.nickname
    );
    if (!participant) return null;
    
    participant.status = status;
    participant.updatedAt = new Date();
    
    return agreement;
  },
  
  loadMockData: () => {
    if (!currentUser) return;
    
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    agreements = [
      {
        id: generateId(),
        title: '주말 영화 보기',
        description: '토요일 저녁에 같이 영화 보러 가요!',
        emoji: '🎬',
        category: 'gathering',
        status: 'PENDING',
        dateTime: nextWeek,
        creatorId: 'other1',
        creatorName: '민수',
        participants: [
          { id: generateId(), agreementId: '', userName: '민수', status: 'agreed', updatedAt: yesterday },
          { id: generateId(), agreementId: '', userName: currentUser.nickname, status: 'waiting', updatedAt: null },
        ],
        createdAt: yesterday,
      },
      {
        id: generateId(),
        title: '스터디 모임',
        description: 'React Native 스터디 첫 번째 모임입니다.',
        emoji: '📚',
        category: 'study',
        status: 'PENDING',
        dateTime: tomorrow,
        creatorId: 'other2',
        creatorName: '지은',
        participants: [
          { id: generateId(), agreementId: '', userName: '지은', status: 'agreed', updatedAt: yesterday },
          { id: generateId(), agreementId: '', userName: currentUser.nickname, status: 'waiting', updatedAt: null },
          { id: generateId(), agreementId: '', userName: '현우', status: 'agreed', updatedAt: yesterday },
        ],
        createdAt: yesterday,
      },
      {
        id: generateId(),
        title: '저녁 약속',
        description: '오랜만에 만나서 맛있는 거 먹어요 🍜',
        emoji: '🍽️',
        category: 'promise',
        status: 'IN_PROGRESS',
        dateTime: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
        creatorId: currentUser.id,
        creatorName: currentUser.nickname,
        participants: [
          { id: generateId(), agreementId: '', userName: currentUser.nickname, status: 'agreed', updatedAt: yesterday },
          { id: generateId(), agreementId: '', userName: '서연', status: 'agreed', updatedAt: now },
        ],
        createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        id: generateId(),
        title: '데이트 💕',
        description: '첫 데이트! 설레네요 ☺️',
        emoji: '💕',
        category: 'romance',
        status: 'COMPLETED',
        dateTime: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        creatorId: currentUser.id,
        creatorName: currentUser.nickname,
        participants: [
          { id: generateId(), agreementId: '', userName: currentUser.nickname, status: 'agreed', updatedAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000) },
          { id: generateId(), agreementId: '', userName: '예린', status: 'agreed', updatedAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000) },
        ],
        createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      },
    ];
    
    agreements.forEach(a => {
      a.participants.forEach(p => p.agreementId = a.id);
    });
  },
};
