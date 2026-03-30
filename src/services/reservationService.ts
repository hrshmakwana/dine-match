// src/services/reservationService.ts
// Premium feature: reserve a restaurant table directly from the app.
// Uses OpenTable's API (or falls back to Resy or direct phone booking).

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReservationSlot {
  time: string;               // "19:00"
  partySize: number;
  available: boolean;
  slotId: string;             // provider-specific slot ID
}

export interface Reservation {
  reservationId: string;
  matchId: string;
  restaurantId: string;
  restaurantName: string;
  date: string;
  time: string;
  partySize: 2;               // always 2 for DineMatch
  bookedByUserId: string;
  confirmationCode: string;
  provider: 'opentable' | 'resy' | 'manual';
  status: 'confirmed' | 'cancelled' | 'pending';
  createdAt: number;
}

// ─── OpenTable API integration ────────────────────────────────────────────────
// Docs: https://platform.opentable.com/documentation
// You need: OpenTable Partner API key (apply at platform.opentable.com)

const OPENTABLE_API = 'https://platform.opentable.com/sync/v2';
const OPENTABLE_KEY = process.env.EXPO_PUBLIC_OPENTABLE_API_KEY;

export async function getAvailableSlots(
  restaurantId: string,       // OpenTable restaurant ID (from their restaurant DB)
  date: string,               // "2024-12-25"
  time: string,               // "19:00" — will show slots around this time
): Promise<ReservationSlot[]> {
  if (!OPENTABLE_KEY) {
    console.warn('OpenTable API key not set — returning mock slots');
    return getMockSlots(time);
  }

  const params = new URLSearchParams({
    restaurant_ids: restaurantId,
    date,
    party_size: '2',
    start_time: subtractMinutes(time, 60),
    end_time: addMinutes(time, 90),
  });

  const res = await fetch(`${OPENTABLE_API}/restaurants/availability?${params}`, {
    headers: { Authorization: `Bearer ${OPENTABLE_KEY}` },
  });

  if (!res.ok) throw new Error(`OpenTable API error: ${res.status}`);
  const data = await res.json();

  return (data.availability ?? []).map((slot: any) => ({
    time: slot.datetime,
    partySize: 2,
    available: slot.available,
    slotId: slot.slot_token,
  }));
}

export async function bookTable(
  restaurantId: string,
  slotId: string,
  date: string,
  time: string,
  matchId: string,
  userId: string,
  userFirstName: string,
  userLastName: string,
  userEmail: string,
  userPhone: string,
): Promise<Reservation> {
  if (!OPENTABLE_KEY) {
    // Demo mode — return a fake confirmation
    return {
      reservationId: 'demo_res_' + Date.now(),
      matchId,
      restaurantId,
      restaurantName: 'Restaurant',
      date, time,
      partySize: 2,
      bookedByUserId: userId,
      confirmationCode: 'DEMO' + Math.floor(Math.random() * 90000 + 10000),
      provider: 'opentable',
      status: 'confirmed',
      createdAt: Date.now(),
    };
  }

  const res = await fetch(`${OPENTABLE_API}/reservations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENTABLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      restaurant_id: restaurantId,
      slot_token: slotId,
      party_size: 2,
      guest: {
        first_name: userFirstName,
        last_name: userLastName,
        email: userEmail,
        phone: userPhone,
      },
      notes: 'Booked via DineMatch — table for 2',
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message ?? 'Booking failed');
  }

  const data = await res.json();

  return {
    reservationId: data.reservation_id,
    matchId,
    restaurantId,
    restaurantName: data.restaurant?.name ?? '',
    date, time,
    partySize: 2,
    bookedByUserId: userId,
    confirmationCode: data.confirmation_number,
    provider: 'opentable',
    status: 'confirmed',
    createdAt: Date.now(),
  };
}

export async function cancelReservation(reservationId: string): Promise<void> {
  if (!OPENTABLE_KEY) return;

  const res = await fetch(`${OPENTABLE_API}/reservations/${reservationId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${OPENTABLE_KEY}` },
  });

  if (!res.ok) throw new Error('Cancellation failed');
}

// ─── Alternative: Resy API ────────────────────────────────────────────────────
// Apply at resy.com/business to get a Resy API key (mainly US restaurants).
// const RESY_API = 'https://api.resy.com/3';
// const RESY_KEY = process.env.EXPO_PUBLIC_RESY_API_KEY;

// ─── Fallback: phone / WhatsApp booking ──────────────────────────────────────
// If neither API is available, open native dialer or WhatsApp with pre-filled message
import { Linking } from 'react-native';

export async function openPhoneBooking(restaurantPhone: string): Promise<void> {
  await Linking.openURL(`tel:${restaurantPhone}`);
}

export async function openWhatsAppBooking(
  restaurantPhone: string,
  restaurantName: string,
  date: string,
  time: string,
): Promise<void> {
  const message = encodeURIComponent(
    `Hi, I'd like to book a table for 2 at ${restaurantName} on ${date} at ${time}. This is a DineMatch booking.`
  );
  await Linking.openURL(`https://wa.me/${restaurantPhone}?text=${message}`);
}

// ─── Premium gate check ───────────────────────────────────────────────────────
// This feature is only for premium users (future in-app purchase)
export type PremiumTier = 'free' | 'premium';

export function isPremiumFeature(): boolean {
  // TODO: check user's subscription status from Firestore
  // For now, returns false (all users are on free tier)
  return false;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toMins(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function fromMins(mins: number) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}
function addMinutes(t: string, n: number) { return fromMins(toMins(t) + n); }
function subtractMinutes(t: string, n: number) { return fromMins(Math.max(0, toMins(t) - n)); }

function getMockSlots(aroundTime: string): ReservationSlot[] {
  const offsets = [-60, -30, 0, 30, 60, 90];
  return offsets.map((offset, i) => ({
    time: addMinutes(aroundTime, offset),
    partySize: 2,
    available: i !== 2, // make the exact time unavailable for realism
    slotId: `mock_slot_${i}`,
  }));
}
