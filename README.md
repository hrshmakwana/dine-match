# DineMatch 🍽️
**Find your dining companion. No awkward intros — just show up and eat.**

---

## Complete File Map

```
dinematch/
├── App.tsx                          Entry point, fonts, auth init, notifications
├── app.config.js                    Expo config (Maps keys, permissions, plugins)
├── firebase.json                    Firebase deploy config (rules, emulators)
├── firestore.rules                  Firestore security rules
├── firestore.indexes.json           Composite indexes for matching queries
├── database.rules.json              Realtime DB rules (proximity data)
├── storage.rules                    Firebase Storage rules (profile photos)
├── .env.example                     All required environment variables
├── package.json                     npm dependencies
│
├── functions/
│   ├── package.json                 Cloud Functions dependencies
│   ├── tsconfig.json
│   └── src/
│       └── index.ts                 4 Cloud Functions (matching, proximity, cleanup, notifications)
│
└── src/
    ├── types/
    │   └── index.ts                 All TypeScript interfaces + navigation param lists
    │
    ├── hooks/
    │   ├── useAuthStore.ts          Zustand store — Firebase auth + Firestore profile listener
    │   └── useActiveMatch.ts        Real-time listener for accepted match
    │
    ├── navigation/
    │   └── AppNavigator.tsx         Root → Auth stack → Main tabs (Dine / My Date / Me)
    │
    ├── services/
    │   ├── firebase.ts              Firebase init, collection paths, RTDB paths
    │   ├── matchingService.ts       Session CRUD, filter updates, compatible session query, match creation
    │   ├── proximityService.ts      expo-location GPS watch, Haversine distance, RTDB updates, chat unlock
    │   ├── chatService.ts           Send/receive Firestore messages
    │   ├── restaurantService.ts     Google Places nearby search, details, autocomplete
    │   ├── notificationService.ts   Expo push token registration, FCM, local notifications
    │   ├── photoService.ts          expo-image-picker + Firebase Storage upload/delete
    │   ├── historyService.ts        Past matches, report/block, post-date ratings
    │   └── reservationService.ts    (Premium) Restaurant table reservation
    │
    ├── screens/
    │   ├── SplashScreen.tsx         Animated logo, Get Started / Sign In
    │   ├── PhoneAuthScreen.tsx      Phone number OTP sign-in (Firebase Auth)
    │   ├── ProfileSetupScreen.tsx   3-step: photos → name/age/gender → food likes/dislikes
    │   ├── FilterSetupScreen.tsx    Gender, age range, distance, meal times, cuisines
    │   ├── RestaurantListScreen.tsx Google Maps + Places nearby list, pick a restaurant
    │   ├── SearchingScreen.tsx      Time picker, pulse animation, filter FAB, match listener
    │   ├── MatchIncomingScreen.tsx  Incoming dining request card — Accept / Pass
    │   ├── MatchConfirmedScreen.tsx Confetti, date card, privacy note → ChatLocked
    │   ├── ChatLockedScreen.tsx     Proximity bars for both users, auto-navigates on unlock
    │   ├── ChatUnlockedScreen.tsx   Full real-time chat (Firestore), only after 100m trigger
    │   ├── ActiveMatchScreen.tsx    "My Date" tab — empty state or active match summary
    │   └── ProfileScreen.tsx        Photo grid, edit profile, dining history, settings
    │
    ├── components/
    │   └── FilterDrawer.tsx         Bottom sheet — all filters, accessible anytime during search
    │
    └── utils/
        ├── theme.ts                 Colors, fonts, spacing constants
        └── helpers.ts               formatTime, haversine, generateId, todayISODate
```

---

## User Flow

```
Open app
   │
   ▼
SplashScreen ──────────── "Get Started" ──▶ PhoneAuthScreen
                                                    │ OTP verified
                                                    ▼
                                         ProfileSetupScreen (3 steps)
                                           Step 1: Add photos
                                           Step 2: Name, age, gender
                                           Step 3: Food likes / dislikes
                                                    │
                                                    ▼
                                         FilterSetupScreen
                                           Show me: Women/Men/Everyone
                                           Age range, distance, cuisine, meal times
                                                    │
                                                    ▼
                                    ┌──── Main App (Bottom Tabs) ────┐
                                    │                                │
                                  [Dine]                          [My Date]   [Me]
                                    │                                │          │
                            RestaurantListScreen          ActiveMatchScreen  ProfileScreen
                            (Google Maps + Places)            (empty until     (photos, edit,
                                    │                           matched)       history)
                            Pick restaurant
                                    │
                            SearchingScreen
                              ┌─ Time picker (select when you want to go)
                              ├─ Live pulse animation
                              ├─ Active filter chips
                              └─ ⚙ FAB → FilterDrawer (change filters anytime)
                                    │
                              Cloud Function matches with compatible session
                                    │
                            MatchIncomingScreen (for the other user)
                              Profile photo, food tags, agreed time
                              [Pass]  [Accept ✓]
                                    │ Accept
                            MatchConfirmedScreen
                              Confetti 🎉
                              Restaurant + agreed time card
                              "Chat unlocks when both within 100m"
                                    │
                            ChatLockedScreen
                              Proximity bar: You ────── 450m
                              Proximity bar: Priya ──── 180m
                              Auto-navigates when both isNearby = true
                                    │ (both within 100m, Cloud Function unlocks chat)
                            ChatUnlockedScreen
                              Real-time Firestore chat
                              "You're both at Bella Italia — chat is open!"
```

---

## The 3 Core Features (how they're implemented)

### 1. Filters accessible anytime during search
- `SearchingScreen` has a floating ⚙ FAB (bottom-right)
- Tapping it opens `FilterDrawer` — an Animated bottom sheet Modal
- `onApply` calls `updateSessionFilters(sessionId, newFilters)` in `matchingService.ts`
- This does a Firestore `updateDoc` on the live session — no restart needed
- The Cloud Function reads fresh filters from the session doc each time it evaluates matches

### 2. Chat locked until both within 100m
- On `MatchConfirmedScreen`, user taps "Heading there" → `ChatLockedScreen`
- `startProximityTracking()` in `proximityService.ts` starts `expo-location` watching GPS every 15s
- Each update runs `haversineMeters(userCoords, restaurantCoords)` and writes `{isNearby, distanceMeters}` to Firebase Realtime DB at `/proximity/{matchId}/{userId}`
- Cloud Function `onProximityUpdate` triggers on any write — when both users have `isNearby: true`, it sets `match.chatStatus = 'unlocked'`
- `ChatLockedScreen` listens to the match doc via `listenToMatch()` and auto-navigates to `ChatUnlockedScreen`
- Partner's exact coordinates are **never stored** — only the boolean proximity flag

### 3. Instant dining — user picks a time
- `SearchingScreen` shows a horizontal scroll of 30-min time slots (6 AM–11 PM)
- Selected time is stored in `SearchSession.desiredTime`
- Matching only pairs sessions where `|timeA - timeB| ≤ 30 minutes`
- The confirmed `agreedTime` is the mathematical average of both chosen times
- Shown prominently on `MatchConfirmedScreen` and `ChatLockedScreen`

---

## Setup: Step by Step

### 1. Clone & install
```bash
git clone <repo>
cd dinematch
npm install
cd functions && npm install && cd ..
```

### 2. Firebase project
1. Go to [console.firebase.google.com](https://console.firebase.google.com) → New project
2. Enable these services:
   - **Authentication** → Sign-in method → Phone
   - **Firestore** → Create database (production mode)
   - **Realtime Database** → Create database
   - **Storage** → Get started
   - **Functions** → Upgrade to Blaze plan (required for Cloud Functions)
3. Add a **Web app** → copy the config values

### 3. Environment variables
```bash
cp .env.example .env
# Fill in all values in .env
```

### 4. Google Maps & Places
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Enable: **Maps SDK for iOS**, **Maps SDK for Android**, **Places API**
3. Create two API keys (restrict each to the platform)
4. Add to `.env`

### 5. Deploy Firebase config
```bash
npm install -g firebase-tools
firebase login
firebase use --add   # select your project

# Deploy rules, indexes, functions
firebase deploy --only firestore:rules,firestore:indexes,database,storage,functions
```

### 6. Run locally
```bash
npx expo start
# Press i for iOS Simulator, a for Android Emulator
# Scan QR with Expo Go for physical device
```

### 7. Build for stores (EAS)
```bash
npm install -g eas-cli
eas login
eas build --platform all
eas submit --platform all
```

---

## Push Notifications Setup

1. For **iOS**: Create an APNs key in [Apple Developer Console](https://developer.apple.com)
   → Upload to Firebase Console → Project Settings → Cloud Messaging
2. For **Android**: FCM works automatically via Firebase
3. The `notificationService.ts` registers the device token and saves it to `users/{uid}.pushToken`
4. Cloud Functions use this token to send targeted notifications for match requests, acceptances, and chat unlocks

---

## Local Development with Firebase Emulators

```bash
firebase emulators:start
# Opens emulator UI at http://localhost:4000
# Auth: 9099 | Firestore: 8080 | RTDB: 9000 | Functions: 5001 | Storage: 9199
```

Set `USE_EMULATOR=true` in `.env` and add emulator connection logic in `firebase.ts`:
```ts
if (__DEV__) {
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectDatabaseEmulator(rtdb, 'localhost', 9000);
  connectStorageEmulator(storage, 'localhost', 9199);
  connectAuthEmulator(auth, 'http://localhost:9099');
}
```

---

## What's Next (Roadmap)

| Feature | File to create | Notes |
|---------|---------------|-------|
| Post-date rating | `PostDateRatingScreen.tsx` ✓ exists | Thumbs up/down after the date |
| Match history | `ProfileScreen.tsx` ✓ + `historyService.ts` ✓ | Shows past dining dates |
| Report / block | `ReportBlockScreen.tsx` ✓ exists in ExtraScreens | Safety feature |
| Premium: table reservation | `reservationService.ts` ✓ exists | Book via OpenTable/Resy API |
| Elo-style matching | Cloud Function update | Prefer matches that led to 5★ ratings |
| Multiple photos in search card | `MatchIncomingScreen.tsx` | Swipeable photo carousel |
| Group dining (3+ people) | New session type | Future v2 feature |
