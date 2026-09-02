"use client";

import { useEffect, useState } from "react";
import { loadShared, formatDate } from "./utils";
import type { Trip, ItineraryDay, Booking, ChecklistItem, Expense } from "./types";
import { BOOKING_TYPE_ICONS } from "./Reservas";

// Always mounted (hidden via CSS, see .print-export in globals.css) so that
// printing works instantly from any tab without a page navigation. Only
// visible to the browser's print engine.
export function PrintExport({ code, trip }: { code: string; trip: Trip }) {
  const [itin, setItin] = useState<ItineraryDay[]>([]);
  const [reservas, setReservas] = useState<Booking[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [gastos, setGastos] = useState<Expense[]>([]);

  useEffect(() => {
    loadShared<ItineraryDay[]>(`itin:${code}`, []).then(setItin);
    loadShared<Booking[]>(`reservas:${code}`, []).then(setReservas);
    loadShared<ChecklistItem[]>(`checklist:${code}`, []).then(setChecklist);
    loadShared<Expense[]>(`gastos:${code}`, []).then(setGastos);
  }, [code]);

  const totalGasto = gastos.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="print-export" style={{ padding: "32px 40px", color: "#111", fontFamily: "Georgia, serif" }}>
      <h1 style={{ fontSize: 28, marginBottom: 2 }}>{trip.name}</h1>
      {trip.destination && <p style={{ fontSize: 14, color: "#444" }}>{trip.destination}</p>}
      {trip.startDate && (
        <p style={{ fontSize: 13, color: "#666" }}>
          {formatDate(trip.startDate)}{trip.endDate ? ` → ${formatDate(trip.endDate)}` : ""}
        </p>
      )}

      {itin.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 18, borderBottom: "1px solid #ccc", paddingBottom: 4 }}>Itinerario</h2>
          {itin.map(d => (
            <div key={d.id} style={{ marginTop: 10 }}>
              <strong style={{ fontSize: 14 }}>{d.title}</strong>
              <ul style={{ margin: "4px 0 0 18px", fontSize: 13 }}>
                {d.items.map(it => <li key={it.id}>{it.time ? `${it.time} — ` : ""}{it.text}</li>)}
              </ul>
            </div>
          ))}
        </section>
      )}

      {reservas.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 18, borderBottom: "1px solid #ccc", paddingBottom: 4 }}>Reservas</h2>
          <ul style={{ margin: "8px 0 0 18px", fontSize: 13 }}>
            {reservas.map(b => (
              <li key={b.id} style={{ marginBottom: 4 }}>
                {BOOKING_TYPE_ICONS[b.type]} <strong>{b.title}</strong> — {b.startDate}{b.startTime ? ` ${b.startTime}` : ""}
                {b.confirmationCode ? ` (${b.confirmationCode})` : ""}{b.location ? ` · ${b.location}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      {checklist.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 18, borderBottom: "1px solid #ccc", paddingBottom: 4 }}>Checklist</h2>
          <ul style={{ margin: "8px 0 0 18px", fontSize: 13 }}>
            {checklist.map(c => <li key={c.id}>{c.done ? "☑" : "☐"} {c.text}</li>)}
          </ul>
        </section>
      )}

      {gastos.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 18, borderBottom: "1px solid #ccc", paddingBottom: 4 }}>Gastos</h2>
          <p style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>Total: {totalGasto.toFixed(2)} €</p>
          <ul style={{ margin: "6px 0 0 18px", fontSize: 13 }}>
            {gastos.map(e => <li key={e.id}>{e.description} — {e.amount.toFixed(2)} € ({e.paidBy})</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
