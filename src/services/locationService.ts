import * as Location from 'expo-location';
import { Platform, Alert, Linking } from 'react-native';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LocationResult {
  success: boolean;
  coordinates?: Coordinates;
  error?: string;
}

class LocationService {
  private cachedLocation: Coordinates | null = null;
  private lastFetchTime: number = 0;
  private readonly CACHE_DURATION_MS = 5 * 60 * 1000;

  async requestPermission(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
      
      if (existingStatus === 'granted') {
        return true;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status === 'granted') {
        return true;
      }

      if (status === 'denied') {
        Alert.alert(
          '위치 권한 필요',
          '가까운 채팅방을 찾으려면 위치 권한이 필요합니다.\n설정에서 위치 권한을 허용해주세요.',
          [
            { text: '취소', style: 'cancel' },
            { text: '설정으로 이동', onPress: () => Linking.openSettings() },
          ]
        );
      }

      return false;
    } catch (error) {
      console.error('Error requesting location permission:', error);
      return false;
    }
  }

  async getCurrentLocation(): Promise<LocationResult> {
    try {
      const now = Date.now();
      if (this.cachedLocation && (now - this.lastFetchTime) < this.CACHE_DURATION_MS) {
        return { success: true, coordinates: this.cachedLocation };
      }

      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        return { success: false, error: 'permission_denied' };
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      this.cachedLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      this.lastFetchTime = now;

      return { success: true, coordinates: this.cachedLocation };
    } catch (error: any) {
      const message = error?.message || 'unknown_error';
      const normalized = message.toLowerCase();
      const isExpectedUnavailable =
        normalized.includes('current location is unavailable') ||
        normalized.includes('location unavailable') ||
        normalized.includes('location services are disabled') ||
        normalized.includes('provider is unavailable');
      if (!isExpectedUnavailable) {
        console.warn('Unable to get current location:', message);
      }
      return {
        success: false,
        error: isExpectedUnavailable ? 'location_unavailable' : message,
      };
    }
  }

  calculateDistance(from: Coordinates, to: Coordinates): number {
    const R = 6371;
    const dLat = this.toRad(to.latitude - from.latitude);
    const dLon = this.toRad(to.longitude - from.longitude);
    const lat1 = this.toRad(from.latitude);
    const lat2 = this.toRad(to.latitude);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }

  private toRad(value: number): number {
    return (value * Math.PI) / 180;
  }

  formatDistance(distanceKm: number): string {
    if (distanceKm < 1) {
      const meters = Math.round(distanceKm * 1000);
      return `${meters}m`;
    } else if (distanceKm < 10) {
      return `${distanceKm.toFixed(1)}km`;
    } else {
      return `${Math.round(distanceKm)}km`;
    }
  }

  clearCache(): void {
    this.cachedLocation = null;
    this.lastFetchTime = 0;
  }

  async checkPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      return status as 'granted' | 'denied' | 'undetermined';
    } catch (error) {
      console.error('Error checking permission status:', error);
      return 'undetermined';
    }
  }
}

export const locationService = new LocationService();
