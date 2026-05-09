import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { auth } from '../services/firebase';
import { AuthStackParamList } from '../types';
import { COLORS, FONTS, SPACING } from '../utils/theme';

type Step = 'phone' | 'otp';
type AuthMode = 'phone' | 'email';
type Nav = NativeStackNavigationProp<AuthStackParamList, 'PhoneAuth'>;

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
  const navigation = useNavigation<Nav>();
  const [step, setStep]               = useState<Step>('phone');
  const [countryCode, setCountryCode] = useState(COUNTRY_CODES[0]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [otp, setOtp]                 = useState(['', '', '', '', '', '']);
  const [loading, setLoading]         = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [showPicker, setShowPicker]   = useState(false);
  const [authMode, setAuthMode]       = useState<AuthMode>('phone');
  const [sendError, setSendError]     = useState<string | null>(null);
  const [otpError, setOtpError]       = useState<string | null>(null);
  const [emailError, setEmailError]   = useState<string | null>(null);

  // Firebase native confirmation result (no extra package needed)
  const confirmationRef = useRef<any>(null);
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
    setSendError(null);
    setOtpError(null);
    setShowPicker(false);
    setLoading(true);
    try {
      // Phone auth requires native modules not available in Expo Go web
      // For now, show a helpful message directing to email auth
      setSendError('Phone sign-in requires a native build. Please use Email sign-in instead.');
      setLoading(false);
      return;
      confirmationRef.current = confirmation;
      setStep('otp');
      startTimer();
    } catch (err: any) {
      const code = err?.code as string | undefined;
      const message =
        code === 'auth/invalid-phone-number'
          ? 'That number format looks invalid. Check country code and number.'
          : code === 'auth/too-many-requests' || code === 'auth/quota-exceeded'
            ? 'Too many attempts for now. Please wait a bit and try again.'
            : code === 'auth/operation-not-allowed'
              ? 'Phone sign-in is not enabled in Firebase console for this project.'
              : code === 'auth/app-not-authorized'
                ? 'This app is not authorized for phone sign-in. Check Firebase iOS app setup.'
                : 'Could not send OTP. Please verify Firebase phone auth configuration and try again.';
      setSendError(message);
      Alert.alert('Could not send code', message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes('@')) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setEmailError('Password must be at least 6 characters.');
      return;
    }

    setEmailError(null);
    setLoading(true);
    try {
      try {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
      } catch (err: any) {
        console.log('SignIn error:', err?.code, err?.message);
        if (err?.code === 'auth/user-not-found' || err?.code === 'auth/invalid-credential') {
          try {
            await createUserWithEmailAndPassword(auth, cleanEmail, password);
          } catch (createErr: any) {
            console.log('CreateUser error:', createErr?.code, createErr?.message);
            if (createErr?.code === 'auth/email-already-in-use') {
               // The user exists, so the original invalid-credential was a wrong password
               throw { code: 'auth/wrong-password' };
            }
            throw createErr;
          }
        } else {
          throw err;
        }
      }
    } catch (err: any) {
      const code = err?.code as string | undefined;
      const message =
        code === 'auth/invalid-email'
          ? 'That email address looks invalid.'
          : code === 'auth/wrong-password'
            ? 'Incorrect password. Try again.'
            : code === 'auth/email-already-in-use'
              ? 'That email is already registered. Try signing in.'
              : code === 'auth/weak-password'
                ? 'Use a stronger password with at least 6 characters.'
                : code === 'auth/operation-not-allowed'
                  ? 'Email sign-in is disabled. Please enable it in the Firebase Console (Authentication > Sign-in method).'
                  : `Email sign-in failed. Error: ${code || 'Unknown'}`;
      setEmailError(message);
      Alert.alert('Email sign-in failed', message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!process.env.EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID || !process.env.EXPO_PUBLIC_FIREBASE_IOS_CLIENT_ID) {
      const msg = 'Missing Google client IDs in .env (EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID and EXPO_PUBLIC_FIREBASE_IOS_CLIENT_ID).';
      setSendError(msg);
      Alert.alert('Google setup needed', msg);
      return;
    }
  };

  // ── Step 2: Verify OTP ───────────────────────────────────────────────────
  const verifyOtp = async () => {
    const code = otp.join('');
    if (code.length !== 6 || !confirmationRef.current) return;
    setOtpError(null);
    setLoading(true);
    try {
      await confirmationRef.current.confirm(code);
      // useAuthStore._init() listener fires automatically on sign-in → navigates to Main
    } catch {
      const message = 'The OTP looks incorrect or expired. Please request a new code and try again.';
      setOtpError(message);
      Alert.alert('Verification failed', message);
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'otp') {
      setStep('phone');
      setOtp(['', '', '', '', '', '']);
      setOtpError(null);
      return;
    }
    if (authMode === 'email') {
      setAuthMode('phone');
      setEmailError(null);
      return;
    }
    navigation.navigate('Splash');
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
        <TouchableOpacity style={s.backBtn} onPress={handleBack} activeOpacity={0.8}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={s.logoArea}>
          <Text style={s.logoEmoji}>🍽️</Text>
          <Text style={s.logoText}>DineMatch</Text>
          <Text style={s.tagline}>Sign in to find your dining companion</Text>
        </View>

        {authMode === 'phone' && step === 'phone' ? (
          <View style={s.card}>
            <Text style={s.cardTitle}>Enter your number</Text>
            <Text style={s.cardSub}>We'll send a one-time code via SMS</Text>

            <View style={s.modeRow}>
              <TouchableOpacity style={[s.modeChip, s.modeChipActive]} disabled>
                <Text style={[s.modeText, s.modeTextActive]}>Phone</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.modeChip}
                onPress={() => {
                  setAuthMode('email');
                  setShowPicker(false);
                  setSendError(null);
                }}
              >
                <Text style={s.modeText}>Email</Text>
              </TouchableOpacity>
            </View>

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
            {!!sendError && <Text style={s.errorText}>{sendError}</Text>}

            <TouchableOpacity
              style={[s.btn, (loading || phoneNumber.length < 7) && s.btnDisabled]}
              onPress={sendOtp}
              disabled={loading || phoneNumber.length < 7}
              activeOpacity={0.85}
            >
              {loading ? <ActivityIndicator color={COLORS.cream} /> : <Text style={s.btnText}>Send code →</Text>}
            </TouchableOpacity>
          </View>
        ) : authMode === 'phone' ? (
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

            {!!otpError && <Text style={s.errorText}>{otpError}</Text>}

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
              onPress={() => { setStep('phone'); setOtp(['', '', '', '', '', '']); }}>
              <Text style={s.changeText}>← Change number</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.card}>
            <Text style={s.cardTitle}>Sign in with email</Text>
            <Text style={s.cardSub}>Use email/password or create a new account.</Text>

            <View style={s.modeRow}>
              <TouchableOpacity
                style={s.modeChip}
                onPress={() => {
                  setAuthMode('phone');
                  setEmailError(null);
                }}
              >
                <Text style={s.modeText}>Phone</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modeChip, s.modeChipActive]} disabled>
                <Text style={[s.modeText, s.modeTextActive]}>Email</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={s.emailInput}
              placeholder="Email address"
              placeholderTextColor={COLORS.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={s.emailInput}
              placeholder="Password"
              placeholderTextColor={COLORS.muted}
              secureTextEntry
              autoCapitalize="none"
              value={password}
              onChangeText={setPassword}
            />

            {!!emailError && <Text style={s.errorText}>{emailError}</Text>}

            <TouchableOpacity
              style={[s.btn, (loading || !email.trim() || password.length < 6) && s.btnDisabled]}
              onPress={handleEmailAuth}
              disabled={loading || !email.trim() || password.length < 6}
              activeOpacity={0.85}
            >
              {loading ? <ActivityIndicator color={COLORS.cream} /> : <Text style={s.btnText}>Continue with email →</Text>}
            </TouchableOpacity>

            <Text style={s.terms}>If you are new, we create an account automatically after sign-in fails once.</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.deepBrown },
  inner:        { flex: 1, justifyContent: 'center', padding: SPACING.md },
  backBtn:      { alignSelf: 'flex-start', marginBottom: 8, paddingHorizontal: 8, paddingVertical: 4 },
  backText:     { fontFamily: FONTS.sansMedium, fontSize: 14, color: '#e0c8a8' },
  logoArea:     { alignItems: 'center', marginBottom: 32 },
  logoEmoji:    { fontSize: 44, marginBottom: 6 },
  logoText:     { fontFamily: FONTS.serifDisplay, fontSize: 38, color: COLORS.cream, fontStyle: 'italic' },
  tagline:      { fontFamily: FONTS.sans, fontSize: 13, color: '#c4956a', marginTop: 4 },
  card:         { backgroundColor: COLORS.cream, borderRadius: 24, padding: SPACING.lg },
  cardTitle:    { fontFamily: FONTS.serifDisplay, fontSize: 24, color: COLORS.deepBrown, marginBottom: 4 },
  cardSub:      { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.muted, marginBottom: 20 },
  modeRow:      { flexDirection: 'row', gap: 8, marginBottom: 14 },
  modeChip:     { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 999, backgroundColor: '#f5e8d8', borderWidth: 1, borderColor: COLORS.border },
  modeChipActive: { backgroundColor: COLORS.rust, borderColor: COLORS.rust },
  modeText:     { fontFamily: FONTS.sansMedium, fontSize: 13, color: COLORS.brown },
  modeTextActive: { color: COLORS.cream },
  phoneRow:     { flexDirection: 'row', gap: 10, marginBottom: 8 },
  countryBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f5e8d8', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 12, borderWidth: 0.5, borderColor: COLORS.border },
  flag:         { fontSize: 18 },
  codeText:     { fontFamily: FONTS.sans, fontSize: 14, color: COLORS.brown, fontWeight: '500' },
  chevron:      { fontSize: 10, color: COLORS.muted },
  phoneInput:   { flex: 1, backgroundColor: '#f5e8d8', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontFamily: FONTS.sans, fontSize: 16, color: COLORS.brown, borderWidth: 0.5, borderColor: COLORS.border },
  emailInput:   { backgroundColor: '#f5e8d8', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontFamily: FONTS.sans, fontSize: 16, color: COLORS.brown, borderWidth: 0.5, borderColor: COLORS.border, marginBottom: 10 },
  dropdown:     { backgroundColor: COLORS.cream, borderRadius: 12, marginBottom: 12, borderWidth: 0.5, borderColor: COLORS.border, overflow: 'hidden' },
  dropdownRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 0.5, borderBottomColor: '#f0e0cc' },
  dropdownName: { flex: 1, fontFamily: FONTS.sans, fontSize: 14, color: COLORS.brown },
  terms:        { fontFamily: FONTS.sans, fontSize: 11, color: COLORS.muted, lineHeight: 16, marginBottom: 16 },
  errorText:    { fontFamily: FONTS.sans, fontSize: 12, color: '#a03520', marginBottom: 10, lineHeight: 16 },
  btn:          { backgroundColor: COLORS.rust, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  btnDisabled:  { backgroundColor: '#d4b898' },
  btnText:      { fontFamily: FONTS.sans, fontSize: 15, fontWeight: '500', color: COLORS.cream },
  dividerRow:   { flexDirection: 'row', alignItems: 'center', marginVertical: 12, gap: 8 },
  dividerLine:  { flex: 1, height: 1, backgroundColor: '#e8d8c8' },
  dividerText:  { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted },
  altBtn:       { backgroundColor: '#f5e8d8', borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 0.5, borderColor: COLORS.border, marginTop: 6 },
  altBtnText:   { fontFamily: FONTS.sansMedium, fontSize: 14, color: COLORS.brown },
  otpRow:       { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  otpBox:       { width: 44, height: 52, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: '#f5e8d8', fontFamily: FONTS.sans, fontSize: 22, fontWeight: '500', color: COLORS.deepBrown },
  otpBoxFilled: { borderColor: COLORS.rust, backgroundColor: '#fde8d8' },
  resendBtn:    { alignItems: 'center', marginTop: 16 },
  resendText:   { fontFamily: FONTS.sans, fontSize: 14, color: COLORS.rust, fontWeight: '500' },
  resendDisabled: { color: COLORS.muted },
  changeBtn:    { alignItems: 'center', marginTop: 10 },
  changeText:   { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.muted },
});
