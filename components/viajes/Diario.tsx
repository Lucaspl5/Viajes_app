"use client";

import { useState, useEffect, useCallback } from "react";
import { Trash2, Edit2, BookOpen } from "lucide-react";
import { C, F, inputStyle } from "./theme";
import { Card, SectionLabel, EmptyState, SkeletonCards } from "./ui";
import { uid, formatDateFull, loadShared, saveShared } from "./utils";
import { DIARY_MOODS } from "./data/constants";
import type { Session, DiaryEntry, Trip } from "./types";
import { AiQuickButton } from "./AiQuickButton";


export function Diario({ code, session, trip, darkMode }: { code: string; session: Session; trip: Trip; darkMode: boolean }) {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [mood, setMood] = useState(DIARY_MOODS[0]);
  const [editId, setEditId] = useState<string | null>(null);
  const key = `diario:${code}`;

  useEffect(() => { loadShared<DiaryEntry[]>(key, []).then(e => { setEntries(e); setLoading(false); }); }, [key]);
  const persist = useCallback(async (next: DiaryEntry[]) => { setEntries(next); await saveShared(key, next); }, [key]);

  const cardBg = darkMode ? "#161B22" : "#fff";
  const cardBorder = darkMode ? "#30363D" : C.line;
  const textColor = darkMode ? "#E6EDF3" : C.ink;
  const softColor = darkMode ? "#8B949E" : C.inkSoft;

  function save() {
    if (!text.trim()) return;
    if (editId) {
      persist(entries.map(e => e.id === editId ? { ...e, text: text.trim(), date, mood } : e));
      setEditId(null);
    } else {
      persist([{ id: uid(), date, text: text.trim(), author: session.name, mood, addedAt: Date.now() }, ...entries]);
    }
    setText(""); setMood(DIARY_MOODS[0]);
  }

  function startEdit(e: DiaryEntry) {
    setText(e.text); setDate(e.date); setMood(e.mood); setEditId(e.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.addedAt - a.addedAt);

  if (loading) return <SkeletonCards />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <AiQuickButton code={code} trip={trip} session={session} suggestions={[
          "Ayúdame a redactar una entrada de diario sobre hoy",
          "Dame ideas de qué contar en el diario del viaje",
        ]} />
      </div>
      <Card>
        <SectionLabel>{editId ? "Editando entrada" : "Nueva entrada"}</SectionLabel>
        <div className="flex flex-col gap-3 mt-3">
          <div className="flex gap-2 items-center flex-wrap">
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, flex: "0 0 auto", background: darkMode ? "#0D1117" : "#fff", color: textColor, border: `1px solid ${cardBorder}` }} />
            <div className="flex gap-1 flex-wrap">
              {DIARY_MOODS.map(m => (
                <button key={m} onClick={() => setMood(m)} style={{ fontSize: 20, opacity: mood === m ? 1 : 0.4, transition: "opacity 0.15s", transform: mood === m ? "scale(1.2)" : "scale(1)" }}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <textarea value={text} onChange={e => setText(e.target.value)} placeholder="¿Cómo fue el día? ¿Qué viste, comiste, sentiste?…"
            style={{ ...inputStyle, minHeight: 120, resize: "vertical", lineHeight: 1.6, background: darkMode ? "#0D1117" : "#fff", color: textColor, border: `1px solid ${cardBorder}` }} />
          <div className="flex gap-2">
            <button onClick={save} style={{ flex: 1, background: C.navy, color: C.paper, borderRadius: 8, padding: "11px 16px", fontFamily: F.mono, fontSize: 12, fontWeight: 700 }}>
              {editId ? "GUARDAR CAMBIOS" : "GUARDAR ENTRADA"}
            </button>
            {editId && (
              <button onClick={() => { setEditId(null); setText(""); setMood(DIARY_MOODS[0]); }}
                style={{ background: darkMode ? "#161B22" : C.paperDark, color: softColor, borderRadius: 8, padding: "11px 16px", fontFamily: F.mono, fontSize: 12 }}>
                CANCELAR
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Entries */}
      <div className="flex flex-col gap-3">
        {sorted.map(e => (
          <div key={e.id} style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ background: `linear-gradient(135deg, ${C.navy}22, ${C.navyMid}22)`, padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${cardBorder}` }}>
              <span style={{ fontSize: 22 }}>{e.mood}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: F.mono, fontSize: 12, fontWeight: 600, color: textColor }}>{formatDateFull(e.date)}</div>
                <div style={{ fontFamily: F.mono, fontSize: 10, color: softColor }}>{e.author}</div>
              </div>
              <button onClick={() => startEdit(e)} style={{ color: softColor, padding: 4 }}><Edit2 size={13} /></button>
              <button onClick={() => persist(entries.filter(x => x.id !== e.id))} style={{ color: softColor, padding: 4 }}><Trash2 size={13} /></button>
            </div>
            <div style={{ padding: "12px 16px", fontSize: 14, color: textColor, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{e.text}</div>
          </div>
        ))}
        {entries.length === 0 && <EmptyState icon={<BookOpen size={28} color={C.line} />} text="Tu diario de viaje está vacío. Escribe la primera entrada." />}
      </div>
    </div>
  );
}
