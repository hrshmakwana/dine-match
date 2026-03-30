// src/services/restaurantService.ts
// Google Places API — nearby restaurant search, details, autocomplete

import { LatLng, Restaurant } from '../types';

const PLACES_API_BASE = 'https://maps.googleapis.com/maps/api/place';
const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY!;

// Map Google price level (0-4) to our type
function mapPriceLevel(level?: number): 1 | 2 | 3 | 4 {
  if (!level || level <= 1) return 1;
  if (level === 2) return 2;
  if (level === 3) return 3;
  return 4;
}

// Extract primary cuisine type from Google types array
function extractCuisine(types: string[]): string {
  const cuisineMap: Record<string, string> = {
    italian_restaurant: 'Italian',
    japanese_restaurant: 'Japanese',
    chinese_restaurant: 'Chinese',
    indian_restaurant: 'Indian',
    mexican_restaurant: 'Mexican',
    thai_restaurant: 'Thai',
    french_restaurant: 'French',
    mediterranean_restaurant: 'Mediterranean',
    american_restaurant: 'American',
    pizza_restaurant: 'Pizza',
    sushi_restaurant: 'Sushi',
    seafood_restaurant: 'Seafood',
    steakhouse: 'Steakhouse',
    cafe: 'Café',
    bakery: 'Bakery',
    bar: 'Bar & Food',
    restaurant: 'Restaurant',
    food: 'Restaurant',
  };
  for (const t of types) {
    if (cuisineMap[t]) return cuisineMap[t];
  }
  return 'Restaurant';
}

// ─── Nearby restaurant search ─────────────────────────────────────────────────
export async function searchNearbyRestaurants(
  location: LatLng,
  radiusMeters = 2000,
  cuisine?: string,
): Promise<Restaurant[]> {
  const keyword = cuisine ? `${cuisine} restaurant` : 'restaurant';

  const url = new URL(`${PLACES_API_BASE}/nearbysearch/json`);
  url.searchParams.set('location', `${location.latitude},${location.longitude}`);
  url.searchParams.set('radius', String(radiusMeters));
  url.searchParams.set('type', 'restaurant');
  url.searchParams.set('keyword', keyword);
  url.searchParams.set('opennow', 'true');
  url.searchParams.set('key', API_KEY);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Places API error: ${data.status} — ${data.error_message ?? ''}`);
  }

  return (data.results ?? []).map((place: any) => {
    const distKm = haversineKm(location, {
      latitude: place.geometry.location.lat,
      longitude: place.geometry.location.lng,
    });

    return {
      placeId: place.place_id,
      name: place.name,
      address: place.vicinity,
      cuisine: extractCuisine(place.types ?? []),
      priceLevel: mapPriceLevel(place.price_level),
      rating: place.rating ?? 0,
      distanceKm: Math.round(distKm * 10) / 10,
      coordinates: {
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng,
      },
      photoUrl: place.photos?.[0]
        ? buildPhotoUrl(place.photos[0].photo_reference)
        : undefined,
      isOpenNow: place.opening_hours?.open_now ?? true,
    } as Restaurant;
  }).sort((a: Restaurant, b: Restaurant) => a.distanceKm - b.distanceKm);
}

// ─── Get full restaurant details by placeId ───────────────────────────────────
export async function getRestaurantDetails(placeId: string): Promise<Partial<Restaurant> & {
  phoneNumber?: string;
  website?: string;
  openingHours?: string[];
}> {
  const url = new URL(`${PLACES_API_BASE}/details/json`);
  url.searchParams.set('place_id', placeId);
  url.searchParams.set('fields', [
    'name', 'formatted_address', 'formatted_phone_number',
    'website', 'opening_hours', 'rating', 'price_level',
    'geometry', 'photos', 'types',
  ].join(','));
  url.searchParams.set('key', API_KEY);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.status !== 'OK') {
    throw new Error(`Place details error: ${data.status}`);
  }

  const p = data.result;
  return {
    placeId,
    name: p.name,
    address: p.formatted_address,
    cuisine: extractCuisine(p.types ?? []),
    priceLevel: mapPriceLevel(p.price_level),
    rating: p.rating,
    coordinates: {
      latitude: p.geometry?.location?.lat,
      longitude: p.geometry?.location?.lng,
    },
    photoUrl: p.photos?.[0] ? buildPhotoUrl(p.photos[0].photo_reference) : undefined,
    phoneNumber: p.formatted_phone_number,
    website: p.website,
    openingHours: p.opening_hours?.weekday_text ?? [],
  };
}

// ─── Autocomplete for restaurant name search ──────────────────────────────────
export async function autocompleteRestaurants(
  input: string,
  location: LatLng,
  radiusMeters = 5000,
): Promise<{ placeId: string; name: string; address: string }[]> {
  if (input.length < 2) return [];

  const url = new URL(`${PLACES_API_BASE}/autocomplete/json`);
  url.searchParams.set('input', input);
  url.searchParams.set('types', 'establishment');
  url.searchParams.set('location', `${location.latitude},${location.longitude}`);
  url.searchParams.set('radius', String(radiusMeters));
  url.searchParams.set('key', API_KEY);

  const res = await fetch(url.toString());
  const data = await res.json();

  return (data.predictions ?? []).map((p: any) => ({
    placeId: p.place_id,
    name: p.structured_formatting?.main_text ?? p.description,
    address: p.structured_formatting?.secondary_text ?? '',
  }));
}

// ─── Build Google Places photo URL ───────────────────────────────────────────
function buildPhotoUrl(photoReference: string, maxWidth = 400): string {
  return `${PLACES_API_BASE}/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${API_KEY}`;
}

// ─── Haversine distance in km ─────────────────────────────────────────────────
function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function toRad(deg: number) { return (deg * Math.PI) / 180; }
