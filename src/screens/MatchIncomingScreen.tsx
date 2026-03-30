// ─────────────────────────────────────────────────────────────────────────────
// MatchIncomingScreen.tsx
// Shows when another user sends a dining request — accept or pass
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { respondToMatch } from '../services/matchingService';
import { scheduleMatchReminder, scheduleRatingPrompt } from '../services/notificationService';
import { SearchStackParamList, DiningMatch } from '../types';
import { COLORS, FONTS, SPACING } from '../utils/theme';

type RouteProps = RouteProp<SearchStackParamList, 'MatchIncoming'>;

export function MatchIncomingScreen() {
  const navigation = useNavigation<any>();
  const { match } = useRoute<RouteProps>().params;
  const [loading, setLoading] = useState<'accept' | 'decline' | null>(null);

  const partnerProfile = match.profileA; // they initiated, shown as requester

  const handleAccept = async () => {
    setLoading('accept');
    try {
      await respondToMatch(match.matchId, true);
      // Schedule reminder & rating notification
      await scheduleMatchReminder(match.matchId, match.restaurant.name, partnerProfile.name, match.agreedTime, match.agreedDate);
      await scheduleRatingPrompt(match.matchId, partnerProfile.name, match.agreedTime, match.agreedDate);
      navigation.replace('MatchConfirmed', { matchId: match.matchId });
    } catch {
      Alert.alert('Error', 'Could not accept. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const handleDecline = async () => {
    setLoading('decline');
    try {
      await respondToMatch(match.matchId, false);
      navigation.goBack();
    } finally {
      setLoading(null);
    }
  };

  return (
    <SafeAreaView style={im.container}>
      <ScrollView contentContainerStyle={im.scroll}>
        <Text style={im.requestLabel}>✦ Dining request</Text>

        {/* Photo */}
        <View style={im.photoContainer}>
          {partnerProfile.photos?.[0]
            ? <Image source={{ uri: partnerProfile.photos[0] }} style={im.photo} />
            : <View style={im.photoPlaceholder}><Text style={im.photoInitial}>{partnerProfile.name[0]}</Text></View>
          }
        </View>

        <Text style={im.name}>{partnerProfile.name}, {partnerProfile.age}</Text>

        {/* Food tags */}
        <View style={im.tagRow}>
          {partnerProfile.foodLikes.slice(0, 3).map(f => (
            <View key={f} style={im.tag}><Text style={im.tagText}>{f}</Text></View>
          ))}
        </View>

        {partnerProfile.foodDislikes.length > 0 && (
          <Text style={im.avoids}>Avoids: {partnerProfile.foodDislikes.slice(0, 2).join(', ')}</Text>
        )}

        {/* Dining details */}
        <View style={im.detailCard}>
          <View style={im.detailRow}>
            <Text style={im.detailLabel}>Restaurant</Text>
            <Text style={im.detailValue}>{match.restaurant.name}</Text>
          </View>
          <View style={im.detailRow}>
            <Text style={im.detailLabel}>Wants to go at</Text>
            <Text style={[im.detailValue, { color: COLORS.rust }]}>
              {formatTime12h(match.agreedTime)} · {match.agreedDate}
            </Text>
          </View>
          <View style={im.detailRow}>
            <Text style={im.detailLabel}>Distance</Text>
            <Text style={im.detailValue}>{match.restaurant.distanceKm.toFixed(1)} km away</Text>
          </View>
        </View>

        <Text style={im.note}>
          No chat until you're both within 100m of the restaurant. You're choosing based on profile and food taste — keep it genuine!
        </Text>
      </ScrollView>

      <View style={im.actions}>
        <TouchableOpacity style={im.declineBtn} onPress={handleDecline} disabled={!!loading}>
          <Text style={im.declineBtnText}>Pass</Text>
        </TouchableOpacity>
        <TouchableOpacity style={im.acceptBtn} onPress={handleAccept} disabled={!!loading} activeOpacity={0.85}>
          <Text style={im.acceptBtnText}>
            {loading === 'accept' ? 'Accepting…' : 'Accept dining date ✓'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const im = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  scroll: { padding: SPACING.md, alignItems: 'center', paddingBottom: 100 },
  requestLabel: { fontFamily: FONTS.sans, fontSize: 11, letterSpacing: 2, color: COLORS.rust, textTransform: 'uppercase', marginBottom: 16 },
  photoContainer: { marginBottom: 16 },
  photo: { width: 160, height: 200, borderRadius: 20 },
  photoPlaceholder: { width: 160, height: 200, borderRadius: 20, backgroundColor: '#f5dcc0', alignItems: 'center', justifyContent: 'center' },
  photoInitial: { fontFamily: FONTS.serifDisplay, fontSize: 60, color: COLORS.rust },
  name: { fontFamily: FONTS.serifDisplay, fontSize: 30, color: COLORS.deepBrown, marginBottom: 10 },
  tagRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 6 },
  tag: { paddingHorizontal: 12, paddingVertical: 5, backgroundColor: '#fde8d8', borderRadius: 50, borderWidth: 0.5, borderColor: '#e8c0a0' },
  tagText: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.rust },
  avoids: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted, marginBottom: 16 },
  detailCard: { width: '100%', backgroundColor: '#f5e8d8', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 0.5, borderColor: COLORS.border },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  detailLabel: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted },
  detailValue: { fontFamily: FONTS.sans, fontSize: 13, fontWeight: '500', color: COLORS.brown },
  note: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted, textAlign: 'center', lineHeight: 18, paddingHorizontal: 10 },
  actions: { flexDirection: 'row', gap: 10, padding: SPACING.md, borderTopWidth: 0.5, borderTopColor: '#e8d8c8' },
  declineBtn: { flex: 1, padding: 14, borderRadius: 14, borderWidth: 0.5, borderColor: COLORS.border, alignItems: 'center' },
  declineBtnText: { fontFamily: FONTS.sans, fontSize: 14, color: COLORS.muted },
  acceptBtn: { flex: 2, padding: 14, borderRadius: 14, backgroundColor: COLORS.rust, alignItems: 'center' },
  acceptBtnText: { fontFamily: FONTS.sansMedium, fontSize: 15, color: COLORS.cream },
});

function formatTime12h(t: string) {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}
