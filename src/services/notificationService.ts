// src/services/notificationService.ts
// Handles Expo push notifications + Firebase Cloud Messaging (FCM)

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { db, COLLECTIONS } from './firebase';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ─── Register device and save push token ─────────────────────────────────────
export async function registerForPushNotifications(userId: string): Promise<string | null> {
  // Push notifications only work on real devices, not simulators
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Check / request permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission denied');
    return null;
  }

  // Android requires a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('dinematch', {
      name: 'DineMatch',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#c85c28',
      sound: 'default',
    });
  }

  // Get Expo push token (works with both Expo Go and standalone builds)
  // For production, use getDevicePushTokenAsync() to get raw FCM token
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID, // from app.json / EAS
  });

  const pushToken = tokenData.data;

  // Save token to Firestore user doc so server can send targeted notifications
  await updateDoc(doc(db, COLLECTIONS.USERS, userId), {
    pushToken,
    pushTokenUpdatedAt: Date.now(),
  });

  return pushToken;
}

// ─── Local notification helpers ───────────────────────────────────────────────

export async function notifyMatchFound(partnerName: string, restaurantName: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '✦ Dining request!',
      body: `${partnerName} wants to dine with you at ${restaurantName}`,
      sound: 'default',
      data: { type: 'match_request' },
    },
    trigger: null, // immediate
  });
}

export async function notifyMatchAccepted(partnerName: string, restaurantName: string, time: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "It's a Dining Match! 🎉",
      body: `${partnerName} accepted! You're dining at ${restaurantName} at ${time}`,
      sound: 'default',
      data: { type: 'match_accepted' },
    },
    trigger: null,
  });
}

export async function notifyChatUnlocked(partnerName: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '💬 Chat unlocked!',
      body: `You and ${partnerName} are both nearby — you can now chat!`,
      sound: 'default',
      data: { type: 'chat_unlocked' },
    },
    trigger: null,
  });
}

export async function notifyPartnerNearby(partnerName: string, restaurantName: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${partnerName} is almost there`,
      body: `Your dining partner is close to ${restaurantName}. Head over!`,
      sound: 'default',
      data: { type: 'partner_nearby' },
    },
    trigger: null,
  });
}

// Reminder 30 minutes before agreed time
export async function schedulePreDinnerReminder(restaurantName: string, agreedTime: string, agreedDate: string) {
  const [h, m] = agreedTime.split(':').map(Number);
  const triggerDate = new Date(agreedDate);
  triggerDate.setHours(h, m - 30, 0, 0); // 30 min before

  if (triggerDate > new Date()) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🍽️ Dinner in 30 minutes!',
        body: `Head to ${restaurantName} soon — your dining match is waiting`,
        sound: 'default',
        data: { type: 'pre_dinner_reminder' },
      },
      trigger: { date: triggerDate },
    });
  }
}

// ─── Handle notification taps (deep link into app) ────────────────────────────
export function setupNotificationListeners(
  onMatchRequest: (matchId: string) => void,
  onChatUnlocked: (matchId: string) => void,
) {
  // Fired when user taps a notification
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as any;
    if (data?.type === 'match_request' && data.matchId) {
      onMatchRequest(data.matchId);
    }
    if (data?.type === 'chat_unlocked' && data.matchId) {
      onChatUnlocked(data.matchId);
    }
  });

  return () => sub.remove();
}
