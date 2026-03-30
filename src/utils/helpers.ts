import { nanoid } from 'nanoid/non-secure';

export function generateId(prefix: string): string {
  return `${prefix}_${nanoid(12)}`;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatTime12h(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}

export function todayISODate(): string {
  return new Date().toISOString().split('T')[0];
}

export function timesOverlap(timeA: string, timeB: string, windowMin = 30): boolean {
  const toMins = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  return Math.abs(toMins(timeA) - toMins(timeB)) <= windowMin;
}
