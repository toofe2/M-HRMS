// src/lib/bidi.ts
// Strong LTR isolation for RTL UIs (iOS Safari-safe)

const LRI = '\u2066'; // Left-to-Right Isolate
const PDI = '\u2069'; // Pop Directional Isolate

// Returns text wrapped with LRI/PDI (stronger than LRM)
export function ltr(text: string | number | null | undefined) {
  if (text === null || text === undefined || text === '') return '—';
  return `${LRI}${String(text)}${PDI}`;
}

// Parse input date safely and return YYYY-MM-DD
export function formatDateISO(date: string | null | undefined) {
  if (!date) return '—';

  // If already looks like YYYY-MM-DD (Supabase date), keep it
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // Fallback to Date parsing
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Safe date display (ISO + strong isolation)
export function formatDateSafe(date: string | null | undefined) {
  const iso = formatDateISO(date);
  return iso === '—' ? '—' : ltr(iso);
}

// Safe time display (HH:MM)
export function formatTimeSafe(date: string | null | undefined) {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return ltr(`${hh}:${mm}`);
}

// Safe number formatting (no locale surprises)
export function formatNumberSafe(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) return ltr(String(value));
  return ltr(String(n));
}

// Safe currency (IQD/ USD …)
export function formatCurrencySafe(amount: number | null | undefined, currency = 'USD') {
  const v = Number(amount ?? 0);
  const s = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
  return ltr(s);
}

// ✅ Most important helper for your case (range)
// Uses ISO dates + en dash, fully isolated
export function formatDateRangeSafe(start: string | null | undefined, end: string | null | undefined) {
  const a = formatDateISO(start);
  const b = formatDateISO(end);
  if (a === '—' || b === '—') return '—';
  return ltr(`${a} – ${b}`);
}
