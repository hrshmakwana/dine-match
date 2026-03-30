import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Dimensions, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { COLORS, FONTS } from '../utils/theme';

const { height } = Dimensions.get('window');
type Nav = NativeStackNavigationProp<RootStackParamList, 'Splash'>;

export default function SplashScreen() {
  const navigation = useNavigation<Nav>();

  // Entrance animations
  const logoScale   = useRef(new Animated.Value(0.7)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const tagOpacity  = useRef(new Animated.Value(0)).current;
  const btnOpacity  = useRef(new Animated.Value(0)).current;
  const btnTranslate = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.sequence([
      // Logo pops in
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 100 }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      // Tagline fades in
      Animated.timing(tagOpacity, { toValue: 1, duration: 400, useNativeDriver: true, delay: 100 }),
      // Buttons slide up
      Animated.parallel([
        Animated.timing(btnOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.spring(btnTranslate, { toValue: 0, useNativeDriver: true, damping: 14 }),
      ]),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.deepBrown} />

      {/* Decorative circles */}
      <View style={styles.circleTopRight} />
      <View style={styles.circleBottomLeft} />

      <SafeAreaView style={styles.safe}>
        {/* ── Logo section ─────────────────────────────────────────────── */}
        <View style={styles.logoArea}>
          <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
            <Text style={styles.fork}>🍽️</Text>
            <Text style={styles.logoText}>
              Dine<Text style={styles.logoAccent}>Match</Text>
            </Text>
          </Animated.View>

          <Animated.Text style={[styles.tagline, { opacity: tagOpacity }]}>
            find your dining companion
          </Animated.Text>
        </View>

        {/* ── Feature teasers ───────────────────────────────────────────── */}
        <Animated.View style={[styles.features, { opacity: tagOpacity }]}>
          <FeatureRow icon="🗺️" text="Pick a nearby restaurant" />
          <FeatureRow icon="⏰" text="Choose your dining time" />
          <FeatureRow icon="✨" text="Get matched with a stranger" />
          <FeatureRow icon="💬" text="Chat only when you both arrive" />
        </Animated.View>

        {/* ── Buttons ───────────────────────────────────────────────────── */}
        <Animated.View
          style={[
            styles.btnGroup,
            { opacity: btnOpacity, transform: [{ translateY: btnTranslate }] },
          ]}
        >
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate('Auth')}
            activeOpacity={0.87}
          >
            <Text style={styles.primaryBtnText}>Get started</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => navigation.navigate('Auth')}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryBtnText}>Already have an account? Sign in</Text>
          </TouchableOpacity>
        </Animated.View>

        <Text style={styles.legal}>
          By continuing you agree to our Terms of Service and Privacy Policy.
        </Text>
      </SafeAreaView>
    </View>
  );
}

function FeatureRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.featureRow}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.deepBrown },
  safe: { flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28, paddingBottom: 20 },

  // Decorative circles
  circleTopRight: {
    position: 'absolute', top: -80, right: -80,
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: '#3d2010', opacity: 0.8,
  },
  circleBottomLeft: {
    position: 'absolute', bottom: -60, left: -60,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: '#3d2010', opacity: 0.8,
  },

  // Logo
  logoArea: { alignItems: 'center', marginTop: height * 0.08 },
  fork: { fontSize: 56, textAlign: 'center', marginBottom: 8 },
  logoText: {
    fontFamily: FONTS.serifDisplay,
    fontSize: 52, color: COLORS.cream,
    letterSpacing: -1, textAlign: 'center',
  },
  logoAccent: { color: COLORS.orange, fontStyle: 'italic' },
  tagline: {
    fontFamily: FONTS.sans, fontSize: 14,
    color: '#c4956a', letterSpacing: 2,
    textTransform: 'uppercase', marginTop: 10,
  },

  // Feature list
  features: { width: '100%', gap: 12 },
  featureRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
  },
  featureIcon: { fontSize: 20 },
  featureText: { fontFamily: FONTS.sans, fontSize: 14, color: '#e0c8a8', flex: 1 },

  // Buttons
  btnGroup: { width: '100%', gap: 12 },
  primaryBtn: {
    backgroundColor: COLORS.orange, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
  },
  primaryBtnText: { fontFamily: FONTS.sansMedium, fontSize: 16, color: COLORS.cream },
  secondaryBtn: { alignItems: 'center', paddingVertical: 6 },
  secondaryBtnText: { fontFamily: FONTS.sans, fontSize: 13, color: '#c4956a' },

  legal: {
    fontFamily: FONTS.sans, fontSize: 11,
    color: '#7a5a40', textAlign: 'center', lineHeight: 16,
  },
});
