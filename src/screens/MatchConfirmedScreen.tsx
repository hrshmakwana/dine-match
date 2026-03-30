import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity,
  Easing, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { doc, getDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db, COLLECTIONS } from '../services/firebase';
import { DiningMatch, SearchStackParamList } from '../types';
import { useAuthStore } from '../hooks/useAuthStore';
import { COLORS, FONTS, SPACING } from '../utils/theme';

type RouteProps = RouteProp<SearchStackParamList, 'MatchConfirmed'>;

const { width } = Dimensions.get('window');
const CONFETTI_COUNT = 24;
const CONFETTI_COLORS = [COLORS.orange, COLORS.rust, '#f5dcc0', '#fdf6ef', '#e8c060'];

export default function MatchConfirmedScreen() {
  const navigation = useNavigation<any>();
  const { matchId } = useRoute<RouteProps>().params;
  const { user } = useAuthStore();

  const [match, setMatch] = useState<DiningMatch | null>(null);

  // Entrance anims
  const scale   = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const slide   = useRef(new Animated.Value(40)).current;

  // Confetti anims
  const confettiAnims = useRef(
    Array.from({ length: CONFETTI_COUNT }, () => ({
      x:     new Animated.Value(Math.random() * width),
      y:     new Animated.Value(-20),
      rot:   new Animated.Value(0),
      opacity: new Animated.Value(1),
    }))
  ).current;

  useEffect(() => {
    // Load match
    getDoc(doc(db, COLLECTIONS.MATCHES, matchId)).then(snap => {
      if (snap.exists()) setMatch(snap.data() as DiningMatch);
    });

    // Entrance
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 9, stiffness: 120 }),
      Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();

    Animated.timing(slide, {
      toValue: 0, duration: 450, delay: 200,
      useNativeDriver: true, easing: Easing.out(Easing.cubic),
    }).start();

    // Confetti drop
    confettiAnims.forEach((anim, i) => {
      const delay = i * 60;
      const duration = 1400 + Math.random() * 800;
      Animated.parallel([
        Animated.timing(anim.y, {
          toValue: Dimensions.get('window').height + 40,
          duration, delay, useNativeDriver: true,
        }),
        Animated.timing(anim.rot, {
          toValue: 1, duration, delay, useNativeDriver: true,
        }),
        Animated.timing(anim.opacity, {
          toValue: 0, duration: 300, delay: duration + delay - 300, useNativeDriver: true,
        }),
      ]).start();
    });
  }, [matchId]);

  if (!match) return null;

  const isUserA = match.userIdA === user?.uid;
  const partner = isUserA ? match.profileB : match.profileA;

  return (
    <View style={styles.container}>
      {/* Confetti layer */}
      {confettiAnims.map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.confettiPiece,
            {
              backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              left: Math.random() * width,
              opacity: anim.opacity,
              transform: [
                { translateY: anim.y },
                { rotate: anim.rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${180 + Math.random() * 360}deg`] }) },
              ],
            },
          ]}
        />
      ))}

      <SafeAreaView style={styles.safe}>
        {/* ── Hero ──────────────────────────────────────────────────── */}
        <Animated.View style={[styles.hero, { opacity, transform: [{ scale }] }]}>
          <Text style={styles.heroEmoji}>🎉</Text>
          <Text style={styles.heroTitle}>It's a Dining Match!</Text>
          <Text style={styles.heroSub}>
            You and {partner.name} are going out to eat. No awkward intros — just show up!
          </Text>
        </Animated.View>

        {/* ── Partner preview ──────────────────────────────────────── */}
        <Animated.View
          style={[styles.partnerCard, { opacity, transform: [{ translateY: slide }] }]}
        >
          <View style={styles.partnerAvatarRow}>
            <View style={styles.partnerAvatar}>
              <Text style={styles.partnerAvatarText}>{partner.name[0]}</Text>
            </View>
            <View>
              <Text style={styles.partnerName}>{partner.name}, {partner.age}</Text>
              <View style={styles.likesRow}>
                {partner.foodLikes.slice(0, 3).map(l => (
                  <View key={l} style={styles.likeTag}><Text style={styles.likeTagText}>{l}</Text></View>
                ))}
              </View>
            </View>
          </View>
        </Animated.View>

        {/* ── Date details card ────────────────────────────────────── */}
        <Animated.View
          style={[styles.dateCard, { opacity, transform: [{ translateY: slide }] }]}
        >
          <View style={styles.dateRow}>
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>RESTAURANT</Text>
              <Text style={styles.dateValue}>{match.restaurant.name}</Text>
            </View>
            <View style={styles.dateDivider} />
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>AGREED TIME</Text>
              <Text style={[styles.dateValue, { color: COLORS.orange }]}>
                {formatTime(match.agreedTime)} ✓
              </Text>
            </View>
          </View>

          <View style={styles.dateCardDivider} />

          {/* Chat lock info */}
          <View style={styles.lockRow}>
            <Ionicons name="lock-closed-outline" size={15} color="#a07050" />
            <Text style={styles.lockText}>
              Chat unlocks automatically when you're both within 100m of {match.restaurant.name}.
              No texts until you're almost there — just arrive and say hi!
            </Text>
          </View>

          {/* Privacy note */}
          <View style={styles.privacyRow}>
            <Ionicons name="shield-checkmark-outline" size={14} color={COLORS.muted} />
            <Text style={styles.privacyText}>
              Location sharing is only used to detect proximity to the restaurant.
              {partner.name} cannot see where you are.
            </Text>
          </View>
        </Animated.View>

        {/* ── CTA ──────────────────────────────────────────────────── */}
        <Animated.View style={[styles.ctaArea, { opacity, transform: [{ translateY: slide }] }]}>
          <TouchableOpacity
            style={styles.goBtn}
            onPress={() => navigation.replace('ChatLocked', { matchId })}
            activeOpacity={0.87}
          >
            <Text style={styles.goBtnText}>I'm heading there now →</Text>
          </TouchableOpacity>
          <Text style={styles.reminder}>
            Keep your location on while you travel to the restaurant
          </Text>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.deepBrown },
  safe: { flex: 1, paddingHorizontal: SPACING.md, justifyContent: 'center', gap: 16 },

  // Confetti
  confettiPiece: {
    position: 'absolute', width: 9, height: 9,
    borderRadius: 2, top: 0,
  },

  // Hero
  hero: { alignItems: 'center', paddingHorizontal: 20 },
  heroEmoji: { fontSize: 58, marginBottom: 8 },
  heroTitle: {
    fontFamily: FONTS.serifDisplay, fontSize: 32,
    color: COLORS.cream, textAlign: 'center',
  },
  heroSub: {
    fontFamily: FONTS.sans, fontSize: 14,
    color: '#c4956a', textAlign: 'center', marginTop: 8, lineHeight: 21,
  },

  // Partner
  partnerCard: {
    backgroundColor: '#3d2010', borderRadius: 16, padding: 14,
  },
  partnerAvatarRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  partnerAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#5a3020', borderWidth: 2, borderColor: COLORS.orange,
    alignItems: 'center', justifyContent: 'center',
  },
  partnerAvatarText: { fontFamily: FONTS.serifDisplay, fontSize: 20, color: COLORS.orange },
  partnerName: { fontFamily: FONTS.serifDisplay, fontSize: 18, color: COLORS.cream },
  likesRow: { flexDirection: 'row', gap: 5, marginTop: 4, flexWrap: 'wrap' },
  likeTag: {
    backgroundColor: '#5a3020', borderRadius: 50,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  likeTagText: { fontFamily: FONTS.sans, fontSize: 11, color: '#e8c09a' },

  // Date card
  dateCard: { backgroundColor: '#3d2010', borderRadius: 16, padding: 16 },
  dateRow: { flexDirection: 'row', alignItems: 'flex-start' },
  dateItem: { flex: 1 },
  dateDivider: { width: 0.5, backgroundColor: '#5a3020', marginHorizontal: 14, alignSelf: 'stretch' },
  dateLabel: { fontFamily: FONTS.sans, fontSize: 10, color: '#a07050', letterSpacing: 1, textTransform: 'uppercase' },
  dateValue: { fontFamily: FONTS.sansMedium, fontSize: 15, color: COLORS.cream, marginTop: 3 },
  dateCardDivider: { height: 0.5, backgroundColor: '#5a3020', marginVertical: 12 },
  lockRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 10 },
  lockText: { fontFamily: FONTS.sans, fontSize: 12, color: '#c4956a', flex: 1, lineHeight: 18 },
  privacyRow: { flexDirection: 'row', gap: 7, alignItems: 'flex-start' },
  privacyText: { fontFamily: FONTS.sans, fontSize: 11, color: '#a07050', flex: 1, lineHeight: 16 },

  // CTA
  ctaArea: { gap: 8 },
  goBtn: {
    backgroundColor: COLORS.orange, borderRadius: 16,
    paddingVertical: 15, alignItems: 'center',
  },
  goBtnText: { fontFamily: FONTS.sansMedium, fontSize: 16, color: COLORS.cream },
  reminder: { fontFamily: FONTS.sans, fontSize: 11, color: '#a07050', textAlign: 'center' },
});
