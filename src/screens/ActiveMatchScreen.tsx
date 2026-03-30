import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useActiveMatch } from '../hooks/useActiveMatch';
import { COLORS, FONTS, SPACING } from '../utils/theme';

export default function ActiveMatchScreen() {
  const navigation = useNavigation<any>();
  const { match, isLoading } = useActiveMatch();

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={COLORS.rust} />
      </SafeAreaView>
    );
  }

  // No active match — show empty state
  if (!match) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Date</Text>
        </View>

        <View style={styles.emptyContainer}>
          {/* Illustrated plate */}
          <View style={styles.plateCircle}>
            <Text style={styles.plateEmoji}>🍽️</Text>
          </View>

          <Text style={styles.emptyTitle}>No dining date yet</Text>
          <Text style={styles.emptySub}>
            Pick a restaurant, choose a time, and find a dining companion.
            Once you match, your date details will appear here.
          </Text>

          <View style={styles.stepsRow}>
            <Step num="1" label="Choose restaurant" />
            <View style={styles.stepArrow}><Ionicons name="arrow-forward" size={14} color={COLORS.muted} /></View>
            <Step num="2" label="Pick a time" />
            <View style={styles.stepArrow}><Ionicons name="arrow-forward" size={14} color={COLORS.muted} /></View>
            <Step num="3" label="Get matched" />
          </View>

          <TouchableOpacity
            style={styles.findBtn}
            onPress={() => navigation.navigate('Restaurants')}
            activeOpacity={0.85}
          >
            <Text style={styles.findBtnText}>Find a restaurant →</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Has active match — show the date card and navigate to chat
  const chatScreen = match.chatStatus === 'unlocked' ? 'ChatUnlocked' : 'ChatLocked';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Date</Text>
        <View style={styles.activeBadge}>
          <View style={styles.activeDot} />
          <Text style={styles.activeBadgeText}>Active</Text>
        </View>
      </View>

      {/* Date summary card */}
      <View style={styles.matchCard}>
        {/* Partner row */}
        <View style={styles.partnerRow}>
          <View style={styles.partnerAvatar}>
            <Text style={styles.partnerAvatarText}>
              {match.profileB.name[0]}
            </Text>
          </View>
          <View style={styles.partnerInfo}>
            <Text style={styles.partnerName}>{match.profileB.name}, {match.profileB.age}</Text>
            <Text style={styles.partnerSub}>Your dining companion</Text>
          </View>
          <View style={styles.matchStatusPill}>
            <Text style={styles.matchStatusText}>
              {match.chatStatus === 'unlocked' ? '💬 Chat open' : '🔒 Chat locked'}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Restaurant + time */}
        <View style={styles.detailRow}>
          <View style={styles.detailItem}>
            <Ionicons name="restaurant-outline" size={14} color={COLORS.muted} />
            <Text style={styles.detailLabel}>Restaurant</Text>
            <Text style={styles.detailValue}>{match.restaurant.name}</Text>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailItem}>
            <Ionicons name="time-outline" size={14} color={COLORS.muted} />
            <Text style={styles.detailLabel}>Agreed time</Text>
            <Text style={[styles.detailValue, { color: COLORS.orange }]}>
              {formatTime(match.agreedTime)} ✓
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Chat status explanation */}
        {match.chatStatus === 'locked' ? (
          <View style={styles.lockInfo}>
            <Ionicons name="lock-closed-outline" size={14} color="#a07050" />
            <Text style={styles.lockInfoText}>
              Chat unlocks when you're both within 100m of {match.restaurant.name}.
              Keep location on while travelling.
            </Text>
          </View>
        ) : (
          <View style={styles.unlockInfo}>
            <View style={styles.greenDot} />
            <Text style={styles.unlockInfoText}>
              You're both there — chat is open!
            </Text>
          </View>
        )}

        {/* CTA */}
        <TouchableOpacity
          style={styles.goBtn}
          onPress={() => navigation.navigate('Restaurants', {
            screen: chatScreen,
            params: { matchId: match.matchId },
          })}
          activeOpacity={0.85}
        >
          <Text style={styles.goBtnText}>
            {match.chatStatus === 'unlocked' ? 'Open chat →' : "I'm heading there →"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Privacy reminder */}
      <View style={styles.privacyNote}>
        <Ionicons name="shield-checkmark-outline" size={14} color={COLORS.muted} />
        <Text style={styles.privacyText}>
          Your exact location is never shared with {match.profileB.name}.
          Only proximity to the restaurant is detected.
        </Text>
      </View>
    </SafeAreaView>
  );
}

function Step({ num, label }: { num: string; label: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNum}>
        <Text style={styles.stepNumText}>{num}</Text>
      </View>
      <Text style={styles.stepLabel}>{label}</Text>
    </View>
  );
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.cream },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: '#e8d8c8',
  },
  headerTitle: { fontFamily: FONTS.serifDisplay, fontSize: 26, color: COLORS.deepBrown },
  activeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#e8f5e2', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 50, borderWidth: 0.5, borderColor: '#b8dba0',
  },
  activeDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#4a9a2a' },
  activeBadgeText: { fontFamily: FONTS.sans, fontSize: 12, color: '#2a6a10' },

  // Empty state
  emptyContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 28,
  },
  plateCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#f5e8d8', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#e8c8a0', marginBottom: 20,
  },
  plateEmoji: { fontSize: 44 },
  emptyTitle: { fontFamily: FONTS.serifDisplay, fontSize: 24, color: COLORS.deepBrown, textAlign: 'center' },
  emptySub: {
    fontFamily: FONTS.sans, fontSize: 14, color: COLORS.muted,
    textAlign: 'center', lineHeight: 21, marginTop: 8, marginBottom: 24,
  },
  stepsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginBottom: 28,
  },
  step: { alignItems: 'center', gap: 5 },
  stepNum: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: COLORS.rust, alignItems: 'center', justifyContent: 'center',
  },
  stepNumText: { fontFamily: FONTS.sansMedium, fontSize: 12, color: COLORS.cream },
  stepLabel: { fontFamily: FONTS.sans, fontSize: 10, color: COLORS.muted, textAlign: 'center', maxWidth: 60 },
  stepArrow: { paddingBottom: 14 },
  findBtn: {
    backgroundColor: COLORS.rust, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 28,
  },
  findBtnText: { fontFamily: FONTS.sansMedium, fontSize: 15, color: COLORS.cream },

  // Match card
  matchCard: {
    margin: SPACING.md, backgroundColor: COLORS.cream,
    borderRadius: 20, borderWidth: 0.5, borderColor: COLORS.border,
    padding: 16,
    shadowColor: '#3a2010', shadowOpacity: 0.06,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  partnerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  partnerAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#fde8d8', borderWidth: 2, borderColor: COLORS.orange,
    alignItems: 'center', justifyContent: 'center',
  },
  partnerAvatarText: { fontFamily: FONTS.serifDisplay, fontSize: 20, color: COLORS.rust },
  partnerInfo: { flex: 1 },
  partnerName: { fontFamily: FONTS.serifDisplay, fontSize: 18, color: COLORS.deepBrown },
  partnerSub: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted, marginTop: 1 },
  matchStatusPill: {
    backgroundColor: '#f5e8d8', borderRadius: 50,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 0.5, borderColor: COLORS.border,
  },
  matchStatusText: { fontFamily: FONTS.sans, fontSize: 11, color: COLORS.brown },

  divider: { height: 0.5, backgroundColor: '#e8d8c8', marginVertical: 14 },

  detailRow: { flexDirection: 'row' },
  detailItem: { flex: 1, alignItems: 'center', gap: 4 },
  detailDivider: { width: 0.5, backgroundColor: '#e8d8c8', marginHorizontal: 10 },
  detailLabel: { fontFamily: FONTS.sans, fontSize: 11, color: COLORS.muted, marginTop: 4 },
  detailValue: { fontFamily: FONTS.sansMedium, fontSize: 14, color: COLORS.brown },

  lockInfo: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#fdf0e3', borderRadius: 10, padding: 12,
    borderWidth: 0.5, borderColor: '#e8d0b8',
  },
  lockInfoText: { fontFamily: FONTS.sans, fontSize: 12, color: '#a07050', flex: 1, lineHeight: 18 },
  unlockInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#e8f5e2', borderRadius: 10, padding: 12,
    borderWidth: 0.5, borderColor: '#b8dba0',
  },
  greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4a9a2a' },
  unlockInfoText: { fontFamily: FONTS.sans, fontSize: 13, color: '#2a5a10' },

  goBtn: {
    marginTop: 14, backgroundColor: COLORS.rust,
    borderRadius: 12, paddingVertical: 13, alignItems: 'center',
  },
  goBtnText: { fontFamily: FONTS.sansMedium, fontSize: 15, color: COLORS.cream },

  privacyNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 7,
    paddingHorizontal: SPACING.md,
  },
  privacyText: { fontFamily: FONTS.sans, fontSize: 11, color: COLORS.muted, flex: 1, lineHeight: 16 },
});
