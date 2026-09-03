"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Copy, Plus, Trash2, X, Euro, ExternalLink, Edit2, Ticket } from "lucide-react";
import { C, F, inputStyle } from "./theme";
import { Banner, EmptyState, SkeletonCards } from "./ui";
import { uid, isValidUrl, loadShared, saveShared, peekShared } from "./utils";
import { BOOKING_TYPES } from "./data/constants";
import type { Session, Booking, Trip } from "./types";
import { AiQuickButton } from "./AiQuickButton";
import { PremiumGate } from "./PremiumGate";
import { Documentos } from "./Documentos";
import { useAnimeStagger, AnimatedIn } from "./animation";


export const BOOKING_TYPE_ICONS: Record<string, string> = { vuelo: "✈️", hotel: "🏨", actividad: "🎭", traslado: "🚗", otro: "📋" };

export function Reservas({ code, session, trip, darkMode, onTripUpdate }: { code: string; session: Session; trip: Trip; darkMode: boolean; onTripUpdate: (t: Trip) => void }) {
  const key = `reservas:${code}`;
  const [bookings, setBookings] = useState<Booking[]>(() => peekShared<Booking[]>(key) ?? []);
  const [loading, setLoading] = useState(() => peekShared<Booking[]>(key) === undefined);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [form, setForm] = useState<Omit<Booking, "id">>({
    type: "vuelo", title: "", confirmationCode: "", startDate: "", startTime: "",
    endDate: "", endTime: "", location: "", bookingUrl: "", notes: "", amount: 0,
  });
  const [err, setErr] = useState("");
  const sectionRef = useRef<HTMLDivElement>(null);
  useAnimeStagger(sectionRef);

  useEffect(() => { loadShared<Booking[]>(key, []).then(b => { setBookings(b); setLoading(false); }); }, [key]);
  const persist = useCallback(async (next: Booking[]) => { setBookings(next); await saveShared(key, next); }, [key]);

  const cardBg = darkMode ? "#161B22" : "#fff";
  const cardBorder = darkMode ? "#30363D" : C.line;
  const textColor = darkMode ? "#E6EDF3" : C.ink;
  const softColor = darkMode ? "#8B949E" : C.inkSoft;
  const paperBg = darkMode ? "#0D1117" : C.paper;

  function openAdd() {
    setEditing(null);
    setForm({ type: "vuelo", title: "", confirmationCode: "", startDate: "", startTime: "", endDate: "", endTime: "", location: "", bookingUrl: "", notes: "", amount: 0 });
    setShowForm(true); setErr("");
  }

  function openEdit(b: Booking) {
    setEditing(b);
    setForm({ type: b.type, title: b.title, confirmationCode: b.confirmationCode, startDate: b.startDate, startTime: b.startTime, endDate: b.endDate, endTime: b.endTime, location: b.location, bookingUrl: b.bookingUrl, notes: b.notes, amount: b.amount });
    setShowForm(true); setErr("");
  }

  function save() {
    setErr("");
    if (!form.title.trim()) { setErr("Escribe un título."); return; }
    if (!form.startDate) { setErr("Fecha de inicio necesaria."); return; }
    if (editing) {
      persist(bookings.map(b => b.id === editing.id ? { ...form, id: editing.id } : b));
    } else {
      persist([...bookings, { ...form, id: uid() }]);
    }
    setShowForm(false);
  }

  const sorted = [...bookings].sort((a, b) => a.startDate.localeCompare(b.startDate));

  if (loading) return <SkeletonCards />;

  const formInStyle = { ...inputStyle, background: cardBg, color: textColor, border: `1px solid ${cardBorder}` };

  return (
    <div ref={sectionRef} className="flex flex-col gap-4">
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${C.navy}, ${C.navyMid})`, borderRadius: 14, padding: "20px 20px", color: C.paper, position: "relative", overflow: "hidden" }} className="dot-grid">
        <div className="glow-pulse" style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: 999, background: `radial-gradient(circle, ${C.teal}30, transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ fontFamily: F.mono, fontSize: 10, color: C.gold, letterSpacing: 1.5 }}>MIS RESERVAS</div>
        <div style={{ fontFamily: F.display, fontSize: 28, fontWeight: 700, color: C.paper, marginTop: 4 }}>
          {bookings.length} {bookings.length === 1 ? "reserva" : "reservas"}
        </div>
        <p style={{ fontFamily: F.mono, fontSize: 11, color: "#9FAEC4", marginTop: 4 }}>
          Vuelos · hoteles · actividades · traslados — todo en un lugar
        </p>
      </div>

      <div className="flex gap-2">
        <button onClick={openAdd} style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          background: C.teal, color: "#fff", borderRadius: 10, padding: "12px 16px",
          fontFamily: F.mono, fontSize: 12, fontWeight: 700,
        }}>
          <Plus size={14} /> AÑADIR RESERVA
        </button>
        <AiQuickButton code={code} trip={trip} session={session} suggestions={[
          "Añade una reserva de hotel",
          "¿Qué debo comprobar antes de reservar un vuelo?",
        ]} />
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fade-in" style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", flexDirection: "column", background: "#000a" }} onClick={() => setShowForm(false)}>
          <div onClick={e => e.stopPropagation()} style={{ marginTop: "auto", background: paperBg, borderRadius: "20px 20px 0 0", maxHeight: "90dvh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "18px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div style={{ fontFamily: F.display, fontSize: 18, fontWeight: 700, color: textColor }}>{editing ? "Editar reserva" : "Nueva reserva"}</div>
              <button onClick={() => setShowForm(false)}><X size={18} color={softColor} /></button>
            </div>
            <div className="overflow-y-auto" style={{ flex: 1, padding: "16px 20px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Type selector */}
              <div className="flex gap-2 flex-wrap">
                {BOOKING_TYPES.map(t => (
                  <button key={t.value} onClick={() => setForm(f => ({ ...f, type: t.value }))}
                    style={{ padding: "6px 12px", borderRadius: 8, fontFamily: F.mono, fontSize: 11, background: form.type === t.value ? C.navy : (darkMode ? "#161B22" : C.paperDark), color: form.type === t.value ? "#fff" : softColor, border: `1px solid ${form.type === t.value ? C.navy : cardBorder}` }}>
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>

              <input placeholder="Título (Vuelo MAD → NRT, Hotel Shinjuku…)" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={{ ...formInStyle, fontSize: 15 }} />

              <div className="flex gap-2 flex-wrap">
                <div style={{ flex: "1 1 200px" }}>
                  <div style={{ fontFamily: F.mono, fontSize: 9, color: softColor, marginBottom: 4 }}>SALIDA / INICIO</div>
                  <div className="flex gap-2">
                    <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} style={{ ...formInStyle, flex: 1 }} />
                    <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} style={{ ...formInStyle, width: 90 }} />
                  </div>
                </div>
                <div style={{ flex: "1 1 200px" }}>
                  <div style={{ fontFamily: F.mono, fontSize: 9, color: softColor, marginBottom: 4 }}>LLEGADA / FIN</div>
                  <div className="flex gap-2">
                    <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} style={{ ...formInStyle, flex: 1 }} />
                    <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} style={{ ...formInStyle, width: 90 }} />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <input placeholder="Código de confirmación" value={form.confirmationCode}
                  onChange={e => setForm(f => ({ ...f, confirmationCode: e.target.value }))} style={{ ...formInStyle, flex: "1 1 150px", fontFamily: F.mono }} />
                <div style={{ position: "relative", flex: "0 1 130px" }}>
                  <input placeholder="Importe" value={form.amount === 0 ? "" : String(form.amount)}
                    onChange={e => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} style={{ ...formInStyle, paddingRight: 26, width: "100%" }} />
                  <Euro size={11} style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", color: softColor }} />
                </div>
              </div>

              <input placeholder="Lugar / aeropuerto / hotel (opcional)" value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))} style={formInStyle} />
              <input placeholder="Enlace de reserva (opcional)" value={form.bookingUrl}
                onChange={e => setForm(f => ({ ...f, bookingUrl: e.target.value }))} style={formInStyle} />
              <textarea placeholder="Notas adicionales…" value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                style={{ ...formInStyle, minHeight: 70, resize: "vertical" }} />

              {err && <Banner type="error" msg={err} />}
              <button onClick={save} style={{ background: C.teal, color: "#fff", borderRadius: 8, padding: "12px 16px", fontFamily: F.mono, fontSize: 12, fontWeight: 700 }}>
                {editing ? "GUARDAR CAMBIOS" : "AÑADIR RESERVA"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Booking cards */}
      <div className="flex flex-col gap-3">
        {sorted.map(b => (
          <AnimatedIn key={b.id}>
          <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ background: `linear-gradient(135deg, ${C.navyMid}, ${C.navy})`, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22 }}>{BOOKING_TYPE_ICONS[b.type]}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: F.display, fontSize: 16, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.title}</div>
                <div style={{ fontFamily: F.mono, fontSize: 10, color: "#8A9BC1" }}>
                  {b.startDate}{b.startTime ? ` ${b.startTime}` : ""}{(b.endDate && b.endDate !== b.startDate) ? ` → ${b.endDate}${b.endTime ? ` ${b.endTime}` : ""}` : ""}
                </div>
              </div>
              {b.amount > 0 && <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 700, color: C.goldLight, flexShrink: 0 }}>{b.amount.toFixed(0)} €</div>}
            </div>
            <div style={{ padding: "10px 16px" }} className="flex flex-col gap-1.5">
              {b.confirmationCode && (
                <div className="flex items-center gap-2">
                  <span style={{ fontFamily: F.mono, fontSize: 9, color: softColor, width: 90 }}>CONFIRMA</span>
                  <span style={{ fontFamily: F.mono, fontSize: 12, fontWeight: 700, color: C.teal, letterSpacing: 1 }}>{b.confirmationCode}</span>
                  <button onClick={() => navigator.clipboard?.writeText(b.confirmationCode)} style={{ color: softColor, padding: 2 }}><Copy size={11} /></button>
                </div>
              )}
              {b.location && (
                <div className="flex items-center gap-2">
                  <span style={{ fontFamily: F.mono, fontSize: 9, color: softColor, width: 90 }}>LUGAR</span>
                  <span style={{ fontSize: 13, color: textColor }}>{b.location}</span>
                </div>
              )}
              {b.bookingUrl && isValidUrl(b.bookingUrl) && (
                <a href={b.bookingUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1"
                  style={{ fontFamily: F.mono, fontSize: 10, color: C.sky, marginTop: 2 }}>
                  <ExternalLink size={10} /> VER RESERVA
                </a>
              )}
              {b.notes && <p style={{ fontSize: 12, color: softColor, lineHeight: 1.5, marginTop: 2 }}>{b.notes}</p>}
              <div className="flex gap-2 mt-2">
                <button onClick={() => openEdit(b)} style={{ fontFamily: F.mono, fontSize: 10, color: softColor, border: `1px solid ${cardBorder}`, borderRadius: 5, padding: "4px 10px", display: "flex", alignItems: "center", gap: 4 }}>
                  <Edit2 size={10} /> EDITAR
                </button>
                <button onClick={() => persist(bookings.filter(x => x.id !== b.id))} style={{ fontFamily: F.mono, fontSize: 10, color: C.red, border: `1px solid ${C.red}33`, borderRadius: 5, padding: "4px 10px", display: "flex", alignItems: "center", gap: 4 }}>
                  <Trash2 size={10} /> ELIMINAR
                </button>
              </div>
            </div>
          </div>
          </AnimatedIn>
        ))}
        {bookings.length === 0 && <EmptyState icon={<Ticket size={28} color={C.line} />} text="Sin reservas todavía. Añade vuelos, hoteles y actividades." />}
      </div>

      {/* Document reminders — premium */}
      <PremiumGate code={code} trip={trip} onUnlock={onTripUpdate} feature="Los recordatorios de documentos (pasaporte, visado, seguro, check-in)" darkMode={darkMode}>
        <Documentos code={code} darkMode={darkMode} />
      </PremiumGate>
    </div>
  );
}

