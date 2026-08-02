import React from 'react';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import NotificationToast from './NotificationToast';
import { useNotification } from '../context/NotificationContext';
import { Notification } from '../types';

type RootStackParamList = {
  RoomDetail: { roomId: string };
  AgreementDetail: { agreementId: string };
};

export default function GlobalNotificationToast() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { currentToast, hideToast, setCurrentRoomId } = useNotification();

  const handlePress = (notification: Notification) => {
    if (notification.referenceType === 'ROOM' && notification.referenceId) {
      setCurrentRoomId(notification.referenceId);
      navigation.navigate('RoomDetail', { roomId: notification.referenceId });
    } else if (notification.referenceType === 'AGREEMENT' && notification.referenceId) {
      navigation.navigate('AgreementDetail', { agreementId: notification.referenceId });
    }
    hideToast();
  };

  return (
    <NotificationToast
      notification={currentToast}
      onPress={handlePress}
      onDismiss={hideToast}
      duration={4000}
    />
  );
}
