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
    user: null,
    filters: DEFAULT_FILTERS,
    isLoading: true,
    isProfileComplete: false,

    setFilters: (filters) => {
      set({ filters });
      // Persist to Firestore if logged in
      const { user } = get();
      if (user?.uid) {
        updateDoc(doc(db, COLLECTIONS.USERS, user.uid), { filters })
          .catch(console.error);
      }
    },

    updateProfile: async (partial) => {
      const { user } = get();
      if (!user?.uid) return;

      const updated = { ...user, ...partial, updatedAt: Date.now() } as UserProfile;
      await setDoc(doc(db, COLLECTIONS.USERS, user.uid), updated, { merge: true });
      set({ user: updated, isProfileComplete: isComplete(updated) });
    },

    signOut: async () => {
      profileUnsub?.();
      profileUnsub = null;
      await firebaseSignOut(auth);
      set({ user: null, isLoading: false, isProfileComplete: false });
    },

    // Called once from App.tsx — sets up Firebase auth listener
    _init: () => {
      const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
        if (!fbUser) {
          profileUnsub?.();
          profileUnsub = null;
          set({ user: null, isLoading: false, isProfileComplete: false });
          return;
        }

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
              // New user — profile not created yet, but auth is successful.
              // Create a basic stub profile in memory with uid so ProfileSetup can work.
              set({ 
                user: { uid: fbUser.uid } as UserProfile, 
                isProfileComplete: false, 
                isLoading: false 
              });
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
