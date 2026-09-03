"use client";

import { useState, useEffect, useRef } from "react";
import { Plane, MapPin, Camera, ListChecks, Copy, Check, X, ArrowLeft, Luggage, Lightbulb, Wallet, Sunrise, PiggyBank, Globe, BookOpen, Moon, Sun, Ticket, Sparkles, MoreHorizontal } from "lucide-react";
import { animate } from "animejs";
import { C, F } from "./theme";
import { useCountdown } from "./ui";
import { genTripCode, loadShared, saveShared, flushDirtyKeys, loadPersonal, savePersonal } from "./utils";
import { isPremium } from "./premium";
import { sendPresenceHeartbeat, fetchActivePresence } from "./presence";
import type { Trip, Session, TabId, ItineraryDay, ChecklistItem, PackingItem } from "./types";
import { EntryScreen } from "./EntryScreen";
import { LoadingScreen } from "./LoadingScreen";
import { AsistenteIA } from "./AsistenteIA";
import { Resumen } from "./Resumen";
import { SyncButton } from "./SyncButton";
import { Itinerario } from "./Itinerario";
import { Mapa } from "./Mapa";
import { Fotos } from "./Fotos";
import { Checklist } from "./Checklist";
import { Gastos } from "./Gastos";
import { Equipaje } from "./Equipaje";
import { Ideas } from "./Ideas";
import { Ahorro } from "./Ahorro";
import { Destinos } from "./Destinos";
import { Reservas } from "./Reservas";
import { Diario } from "./Diario";
import { PrintExport } from "./PrintExport";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [tab, setTab] = useState<TabId>("resumen");
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Cargando tu viaje…");
  const [copied, setCopied] = useState(false);
  const [entryError, setEntryError] = useState("");
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("darkMode") === "1";
  });

  useEffect(() => {
    (async () => {
      // Handle invite link: /?code=XYZ&d=<base64tripdata>
      const params = new URLSearchParams(window.location.search);
      const urlCode = params.get("code");
      const urlData = params.get("d");
      let inviteTripObj: Trip | null = null;
      if (urlCode && urlData) {
        try {
          inviteTripObj = JSON.parse(decodeURIComponent(atob(urlData))) as Trip;
          await saveShared(`trip:${urlCode}`, inviteTripObj);
          setInviteCode(urlCode);
        } catch { /* malformed invite link */ }
        window.history.replaceState({}, "", window.location.pathname);
      }

      const last = await loadPersonal<Session | null>("lastSession", null);
      if (last?.code && last?.name) {
        // If the invite link is for the same trip we're already in, use the fresher data
        if (inviteTripObj && urlCode === last.code) {
          // Make sure we're still in the members list
          if (!inviteTripObj.members.some(m => m.toLowerCase() === last.name.toLowerCase())) {
            inviteTripObj.members = [...inviteTripObj.members, last.name];
            await saveShared(`trip:${last.code}`, inviteTripObj);
          }
          setSession(last); setTrip(inviteTripObj); setLoading(false); return;
        }
        const t = await loadShared<Trip | null>(`trip:${last.code}`, null);
        if (t) { setSession(last); setTrip(t); }
      }
      setLoading(false);
    })();
  }, []);

  async function enter(code: string, name: string, preloadedTrip?: Trip) {
    setLoadingMessage(preloadedTrip ? "Preparando tu viaje…" : "Entrando al viaje…");
    setLoading(true); setEntryError("");
    const t = preloadedTrip ?? await loadShared<Trip | null>(`trip:${code}`, null);
    if (!t) { setLoading(false); setEntryError("No se pudo cargar el viaje. Inténtalo de nuevo."); return; }
    if (!t.members.some(m => m.toLowerCase() === name.toLowerCase())) {
      t.members = [...t.members, name];
      await saveShared(`trip:${code}`, t);
    }
    await savePersonal("lastSession", { code, name });
    setSession({ code, name }); setTrip(t); setLoading(false);
  }

  async function importItinerary(days: ItineraryDay[]) {
    if (!session) return;
    await saveShared(`itin:${session.code}`, days);
    setTab("itinerario");
  }

  // Copies structure (itinerary, checklist, packing list) into a brand-new
  // trip code so a group can reuse a past trip as a starting point without
  // dragging along its expenses, diary or photos.
  async function duplicateTrip(): Promise<string | null> {
    if (!session || !trip) return null;
    const newCode = genTripCode();
    const newTrip: Trip = {
      name: `${trip.name} (copia)`,
      destination: trip.destination,
      startDate: null,
      endDate: null,
      members: [session.name],
      createdAt: Date.now(),
    };
    const [itin, checklist, equipaje] = await Promise.all([
      loadShared<ItineraryDay[]>(`itin:${session.code}`, []),
      loadShared<ChecklistItem[]>(`checklist:${session.code}`, []),
      loadShared<PackingItem[]>(`equipaje:${session.code}`, []),
    ]);
    await Promise.all([
      saveShared(`trip:${newCode}`, newTrip),
      saveShared(`itin:${newCode}`, itin),
      saveShared(`checklist:${newCode}`, checklist.map(c => ({ ...c, done: false }))),
      saveShared(`equipaje:${newCode}`, equipaje.map(e => ({ ...e, checkedBy: [] }))),
    ]);
    return newCode;
  }

  async function enterDuplicated(code: string) {
    await enter(code, session!.name);
  }

  function leave() {
    if (session && trip) {
      try {
        const prev = JSON.parse(localStorage.getItem("trip_history") ?? "[]") as { code: string; name: string; destination: string; leftAt: number }[];
        const entry = { code: session.code, name: trip.name, destination: trip.destination, leftAt: Date.now() };
        localStorage.setItem("trip_history", JSON.stringify([entry, ...prev.filter(h => h.code !== entry.code)].slice(0, 8)));
      } catch { /* ignore */ }
    }
    setSession(null); setTrip(null); setTab("resumen");
  }

  function toggleDark() {
    setDarkMode(d => {
      const next = !d;
      localStorage.setItem("darkMode", next ? "1" : "0");
      return next;
    });
  }

  const days = useCountdown(trip?.startDate ?? null);
  const contentRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    el.style.opacity = "0.4";
    animate(el, { opacity: [0.4, 1], duration: 120, ease: "out(2)" });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [tab, session]);

  const [showMore, setShowMore] = useState(false);
  const [syncToast, setSyncToast] = useState(false);
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);

  useEffect(() => {
    flushDirtyKeys();
    const onOnline = () => { setIsOffline(false); flushDirtyKeys(); };
    const onOffline = () => setIsOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, []);
  const tripRef = useRef<Trip | null>(null);
  useEffect(() => { tripRef.current = trip; }, [trip]);

  // PWA install prompt
  const [pwaPrompt, setPwaPrompt] = useState<any>(null); // BeforeInstallPromptEvent not in lib.dom yet
  const [pwaDismissed, setPwaDismissed] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("pwa_dismissed") === "1") { setPwaDismissed(true); return; }
    const handler = (e: any) => { e.preventDefault(); setPwaPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    if (!session) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/store?key=${encodeURIComponent(`trip:${session.code}`)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data) return;
        if (JSON.stringify(data) !== JSON.stringify(tripRef.current)) {
          setTrip(data as Trip);
          setSyncToast(true);
          setTimeout(() => setSyncToast(false), 3000);
        }
      } catch { /* silent */ }
    };
    const id = setInterval(poll, 30000);
    return () => clearInterval(id);
  }, [session]);

  // "Who's here now" — premium only, cheap heartbeat + poll piggybacked on
  // the same cadence as trip sync above.
  const [activePresence, setActivePresence] = useState<string[]>([]);
  useEffect(() => {
    if (!session || !trip || !isPremium(trip)) { setActivePresence([]); return; }
    const beat = () => {
      sendPresenceHeartbeat(session.code, session.name);
      fetchActivePresence(session.code).then(setActivePresence);
    };
    beat();
    const id = setInterval(beat, 45000);
    return () => clearInterval(id);
  }, [session, trip?.premium]);

  if (loading) {
    return <LoadingScreen message={loadingMessage} />;
  }

  if (!session || !trip) return <EntryScreen onEnter={enter} externalError={entryError} prefillCode={inviteCode ?? undefined} />;

  const primaryTabs: { id: TabId; label: string; Icon: React.ElementType }[] = [
    { id: "resumen",    label: "Inicio",  Icon: Sunrise },
    { id: "itinerario", label: "Plan",    Icon: Plane },
    { id: "mapa",       label: "Mapa",    Icon: MapPin },
    { id: "gastos",     label: "Gastos",  Icon: Wallet },
  ];
  const moreTabs: { id: TabId; label: string; Icon: React.ElementType }[] = [
    { id: "asistente",  label: "IA",        Icon: Sparkles },
    { id: "reservas",   label: "Reservas",  Icon: Ticket },
    { id: "fotos",      label: "Fotos",     Icon: Camera },
    { id: "diario",     label: "Diario",    Icon: BookOpen },
    { id: "equipaje",   label: "Equipaje",  Icon: Luggage },
    { id: "checklist",  label: "Checklist", Icon: ListChecks },
    { id: "ideas",      label: "Ideas",     Icon: Lightbulb },
    { id: "ahorro",     label: "Ahorro",    Icon: PiggyBank },
    { id: "destinos",   label: "Destinos",  Icon: Globe },
  ];
  const isMoreActive = moreTabs.some(t => t.id === tab);

  const dk = darkMode ? {
    bg: "#0D1117", bgCard: "#161B22", bgHeader: "linear-gradient(135deg,#0D1117 0%,#161B22 100%)",
    text: "#E6EDF3", textSoft: "#8B949E", border: "#30363D", paper: "#0D1117",
  } : null;

  return (
    <div className="app-shell" style={{ background: dk ? dk.bg : C.paper, fontFamily: F.body, color: dk ? dk.text : C.ink, minHeight: "100dvh", transition: "background 0.3s" }}>
      {/* Header */}
      <header style={{ background: dk ? dk.bgHeader : `linear-gradient(135deg, ${C.navy} 0%, ${C.navyMid} 60%, #1A3560 100%)`, color: C.paper }} className="dot-grid">
        <div className="max-w-4xl mx-auto px-4 pt-4 pb-0">
          <div className="flex items-center justify-between mb-3">
            <button onClick={leave} className="flex items-center gap-1" style={{ color: "#7C8AA3", fontSize: 11, fontFamily: F.mono }}>
              <ArrowLeft size={12} /> CAMBIAR DE VIAJE
            </button>
            <div className="flex items-center gap-2">
              <SyncButton code={session.code} onSync={t => setTrip(t)} />
              <button onClick={toggleDark} style={{ color: "#7C8AA3", padding: "4px 8px", borderRadius: 6, border: "1px solid #2D3E5A", display: "flex", alignItems: "center", gap: 4, fontFamily: F.mono, fontSize: 10 }}>
                {darkMode ? <Sun size={12} /> : <Moon size={12} />} {darkMode ? "CLARO" : "OSCURO"}
              </button>
            </div>
          </div>

          <div className="flex items-start justify-between flex-wrap gap-3 pb-4">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="flex items-center gap-2 mb-1">
                <span style={{ fontFamily: F.mono, fontSize: 10, color: C.gold, letterSpacing: 1.5 }}>TARJETA DE EMBARQUE</span>
              </div>
              <h1 style={{ fontFamily: F.display, fontSize: "clamp(1.6rem, 4vw, 2.2rem)", fontWeight: 700, lineHeight: 1.15 }} className="truncate">
                {trip.name}
              </h1>
              {trip.destination && (
                <p className="flex items-center gap-1 mt-1" style={{ color: "#B9C3D6", fontSize: 13 }}>
                  <MapPin size={12} />{trip.destination}
                </p>
              )}
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              <button
                onClick={() => { navigator.clipboard?.writeText(session.code).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
                className="flex items-center gap-2"
                style={{ border: "1px solid #3A4A68", borderRadius: 5, padding: "6px 12px", fontFamily: F.mono, fontSize: 13, letterSpacing: 1.5, background: "rgba(255,255,255,0.06)", color: copied ? C.goldLight : C.paper, transition: "color 0.2s" }}
                title="Copiar código"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />} {session.code}
              </button>
              {days !== null && (
                <div className="text-right">
                  <div style={{ fontFamily: F.display, fontSize: 28, fontWeight: 700, color: C.goldLight, lineHeight: 1 }}>
                    {days > 0 ? days : days === 0 ? "✈" : "🌍"}
                  </div>
                  <div style={{ fontFamily: F.mono, fontSize: 9, color: "#7C8AA3", letterSpacing: 1 }}>
                    {days > 0 ? "DÍAS RESTANTES" : days === 0 ? "¡ES HOY!" : "EN CURSO"}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </header>

      {/* Content */}
      <main ref={contentRef as React.RefObject<HTMLElement>} className="max-w-4xl mx-auto px-4 py-6" style={{ opacity: 0, paddingBottom: "calc(1.5rem + 64px)" }}>
        {tab === "resumen"    && <Resumen trip={trip} session={session} days={days} darkMode={darkMode} onTripUpdate={setTrip} onDuplicate={duplicateTrip} onEnterDuplicate={enterDuplicated} activePresence={activePresence} />}
        {tab === "reservas"   && <Reservas code={session.code} session={session} trip={trip} darkMode={darkMode} onTripUpdate={setTrip} />}
        {tab === "itinerario" && <Itinerario code={session.code} startDate={trip.startDate} trip={trip} session={session} onImportItinerary={importItinerary} />}
        {tab === "mapa"       && <Mapa code={session.code} destination={trip.destination} trip={trip} session={session} />}
        {tab === "fotos"      && <Fotos code={session.code} session={session} trip={trip} darkMode={darkMode} onTripUpdate={setTrip} />}
        {tab === "diario"     && <Diario code={session.code} session={session} trip={trip} darkMode={darkMode} />}
        {tab === "checklist"  && <Checklist code={session.code} session={session} trip={trip} />}
        {tab === "gastos"     && <Gastos code={session.code} session={session} members={trip.members} trip={trip} darkMode={darkMode} onTripUpdate={setTrip} />}
        {tab === "equipaje"   && <Equipaje code={session.code} session={session} trip={trip} />}
        {tab === "ideas"      && <Ideas code={session.code} session={session} trip={trip} />}
        {tab === "ahorro"     && <Ahorro code={session.code} members={trip.members} trip={trip} session={session} />}
        {tab === "destinos"   && <Destinos code={session.code} startDate={trip.startDate} trip={trip} session={session} onSelect={() => setTab("itinerario")} />}
        {tab === "asistente"  && <AsistenteIA code={session.code} trip={trip} session={session} onImportItinerary={importItinerary} />}
      </main>

      {/* Fixed bottom navigation */}
      <nav className="no-print" style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: dk ? "#0D1117" : "#fff", borderTop: `1px solid ${dk ? "#21262D" : C.line}`, zIndex: 100, paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="max-w-4xl mx-auto flex">
          {primaryTabs.map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button key={id} onClick={() => { setTab(id); setShowMore(false); }}
                style={{ flex: 1, padding: "10px 0 11px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, transition: "opacity 0.15s", position: "relative" }}>
                <Icon size={21} color={active ? C.teal : dk ? "#4A5568" : "#94A3B8"} strokeWidth={active ? 2.5 : 1.8} />
                <span style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 0.4, color: active ? C.teal : dk ? "#4A5568" : "#94A3B8" }}>{label.toUpperCase()}</span>
                {active && <div style={{ position: "absolute", top: 0, width: 28, height: 2, background: C.teal, borderRadius: "0 0 2px 2px" }} />}
              </button>
            );
          })}
          <button onClick={() => setShowMore(v => !v)}
            style={{ flex: 1, padding: "10px 0 11px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, position: "relative" }}>
            <MoreHorizontal size={21} color={(showMore || isMoreActive) ? C.teal : dk ? "#4A5568" : "#94A3B8"} strokeWidth={(showMore || isMoreActive) ? 2.5 : 1.8} />
            <span style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 0.4, color: (showMore || isMoreActive) ? C.teal : dk ? "#4A5568" : "#94A3B8" }}>MÁS</span>
            {(showMore || isMoreActive) && <div style={{ position: "absolute", top: 0, width: 28, height: 2, background: C.teal, borderRadius: "0 0 2px 2px" }} />}
          </button>
        </div>
      </nav>

      {/* "Más" bottom drawer */}
      {showMore && (
        <>
          <div onClick={() => setShowMore(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200 }} className="fade-in" />
          <div className="fade-in" style={{ position: "fixed", bottom: 64, left: 0, right: 0, background: dk ? "#161B22" : "#fff", borderRadius: "20px 20px 0 0", padding: "16px 20px 20px", zIndex: 201, boxShadow: "0 -8px 40px rgba(0,0,0,0.22)" }}>
            <div style={{ width: 40, height: 4, background: dk ? "#30363D" : C.line, borderRadius: 2, margin: "0 auto 16px" }} />
            <p style={{ fontFamily: F.mono, fontSize: 10, color: C.inkSoft, letterSpacing: 1.5, marginBottom: 14 }}>SECCIONES</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {moreTabs.map(({ id, label, Icon }) => {
                const active = tab === id;
                return (
                  <button key={id} onClick={() => { setTab(id); setShowMore(false); }}
                    className="btn-press"
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, padding: "14px 8px", borderRadius: 14, background: active ? `${C.teal}18` : dk ? "#21262D" : C.paperDark, border: `1px solid ${active ? C.teal + "50" : "transparent"}`, transition: "background 0.15s" }}>
                    <Icon size={22} color={active ? C.teal : dk ? "#6E7681" : C.inkSoft} strokeWidth={active ? 2.5 : 1.8} />
                    <span style={{ fontFamily: F.mono, fontSize: 10, color: active ? C.teal : dk ? "#8B949E" : C.ink, letterSpacing: 0.3 }}>{label.toUpperCase()}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {isOffline && (
        <div className="no-print fade-in" style={{ position: "fixed", top: 8, left: "50%", transform: "translateX(-50%)", background: C.red, color: "#fff", borderRadius: 20, padding: "6px 14px", fontSize: 11, fontFamily: F.mono, zIndex: 9999, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
          ⚠ SIN CONEXIÓN · guardando en local
        </div>
      )}
      {syncToast && (
        <div style={{ position: "fixed", bottom: 80, right: 16, background: C.teal, color: "#fff", borderRadius: 20, padding: "8px 16px", fontSize: 12, fontFamily: "var(--font-mono)", zIndex: 9999, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }} className="fade-in">
          ✓ SINCRONIZADO
        </div>
      )}
      {pwaPrompt && !pwaDismissed && (
        <div className="fade-in" style={{ position: "fixed", bottom: 80, left: 12, right: 12, background: C.navy, borderRadius: 14, padding: "14px 16px", zIndex: 9998, display: "flex", alignItems: "center", gap: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: F.mono, fontSize: 11, color: C.goldLight, letterSpacing: 1, margin: 0 }}>INSTALAR APP</p>
            <p style={{ fontSize: 13, color: "#8BAFD4", marginTop: 2, margin: 0 }}>Añadir Bitácora a tu pantalla de inicio</p>
          </div>
          <button onClick={async () => { await pwaPrompt.prompt(); setPwaPrompt(null); }}
            style={{ background: C.teal, color: "#fff", borderRadius: 8, padding: "8px 14px", fontFamily: F.mono, fontSize: 11, whiteSpace: "nowrap" }}>
            INSTALAR
          </button>
          <button onClick={() => { localStorage.setItem("pwa_dismissed", "1"); setPwaDismissed(true); setPwaPrompt(null); }}
            style={{ color: "#8BAFD4", padding: 4 }}><X size={16} /></button>
        </div>
      )}

      <PrintExport code={session.code} trip={trip} />
    </div>
  );
}

