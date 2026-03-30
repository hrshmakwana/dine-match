import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Easing,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { onSnapshot, query, collection, where } from 'firebase/firestore';

import { db, COLLECTIONS } from '../services/firebase';
import {
  createSearchSession, updateSessionFilters,
  findCompatibleSessions, createMatch, cancelSearchSession,
} from '../services/matchingService';
import FilterDrawer from '../components/FilterDrawer';
import { SearchStackParamList, SearchFilters, DiningMatch } from '../types';
import { useAuthStore } from '../hooks/useAuthStore';
import { COLORS, FONTS, SPACING } from '../utils/theme';

// Time slots shown to user
const TIME_SLOTS = [
  '12:00', '12:30', '13:00', '13:30',   // lunch
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00',  // dinner
];

type NavProp = NativeStackNavigationProp<SearchStackParamList, 'Searching'>;
type RouteProps = RouteProp<SearchStackParamList, 'Searching'>;

export default function SearchingScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProps>();
  const { restaurant, filters: initialFilters } = route.params;

  const { user } = useAuthStore();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringAnim1  = useRef(new Animated.Value(0)).current;
  const ringAnim2  = useRef(new Animated.Value(0)).current;

  const [selectedTime, setSelectedTime] = useState<string>('19:00');
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const [filterDrawerVisible, setFilterDrawerVisible] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [searcherCount, setSearcherCount] = useState(0);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  const sessionRef = useRef<string | null>(null);

  // ── Pulse animation ──────────────────────────────────────────────────────
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ]),
    );
    const ring = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 2000, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      );
    pulse.start();
    ring(ringAnim1, 0).start();
    ring(ringAnim2, 600).start();
    return () => { pulse.stop(); ringAnim1.stopAnimation(); ringAnim2.stopAnimation(); };
  }, []);

  // ── Create/refresh session when time or filters change ────────────────────
  useEffect(() => {
    if (!user) return;
    startOrUpdateSession();
  }, [selectedTime, filters]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (sessionRef.current) cancelSearchSession(sessionRef.current);
    };
  }, []);

  const startOrUpdateSession = useCallback(async () => {
    if (!user) return;
    setIsCreatingSession(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      if (sessionRef.current) {
        // Update existing session's filters (no need to recreate)
        await updateSessionFilters(sessionRef.current, filters);
      } else {
        // Create brand new session
        const session = await createSearchSession(
          user,
          restaurant,
          selectedTime,
          today,
          filters,
          { latitude: 0, longitude: 0 },   // replaced by real GPS in production
        );
        sessionRef.current = session.sessionId;
        setSessionId(session.sessionId);
        listenForMatches(session.sessionId);
        listenToSearcherCount();
      }
    } catch (err) {
      Alert.alert('Error', 'Could not start search. Please try again.');
    } finally {
      setIsCreatingSession(false);
    }
  }, [user, restaurant, selectedTime, filters]);

  // ── Listen for incoming match requests ────────────────────────────────────
  const listenForMatches = useCallback((mySessionId: string) => {
    if (!user) return;

    // Listen for matches where this user is userIdB (received request)
    const q = query(
      collection(db, COLLECTIONS.MATCHES),
      where('userIdB', '==', user.uid),
      where('status', '==', 'pending'),
    );

    const unsub = onSnapshot(q, (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const match = change.doc.data() as DiningMatch;
          navigation.navigate('MatchIncoming', { match, sessionId: mySessionId });
          unsub();
        }
      });
    });
  }, [user, navigation]);

  // ── Count other searchers at same restaurant ──────────────────────────────
  const listenToSearcherCount = useCallback(() => {
    const q = query(
      collection(db, COLLECTIONS.SEARCH_SESSIONS),
      where('restaurantId', '==', restaurant.placeId),
      where('status', '==', 'searching'),
    );
    onSnapshot(q, (snap) => setSearcherCount(Math.max(0, snap.size - 1)));
  }, [restaurant.placeId]);

  const handleFiltersChanged = (newFilters: SearchFilters) => {
    setFilters(newFilters);
    setFilterDrawerVisible(false);
    // Session update is triggered by useEffect above
  };

  const ringStyle = (anim: Animated.Value) => ({
    opacity: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 0.3, 0] }),
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.5] }) }],
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.brown} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>{restaurant.name}</Text>
          <Text style={styles.headerSub}>{restaurant.cuisine} · {restaurant.address}</Text>
        </View>
        <View style={styles.counterBadge}>
          <Text style={styles.counterText}>{searcherCount} here</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Time Picker ─────────────────────────────────────────────────── */}
        <View style={styles.timeCard}>
          <Text style={styles.sectionLabel}>WHEN DO YOU WANT TO GO?</Text>
          <Text style={styles.timeHint}>Only matched with people going ±30 min from your time</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeRow}>
            {TIME_SLOTS.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.timeSlot, selectedTime === t && styles.timeSlotActive]}
                onPress={() => setSelectedTime(t)}
              >
                <Text style={[styles.timeSlotText, selectedTime === t && styles.timeSlotTextActive]}>
                  {formatTime(t)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── Pulse animation ──────────────────────────────────────────────── */}
        <View style={styles.pulseContainer}>
          <Animated.View style={[styles.ring, ringStyle(ringAnim1)]} />
          <Animated.View style={[styles.ring, styles.ring2, ringStyle(ringAnim2)]} />
          <Animated.View style={[styles.pulseCircle, { transform: [{ scale: pulseAnim }] }]}>
            <Text style={styles.pulseEmoji}>🍽️</Text>
          </Animated.View>
        </View>

        <Text style={styles.searchingLabel}>
          {isCreatingSession ? 'Setting up your search…' : 'Searching for dining companions…'}
        </Text>

        {/* ── Active Filters Summary ────────────────────────────────────────── */}
        <View style={styles.filterChips}>
          <FilterChip icon="person" label={filters.showGender === 'everyone' ? 'Everyone' : filters.showGender === 'woman' ? 'Women' : 'Men'} />
          <FilterChip icon="calendar" label={`${filters.ageMin}–${filters.ageMax} yrs`} />
          <FilterChip icon="navigate" label={`${filters.maxDistanceKm} km`} />
          {filters.cuisines.slice(0, 2).map(c => <FilterChip key={c} label={c} />)}
        </View>
      </ScrollView>

      {/* ── Filter FAB (always visible) ───────────────────────────────────── */}
      <TouchableOpacity
        style={styles.filterFab}
        onPress={() => setFilterDrawerVisible(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="options-outline" size={22} color={COLORS.cream} />
      </TouchableOpacity>

      {/* ── Filter Drawer ─────────────────────────────────────────────────── */}
      <FilterDrawer
        visible={filterDrawerVisible}
        initialFilters={filters}
        onClose={() => setFilterDrawerVisible(false)}
        onApply={handleFiltersChanged}
      />
    </SafeAreaView>
  );
}

function FilterChip({ icon, label }: { icon?: string; label: string }) {
  return (
    <View style={styles.chip}>
      {icon && <Ionicons name={icon as any} size={11} color={COLORS.rust} style={{ marginRight: 3 }} />}
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: SPACING.md, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: '#e8d8c8',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontFamily: FONTS.serifDisplay, fontSize: 17, color: COLORS.brown },
  headerSub: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted, marginTop: 1 },
  counterBadge: {
    marginLeft: 'auto', backgroundColor: '#fde8d8',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 50,
    borderWidth: 0.5, borderColor: '#e8c0a0',
  },
  counterText: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.rust, fontWeight: '500' },
  scroll: { paddingBottom: 100 },

  // Time picker
  timeCard: {
    margin: SPACING.md, backgroundColor: '#f5e8d8',
    borderRadius: 14, padding: 14,
    borderWidth: 0.5, borderColor: '#d4b898',
  },
  sectionLabel: {
    fontFamily: FONTS.sans, fontSize: 10, color: COLORS.muted,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4,
  },
  timeHint: { fontFamily: FONTS.sans, fontSize: 11, color: '#a07050', marginBottom: 10 },
  timeRow: { flexDirection: 'row' },
  timeSlot: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 9,
    borderWidth: 0.5, borderColor: '#d4b898', backgroundColor: COLORS.cream,
    marginRight: 8,
  },
  timeSlotActive: { backgroundColor: COLORS.rust, borderColor: COLORS.rust },
  timeSlotText: { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.brown },
  timeSlotTextActive: { color: COLORS.cream, fontWeight: '500' },

  // Pulse
  pulseContainer: {
    alignItems: 'center', justifyContent: 'center',
    height: 160, marginTop: 10,
  },
  pulseCircle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: '#fde8d8', borderWidth: 3, borderColor: '#e8803a',
    alignItems: 'center', justifyContent: 'center',
  },
  pulseEmoji: { fontSize: 34 },
  ring: {
    position: 'absolute', width: 120, height: 120,
    borderRadius: 60, borderWidth: 1.5, borderColor: '#e8803a',
  },
  ring2: { width: 155, height: 155, borderRadius: 77.5 },
  searchingLabel: {
    fontFamily: FONTS.sans, fontSize: 14, color: COLORS.muted,
    textAlign: 'center', marginTop: 8,
  },

  // Filter chips
  filterChips: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'center', gap: 6, margin: SPACING.md,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: '#f5e8d8', borderRadius: 50,
    borderWidth: 0.5, borderColor: '#d4b898',
  },
  chipText: { fontFamily: FONTS.sans, fontSize: 11, color: COLORS.brown },

  // FAB
  filterFab: {
    position: 'absolute', bottom: 30, right: 20,
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: COLORS.deepBrown,
    alignItems: 'center', justifyContent: 'center',
    elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
});
