// ─── Core Data Models ────────────────────────────────────────────────────────

export type Gender = 'man' | 'woman' | 'non-binary';
export type MealTime = 'breakfast' | 'lunch' | 'dinner';
export type MatchStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'completed';
export type ChatStatus = 'locked' | 'unlocked' | 'ended';

// ─── User Profile ─────────────────────────────────────────────────────────────
export interface UserProfile {
  uid: string;
  name: string;
  age: number;
  gender: Gender;
  photos: string[];               // Firebase Storage URLs
  foodLikes: string[];            // e.g. ['italian', 'japanese']
  foodDislikes: string[];         // e.g. ['spicy', 'nuts']
  createdAt: number;
  updatedAt: number;
}

// ─── Search Filters (persisted per user) ──────────────────────────────────────
export interface SearchFilters {
  showGender: Gender | 'everyone';
  ageMin: number;
  ageMax: number;
  maxDistanceKm: number;
  cuisines: string[];
  mealTimes: MealTime[];
}

export const DEFAULT_FILTERS: SearchFilters = {
  showGender: 'everyone',
  ageMin: 18,
  ageMax: 45,
  maxDistanceKm: 3,
  cuisines: [],
  mealTimes: ['dinner'],
};

// ─── Restaurant (from Google Places API) ──────────────────────────────────────
export interface Restaurant {
  placeId: string;
  name: string;
  address: string;
  cuisine: string;
  priceLevel: 1 | 2 | 3 | 4;
  rating: number;
  distanceKm: number;
  coordinates: LatLng;
  photoUrl?: string;
  isOpenNow: boolean;
}

export interface LatLng {
  latitude: number;
  longitude: number;
}

// ─── Search Session (Firestore: /searchSessions/{sessionId}) ─────────────────
// Created when a user starts searching at a specific restaurant + time
export interface SearchSession {
  sessionId: string;
  userId: string;
  userProfile: Pick<UserProfile, 'uid' | 'name' | 'age' | 'gender' | 'photos' | 'foodLikes' | 'foodDislikes'>;
  restaurantId: string;
  restaurant: Restaurant;
  desiredTime: string;            // "19:00"
  desiredDate: string;            // "2024-12-25"
  filters: SearchFilters;
  userLocation: LatLng;
  status: 'searching' | 'matched' | 'expired';
  createdAt: number;
  expiresAt: number;              // +2 hours from creation
}

// ─── Dining Match (Firestore: /matches/{matchId}) ────────────────────────────
export interface DiningMatch {
  matchId: string;
  sessionIdA: string;
  sessionIdB: string;
  userIdA: string;
  userIdB: string;
  profileA: SearchSession['userProfile'];
  profileB: SearchSession['userProfile'];
  restaurant: Restaurant;
  agreedTime: string;             // "19:00"
  agreedDate: string;
  status: MatchStatus;
  chatStatus: ChatStatus;
  userANearby: boolean;           // within 100m of restaurant
  userBNearby: boolean;
  chatUnlockedAt?: number;        // timestamp when both were nearby
  initiatedBy: 'A' | 'B';        // who sent the dining request
  createdAt: number;
  updatedAt: number;
}

// ─── Chat Message (Firestore: /matches/{matchId}/messages/{msgId}) ───────────
export interface ChatMessage {
  messageId: string;
  senderId: string;
  text: string;
  createdAt: number;
  readAt?: number;
}

// ─── Proximity Update (Realtime DB: /proximity/{matchId}/{userId}) ───────────
export interface ProximityUpdate {
  userId: string;
  isNearby: boolean;              // within 100m of restaurant
  distanceMeters: number;
  updatedAt: number;
}

// ─── Navigation Param Lists ───────────────────────────────────────────────────
export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  ProfileSetup: undefined;
  FilterSetup: undefined;
};

export type MainTabParamList = {
  Restaurants: undefined;
  ActiveMatch: { matchId: string } | undefined;
  Profile: undefined;
};

export type SearchStackParamList = {
  RestaurantList: undefined;
  Searching: {
    restaurant: Restaurant;
    desiredTime: string;
    filters: SearchFilters;
  };
  MatchIncoming: {
    match: DiningMatch;
    sessionId: string;
  };
  MatchConfirmed: { matchId: string };
  ChatLocked: { matchId: string };
  ChatUnlocked: { matchId: string };
};
