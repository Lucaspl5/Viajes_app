"use client";

export async function sendPresenceHeartbeat(code: string, name: string): Promise<void> {
  try {
    await fetch("/api/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: `trip:${code}`, name }),
    });
  } catch { /* best-effort */ }
}

export async function fetchActivePresence(code: string): Promise<string[]> {
  try {
    const res = await fetch(`/api/presence?key=${encodeURIComponent(`trip:${code}`)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.active) ? data.active : [];
  } catch { return []; }
}
