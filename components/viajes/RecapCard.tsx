"use client";

import { useState } from "react";
import { Sparkles, Share2, X, Copy, Check } from "lucide-react";
import { C, F } from "./theme";
import { Card, SectionLabel } from "./ui";
import { loadShared, formatDate, tripDuration } from "./utils";
import type { Trip, Expense, Photo, MapPlace, DiaryEntry, ItineraryDay } from "./types";

interface RecapStats { total: number; photos: number; places: number; diaryEntries: number; days: number }

export function RecapCard({ code, trip, darkMode }: { code: string; trip: Trip; darkMode: boolean }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<RecapStats | null>(null);
  const [copied, setCopied] = useState(false);
  const cardBg = darkMode ? "#161B22" : "#fff";
  const cardBorder = darkMode ? "#30363D" : C.line;
  const textColor = darkMode ? "#E6EDF3" : C.ink;
  const softColor = darkMode ? "#8B949E" : C.inkSoft;

  async function openRecap() {
    setOpen(true); setLoading(true);
    const [expenses, photos, places, diary, itin] = await Promise.all([
      loadShared<Expense[]>(`gastos:${code}`, []),
      loadShared<Photo[]>(`fotos:${code}`, []),
      loadShared<MapPlace[]>(`mapa:${code}`, []),
      loadShared<DiaryEntry[]>(`diario:${code}`, []),
      loadShared<ItineraryDay[]>(`itin:${code}`, []),
    ]);
    setStats({
      total: expenses.reduce((s, e) => s + e.amount, 0),
      photos: photos.length,
      places: places.length,
      diaryEntries: diary.length,
      days: itin.filter(d => d.items.length > 0).length,
    });
    setLoading(false);
  }

  function shareText(s: RecapStats) {
    const dur = tripDuration(trip.startDate, trip.endDate);
    return [
      `✈️ ${trip.name}${trip.destination ? ` — ${trip.destination}` : ""}`,
      trip.startDate ? `${formatDate(trip.startDate)}${trip.endDate ? ` → ${formatDate(trip.endDate)}` : ""}${dur ? ` (${dur} días)` : ""}` : "",
      `💶 Gasto total: ${s.total.toFixed(2)} €`,
      `📸 ${s.photos} fotos · 🗺️ ${s.places} lugares · 📔 ${s.diaryEntries} entradas de diario`,
      "",
      "Hecho con Bitácora de Viaje",
    ].filter(Boolean).join("\n");
  }

  async function share() {
    if (!stats) return;
    const text = shareText(stats);
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ title: trip.name, text }); return; } catch { /* cancelled */ }
    }
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  }

  return (
    <>
      <Card style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={15} color={softColor} />
          <SectionLabel>Recap del viaje</SectionLabel>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p style={{ color: softColor, fontSize: 13 }}>Un resumen compartible con las cifras del viaje.</p>
          <button onClick={openRecap} style={{
            flexShrink: 0, background: darkMode ? "#21262D" : C.paperDark, color: textColor,
            border: `1px solid ${cardBorder}`, borderRadius: 6, padding: "8px 14px", fontFamily: F.mono, fontSize: 11, fontWeight: 700,
          }}>
            VER RECAP
          </button>
        </div>
      </Card>

      {open && (
        <div className="fade-in" style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", flexDirection: "column", background: "#000a" }} onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ margin: "auto", width: "min(92vw, 420px)", background: darkMode ? "#0D1117" : C.paper, borderRadius: 18, overflow: "hidden" }}>
            <div style={{ background: `linear-gradient(135deg, ${C.navy}, ${C.navyMid})`, padding: "24px 22px", color: "#fff", position: "relative" }} className="dot-grid">
              <button onClick={() => setOpen(false)} style={{ position: "absolute", top: 12, right: 12, color: "#9FAEC4" }}><X size={16} /></button>
              <div style={{ fontFamily: F.mono, fontSize: 10, color: C.gold, letterSpacing: 1.5 }}>RECAP</div>
              <div style={{ fontFamily: F.display, fontSize: 24, fontWeight: 700, marginTop: 4 }}>{trip.name}</div>
              {trip.destination && <div style={{ fontFamily: F.mono, fontSize: 12, color: "#9FAEC4", marginTop: 4 }}>{trip.destination}</div>}
            </div>
            <div style={{ padding: "18px 22px 22px" }}>
              {loading || !stats ? (
                <p style={{ color: softColor, fontSize: 13 }}>Calculando…</p>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                    {[
                      ["💶", `${stats.total.toFixed(0)} €`, "gastados"],
                      ["📸", String(stats.photos), "fotos"],
                      ["🗺️", String(stats.places), "lugares"],
                      ["📔", String(stats.diaryEntries), "entradas de diario"],
                    ].map(([icon, num, label]) => (
                      <div key={label} style={{ background: darkMode ? "#161B22" : C.paperDark, borderRadius: 10, padding: 12, textAlign: "center" }}>
                        <div style={{ fontSize: 18 }}>{icon}</div>
                        <div style={{ fontFamily: F.display, fontSize: 20, fontWeight: 700, color: textColor }}>{num}</div>
                        <div style={{ fontFamily: F.mono, fontSize: 9, color: softColor }}>{label.toUpperCase()}</div>
                      </div>
                    ))}
                  </div>
                  <button onClick={share} style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    background: C.teal, color: "#fff", borderRadius: 8, padding: "12px 16px", fontFamily: F.mono, fontSize: 12, fontWeight: 700,
                  }}>
                    {copied ? <Check size={14} /> : <Share2 size={14} />} {copied ? "COPIADO AL PORTAPAPELES" : "COMPARTIR"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
