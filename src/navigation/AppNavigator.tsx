import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuthStore } from '../hooks/useAuthStore';
import { COLORS, FONTS } from '../utils/theme';

// ── Screens ───────────────────────────────────────────────────────────────────
import SplashScreen          from '../screens/SplashScreen';
import PhoneAuthScreen       from '../screens/PhoneAuthScreen';
import ProfileSetupScreen    from '../screens/ProfileSetupScreen';
import FilterSetupScreen     from '../screens/FilterSetupScreen';
import RestaurantListScreen  from '../screens/RestaurantListScreen';
import SearchingScreen       from '../screens/SearchingScreen';
import MatchIncomingScreen   from '../screens/MatchIncomingScreen';
import MatchConfirmedScreen  from '../screens/MatchConfirmedScreen';
import ChatLockedScreen      from '../screens/ChatLockedScreen';
import ChatUnlockedScreen    from '../screens/ChatUnlockedScreen';
import ActiveMatchScreen     from '../screens/ActiveMatchScreen';
import ProfileScreen         from '../screens/ProfileScreen';

// ── Stack/Tab instances ───────────────────────────────────────────────────────
const RootStack   = createNativeStackNavigator();
const AuthStack   = createNativeStackNavigator();
const MainTab     = createBottomTabNavigator();
const DineStack   = createNativeStackNavigator();
const MatchStack  = createNativeStackNavigator();

const NO_HEADER = { headerShown: false };

// ── Auth Flow: Splash → PhoneAuth → ProfileSetup → FilterSetup ───────────────
function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={NO_HEADER}>
      <AuthStack.Screen name="Splash"        component={SplashScreen} />
      <AuthStack.Screen name="PhoneAuth"     component={PhoneAuthScreen} />
      <AuthStack.Screen name="ProfileSetup"  component={ProfileSetupScreen} />
      <AuthStack.Screen name="FilterSetup"   component={FilterSetupScreen} />
    </AuthStack.Navigator>
  );
}

// ── Dine Tab Stack: RestaurantList → Searching → MatchIncoming → … → Chat ────
function DineNavigator() {
  return (
    <DineStack.Navigator screenOptions={NO_HEADER}>
      <DineStack.Screen name="RestaurantList"  component={RestaurantListScreen} />
      <DineStack.Screen name="Searching"       component={SearchingScreen} />
      <DineStack.Screen name="MatchIncoming"   component={MatchIncomingScreen} />
      <DineStack.Screen name="MatchConfirmed"  component={MatchConfirmedScreen} />
      <DineStack.Screen name="ChatLocked"      component={ChatLockedScreen} />
      <DineStack.Screen name="ChatUnlocked"    component={ChatUnlockedScreen} />
    </DineStack.Navigator>
  );
}

// ── My Date Tab Stack: ActiveMatch → ChatLocked/Unlocked ─────────────────────
function MatchNavigator() {
  return (
    <MatchStack.Navigator screenOptions={NO_HEADER}>
      <MatchStack.Screen name="ActiveMatch"  component={ActiveMatchScreen} />
      <MatchStack.Screen name="ChatLocked"   component={ChatLockedScreen} />
      <MatchStack.Screen name="ChatUnlocked" component={ChatUnlockedScreen} />
    </MatchStack.Navigator>
  );
}

// ── Main Tab Navigator ────────────────────────────────────────────────────────
function MainNavigator() {
  return (
    <MainTab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor:   COLORS.rust,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarStyle: {
          backgroundColor: COLORS.cream,
          borderTopColor:  COLORS.border,
          borderTopWidth:  0.5,
          paddingBottom:   6,
          height:          56,
        },
        tabBarLabelStyle: { fontFamily: FONTS.sans, fontSize: 11, marginBottom: 2 },
        tabBarIcon: ({ focused, color, size }) => {
          const MAP: Record<string, [string, string]> = {
            Dine:    ['restaurant',    'restaurant-outline'],
            MyDate:  ['heart',         'heart-outline'],
            Profile: ['person-circle', 'person-circle-outline'],
          };
          const [on, off] = MAP[route.name] ?? ['ellipse', 'ellipse-outline'];
          return <Ionicons name={(focused ? on : off) as any} size={size} color={color} />;
        },
      })}
    >
      <MainTab.Screen name="Dine"    component={DineNavigator}  options={{ title: 'Dine' }} />
      <MainTab.Screen name="MyDate"  component={MatchNavigator} options={{ title: 'My Date' }} />
      <MainTab.Screen name="Profile" component={ProfileScreen}  options={{ title: 'Me' }} />
    </MainTab.Navigator>
  );
}

// ── Root: gates on auth + profile completion ──────────────────────────────────
export default function AppNavigator() {
  const { firebaseUser, user, isLoading, isProfileComplete } = useAuthStore();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.deepBrown }}>
        <ActivityIndicator color={COLORS.orange} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={NO_HEADER}>
        {!firebaseUser ? (
          // Not signed in → auth flow
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        ) : !isProfileComplete ? (
          // Signed in but profile incomplete → finish setup
          <RootStack.Screen name="Setup" component={AuthNavigator} />
        ) : (
          // Fully set up → main app
          <RootStack.Screen name="Main" component={MainNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
