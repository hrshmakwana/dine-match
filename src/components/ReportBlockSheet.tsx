// src/components/ReportBlockSheet.tsx
// Bottom sheet for reporting or blocking another user

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  Animated, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { blockUser, reportUser } from '../services/historyService';
import { COLORS, FONTS, SPACING } from '../utils/theme';

const REPORT_REASONS = [
  { id: 'no_show',      label: 'Didn\'t show up',       icon: '🚫' },
  { id: 'inappropriate',label: 'Inappropriate behavior', icon: '⚠️' },
  { id: 'fake_profile', label: 'Fake profile / photos',  icon: '🎭' },
  { id: 'harassment',   label: 'Harassment',             icon: '🛑' },
  { id: 'scam',         label: 'Scam or spam',           icon: '💸' },
  { id: 'other',        label: 'Other',                  icon: '📝' },
];

interface Props {
  visible: boolean;
  reportedUserId: string;
  reportedUserName: string;
  matchId?: string;
  myUserId: string;
  onClose: () => void;
  onBlocked?: () => void;
}

export default function ReportBlockSheet({
  visible, reportedUserId, reportedUserName, matchId, myUserId, onClose, onBlocked,
}: Props) {
  const slideAnim = useRef(new Animated.Value(400)).current;
  const [mode, setMode] = useState<'menu' | 'report' | 'block_confirm'>('menu');
  const [selectedReason, setSelectedReason] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setMode('menu');
      setSelectedReason('');
      setAdditionalNotes('');
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 18 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 400, duration: 200, useNativeDriver: true }).start();
    }
  }, [visible]);

  const handleBlock = async () => {
    setLoading(true);
    try {
      await blockUser(myUserId, reportedUserId, matchId);
      Alert.alert(
        'User blocked',
        `${reportedUserName} has been blocked. You won't see them in future searches.`,
        [{ text: 'OK', onPress: () => { onClose(); onBlocked?.(); } }],
      );
    } catch {
      Alert.alert('Error', 'Could not block user. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReport = async () => {
    if (!selectedReason) return;
    setLoading(true);
    try {
      await reportUser(myUserId, reportedUserId, selectedReason, matchId);
      Alert.alert(
        'Report submitted',
        'Thank you. Our team will review your report within 24 hours.',
        [{ text: 'OK', onPress: onClose }],
      );
    } catch {
      Alert.alert('Error', 'Could not submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.handle} />

        {mode === 'menu' && (
          <>
            <Text style={styles.sheetTitle}>{reportedUserName}</Text>
            <TouchableOpacity style={styles.option} onPress={() => setMode('report')}>
              <View style={[styles.optionIcon, { backgroundColor: '#fde8d8' }]}>
                <Ionicons name="flag-outline" size={18} color={COLORS.rust} />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionLabel}>Report user</Text>
                <Text style={styles.optionSub}>Let us know about inappropriate behavior</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.muted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.option} onPress={() => setMode('block_confirm')}>
              <View style={[styles.optionIcon, { backgroundColor: '#f5e8d8' }]}>
                <Ionicons name="ban-outline" size={18} color={COLORS.brown} />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionLabel}>Block user</Text>
                <Text style={styles.optionSub}>They won't appear in your searches</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.muted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}

        {mode === 'report' && (
          <>
            <TouchableOpacity style={styles.backBtn} onPress={() => setMode('menu')}>
              <Ionicons name="arrow-back" size={18} color={COLORS.muted} />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.sheetTitle}>Report {reportedUserName}</Text>
            <Text style={styles.sheetSub}>What happened?</Text>
            {REPORT_REASONS.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={[styles.reasonRow, selectedReason === r.id && styles.reasonRowActive]}
                onPress={() => setSelectedReason(r.id)}
              >
                <Text style={styles.reasonEmoji}>{r.icon}</Text>
                <Text style={[styles.reasonLabel, selectedReason === r.id && styles.reasonLabelActive]}>
                  {r.label}
                </Text>
                {selectedReason === r.id && (
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.rust} />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.submitBtn, (!selectedReason || loading) && styles.submitBtnDisabled]}
              onPress={handleReport}
              disabled={!selectedReason || loading}
            >
              {loading
                ? <ActivityIndicator color={COLORS.cream} />
                : <Text style={styles.submitBtnText}>Submit report</Text>}
            </TouchableOpacity>
          </>
        )}

        {mode === 'block_confirm' && (
          <>
            <Text style={styles.sheetTitle}>Block {reportedUserName}?</Text>
            <Text style={styles.blockDesc}>
              They won't appear in your future restaurant searches and you won't appear in theirs. This action is silent — they won't be notified.
            </Text>
            <TouchableOpacity
              style={[styles.blockBtn, loading && styles.submitBtnDisabled]}
              onPress={handleBlock}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={COLORS.cream} />
                : <Text style={styles.blockBtnText}>Yes, block {reportedUserName}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setMode('menu')}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(42,21,5,0.5)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: SPACING.md, paddingBottom: 36,
    borderTopWidth: 0.5, borderColor: COLORS.border,
  },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#d4b898', alignSelf: 'center', marginBottom: 16 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  backText: { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.muted },
  sheetTitle: { fontFamily: FONTS.serifDisplay, fontSize: 22, color: COLORS.deepBrown, marginBottom: 4 },
  sheetSub: { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.muted, marginBottom: 14 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#f0e0cc',
  },
  optionIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  optionText: { flex: 1 },
  optionLabel: { fontFamily: FONTS.sans, fontSize: 14, fontWeight: '500', color: COLORS.brown },
  optionSub: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted, marginTop: 1 },
  cancelBtn: { alignItems: 'center', paddingVertical: 14 },
  cancelText: { fontFamily: FONTS.sans, fontSize: 14, color: COLORS.muted },
  reasonRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 11, paddingHorizontal: 12,
    borderRadius: 10, marginBottom: 6, backgroundColor: '#f5e8d8',
    borderWidth: 0.5, borderColor: 'transparent',
  },
  reasonRowActive: { borderColor: COLORS.rust, backgroundColor: '#fde8d8' },
  reasonEmoji: { fontSize: 18 },
  reasonLabel: { flex: 1, fontFamily: FONTS.sans, fontSize: 14, color: COLORS.brown },
  reasonLabelActive: { color: COLORS.rust, fontWeight: '500' },
  submitBtn: { backgroundColor: COLORS.rust, borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginTop: 12 },
  submitBtnDisabled: { backgroundColor: '#d4b898' },
  submitBtnText: { fontFamily: FONTS.sans, fontSize: 15, fontWeight: '500', color: COLORS.cream },
  blockDesc: { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.muted, lineHeight: 20, marginVertical: 16 },
  blockBtn: { backgroundColor: '#c83028', borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginBottom: 10 },
  blockBtnText: { fontFamily: FONTS.sans, fontSize: 15, fontWeight: '500', color: COLORS.cream },
});
