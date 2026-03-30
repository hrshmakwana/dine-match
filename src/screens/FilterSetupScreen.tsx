import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../hooks/useAuthStore';
import { SearchFilters, DEFAULT_FILTERS, Gender, MealTime } from '../types';
import { COLORS, FONTS, SPACING } from '../utils/theme';

const CUISINES = [
  { emoji: '🍕', label: 'Italian' },
  { emoji: '🍱', label: 'Japanese' },
  { emoji: '🌮', label: 'Mexican' },
  { emoji: '🍛', label: 'Indian' },
  { emoji: '🥗', label: 'Vegan' },
  { emoji: '🥩', label: 'BBQ' },
  { emoji: '☕', label: 'Café' },
  { emoji: '🍔', label: 'American' },
  { emoji: '🧆', label: 'Middle Eastern' },
  { emoji: '🥘', label: 'Mediterranean' },
];

const MEAL_TIMES = [
  { value: 'breakfast' as MealTime, label: 'Breakfast', emoji: '🌅', times: '7–11 AM' },
  { value: 'lunch'     as MealTime, label: 'Lunch',     emoji: '☀️', times: '12–3 PM' },
  { value: 'dinner'    as MealTime, label: 'Dinner',    emoji: '🌙', times: '6–11 PM' },
];

export default function FilterSetupScreen() {
  const navigation = useNavigation<any>();
  const { setFilters } = useAuthStore();

  const [filters, setLocal] = useState<SearchFilters>({
    ...DEFAULT_FILTERS,
    mealTimes: ['dinner'],
  });
  const [saving, setSaving] = useState(false);

  const handleGender = (g: SearchFilters['showGender']) =>
    setLocal(f => ({ ...f, showGender: g }));

  const toggleCuisine = (label: string) =>
    setLocal(f => ({
      ...f,
      cuisines: f.cuisines.includes(label)
        ? f.cuisines.filter(c => c !== label)
        : [...f.cuisines, label],
    }));

  const toggleMealTime = (mt: MealTime) =>
    setLocal(f => ({
      ...f,
      mealTimes: f.mealTimes.includes(mt)
        ? f.mealTimes.filter(t => t !== mt)
        : [...f.mealTimes, mt],
    }));

  const handleSave = async () => {
    if (filters.mealTimes.length === 0) {
      Alert.alert('Pick at least one meal time', 'We need to know when you like to eat!');
      return;
    }
    setSaving(true);
    setFilters(filters);    // saves to Firestore + Zustand
    navigation.navigate('Main');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.brown} />
        </TouchableOpacity>
        <View style={styles.stepRow}>
          <View style={[styles.step, styles.stepDone]} />
          <View style={[styles.step, styles.stepActive]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Who do you want{'\n'}to dine with?</Text>
        <Text style={styles.sub}>You can change these anytime while searching.</Text>

        {/* ── Gender ──────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SHOW ME</Text>
          <View style={styles.row3}>
            {([
              { value: 'woman',    label: 'Women' },
              { value: 'man',      label: 'Men' },
              { value: 'everyone', label: 'Everyone' },
            ] as const).map(({ value, label }) => (
              <TouchableOpacity
                key={value}
                style={[styles.choiceChip, filters.showGender === value && styles.choiceChipActive]}
                onPress={() => handleGender(value)}
              >
                <Text style={[styles.choiceText, filters.showGender === value && styles.choiceTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Age range ───────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>AGE RANGE</Text>
            <Text style={styles.rangeDisplay}>{filters.ageMin} – {filters.ageMax} years</Text>
          </View>
          <View style={styles.sliderBlock}>
            <Text style={styles.sliderLabel}>Minimum age</Text>
            <Slider
              style={styles.slider} minimumValue={18} maximumValue={60} step={1}
              value={filters.ageMin}
              minimumTrackTintColor={COLORS.rust} maximumTrackTintColor="#e0c8b0"
              thumbTintColor={COLORS.rust}
              onValueChange={v => setLocal(f => ({ ...f, ageMin: Math.min(v, f.ageMax - 1) }))}
            />
            <Text style={styles.sliderLabel}>Maximum age</Text>
            <Slider
              style={styles.slider} minimumValue={18} maximumValue={70} step={1}
              value={filters.ageMax}
              minimumTrackTintColor={COLORS.rust} maximumTrackTintColor="#e0c8b0"
              thumbTintColor={COLORS.rust}
              onValueChange={v => setLocal(f => ({ ...f, ageMax: Math.max(v, f.ageMin + 1) }))}
            />
          </View>
        </View>

        {/* ── Distance ────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>DISTANCE</Text>
            <Text style={styles.rangeDisplay}>{filters.maxDistanceKm} km</Text>
          </View>
          <Slider
            style={styles.slider} minimumValue={1} maximumValue={15} step={1}
            value={filters.maxDistanceKm}
            minimumTrackTintColor={COLORS.rust} maximumTrackTintColor="#e0c8b0"
            thumbTintColor={COLORS.rust}
            onValueChange={v => setLocal(f => ({ ...f, maxDistanceKm: v }))}
          />
          <Text style={styles.sliderHint}>
            Only you and matches within this radius of the restaurant are shown to each other
          </Text>
        </View>

        {/* ── Meal times ──────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>I USUALLY DINE</Text>
          <View style={styles.mealGrid}>
            {MEAL_TIMES.map(({ value, label, emoji, times }) => {
              const active = filters.mealTimes.includes(value);
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.mealCard, active && styles.mealCardActive]}
                  onPress={() => toggleMealTime(value)}
                >
                  <Text style={styles.mealEmoji}>{emoji}</Text>
                  <Text style={[styles.mealLabel, active && styles.mealLabelActive]}>{label}</Text>
                  <Text style={[styles.mealTimes, active && styles.mealTimesActive]}>{times}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Cuisines ────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>FAVOURITE CUISINES (optional)</Text>
          <Text style={styles.sectionHint}>
            Leave empty to match with anyone regardless of food preference
          </Text>
          <View style={styles.chipGrid}>
            {CUISINES.map(({ emoji, label }) => {
              const active = filters.cuisines.includes(label);
              return (
                <TouchableOpacity
                  key={label}
                  style={[styles.cuisineChip, active && styles.chipActive]}
                  onPress={() => toggleCuisine(label)}
                >
                  <Text style={styles.cuisineEmoji}>{emoji}</Text>
                  <Text style={[styles.cuisineLabel, active && styles.chipLabelActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* ── CTA ─────────────────────────────────────────────────────── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          <Text style={styles.saveBtnText}>
            {saving ? 'Saving…' : "Let's find a restaurant →"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 12,
  },
  stepRow: { flexDirection: 'row', gap: 6 },
  step: { width: 28, height: 4, borderRadius: 2, backgroundColor: '#d4b898' },
  stepDone: { backgroundColor: COLORS.rust },
  stepActive: { backgroundColor: COLORS.orange },
  scroll: { paddingHorizontal: SPACING.md, paddingBottom: 120 },

  title: {
    fontFamily: FONTS.serifDisplay, fontSize: 30,
    color: COLORS.deepBrown, marginTop: 8, lineHeight: 38,
  },
  sub: { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.muted, marginTop: 6, marginBottom: 24 },

  section: { marginBottom: 28 },
  sectionLabel: {
    fontFamily: FONTS.sans, fontSize: 10, color: COLORS.muted,
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10,
  },
  sectionHint: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted, marginBottom: 10, marginTop: -4 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  rangeDisplay: { fontFamily: FONTS.sansMedium, fontSize: 14, color: COLORS.rust },

  // Gender chips
  row3: { flexDirection: 'row', gap: 10 },
  choiceChip: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    borderWidth: 0.5, borderColor: COLORS.border,
    backgroundColor: '#fdf0e3', alignItems: 'center',
  },
  choiceChipActive: { backgroundColor: COLORS.rust, borderColor: COLORS.rust },
  choiceText: { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.brown },
  choiceTextActive: { color: COLORS.cream, fontFamily: FONTS.sansMedium },

  // Sliders
  sliderBlock: { gap: 2 },
  sliderLabel: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted, marginTop: 6 },
  slider: { height: 32 },
  sliderHint: { fontFamily: FONTS.sans, fontSize: 11, color: COLORS.muted, marginTop: 4, lineHeight: 16 },

  // Meal time cards
  mealGrid: { flexDirection: 'row', gap: 10 },
  mealCard: {
    flex: 1, padding: 14, borderRadius: 14,
    borderWidth: 0.5, borderColor: COLORS.border,
    backgroundColor: '#fdf0e3', alignItems: 'center',
  },
  mealCardActive: { backgroundColor: COLORS.rust, borderColor: COLORS.rust },
  mealEmoji: { fontSize: 22, marginBottom: 4 },
  mealLabel: { fontFamily: FONTS.sansMedium, fontSize: 13, color: COLORS.brown },
  mealLabelActive: { color: COLORS.cream },
  mealTimes: { fontFamily: FONTS.sans, fontSize: 10, color: COLORS.muted, marginTop: 2 },
  mealTimesActive: { color: 'rgba(255,255,255,0.75)' },

  // Cuisine chips
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cuisineChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 50, borderWidth: 0.5,
    borderColor: COLORS.border, backgroundColor: '#fdf0e3',
  },
  chipActive: { backgroundColor: COLORS.rust, borderColor: COLORS.rust },
  cuisineEmoji: { fontSize: 14 },
  cuisineLabel: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.brown },
  chipLabelActive: { color: COLORS.cream },

  // Footer
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.cream,
    borderTopWidth: 0.5, borderTopColor: '#e8d8c8',
    padding: SPACING.md,
  },
  saveBtn: {
    backgroundColor: COLORS.rust, borderRadius: 16,
    paddingVertical: 15, alignItems: 'center',
  },
  saveBtnDisabled: { backgroundColor: '#d4b898' },
  saveBtnText: { fontFamily: FONTS.sansMedium, fontSize: 15, color: COLORS.cream },
});
