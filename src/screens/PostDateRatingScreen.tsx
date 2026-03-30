// src/screens/PostDateRatingScreen.tsx
// Shown after a dining match is completed — thumbs up/down + tags

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { submitRating } from '../services/historyService';
import { DiningMatch } from '../types';
import { useAuthStore } from '../hooks/useAuthStore';
import { COLORS, FONTS, SPACING } from '../utils/theme';

const POSITIVE_TAGS = [
  'Great conversation', 'Very punctual', 'Good vibes',
  'Food recommendations were great', 'Would dine again', 'Super friendly',
];
const NEGATIVE_TAGS = [
  'No-show', 'Very late', 'Rude', 'Didn\'t match profile',
  'Uncomfortable', 'Bad manners',
];

type RouteParams = { match: DiningMatch };

export default function PostDateRatingScreen() {
  const navigation = useNavigation();
  const { match } = useRoute<RouteProp<{ params: RouteParams }, 'params'>>().params;
  const { user } = useAuthStore();

  const [thumbs, setThumbs] = useState<boolean | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const isUserA = match.userIdA === user?.uid;
  const partner = isUserA ? match.profileB : match.profileA;
  const tags = thumbs === true ? POSITIVE_TAGS : thumbs === false ? NEGATIVE_TAGS : [];

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (thumbs === null || !user) return;
    setSubmitting(true);
    try {
      await submitRating(match.matchId, user.uid, partner.uid, thumbs, selectedTags);
      Alert.alert(
        '✓ Rating submitted',
        'Thanks for your feedback! It helps keep DineMatch great.',
        [{ text: 'Done', onPress: () => navigation.navigate('Main' as never) }],
      );
    } catch (err) {
      Alert.alert('Error', 'Could not submit rating. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>How was your date?</Text>
        <Text style={styles.sub}>
          Your feedback is anonymous and helps improve matches
        </Text>

        {/* Partner info */}
        <View style={styles.partnerCard}>
          <View style={styles.partnerAvatar}>
            <Text style={styles.partnerInitial}>{partner.name[0]}</Text>
          </View>
          <View>
            <Text style={styles.partnerName}>{partner.name}, {partner.age}</Text>
            <Text style={styles.partnerResto}>
              {match.restaurant.name} · {match.agreedDate}
            </Text>
          </View>
        </View>

        {/* Thumbs up / down */}
        <View style={styles.thumbsRow}>
          <TouchableOpacity
            style={[styles.thumbBtn, thumbs === true && styles.thumbBtnUpActive]}
            onPress={() => { setThumbs(true); setSelectedTags([]); }}
            activeOpacity={0.8}
          >
            <Text style={styles.thumbEmoji}>👍</Text>
            <Text style={[styles.thumbLabel, thumbs === true && styles.thumbLabelUp]}>
              Great date!
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.thumbBtn, thumbs === false && styles.thumbBtnDownActive]}
            onPress={() => { setThumbs(false); setSelectedTags([]); }}
            activeOpacity={0.8}
          >
            <Text style={styles.thumbEmoji}>👎</Text>
            <Text style={[styles.thumbLabel, thumbs === false && styles.thumbLabelDown]}>
              Not great
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tags — shown after choosing thumbs */}
        {thumbs !== null && (
          <View style={styles.tagsSection}>
            <Text style={styles.tagsTitle}>What stood out?</Text>
            <View style={styles.tagsWrap}>
              {tags.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={[styles.tag, selectedTags.includes(tag) && styles.tagActive]}
                  onPress={() => toggleTag(tag)}
                >
                  <Text style={[styles.tagText, selectedTags.includes(tag) && styles.tagTextActive]}>
                    {tag}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Submit */}
        {thumbs !== null && (
          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting
              ? <ActivityIndicator color={COLORS.cream} />
              : <Text style={styles.submitBtnText}>Submit rating</Text>}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.skipBtn}
          onPress={() => navigation.navigate('Main' as never)}
        >
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Match History Screen ─────────────────────────────────────────────────────
// src/screens/MatchHistoryScreen.tsx — separate file in production

import { useEffect } from 'react';
import { FlatList } from 'react-native';
import { getMatchHistory, MatchHistoryItem } from '../services/historyService';

export function MatchHistoryScreen() {
  const { user } = useAuthStore();
  const [history, setHistory] = useState<MatchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getMatchHistory(user.uid).then(h => { setHistory(h); setLoading(false); });
  }, [user?.uid]);

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <SafeAreaView style={histStyles.container}>
      <Text style={histStyles.title}>Dining history</Text>

      {loading ? (
        <ActivityIndicator color={COLORS.rust} style={{ marginTop: 40 }} />
      ) : history.length === 0 ? (
        <View style={histStyles.empty}>
          <Text style={histStyles.emptyEmoji}>🍽️</Text>
          <Text style={histStyles.emptyText}>No dining dates yet</Text>
          <Text style={histStyles.emptySub}>Your past dining matches will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={item => item.match.matchId}
          contentContainerStyle={{ padding: SPACING.md }}
          renderItem={({ item }) => {
            const isA = item.match.userIdA === user?.uid;
            const partner = isA ? item.match.profileB : item.match.profileA;
            const rated = !!item.myRating;

            return (
              <View style={histStyles.card}>
                <View style={histStyles.cardRow}>
                  <View style={histStyles.avatar}>
                    <Text style={histStyles.avatarText}>{partner.name[0]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={histStyles.partnerName}>{partner.name}, {partner.age}</Text>
                    <Text style={histStyles.resto}>{item.match.restaurant.name}</Text>
                    <Text style={histStyles.date}>{formatDate(item.match.createdAt)}</Text>
                  </View>
                  <View style={histStyles.ratingBadge}>
                    {rated ? (
                      <Text style={histStyles.ratingEmoji}>
                        {item.myRating!.thumbsUp ? '👍' : '👎'}
                      </Text>
                    ) : (
                      <Text style={histStyles.ratePrompt}>Rate?</Text>
                    )}
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  scroll: { padding: SPACING.md, paddingBottom: 40 },
  title: { fontFamily: FONTS.serifDisplay, fontSize: 28, color: COLORS.deepBrown, marginBottom: 6 },
  sub: { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.muted, marginBottom: 24, lineHeight: 20 },
  partnerCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#f5e8d8', borderRadius: 14, padding: 14,
    borderWidth: 0.5, borderColor: COLORS.border, marginBottom: 28,
  },
  partnerAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#e8d0f0', alignItems: 'center', justifyContent: 'center',
  },
  partnerInitial: { fontFamily: FONTS.serifDisplay, fontSize: 20, color: '#8a40a0' },
  partnerName: { fontFamily: FONTS.sans, fontSize: 16, fontWeight: '500', color: COLORS.deepBrown },
  partnerResto: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted, marginTop: 2 },
  thumbsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  thumbBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 18, borderRadius: 16,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: '#f5e8d8',
  },
  thumbBtnUpActive: { backgroundColor: '#e8f5e2', borderColor: '#4a9a2a' },
  thumbBtnDownActive: { backgroundColor: '#fde8d8', borderColor: COLORS.rust },
  thumbEmoji: { fontSize: 32, marginBottom: 6 },
  thumbLabel: { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.brown },
  thumbLabelUp: { color: '#2a6a10', fontWeight: '500' },
  thumbLabelDown: { color: COLORS.rust, fontWeight: '500' },
  tagsSection: { marginBottom: 24 },
  tagsTitle: { fontFamily: FONTS.sans, fontSize: 13, fontWeight: '500', color: COLORS.brown, marginBottom: 10 },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 50,
    borderWidth: 0.5, borderColor: COLORS.border, backgroundColor: '#f5e8d8',
  },
  tagActive: { backgroundColor: COLORS.rust, borderColor: COLORS.rust },
  tagText: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.brown },
  tagTextActive: { color: COLORS.cream, fontWeight: '500' },
  submitBtn: {
    backgroundColor: COLORS.rust, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginBottom: 12,
  },
  submitBtnDisabled: { backgroundColor: '#d4b898' },
  submitBtnText: { fontFamily: FONTS.sans, fontSize: 15, fontWeight: '500', color: COLORS.cream },
  skipBtn: { alignItems: 'center', paddingVertical: 10 },
  skipText: { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.muted },
});

const histStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  title: {
    fontFamily: FONTS.serifDisplay, fontSize: 24, color: COLORS.deepBrown,
    padding: SPACING.md, paddingBottom: 8,
  },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontFamily: FONTS.serifDisplay, fontSize: 22, color: COLORS.deepBrown },
  emptySub: { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.muted, marginTop: 6 },
  card: {
    backgroundColor: '#f5e8d8', borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 0.5, borderColor: COLORS.border,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.cream, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.border,
  },
  avatarText: { fontFamily: FONTS.serifDisplay, fontSize: 18, color: COLORS.rust },
  partnerName: { fontFamily: FONTS.sans, fontSize: 14, fontWeight: '500', color: COLORS.deepBrown },
  resto: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.rust, marginTop: 1 },
  date: { fontFamily: FONTS.sans, fontSize: 11, color: COLORS.muted, marginTop: 1 },
  ratingBadge: { alignItems: 'center' },
  ratingEmoji: { fontSize: 24 },
  ratePrompt: { fontFamily: FONTS.sans, fontSize: 11, color: COLORS.rust, fontWeight: '500' },
});
