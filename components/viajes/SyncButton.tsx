"use client";

import { useState } from "react";
import { Check, RefreshCw } from "lucide-react";
import { C } from "./theme";
import type { Trip } from "./types";

export function SyncButton({ code, onSync }: { code: string; onSync: (t: Trip) => void }) {
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "no_kv">("idle");

  async function sync() {
    setSyncing(true); setStatus("idle");
    try {
      const res = await fetch(`/api/store?key=${encodeURIComponent(`trip:${code}`)}`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          // Also update localStorage with the fresh data
          try { localStorage.setItem(`trip:${code}`, JSON.stringify(data)); } catch { /* ignore */ }
          onSync(data as Trip);
          setStatus("ok");
          setTimeout(() => setStatus("idle"), 2500);
          setSyncing(false);
          return;
        }
      }
      if (res.status === 503) {
        setStatus("no_kv");
        setTimeout(() => setStatus("idle"), 4000);
      }
    } catch { /* network error */ }
    setSyncing(false);
  }

  const label = status === "ok" ? "SINCRONIZADO" : status === "no_kv" ? "SIN KV" : "SYNC";
  const color = status === "ok" ? C.teal : status === "no_kv" ? C.gold : "#7C8AA3";
  const title = status === "no_kv" ? "Activa Vercel KV en el dashboard para sincronizar entre dispositivos" : "Sincronizar viaje";

  return (
    <button onClick={sync} disabled={syncing} title={title}
      style={{ color, padding: "4px 8px", borderRadius: 6, border: "1px solid #2D3E5A", display: "flex", alignItems: "center", gap: 4, fontFamily: "var(--font-mono)", fontSize: 10, transition: "color 0.2s" }}>
      {status === "ok" ? <Check size={11} /> : <RefreshCw size={11} className={syncing ? "animate-spin" : ""} />}
      {label}
    </button>
  );
}

