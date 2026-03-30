import 'expo-dev-client';
import React, { useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import {
  DMSans_400Regular,
  DMSans_500Medium,
} from '@expo-google-fonts/dm-sans';
import {
  DMSerifDisplay_400Regular,
  DMSerifDisplay_400Regular_Italic,
} from '@expo-google-fonts/dm-serif-display';

import AppNavigator from './src/navigation/AppNavigator';
import { useAuthStore } from './src/hooks/useAuthStore';
import { setupNotificationListeners } from './src/services/notificationService';

// Keep splash screen visible while loading fonts + auth
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded, fontError] = Font.useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSerifDisplay_400Regular,
    DMSerifDisplay_400Regular_Italic,
  });

  const { _init, isLoading } = useAuthStore();

  // Boot Firebase auth listener
  useEffect(() => {
    const cleanup = _init();
    return cleanup;
  }, []);

  // Wire up notification deep-links
  useEffect(() => {
    const cleanup = setupNotificationListeners(
      (matchId) => {
        // TODO: navigate to MatchIncoming via navigation ref
        console.log('Notification: match request', matchId);
      },
      (matchId) => {
        // TODO: navigate to ChatUnlocked via navigation ref
        console.log('Notification: chat unlocked', matchId);
      },
    );
    return cleanup;
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if ((fontsLoaded || fontError) && !isLoading) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, isLoading]);

  if (!fontsLoaded && !fontError) return null;
  if (isLoading) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <AppNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
