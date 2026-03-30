// ─────────────────────────────────────────────────────────────────────────────
// MatchConfirmedScreen.tsx
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { doc, getDoc } from 'firebase/firestore';
import { db, COLLECTIONS } from '../services/firebase';
import { DiningMatch, SearchStackParamList } from '../types';
import { COLORS, FONTS, SPACING } from '../utils/theme';

type RouteProps = RouteProp<SearchStackParamList, 'MatchConfirmed'>;

export function MatchConfirmedScreen() {
  const navigation = useNavigation<any>();
  const { matchId } = useRoute<RouteProps>().params;
  const [match, setMatch] = React.useState<DiningMatch | null>(null);

  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    getDoc(doc(db, COLLECTIONS.MATCHES, matchId)).then(snap => {
      if (snap.exists()) setMatch(snap.data() as DiningMatch);
    });
    Animated.spring(scaleAnim, {
      toValue: 1, useNativeDriver: true, damping: 10, stiffness: 120, delay: 200,
    }).start();
  }, [matchId]);

  if (!match) return null;

  const partner = match.userIdA === match.userIdA ? match.profileB : match.profileA;

  return (
    <SafeAreaView style={mc.container}>
      <Animated.View style={[mc.content, { transform: [{ scale: scaleAnim }] }]}>
        <Text style={mc.emoji}>🎉</Text>
        <Text style={mc.title}>It's a Dining Match!</Text>
        <Text style={mc.sub}>
          You and {match.profileB.name} are heading to {match.restaurant.name}!
        </Text>
      </Animated.View>

      <View style={mc.card}>
        <Row label="Restaurant" value={match.restaurant.name} />
        <Row label="Agreed time" value={`${formatTime12h(match.agreedTime)} · ${match.agreedDate}`} accent />
        <Row label="Chat opens" value="When both of you are within 100m" />
      </View>

      <View style={mc.privacyNote}>
        <Text style={mc.privacyText}>
          🔒  Your location is never shared with your partner. Only proximity to the restaurant is tracked.
        </Text>
      </View>

      <TouchableOpacity
        style={mc.goBtn}
        onPress={() => navigation.replace('ChatLocked', { matchId })}
        activeOpacity={0.85}
      >
        <Text style={mc.goBtnText}>I'm heading there now →</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={mc.row}>
      <Text style={mc.rowLabel}>{label}</Text>
      <Text style={[mc.rowValue, accent && { color: COLORS.orange }]}>{value}</Text>
    </View>
  );
}

function formatTime12h(t: string) {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

const mc = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.deepBrown, alignItems: 'center', justifyContent: 'center' },
  content: { alignItems: 'center', marginBottom: 24 },
  emoji: { fontSize: 64, marginBottom: 10 },
  title: { fontFamily: FONTS.serifDisplay, fontSize: 34, color: COLORS.cream, textAlign: 'center' },
  sub: { fontFamily: FONTS.sans, fontSize: 14, color: '#c4956a', textAlign: 'center', marginTop: 8, paddingHorizontal: 30, lineHeight: 20 },
  card: { width: '88%', backgroundColor: '#3d2010', borderRadius: 16, padding: 16, marginBottom: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: '#5a3020' },
  rowLabel: { fontFamily: FONTS.sans, fontSize: 12, color: '#a07050' },
  rowValue: { fontFamily: FONTS.sans, fontSize: 13, fontWeight: '500', color: COLORS.cream },
  privacyNote: { width: '88%', padding: 12, backgroundColor: '#1e0e02', borderRadius: 10, marginBottom: 20 },
  privacyText: { fontFamily: FONTS.sans, fontSize: 11, color: '#a07050', lineHeight: 16 },
  goBtn: { width: '88%', backgroundColor: COLORS.orange, borderRadius: 14, padding: 16, alignItems: 'center' },
  goBtnText: { fontFamily: FONTS.sansMedium, fontSize: 16, color: COLORS.cream },
});


// ─────────────────────────────────────────────────────────────────────────────
// MatchHistoryScreen.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { FlatList, Image } from 'react-native';
import { getMatchHistory, MatchHistoryItem } from '../services/historyService';
import { useAuthStore } from '../hooks/useAuthStore';

export function MatchHistoryScreen() {
  const { user } = useAuthStore();
  const [history, setHistory] = React.useState<MatchHistoryItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  useEffect(() => {
    if (!user) return;
    getMatchHistory(user.uid).then(h => { setHistory(h); setLoading(false); });
  }, [user?.uid]);

  return (
    <SafeAreaView style={mh.container}>
      <Text style={mh.title}>Past Dining Dates</Text>
      <FlatList
        data={history}
        keyExtractor={item => item.matchId}
        contentContainerStyle={{ padding: SPACING.md, paddingBottom: 40 }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Text style={{ fontSize: 40 }}>🍽️</Text>
            <Text style={[mh.emptyText, { marginTop: 12 }]}>No dining dates yet</Text>
            <Text style={mh.emptySubText}>Start searching to find your first dining companion!</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={mh.card}>
            <View style={mh.cardLeft}>
              {item.partnerPhoto
                ? <Image source={{ uri: item.partnerPhoto }} style={mh.avatar} />
                : <View style={mh.avatarPlaceholder}><Text style={mh.avatarInitial}>{item.partnerName[0]}</Text></View>
              }
            </View>
            <View style={mh.cardInfo}>
              <Text style={mh.cardName}>{item.partnerName}</Text>
              <Text style={mh.cardResto}>{item.restaurantName}</Text>
              <Text style={mh.cardDate}>{new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
            </View>
            <View style={mh.ratingBadge}>
              {item.myRating === 'up'
                ? <Text style={mh.ratingUp}>👍</Text>
                : item.myRating === 'down'
                ? <Text style={mh.ratingDown}>👎</Text>
                : <Text style={mh.ratingPending}>Rate?</Text>
              }
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const mh = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  title: { fontFamily: FONTS.serifDisplay, fontSize: 26, color: COLORS.deepBrown, padding: SPACING.md },
  emptyText: { fontFamily: FONTS.serifDisplay, fontSize: 20, color: COLORS.brown },
  emptySubText: { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.muted, marginTop: 6, textAlign: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5e8d8', borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 0.5, borderColor: COLORS.border },
  cardLeft: { marginRight: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarPlaceholder: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#f5dcc0', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontFamily: FONTS.serifDisplay, fontSize: 20, color: COLORS.rust },
  cardInfo: { flex: 1 },
  cardName: { fontFamily: FONTS.sansMedium, fontSize: 15, color: COLORS.deepBrown },
  cardResto: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted, marginTop: 2 },
  cardDate: { fontFamily: FONTS.sans, fontSize: 11, color: COLORS.muted, marginTop: 2 },
  ratingBadge: { padding: 8 },
  ratingUp: { fontSize: 22 },
  ratingDown: { fontSize: 22 },
  ratingPending: { fontFamily: FONTS.sans, fontSize: 11, color: COLORS.rust, textDecorationLine: 'underline' },
});


// ─────────────────────────────────────────────────────────────────────────────
// ReportBlockScreen.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { Alert as RNAlert, TextInput as TI } from 'react-native';
import { doc as fsDoc, setDoc as fsSetDoc, updateDoc as fsUpdateDoc, arrayUnion } from 'firebase/firestore';

const REPORT_REASONS = [
  'Inappropriate photos',
  'Harassment or abusive messages',
  'No-show to the dining date',
  'Fake profile',
  'Spam',
  'Other',
];

export function ReportBlockScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { matchId, partnerUid, partnerName } = route.params;
  const { user } = useAuthStore();

  const [selectedReason, setSelectedReason] = React.useState('');
  const [details, setDetails] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [action, setAction] = React.useState<'report' | 'block'>('report');

  const handleSubmit = async () => {
    if (!selectedReason || !user) return;
    setSubmitting(true);
    try {
      // Write report to Firestore
      await fsSetDoc(fsDoc(db, 'reports', `${user.uid}_${partnerUid}_${Date.now()}`), {
        reportedBy: user.uid,
        reportedUser: partnerUid,
        matchId,
        reason: selectedReason,
        details: details.trim(),
        action,
        createdAt: Date.now(),
        status: 'pending',
      });

      // If blocking: add to user's blocked list
      if (action === 'block') {
        await fsUpdateDoc(fsDoc(db, COLLECTIONS.USERS, user.uid), {
          blockedUsers: arrayUnion(partnerUid),
        });
      }

      RNAlert.alert(
        action === 'block' ? 'User blocked' : 'Report submitted',
        action === 'block'
          ? `${partnerName} has been blocked. You won't see them again.`
          : 'Thank you. Our team will review this within 24 hours.',
        [{ text: 'OK', onPress: () => navigation.popToTop() }],
      );
    } catch {
      RNAlert.alert('Error', 'Could not submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={rb.container}>
      <View style={rb.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={COLORS.brown} />
        </TouchableOpacity>
        <Text style={rb.headerTitle}>Report or block</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={rb.scroll}>
        <Text style={rb.partnerName}>{partnerName}</Text>

        {/* Action toggle */}
        <View style={rb.actionToggle}>
          {(['report', 'block'] as const).map(a => (
            <TouchableOpacity
              key={a} style={[rb.actionBtn, action === a && rb.actionBtnActive]}
              onPress={() => setAction(a)}
            >
              <Text style={[rb.actionBtnText, action === a && rb.actionBtnTextActive]}>
                {a === 'report' ? '🚩 Report' : '🚫 Block'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={rb.sectionLabel}>REASON</Text>
        {REPORT_REASONS.map(r => (
          <TouchableOpacity
            key={r} style={rb.reasonRow}
            onPress={() => setSelectedReason(r)}
          >
            <View style={[rb.radio, selectedReason === r && rb.radioActive]} />
            <Text style={rb.reasonText}>{r}</Text>
          </TouchableOpacity>
        ))}

        <Text style={[rb.sectionLabel, { marginTop: 20 }]}>ADDITIONAL DETAILS (optional)</Text>
        <TI
          style={rb.detailsInput}
          placeholder="Tell us more…"
          placeholderTextColor={COLORS.muted}
          value={details}
          onChangeText={setDetails}
          multiline
          maxLength={300}
        />

        <TouchableOpacity
          style={[rb.submitBtn, (!selectedReason || submitting) && rb.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!selectedReason || submitting}
        >
          <Text style={rb.submitBtnText}>
            {submitting ? 'Submitting…' : action === 'block' ? 'Block & report' : 'Submit report'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const rb = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md, borderBottomWidth: 0.5, borderBottomColor: '#e8d8c8' },
  headerTitle: { fontFamily: FONTS.sansMedium, fontSize: 16, color: COLORS.deepBrown },
  scroll: { padding: SPACING.md },
  partnerName: { fontFamily: FONTS.serifDisplay, fontSize: 22, color: COLORS.deepBrown, marginBottom: 16 },
  actionToggle: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  actionBtn: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 0.5, borderColor: COLORS.border, alignItems: 'center', backgroundColor: '#fdf0e3' },
  actionBtnActive: { backgroundColor: '#fde8d8', borderColor: COLORS.rust },
  actionBtnText: { fontFamily: FONTS.sans, fontSize: 14, color: COLORS.brown },
  actionBtnTextActive: { color: COLORS.rust, fontWeight: '500' },
  sectionLabel: { fontFamily: FONTS.sans, fontSize: 10, color: COLORS.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#f0e0d0' },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: COLORS.border },
  radioActive: { borderColor: COLORS.rust, backgroundColor: COLORS.rust },
  reasonText: { fontFamily: FONTS.sans, fontSize: 14, color: COLORS.brown },
  detailsInput: { backgroundColor: '#f5e8d8', borderRadius: 12, padding: 12, fontFamily: FONTS.sans, fontSize: 14, color: COLORS.deepBrown, height: 90, textAlignVertical: 'top', borderWidth: 0.5, borderColor: COLORS.border },
  submitBtn: { marginTop: 24, backgroundColor: '#c0392b', borderRadius: 14, padding: 15, alignItems: 'center' },
  submitBtnDisabled: { backgroundColor: COLORS.border },
  submitBtnText: { fontFamily: FONTS.sansMedium, fontSize: 15, color: COLORS.cream },
});


// ─────────────────────────────────────────────────────────────────────────────
// PremiumReserveScreen.tsx — Reserve a table at the matched restaurant
// Uses restaurant's booking URL or a direct API like OpenTable / Dineout
// ─────────────────────────────────────────────────────────────────────────────
import { Linking } from 'react-native';

export function PremiumReserveScreen() {
  const route = useRoute<any>();
  const { matchId, match } = route.params as { matchId: string; match: DiningMatch };
  const [isPremium, setIsPremium] = React.useState(false); // check from user doc
  const { user } = useAuthStore();

  const party = 2; // always 2 for a dining date

  const openOpenTable = () => {
    // OpenTable deep link format
    const date = match.agreedDate;
    const time = match.agreedTime.replace(':', '%3A');
    const restaurantId = match.restaurant.placeId; // map to OpenTable rid in your DB
    const url = `https://www.opentable.com/restref/client/?rid=${restaurantId}&datetime=${date}T${time}&covers=${party}`;
    Linking.openURL(url);
  };

  const openDineout = () => {
    // Dineout is popular in India
    Linking.openURL(`https://www.dineout.co.in/restaurant-search?q=${encodeURIComponent(match.restaurant.name)}`);
  };

  return (
    <SafeAreaView style={pr.container}>
      <View style={pr.header}>
        <TouchableOpacity onPress={() => useNavigation<any>().goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.brown} />
        </TouchableOpacity>
        <Text style={pr.headerTitle}>Reserve a table</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={pr.scroll}>
        {/* Premium badge */}
        {!isPremium && (
          <View style={pr.premiumBanner}>
            <Text style={pr.premiumIcon}>⭐</Text>
            <View>
              <Text style={pr.premiumTitle}>DineMatch Premium</Text>
              <Text style={pr.premiumSub}>Reserve tables instantly — no phone calls needed</Text>
            </View>
          </View>
        )}

        {/* Match summary */}
        <View style={pr.restoCard}>
          <Text style={pr.restoEmoji}>🍽️</Text>
          <View>
            <Text style={pr.restoName}>{match.restaurant.name}</Text>
            <Text style={pr.restoDetail}>{match.agreedDate} · {formatTime12h(match.agreedTime)} · 2 people</Text>
          </View>
        </View>

        <Text style={pr.sectionLabel}>BOOK A TABLE VIA</Text>

        {/* Booking options */}
        <TouchableOpacity style={pr.bookBtn} onPress={openOpenTable}>
          <View>
            <Text style={pr.bookBtnTitle}>OpenTable</Text>
            <Text style={pr.bookBtnSub}>Popular worldwide · Free to book</Text>
          </View>
          <Ionicons name="open-outline" size={18} color={COLORS.rust} />
        </TouchableOpacity>

        <TouchableOpacity style={pr.bookBtn} onPress={openDineout}>
          <View>
            <Text style={pr.bookBtnTitle}>Dineout</Text>
            <Text style={pr.bookBtnSub}>Best for India · Cashback offers available</Text>
          </View>
          <Ionicons name="open-outline" size={18} color={COLORS.rust} />
        </TouchableOpacity>

        <TouchableOpacity
          style={pr.bookBtn}
          onPress={() => Linking.openURL(`tel:${match.restaurant.address}`)}
        >
          <View>
            <Text style={pr.bookBtnTitle}>Call the restaurant</Text>
            <Text style={pr.bookBtnSub}>Speak to them directly</Text>
          </View>
          <Ionicons name="call-outline" size={18} color={COLORS.rust} />
        </TouchableOpacity>

        <Text style={pr.note}>
          DineMatch doesn't take bookings directly yet. Premium plan will include direct in-app reservations powered by our restaurant partners.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const pr = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md, borderBottomWidth: 0.5, borderBottomColor: '#e8d8c8' },
  headerTitle: { fontFamily: FONTS.sansMedium, fontSize: 16, color: COLORS.deepBrown },
  scroll: { padding: SPACING.md },
  premiumBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff8e8', borderRadius: 14, padding: 14, marginBottom: 20, borderWidth: 0.5, borderColor: '#f0d080' },
  premiumIcon: { fontSize: 28 },
  premiumTitle: { fontFamily: FONTS.sansMedium, fontSize: 14, color: '#7a5800' },
  premiumSub: { fontFamily: FONTS.sans, fontSize: 12, color: '#a07820', marginTop: 2 },
  restoCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f5e8d8', borderRadius: 14, padding: 14, marginBottom: 20, borderWidth: 0.5, borderColor: COLORS.border },
  restoEmoji: { fontSize: 30 },
  restoName: { fontFamily: FONTS.sansMedium, fontSize: 16, color: COLORS.deepBrown },
  restoDetail: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted, marginTop: 2 },
  sectionLabel: { fontFamily: FONTS.sans, fontSize: 10, color: COLORS.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  bookBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fdf0e3', borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 0.5, borderColor: COLORS.border },
  bookBtnTitle: { fontFamily: FONTS.sansMedium, fontSize: 15, color: COLORS.deepBrown },
  bookBtnSub: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted, marginTop: 2 },
  note: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted, marginTop: 16, lineHeight: 18 },
});
