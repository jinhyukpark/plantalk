import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const COUNTER_KEY = '@plantalk_ad_chat_count';
const THRESHOLD_KEY = '@plantalk_ad_next_threshold';
const MIN_MESSAGES = 20;
const MAX_MESSAGES = 40;
const DEV_THRESHOLD = Number(process.env.EXPO_PUBLIC_AD_MESSAGE_THRESHOLD || 0);
const DISCOVERY_COUNTER_KEY = '@plantalk_ad_discovery_slide_count';
const DISCOVERY_THRESHOLD_KEY = '@plantalk_ad_discovery_next_threshold';
const MIN_DISCOVERY_SLIDES = 15;
const MAX_DISCOVERY_SLIDES = 20;
const DEV_DISCOVERY_THRESHOLD = Number(process.env.EXPO_PUBLIC_AD_DISCOVERY_THRESHOLD || 0);

let adsModule: any = null;

try {
  adsModule = require('react-native-google-mobile-ads');
} catch (e) {
  adsModule = null;
  console.log('[adService] Google Mobile Ads native module unavailable — ads disabled');
}

let interstitial: any = null;
let adLoaded = false;
let adLoadFailed = false;
let initialized = false;
let discoveryCounterQueue: Promise<void> = Promise.resolve();

function getInterstitialAdUnitId(): string {
  const envId =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_ID
      : process.env.EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL_ID;
  return envId || adsModule.TestIds.INTERSTITIAL;
}

function loadInterstitial(): void {
  if (!adsModule) return;
  try {
    adLoaded = false;
    adLoadFailed = false;
    interstitial = adsModule.InterstitialAd.createForAdRequest(getInterstitialAdUnitId(), {
      requestNonPersonalizedAdsOnly: true,
    });
    interstitial.addAdEventListener(adsModule.AdEventType.LOADED, () => {
      adLoaded = true;
    });
    interstitial.addAdEventListener(adsModule.AdEventType.CLOSED, () => {
      adLoaded = false;
      loadInterstitial();
    });
    interstitial.addAdEventListener(adsModule.AdEventType.ERROR, () => {
      adLoaded = false;
      adLoadFailed = true;
    });
    interstitial.load();
  } catch (e) {
    adLoaded = false;
    adLoadFailed = true;
  }
}

function randomThreshold(): number {
  if (__DEV__ && Number.isInteger(DEV_THRESHOLD) && DEV_THRESHOLD > 0) {
    return DEV_THRESHOLD;
  }
  return MIN_MESSAGES + Math.floor(Math.random() * (MAX_MESSAGES - MIN_MESSAGES + 1));
}

function isValidThreshold(value: number): boolean {
  if (__DEV__ && Number.isInteger(DEV_THRESHOLD) && DEV_THRESHOLD > 0) {
    return value === DEV_THRESHOLD;
  }
  return value >= MIN_MESSAGES && value <= MAX_MESSAGES;
}

function randomDiscoveryThreshold(): number {
  if (__DEV__ && Number.isInteger(DEV_DISCOVERY_THRESHOLD) && DEV_DISCOVERY_THRESHOLD > 0) {
    return DEV_DISCOVERY_THRESHOLD;
  }
  return MIN_DISCOVERY_SLIDES
    + Math.floor(Math.random() * (MAX_DISCOVERY_SLIDES - MIN_DISCOVERY_SLIDES + 1));
}

function isValidDiscoveryThreshold(value: number): boolean {
  if (__DEV__ && Number.isInteger(DEV_DISCOVERY_THRESHOLD) && DEV_DISCOVERY_THRESHOLD > 0) {
    return value === DEV_DISCOVERY_THRESHOLD;
  }
  return value >= MIN_DISCOVERY_SLIDES && value <= MAX_DISCOVERY_SLIDES;
}

async function showInterstitialIfReady(): Promise<boolean> {
  if (!adLoaded || !interstitial) {
    if (adLoadFailed || !interstitial) loadInterstitial();
    return false;
  }

  try {
    adLoaded = false;
    await interstitial.show();
    return true;
  } catch (e) {
    loadInterstitial();
    return false;
  }
}

export const adService = {
  isAvailable(): boolean {
    return !!adsModule;
  },

  async initialize(): Promise<void> {
    if (!adsModule || initialized) return;
    initialized = true;
    try {
      await adsModule.default().initialize();
      loadInterstitial();
    } catch (e) {
      console.log('[adService] initialization failed', e);
    }
  },

  /**
   * Call after a user successfully sends any chat message.
   * Public-room and direct-message chats share one device-wide counter.
   * Shows an interstitial ad at a new random interval of 20–40 messages.
   */
  async onChatMessageSent(isPremium: boolean): Promise<void> {
    if (!adsModule || isPremium) return;
    try {
      if (!initialized) {
        await this.initialize();
      }
      const [countStr, thresholdStr] = await Promise.all([
        AsyncStorage.getItem(COUNTER_KEY),
        AsyncStorage.getItem(THRESHOLD_KEY),
      ]);
      let count = (parseInt(countStr || '0', 10) || 0) + 1;
      let threshold = parseInt(thresholdStr || '0', 10) || 0;
      if (!isValidThreshold(threshold)) {
        threshold = randomThreshold();
      }

      if (count >= threshold) {
        if (await showInterstitialIfReady()) {
          count = 0;
          threshold = randomThreshold();
        }
      }

      await Promise.all([
        AsyncStorage.setItem(COUNTER_KEY, String(count)),
        AsyncStorage.setItem(THRESHOLD_KEY, String(threshold)),
      ]);
    } catch (e) {
      console.log('[adService] onChatMessageSent failed', e);
    }
  },

  /**
   * Counts actual friend-discovery card transitions. The count and the next
   * randomized 15–20 threshold survive navigation and app restarts.
   */
  async onDiscoverySlide(isPremium: boolean, userId?: string): Promise<void> {
    if (!adsModule || isPremium) return;

    discoveryCounterQueue = discoveryCounterQueue.then(async () => {
      try {
        if (!initialized) await this.initialize();

        const keySuffix = userId ? `:${userId}` : '';
        const counterKey = `${DISCOVERY_COUNTER_KEY}${keySuffix}`;
        const thresholdKey = `${DISCOVERY_THRESHOLD_KEY}${keySuffix}`;
        const [countStr, thresholdStr] = await Promise.all([
          AsyncStorage.getItem(counterKey),
          AsyncStorage.getItem(thresholdKey),
        ]);

        let count = (parseInt(countStr || '0', 10) || 0) + 1;
        let threshold = parseInt(thresholdStr || '0', 10) || 0;
        if (!isValidDiscoveryThreshold(threshold)) {
          threshold = randomDiscoveryThreshold();
        }

        if (count >= threshold && await showInterstitialIfReady()) {
          count = 0;
          threshold = randomDiscoveryThreshold();
        }

        await Promise.all([
          AsyncStorage.setItem(counterKey, String(count)),
          AsyncStorage.setItem(thresholdKey, String(threshold)),
        ]);
      } catch (e) {
        console.log('[adService] onDiscoverySlide failed', e);
      }
    });

    return discoveryCounterQueue;
  },
};
