"use client";

import { useState } from "react";
import { Calendar, MapPinned, Plus, Check, Trash2, PartyPopper } from "lucide-react";
import { C, F, inputStyle } from "./theme";
import { Card, SectionLabel, Banner } from "./ui";
import { uid, saveShared, formatDate } from "./utils";
import type { Trip, Session, DateOption, DestOption } from "./types";

export function Planning({ code, trip, session, onTripUpdate }: { code: string; trip: Trip; session: Session; onTripUpdate: (t: Trip) => void }) {
  const planning = trip.planning!;
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newDest, setNewDest] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function persistTrip(next: Trip) {
    await saveShared(`trip:${code}`, next);
    onTripUpdate(next);
  }

  function addDateOption() {
    setErr("");
    if (!newStart) { setErr("Elige al menos una fecha de inicio."); return; }
    if (newEnd && newEnd < newStart) { setErr("La fecha de fin debe ser posterior a la de inicio."); return; }
    const opt: DateOption = { id: uid(), startDate: newStart, endDate: newEnd || newStart, votes: [] };
    persistTrip({ ...trip, planning: { ...planning, dateOptions: [...planning.dateOptions, opt] } });
    setNewStart(""); setNewEnd("");
  }

  function addDestOption() {
    if (!newDest.trim()) return;
    const opt: DestOption = { id: uid(), name: newDest.trim(), votes: [] };
    persistTrip({ ...trip, planning: { ...planning, destOptions: [...planning.destOptions, opt] } });
    setNewDest("");
  }

  function toggleDateVote(id: string) {
    const dateOptions = planning.dateOptions.map(o => o.id === id
      ? { ...o, votes: o.votes.includes(session.name) ? o.votes.filter(v => v !== session.name) : [...o.votes, session.name] }
      : o);
    persistTrip({ ...trip, planning: { ...planning, dateOptions } });
  }
  function toggleDestVote(id: string) {
    const destOptions = planning.destOptions.map(o => o.id === id
      ? { ...o, votes: o.votes.includes(session.name) ? o.votes.filter(v => v !== session.name) : [...o.votes, session.name] }
      : o);
    persistTrip({ ...trip, planning: { ...planning, destOptions } });
  }

  function removeDateOption(id: string) {
    persistTrip({ ...trip, planning: { ...planning, dateOptions: planning.dateOptions.filter(o => o.id !== id) } });
  }
  function removeDestOption(id: string) {
    persistTrip({ ...trip, planning: { ...planning, destOptions: planning.destOptions.filter(o => o.id !== id) } });
  }

  async function finalize() {
    setBusy(true);
    const topDate = [...planning.dateOptions].sort((a, b) => b.votes.length - a.votes.length)[0];
    const topDest = [...planning.destOptions].sort((a, b) => b.votes.length - a.votes.length)[0];
    const next: Trip = {
      ...trip,
      startDate: topDate ? topDate.startDate : trip.startDate,
      endDate: topDate ? topDate.endDate : trip.endDate,
      destination: topDest ? topDest.name : trip.destination,
      planning: { ...planning, open: false },
    };
    await persistTrip(next);
    setBusy(false);
  }

  const canFinalize = planning.dateOptions.length > 0 || planning.destOptions.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div style={{ background: `linear-gradient(135deg, ${C.navy}, ${C.navyMid})`, borderRadius: 14, padding: 20, color: "#fff" }} className="dot-grid">
        <div style={{ fontFamily: F.mono, fontSize: 10, color: C.gold, letterSpacing: 1.5 }}>DECIDIENDO EL VIAJE</div>
        <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 700, marginTop: 4 }}>{trip.name}</div>
        <p style={{ fontFamily: F.mono, fontSize: 11, color: "#9FAEC4", marginTop: 6 }}>
          Proponed fechas y destinos, votad entre todos, y confirmad cuando estéis de acuerdo.
        </p>
      </div>

      {/* Dates */}
      <Card>
        <div className="flex items-center gap-2 mb-3"><Calendar size={14} color={C.inkSoft} /><SectionLabel>Fechas propuestas</SectionLabel></div>
        <div className="flex flex-col gap-2">
          {planning.dateOptions.map(o => {
            const voted = o.votes.includes(session.name);
            return (
              <div key={o.id} onClick={() => toggleDateVote(o.id)} className="flex items-center gap-3 px-3 py-2" style={{ cursor: "pointer", borderRadius: 8, border: `1px solid ${voted ? C.teal : C.line}`, background: voted ? `${C.teal}12` : "transparent" }}>
                <div style={{ width: 22, height: 22, borderRadius: 999, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: voted ? C.teal : C.paperDark, color: voted ? "#fff" : C.inkSoft }}>
                  {voted && <Check size={13} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{formatDate(o.startDate)}{o.endDate !== o.startDate ? ` → ${formatDate(o.endDate)}` : ""}</div>
                  <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkSoft }}>{o.votes.length ? `${o.votes.length} voto${o.votes.length !== 1 ? "s" : ""}: ${o.votes.join(", ")}` : "Sin votos"}</div>
                </div>
                <button onClick={e => { e.stopPropagation(); removeDateOption(o.id); }} style={{ color: C.inkSoft, padding: 4 }}><Trash2 size={13} /></button>
              </div>
            );
          })}
          {planning.dateOptions.length === 0 && <p style={{ color: C.inkSoft, fontSize: 13 }}>Nadie ha propuesto fechas todavía.</p>}
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <input type="date" value={newStart} onChange={e => setNewStart(e.target.value)} style={{ ...inputStyle, flex: "1 1 130px" }} />
          <input type="date" value={newEnd} min={newStart || undefined} onChange={e => setNewEnd(e.target.value)} style={{ ...inputStyle, flex: "1 1 130px" }} />
          <button onClick={addDateOption} style={{ display: "flex", alignItems: "center", gap: 4, background: C.navy, color: "#fff", borderRadius: 6, padding: "0 14px", fontFamily: F.mono, fontSize: 12 }}>
            <Plus size={13} /> PROPONER
          </button>
        </div>
        {err && <Banner type="error" msg={err} />}
      </Card>

      {/* Destinations */}
      <Card>
        <div className="flex items-center gap-2 mb-3"><MapPinned size={14} color={C.inkSoft} /><SectionLabel>Destinos propuestos</SectionLabel></div>
        <div className="flex flex-col gap-2">
          {planning.destOptions.map(o => {
            const voted = o.votes.includes(session.name);
            return (
              <div key={o.id} onClick={() => toggleDestVote(o.id)} className="flex items-center gap-3 px-3 py-2" style={{ cursor: "pointer", borderRadius: 8, border: `1px solid ${voted ? C.teal : C.line}`, background: voted ? `${C.teal}12` : "transparent" }}>
                <div style={{ width: 22, height: 22, borderRadius: 999, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: voted ? C.teal : C.paperDark, color: voted ? "#fff" : C.inkSoft }}>
                  {voted && <Check size={13} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{o.name}</div>
                  <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkSoft }}>{o.votes.length ? `${o.votes.length} voto${o.votes.length !== 1 ? "s" : ""}: ${o.votes.join(", ")}` : "Sin votos"}</div>
                </div>
                <button onClick={e => { e.stopPropagation(); removeDestOption(o.id); }} style={{ color: C.inkSoft, padding: 4 }}><Trash2 size={13} /></button>
              </div>
            );
          })}
          {planning.destOptions.length === 0 && <p style={{ color: C.inkSoft, fontSize: 13 }}>Nadie ha propuesto destino todavía.</p>}
        </div>
        <div className="flex gap-2 mt-3">
          <input value={newDest} onChange={e => setNewDest(e.target.value)} onKeyDown={e => e.key === "Enter" && addDestOption()} placeholder="Ej. Lisboa, Portugal" style={{ ...inputStyle, flex: 1 }} />
          <button onClick={addDestOption} style={{ display: "flex", alignItems: "center", gap: 4, background: C.navy, color: "#fff", borderRadius: 6, padding: "0 14px", fontFamily: F.mono, fontSize: 12 }}>
            <Plus size={13} /> PROPONER
          </button>
        </div>
      </Card>

      <button onClick={finalize} disabled={!canFinalize || busy} style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        background: canFinalize ? C.teal : C.inkSoft, color: "#fff", borderRadius: 10, padding: "14px 16px",
        fontFamily: F.mono, fontSize: 13, fontWeight: 700, opacity: busy ? 0.7 : 1,
      }}>
        <PartyPopper size={16} /> {busy ? "CONFIRMANDO…" : "CONFIRMAR VIAJE CON LO MÁS VOTADO"}
      </button>
      {!canFinalize && <p style={{ textAlign: "center", color: C.inkSoft, fontSize: 12 }}>Propón al menos una fecha o destino para poder confirmar.</p>}
    </div>
  );
}
