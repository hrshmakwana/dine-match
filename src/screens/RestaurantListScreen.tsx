// src/screens/RestaurantListScreen.tsx
// Google Maps + Places API — find nearby restaurants and pick one

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Image, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { searchNearbyRestaurants, autocompleteRestaurants } from '../services/restaurantService';
import { Restaurant, LatLng, SearchStackParamList } from '../types';
import { useAuthStore } from '../hooks/useAuthStore';
import { useFilterStore } from '../hooks/useFilterStore';
import { COLORS, FONTS, SPACING } from '../utils/theme';

type NavProp = NativeStackNavigationProp<SearchStackParamList, 'RestaurantList'>;

// Custom warm terracotta map style
const MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#f5e8d8' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#3a2010' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#fdf6ef' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#e8d0b8' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#d4b898' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#c4a078' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c8d8e8' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#d8ead0' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
];

const CUISINE_FILTERS = ['All', '🍕 Italian', '🍱 Japanese', '🌮 Mexican', '🍛 Indian', '🥗 Vegan', '🍔 American'];

export default function RestaurantListScreen() {
  const navigation = useNavigation<NavProp>();
  const { user } = useAuthStore();
  const { filters } = useFilterStore();

  const mapRef = useRef<MapView>(null);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [filteredRestaurants, setFilteredRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState<{ placeId: string; name: string; address: string }[]>([]);
  const [activeCuisine, setActiveCuisine] = useState('All');
  const cardAnim = useRef(new Animated.Value(0)).current;

  // ── Get user location + load restaurants ──────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLoading(false); return; }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords: LatLng = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setUserLocation(coords);

      // Center map on user
      mapRef.current?.animateToRegion({
        ...coords,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 800);

      await loadRestaurants(coords);
    })();
  }, []);

  const loadRestaurants = async (coords: LatLng, cuisine?: string) => {
    setLoading(true);
    try {
      const results = await searchNearbyRestaurants(
        coords,
        filters.maxDistanceKm * 1000,
        cuisine === 'All' || !cuisine ? undefined : cuisine.replace(/^.\s/, ''), // strip emoji
      );
      setRestaurants(results);
      setFilteredRestaurants(results);
    } catch (err) {
      console.error('Restaurant search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Cuisine filter ────────────────────────────────────────────────────────
  const handleCuisineFilter = (cuisine: string) => {
    setActiveCuisine(cuisine);
    if (!userLocation) return;
    loadRestaurants(userLocation, cuisine);
  };

  // ── Search autocomplete ───────────────────────────────────────────────────
  useEffect(() => {
    if (!searchText || !userLocation) { setSuggestions([]); return; }
    const timeout = setTimeout(async () => {
      const results = await autocompleteRestaurants(searchText, userLocation);
      setSuggestions(results);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchText]);

  // ── Select restaurant ─────────────────────────────────────────────────────
  const handleSelect = useCallback((restaurant: Restaurant) => {
    setSelectedRestaurant(restaurant);
    setSuggestions([]);
    setSearchText('');

    // Animate card in
    cardAnim.setValue(0);
    Animated.spring(cardAnim, { toValue: 1, useNativeDriver: true, damping: 18 }).start();

    // Pan map to restaurant
    mapRef.current?.animateToRegion({
      ...restaurant.coordinates,
      latitudeDelta: 0.008,
      longitudeDelta: 0.008,
    }, 600);
  }, [cardAnim]);

  const handleConfirm = () => {
    if (!selectedRestaurant) return;
    navigation.navigate('Searching', {
      restaurant: selectedRestaurant,
      desiredTime: '19:00',
      filters,
    });
  };

  const priceDots = (level: number) => '₹'.repeat(level);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── Search bar ────────────────────────────────────────────────────── */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={COLORS.muted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search restaurants…"
            placeholderTextColor={COLORS.muted}
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchText(''); setSuggestions([]); }}>
              <Ionicons name="close-circle" size={16} color={COLORS.muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Autocomplete suggestions */}
        {suggestions.length > 0 && (
          <View style={styles.suggestions}>
            {suggestions.slice(0, 5).map((s) => (
              <TouchableOpacity
                key={s.placeId}
                style={styles.suggestion}
                onPress={() => {
                  // Find in loaded list or create stub
                  const found = restaurants.find(r => r.placeId === s.placeId);
                  if (found) handleSelect(found);
                }}
              >
                <Ionicons name="location-outline" size={14} color={COLORS.rust} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.suggestionName}>{s.name}</Text>
                  <Text style={styles.suggestionAddr}>{s.address}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* ── Cuisine filter pills ──────────────────────────────────────────── */}
      <FlatList
        horizontal
        data={CUISINE_FILTERS}
        keyExtractor={(i) => i}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cuisineRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.cuisineChip, activeCuisine === item && styles.cuisineChipActive]}
            onPress={() => handleCuisineFilter(item)}
          >
            <Text style={[styles.cuisineText, activeCuisine === item && styles.cuisineTextActive]}>
              {item}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* ── Google Map ───────────────────────────────────────────────────── */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          customMapStyle={MAP_STYLE}
          showsUserLocation
          showsMyLocationButton={false}
          initialRegion={{
            latitude: userLocation?.latitude ?? 19.076,
            longitude: userLocation?.longitude ?? 72.877,
            latitudeDelta: 0.04,
            longitudeDelta: 0.04,
          }}
        >
          {filteredRestaurants.map((r) => (
            <Marker
              key={r.placeId}
              coordinate={r.coordinates}
              onPress={() => handleSelect(r)}
            >
              <View style={[
                styles.mapPin,
                selectedRestaurant?.placeId === r.placeId && styles.mapPinSelected,
              ]}>
                <Text style={styles.mapPinText}>🍽️</Text>
              </View>
            </Marker>
          ))}
        </MapView>

        {/* My location button */}
        {userLocation && (
          <TouchableOpacity
            style={styles.myLocationBtn}
            onPress={() => mapRef.current?.animateToRegion({
              ...userLocation,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }, 600)}
          >
            <Ionicons name="locate" size={20} color={COLORS.rust} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Restaurant list / selected card ──────────────────────────────── */}
      {selectedRestaurant ? (
        // Selected restaurant card
        <Animated.View style={[
          styles.selectedCard,
          { transform: [{ translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [100, 0] }) }] }
        ]}>
          <View style={styles.selectedCardInner}>
            {selectedRestaurant.photoUrl ? (
              <Image source={{ uri: selectedRestaurant.photoUrl }} style={styles.restoPhoto} />
            ) : (
              <View style={styles.restoPhotoPlaceholder}>
                <Text style={{ fontSize: 28 }}>🍽️</Text>
              </View>
            )}
            <View style={styles.restoInfo}>
              <Text style={styles.restoName} numberOfLines={1}>{selectedRestaurant.name}</Text>
              <Text style={styles.restoCuisine}>{selectedRestaurant.cuisine}</Text>
              <View style={styles.restoMeta}>
                <Text style={styles.restoMetaText}>⭐ {selectedRestaurant.rating}</Text>
                <Text style={styles.restoMetaDot}>·</Text>
                <Text style={styles.restoMetaText}>{priceDots(selectedRestaurant.priceLevel)}</Text>
                <Text style={styles.restoMetaDot}>·</Text>
                <Text style={styles.restoMetaText}>{selectedRestaurant.distanceKm} km</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setSelectedRestaurant(null)}>
              <Ionicons name="close" size={20} color={COLORS.muted} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} activeOpacity={0.85}>
            <Text style={styles.confirmBtnText}>Search for dining partners here →</Text>
          </TouchableOpacity>
        </Animated.View>
      ) : (
        // Scrollable list
        <View style={styles.listContainer}>
          <Text style={styles.listTitle}>
            {loading ? 'Finding nearby restaurants…' : `${filteredRestaurants.length} places nearby`}
          </Text>
          {loading ? (
            <ActivityIndicator color={COLORS.rust} style={{ marginTop: 20 }} />
          ) : (
            <FlatList
              data={filteredRestaurants}
              keyExtractor={(r) => r.placeId}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: SPACING.md, paddingBottom: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.restoCard} onPress={() => handleSelect(item)} activeOpacity={0.85}>
                  {item.photoUrl ? (
                    <Image source={{ uri: item.photoUrl }} style={styles.restoCardPhoto} />
                  ) : (
                    <View style={[styles.restoCardPhoto, styles.restoCardPhotoPlaceholder]}>
                      <Text style={{ fontSize: 22 }}>🍽️</Text>
                    </View>
                  )}
                  <View style={styles.restoCardInfo}>
                    <Text style={styles.restoCardName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.restoCardCuisine}>{item.cuisine}</Text>
                    <View style={styles.restoCardMeta}>
                      <Text style={styles.restoCardMetaText}>⭐ {item.rating}</Text>
                      <Text style={styles.restoCardDist}>{item.distanceKm} km</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },

  searchContainer: { paddingHorizontal: SPACING.md, paddingTop: 8, paddingBottom: 4, zIndex: 10 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f5e8d8', borderRadius: 12,
    borderWidth: 0.5, borderColor: COLORS.border,
    paddingHorizontal: 12, height: 42,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontFamily: FONTS.sans, fontSize: 14, color: COLORS.brown },
  suggestions: {
    backgroundColor: COLORS.cream, borderRadius: 12, marginTop: 4,
    borderWidth: 0.5, borderColor: COLORS.border,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  suggestion: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
    borderBottomWidth: 0.5, borderBottomColor: '#f0e0cc',
  },
  suggestionName: { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.brown, fontWeight: '500' },
  suggestionAddr: { fontFamily: FONTS.sans, fontSize: 11, color: COLORS.muted, marginTop: 1 },

  cuisineRow: { paddingHorizontal: SPACING.md, paddingVertical: 8, gap: 7 },
  cuisineChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 50,
    borderWidth: 0.5, borderColor: COLORS.border, backgroundColor: COLORS.cream,
  },
  cuisineChipActive: { backgroundColor: COLORS.rust, borderColor: COLORS.rust },
  cuisineText: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.brown },
  cuisineTextActive: { color: COLORS.cream, fontWeight: '500' },

  mapContainer: { flex: 1, minHeight: 220, position: 'relative' },
  map: { ...StyleSheet.absoluteFillObject },
  mapPin: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.cream, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.rust,
  },
  mapPinSelected: { backgroundColor: COLORS.rust, borderColor: COLORS.deepBrown, transform: [{ scale: 1.2 }] },
  mapPinText: { fontSize: 16 },
  myLocationBtn: {
    position: 'absolute', bottom: 12, right: 12,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.cream, alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5, borderColor: COLORS.border,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },

  // Selected card
  selectedCard: {
    backgroundColor: COLORS.cream, borderTopWidth: 0.5, borderTopColor: COLORS.border,
    padding: SPACING.md,
  },
  selectedCardInner: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  restoPhoto: { width: 56, height: 56, borderRadius: 10 },
  restoPhotoPlaceholder: {
    width: 56, height: 56, borderRadius: 10,
    backgroundColor: '#f5e8d8', alignItems: 'center', justifyContent: 'center',
  },
  restoInfo: { flex: 1 },
  restoName: { fontFamily: FONTS.sans, fontSize: 15, fontWeight: '500', color: COLORS.deepBrown },
  restoCuisine: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted, marginTop: 1 },
  restoMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 4 },
  restoMetaText: { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.brown },
  restoMetaDot: { color: COLORS.muted },
  confirmBtn: {
    backgroundColor: COLORS.rust, borderRadius: 14,
    paddingVertical: 13, alignItems: 'center',
  },
  confirmBtnText: { fontFamily: FONTS.sans, fontSize: 15, fontWeight: '500', color: COLORS.cream },

  // Restaurant list
  listContainer: { maxHeight: 180 },
  listTitle: {
    fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted,
    paddingHorizontal: SPACING.md, paddingTop: 10, paddingBottom: 4,
  },
  restoCard: {
    width: 150, backgroundColor: '#f5e8d8', borderRadius: 14,
    marginRight: 10, overflow: 'hidden', borderWidth: 0.5, borderColor: COLORS.border,
  },
  restoCardPhoto: { width: '100%', height: 80 },
  restoCardPhotoPlaceholder: { backgroundColor: '#e8d0b8', alignItems: 'center', justifyContent: 'center' },
  restoCardInfo: { padding: 8 },
  restoCardName: { fontFamily: FONTS.sans, fontSize: 13, fontWeight: '500', color: COLORS.deepBrown },
  restoCardCuisine: { fontFamily: FONTS.sans, fontSize: 11, color: COLORS.muted, marginTop: 1 },
  restoCardMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  restoCardMetaText: { fontFamily: FONTS.sans, fontSize: 11, color: COLORS.brown },
  restoCardDist: { fontFamily: FONTS.sans, fontSize: 11, color: COLORS.rust, fontWeight: '500' },
});
