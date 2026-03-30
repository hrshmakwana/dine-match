import {
  collection, doc, setDoc, updateDoc, query, where,
  getDocs, onSnapshot, serverTimestamp, Timestamp, writeBatch,
} from 'firebase/firestore';
import { db, COLLECTIONS } from './firebase';
import {
  SearchSession, DiningMatch, UserProfile, Restaurant,
  SearchFilters, MatchStatus,
} from '../types';
import { generateId } from '../utils/helpers';

const SESSION_TTL_MS = 2 * 60 * 60 * 1000;   // 2 hours
const TIME_WINDOW_MIN = 30;                    // ±30 min overlap for matching

// ─── Create a new search session ─────────────────────────────────────────────
export async function createSearchSession(
  user: UserProfile,
  restaurant: Restaurant,
  desiredTime: string,           // "19:00"
  desiredDate: string,           // "2024-12-25"
  filters: SearchFilters,
  userLocation: { latitude: number; longitude: number },
): Promise<SearchSession> {
  const sessionId = generateId('session');
  const now = Date.now();

  const session: SearchSession = {
    sessionId,
    userId: user.uid,
    userProfile: {
      uid: user.uid,
      name: user.name,
      age: user.age,
      gender: user.gender,
      photos: user.photos,
      foodLikes: user.foodLikes,
      foodDislikes: user.foodDislikes,
    },
    restaurantId: restaurant.placeId,
    restaurant,
    desiredTime,
    desiredDate,
    filters,
    userLocation,
    status: 'searching',
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };

  await setDoc(doc(db, COLLECTIONS.SEARCH_SESSIONS, sessionId), session);
  return session;
}

// ─── Update filters on an active session (anytime) ────────────────────────────
export async function updateSessionFilters(
  sessionId: string,
  filters: SearchFilters,
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.SEARCH_SESSIONS, sessionId), {
    filters,
    updatedAt: Date.now(),
  });
}

// ─── Cancel / expire a session ────────────────────────────────────────────────
export async function cancelSearchSession(sessionId: string): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.SEARCH_SESSIONS, sessionId), {
    status: 'expired',
  });
}

// ─── Find compatible sessions at the same restaurant ─────────────────────────
// Called server-side (Cloud Function) or here for simple setups.
// Returns sessions that:
//   1. Are at the same restaurant
//   2. Have overlapping desired times (±30 min)
//   3. Pass mutual gender/age filters
//   4. Are still in 'searching' status
export async function findCompatibleSessions(
  mySession: SearchSession,
): Promise<SearchSession[]> {
  const now = Date.now();

  const q = query(
    collection(db, COLLECTIONS.SEARCH_SESSIONS),
    where('restaurantId', '==', mySession.restaurantId),
    where('desiredDate', '==', mySession.desiredDate),
    where('status', '==', 'searching'),
  );

  const snapshot = await getDocs(q);
  const candidates: SearchSession[] = [];

  snapshot.forEach((docSnap) => {
    const s = docSnap.data() as SearchSession;

    // Skip self
    if (s.userId === mySession.userId) return;

    // Skip expired sessions
    if (s.expiresAt < now) return;

    // Check time overlap
    if (!isTimeCompatible(mySession.desiredTime, s.desiredTime)) return;

    // Check mutual gender filters
    if (!passesGenderFilter(mySession.filters, s.userProfile.gender)) return;
    if (!passesGenderFilter(s.filters, mySession.userProfile.gender)) return;

    // Check mutual age filters
    if (!passesAgeFilter(mySession.filters, s.userProfile.age)) return;
    if (!passesAgeFilter(s.filters, mySession.userProfile.age)) return;

    candidates.push(s);
  });

  return candidates;
}

// ─── Create a match between two sessions ──────────────────────────────────────
export async function createMatch(
  sessionA: SearchSession,
  sessionB: SearchSession,
): Promise<DiningMatch> {
  const matchId = generateId('match');
  const now = Date.now();

  // Agreed time = average of the two desired times
  const agreedTime = averageTime(sessionA.desiredTime, sessionB.desiredTime);

  const match: DiningMatch = {
    matchId,
    sessionIdA: sessionA.sessionId,
    sessionIdB: sessionB.sessionId,
    userIdA: sessionA.userId,
    userIdB: sessionB.userId,
    profileA: sessionA.userProfile,
    profileB: sessionB.userProfile,
    restaurant: sessionA.restaurant,
    agreedTime,
    agreedDate: sessionA.desiredDate,
    status: 'pending',
    chatStatus: 'locked',
    userANearby: false,
    userBNearby: false,
    initiatedBy: 'A',
    createdAt: now,
    updatedAt: now,
  };

  const batch = writeBatch(db);

  // Write match
  batch.set(doc(db, COLLECTIONS.MATCHES, matchId), match);

  // Mark both sessions as matched
  batch.update(doc(db, COLLECTIONS.SEARCH_SESSIONS, sessionA.sessionId), {
    status: 'matched',
  });
  batch.update(doc(db, COLLECTIONS.SEARCH_SESSIONS, sessionB.sessionId), {
    status: 'matched',
  });

  await batch.commit();
  return match;
}

// ─── Accept / decline a match ─────────────────────────────────────────────────
export async function respondToMatch(
  matchId: string,
  accepted: boolean,
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.MATCHES, matchId), {
    status: accepted ? 'accepted' : 'declined',
    updatedAt: Date.now(),
  });
}

// ─── Listen to active match changes ───────────────────────────────────────────
export function listenToMatch(
  matchId: string,
  onUpdate: (match: DiningMatch) => void,
): () => void {
  return onSnapshot(doc(db, COLLECTIONS.MATCHES, matchId), (snap) => {
    if (snap.exists()) onUpdate(snap.data() as DiningMatch);
  });
}

// ─── Get active match for user ────────────────────────────────────────────────
export async function getActiveMatch(userId: string): Promise<DiningMatch | null> {
  const qA = query(
    collection(db, COLLECTIONS.MATCHES),
    where('userIdA', '==', userId),
    where('status', '==', 'accepted'),
  );
  const qB = query(
    collection(db, COLLECTIONS.MATCHES),
    where('userIdB', '==', userId),
    where('status', '==', 'accepted'),
  );

  const [snapA, snapB] = await Promise.all([getDocs(qA), getDocs(qB)]);
  const all = [...snapA.docs, ...snapB.docs];
  if (all.length === 0) return null;
  return all[0].data() as DiningMatch;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isTimeCompatible(timeA: string, timeB: string): boolean {
  const toMins = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  return Math.abs(toMins(timeA) - toMins(timeB)) <= TIME_WINDOW_MIN;
}

function averageTime(timeA: string, timeB: string): string {
  const toMins = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const avg = Math.round((toMins(timeA) + toMins(timeB)) / 2);
  const h = Math.floor(avg / 60).toString().padStart(2, '0');
  const m = (avg % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function passesGenderFilter(
  filters: SearchFilters,
  targetGender: string,
): boolean {
  return filters.showGender === 'everyone' || filters.showGender === targetGender;
}

function passesAgeFilter(filters: SearchFilters, age: number): boolean {
  return age >= filters.ageMin && age <= filters.ageMax;
}
