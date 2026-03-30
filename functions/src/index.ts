/**
 * DineMatch Cloud Functions
 * Deploy with: firebase deploy --only functions
 *
 * Install deps:  cd functions && npm install
 * Node version:  18
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db   = admin.firestore();
const rtdb = admin.database();

const SESSION_EXPIRE_H   = 2;
const TIME_WINDOW_MIN    = 30;
const MATCH_REQUEST_TTL  = 10 * 60 * 1000; // 10 minutes to accept/decline

// ─── Types (mirror src/types/index.ts) ────────────────────────────────────────
interface SearchSession {
  sessionId: string;
  userId: string;
  userProfile: any;
  restaurantId: string;
  restaurant: any;
  desiredTime: string;
  desiredDate: string;
  filters: any;
  status: 'searching' | 'matched' | 'expired';
  createdAt: number;
  expiresAt: number;
}

// ─── 1. Trigger: New search session → try to find a match ─────────────────────
export const onSessionCreated = functions.firestore
  .document('searchSessions/{sessionId}')
  .onCreate(async (snap, context) => {
    const session = snap.data() as SearchSession;
    if (session.status !== 'searching') return;

    // Find compatible sessions
    const now = Date.now();
    const candidatesSnap = await db.collection('searchSessions')
      .where('restaurantId', '==', session.restaurantId)
      .where('desiredDate', '==', session.desiredDate)
      .where('status', '==', 'searching')
      .get();

    const candidates: SearchSession[] = [];
    candidatesSnap.forEach(doc => {
      const s = doc.data() as SearchSession;
      if (s.sessionId === session.sessionId) return;
      if (s.expiresAt < now) return;
      if (!timesOverlap(session.desiredTime, s.desiredTime, TIME_WINDOW_MIN)) return;
      if (!passesGenderFilter(session.filters, s.userProfile.gender)) return;
      if (!passesGenderFilter(s.filters, session.userProfile.gender)) return;
      if (!passesAgeFilter(session.filters, s.userProfile.age)) return;
      if (!passesAgeFilter(s.filters, session.userProfile.age)) return;
      candidates.push(s);
    });

    if (candidates.length === 0) return;

    // Pick best candidate (closest time match)
    const best = candidates.reduce((prev, curr) =>
      Math.abs(timeDiff(session.desiredTime, curr.desiredTime)) <
      Math.abs(timeDiff(session.desiredTime, prev.desiredTime)) ? curr : prev
    );

    // Create the match
    const matchId = db.collection('matches').doc().id;
    const agreedTime = averageTime(session.desiredTime, best.desiredTime);
    const now2 = Date.now();

    const match = {
      matchId,
      sessionIdA: session.sessionId,
      sessionIdB: best.sessionId,
      userIdA:    session.userId,
      userIdB:    best.userId,
      profileA:   session.userProfile,
      profileB:   best.userProfile,
      restaurant: session.restaurant,
      agreedTime,
      agreedDate: session.desiredDate,
      status:     'pending',
      chatStatus: 'locked',
      userANearby: false,
      userBNearby: false,
      initiatedBy: 'A',
      createdAt:   now2,
      updatedAt:   now2,
      expiresAt:   now2 + MATCH_REQUEST_TTL,
    };

    const batch = db.batch();
    batch.set(db.doc(`matches/${matchId}`), match);
    batch.update(db.doc(`searchSessions/${session.sessionId}`), { status: 'matched' });
    batch.update(db.doc(`searchSessions/${best.sessionId}`), { status: 'matched' });
    await batch.commit();

    // Send push notification to userB (the recipient of the dining request)
    await sendMatchNotification(best.userId, session.userProfile.name, session.restaurant.name);
    functions.logger.info(`Match created: ${matchId} between ${session.userId} and ${best.userId}`);
  });

// ─── 2. Trigger: Proximity update → unlock chat when both nearby ──────────────
export const onProximityUpdate = functions.database
  .ref('proximity/{matchId}/{userId}')
  .onWrite(async (change, context) => {
    const { matchId } = context.params;

    // Get all proximity data for this match
    const proxSnap = await rtdb.ref(`proximity/${matchId}`).once('value');
    const proxData = proxSnap.val();
    if (!proxData) return;

    const updates = Object.values(proxData) as any[];
    const allNearby = updates.length >= 2 && updates.every((u: any) => u.isNearby === true);

    if (!allNearby) return;

    // Check current chat status
    const matchDoc = await db.doc(`matches/${matchId}`).get();
    if (!matchDoc.exists) return;
    const matchData = matchDoc.data()!;
    if (matchData.chatStatus === 'unlocked') return; // already unlocked

    // Unlock chat
    await db.doc(`matches/${matchId}`).update({
      chatStatus:      'unlocked',
      chatUnlockedAt:  Date.now(),
      updatedAt:       Date.now(),
    });

    // Notify both users
    await sendChatUnlockedNotification(matchData.userIdA, matchData.userIdB, matchData.restaurant.name);
    functions.logger.info(`Chat unlocked for match ${matchId}`);
  });

// ─── 3. Scheduled: Expire old sessions + pending matches ─────────────────────
export const cleanupExpired = functions.pubsub
  .schedule('every 30 minutes')
  .onRun(async () => {
    const now = Date.now();

    // Expire old sessions
    const sessionsSnap = await db.collection('searchSessions')
      .where('status', '==', 'searching')
      .where('expiresAt', '<', now)
      .get();
    const sessionBatch = db.batch();
    sessionsSnap.forEach(doc => sessionBatch.update(doc.ref, { status: 'expired' }));
    await sessionBatch.commit();

    // Expire pending matches that weren't responded to
    const matchesSnap = await db.collection('matches')
      .where('status', '==', 'pending')
      .where('expiresAt', '<', now)
      .get();
    const matchBatch = db.batch();
    matchesSnap.forEach(doc => matchBatch.update(doc.ref, { status: 'expired', updatedAt: now }));
    await matchBatch.commit();

    functions.logger.info(`Cleaned up ${sessionsSnap.size} sessions, ${matchesSnap.size} matches`);
  });

// ─── 4. Trigger: Match accepted → notify initiator ────────────────────────────
export const onMatchAccepted = functions.firestore
  .document('matches/{matchId}')
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after  = change.after.data();

    if (before.status === after.status) return;

    if (after.status === 'accepted') {
      await sendMatchAcceptedNotification(
        after.userIdA,
        after.profileB.name,
        after.restaurant.name,
        after.agreedTime,
      );
    }
  });

// ─── Push Notification helpers ────────────────────────────────────────────────
async function sendMatchNotification(
  toUserId: string, fromName: string, restaurantName: string,
): Promise<void> {
  const token = await getPushToken(toUserId);
  if (!token) return;

  await admin.messaging().send({
    token,
    notification: {
      title: `✦ Dining request from ${fromName}!`,
      body:  `${fromName} wants to dine with you at ${restaurantName}. Accept?`,
    },
    data: { type: 'match_request' },
    apns: { payload: { aps: { sound: 'match-sound.wav', badge: 1 } } },
  });
}

async function sendMatchAcceptedNotification(
  toUserId: string, partnerName: string, restaurantName: string, time: string,
): Promise<void> {
  const token = await getPushToken(toUserId);
  if (!token) return;

  await admin.messaging().send({
    token,
    notification: {
      title: `🎉 It's a Dining Match!`,
      body:  `${partnerName} accepted! You're meeting at ${restaurantName} at ${formatTime(time)}.`,
    },
    data: { type: 'match_accepted' },
    apns: { payload: { aps: { sound: 'default', badge: 1 } } },
  });
}

async function sendChatUnlockedNotification(
  userIdA: string, userIdB: string, restaurantName: string,
): Promise<void> {
  const [tokenA, tokenB] = await Promise.all([
    getPushToken(userIdA),
    getPushToken(userIdB),
  ]);

  const msg = {
    notification: {
      title: '💬 Chat is now open!',
      body:  `You're both at ${restaurantName}. Say hello!`,
    },
    data: { type: 'chat_unlocked' },
  };

  const sends = [];
  if (tokenA) sends.push(admin.messaging().send({ ...msg, token: tokenA }));
  if (tokenB) sends.push(admin.messaging().send({ ...msg, token: tokenB }));
  await Promise.all(sends);
}

async function getPushToken(userId: string): Promise<string | null> {
  const userDoc = await db.doc(`users/${userId}`).get();
  return userDoc.data()?.pushToken ?? null;
}

// ─── Time helpers ─────────────────────────────────────────────────────────────
function toMins(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function timeDiff(a: string, b: string): number {
  return toMins(a) - toMins(b);
}
function timesOverlap(a: string, b: string, window: number): boolean {
  return Math.abs(timeDiff(a, b)) <= window;
}
function averageTime(a: string, b: string): string {
  const avg = Math.round((toMins(a) + toMins(b)) / 2);
  return `${Math.floor(avg / 60).toString().padStart(2, '0')}:${(avg % 60).toString().padStart(2, '0')}`;
}
function passesGenderFilter(filters: any, gender: string): boolean {
  return filters.showGender === 'everyone' || filters.showGender === gender;
}
function passesAgeFilter(filters: any, age: number): boolean {
  return age >= filters.ageMin && age <= filters.ageMax;
}
function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}
