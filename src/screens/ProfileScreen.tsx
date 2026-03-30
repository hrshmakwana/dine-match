import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Alert, Switch, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useAuthStore } from '../hooks/useAuthStore';
import { pickAndUploadPhoto, deletePhoto } from '../services/photoService';
import { getMatchHistory } from '../services/historyService';
import { DiningMatch } from '../types';
import { COLORS, FONTS, SPACING } from '../utils/theme';

const FOOD_LIKES_OPTIONS = [
  '🍕 Italian', '🍱 Japanese', '🌮 Mexican', '🍛 Indian',
  '🥗 Vegan', '🥩 BBQ', '☕ Café', '🍔 American',
];
const FOOD_DISLIKES_OPTIONS = [
  '🌶️ Very spicy', '🥜 Nuts', '🦐 Seafood', '🧀 Dairy', '🍄 Mushrooms', '🧄 Garlic',
];

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { user, firebaseUser, updateProfile, signOut } = useAuthStore();

  const [editMode, setEditMode]         = useState(false);
  const [uploading, setUploading]       = useState<number | null>(null);  // slot index
  const [history, setHistory]           = useState<DiningMatch[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(true);

  // Local edit state
  const [editName, setEditName]         = useState(user?.name ?? '');
  const [editLikes, setEditLikes]       = useState<string[]>(user?.foodLikes ?? []);
  const [editDislikes, setEditDislikes] = useState<string[]>(user?.foodDislikes ?? []);

  useFocusEffect(
    useCallback(() => {
      if (!firebaseUser) return;
      setHistoryLoading(true);
      getMatchHistory(firebaseUser.uid)
        .then(setHistory)
        .finally(() => setHistoryLoading(false));
    }, [firebaseUser]),
  );

  const handlePhotoPress = async (slotIndex: number) => {
    if (!firebaseUser || !user) return;

    const existing = user.photos[slotIndex];

    Alert.alert(
      existing ? 'Replace photo' : 'Add photo',
      existing ? 'Replace or remove this photo?' : 'Choose a photo from your library',
      [
        existing ? {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            const updated = [...user.photos];
            updated.splice(slotIndex, 1);
            await deletePhoto(existing);
            await updateProfile({ photos: updated });
          },
        } : null,
        {
          text: existing ? 'Replace' : 'Choose photo',
          onPress: async () => {
            setUploading(slotIndex);
            try {
              const url = await pickAndUploadPhoto(
                firebaseUser.uid,
                `photo_${slotIndex}`,
                (pct) => console.log(`Upload ${pct}%`),
              );
              const updated = [...user.photos];
              updated[slotIndex] = url;
              await updateProfile({ photos: updated.filter(Boolean) });
            } finally {
              setUploading(null);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ].filter(Boolean) as any[],
    );
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      Alert.alert('Name required', 'Please enter your first name.');
      return;
    }
    await updateProfile({ name: editName.trim(), foodLikes: editLikes, foodDislikes: editDislikes });
    setEditMode(false);
  };

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  };

  const toggleFoodLike = (item: string) =>
    setEditLikes(prev => prev.includes(item) ? prev.filter(x => x !== item) : [...prev, item]);

  const toggleFoodDislike = (item: string) =>
    setEditDislikes(prev => prev.includes(item) ? prev.filter(x => x !== item) : [...prev, item]);

  if (!user) return null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={styles.headerRow}>
          <Text style={styles.pageTitle}>My Profile</Text>
          <TouchableOpacity
            style={styles.editToggle}
            onPress={() => editMode ? handleSaveEdit() : setEditMode(true)}
          >
            <Ionicons name={editMode ? 'checkmark' : 'pencil-outline'} size={16} color={COLORS.rust} />
            <Text style={styles.editToggleText}>{editMode ? 'Save' : 'Edit'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Photo grid ──────────────────────────────────────────────── */}
        <View style={styles.photoGrid}>
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const photoUrl = user.photos[i];
            return (
              <TouchableOpacity
                key={i}
                style={[styles.photoSlot, i === 0 && styles.photoSlotMain]}
                onPress={() => handlePhotoPress(i)}
                activeOpacity={0.8}
              >
                {uploading === i ? (
                  <ActivityIndicator color={COLORS.rust} />
                ) : photoUrl ? (
                  <Image source={{ uri: photoUrl }} style={styles.photoImg} />
                ) : (
                  <View style={styles.photoEmpty}>
                    <Ionicons
                      name="add"
                      size={i === 0 ? 30 : 22}
                      color={COLORS.muted}
                    />
                  </View>
                )}
                {i === 0 && <View style={styles.mainBadge}><Text style={styles.mainBadgeText}>Main</Text></View>}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Name + Age ──────────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.nameRow}>
            <View style={styles.nameAvatar}>
              <Text style={styles.nameAvatarText}>{user.name[0]?.toUpperCase()}</Text>
            </View>
            <View style={styles.nameInfo}>
              <Text style={styles.nameText}>{user.name}, {user.age}</Text>
              <Text style={styles.genderText}>
                {user.gender === 'man' ? 'Man' : user.gender === 'woman' ? 'Woman' : 'Non-binary'}
                {' · '}
                <Text style={{ color: COLORS.rust }}>🍽️ DineMatch member</Text>
              </Text>
            </View>
          </View>
        </View>

        {/* ── Food likes ──────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>FOOD I LOVE</Text>
          <View style={styles.chipWrap}>
            {editMode ? (
              FOOD_LIKES_OPTIONS.map(item => (
                <TouchableOpacity
                  key={item}
                  style={[styles.chip, editLikes.includes(item) && styles.chipActive]}
                  onPress={() => toggleFoodLike(item)}
                >
                  <Text style={[styles.chipText, editLikes.includes(item) && styles.chipTextActive]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              ))
            ) : (
              user.foodLikes.length > 0
                ? user.foodLikes.map(item => (
                    <View key={item} style={styles.chip}>
                      <Text style={styles.chipText}>{item}</Text>
                    </View>
                  ))
                : <Text style={styles.emptyHint}>Tap Edit to add your favourite cuisines</Text>
            )}
          </View>
        </View>

        {/* ── Food dislikes ────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>I AVOID</Text>
          <View style={styles.chipWrap}>
            {editMode ? (
              FOOD_DISLIKES_OPTIONS.map(item => (
                <TouchableOpacity
                  key={item}
                  style={[styles.chip, editDislikes.includes(item) && styles.chipActive]}
                  onPress={() => toggleFoodDislike(item)}
                >
                  <Text style={[styles.chipText, editDislikes.includes(item) && styles.chipTextActive]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              ))
            ) : (
              user.foodDislikes.length > 0
                ? user.foodDislikes.map(item => (
                    <View key={item} style={[styles.chip, styles.chipDislike]}>
                      <Text style={styles.chipText}>{item}</Text>
                    </View>
                  ))
                : <Text style={styles.emptyHint}>Nothing yet</Text>
            )}
          </View>
        </View>

        {/* ── Dining history ──────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DINING HISTORY</Text>
          {historyLoading ? (
            <ActivityIndicator color={COLORS.rust} style={{ marginTop: 10 }} />
          ) : history.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Text style={styles.emptyHistoryEmoji}>🍽️</Text>
              <Text style={styles.emptyHistoryText}>
                Your first dining date will show up here
              </Text>
            </View>
          ) : (
            history.slice(0, 5).map(match => {
              const isA = match.userIdA === firebaseUser?.uid;
              const partner = isA ? match.profileB : match.profileA;
              return (
                <View key={match.matchId} style={styles.historyCard}>
                  <View style={styles.historyAvatar}>
                    <Text style={styles.historyAvatarText}>{partner.name[0]}</Text>
                  </View>
                  <View style={styles.historyInfo}>
                    <Text style={styles.historyName}>{partner.name}, {partner.age}</Text>
                    <Text style={styles.historyResto}>
                      {match.restaurant.name} · {new Date(match.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={styles.historyStatus}>
                    {match.status === 'completed' ? '✓ Dined' : match.status}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        {/* ── Settings ────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SETTINGS</Text>
          <View style={styles.settingCard}>
            <SettingRow
              icon="notifications-outline"
              label="Push notifications"
              right={
                <Switch
                  value={notifEnabled}
                  onValueChange={setNotifEnabled}
                  trackColor={{ true: COLORS.rust, false: '#d4b898' }}
                />
              }
            />
            <SettingRow
              icon="shield-checkmark-outline"
              label="Privacy settings"
              onPress={() => Alert.alert('Coming soon', 'Privacy settings will be available in the next update.')}
            />
            <SettingRow
              icon="star-outline"
              label="Rate DineMatch"
              onPress={() => Alert.alert('Thanks!', 'App store rating coming soon.')}
            />
            <SettingRow
              icon="help-circle-outline"
              label="Help & support"
              onPress={() => Alert.alert('Support', 'Email us at hello@dinematch.app')}
            />
            <SettingRow
              icon="log-out-outline"
              label="Sign out"
              danger
              onPress={handleSignOut}
            />
          </View>
        </View>

        <Text style={styles.version}>DineMatch v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingRow({
  icon, label, right, onPress, danger,
}: {
  icon: string; label: string; right?: React.ReactNode;
  onPress?: () => void; danger?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.settingRow} onPress={onPress} disabled={!onPress && !right}>
      <Ionicons name={icon as any} size={18} color={danger ? '#e03030' : COLORS.muted} />
      <Text style={[styles.settingLabel, danger && styles.settingLabelDanger]}>{label}</Text>
      {right ?? (onPress && <Ionicons name="chevron-forward" size={16} color={COLORS.muted} />)}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  scroll: { paddingBottom: 40 },

  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
  },
  pageTitle: { fontFamily: FONTS.serifDisplay, fontSize: 26, color: COLORS.deepBrown },
  editToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: '#fde8d8', borderRadius: 50,
    borderWidth: 0.5, borderColor: '#e8c0a0',
  },
  editToggleText: { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.rust },

  // Photo grid
  photoGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: SPACING.md, marginBottom: 16,
  },
  photoSlot: {
    width: '31%', aspectRatio: 0.75,
    backgroundColor: '#f5e8d8', borderRadius: 14,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: COLORS.border,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
  },
  photoSlotMain: { width: '64%', aspectRatio: 0.75 },
  photoImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  photoEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mainBadge: {
    position: 'absolute', bottom: 6, left: 6,
    backgroundColor: COLORS.rust, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  mainBadgeText: { fontFamily: FONTS.sans, fontSize: 10, color: COLORS.cream },

  // Name card
  card: {
    marginHorizontal: SPACING.md, marginBottom: 20,
    backgroundColor: COLORS.cream, borderRadius: 16,
    borderWidth: 0.5, borderColor: COLORS.border, padding: 14,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nameAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#fde8d8', borderWidth: 2, borderColor: COLORS.orange,
    alignItems: 'center', justifyContent: 'center',
  },
  nameAvatarText: { fontFamily: FONTS.serifDisplay, fontSize: 22, color: COLORS.rust },
  nameInfo: { flex: 1 },
  nameText: { fontFamily: FONTS.serifDisplay, fontSize: 20, color: COLORS.deepBrown },
  genderText: { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.muted, marginTop: 2 },

  // Sections
  section: { paddingHorizontal: SPACING.md, marginBottom: 24 },
  sectionLabel: {
    fontFamily: FONTS.sans, fontSize: 10, color: COLORS.muted,
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 50,
    borderWidth: 0.5, borderColor: COLORS.border, backgroundColor: '#fdf0e3',
  },
  chipActive: { backgroundColor: COLORS.rust, borderColor: COLORS.rust },
  chipDislike: { backgroundColor: '#fdf0e3', borderColor: '#e8c0a0' },
  chipText: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.brown },
  chipTextActive: { color: COLORS.cream },
  emptyHint: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted, fontStyle: 'italic' },

  // History
  emptyHistory: {
    alignItems: 'center', paddingVertical: 24,
    backgroundColor: '#f5e8d8', borderRadius: 14,
  },
  emptyHistoryEmoji: { fontSize: 32, marginBottom: 8 },
  emptyHistoryText: { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.muted, textAlign: 'center' },
  historyCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#e8d8c8',
  },
  historyAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#fde8d8', alignItems: 'center', justifyContent: 'center',
  },
  historyAvatarText: { fontFamily: FONTS.serifDisplay, fontSize: 16, color: COLORS.rust },
  historyInfo: { flex: 1 },
  historyName: { fontFamily: FONTS.sansMedium, fontSize: 14, color: COLORS.brown },
  historyResto: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted, marginTop: 1 },
  historyStatus: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.rust },

  // Settings
  settingCard: {
    backgroundColor: COLORS.cream, borderRadius: 16,
    borderWidth: 0.5, borderColor: COLORS.border, overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: '#f0e4d4',
  },
  settingLabel: { flex: 1, fontFamily: FONTS.sans, fontSize: 14, color: COLORS.brown },
  settingLabelDanger: { color: '#e03030' },

  version: { fontFamily: FONTS.sans, fontSize: 11, color: COLORS.muted, textAlign: 'center', marginTop: 8 },
});
