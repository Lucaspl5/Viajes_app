"use client";

function uid() { return Math.random().toString(36).slice(2, 9); }

function genTripCode() {
  const L = "ABCDEFGHJKLMNPQRSTUVWXYZ", N = "23456789";
  let c = "";
  for (let i = 0; i < 3; i++) c += L[Math.floor(Math.random() * L.length)];
  c += "-";
  for (let i = 0; i < 3; i++) c += N[Math.floor(Math.random() * N.length)];
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

async function loadShared<T>(key: string, fallback: T): Promise<T> {
  // Try remote KV first (works across devices), fall back to localStorage
  try {
    const res = await fetch(`/api/store?key=${encodeURIComponent(key)}`);
    if (res.ok) {
      const data = await res.json();
      if (data !== null) {
        // Keep local cache in sync
        try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* ignore */ }
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
          return parsed;
        }
      } catch { /* ignore */ }
    }
  } catch { /* network issue — fall through */ }
  // localStorage fallback
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) as T : fallback; } catch { return fallback; }
}

async function saveShared(key: string, value: unknown): Promise<boolean> {
  // Save to localStorage immediately for responsiveness
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  // Then persist to remote KV
  try {
    const res = await fetch("/api/store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    if (res.ok) return true;
    // 503 means KV not configured yet — not an error, just not synced
    if (res.status === 503) return true;
  } catch { /* network issue */ }
  return true; // local save succeeded
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

export { uid, genTripCode, formatDate, formatDateFull, tripDuration, isValidUrl, loadShared, saveShared, loadPersonal, savePersonal, formatMonth, monthsBetween };
