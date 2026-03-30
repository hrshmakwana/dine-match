import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  PanResponder, Dimensions, Modal, ScrollView,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { SearchFilters, Gender, MealTime } from '../types';
import { COLORS, FONTS, SPACING } from '../utils/theme';

const { height: SCREEN_H } = Dimensions.get('window');
const DRAWER_HEIGHT = SCREEN_H * 0.72;

const CUISINES = ['🍕 Italian', '🍱 Japanese', '🌮 Mexican', '🍛 Indian', '🥗 Vegan', '🥩 BBQ', '☕ Café', '🍔 American'];
const MEAL_TIMES: { label: string; value: MealTime; icon: string }[] = [
  { label: 'Breakfast', value: 'breakfast', icon: '🌅' },
  { label: 'Lunch',     value: 'lunch',     icon: '☀️' },
  { label: 'Dinner',    value: 'dinner',    icon: '🌙' },
];

interface Props {
  visible: boolean;
  initialFilters: SearchFilters;
  onClose: () => void;
  onApply: (filters: SearchFilters) => void;
}

export default function FilterDrawer({ visible, initialFilters, onClose, onApply }: Props) {
  const slideAnim = useRef(new Animated.Value(DRAWER_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const [filters, setFilters] = useState<SearchFilters>(initialFilters);

  useEffect(() => {
    if (visible) {
      setFilters(initialFilters);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 180 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: DRAWER_HEIGHT, duration: 250, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const setGender = (g: SearchFilters['showGender']) =>
    setFilters(f => ({ ...f, showGender: g }));

  const toggleCuisine = (c: string) =>
    setFilters(f => ({
      ...f,
      cuisines: f.cuisines.includes(c) ? f.cuisines.filter(x => x !== c) : [...f.cuisines, c],
    }));

  const toggleMealTime = (mt: MealTime) =>
    setFilters(f => ({
      ...f,
      mealTimes: f.mealTimes.includes(mt) ? f.mealTimes.filter(x => x !== mt) : [...f.mealTimes, mt],
    }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      {/* Drawer */}
      <Animated.View style={[styles.drawer, { transform: [{ translateY: slideAnim }] }]}>
        {/* Handle */}
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        {/* Header */}
        <View style={styles.drawerHeader}>
          <Text style={styles.drawerTitle}>Adjust filters</Text>
          <Text style={styles.drawerSub}>Changes apply instantly while you search</Text>
        </View>

        <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>

          {/* ── Gender ────────────────────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SHOW ME</Text>
            <View style={styles.row}>
              {(['woman', 'man', 'everyone'] as const).map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.genderChip, filters.showGender === g && styles.genderChipActive]}
                  onPress={() => setGender(g)}
                >
                  <Text style={[styles.genderChipText, filters.showGender === g && styles.genderChipTextActive]}>
                    {g === 'woman' ? 'Women' : g === 'man' ? 'Men' : 'Everyone'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Age Range ─────────────────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              AGE RANGE: {filters.ageMin} – {filters.ageMax}
            </Text>
            <Text style={styles.sliderSubLabel}>Min age</Text>
            <Slider
              style={styles.slider}
              minimumValue={18} maximumValue={50} step={1}
              value={filters.ageMin}
              minimumTrackTintColor={COLORS.rust}
              maximumTrackTintColor="#e0c8b0"
              thumbTintColor={COLORS.rust}
              onValueChange={(v) => setFilters(f => ({ ...f, ageMin: Math.min(v, f.ageMax - 1) }))}
            />
            <Text style={styles.sliderSubLabel}>Max age</Text>
            <Slider
              style={styles.slider}
              minimumValue={18} maximumValue={60} step={1}
              value={filters.ageMax}
              minimumTrackTintColor={COLORS.rust}
              maximumTrackTintColor="#e0c8b0"
              thumbTintColor={COLORS.rust}
              onValueChange={(v) => setFilters(f => ({ ...f, ageMax: Math.max(v, f.ageMin + 1) }))}
            />
          </View>

          {/* ── Distance ──────────────────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>MAX DISTANCE: {filters.maxDistanceKm} km</Text>
            <Slider
              style={styles.slider}
              minimumValue={1} maximumValue={15} step={1}
              value={filters.maxDistanceKm}
              minimumTrackTintColor={COLORS.rust}
              maximumTrackTintColor="#e0c8b0"
              thumbTintColor={COLORS.rust}
              onValueChange={(v) => setFilters(f => ({ ...f, maxDistanceKm: v }))}
            />
          </View>

          {/* ── Meal Time ─────────────────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>MEAL TIME</Text>
            <View style={styles.row}>
              {MEAL_TIMES.map(({ label, value, icon }) => (
                <TouchableOpacity
                  key={value}
                  style={[styles.mealChip, filters.mealTimes.includes(value) && styles.chipActive]}
                  onPress={() => toggleMealTime(value)}
                >
                  <Text style={styles.chipEmoji}>{icon}</Text>
                  <Text style={[styles.chipText, filters.mealTimes.includes(value) && styles.chipTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Cuisines ──────────────────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>CUISINE PREFERENCE</Text>
            <View style={styles.wrapRow}>
              {CUISINES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.cuisineChip, filters.cuisines.includes(c) && styles.chipActive]}
                  onPress={() => toggleCuisine(c)}
                >
                  <Text style={[styles.chipText, filters.cuisines.includes(c) && styles.chipTextActive]}>
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

        </ScrollView>

        {/* Apply button */}
        <View style={styles.applyContainer}>
          <TouchableOpacity style={styles.applyBtn} onPress={() => onApply(filters)} activeOpacity={0.85}>
            <Text style={styles.applyText}>Apply & continue searching</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(42,21,5,0.5)',
  },
  drawer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: DRAWER_HEIGHT,
    backgroundColor: COLORS.cream,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 0.5, borderColor: '#e8d8c8',
  },
  handleContainer: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#d4b898' },
  drawerHeader: { paddingHorizontal: SPACING.md, paddingBottom: 8 },
  drawerTitle: { fontFamily: FONTS.serifDisplay, fontSize: 22, color: COLORS.deepBrown },
  drawerSub: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted, marginTop: 2 },
  scrollArea: { flex: 1, paddingHorizontal: SPACING.md },
  section: { marginBottom: 20 },
  sectionLabel: {
    fontFamily: FONTS.sans, fontSize: 10, color: COLORS.muted,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8,
  },
  sliderSubLabel: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted, marginBottom: 2 },
  slider: { height: 28 },
  row: { flexDirection: 'row', gap: 8 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },

  // Gender chips
  genderChip: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    borderWidth: 0.5, borderColor: '#d4b898', backgroundColor: '#fdf0e3',
    alignItems: 'center',
  },
  genderChipActive: { backgroundColor: COLORS.rust, borderColor: COLORS.rust },
  genderChipText: { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.brown },
  genderChipTextActive: { color: COLORS.cream, fontWeight: '500' },

  // Meal time chips
  mealChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 9, borderRadius: 10,
    borderWidth: 0.5, borderColor: '#d4b898', backgroundColor: '#fdf0e3',
  },
  chipEmoji: { fontSize: 14 },

  // Cuisine chips
  cuisineChip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 50, borderWidth: 0.5,
    borderColor: '#d4b898', backgroundColor: '#fdf0e3',
  },
  chipActive: { backgroundColor: COLORS.rust, borderColor: COLORS.rust },
  chipText: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.brown },
  chipTextActive: { color: COLORS.cream, fontWeight: '500' },

  // Apply
  applyContainer: {
    padding: SPACING.md, paddingTop: 10,
    borderTopWidth: 0.5, borderTopColor: '#e8d8c8',
  },
  applyBtn: {
    backgroundColor: COLORS.rust, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  applyText: { fontFamily: FONTS.sans, fontSize: 15, fontWeight: '500', color: COLORS.cream },
});
