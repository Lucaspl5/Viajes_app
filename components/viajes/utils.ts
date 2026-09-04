"use client";

import type { ItineraryDay, Booking } from "./types";

function uid() { return Math.random().toString(36).slice(2, 9); }

function genTripCode() {
  const L = "ABCDEFGHJKLMNPQRSTUVWXYZ", N = "23456789";
  let c = "";
  for (let i = 0; i < 4; i++) c += L[Math.floor(Math.random() * L.length)];
  c += "-";
  for (let i = 0; i < 4; i++) c += N[Math.floor(Math.random() * N.length)];
  return c;
}

function formatDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}
function formatDateFull(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}
function tripDuration(s: string | null, e: string | null) {
  if (!s || !e) return null;
  return Math.round((new Date(e + "T12:00:00").getTime() - new Date(s + "T12:00:00").getTime()) / 86_400_000) + 1;
}
function isValidUrl(s: string) {
  try { const u = new URL(s); return u.protocol === "https:" || u.protocol === "http:"; } catch { return false; }
}

// ─── Storage ─────────────────────────────────────────────────────────────────

// Short-lived in-memory cache so switching tabs doesn't refetch over the
// network every time — each tab component calls loadShared on mount, and
// without this, revisiting a tab you were just on a second ago meant a full
// round trip to Redis again. Writes refresh the cache immediately so this
// never serves stale data back to the device that just wrote it.
const memCache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL_MS = 15_000;

// Synchronous cache peek — lets a tab initialize its React state with
// already-known data instead of always starting from a loading skeleton,
// so revisiting a tab within the cache window renders instantly with no
// flash.
function peekShared<T>(key: string): T | undefined {
  const cached = memCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data as T;
  return undefined;
}

async function loadShared<T>(key: string, fallback: T): Promise<T> {
  const cached = memCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data as T;
  }
  // Try remote KV first (works across devices), fall back to localStorage
  try {
    const res = await fetch(`/api/store?key=${encodeURIComponent(key)}`);
    if (res.ok) {
      const data = await res.json();
      if (data !== null) {
        // Keep local cache in sync
        try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* ignore */ }
        memCache.set(key, { data, ts: Date.now() });
        return data as T;
      }
      // KV is reachable but key doesn't exist yet — migrate from localStorage
      try {
        const local = localStorage.getItem(key);
        if (local) {
          const parsed = JSON.parse(local) as T;
          // Seed KV with local data (fire-and-forget)
          fetch("/api/store", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key, value: parsed }),
          }).catch(() => {});
          memCache.set(key, { data: parsed, ts: Date.now() });
          return parsed;
        }
      } catch { /* ignore */ }
    }
  } catch { /* network issue — fall through */ }
  // localStorage fallback
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) as T : fallback; } catch { return fallback; }
}

// Keys whose latest write only made it to localStorage (offline, or the
// request failed) — retried once connectivity is back, see flushDirtyKeys.
const DIRTY_KEYS_STORAGE_KEY = "_dirty_keys";

function readDirtyKeys(): string[] {
  try { return JSON.parse(localStorage.getItem(DIRTY_KEYS_STORAGE_KEY) ?? "[]"); } catch { return []; }
}
function markDirty(key: string) {
  try {
    const keys = readDirtyKeys();
    if (!keys.includes(key)) keys.push(key);
    localStorage.setItem(DIRTY_KEYS_STORAGE_KEY, JSON.stringify(keys));
  } catch { /* ignore */ }
}
function clearDirty(key: string) {
  try {
    const keys = readDirtyKeys().filter(k => k !== key);
    localStorage.setItem(DIRTY_KEYS_STORAGE_KEY, JSON.stringify(keys));
  } catch { /* ignore */ }
}

async function saveShared(key: string, value: unknown): Promise<boolean> {
  // Save to localStorage immediately for responsiveness
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  memCache.set(key, { data: value, ts: Date.now() });
  // Then persist to remote KV
  try {
    const res = await fetch("/api/store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    if (res.ok) { clearDirty(key); return true; }
    // 503 means KV not configured yet — not an error, just not synced
    if (res.status === 503) return true;
    // A 4xx (invalid key, payload too large…) would never succeed on
    // retry — only 5xx and network failures are worth flushing later.
    if (res.status >= 500) markDirty(key);
  } catch {
    markDirty(key); // network issue — retry once we're back online
  }
  return true; // local save succeeded
}

// Re-pushes every write that only landed in localStorage (made while
// offline, or during a transient server error) once connectivity returns.
async function flushDirtyKeys(): Promise<void> {
  for (const key of readDirtyKeys()) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) { clearDirty(key); continue; }
      const res = await fetch("/api/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: JSON.parse(raw) }),
      });
      if (res.ok || res.status === 503) clearDirty(key);
    } catch { /* still offline — try again on the next flush */ }
  }
}

async function loadPersonal<T>(key: string, fallback: T): Promise<T> {
  try { const r = localStorage.getItem(`_p:${key}`); return r ? JSON.parse(r) as T : fallback; } catch { return fallback; }
}
async function savePersonal(key: string, value: unknown) {
  try { localStorage.setItem(`_p:${key}`, JSON.stringify(value)); } catch { /* ignore */ }
}
function formatMonth(dateStr: string) {
  if (!dateStr) return "";
  return new Date(dateStr + "-01T12:00:00").toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

function monthsBetween(start: string, end: string): number {
  if (!start || !end) return 1;
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  return Math.max(1, (ey - sy) * 12 + (em - sm) + 1);
}

// ─── Calendar export (.ics) ────────────────────────────────────────────────

function pad2(n: number) { return String(n).padStart(2, "0"); }

function addHour(time: string) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(2000, 0, 1, h || 9, m || 0);
  d.setHours(d.getHours() + 1);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// Floating local time (no timezone/Z suffix) — good enough since the app
// itself has no timezone concept, and calendar apps interpret it as local.
function toICSDateTime(dateStr: string, timeStr?: string) {
  const [y, m, d] = dateStr.split("-");
  const [hh, mm] = (timeStr || "09:00").split(":");
  return `${y}${m}${d}T${pad2(Number(hh))}${pad2(Number(mm))}00`;
}

function escapeICS(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function buildICS(tripName: string, days: ItineraryDay[], bookings: Booking[]): string {
  const lines: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Bitacora de Viaje//ES", "CALSCALE:GREGORIAN"];
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  for (const day of days) {
    if (!day.date) continue;
    for (const item of day.items) {
      if (!item.text.trim()) continue;
      const start = toICSDateTime(day.date, item.time);
      const end = toICSDateTime(day.date, addHour(item.time || "09:00"));
      lines.push(
        "BEGIN:VEVENT", `UID:itin-${item.id}@bitacoradeviaje`, `DTSTAMP:${stamp}`,
        `DTSTART:${start}`, `DTEND:${end}`, `SUMMARY:${escapeICS(item.text)}`,
        `DESCRIPTION:${escapeICS(`${tripName} — ${day.title}`)}`, "END:VEVENT"
      );
    }
  }

  for (const b of bookings) {
    if (!b.startDate) continue;
    const start = toICSDateTime(b.startDate, b.startTime);
    const end = b.endDate ? toICSDateTime(b.endDate, b.endTime || b.startTime) : toICSDateTime(b.startDate, addHour(b.startTime || "09:00"));
    const desc = [b.location, b.confirmationCode ? `Confirmación: ${b.confirmationCode}` : "", b.notes].filter(Boolean).join(" — ");
    lines.push(
      "BEGIN:VEVENT", `UID:booking-${b.id}@bitacoradeviaje`, `DTSTAMP:${stamp}`,
      `DTSTART:${start}`, `DTEND:${end}`, `SUMMARY:${escapeICS(b.title)}`
    );
    if (desc) lines.push(`DESCRIPTION:${escapeICS(desc)}`);
    if (b.location) lines.push(`LOCATION:${escapeICS(b.location)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function downloadTextFile(filename: string, content: string, mime = "text/calendar") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export { uid, genTripCode, formatDate, formatDateFull, tripDuration, isValidUrl, loadShared, saveShared, flushDirtyKeys, peekShared, loadPersonal, savePersonal, formatMonth, monthsBetween, buildICS, downloadTextFile };
