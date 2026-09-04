"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { C, F } from "./theme";
import { Card, SectionLabel } from "./ui";
import { loadShared, buildICS, downloadTextFile } from "./utils";
import type { ItineraryDay, Booking } from "./types";

export function ICSExport({ code, tripName, darkMode }: { code: string; tripName: string; darkMode: boolean }) {
  const [busy, setBusy] = useState(false);
  const cardBg = darkMode ? "#161B22" : "#fff";
  const cardBorder = darkMode ? "#30363D" : C.line;
  const softColor = darkMode ? "#8B949E" : C.inkSoft;

  async function exportICS() {
    setBusy(true);
    const [days, bookings] = await Promise.all([
      loadShared<ItineraryDay[]>(`itin:${code}`, []),
      loadShared<Booking[]>(`reservas:${code}`, []),
    ]);
    const ics = buildICS(tripName, days, bookings);
    downloadTextFile(`${tripName.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "viaje"}.ics`, ics);
    setBusy(false);
  }

  return (
    <Card style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
      <div className="flex items-center gap-2 mb-2">
        <CalendarDays size={15} color={softColor} />
        <SectionLabel>Exportar a calendario</SectionLabel>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p style={{ color: softColor, fontSize: 13 }}>
          Descarga el itinerario y las reservas como .ics para importarlo en Google Calendar, Apple Calendar, etc.
        </p>
        <button onClick={exportICS} disabled={busy} style={{
          flexShrink: 0, background: C.teal, color: "#fff", borderRadius: 6,
          padding: "8px 14px", fontFamily: F.mono, fontSize: 11, fontWeight: 700,
        }}>
          {busy ? "…" : "DESCARGAR .ICS"}
        </button>
      </div>
    </Card>
  );
}
