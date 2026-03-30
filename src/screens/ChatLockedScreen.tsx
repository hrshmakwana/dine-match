import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { listenToMatch } from '../services/matchingService';
import { startProximityTracking, stopProximityTracking, listenToProximity } from '../services/proximityService';
import { requestLocationPermission } from '../services/proximityService';
import { DiningMatch, ProximityUpdate, SearchStackParamList } from '../types';
import { useAuthStore } from '../hooks/useAuthStore';
import { COLORS, FONTS, SPACING } from '../utils/theme';

type NavProp = NativeStackNavigationProp<SearchStackParamList, 'ChatLocked'>;
type RouteProps = RouteProp<SearchStackParamList, 'ChatLocked'>;

const NEARBY_THRESHOLD = 100; // meters

export default function ChatLockedScreen() {
  const navigation = useNavigation<NavProp>();
  const { matchId } = useRoute<RouteProps>().params;
  const { user } = useAuthStore();

  const [match, setMatch] = useState<DiningMatch | null>(null);
  const [myDistance, setMyDistance] = useState<number | null>(null);
  const [partnerDistance, setPartnerDistance] = useState<number | null>(null);
  const [locationGranted, setLocationGranted] = useState(false);

  // Animated bar widths (0 = far, 1 = at restaurant)
  const myBarAnim      = useRef(new Animated.Value(0)).current;
  const partnerBarAnim = useRef(new Animated.Value(0)).current;
  const unlockPulse    = useRef(new Animated.Value(1)).current;

  // ── Load match + start tracking ──────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    // Listen to match document
    const unsubMatch = listenToMatch(matchId, (m) => {
      setMatch(m);
      // Auto-navigate when chat unlocks
      if (m.chatStatus === 'unlocked') {
        navigation.replace('ChatUnlocked', { matchId });
      }
    });

    // Request location + start tracking
    (async () => {
      const granted = await requestLocationPermission();
      setLocationGranted(granted);
      if (!granted) {
        Alert.alert(
          'Location required',
          'DineMatch needs your location to detect when you arrive at the restaurant and unlock chat.',
          [{ text: 'OK' }],
        );
        return;
      }

      // Start tracking when match loads (we need restaurant coords)
    })();

    // Listen to real-time proximity updates
    const unsubProximity = listenToProximity(matchId, (updates) => {
      if (!user || !match) return;
      const isUserA = match?.userIdA === user.uid;

      const myUpdate    = updates[user.uid] as ProximityUpdate | undefined;
      const partnerUid  = isUserA ? match?.userIdB : match?.userIdA;
      const partnerUpdate = partnerUid ? updates[partnerUid] as ProximityUpdate | undefined : undefined;

      if (myUpdate) {
        setMyDistance(myUpdate.distanceMeters);
        animateBar(myBarAnim, myUpdate.distanceMeters);
      }
      if (partnerUpdate) {
        setPartnerDistance(partnerUpdate.distanceMeters);
        animateBar(partnerBarAnim, partnerUpdate.distanceMeters);
      }
    });

    return () => {
      unsubMatch();
      unsubProximity();
      stopProximityTracking(matchId);
    };
  }, [matchId, user]);

  // Start location tracking once we have match data (need restaurant coords)
  useEffect(() => {
    if (!match || !user || !locationGranted) return;

    startProximityTracking(
      matchId,
      user.uid,
      match.restaurant.coordinates,
      () => {}, // chat unlock handled by listenToMatch above
    );
  }, [match?.matchId, locationGranted]);

  // Animate proximity bar: far = 0%, nearby = 100%
  const animateBar = (anim: Animated.Value, distanceMeters: number) => {
    const FAR_THRESHOLD = 2000; // 2km = 0%
    const pct = Math.max(0, 1 - (distanceMeters - NEARBY_THRESHOLD) / (FAR_THRESHOLD - NEARBY_THRESHOLD));
    Animated.spring(anim, {
      toValue: Math.min(pct, 1),
      useNativeDriver: false,
      damping: 12,
      stiffness: 80,
    }).start();
  };

  // Pulsing lock icon animation
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(unlockPulse, { toValue: 1.1, duration: 700, useNativeDriver: true }),
        Animated.timing(unlockPulse, { toValue: 1,   duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  if (!match) return null;

  const isUserA = match.userIdA === user?.uid;
  const myProfile      = isUserA ? match.profileA : match.profileB;
  const partnerProfile = isUserA ? match.profileB : match.profileA;

  const myNearby      = (myDistance ?? Infinity) <= NEARBY_THRESHOLD;
  const partnerNearby = (partnerDistance ?? Infinity) <= NEARBY_THRESHOLD;

  const formatDistance = (d: number | null) => {
    if (d === null) return '…';
    if (d <= NEARBY_THRESHOLD) return 'You\'re here! ✓';
    if (d >= 1000) return `${(d / 1000).toFixed(1)} km away`;
    return `${Math.round(d)}m away`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.partnerRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{partnerProfile.name[0]}</Text>
          </View>
          <View>
            <Text style={styles.partnerName}>{partnerProfile.name}, {partnerProfile.age}</Text>
            <Text style={styles.restaurantLabel}>
              {match.restaurant.name} · {formatTime(match.agreedTime)}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Lock Banner ─────────────────────────────────────────────────── */}
      <View style={styles.lockBanner}>
        <Animated.View style={{ transform: [{ scale: unlockPulse }] }}>
          <Text style={styles.lockIcon}>🔒</Text>
        </Animated.View>
        <View style={styles.lockTextContainer}>
          <Text style={styles.lockTitle}>Chat is locked</Text>
          <Text style={styles.lockSub}>
            Both of you need to be within {NEARBY_THRESHOLD}m of {match.restaurant.name}
          </Text>
        </View>
      </View>

      {/* ── Proximity Bars ──────────────────────────────────────────────── */}
      <View style={styles.proximitySection}>
        <Text style={styles.sectionLabel}>PROXIMITY TO {match.restaurant.name.toUpperCase()}</Text>

        <ProximityBar
          label="You"
          name={myProfile.name}
          barAnim={myBarAnim}
          distanceText={formatDistance(myDistance)}
          isNearby={myNearby}
          barColor={COLORS.rust}
        />

        <View style={styles.divider} />

        <ProximityBar
          label={partnerProfile.name}
          name={partnerProfile.name}
          barAnim={partnerBarAnim}
          distanceText={formatDistance(partnerDistance)}
          isNearby={partnerNearby}
          barColor="#8a40a0"
        />

        <Text style={styles.proximityNote}>
          {!myNearby && !partnerNearby
            ? 'Keep walking — chat will unlock automatically when you both arrive'
            : myNearby && !partnerNearby
            ? `You're there! Waiting for ${partnerProfile.name}…`
            : !myNearby && partnerNearby
            ? `${partnerProfile.name} is already there — keep going!`
            : 'Both nearby! Unlocking chat…'}
        </Text>
      </View>

      {/* ── Restaurant info ──────────────────────────────────────────────── */}
      <View style={styles.restoCard}>
        <Text style={styles.restoEmoji}>🍽️</Text>
        <View>
          <Text style={styles.restoName}>{match.restaurant.name}</Text>
          <Text style={styles.restoAddress}>{match.restaurant.address}</Text>
          <Text style={styles.restoTime}>Meeting at {formatTime(match.agreedTime)}</Text>
        </View>
      </View>

      {/* ── Privacy note ─────────────────────────────────────────────────── */}
      <View style={styles.privacyNote}>
        <Ionicons name="shield-checkmark-outline" size={14} color={COLORS.muted} />
        <Text style={styles.privacyText}>
          Only proximity to the restaurant is detected. {partnerProfile.name} cannot see your location.
        </Text>
      </View>
    </SafeAreaView>
  );
}

// ─── Proximity Bar component ──────────────────────────────────────────────────
function ProximityBar({
  label, name, barAnim, distanceText, isNearby, barColor,
}: {
  label: string; name: string;
  barAnim: Animated.Value; distanceText: string;
  isNearby: boolean; barColor: string;
}) {
  return (
    <View style={styles.barRow}>
      <View style={styles.barLabelRow}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={[styles.barDistance, { color: isNearby ? '#4a9a2a' : barColor }]}>
          {distanceText}
        </Text>
      </View>
      <View style={styles.barTrack}>
        <Animated.View
          style={[
            styles.barFill,
            {
              backgroundColor: barColor,
              width: barAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
        {/* 100m marker line */}
        <View style={styles.markerLine} />
      </View>
      <View style={styles.markerLabels}>
        <Text style={styles.markerLabelFar}>Far</Text>
        <Text style={[styles.markerLabelNear, { color: barColor }]}>100m ✓</Text>
      </View>
    </View>
  );
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  header: {
    padding: SPACING.md,
    borderBottomWidth: 0.5, borderBottomColor: '#e8d8c8',
  },
  partnerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#e8d0f0', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: FONTS.serifDisplay, fontSize: 18, color: '#8a40a0' },
  partnerName: { fontFamily: FONTS.serifDisplay, fontSize: 17, color: COLORS.deepBrown },
  restaurantLabel: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.rust, marginTop: 1 },

  lockBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    margin: SPACING.md, padding: 14,
    backgroundColor: '#fde8d8', borderRadius: 12,
    borderWidth: 0.5, borderColor: '#e8c0a0',
  },
  lockIcon: { fontSize: 22 },
  lockTextContainer: { flex: 1 },
  lockTitle: { fontFamily: FONTS.sans, fontSize: 14, fontWeight: '500', color: '#a04020' },
  lockSub: { fontFamily: FONTS.sans, fontSize: 12, color: '#c08060', marginTop: 2 },

  proximitySection: { marginHorizontal: SPACING.md, marginBottom: 16 },
  sectionLabel: {
    fontFamily: FONTS.sans, fontSize: 10, color: COLORS.muted,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12,
  },
  divider: { height: 0.5, backgroundColor: '#e8d8c8', marginVertical: 12 },
  barRow: { marginBottom: 4 },
  barLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  barLabel: { fontFamily: FONTS.sans, fontSize: 13, fontWeight: '500', color: COLORS.brown },
  barDistance: { fontFamily: FONTS.sans, fontSize: 12, fontWeight: '500' },
  barTrack: {
    height: 8, backgroundColor: '#e8d0b8', borderRadius: 4, overflow: 'hidden',
    position: 'relative',
  },
  barFill: { height: '100%', borderRadius: 4 },
  markerLine: {
    position: 'absolute', right: 0, top: 0, bottom: 0,
    width: 2, backgroundColor: 'rgba(0,0,0,0.1)',
  },
  markerLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },
  markerLabelFar: { fontFamily: FONTS.sans, fontSize: 10, color: COLORS.muted },
  markerLabelNear: { fontFamily: FONTS.sans, fontSize: 10, fontWeight: '500' },
  proximityNote: {
    fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted,
    textAlign: 'center', marginTop: 10, lineHeight: 18,
  },

  restoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: SPACING.md, padding: 14,
    backgroundColor: '#f5e8d8', borderRadius: 12,
    borderWidth: 0.5, borderColor: '#d4b898',
  },
  restoEmoji: { fontSize: 28 },
  restoName: { fontFamily: FONTS.sans, fontSize: 15, fontWeight: '500', color: COLORS.deepBrown },
  restoAddress: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted, marginTop: 1 },
  restoTime: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.rust, marginTop: 3, fontWeight: '500' },

  privacyNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    marginHorizontal: SPACING.md, marginTop: 14,
  },
  privacyText: { fontFamily: FONTS.sans, fontSize: 11, color: COLORS.muted, flex: 1, lineHeight: 16 },
});
