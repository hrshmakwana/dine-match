import * as Location from 'expo-location';
import { ref, set, onValue, off } from 'firebase/database';
import { updateDoc, doc } from 'firebase/firestore';
import { rtdb, db, RTDB_PATHS, COLLECTIONS } from './firebase';
import { DiningMatch, LatLng, ProximityUpdate } from '../types';

const PROXIMITY_THRESHOLD_METERS = 100;
const LOCATION_UPDATE_INTERVAL_MS = 15_000;   // every 15 seconds

let _locationSubscription: Location.LocationSubscription | null = null;
let _proximityListenerRefs: { [matchId: string]: ReturnType<typeof onValue> } = {};

// ─── Request location permissions ────────────────────────────────────────────
export async function requestLocationPermission(): Promise<boolean> {
  const { status: fg } = await Location.requestForegroundPermissionsAsync();
  if (fg !== 'granted') return false;

  const { status: bg } = await Location.requestBackgroundPermissionsAsync();
  // Background is preferred but not strictly required
  return true;
}

// ─── Start watching location for a match ────────────────────────────────────
// Pushes proximity updates to Realtime DB every 15s.
// The Cloud Function (or the other device) listens and unlocks chat when both near.
export async function startProximityTracking(
  matchId: string,
  userId: string,
  restaurantCoords: LatLng,
  onChatUnlocked: () => void,
): Promise<void> {
  if (_locationSubscription) stopProximityTracking(matchId);

  _locationSubscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: LOCATION_UPDATE_INTERVAL_MS,
      distanceInterval: 10,   // also update if moved 10m
    },
    async (location) => {
      const { latitude, longitude } = location.coords;
      const dist = haversineMeters(
        { latitude, longitude },
        restaurantCoords,
      );
      const isNearby = dist <= PROXIMITY_THRESHOLD_METERS;

      const update: ProximityUpdate = {
        userId,
        isNearby,
        distanceMeters: Math.round(dist),
        updatedAt: Date.now(),
      };

      // Push to Realtime DB (fast, low-latency)
      await set(
        ref(rtdb, RTDB_PATHS.proximity(matchId, userId)),
        update,
      );
    },
  );

  // Listen to both users' proximity to unlock chat
  listenForChatUnlock(matchId, userId, onChatUnlocked);
}

// ─── Stop tracking ────────────────────────────────────────────────────────────
export function stopProximityTracking(matchId: string): void {
  _locationSubscription?.remove();
  _locationSubscription = null;

  const r = ref(rtdb, `proximity/${matchId}`);
  off(r);
}

// ─── Listen to both users' proximity and unlock chat ─────────────────────────
function listenForChatUnlock(
  matchId: string,
  myUserId: string,
  onUnlocked: () => void,
): void {
  const matchRef = ref(rtdb, `proximity/${matchId}`);

  onValue(matchRef, async (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    const updates = Object.values(data) as ProximityUpdate[];
    const allNearby = updates.length >= 2 && updates.every((u) => u.isNearby);

    if (allNearby) {
      // Unlock chat in Firestore
      try {
        await updateDoc(doc(db, COLLECTIONS.MATCHES, matchId), {
          chatStatus: 'unlocked',
          chatUnlockedAt: Date.now(),
          updatedAt: Date.now(),
        });
        onUnlocked();
      } catch (err) {
        console.error('Failed to unlock chat:', err);
      }
    }
  });
}

// ─── Get current proximity status for display ────────────────────────────────
export async function getProximityStatus(
  matchId: string,
): Promise<{ [userId: string]: ProximityUpdate }> {
  return new Promise((resolve) => {
    const matchRef = ref(rtdb, `proximity/${matchId}`);
    onValue(
      matchRef,
      (snapshot) => {
        resolve(snapshot.val() || {});
      },
      { onlyOnce: true },
    );
  });
}

// ─── Listen to proximity updates for UI display ───────────────────────────────
export function listenToProximity(
  matchId: string,
  onUpdate: (updates: { [userId: string]: ProximityUpdate }) => void,
): () => void {
  const matchRef = ref(rtdb, `proximity/${matchId}`);
  onValue(matchRef, (snapshot) => {
    onUpdate(snapshot.val() || {});
  });
  return () => off(matchRef);
}

// ─── Haversine distance formula ───────────────────────────────────────────────
export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000; // Earth radius in meters
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
