import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const REVENUECAT_ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY || '';
const REVENUECAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || '';

export const PRODUCT_IDS = {
  WEEKLY: 'plantalk_premium_weekly',
  BIWEEKLY: 'plantalk_premium_biweekly',
  ANNUAL: 'plantalk_premium_annual',
};

export const ENTITLEMENT_ID = 'premium';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let Purchases: any = null;

if (!isExpoGo) {
  try {
    Purchases = require('react-native-purchases').default;
  } catch (e) {
    console.log('RevenueCat SDK not available');
  }
}

interface PurchaseResult {
  success: boolean;
  customerInfo?: any;
  error?: string;
}

class PurchaseService {
  private isInitialized = false;
  private isPreviewMode = true;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    if (isExpoGo || !Purchases) {
      console.log('RevenueCat: Running in Preview Mode (Expo Go environment)');
      this.isPreviewMode = true;
      this.isInitialized = true;
      return;
    }

    try {
      const apiKey = Platform.OS === 'ios' ? REVENUECAT_IOS_API_KEY : REVENUECAT_ANDROID_API_KEY;
      
      if (!apiKey) {
        console.warn('RevenueCat API key not configured, running in preview mode');
        this.isPreviewMode = true;
        this.isInitialized = true;
        return;
      }

      await Purchases.configure({ apiKey });
      this.isPreviewMode = false;
      this.isInitialized = true;
      console.log('RevenueCat initialized successfully');
    } catch (error) {
      console.error('RevenueCat initialization error:', error);
      this.isPreviewMode = true;
      this.isInitialized = true;
    }
  }

  isInPreviewMode(): boolean {
    return this.isPreviewMode;
  }

  async login(userId: string): Promise<any | null> {
    if (this.isPreviewMode || !Purchases) {
      console.log('RevenueCat login skipped (Preview Mode)');
      return null;
    }

    try {
      const { customerInfo } = await Purchases.logIn(userId);
      return customerInfo;
    } catch (error) {
      console.error('RevenueCat login error:', error);
      return null;
    }
  }

  async logout(): Promise<void> {
    if (this.isPreviewMode || !Purchases) return;

    try {
      await Purchases.logOut();
    } catch (error) {
      console.error('RevenueCat logout error:', error);
    }
  }

  async getOfferings(): Promise<any | null> {
    if (this.isPreviewMode || !Purchases) {
      return this.getMockOffering();
    }

    try {
      const offerings = await Purchases.getOfferings();
      return offerings.current;
    } catch (error) {
      console.error('RevenueCat getOfferings error:', error);
      return this.getMockOffering();
    }
  }

  private getMockOffering(): any {
    return {
      identifier: 'default',
      serverDescription: 'Premium Subscription',
      availablePackages: [
        {
          identifier: '$rc_weekly',
          packageType: 'WEEKLY',
          product: {
            identifier: PRODUCT_IDS.WEEKLY,
            title: '주간 구독',
            description: '매주 갱신되는 프리미엄 구독',
            priceString: '₩5,000',
            price: 5000,
          },
          offeringIdentifier: 'default',
        },
        {
          identifier: '$rc_two_week',
          packageType: 'TWO_WEEK',
          product: {
            identifier: PRODUCT_IDS.BIWEEKLY,
            title: '2주 구독',
            description: '2주마다 갱신되는 프리미엄 구독',
            priceString: '₩10,000',
            price: 10000,
          },
          offeringIdentifier: 'default',
        },
        {
          identifier: '$rc_annual',
          packageType: 'ANNUAL',
          product: {
            identifier: PRODUCT_IDS.ANNUAL,
            title: '연간 구독',
            description: '1년 단위 프리미엄 구독 (최대 할인)',
            priceString: '₩50,000',
            price: 50000,
          },
          offeringIdentifier: 'default',
        },
      ],
    };
  }

  async getPackages(): Promise<any[]> {
    const offering = await this.getOfferings();
    return offering?.availablePackages || [];
  }

  async getCustomerInfo(): Promise<any | null> {
    if (this.isPreviewMode || !Purchases) {
      return null;
    }

    try {
      const customerInfo = await Purchases.getCustomerInfo();
      return customerInfo;
    } catch (error) {
      console.error('RevenueCat getCustomerInfo error:', error);
      return null;
    }
  }

  async checkPremiumStatus(): Promise<boolean> {
    if (this.isPreviewMode || !Purchases) {
      return false;
    }

    try {
      const customerInfo = await Purchases.getCustomerInfo();
      return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
    } catch (error) {
      console.error('RevenueCat checkPremiumStatus error:', error);
      return false;
    }
  }

  async purchasePackage(pkg: any): Promise<PurchaseResult> {
    if (this.isPreviewMode || !Purchases) {
      return {
        success: false,
        error: '미리보기 모드에서는 실제 구매를 할 수 없습니다. 개발 빌드에서 테스트해주세요.',
      };
    }

    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const isPremium = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
      
      return {
        success: isPremium,
        customerInfo,
      };
    } catch (error: any) {
      if (error.userCancelled) {
        return {
          success: false,
          error: '구매가 취소되었습니다.',
        };
      }
      
      console.error('RevenueCat purchase error:', error);
      return {
        success: false,
        error: error.message || '구매 중 오류가 발생했습니다.',
      };
    }
  }

  async restorePurchases(): Promise<PurchaseResult> {
    if (this.isPreviewMode || !Purchases) {
      return {
        success: false,
        error: '미리보기 모드에서는 구매 복원을 할 수 없습니다.',
      };
    }

    try {
      const customerInfo = await Purchases.restorePurchases();
      const isPremium = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
      
      return {
        success: isPremium,
        customerInfo,
      };
    } catch (error: any) {
      console.error('RevenueCat restore error:', error);
      return {
        success: false,
        error: error.message || '구매 복원 중 오류가 발생했습니다.',
      };
    }
  }

  getSubscriptionExpirationDate(customerInfo: any): Date | null {
    if (!customerInfo || this.isPreviewMode) return null;

    try {
      const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
      if (entitlement?.expirationDate) {
        return new Date(entitlement.expirationDate);
      }
    } catch (error) {
      console.error('Error getting expiration date:', error);
    }
    return null;
  }

  isSubscriptionActive(customerInfo: any): boolean {
    if (!customerInfo || this.isPreviewMode) return false;

    try {
      return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
    } catch (error) {
      return false;
    }
  }
}

export const purchaseService = new PurchaseService();
