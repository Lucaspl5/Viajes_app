"use client";

import { useState, useEffect, useRef } from "react";
import { Plane } from "lucide-react";
import { animate, stagger } from "animejs";
import { C, F, inputStyle } from "./theme";
import { Field, Banner } from "./ui";
import { genTripCode, loadShared, saveShared } from "./utils";
import type { Trip } from "./types";


export function EntryScreen({ onEnter, externalError, prefillCode }: { onEnter: (code: string, name: string) => Promise<void>; externalError: string; prefillCode?: string }) {
  const [mode, setMode] = useState<"join" | "create">(prefillCode ? "join" : "create");
  const [name, setName] = useState("");
  const [code, setCode] = useState(prefillCode ?? "");
  const [tripName, setTripName] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, [mode]);

  async function handleJoin() {
    if (!name.trim()) { setError("Escribe tu nombre."); return; }
    if (!code.trim()) { setError("Escribe el código del viaje."); return; }
    setBusy(true); setError("");
    const t = await loadShared<Trip | null>(`trip:${code.trim().toUpperCase()}`, null);
    if (!t) { setError("No existe ese código. Revísalo o crea un viaje nuevo."); setBusy(false); return; }
    await onEnter(code.trim().toUpperCase(), name.trim());
    setBusy(false);
  }

  async function handleCreate() {
    if (!name.trim()) { setError("Escribe tu nombre."); return; }
    if (!tripName.trim()) { setError("Escribe el nombre del viaje."); return; }
    if (startDate && endDate && endDate < startDate) { setError("La fecha de fin debe ser posterior a la de inicio."); return; }
    setBusy(true); setError("");
    let newCode = genTripCode(), tries = 0;
    while ((await loadShared<Trip | null>(`trip:${newCode}`, null)) !== null && tries < 10) { newCode = genTripCode(); tries++; }
    const trip: Trip = { name: tripName.trim(), destination: destination.trim(), startDate: startDate || null, endDate: endDate || null, members: [], createdAt: Date.now() };
    const ok = await saveShared(`trip:${newCode}`, trip);
    if (!ok) { setError("Error al guardar el viaje. Inténtalo de nuevo."); setBusy(false); return; }
    await onEnter(newCode, name.trim());
    setBusy(false);
  }

  const isJoin = mode === "join";

  // Landing entrance animation
  const heroRef = useRef<HTMLDivElement>(null);
  const formCardRef = useRef<HTMLDivElement>(null);
  const pillsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const tl = [
      { el: heroRef.current, opts: { opacity: [0, 1], translateY: [30, 0], duration: 700, ease: "out(3)" } },
      { el: formCardRef.current, opts: { opacity: [0, 1], translateY: [40, 0], scale: [0.96, 1], duration: 600, delay: 160, ease: "out(3)" } },
    ];
    tl.forEach(({ el, opts }) => {
      if (!el) return;
      el.style.opacity = "0";
      animate(el, opts as Parameters<typeof animate>[1]);
    });
    if (pillsRef.current) {
      const pills = Array.from(pillsRef.current.children) as HTMLElement[];
      pills.forEach(p => { p.style.opacity = "0"; p.style.transform = "scale(0.85)"; });
      animate(pills, { opacity: [0, 1], scale: [0.85, 1], delay: stagger(40, { start: 320 }), duration: 380, ease: "out(2)" });
    }
  }, []);

  return (
    <div style={{ minHeight: "100dvh", fontFamily: F.body, color: C.ink, display: "flex", flexDirection: "column" }}>
      {/* Hero top panel */}
      <div
        className="dot-grid relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${C.navy} 0%, #0A1626 55%, #142644 100%)`, flex: "0 0 auto" }}
      >
        {/* Glow orbs */}
        <div className="glow-pulse" style={{ position: "absolute", top: -60, right: -60, width: 300, height: 300, borderRadius: 999, background: `radial-gradient(circle, ${C.gold}28, transparent 70%)`, pointerEvents: "none" }} />
        <div className="glow-pulse" style={{ position: "absolute", bottom: -40, left: 40, width: 200, height: 200, borderRadius: 999, background: `radial-gradient(circle, ${C.teal}35, transparent 70%)`, pointerEvents: "none", animationDelay: "1.5s" }} />
        <div className="glow-pulse" style={{ position: "absolute", top: "40%", left: "35%", width: 150, height: 150, borderRadius: 999, background: `radial-gradient(circle, ${C.purple}20, transparent 70%)`, pointerEvents: "none", animationDelay: "3s" }} />

        <div className="max-w-5xl mx-auto px-6 py-12 relative">
          <div className="flex flex-col md:flex-row items-center gap-10">
            {/* Left: Branding */}
            <div ref={heroRef} className="flex-1 text-center md:text-left">
              <div className="float inline-block mb-6">
                <Plane size={52} color={C.gold} strokeWidth={1.2} />
              </div>
              <h1 style={{ fontFamily: F.display, fontSize: "clamp(2.4rem, 5vw, 3.8rem)", fontWeight: 700, color: "#fff", lineHeight: 1.05, letterSpacing: -1 }}>
                Bitácora<br />de Viaje
              </h1>
              <p style={{ color: "#AAB8D0", fontSize: 16, marginTop: 14, maxWidth: 340, lineHeight: 1.65 }}>
                Planifica, comparte y revive tus aventuras junto a tu gente — sin apps, sin contraseñas.
              </p>
              {/* Feature pills */}
              <div ref={pillsRef} className="flex flex-wrap gap-2 mt-6 justify-center md:justify-start">
                {[
                  ["🌍", "Destinos"], ["✈️", "Itinerario"], ["🗺️", "Mapa"],
                  ["🧳", "Equipaje"], ["💶", "Gastos"], ["💡", "Ideas"], ["📸", "Fotos"],
                ].map(([icon, label]) => (
                  <span key={label} style={{ background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.14)", color: "#C3D0E8", fontSize: 12, fontFamily: F.mono, borderRadius: 999, padding: "5px 11px" }}>
                    {icon} {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Right: Form card */}
            <div ref={formCardRef} style={{ width: "100%", maxWidth: 400, background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)" }}>
              {/* Mode toggle */}
              <div className="flex" style={{ borderBottom: `1px solid ${C.line}` }}>
                {([["create", "✈ Crear viaje"], ["join", "Unirme"]] as const).map(([k, label]) => (
                  <button key={k} onClick={() => { setMode(k); setError(""); }} style={{
                    flex: 1, padding: "13px 8px", fontSize: 12, fontWeight: 600,
                    fontFamily: F.mono, letterSpacing: 0.4,
                    color: mode === k ? C.navy : C.inkSoft,
                    background: mode === k ? C.paperDark : "transparent",
                    borderBottom: mode === k ? `2px solid ${C.red}` : "2px solid transparent",
                    transition: "all 0.15s",
                  }}>
                    {label.toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="p-5 flex flex-col gap-3" style={{ background: C.paper }}>
                <Field label="Tu nombre">
                  <input ref={nameRef} value={name} onChange={e => setName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && (isJoin ? handleJoin() : handleCreate())}
                    placeholder="Ej. Lucas" style={inputStyle} autoComplete="given-name" />
                </Field>

                {isJoin ? (
                  <Field label="Código del viaje" hint="Pídelo al organizador">
                    <input value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
                      onKeyDown={e => e.key === "Enter" && handleJoin()}
                      placeholder="Ej. ABC-234" maxLength={7}
                      style={{ ...inputStyle, fontFamily: F.mono, letterSpacing: 2 }} />
                  </Field>
                ) : (
                  <>
                    <Field label="Nombre del viaje">
                      <input value={tripName} onChange={e => setTripName(e.target.value)} placeholder="Ej. Grecia 2027" style={inputStyle} />
                    </Field>
                    <Field label="Destino principal (opcional)">
                      <input value={destination} onChange={e => setDestination(e.target.value)} placeholder="Ej. Santorini, Grecia" style={inputStyle} />
                    </Field>
                    <div className="flex gap-3">
                      <Field label="Inicio"><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} /></Field>
                      <Field label="Fin"><input type="date" value={endDate} min={startDate || undefined} onChange={e => setEndDate(e.target.value)} style={inputStyle} /></Field>
                    </div>
                  </>
                )}

                {(error || externalError) && <Banner type="error" msg={error || externalError} />}

                <button disabled={busy} onClick={isJoin ? handleJoin : handleCreate} style={{
                  marginTop: 2, background: busy ? C.inkSoft : C.navy, color: C.paper,
                  fontFamily: F.mono, fontWeight: 600, fontSize: 13, letterSpacing: 0.5,
                  padding: "13px 16px", borderRadius: 6, transition: "background 0.15s",
                }}>
                  {busy ? "UN MOMENTO…" : isJoin ? "ENTRAR AL VIAJE →" : "CREAR VIAJE →"}
                </button>

                <p style={{ color: C.inkSoft, fontSize: 11, textAlign: "center", fontFamily: F.mono }}>
                  SIN CONTRASEÑAS · COMPARTE EL CÓDIGO
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trip history */}
      {(() => {
        let history: { code: string; name: string; destination: string; leftAt: number }[] = [];
        try { history = JSON.parse(localStorage.getItem("trip_history") ?? "[]"); } catch { /* */ }
        if (!history.length) return null;
        return (
          <div style={{ background: C.paper, padding: "24px 24px 12px", maxWidth: 800, margin: "0 auto", width: "100%" }}>
            <p style={{ fontFamily: F.mono, fontSize: 10, color: C.inkSoft, letterSpacing: 1.5, marginBottom: 10 }}>VIAJES RECIENTES</p>
            <div className="flex flex-col gap-2">
              {history.map(h => (
                <button key={h.code} onClick={() => { setCode(h.code); setMode("join"); }}
                  style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 14px", textAlign: "left", cursor: "pointer", transition: "border-color 0.15s" }}
                  onMouseOver={e => (e.currentTarget.style.borderColor = C.teal)}
                  onMouseOut={e => (e.currentTarget.style.borderColor = C.line)}>
                  <Plane size={15} color={C.inkSoft} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: C.ink }}>{h.name}</span>
                    {h.destination && <span style={{ color: C.inkSoft, fontSize: 12 }}> · {h.destination}</span>}
                  </div>
                  <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkSoft, background: C.paperDark, borderRadius: 4, padding: "2px 6px" }}>{h.code}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Bottom decorative strip */}
      <div style={{ background: C.paper, padding: "28px 24px", textAlign: "center" }}>
        <p style={{ color: C.inkSoft, fontSize: 13, maxWidth: 480, margin: "0 auto", lineHeight: 1.7 }}>
          Crea un viaje, comparte el código con tu grupo y planificad juntos desde cualquier dispositivo.
          Itinerario, mapa, fotos, gastos divididos y lista de equipaje — todo en uno.
        </p>
      </div>
    </div>
  );
}

