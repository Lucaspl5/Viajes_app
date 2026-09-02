"use client";

import { useState, useEffect, useCallback } from "react";
import { MapPin, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { C, F, inputStyle } from "./theme";
import { Card, SectionLabel, Banner, EmptyState, SkeletonCards } from "./ui";
import { uid, loadShared, saveShared } from "./utils";
import type { MapPlace } from "./types";

const LeafletMap = dynamic(() => import("../LeafletMap"), { ssr: false });


export function Mapa({ code, destination }: { code: string; destination: string }) {
  const [places, setPlaces] = useState<MapPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingLatLon, setPendingLatLon] = useState<{ lat: number; lon: number } | null>(null);
  const [form, setForm] = useState({ name: "", note: "" });
  const [err, setErr] = useState("");
  const [initialCenter, setInitialCenter] = useState<{ lat: number; lon: number; zoom: number } | null>(null);
  const key = `mapa:${code}`;
  useEffect(() => { loadShared<MapPlace[]>(key, []).then(p => { setPlaces(p); setLoading(false); }); }, [key]);
  const persist = useCallback(async (next: MapPlace[]) => { setPlaces(next); await saveShared(key, next); }, [key]);

  // Center the map on the trip's destination when there are no saved places yet.
  useEffect(() => {
    if (!destination || places.length > 0) return;
    let cancelled = false;
    fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destination)}&count=1&language=es&format=json`)
      .then(r => r.json())
      .then(geo => {
        if (cancelled || !geo.results?.length) return;
        const { latitude: lat, longitude: lon } = geo.results[0];
        setInitialCenter({ lat, lon, zoom: 12 });
      })
      .catch(() => { /* geocoding is optional — keep default world view */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination, loading]);

  function handleMapClick(lat: number, lon: number) {
    setPendingLatLon({ lat, lon });
    setErr("");
  }

  function addPlace() {
    setErr("");
    if (!form.name.trim()) { setErr("Escribe un nombre para el lugar."); return; }
    if (!pendingLatLon) { setErr("Haz clic en el mapa para marcar la ubicación."); return; }
    persist([...places, { id: uid(), name: form.name.trim(), lat: pendingLatLon.lat, lon: pendingLatLon.lon, note: form.note.trim() }]);
    setForm({ name: "", note: "" });
    setPendingLatLon(null);
  }

  if (loading) return <SkeletonCards />;

  return (
    <div className="flex flex-col gap-4">
      {/* Map first */}
      <Card style={{ padding: 8 }}>
        <LeafletMap places={places} onMapClick={handleMapClick} pendingLatLon={pendingLatLon} initialCenter={initialCenter} height="380px" />
        {pendingLatLon ? (
          <p style={{ color: C.teal, fontSize: 12, fontFamily: F.mono, marginTop: 6, textAlign: "center" }}>
            📍 {pendingLatLon.lat.toFixed(4)}, {pendingLatLon.lon.toFixed(4)} — Añade el nombre abajo
          </p>
        ) : (
          <p style={{ color: C.inkSoft, fontSize: 12, fontFamily: F.mono, marginTop: 6, textAlign: "center" }}>
            Haz clic en el mapa para añadir un lugar · Clic en un pin para ver detalles
          </p>
        )}
      </Card>

      {/* Add place form */}
      <Card>
        <SectionLabel>Añadir lugar</SectionLabel>
        <div className="flex flex-wrap gap-2 mt-3">
          <input placeholder="Nombre del lugar" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            style={{ ...inputStyle, flex: "2 1 180px" }} />
          <input placeholder="Nota (opcional)" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}
            onKeyDown={e => e.key === "Enter" && addPlace()}
            style={{ ...inputStyle, flex: "2 1 180px" }} />
          <button onClick={addPlace} style={{ background: pendingLatLon ? C.navy : C.inkSoft, color: C.paper, borderRadius: 5, padding: "0 18px", fontFamily: F.mono, fontSize: 12, height: 39, transition: "background 0.2s" }}>
            AÑADIR
          </button>
        </div>
        {err && <Banner type="error" msg={err} />}
      </Card>

      {/* Places list */}
      <div className="flex flex-col gap-2">
        {places.map(p => (
          <div key={p.id} className="flex items-center justify-between px-3 py-2 card-lift"
            style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 6 }}>
            <div>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</span>
              {p.note && <span style={{ color: C.inkSoft, fontSize: 13 }}> — {p.note}</span>}
              <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkSoft, marginLeft: 8 }}>{p.lat.toFixed(4)}, {p.lon.toFixed(4)}</span>
            </div>
            <button onClick={() => persist(places.filter(x => x.id !== p.id))} style={{ color: C.inkSoft, padding: 4 }}><Trash2 size={14} /></button>
          </div>
        ))}
        {places.length === 0 && <EmptyState icon={<MapPin size={28} color={C.line} />} text="Haz clic en el mapa para añadir el primer lugar." />}
      </div>
    </div>
  );
}

