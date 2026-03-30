// src/services/historyService.ts
// Match history, report/block, and post-date ratings

import {
  collection, doc, setDoc, getDoc, getDocs, updateDoc,
  query, where, orderBy, limit, writeBatch,
} from 'firebase/firestore';
import { db, COLLECTIONS } from './firebase';
import { DiningMatch } from '../types';
import { generateId } from '../utils/helpers';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DatingRating {
  matchId: string;
  ratedBy: string;
  ratedUser: string;
  thumbsUp: boolean;        // true = great date, false = not great
  tags: string[];           // e.g. ['great conversation', 'on time', 'rude']
  createdAt: number;
}

export interface BlockReport {
  id: string;
  reporterId: string;
  reportedUserId: string;
  type: 'block' | 'report';
  reason?: string;          // for reports: 'inappropriate', 'no-show', 'harassment', etc.
  matchId?: string;
  createdAt: number;
}

export interface MatchHistoryItem {
  match: DiningMatch;
  myRating?: DatingRating;
  theirRating?: DatingRating;
}

// ─── Get match history for a user ────────────────────────────────────────────
export async function getMatchHistory(
  userId: string,
  pageSize = 20,
): Promise<MatchHistoryItem[]> {
  const [snapA, snapB] = await Promise.all([
    getDocs(query(
      collection(db, COLLECTIONS.MATCHES),
      where('userIdA', '==', userId),
      where('status', 'in', ['completed', 'accepted']),
      orderBy('createdAt', 'desc'),
      limit(pageSize),
    )),
    getDocs(query(
      collection(db, COLLECTIONS.MATCHES),
      where('userIdB', '==', userId),
      where('status', 'in', ['completed', 'accepted']),
      orderBy('createdAt', 'desc'),
      limit(pageSize),
    )),
  ]);

  const matches: DiningMatch[] = [
    ...snapA.docs.map(d => d.data() as DiningMatch),
    ...snapB.docs.map(d => d.data() as DiningMatch),
  ].sort((a, b) => b.createdAt - a.createdAt).slice(0, pageSize);

  // Load ratings for each match
  const items: MatchHistoryItem[] = await Promise.all(
    matches.map(async (match) => {
      const isUserA = match.userIdA === userId;
      const partnerUid = isUserA ? match.userIdB : match.userIdA;

      const [myRatingSnap, theirRatingSnap] = await Promise.all([
        getDoc(doc(db, 'ratings', `${match.matchId}_${userId}`)),
        getDoc(doc(db, 'ratings', `${match.matchId}_${partnerUid}`)),
      ]);

      return {
        match,
        myRating: myRatingSnap.exists() ? myRatingSnap.data() as DatingRating : undefined,
        theirRating: theirRatingSnap.exists() ? theirRatingSnap.data() as DatingRating : undefined,
      };
    }),
  );

  return items;
}

// ─── Submit post-date rating ──────────────────────────────────────────────────
export async function submitRating(
  matchId: string,
  ratedBy: string,
  ratedUser: string,
  thumbsUp: boolean,
  tags: string[],
): Promise<void> {
  const ratingId = `${matchId}_${ratedBy}`;
  const rating: DatingRating = {
    matchId, ratedBy, ratedUser, thumbsUp, tags,
    createdAt: Date.now(),
  };

  const batch = writeBatch(db);
  batch.set(doc(db, 'ratings', ratingId), rating);

  // Mark match as completed after rating
  batch.update(doc(db, COLLECTIONS.MATCHES, matchId), {
    status: 'completed',
    updatedAt: Date.now(),
  });

  await batch.commit();
}

// ─── Block a user ─────────────────────────────────────────────────────────────
export async function blockUser(
  reporterId: string,
  blockedUserId: string,
  matchId?: string,
): Promise<void> {
  const blockId = generateId('block');
  const record: BlockReport = {
    id: blockId,
    reporterId,
    reportedUserId: blockedUserId,
    type: 'block',
    matchId,
    createdAt: Date.now(),
  };

  await setDoc(doc(db, 'blocks', `${reporterId}_${blockedUserId}`), record);
}

// ─── Report a user ────────────────────────────────────────────────────────────
export async function reportUser(
  reporterId: string,
  reportedUserId: string,
  reason: string,
  matchId?: string,
): Promise<void> {
  const reportId = generateId('report');
  const record: BlockReport = {
    id: reportId,
    reporterId,
    reportedUserId,
    type: 'report',
    reason,
    matchId,
    createdAt: Date.now(),
  };

  await setDoc(doc(db, 'reports', reportId), record);
}

// ─── Check if user is blocked ─────────────────────────────────────────────────
export async function isUserBlocked(myId: string, theirId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'blocks', `${myId}_${theirId}`));
  return snap.exists();
}

// ─── Get list of blocked user IDs ────────────────────────────────────────────
export async function getBlockedUserIds(userId: string): Promise<string[]> {
  const snap = await getDocs(
    query(collection(db, 'blocks'), where('reporterId', '==', userId)),
  );
  return snap.docs.map(d => (d.data() as BlockReport).reportedUserId);
}
