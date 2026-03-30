import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

// Replace with your Firebase project values from console.firebase.google.com
const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID!,
  databaseURL:       process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL!,
};

const app = initializeApp(firebaseConfig);

export const auth    = getAuth(app);
export const db      = getFirestore(app);     // Firestore — profiles, matches, messages
export const rtdb    = getDatabase(app);       // Realtime DB — live proximity updates
export const storage = getStorage(app);        // Storage — profile photos

// Enable offline persistence for Firestore (works on mobile)
enableIndexedDbPersistence(db).catch(() => {
  // Persistence fails in some environments (e.g. multiple tabs) — safe to ignore
});

// ─── Firestore Collection Paths ───────────────────────────────────────────────
export const COLLECTIONS = {
  USERS:           'users',
  SEARCH_SESSIONS: 'searchSessions',
  MATCHES:         'matches',
  messages: (matchId: string) => `matches/${matchId}/messages`,
} as const;

// ─── Realtime DB Paths ────────────────────────────────────────────────────────
export const RTDB_PATHS = {
  proximity: (matchId: string, userId: string) => `proximity/${matchId}/${userId}`,
} as const;
