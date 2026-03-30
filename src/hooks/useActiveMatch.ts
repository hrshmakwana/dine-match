import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, COLLECTIONS } from '../services/firebase';
import { DiningMatch } from '../types';
import { useAuthStore } from './useAuthStore';

interface ActiveMatchState {
  match: DiningMatch | null;
  isLoading: boolean;
}

/**
 * Listens in real-time for an accepted, non-expired match for the current user.
 * Used by the "My Date" tab to know whether to show the chat or an empty state.
 */
export function useActiveMatch(): ActiveMatchState {
  const { firebaseUser } = useAuthStore();
  const [state, setState] = useState<ActiveMatchState>({ match: null, isLoading: true });

  useEffect(() => {
    if (!firebaseUser) {
      setState({ match: null, isLoading: false });
      return;
    }

    const uid = firebaseUser.uid;

    // Listen to matches where this user is participant A or B, status = accepted
    const qA = query(
      collection(db, COLLECTIONS.MATCHES),
      where('userIdA', '==', uid),
      where('status', '==', 'accepted'),
    );
    const qB = query(
      collection(db, COLLECTIONS.MATCHES),
      where('userIdB', '==', uid),
      where('status', '==', 'accepted'),
    );

    let matchFromA: DiningMatch | null = null;
    let matchFromB: DiningMatch | null = null;
    let loadedA = false;
    let loadedB = false;

    const resolve = () => {
      if (!loadedA || !loadedB) return;
      const found = matchFromA ?? matchFromB ?? null;
      setState({ match: found, isLoading: false });
    };

    const unsubA = onSnapshot(qA, (snap) => {
      matchFromA = snap.empty ? null : (snap.docs[0].data() as DiningMatch);
      loadedA = true;
      resolve();
    });

    const unsubB = onSnapshot(qB, (snap) => {
      matchFromB = snap.empty ? null : (snap.docs[0].data() as DiningMatch);
      loadedB = true;
      resolve();
    });

    return () => {
      unsubA();
      unsubB();
    };
  }, [firebaseUser?.uid]);

  return state;
}
