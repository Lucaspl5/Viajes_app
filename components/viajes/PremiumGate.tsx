"use client";

import { useState } from "react";
import { Lock, Sparkles } from "lucide-react";
import { C, F } from "./theme";
import { isPremium, unlockPremiumDemo } from "./premium";
import type { Trip } from "./types";

export function PremiumGate({ code, trip, onUnlock, feature, children, darkMode }: {
  code: string; trip: Trip; onUnlock: (t: Trip) => void;
  feature: string; children: React.ReactNode; darkMode?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  if (isPremium(trip)) return <>{children}</>;

  async function unlock() {
    setLoading(true);
    const next = await unlockPremiumDemo(code, trip);
    onUnlock(next);
    setLoading(false);
  }

  return (
    <div
      style={{
        border: `1px dashed ${C.gold}`, borderRadius: 12, padding: "20px 18px",
        textAlign: "center", background: darkMode ? "#161B22" : "#FFFBEB",
      }}
      className="flex flex-col items-center gap-3"
    >
      <Lock size={20} color={C.gold} />
      <p style={{ fontFamily: F.body, fontSize: 13, color: darkMode ? "#E6EDF3" : C.ink, maxWidth: 280 }}>
        {feature} es una función Premium de este viaje.
      </p>
      <button
        onClick={unlock}
        disabled={loading}
        style={{
          display: "flex", alignItems: "center", gap: 6, background: C.gold, color: "#1A1200",
          borderRadius: 8, padding: "10px 18px", fontFamily: F.mono, fontSize: 11, fontWeight: 700,
        }}
      >
        <Sparkles size={13} /> {loading ? "ACTIVANDO…" : "HAZTE PREMIUM"}
      </button>
    </div>
  );
}
