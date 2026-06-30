"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Plane,
  MapPin,
  Camera,
  ListChecks,
  Compass,
  Copy,
  Check,
  Plus,
  Trash2,
  X,
  ArrowLeft,
  Users,
  Euro,
  AlertCircle,
  ChevronDown,
  ExternalLink,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Trip {
  name: string;
  destination: string;
  startDate: string | null;
  endDate: string | null;
  members: string[];
  createdAt: number;
}

interface Session {
  code: string;
  name: string;
}

interface ItineraryDay {
  id: string;
  date: string;
  title: string;
  items: ItineraryItem[];
}

interface ItineraryItem {
  id: string;
  time: string;
  text: string;
}

interface MapPlace {
  id: string;
  name: string;
  lat: number;
  lon: number;
  note: string;
}

interface Photo {
  id: string;
  url: string;
  caption: string;
  author: string;
  addedAt: number;
}

interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  cost: number;
  by: string;
  addedAt: number;
}

// ─── Design tokens ──────────────────────────────────────────────────────────

const C = {
  paper: "#F4EFE2",
  paperDark: "#EAE1CB",
  ink: "#1E2A3A",
  inkSoft: "#5B6472",
  navy: "#16223A",
  red: "#BD4332",
  teal: "#3F7A78",
  gold: "#B8893F",
  line: "#C9BD9F",
  green: "#2D7A3F",
} as const;

const F = {
  display: "var(--font-display), Georgia, serif",
  mono: "var(--font-mono), 'Courier New', monospace",
  body: "var(--font-body), system-ui, sans-serif",
} as const;

// ─── Utilities ──────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

function genTripCode(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const nums = "23456789";
  let code = "";
  for (let i = 0; i < 3; i++) code += letters[Math.floor(Math.random() * letters.length)];
  code += "-";
  for (let i = 0; i < 3; i++) code += nums[Math.floor(Math.random() * nums.length)];
  return code;
}

// Equirectangular projection: lon/lat → % coords on 100×70 SVG viewBox
function project(lon: number, lat: number) {
  const x = Math.max(0, Math.min(100, ((lon + 180) / 360) * 100));
  const y = Math.max(0, Math.min(70, ((90 - lat) / 180) * 70));
  return { x, y };
}

function formatDate(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateFull(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function tripDuration(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const ms = new Date(end + "T12:00:00").getTime() - new Date(start + "T12:00:00").getTime();
  return Math.round(ms / 86_400_000) + 1;
}

function isValidUrl(s: string): boolean {
  try {
    const url = new URL(s);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

// ─── Storage (localStorage, async-shaped for easy backend swap) ─────────────

async function loadShared<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function saveShared(key: string, value: unknown): Promise<boolean> {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error("storage write error", e);
    return false;
  }
}

async function loadPersonal<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = localStorage.getItem(`_p:${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function savePersonal(key: string, value: unknown): Promise<void> {
  try {
    localStorage.setItem(`_p:${key}`, JSON.stringify(value));
  } catch (e) {
    console.error("storage write error", e);
  }
}

// ─── Small shared components ─────────────────────────────────────────────────

function Perf() {
  return (
    <div className="flex items-center gap-1 py-2" aria-hidden>
      {Array.from({ length: 40 }).map((_, i) => (
        <div
          key={i}
          style={{ width: 4, height: 4, borderRadius: 999, background: C.line, flexShrink: 0 }}
        />
      ))}
    </div>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={className}
      style={{
        background: "#fff",
        border: `1px solid ${C.line}`,
        borderRadius: 6,
        padding: 18,
      }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <span
      style={{ fontFamily: F.mono, fontSize: 11, color: C.inkSoft, letterSpacing: 1 }}
    >
      {children.toUpperCase()}
    </span>
  );
}

const inputStyle: React.CSSProperties = {
  border: `1px solid ${C.line}`,
  borderRadius: 4,
  padding: "9px 11px",
  fontSize: 14,
  fontFamily: F.body,
  color: C.ink,
  background: "#FCFAF4",
  width: "100%",
  transition: "border-color 0.15s",
};

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1 flex-1">
      <span style={{ fontSize: 11, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 0.5 }}>
        {label.toUpperCase()}
      </span>
      {children}
      {hint && <span style={{ fontSize: 11, color: C.inkSoft }}>{hint}</span>}
    </label>
  );
}

function Banner({ type, msg }: { type: "error" | "success"; msg: string }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded"
      style={{
        background: type === "error" ? "#FEF2F2" : "#F0FDF4",
        border: `1px solid ${type === "error" ? "#FECACA" : "#BBF7D0"}`,
        color: type === "error" ? C.red : C.green,
        fontSize: 13,
      }}
    >
      <AlertCircle size={14} />
      {msg}
    </div>
  );
}

// ─── Countdown hook ───────────────────────────────────────────────────────────

function useCountdown(dateStr: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  if (!dateStr) return null;
  const target = new Date(dateStr + "T00:00:00").getTime();
  return Math.ceil((target - now) / 86_400_000);
}

// ─── Entry screen ─────────────────────────────────────────────────────────────

function EntryScreen({
  onEnter,
  externalError,
}: {
  onEnter: (code: string, name: string) => Promise<void>;
  externalError: string;
}) {
  const [mode, setMode] = useState<"join" | "create">("join");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [tripName, setTripName] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, [mode]);

  async function handleJoin() {
    if (!name.trim()) { setError("Escribe tu nombre."); return; }
    if (!code.trim()) { setError("Escribe el código del viaje."); return; }
    setBusy(true);
    setError("");
    const normalized = code.trim().toUpperCase().replace(/\s/g, "");
    const trip = await loadShared<Trip | null>(`trip:${normalized}`, null);
    if (!trip) {
      setError("No existe ningún viaje con ese código. Revísalo o crea uno nuevo.");
      setBusy(false);
      return;
    }
    await onEnter(normalized, name.trim());
    setBusy(false);
  }

  async function handleCreate() {
    if (!name.trim()) { setError("Escribe tu nombre."); return; }
    if (!tripName.trim()) { setError("Escribe el nombre del viaje."); return; }
    if (startDate && endDate && endDate < startDate) {
      setError("La fecha de fin debe ser posterior a la de inicio.");
      return;
    }
    setBusy(true);
    setError("");

    let newCode = genTripCode();
    let tries = 0;
    while ((await loadShared<Trip | null>(`trip:${newCode}`, null)) !== null && tries < 10) {
      newCode = genTripCode();
      tries++;
    }

    const trip: Trip = {
      name: tripName.trim(),
      destination: destination.trim(),
      startDate: startDate || null,
      endDate: endDate || null,
      members: [],
      createdAt: Date.now(),
    };

    const ok = await saveShared(`trip:${newCode}`, trip);
    if (!ok) {
      setError("No se pudo guardar el viaje. Inténtalo de nuevo.");
      setBusy(false);
      return;
    }
    await onEnter(newCode, name.trim());
    setBusy(false);
  }

  const isJoin = mode === "join";

  return (
    <div
      style={{ background: C.paper, fontFamily: F.body, color: C.ink, minHeight: "100dvh" }}
      className="flex items-center justify-center px-4 py-10"
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center mb-3"
            style={{ width: 52, height: 52, borderRadius: 999, background: C.navy }}
          >
            <Plane size={24} color={C.paper} strokeWidth={1.75} />
          </div>
          <h1 style={{ fontFamily: F.display, fontSize: 34, fontWeight: 700, color: C.navy, letterSpacing: -0.5 }}>
            Bitácora de Viaje
          </h1>
          <p style={{ color: C.inkSoft, fontSize: 14, marginTop: 4 }}>
            Itinerarios, fotos y cuentas atrás compartidas con tu gente.
          </p>
        </div>

        {/* Card */}
        <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 6 }} className="overflow-hidden shadow-sm">
          {/* Tabs */}
          <div className="flex" style={{ borderBottom: `1px solid ${C.line}` }}>
            {([["join", "Unirme"], ["create", "Crear viaje"]] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => { setMode(k); setError(""); }}
                style={{
                  flex: 1,
                  padding: "13px 8px",
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: F.mono,
                  letterSpacing: 0.5,
                  color: mode === k ? C.navy : C.inkSoft,
                  background: mode === k ? C.paperDark : "transparent",
                  borderBottom: mode === k ? `2px solid ${C.red}` : "2px solid transparent",
                  transition: "all 0.15s",
                }}
              >
                {label.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="p-5 flex flex-col gap-3">
            <Field label="Tu nombre">
              <input
                ref={nameRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (isJoin ? handleJoin() : handleCreate())}
                placeholder="Ej. Lucas"
                style={inputStyle}
                autoComplete="given-name"
              />
            </Field>

            {isJoin ? (
              <Field label="Código del viaje" hint="Pídelo al organizador del viaje">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  placeholder="Ej. ABC-234"
                  maxLength={7}
                  style={{ ...inputStyle, fontFamily: F.mono, letterSpacing: 2, textTransform: "uppercase" }}
                />
              </Field>
            ) : (
              <>
                <Field label="Nombre del viaje">
                  <input
                    value={tripName}
                    onChange={(e) => setTripName(e.target.value)}
                    placeholder="Ej. Grecia 2027"
                    style={inputStyle}
                  />
                </Field>
                <Field label="Destino principal (opcional)">
                  <input
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="Ej. Atenas, Grecia"
                    style={inputStyle}
                  />
                </Field>
                <div className="flex gap-3">
                  <Field label="Inicio">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Fin">
                    <input
                      type="date"
                      value={endDate}
                      min={startDate || undefined}
                      onChange={(e) => setEndDate(e.target.value)}
                      style={inputStyle}
                    />
                  </Field>
                </div>
              </>
            )}

            {(error || externalError) && (
              <Banner type="error" msg={error || externalError} />
            )}

            <button
              disabled={busy}
              onClick={isJoin ? handleJoin : handleCreate}
              style={{
                marginTop: 4,
                background: busy ? C.inkSoft : C.navy,
                color: C.paper,
                fontFamily: F.mono,
                fontWeight: 600,
                fontSize: 13,
                letterSpacing: 0.5,
                padding: "13px 16px",
                borderRadius: 4,
                transition: "background 0.15s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              {busy ? (
                "UN MOMENTO…"
              ) : isJoin ? (
                "ENTRAR AL VIAJE →"
              ) : (
                "CREAR VIAJE →"
              )}
            </button>
          </div>
        </div>

        <p style={{ color: C.inkSoft, fontSize: 12, textAlign: "center", marginTop: 16 }}>
          Sin contraseñas · Comparte el código con quien quieras sumar al viaje
        </p>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

type TabId = "resumen" | "itinerario" | "mapa" | "fotos" | "checklist";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [tab, setTab] = useState<TabId>("resumen");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [entryError, setEntryError] = useState("");

  // Restore previous session
  useEffect(() => {
    (async () => {
      const last = await loadPersonal<Session | null>("lastSession", null);
      if (last?.code && last?.name) {
        const t = await loadShared<Trip | null>(`trip:${last.code}`, null);
        if (t) {
          setSession(last);
          setTrip(t);
        }
      }
      setLoading(false);
    })();
  }, []);

  async function enter(code: string, name: string) {
    setLoading(true);
    setEntryError("");
    const t = await loadShared<Trip | null>(`trip:${code}`, null);
    if (!t) {
      setLoading(false);
      setEntryError("No se pudo cargar el viaje. Inténtalo de nuevo.");
      return;
    }
    // Add member if not already present (case-insensitive dedup)
    const already = t.members.some((m) => m.toLowerCase() === name.toLowerCase());
    if (!already) {
      t.members = [...t.members, name];
      await saveShared(`trip:${code}`, t);
    }
    await savePersonal("lastSession", { code, name });
    setSession({ code, name });
    setTrip(t);
    setLoading(false);
  }

  function leave() {
    setSession(null);
    setTrip(null);
    setTab("resumen");
  }

  const days = useCountdown(trip?.startDate ?? null);

  // ── Loading ──
  if (loading) {
    return (
      <div
        style={{ background: C.paper, minHeight: "100dvh", fontFamily: F.body }}
        className="flex items-center justify-center"
      >
        <div className="flex flex-col items-center gap-3">
          <Plane size={28} color={C.gold} strokeWidth={1.5} />
          <p style={{ fontFamily: F.mono, color: C.inkSoft, fontSize: 13 }}>cargando…</p>
        </div>
      </div>
    );
  }

  // ── Entry ──
  if (!session || !trip) {
    return <EntryScreen onEnter={enter} externalError={entryError} />;
  }

  // ── App shell ──
  const tabs: { id: TabId; label: string; Icon: React.ElementType }[] = [
    { id: "resumen", label: "Resumen", Icon: Compass },
    { id: "itinerario", label: "Itinerario", Icon: Plane },
    { id: "mapa", label: "Mapa", Icon: MapPin },
    { id: "fotos", label: "Fotos", Icon: Camera },
    { id: "checklist", label: "Checklist", Icon: ListChecks },
  ];

  return (
    <div style={{ background: C.paper, fontFamily: F.body, color: C.ink, minHeight: "100dvh" }}>
      {/* Header / boarding pass */}
      <header style={{ background: C.navy, color: C.paper }}>
        <div className="max-w-3xl mx-auto px-4 pt-5 pb-0">
          <button
            onClick={leave}
            className="flex items-center gap-1 mb-4"
            style={{ color: "#9FAEC4", fontSize: 12, fontFamily: F.mono }}
          >
            <ArrowLeft size={13} /> CAMBIAR DE VIAJE
          </button>

          <div className="flex items-start justify-between flex-wrap gap-4 pb-5">
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontFamily: F.mono, fontSize: 11, color: C.gold, letterSpacing: 1.5 }}>
                TARJETA DE EMBARQUE
              </span>
              <h1
                style={{ fontFamily: F.display, fontSize: 30, fontWeight: 700, marginTop: 2, lineHeight: 1.15 }}
                className="truncate"
              >
                {trip.name}
              </h1>
              {trip.destination && (
                <p className="flex items-center gap-1 mt-1" style={{ color: "#B9C3D6", fontSize: 14 }}>
                  <MapPin size={13} />
                  {trip.destination}
                </p>
              )}
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              {/* Copy code button */}
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(session.code).catch(() => {});
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                }}
                className="flex items-center gap-2"
                style={{
                  border: "1px solid #3A4A68",
                  borderRadius: 4,
                  padding: "7px 12px",
                  fontFamily: F.mono,
                  fontSize: 13,
                  letterSpacing: 1.5,
                  background: "#1F2D49",
                  color: copied ? C.gold : C.paper,
                  transition: "color 0.2s",
                }}
                title="Copiar código del viaje"
                aria-label="Copiar código del viaje"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {session.code}
              </button>

              {/* Countdown */}
              {days !== null && (
                <div className="text-right">
                  <div style={{ fontFamily: F.display, fontSize: 30, fontWeight: 700, color: C.gold, lineHeight: 1 }}>
                    {days > 0 ? days : days === 0 ? "✈" : "🌍"}
                  </div>
                  <div style={{ fontFamily: F.mono, fontSize: 10, color: "#9FAEC4", letterSpacing: 1 }}>
                    {days > 0 ? "DÍAS RESTANTES" : days === 0 ? "¡ES HOY!" : "EN CURSO / PASADO"}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tab bar */}
          <nav
            className="flex gap-0 no-scrollbar"
            style={{ borderTop: "1px dashed #3A4A68", overflowX: "auto" }}
          >
            {tabs.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="flex items-center gap-1.5 px-4 py-3 whitespace-nowrap"
                style={{
                  fontFamily: F.mono,
                  fontSize: 12,
                  letterSpacing: 0.4,
                  color: tab === id ? C.paper : "#7C8AA3",
                  borderBottom: tab === id ? `2px solid ${C.gold}` : "2px solid transparent",
                  transition: "color 0.15s",
                }}
                aria-current={tab === id ? "page" : undefined}
              >
                <Icon size={13} />
                {label.toUpperCase()}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Tab content */}
      <main className="max-w-3xl mx-auto px-4 py-6 fade-in" key={tab}>
        {tab === "resumen"    && <Resumen trip={trip} session={session} />}
        {tab === "itinerario" && <Itinerario code={session.code} />}
        {tab === "mapa"       && <Mapa code={session.code} />}
        {tab === "fotos"      && <Fotos code={session.code} session={session} />}
        {tab === "checklist"  && <Checklist code={session.code} session={session} />}
      </main>
    </div>
  );
}

// ─── Resumen ──────────────────────────────────────────────────────────────────

function Resumen({ trip, session }: { trip: Trip; session: Session }) {
  const duration = tripDuration(trip.startDate, trip.endDate);

  return (
    <div className="flex flex-col gap-5">
      {/* Crew */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <SectionLabel>Tripulación</SectionLabel>
          <span
            style={{
              fontFamily: F.mono,
              fontSize: 11,
              background: C.paperDark,
              color: C.inkSoft,
              borderRadius: 999,
              padding: "1px 7px",
            }}
          >
            {trip.members.length}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {trip.members.map((m) => {
            const isMe = m.toLowerCase() === session.name.toLowerCase();
            return (
              <div
                key={m}
                className="flex items-center gap-2 px-3 py-1.5"
                style={{
                  background: isMe ? C.navy : C.paperDark,
                  borderRadius: 999,
                  fontSize: 13,
                  color: isMe ? C.paper : C.ink,
                  fontWeight: isMe ? 600 : 400,
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    background: isMe ? C.red : C.teal,
                    color: "#fff",
                    fontSize: 11,
                    fontFamily: F.mono,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 600,
                  }}
                >
                  {m[0]?.toUpperCase()}
                </div>
                {m}
                {isMe && (
                  <span style={{ fontSize: 10, color: C.gold, fontFamily: F.mono }}>TÚ</span>
                )}
              </div>
            );
          })}
          {trip.members.length === 0 && (
            <p style={{ color: C.inkSoft, fontSize: 13 }}>Aún no hay miembros.</p>
          )}
        </div>
      </Card>

      {/* Dates */}
      <Card>
        <SectionLabel>Fechas</SectionLabel>
        <div className="mt-3 flex flex-wrap gap-4">
          {trip.startDate ? (
            <div>
              <div style={{ fontSize: 11, fontFamily: F.mono, color: C.inkSoft, marginBottom: 2 }}>SALIDA</div>
              <div style={{ fontFamily: F.display, fontSize: 18, fontWeight: 700 }}>
                {formatDate(trip.startDate)}
              </div>
            </div>
          ) : (
            <p style={{ color: C.inkSoft, fontSize: 13 }}>Sin fecha de inicio</p>
          )}
          {trip.endDate && (
            <>
              <div style={{ color: C.line, fontSize: 20, alignSelf: "flex-end", paddingBottom: 2 }}>→</div>
              <div>
                <div style={{ fontSize: 11, fontFamily: F.mono, color: C.inkSoft, marginBottom: 2 }}>VUELTA</div>
                <div style={{ fontFamily: F.display, fontSize: 18, fontWeight: 700 }}>
                  {formatDate(trip.endDate)}
                </div>
              </div>
            </>
          )}
        </div>
        {duration !== null && (
          <p style={{ marginTop: 10, fontSize: 13, color: C.inkSoft }}>
            Duración: <strong style={{ color: C.ink }}>{duration} día{duration !== 1 ? "s" : ""}</strong>
          </p>
        )}
      </Card>

      {/* Help */}
      <div
        style={{
          border: `1px dashed ${C.line}`,
          borderRadius: 6,
          padding: "14px 16px",
        }}
      >
        <p style={{ color: C.inkSoft, fontSize: 13, lineHeight: 1.6 }}>
          Usa las pestañas de arriba para montar el{" "}
          <strong style={{ color: C.ink }}>itinerario</strong> día a día, marcar los{" "}
          <strong style={{ color: C.ink }}>destinos</strong> en el mapa, compartir{" "}
          <strong style={{ color: C.ink }}>fotos</strong> del viaje y llevar el{" "}
          <strong style={{ color: C.ink }}>presupuesto</strong> en el checklist.
        </p>
      </div>
    </div>
  );
}

// ─── Itinerario ───────────────────────────────────────────────────────────────

function Itinerario({ code }: { code: string }) {
  const [days, setDays] = useState<ItineraryDay[]>([]);
  const [loading, setLoading] = useState(true);
  const key = `itin:${code}`;

  useEffect(() => {
    loadShared<ItineraryDay[]>(key, []).then((d) => {
      setDays(d);
      setLoading(false);
    });
  }, [key]);

  const persist = useCallback(
    async (next: ItineraryDay[]) => {
      setDays(next);
      await saveShared(key, next);
    },
    [key]
  );

  function addDay() {
    persist([
      ...days,
      { id: uid(), date: "", title: `Día ${days.length + 1}`, items: [] },
    ]);
  }

  function removeDay(dayId: string) {
    persist(days.filter((d) => d.id !== dayId));
  }

  function updateDay(dayId: string, patch: Partial<ItineraryDay>) {
    persist(days.map((d) => (d.id === dayId ? { ...d, ...patch } : d)));
  }

  function addItem(dayId: string) {
    persist(
      days.map((d) =>
        d.id === dayId
          ? { ...d, items: [...d.items, { id: uid(), time: "", text: "" }] }
          : d
      )
    );
  }

  function updateItem(dayId: string, itemId: string, patch: Partial<ItineraryItem>) {
    persist(
      days.map((d) =>
        d.id === dayId
          ? { ...d, items: d.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) }
          : d
      )
    );
  }

  function removeItem(dayId: string, itemId: string) {
    persist(
      days.map((d) =>
        d.id === dayId
          ? { ...d, items: d.items.filter((it) => it.id !== itemId) }
          : d
      )
    );
  }

  if (loading) return <SkeletonCards />;

  return (
    <div className="flex flex-col gap-4">
      {days.map((d) => (
        <Card key={d.id}>
          <div className="flex items-start gap-3">
            <div className="flex-1 flex flex-col gap-2">
              <input
                value={d.title}
                onChange={(e) => updateDay(d.id, { title: e.target.value })}
                style={{
                  ...inputStyle,
                  fontFamily: F.display,
                  fontWeight: 700,
                  fontSize: 20,
                  border: "none",
                  padding: 0,
                  background: "transparent",
                }}
                placeholder="Título del día"
              />
              {d.date && (
                <p style={{ fontFamily: F.mono, fontSize: 11, color: C.gold, letterSpacing: 0.5 }}>
                  {formatDateFull(d.date)}
                </p>
              )}
              <input
                type="date"
                value={d.date}
                onChange={(e) => updateDay(d.id, { date: e.target.value })}
                style={{ ...inputStyle, width: 170, fontSize: 13 }}
              />
            </div>
            <button
              onClick={() => removeDay(d.id)}
              style={{ color: C.inkSoft, padding: 4 }}
              title="Eliminar día"
              aria-label="Eliminar día"
            >
              <Trash2 size={15} />
            </button>
          </div>

          <Perf />

          <div className="flex flex-col gap-2">
            {d.items.map((it) => (
              <div key={it.id} className="flex items-center gap-2">
                <input
                  value={it.time}
                  onChange={(e) => updateItem(d.id, it.id, { time: e.target.value })}
                  placeholder="10:00"
                  maxLength={5}
                  style={{ ...inputStyle, width: 72, fontFamily: F.mono, fontSize: 12 }}
                />
                <input
                  value={it.text}
                  onChange={(e) => updateItem(d.id, it.id, { text: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addItem(d.id);
                  }}
                  placeholder="Visita al Partenón…"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  onClick={() => removeItem(d.id, it.id)}
                  style={{ color: C.inkSoft, padding: 4, flexShrink: 0 }}
                  aria-label="Eliminar parada"
                >
                  <X size={15} />
                </button>
              </div>
            ))}
            {d.items.length === 0 && (
              <p style={{ color: C.inkSoft, fontSize: 13 }}>Sin paradas todavía.</p>
            )}
          </div>

          <button
            onClick={() => addItem(d.id)}
            className="flex items-center gap-1 mt-3"
            style={{ fontFamily: F.mono, fontSize: 12, color: C.teal }}
          >
            <Plus size={13} /> AÑADIR PARADA
          </button>
        </Card>
      ))}

      <button
        onClick={addDay}
        className="flex items-center justify-center gap-2 py-3"
        style={{
          border: `1px dashed ${C.line}`,
          borderRadius: 6,
          color: C.inkSoft,
          fontFamily: F.mono,
          fontSize: 13,
          transition: "background 0.15s",
        }}
        onMouseOver={(e) => (e.currentTarget.style.background = C.paperDark)}
        onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <Plus size={15} /> AÑADIR DÍA
      </button>

      {days.length === 0 && (
        <EmptyState
          icon={<Plane size={28} color={C.line} />}
          text="El itinerario está vacío. Añade el primer día para empezar."
        />
      )}
    </div>
  );
}

// ─── Mapa ─────────────────────────────────────────────────────────────────────

const CONTINENT_BLOBS = [
  "M 8,20 Q 14,14 22,16 Q 30,20 28,30 Q 24,38 16,36 Q 8,30 8,20 Z",
  "M 20,42 Q 27,38 30,48 Q 28,58 24,56 Q 18,50 20,42 Z",
  "M 44,18 Q 54,14 58,22 Q 56,30 50,28 Q 44,26 44,18 Z",
  "M 46,34 Q 56,30 58,46 Q 54,56 48,52 Q 42,44 46,34 Z",
  "M 60,16 Q 78,12 84,24 Q 80,36 68,34 Q 58,26 60,16 Z",
  "M 78,48 Q 88,46 88,54 Q 84,60 80,58 Q 76,52 78,48 Z",
];

function Mapa({ code }: { code: string }) {
  const [places, setPlaces] = useState<MapPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", lat: "", lon: "", note: "" });
  const [active, setActive] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const key = `mapa:${code}`;

  useEffect(() => {
    loadShared<MapPlace[]>(key, []).then((p) => {
      setPlaces(p);
      setLoading(false);
    });
  }, [key]);

  const persist = useCallback(
    async (next: MapPlace[]) => {
      setPlaces(next);
      await saveShared(key, next);
    },
    [key]
  );

  function addPlace() {
    setFormError("");
    if (!form.name.trim()) { setFormError("Escribe un nombre para el destino."); return; }
    const lat = parseFloat(form.lat);
    const lon = parseFloat(form.lon);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      setFormError("Latitud inválida (debe estar entre -90 y 90).");
      return;
    }
    if (isNaN(lon) || lon < -180 || lon > 180) {
      setFormError("Longitud inválida (debe estar entre -180 y 180).");
      return;
    }
    persist([...places, { id: uid(), name: form.name.trim(), lat, lon, note: form.note.trim() }]);
    setForm({ name: "", lat: "", lon: "", note: "" });
  }

  function removePlace(id: string) {
    persist(places.filter((p) => p.id !== id));
    if (active === id) setActive(null);
  }

  if (loading) return <SkeletonCards />;

  const activePlace = places.find((p) => p.id === active);

  return (
    <div className="flex flex-col gap-4">
      {/* Add form */}
      <Card>
        <SectionLabel>Añadir destino</SectionLabel>
        <p style={{ color: C.inkSoft, fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
          Busca &ldquo;lat long [ciudad]&rdquo; en Google si no sabes las coordenadas.
          Ej: Atenas → lat 37.97, lon 23.72
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <div style={{ flex: "2 1 140px" }}>
            <input
              placeholder="Nombre (Atenas)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              style={inputStyle}
            />
          </div>
          <div style={{ width: 90 }}>
            <input
              placeholder="Lat"
              value={form.lat}
              onChange={(e) => setForm({ ...form, lat: e.target.value })}
              style={{ ...inputStyle, fontFamily: F.mono, fontSize: 12 }}
            />
          </div>
          <div style={{ width: 90 }}>
            <input
              placeholder="Lon"
              value={form.lon}
              onChange={(e) => setForm({ ...form, lon: e.target.value })}
              style={{ ...inputStyle, fontFamily: F.mono, fontSize: 12 }}
            />
          </div>
          <div style={{ flex: "2 1 140px" }}>
            <input
              placeholder="Nota (opcional)"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && addPlace()}
              style={inputStyle}
            />
          </div>
          <button
            onClick={addPlace}
            style={{
              background: C.navy,
              color: C.paper,
              borderRadius: 4,
              padding: "0 18px",
              fontFamily: F.mono,
              fontSize: 12,
              height: 39,
              whiteSpace: "nowrap",
            }}
          >
            AÑADIR
          </button>
        </div>
        {formError && <Banner type="error" msg={formError} />}
      </Card>

      {/* Map */}
      <Card>
        <div
          style={{
            position: "relative",
            width: "100%",
            paddingBottom: "50%",
            background: "#D8E8E6",
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          <svg
            viewBox="0 0 100 70"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          >
            {CONTINENT_BLOBS.map((d, i) => (
              <path key={i} d={d} fill={C.teal} opacity={0.22} />
            ))}
            {places.map((p) => {
              const { x, y } = project(p.lon, p.lat);
              const isActive = active === p.id;
              return (
                <g key={p.id} onClick={() => setActive(isActive ? null : p.id)} style={{ cursor: "pointer" }}>
                  <circle cx={x} cy={y} r={isActive ? 2.8 : 2} fill={isActive ? C.gold : C.red} stroke="#fff" strokeWidth={0.5} />
                  {isActive && (
                    <text
                      x={x + 3}
                      y={y + 1}
                      fontSize={4}
                      fill={C.navy}
                      fontFamily={F.mono}
                    >
                      {p.name.slice(0, 14)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {activePlace && (
          <div
            className="mt-3 p-3 rounded"
            style={{ background: C.paperDark, fontSize: 13 }}
          >
            <strong>{activePlace.name}</strong>
            {activePlace.note && <span style={{ color: C.inkSoft }}> — {activePlace.note}</span>}
            <span style={{ fontFamily: F.mono, fontSize: 11, color: C.inkSoft, marginLeft: 8 }}>
              {activePlace.lat.toFixed(2)}, {activePlace.lon.toFixed(2)}
            </span>
          </div>
        )}

        <p style={{ color: C.inkSoft, fontSize: 11, marginTop: 8 }}>
          Mapa esquemático · haz clic en un pin para ver el detalle
        </p>
      </Card>

      {/* Place list */}
      <div className="flex flex-col gap-2">
        {places.map((p) => (
          <div
            key={p.id}
            onClick={() => setActive(p.id === active ? null : p.id)}
            className="flex items-center justify-between px-3 py-2"
            style={{
              background: active === p.id ? C.paperDark : "#fff",
              border: `1px solid ${C.line}`,
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            <div>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</span>
              {p.note && <span style={{ color: C.inkSoft, fontSize: 13 }}> — {p.note}</span>}
              <span style={{ fontFamily: F.mono, fontSize: 11, color: C.inkSoft, marginLeft: 8 }}>
                {p.lat.toFixed(2)}, {p.lon.toFixed(2)}
              </span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); removePlace(p.id); }}
              style={{ color: C.inkSoft, padding: 4 }}
              aria-label={`Eliminar ${p.name}`}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {places.length === 0 && (
          <EmptyState
            icon={<MapPin size={28} color={C.line} />}
            text="Aún no hay destinos. Añade el primero arriba."
          />
        )}
      </div>
    </div>
  );
}

// ─── Fotos ────────────────────────────────────────────────────────────────────

function Fotos({ code, session }: { code: string; session: Session }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ url: "", caption: "" });
  const [formError, setFormError] = useState("");
  const [lightbox, setLightbox] = useState<Photo | null>(null);
  const key = `fotos:${code}`;

  useEffect(() => {
    loadShared<Photo[]>(key, []).then((p) => {
      setPhotos(p);
      setLoading(false);
    });
  }, [key]);

  const persist = useCallback(
    async (next: Photo[]) => {
      setPhotos(next);
      await saveShared(key, next);
    },
    [key]
  );

  function addPhoto() {
    setFormError("");
    const url = form.url.trim();
    if (!url) { setFormError("Pega una URL de imagen."); return; }
    if (!isValidUrl(url)) { setFormError("La URL no es válida. Debe empezar por https:// o http://"); return; }
    persist([
      { id: uid(), url, caption: form.caption.trim(), author: session.name, addedAt: Date.now() },
      ...photos,
    ]);
    setForm({ url: "", caption: "" });
  }

  if (loading) return <SkeletonCards />;

  return (
    <>
      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", maxWidth: 700, width: "100%" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.url}
              alt={lightbox.caption}
              style={{ width: "100%", borderRadius: 6, maxHeight: "80vh", objectFit: "contain" }}
            />
            {lightbox.caption && (
              <p style={{ color: "#fff", fontSize: 14, marginTop: 10, textAlign: "center" }}>
                {lightbox.caption}
              </p>
            )}
            <button
              onClick={() => setLightbox(null)}
              style={{
                position: "absolute",
                top: -16,
                right: -16,
                background: C.navy,
                color: "#fff",
                borderRadius: 999,
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {/* Add form */}
        <Card>
          <SectionLabel>Añadir recuerdo</SectionLabel>
          <p style={{ color: C.inkSoft, fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
            Pega la URL de una foto (Google Fotos, Imgur, etc. en modo público). La URL debe ser
            directa a la imagen.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <input
              placeholder="https://…"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              style={{ ...inputStyle, flex: "2 1 180px" }}
            />
            <input
              placeholder="Pie de foto (opcional)"
              value={form.caption}
              onChange={(e) => setForm({ ...form, caption: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && addPhoto()}
              style={{ ...inputStyle, flex: "1 1 120px" }}
            />
            <button
              onClick={addPhoto}
              style={{
                background: C.navy,
                color: C.paper,
                borderRadius: 4,
                padding: "0 18px",
                fontFamily: F.mono,
                fontSize: 12,
                height: 39,
              }}
            >
              AÑADIR
            </button>
          </div>
          {formError && <Banner type="error" msg={formError} />}
        </Card>

        {/* Gallery */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map((p) => (
            <div
              key={p.id}
              style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 6, padding: 8 }}
            >
              <div
                onClick={() => setLightbox(p)}
                style={{
                  width: "100%",
                  paddingBottom: "100%",
                  position: "relative",
                  background: C.paperDark,
                  borderRadius: 4,
                  overflow: "hidden",
                  cursor: "zoom-in",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={p.caption}
                  loading="lazy"
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
              {p.caption && (
                <p style={{ fontSize: 12, marginTop: 6, color: C.ink, lineHeight: 1.4 }}>{p.caption}</p>
              )}
              <div className="flex items-center justify-between mt-1">
                <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkSoft }}>{p.author}</span>
                <button
                  onClick={() => photos.filter((x) => x.id !== p.id).length >= 0 && persist(photos.filter((x) => x.id !== p.id))}
                  style={{ color: C.inkSoft, padding: 2 }}
                  aria-label="Eliminar foto"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {photos.length === 0 && (
          <EmptyState
            icon={<Camera size={28} color={C.line} />}
            text="Aún no hay fotos. ¡Sé el primero en añadir un recuerdo!"
          />
        )}
      </div>
    </>
  );
}

// ─── Checklist / Presupuesto ──────────────────────────────────────────────────

function Checklist({ code, session }: { code: string; session: Session }) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [cost, setCost] = useState("");
  const [showBreakdown, setShowBreakdown] = useState(false);
  const key = `checklist:${code}`;

  useEffect(() => {
    loadShared<ChecklistItem[]>(key, []).then((it) => {
      setItems(it);
      setLoading(false);
    });
  }, [key]);

  const persist = useCallback(
    async (next: ChecklistItem[]) => {
      setItems(next);
      await saveShared(key, next);
    },
    [key]
  );

  function addItem() {
    if (!text.trim()) return;
    const parsedCost = parseFloat(cost.replace(",", "."));
    persist([
      ...items,
      {
        id: uid(),
        text: text.trim(),
        done: false,
        cost: isNaN(parsedCost) || parsedCost < 0 ? 0 : parsedCost,
        by: session.name,
        addedAt: Date.now(),
      },
    ]);
    setText("");
    setCost("");
  }

  function toggle(id: string) {
    persist(items.map((it) => (it.id === id ? { ...it, done: !it.done } : it)));
  }

  function remove(id: string) {
    persist(items.filter((it) => it.id !== id));
  }

  const total = useMemo(() => items.reduce((s, it) => s + (it.cost || 0), 0), [items]);
  const totalDone = useMemo(
    () => items.filter((it) => it.done).reduce((s, it) => s + (it.cost || 0), 0),
    [items]
  );

  // Per-member breakdown
  const breakdown = useMemo(() => {
    const map: Record<string, { total: number; done: number }> = {};
    for (const it of items) {
      if (!map[it.by]) map[it.by] = { total: 0, done: 0 };
      map[it.by].total += it.cost || 0;
      if (it.done) map[it.by].done += it.cost || 0;
    }
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [items]);

  if (loading) return <SkeletonCards />;

  const pct = total > 0 ? (totalDone / total) * 100 : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Add row */}
      <Card>
        <div className="flex flex-wrap gap-2">
          <input
            placeholder="Reservar vuelos, alquiler de coche…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
            style={{ ...inputStyle, flex: "2 1 160px" }}
          />
          <div className="relative" style={{ width: 96 }}>
            <input
              placeholder="0,00"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addItem()}
              style={{ ...inputStyle, fontFamily: F.mono, paddingRight: 22 }}
            />
            <Euro size={11} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: C.inkSoft }} />
          </div>
          <button
            onClick={addItem}
            style={{
              background: C.navy,
              color: C.paper,
              borderRadius: 4,
              padding: "0 18px",
              fontFamily: F.mono,
              fontSize: 12,
              height: 39,
            }}
          >
            AÑADIR
          </button>
        </div>
      </Card>

      {/* Budget summary */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <SectionLabel>Presupuesto</SectionLabel>
          <span style={{ fontFamily: F.mono, fontSize: 13, color: C.inkSoft }}>
            {totalDone.toFixed(2)} € / {total.toFixed(2)} €
          </span>
        </div>
        <div style={{ background: C.paperDark, height: 8, borderRadius: 999, overflow: "hidden" }}>
          <div
            style={{
              background: C.teal,
              height: "100%",
              width: `${pct}%`,
              borderRadius: 999,
              transition: "width 0.4s ease",
            }}
          />
        </div>
        <p style={{ fontSize: 12, color: C.inkSoft, marginTop: 6 }}>
          {pct.toFixed(0)}% pagado
          {items.filter((it) => it.done).length > 0 &&
            ` · ${items.filter((it) => it.done).length} de ${items.length} tareas completadas`}
        </p>

        {/* Per-member breakdown */}
        {breakdown.length > 0 && (
          <>
            <button
              onClick={() => setShowBreakdown((v) => !v)}
              className="flex items-center gap-1 mt-3"
              style={{ fontFamily: F.mono, fontSize: 11, color: C.inkSoft }}
            >
              <ChevronDown
                size={13}
                style={{ transform: showBreakdown ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
              />
              DESGLOSE POR PERSONA
            </button>
            {showBreakdown && (
              <div className="flex flex-col gap-2 mt-3">
                {breakdown.map(([person, data]) => (
                  <div key={person} className="flex items-center gap-3">
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 999,
                        background: person.toLowerCase() === session.name.toLowerCase() ? C.red : C.teal,
                        color: "#fff",
                        fontSize: 11,
                        fontFamily: F.mono,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {person[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between" style={{ fontSize: 13 }}>
                        <span>{person}</span>
                        <span style={{ fontFamily: F.mono, fontSize: 12 }}>
                          {data.done.toFixed(2)} / {data.total.toFixed(2)} €
                        </span>
                      </div>
                      <div style={{ background: C.paperDark, height: 4, borderRadius: 999, marginTop: 3, overflow: "hidden" }}>
                        <div
                          style={{
                            background: C.teal,
                            height: "100%",
                            width: data.total > 0 ? `${(data.done / data.total) * 100}%` : "0%",
                            borderRadius: 999,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Card>

      {/* Item list */}
      <div className="flex flex-col gap-2">
        {items.map((it) => (
          <div
            key={it.id}
            className="flex items-center gap-3 px-3 py-2"
            style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 4 }}
          >
            <button onClick={() => toggle(it.id)} style={{ flexShrink: 0 }} aria-label={it.done ? "Marcar pendiente" : "Marcar completado"}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 5,
                  border: `1.5px solid ${it.done ? C.teal : C.line}`,
                  background: it.done ? C.teal : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.15s",
                }}
              >
                {it.done && <Check size={13} color="#fff" strokeWidth={2.5} />}
              </div>
            </button>
            <div className="flex-1 min-w-0">
              <span
                style={{
                  fontSize: 14,
                  textDecoration: it.done ? "line-through" : "none",
                  color: it.done ? C.inkSoft : C.ink,
                  transition: "color 0.15s",
                }}
              >
                {it.text}
              </span>
              <div style={{ fontFamily: F.mono, fontSize: 11, color: C.inkSoft, marginTop: 1 }}>
                {it.cost > 0 ? `${it.cost.toFixed(2)} € · ` : ""}
                {it.by}
              </div>
            </div>
            <button onClick={() => remove(it.id)} style={{ color: C.inkSoft, padding: 4, flexShrink: 0 }} aria-label="Eliminar tarea">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <EmptyState
            icon={<ListChecks size={28} color={C.line} />}
            text="Lista vacía — añade la primera tarea o gasto."
          />
        )}
      </div>
    </div>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div
      className="flex flex-col items-center gap-3 py-10"
      style={{ color: C.inkSoft, fontSize: 13, textAlign: "center" }}
    >
      {icon}
      <p style={{ maxWidth: 260 }}>{text}</p>
    </div>
  );
}

function SkeletonCards() {
  return (
    <div className="flex flex-col gap-4">
      {[100, 140, 80].map((h, i) => (
        <div key={i} className="skeleton" style={{ height: h, borderRadius: 6 }} />
      ))}
    </div>
  );
}
