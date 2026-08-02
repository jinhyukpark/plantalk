import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from './src/context/AppContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { adService } from './src/services/adService';
import { LanguageProvider } from './src/context/LanguageContext';

function AppContent() {
  return (
    <NotificationProvider>
      <AppNavigator />
    </NotificationProvider>
  );
}

export default function App() {
  useEffect(() => {
    adService.initialize();
  }, []);

  return (
    <SafeAreaProvider>
      <AppProvider>
        <LanguageProvider>
          <StatusBar style="dark" />
          <AppContent />
        </LanguageProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}
