"use client";

import { useState, useEffect, useCallback } from "react";
import { Plane, Plus, Trash2, X } from "lucide-react";
import { C, F, inputStyle } from "./theme";
import { Perf, Card, EmptyState, SkeletonCards } from "./ui";
import { uid, formatDateFull, loadShared, saveShared } from "./utils";
import type { ItineraryDay, ItineraryItem, Trip, Session } from "./types";
import { AiQuickButton } from "./AiQuickButton";

function sortItems(items: ItineraryItem[]) {
  return [...items].sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
}

export function Itinerario({ code, startDate, trip, session, onImportItinerary }: {
  code: string; startDate: string | null; trip: Trip; session: Session;
  onImportItinerary: (days: ItineraryDay[]) => void;
}) {
  const [days, setDays] = useState<ItineraryDay[]>([]);
  const [loading, setLoading] = useState(true);
  const key = `itin:${code}`;
  useEffect(() => { loadShared<ItineraryDay[]>(key, []).then(d => { setDays(d); setLoading(false); }); }, [key]);
  const persist = useCallback(async (next: ItineraryDay[]) => { setDays(next); await saveShared(key, next); }, [key]);

  const addDay = () => {
    let date = "";
    if (startDate) {
      const d = new Date(startDate + "T12:00:00");
      d.setDate(d.getDate() + days.length);
      date = d.toISOString().slice(0, 10);
    }
    persist([...days, { id: uid(), date, title: `Día ${days.length + 1}`, items: [] }]);
  };
  const removeDay = (id: string) => persist(days.filter(d => d.id !== id));
  const updateDay = (id: string, p: Partial<ItineraryDay>) => persist(days.map(d => d.id === id ? { ...d, ...p } : d));
  const addItem = (dayId: string) => persist(days.map(d => d.id === dayId ? { ...d, items: [...d.items, { id: uid(), time: "", text: "" }] } : d));
  const updateItem = (dayId: string, itemId: string, p: Partial<ItineraryItem>) =>
    persist(days.map(d => d.id === dayId ? { ...d, items: d.items.map(it => it.id === itemId ? { ...it, ...p } : it) } : d));
  const sortDayItems = (dayId: string) =>
    persist(days.map(d => d.id === dayId ? { ...d, items: sortItems(d.items) } : d));
  const removeItem = (dayId: string, itemId: string) =>
    persist(days.map(d => d.id === dayId ? { ...d, items: d.items.filter(it => it.id !== itemId) } : d));

  if (loading) return <SkeletonCards />;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span style={{ fontFamily: F.mono, fontSize: 11, color: C.inkSoft, letterSpacing: 1 }}>
          {days.length ? `${days.length} día${days.length !== 1 ? "s" : ""} planificados` : "PLAN DE VIAJE"}
        </span>
        <AiQuickButton code={code} trip={trip} session={session} onImportItinerary={onImportItinerary} suggestions={[
          `Crea un itinerario de ${trip.destination || "mi viaje"} para ${trip.members.length} personas`,
          "Añade un día más al itinerario",
          "Sugiere actividades para rellenar los huecos libres",
        ]} />
      </div>
      {days.map(d => (
        <Card key={d.id}>
          <div className="flex items-start gap-3">
            <div className="flex-1 flex flex-col gap-2">
              <input value={d.title} onChange={e => updateDay(d.id, { title: e.target.value })}
                style={{ ...inputStyle, fontFamily: F.display, fontWeight: 700, fontSize: 20, border: "none", padding: 0, background: "transparent" }} placeholder="Título del día" />
              {d.date && <p style={{ fontFamily: F.mono, fontSize: 10, color: C.gold, letterSpacing: 0.5 }}>{formatDateFull(d.date)}</p>}
              <input type="date" value={d.date} onChange={e => updateDay(d.id, { date: e.target.value })} style={{ ...inputStyle, width: 175, fontSize: 13 }} />
            </div>
            <button onClick={() => removeDay(d.id)} style={{ color: C.inkSoft, padding: 4 }} aria-label="Eliminar día"><Trash2 size={15} /></button>
          </div>
          <Perf />
          <div className="flex flex-col gap-3" style={{ position: "relative" }}>
            {d.items.length > 1 && (
              <div style={{ position: "absolute", left: 35, top: 8, bottom: 8, width: 1, background: C.line }} />
            )}
            {d.items.map(it => (
              <div key={it.id} className="flex items-center gap-2" style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 34, width: 5, height: 5, borderRadius: 999, background: C.teal, zIndex: 1 }} />
                <input value={it.time} onChange={e => updateItem(d.id, it.id, { time: e.target.value })}
                  onBlur={() => sortDayItems(d.id)} placeholder="10:00" maxLength={5}
                  style={{ ...inputStyle, width: 72, fontFamily: F.mono, fontSize: 12 }} />
                <input value={it.text} onChange={e => updateItem(d.id, it.id, { text: e.target.value })}
                  onKeyDown={e => e.key === "Enter" && addItem(d.id)} placeholder="Ej. Visita al museo…" style={{ ...inputStyle, flex: 1 }} />
                <button onClick={() => removeItem(d.id, it.id)} style={{ color: C.inkSoft, padding: 4 }} aria-label="Eliminar"><X size={15} /></button>
              </div>
            ))}
            {d.items.length === 0 && <p style={{ color: C.inkSoft, fontSize: 13 }}>Sin paradas todavía.</p>}
          </div>
          <button onClick={() => addItem(d.id)} className="flex items-center gap-1 mt-3" style={{ fontFamily: F.mono, fontSize: 12, color: C.teal }}>
            <Plus size={13} /> AÑADIR PARADA
          </button>
        </Card>
      ))}
      <button onClick={addDay} className="flex items-center justify-center gap-2 py-3"
        style={{ border: `1px dashed ${C.line}`, borderRadius: 8, color: C.inkSoft, fontFamily: F.mono, fontSize: 13 }}
        onMouseOver={e => (e.currentTarget.style.background = C.paperDark)}
        onMouseOut={e => (e.currentTarget.style.background = "transparent")}>
        <Plus size={15} /> AÑADIR DÍA
      </button>
      {days.length === 0 && <EmptyState icon={<Plane size={28} color={C.line} />} text="El itinerario está vacío. Añade el primer día." />}
    </div>
  );
}

