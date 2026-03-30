import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  PhoneAuthProvider,
  signInWithCredential,
  signInWithPhoneNumber,
  ConfirmationResult,
} from 'firebase/auth';
import { auth } from '../services/firebase';
import { COLORS, FONTS, SPACING } from '../utils/theme';

type Step = 'phone' | 'otp';

const COUNTRY_CODES = [
  { flag: '🇮🇳', code: '+91', name: 'India' },
  { flag: '🇺🇸', code: '+1',  name: 'USA' },
  { flag: '🇬🇧', code: '+44', name: 'UK' },
  { flag: '🇦🇪', code: '+971', name: 'UAE' },
  { flag: '🇸🇬', code: '+65', name: 'Singapore' },
  { flag: '🇦🇺', code: '+61', name: 'Australia' },
  { flag: '🇨🇦', code: '+1',  name: 'Canada' },
  { flag: '🇩🇪', code: '+49', name: 'Germany' },
];

export default function PhoneAuthScreen() {
  const [step, setStep]               = useState<Step>('phone');
  const [countryCode, setCountryCode] = useState(COUNTRY_CODES[0]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp]                 = useState(['', '', '', '', '', '']);
  const [loading, setLoading]         = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [showPicker, setShowPicker]   = useState(false);

  // Firebase native confirmation result (no extra package needed)
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const otpRefs         = useRef<(TextInput | null)[]>([]);
  const timerRef        = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const startTimer = () => {
    setResendTimer(30);
    timerRef.current = setInterval(() => {
      setResendTimer(t => {
        if (t <= 1) { clearInterval(timerRef.current!); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  // ── Step 1: Send OTP ─────────────────────────────────────────────────────
  const sendOtp = async () => {
    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.length < 7) {
      Alert.alert('Invalid number', 'Please enter a valid phone number.'); return;
    }
    const full = `${countryCode.code}${digits}`;
    setLoading(true);
    try {
      // signInWithPhoneNumber works natively in Expo/React Native via Firebase SDK v10+
      // It sends an SMS and returns a ConfirmationResult — no RecaptchaVerifier needed on native
      const confirmation = await signInWithPhoneNumber(auth, full);
      confirmationRef.current = confirmation;
      setStep('otp');
      startTimer();
    } catch (err: any) {
      Alert.alert('Could not send code', err?.message ?? 'Check your number and try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify OTP ───────────────────────────────────────────────────
  const verifyOtp = async () => {
    const code = otp.join('');
    if (code.length !== 6 || !confirmationRef.current) return;
    setLoading(true);
    try {
      await confirmationRef.current.confirm(code);
      // useAuthStore._init() listener fires automatically on sign-in → navigates to Main
    } catch {
      Alert.alert('Wrong code', 'The code you entered is incorrect. Try again.');
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (text: string, idx: number) => {
    const digit = text.replace(/\D/g, '').slice(-1);
    const next  = [...otp];
    next[idx]   = digit;
    setOtp(next);
    if (digit && idx < 5)  otpRefs.current[idx + 1]?.focus();
    if (!digit && idx > 0) otpRefs.current[idx - 1]?.focus();
    if (digit && idx === 5 && next.every(d => d)) verifyOtp();
  };

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView style={s.inner} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.logoArea}>
          <Text style={s.logoEmoji}>🍽️</Text>
          <Text style={s.logoText}>DineMatch</Text>
          <Text style={s.tagline}>Sign in to find your dining companion</Text>
        </View>

        {step === 'phone' ? (
          <View style={s.card}>
            <Text style={s.cardTitle}>Enter your number</Text>
            <Text style={s.cardSub}>We'll send a one-time code via SMS</Text>

            <View style={s.phoneRow}>
              <TouchableOpacity style={s.countryBtn} onPress={() => setShowPicker(!showPicker)}>
                <Text style={s.flag}>{countryCode.flag}</Text>
                <Text style={s.codeText}>{countryCode.code}</Text>
                <Text style={s.chevron}>▾</Text>
              </TouchableOpacity>
              <TextInput
                style={s.phoneInput}
                placeholder="Phone number"
                placeholderTextColor={COLORS.muted}
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                autoFocus
              />
            </View>

            {showPicker && (
              <View style={s.dropdown}>
                {COUNTRY_CODES.map(c => (
                  <TouchableOpacity key={c.name} style={s.dropdownRow}
                    onPress={() => { setCountryCode(c); setShowPicker(false); }}>
                    <Text style={s.flag}>{c.flag}</Text>
                    <Text style={s.dropdownName}>{c.name}</Text>
                    <Text style={s.codeText}>{c.code}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={s.terms}>By continuing you agree to our Terms of Service and Privacy Policy.</Text>

            <TouchableOpacity
              style={[s.btn, (loading || phoneNumber.length < 7) && s.btnDisabled]}
              onPress={sendOtp}
              disabled={loading || phoneNumber.length < 7}
              activeOpacity={0.85}
            >
              {loading ? <ActivityIndicator color={COLORS.cream} /> : <Text style={s.btnText}>Send code →</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.card}>
            <Text style={s.cardTitle}>Enter the code</Text>
            <Text style={s.cardSub}>Sent to {countryCode.code} {phoneNumber}</Text>

            <View style={s.otpRow}>
              {otp.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={r => { otpRefs.current[i] = r; }}
                  style={[s.otpBox, digit ? s.otpBoxFilled : null]}
                  value={digit}
                  onChangeText={t => handleOtpChange(t, i)}
                  keyboardType="number-pad"
                  maxLength={1}
                  textAlign="center"
                  autoFocus={i === 0}
                />
              ))}
            </View>

            <TouchableOpacity
              style={[s.btn, (loading || otp.join('').length !== 6) && s.btnDisabled]}
              onPress={verifyOtp}
              disabled={loading || otp.join('').length !== 6}
              activeOpacity={0.85}
            >
              {loading ? <ActivityIndicator color={COLORS.cream} /> : <Text style={s.btnText}>Verify →</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={s.resendBtn} disabled={resendTimer > 0} onPress={sendOtp}>
              <Text style={[s.resendText, resendTimer > 0 && s.resendDisabled]}>
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend code'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.changeBtn}
              onPress={() => { setStep('phone'); setOtp(['','','','','','']); }}>
              <Text style={s.changeText}>← Change number</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.deepBrown },
  inner:        { flex: 1, justifyContent: 'center', padding: SPACING.md },
  logoArea:     { alignItems: 'center', marginBottom: 32 },
  logoEmoji:    { fontSize: 44, marginBottom: 6 },
  logoText:     { fontFamily: FONTS.serifDisplay, fontSize: 38, color: COLORS.cream, fontStyle: 'italic' },
  tagline:      { fontFamily: FONTS.sans, fontSize: 13, color: '#c4956a', marginTop: 4 },
  card:         { backgroundColor: COLORS.cream, borderRadius: 24, padding: SPACING.lg },
  cardTitle:    { fontFamily: FONTS.serifDisplay, fontSize: 24, color: COLORS.deepBrown, marginBottom: 4 },
  cardSub:      { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.muted, marginBottom: 20 },
  phoneRow:     { flexDirection: 'row', gap: 10, marginBottom: 8 },
  countryBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f5e8d8', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 12, borderWidth: 0.5, borderColor: COLORS.border },
  flag:         { fontSize: 18 },
  codeText:     { fontFamily: FONTS.sans, fontSize: 14, color: COLORS.brown, fontWeight: '500' },
  chevron:      { fontSize: 10, color: COLORS.muted },
  phoneInput:   { flex: 1, backgroundColor: '#f5e8d8', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontFamily: FONTS.sans, fontSize: 16, color: COLORS.brown, borderWidth: 0.5, borderColor: COLORS.border },
  dropdown:     { backgroundColor: COLORS.cream, borderRadius: 12, marginBottom: 12, borderWidth: 0.5, borderColor: COLORS.border, overflow: 'hidden' },
  dropdownRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 0.5, borderBottomColor: '#f0e0cc' },
  dropdownName: { flex: 1, fontFamily: FONTS.sans, fontSize: 14, color: COLORS.brown },
  terms:        { fontFamily: FONTS.sans, fontSize: 11, color: COLORS.muted, lineHeight: 16, marginBottom: 16 },
  btn:          { backgroundColor: COLORS.rust, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  btnDisabled:  { backgroundColor: '#d4b898' },
  btnText:      { fontFamily: FONTS.sans, fontSize: 15, fontWeight: '500', color: COLORS.cream },
  otpRow:       { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  otpBox:       { width: 44, height: 52, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: '#f5e8d8', fontFamily: FONTS.sans, fontSize: 22, fontWeight: '500', color: COLORS.deepBrown },
  otpBoxFilled: { borderColor: COLORS.rust, backgroundColor: '#fde8d8' },
  resendBtn:    { alignItems: 'center', marginTop: 16 },
  resendText:   { fontFamily: FONTS.sans, fontSize: 14, color: COLORS.rust, fontWeight: '500' },
  resendDisabled: { color: COLORS.muted },
  changeBtn:    { alignItems: 'center', marginTop: 10 },
  changeText:   { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.muted },
});
