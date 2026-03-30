// ─── chatService.ts ───────────────────────────────────────────────────────────
// (Save as src/services/chatService.ts)

import {
  collection, addDoc, onSnapshot, query,
  orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db, COLLECTIONS } from './firebase';
import { ChatMessage } from '../types';
import { generateId } from '../utils/helpers';

export async function sendMessage(
  matchId: string,
  senderId: string,
  text: string,
): Promise<void> {
  const msg: Omit<ChatMessage, 'messageId'> = {
    senderId,
    text: text.trim(),
    createdAt: Date.now(),
  };
  await addDoc(collection(db, COLLECTIONS.messages(matchId)), msg);
}

export function listenToMessages(
  matchId: string,
  onMessages: (msgs: ChatMessage[]) => void,
): () => void {
  const q = query(
    collection(db, COLLECTIONS.messages(matchId)),
    orderBy('createdAt', 'asc'),
  );
  return onSnapshot(q, (snap) => {
    const msgs = snap.docs.map((d) => ({ messageId: d.id, ...d.data() } as ChatMessage));
    onMessages(msgs);
  });
}
