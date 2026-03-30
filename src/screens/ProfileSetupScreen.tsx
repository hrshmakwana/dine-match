import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  Image, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { doc, setDoc } from 'firebase/firestore';

import { auth, db, COLLECTIONS } from '../services/firebase';
import { pickAndUploadPhoto } from '../services/photoService';
import { UserProfile, Gender } from '../types';
import { COLORS, FONTS, SPACING } from '../utils/theme';

const FOOD_LIKES = ['🍕 Italian','🍱 Japanese','🌮 Mexican','🍛 Indian','🥗 Vegan','🥩 BBQ','☕ Café','🍔 American','🥘 Mediterranean','🍣 Sushi','🍜 Noodles','🧆 Middle Eastern'];
const FOOD_DISLIKES = ['🌶️ Very spicy','🥜 Nuts','🦐 Seafood','🥛 Dairy','🌾 Gluten','🧅 Onions','🧄 Garlic','🥚 Eggs'];

export default function ProfileSetupScreen() {
  const navigation = useNavigation<any>();
  const uid = auth.currentUser?.uid ?? '';

  const [step, setStep] = useState(1); // 1=photos, 2=basics, 3=food
  const [photos, setPhotos] = useState<(string | null)[]>([null, null, null]);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [bio, setBio] = useState('');
  const [foodLikes, setFoodLikes] = useState<string[]>([]);
  const [foodDislikes, setFoodDislikes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);

  const handlePhotoPress = async (index: number) => {
    setUploadingSlot(index);
    try {
      const url = await pickAndUploadPhoto(uid, index);
      if (url) {
        const updated = [...photos];
        updated[index] = url;
        setPhotos(updated);
      }
    } catch {
      Alert.alert('Upload failed', 'Please try again.');
    } finally {
      setUploadingSlot(null);
    }
  };

  const toggleLike = (item: string) =>
    setFoodLikes(prev => prev.includes(item) ? prev.filter(x => x !== item) : [...prev, item]);

  const toggleDislike = (item: string) =>
    setFoodDislikes(prev => prev.includes(item) ? prev.filter(x => x !== item) : [...prev, item]);

  const canAdvanceStep1 = photos.filter(Boolean).length >= 1;
  const canAdvanceStep2 = name.trim().length >= 2 && age.trim().length > 0 && gender !== null;
  const canSave = foodLikes.length >= 1;

  const saveProfile = async () => {
    if (!uid) return;
    setSaving(true);
    try {
      const profile: UserProfile = {
        uid,
        name: name.trim(),
        age: parseInt(age),
        gender: gender!,
        photos: photos.filter(Boolean) as string[],
        foodLikes,
        foodDislikes,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await setDoc(doc(db, COLLECTIONS.USERS, uid), profile);
      navigation.replace('FilterSetup');
    } catch {
      Alert.alert('Error', 'Could not save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Progress bar */}
      <View style={styles.progressBar}>
        {[1, 2, 3].map(s => (
          <View key={s} style={[styles.progressSegment, step >= s && styles.progressActive]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Step 1: Photos ──────────────────────────────────────────────── */}
        {step === 1 && (
          <>
            <Text style={styles.stepTitle}>Add your photos</Text>
            <Text style={styles.stepSub}>Your dining partner will choose you based on your looks — make a great first impression!</Text>
            <View style={styles.photoGrid}>
              {photos.map((photo, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.photoSlot, photo && styles.photoSlotFilled]}
                  onPress={() => handlePhotoPress(i)}
                  activeOpacity={0.8}
                >
                  {uploadingSlot === i ? (
                    <ActivityIndicator color={COLORS.rust} />
                  ) : photo ? (
                    <>
                      <Image source={{ uri: photo }} style={styles.photoImg} />
                      <View style={styles.photoEditBadge}>
                        <Ionicons name="pencil" size={10} color={COLORS.cream} />
                      </View>
                    </>
                  ) : (
                    <>
                      <Ionicons name="add" size={28} color={COLORS.muted} />
                      {i === 0 && <Text style={styles.mainPhotoLabel}>Main</Text>}
                    </>
                  )}
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.photoHint}>Add at least 1 photo. Your main photo is shown first.</Text>
          </>
        )}

        {/* ── Step 2: Basics ──────────────────────────────────────────────── */}
        {step === 2 && (
          <>
            <Text style={styles.stepTitle}>About you</Text>
            <Text style={styles.stepSub}>Just the basics — keep it real!</Text>

            <Text style={styles.fieldLabel}>FIRST NAME</Text>
            <TextInput
              style={styles.input}
              placeholder="Your name"
              placeholderTextColor={COLORS.muted}
              value={name}
              onChangeText={setName}
              maxLength={20}
              autoFocus
            />

            <Text style={styles.fieldLabel}>AGE</Text>
            <TextInput
              style={[styles.input, { width: 100 }]}
              placeholder="25"
              placeholderTextColor={COLORS.muted}
              value={age}
              onChangeText={t => setAge(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              maxLength={2}
            />

            <Text style={styles.fieldLabel}>I AM</Text>
            <View style={styles.chipRow}>
              {(['man', 'woman', 'non-binary'] as Gender[]).map(g => (
                <TouchableOpacity
                  key={g}
                  style={[styles.chip, gender === g && styles.chipActive]}
                  onPress={() => setGender(g)}
                >
                  <Text style={[styles.chipText, gender === g && styles.chipTextActive]}>
                    {g === 'man' ? 'Man' : g === 'woman' ? 'Woman' : 'Non-binary'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>SHORT BIO (optional)</Text>
            <TextInput
              style={[styles.input, styles.bioInput]}
              placeholder="A line about yourself…"
              placeholderTextColor={COLORS.muted}
              value={bio}
              onChangeText={setBio}
              multiline
              maxLength={120}
            />
            <Text style={styles.charCount}>{bio.length}/120</Text>
          </>
        )}

        {/* ── Step 3: Food preferences ────────────────────────────────────── */}
        {step === 3 && (
          <>
            <Text style={styles.stepTitle}>Food preferences</Text>
            <Text style={styles.stepSub}>This helps match you with compatible dining partners.</Text>

            <Text style={styles.fieldLabel}>CUISINES I LOVE</Text>
            <View style={styles.chipWrap}>
              {FOOD_LIKES.map(item => (
                <TouchableOpacity
                  key={item}
                  style={[styles.chip, foodLikes.includes(item) && styles.chipActive]}
                  onPress={() => toggleLike(item)}
                >
                  <Text style={[styles.chipText, foodLikes.includes(item) && styles.chipTextActive]}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 20 }]}>I AVOID / ALLERGIES</Text>
            <View style={styles.chipWrap}>
              {FOOD_DISLIKES.map(item => (
                <TouchableOpacity
                  key={item}
                  style={[styles.chip, foodDislikes.includes(item) && styles.chipActive]}
                  onPress={() => toggleDislike(item)}
                >
                  <Text style={[styles.chipText, foodDislikes.includes(item) && styles.chipTextActive]}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* Footer CTA */}
      <View style={styles.footer}>
        {step > 1 && (
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep(s => s - 1)}>
            <Ionicons name="arrow-back" size={20} color={COLORS.brown} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            styles.nextBtn,
            ((step === 1 && !canAdvanceStep1) || (step === 2 && !canAdvanceStep2) || (step === 3 && !canSave) || saving) && styles.btnDisabled,
          ]}
          onPress={step < 3 ? () => setStep(s => s + 1) : saveProfile}
          disabled={(step === 1 && !canAdvanceStep1) || (step === 2 && !canAdvanceStep2) || (step === 3 && !canSave) || saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color={COLORS.cream} />
            : <Text style={styles.nextBtnText}>{step < 3 ? 'Continue →' : 'Done — find restaurants!'}</Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  progressBar: { flexDirection: 'row', gap: 6, margin: SPACING.md },
  progressSegment: {
    flex: 1, height: 4, borderRadius: 2, backgroundColor: '#e8d0b8',
  },
  progressActive: { backgroundColor: COLORS.rust },
  scroll: { padding: SPACING.md, paddingBottom: 100 },
  stepTitle: { fontFamily: FONTS.serifDisplay, fontSize: 28, color: COLORS.deepBrown, marginBottom: 6 },
  stepSub: { fontFamily: FONTS.sans, fontSize: 14, color: COLORS.muted, marginBottom: 24, lineHeight: 20 },

  // Photo grid
  photoGrid: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  photoSlot: {
    width: '31%', aspectRatio: 0.8, borderRadius: 14,
    backgroundColor: '#f5e8d8', borderWidth: 1.5, borderStyle: 'dashed',
    borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  photoSlotFilled: { borderStyle: 'solid', borderColor: COLORS.rust },
  photoImg: { width: '100%', height: '100%' },
  photoEditBadge: {
    position: 'absolute', bottom: 6, right: 6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.rust, alignItems: 'center', justifyContent: 'center',
  },
  mainPhotoLabel: { fontFamily: FONTS.sans, fontSize: 11, color: COLORS.muted, marginTop: 4 },
  photoHint: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted, marginTop: 12, lineHeight: 18 },

  // Form
  fieldLabel: {
    fontFamily: FONTS.sans, fontSize: 10, color: COLORS.muted,
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6, marginTop: 18,
  },
  input: {
    backgroundColor: '#f5e8d8', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: FONTS.sans, fontSize: 15, color: COLORS.deepBrown,
    borderWidth: 0.5, borderColor: COLORS.border,
  },
  bioInput: { height: 80, textAlignVertical: 'top', paddingTop: 12 },
  charCount: { fontFamily: FONTS.sans, fontSize: 11, color: COLORS.muted, textAlign: 'right', marginTop: 4 },

  // Chips
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chipWrap: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 50,
    borderWidth: 0.5, borderColor: COLORS.border, backgroundColor: '#fdf0e3',
  },
  chipActive: { backgroundColor: COLORS.rust, borderColor: COLORS.rust },
  chipText: { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.brown },
  chipTextActive: { color: COLORS.cream, fontWeight: '500' },

  // Footer
  footer: {
    flexDirection: 'row', gap: 10, padding: SPACING.md,
    borderTopWidth: 0.5, borderTopColor: '#e8d8c8',
    backgroundColor: COLORS.cream,
  },
  backBtn: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: '#f5e8d8', alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5, borderColor: COLORS.border,
  },
  nextBtn: {
    flex: 1, backgroundColor: COLORS.rust, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  btnDisabled: { backgroundColor: COLORS.border },
  nextBtnText: { fontFamily: FONTS.sansMedium, fontSize: 16, color: COLORS.cream },
});
