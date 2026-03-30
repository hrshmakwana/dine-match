import { create } from 'zustand';
import {
  onAuthStateChanged, signOut as firebaseSignOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, COLLECTIONS } from '../services/firebase';
import { UserProfile, SearchFilters, DEFAULT_FILTERS } from '../types';

// ─── Store shape ──────────────────────────────────────────────────────────────
interface AuthState {
  // Firebase auth user
  firebaseUser: FirebaseUser | null;

  // DineMatch profile (from Firestore)
  user: UserProfile | null;

  // Persisted search filters (loaded with profile)
  filters: SearchFilters;

  // App state
  isLoading: boolean;
  isProfileComplete: boolean;

  // Actions
  setFilters: (filters: SearchFilters) => void;
  updateProfile: (partial: Partial<UserProfile>) => Promise<void>;
  signOut: () => Promise<void>;
  _init: () => () => void;   // called once in App.tsx
}

// ─── Store implementation ─────────────────────────────────────────────────────
export const useAuthStore = create<AuthState>((set, get) => {
  let profileUnsub: (() => void) | null = null;

  return {
    firebaseUser: null,
    user: null,
    filters: DEFAULT_FILTERS,
    isLoading: true,
    isProfileComplete: false,

    setFilters: (filters) => {
      set({ filters });
      // Persist to Firestore if logged in
      const { firebaseUser } = get();
      if (firebaseUser) {
        updateDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid), { filters })
          .catch(console.error);
      }
    },

    updateProfile: async (partial) => {
      const { firebaseUser } = get();
      if (!firebaseUser) return;

      const updated = { ...get().user, ...partial, updatedAt: Date.now() } as UserProfile;
      await setDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid), updated, { merge: true });
      set({ user: updated, isProfileComplete: isComplete(updated) });
    },

    signOut: async () => {
      profileUnsub?.();
      profileUnsub = null;
      await firebaseSignOut(auth);
      set({ firebaseUser: null, user: null, isLoading: false, isProfileComplete: false });
    },

    // Called once from App.tsx — sets up Firebase auth listener
    _init: () => {
      const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
        if (!fbUser) {
          profileUnsub?.();
          profileUnsub = null;
          set({ firebaseUser: null, user: null, isLoading: false, isProfileComplete: false });
          return;
        }

        set({ firebaseUser: fbUser });

        // Subscribe to Firestore profile doc
        profileUnsub = onSnapshot(
          doc(db, COLLECTIONS.USERS, fbUser.uid),
          (snap) => {
            if (snap.exists()) {
              const profile = snap.data() as UserProfile & { filters?: SearchFilters };
              set({
                user: profile,
                filters: profile.filters ?? DEFAULT_FILTERS,
                isProfileComplete: isComplete(profile),
                isLoading: false,
              });
            } else {
              // New user — profile not created yet
              set({ user: null, isProfileComplete: false, isLoading: false });
            }
          },
          (err) => {
            console.error('Profile listener error:', err);
            set({ isLoading: false });
          },
        );
      });

      return () => {
        unsubAuth();
        profileUnsub?.();
      };
    },
  };
});

// Profile is complete when name + at least 1 photo are set
function isComplete(profile: Partial<UserProfile>): boolean {
  return !!(profile.name && profile.name.length > 0 && profile.photos && profile.photos.length > 0);
}
