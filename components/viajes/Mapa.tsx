"use client";

import { useState, useEffect, useCallback } from "react";
import { MapPin, Trash2, Download, WifiOff } from "lucide-react";
import dynamic from "next/dynamic";
import { C, F, inputStyle } from "./theme";
import { Card, SectionLabel, Banner, EmptyState, SkeletonCards } from "./ui";
import { uid, loadShared, saveShared, peekShared } from "./utils";
import { prefetchMapTiles, tileCountForBounds, type LatLonBounds } from "./mapOffline";
import type { MapPlace, Trip, Session } from "./types";
import { AiQuickButton } from "./AiQuickButton";

const LeafletMap = dynamic(() => import("../LeafletMap"), { ssr: false });


export function Mapa({ code, destination, trip, session }: { code: string; destination: string; trip: Trip; session: Session }) {
  const key = `mapa:${code}`;
  const [places, setPlaces] = useState<MapPlace[]>(() => peekShared<MapPlace[]>(key) ?? []);
  const [loading, setLoading] = useState(() => peekShared<MapPlace[]>(key) === undefined);
  const [pendingLatLon, setPendingLatLon] = useState<{ lat: number; lon: number } | null>(null);
  const [form, setForm] = useState({ name: "", note: "" });
  const [err, setErr] = useState("");
  const [searching, setSearching] = useState(false);
  const [initialCenter, setInitialCenter] = useState<{ lat: number; lon: number; zoom: number } | null>(null);
  const [offlineStatus, setOfflineStatus] = useState<"idle" | "downloading" | "done" | "error">("idle");
  const [offlineProgress, setOfflineProgress] = useState({ done: 0, total: 0 });
  useEffect(() => { loadShared<MapPlace[]>(key, []).then(p => { setPlaces(p); setLoading(false); }); }, [key]);
  const persist = useCallback(async (next: MapPlace[]) => { setPlaces(next); await saveShared(key, next); }, [key]);

  const offlineBounds: LatLonBounds | null = places.length > 0
    ? {
        minLat: Math.min(...places.map(p => p.lat)) - 0.03, maxLat: Math.max(...places.map(p => p.lat)) + 0.03,
        minLon: Math.min(...places.map(p => p.lon)) - 0.03, maxLon: Math.max(...places.map(p => p.lon)) + 0.03,
      }
    : initialCenter
      ? { minLat: initialCenter.lat - 0.12, maxLat: initialCenter.lat + 0.12, minLon: initialCenter.lon - 0.12, maxLon: initialCenter.lon + 0.12 }
      : null;

  const offlineZooms = (() => {
    if (!offlineBounds) return [];
    const zooms = [12, 13, 14, 15];
    while (zooms.length > 1 && tileCountForBounds(offlineBounds, zooms) > 1500) zooms.pop();
    return zooms;
  })();
  const offlineEstimate = offlineBounds ? tileCountForBounds(offlineBounds, offlineZooms) : 0;

  async function downloadOffline() {
    if (!offlineBounds) return;
    setOfflineStatus("downloading");
    setOfflineProgress({ done: 0, total: offlineEstimate });
    try {
      await prefetchMapTiles(offlineBounds, offlineZooms, (done, total) => setOfflineProgress({ done, total }));
      setOfflineStatus("done");
    } catch {
      setOfflineStatus("error");
    }
  }

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

  async function addPlace() {
    setErr("");
    const name = form.name.trim();
    if (!name) { setErr("Escribe un nombre para el lugar."); return; }

    // If the user manually pinned a spot on the map, use those coordinates.
    if (pendingLatLon) {
      persist([...places, { id: uid(), name, lat: pendingLatLon.lat, lon: pendingLatLon.lon, note: form.note.trim() }]);
      setForm({ name: "", note: "" });
      setPendingLatLon(null);
      return;
    }

    // Otherwise, geocode the typed name and add it directly.
    setSearching(true);
    try {
      const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=es&format=json`);
      const geo = await r.json();
      if (!geo.results?.length) {
        setErr(`No se encontró "${name}". Prueba con otro nombre o haz clic en el mapa.`);
        return;
      }
      const { latitude: lat, longitude: lon } = geo.results[0];
      persist([...places, { id: uid(), name, lat, lon, note: form.note.trim() }]);
      setForm({ name: "", note: "" });
    } catch {
      setErr("Error buscando el lugar. Prueba haciendo clic en el mapa.");
    } finally {
      setSearching(false);
    }
  }

  if (loading) return <SkeletonCards />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <SectionLabel>{places.length ? `${places.length} lugar${places.length !== 1 ? "es" : ""} marcado${places.length !== 1 ? "s" : ""}` : "Mapa del viaje"}</SectionLabel>
        <AiQuickButton code={code} trip={trip} session={session} suggestions={[
          `Sugiéreme 5 lugares imprescindibles para visitar en ${destination || "mi destino"}`,
          "¿Qué zona debería explorar primero?",
        ]} />
      </div>

      {/* Map first */}
      <Card style={{ padding: 8 }}>
        <LeafletMap places={places} onMapClick={handleMapClick} pendingLatLon={pendingLatLon} initialCenter={initialCenter} height="380px" />
        {pendingLatLon ? (
          <p style={{ color: C.teal, fontSize: 12, fontFamily: F.mono, marginTop: 6, textAlign: "center" }}>
            📍 {pendingLatLon.lat.toFixed(4)}, {pendingLatLon.lon.toFixed(4)} — Añade el nombre abajo
          </p>
        ) : (
          <p style={{ color: C.inkSoft, fontSize: 12, fontFamily: F.mono, marginTop: 6, textAlign: "center" }}>
            Busca un lugar abajo o haz clic en el mapa para marcarlo manualmente · Clic en un pin para ver detalles
          </p>
        )}
      </Card>

      {/* Offline map download */}
      {offlineBounds && (
        <Card>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-2" style={{ flex: "1 1 200px" }}>
              <WifiOff size={15} color={C.sky} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <SectionLabel>Mapa offline</SectionLabel>
                <p style={{ fontSize: 12, color: C.inkSoft, marginTop: 4, lineHeight: 1.5 }}>
                  Descarga esta zona para poder ver el mapa sin conexión durante el viaje (~{offlineEstimate} tiles, ~{((offlineEstimate * 15) / 1024).toFixed(1)} MB).
                </p>
              </div>
            </div>
            <button onClick={downloadOffline} disabled={offlineStatus === "downloading"} className="flex items-center gap-2"
              style={{
                flexShrink: 0, background: offlineStatus === "done" ? C.green : C.navy, color: "#fff",
                borderRadius: 8, padding: "10px 16px", fontFamily: F.mono, fontSize: 11, fontWeight: 700,
                opacity: offlineStatus === "downloading" ? 0.7 : 1,
              }}>
              <Download size={13} />
              {offlineStatus === "downloading" ? `DESCARGANDO ${offlineProgress.done}/${offlineProgress.total}` :
               offlineStatus === "done" ? "✓ DISPONIBLE OFFLINE" :
               offlineStatus === "error" ? "REINTENTAR" : "DESCARGAR"}
            </button>
          </div>
        </Card>
      )}

      {/* Add place form */}
      <Card>
        <SectionLabel>Añadir lugar</SectionLabel>
        <div className="flex flex-wrap gap-2 mt-3">
          <input placeholder="Busca un lugar (p. ej. Roma)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            onKeyDown={e => e.key === "Enter" && addPlace()}
            style={{ ...inputStyle, flex: "2 1 180px" }} />
          <input placeholder="Nota (opcional)" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}
            onKeyDown={e => e.key === "Enter" && addPlace()}
            style={{ ...inputStyle, flex: "2 1 180px" }} />
          <button onClick={addPlace} disabled={searching} style={{ background: searching ? C.inkSoft : C.navy, color: C.paper, borderRadius: 5, padding: "0 18px", fontFamily: F.mono, fontSize: 12, height: 39, transition: "background 0.2s" }}>
            {searching ? "BUSCANDO…" : "AÑADIR"}
          </button>
        </div>
        {err && <Banner type="error" msg={err} />}
      </Card>

      {/* Places list */}
      <div className="flex flex-col gap-2">
        {places.map((p, i) => (
          <div key={p.id} className="flex items-center gap-3 px-3 py-2 card-lift"
            style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8 }}>
            <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 999, background: C.red, color: "#fff", fontSize: 11, fontWeight: 700, fontFamily: F.mono, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</span>
              {p.note && <span style={{ color: C.inkSoft, fontSize: 13 }}> — {p.note}</span>}
              <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkSoft }}>{p.lat.toFixed(4)}, {p.lon.toFixed(4)}</div>
            </div>
            <button onClick={() => persist(places.filter(x => x.id !== p.id))} style={{ color: C.inkSoft, padding: 4, flexShrink: 0 }}><Trash2 size={14} /></button>
          </div>
        ))}
        {places.length === 0 && <EmptyState icon={<MapPin size={28} color={C.line} />} text="Haz clic en el mapa para añadir el primer lugar." />}
      </div>
    </div>
  );
}

