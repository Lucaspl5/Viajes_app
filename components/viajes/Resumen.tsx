"use client";

import { useState, useEffect, useRef } from "react";
import { Camera, X, Edit2, Copy, Check, PlusSquare, Bell, BellOff } from "lucide-react";
import { animate, spring } from "animejs";
import { C, F, inputStyle } from "./theme";
import { useAnimeStagger } from "./animation";
import { Card, SectionLabel } from "./ui";
import { formatDate, tripDuration, loadShared, saveShared } from "./utils";
import type { Trip, Session } from "./types";
import { WeatherWidget } from "./WeatherWidget";
import { InvitePanel } from "./InvitePanel";
import { isPremium } from "./premium";
import { PremiumGate } from "./PremiumGate";
import { getPushSubscriptionStatus, subscribeToPush, unsubscribeFromPush } from "./push";


export function Resumen({ trip, session, days, darkMode, onTripUpdate, onDuplicate, onEnterDuplicate, activePresence }: {
  trip: Trip; session: Session; days: number | null; darkMode: boolean;
  onTripUpdate: (t: Trip) => void;
  onDuplicate: () => Promise<string | null>;
  onEnterDuplicate: (code: string) => Promise<void>;
  activePresence: string[];
}) {
  const dur = tripDuration(trip.startDate, trip.endDate);
  const [coverUrl, setCoverUrl] = useState("");
  const [coverInput, setCoverInput] = useState("");
  const [showCoverEdit, setShowCoverEdit] = useState(false);
  const coverKey = `cover:${session.code}`;

  useEffect(() => {
    loadShared<string>(coverKey, "").then(u => { setCoverUrl(u); setCoverInput(u); });
  }, [coverKey]);

  async function saveCover() {
    await saveShared(coverKey, coverInput.trim());
    setCoverUrl(coverInput.trim());
    setShowCoverEdit(false);
  }

  const cardBg = darkMode ? "#161B22" : "#fff";
  const cardBorder = darkMode ? "#30363D" : C.line;
  const textColor = darkMode ? "#E6EDF3" : C.ink;
  const softColor = darkMode ? "#8B949E" : C.inkSoft;

  const [duplicating, setDuplicating] = useState(false);
  const [duplicatedCode, setDuplicatedCode] = useState<string | null>(null);
  const [duplicatedCopied, setDuplicatedCopied] = useState(false);

  const premium = isPremium(trip);
  const [pushStatus, setPushStatus] = useState<"subscribed" | "unsubscribed" | "unsupported">("unsupported");
  const [pushBusy, setPushBusy] = useState(false);
  useEffect(() => { getPushSubscriptionStatus().then(setPushStatus); }, []);

  async function togglePush() {
    setPushBusy(true);
    if (pushStatus === "subscribed") {
      await unsubscribeFromPush(session.code);
      setPushStatus("unsubscribed");
    } else {
      const ok = await subscribeToPush(session.code);
      setPushStatus(ok ? "subscribed" : "unsubscribed");
    }
    setPushBusy(false);
  }

  async function handleDuplicate() {
    setDuplicating(true);
    const code = await onDuplicate();
    setDuplicating(false);
    if (code) setDuplicatedCode(code);
  }

  // Stagger entrance for the whole resumen section
  const sectionRef = useRef<HTMLDivElement>(null);
  useAnimeStagger(sectionRef);

  // Spring bounce for the countdown
  const countdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = countdownRef.current;
    if (!el || days === null) return;
    el.style.opacity = "0";
    el.style.transform = "scale(0.88)";
    animate(el, {
      opacity: [0, 1],
      scale: [0.88, 1],
      duration: 900,
      ease: spring({ stiffness: 180, damping: 14, mass: 1 }),
    });
  }, [days]);

  return (
    <div ref={sectionRef} className="flex flex-col gap-4">
      {/* Cover photo hero */}
      {(coverUrl || showCoverEdit) && (
        <div style={{ borderRadius: 14, overflow: "hidden", position: "relative" }}>
          {coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt="Portada del viaje" style={{ width: "100%", height: 200, objectFit: "cover", display: "block" }} onError={() => setCoverUrl("")} />
          )}
          {!coverUrl && <div style={{ height: 80, background: C.paperDark, display: "flex", alignItems: "center", justifyContent: "center", color: C.inkSoft, fontFamily: F.mono, fontSize: 12 }}>Sin foto de portada</div>}
          <button onClick={() => setShowCoverEdit(v => !v)} style={{ position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,0.55)", color: "#fff", borderRadius: 6, padding: "4px 10px", fontFamily: F.mono, fontSize: 10 }}>
            <Edit2 size={11} style={{ display: "inline", marginRight: 4 }} />PORTADA
          </button>
        </div>
      )}
      {!coverUrl && !showCoverEdit && (
        <button onClick={() => setShowCoverEdit(true)} style={{ border: `1px dashed ${C.line}`, borderRadius: 10, padding: "10px 16px", color: C.inkSoft, fontFamily: F.mono, fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
          <Camera size={13} /> AÑADIR FOTO DE PORTADA DEL VIAJE
        </button>
      )}
      {showCoverEdit && (
        <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 10, padding: "14px 16px" }} className="flex flex-col gap-2">
          <div style={{ fontFamily: F.mono, fontSize: 10, color: softColor }}>URL de imagen de portada</div>
          <div className="flex gap-2">
            <input value={coverInput} onChange={e => setCoverInput(e.target.value)} placeholder="https://…/foto.jpg"
              style={{ ...inputStyle, flex: 1, background: darkMode ? "#0D1117" : "#fff", color: textColor, border: `1px solid ${cardBorder}` }} />
            <button onClick={saveCover} style={{ background: C.teal, color: "#fff", borderRadius: 6, padding: "0 14px", fontFamily: F.mono, fontSize: 11 }}>OK</button>
            <button onClick={() => setShowCoverEdit(false)} style={{ color: softColor, padding: "0 8px" }}><X size={14} /></button>
          </div>
        </div>
      )}

      {/* Countdown hero card */}
      {days !== null && (
        <div ref={countdownRef} style={{ background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navyMid} 60%, #1A3560 100%)`, borderRadius: 14, padding: "26px 22px", color: C.paper, position: "relative", overflow: "hidden" }}>
          <div className="glow-pulse" style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: 999, background: `radial-gradient(circle, ${C.gold}30, transparent 70%)`, pointerEvents: "none" }} />
          <div className="glow-pulse" style={{ position: "absolute", bottom: -20, left: 20, width: 120, height: 120, borderRadius: 999, background: `radial-gradient(circle, ${C.teal}25, transparent 70%)`, pointerEvents: "none", animationDelay: "2s" }} />
          <div style={{ fontFamily: F.mono, fontSize: 10, color: C.gold, letterSpacing: 2.5 }}>CUENTA ATRÁS</div>
          <div style={{ fontFamily: F.display, fontSize: "clamp(3.2rem, 11vw, 5.5rem)", fontWeight: 700, color: C.goldLight, lineHeight: 1, marginTop: 4 }}>
            {days > 0 ? days : days === 0 ? "¡HOY!" : "¡EN MARCHA!"}
          </div>
          {days > 0 && <div style={{ fontFamily: F.mono, fontSize: 12, color: "#8BAFD4", marginTop: 4 }}>días para {trip.destination || trip.name}</div>}
          {trip.startDate && (
            <div style={{ marginTop: 12, fontFamily: F.mono, fontSize: 11, color: "#6080A4" }}>
              {formatDate(trip.startDate)}{trip.endDate ? ` → ${formatDate(trip.endDate)}` : ""}{dur ? ` · ${dur} días` : ""}
            </div>
          )}
        </div>
      )}

      {/* Crew */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <SectionLabel>Tripulación</SectionLabel>
          <span style={{ fontFamily: F.mono, fontSize: 11, background: C.paperDark, color: C.inkSoft, borderRadius: 999, padding: "1px 7px" }}>{trip.members.length}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {trip.members.map(m => {
            const isMe = m.toLowerCase() === session.name.toLowerCase();
            const isActive = premium && activePresence.some(a => a.toLowerCase() === m.toLowerCase());
            return (
              <div key={m} className="flex items-center gap-2 px-3 py-1.5 card-lift"
                style={{ background: isMe ? C.navy : C.paperDark, borderRadius: 999, fontSize: 13, color: isMe ? C.paper : C.ink, fontWeight: isMe ? 600 : 400, border: isMe ? `1px solid ${C.navyMid}` : `1px solid ${C.line}` }}>
                <div style={{ position: "relative", width: 22, height: 22, flexShrink: 0 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 999, background: isMe ? C.red : C.teal, color: "#fff", fontSize: 11, fontFamily: F.mono, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600 }}>
                    {m[0]?.toUpperCase()}
                  </div>
                  {isActive && <div title="Activo ahora" style={{ position: "absolute", bottom: -1, right: -1, width: 8, height: 8, borderRadius: 999, background: C.green, border: `1.5px solid ${isMe ? C.navy : (darkMode ? "#161B22" : "#fff")}` }} />}
                </div>
                {m}
                {isMe && <span style={{ fontSize: 9, color: C.goldLight, fontFamily: F.mono }}>TÚ</span>}
              </div>
            );
          })}
          {trip.members.length === 0 && <p style={{ color: C.inkSoft, fontSize: 13 }}>Sin miembros todavía.</p>}
        </div>
        {!premium && trip.members.length > 1 && (
          <p style={{ fontFamily: F.mono, fontSize: 10, color: softColor, marginTop: 8 }}>
            Premium: ve quién está viendo el viaje ahora mismo.
          </p>
        )}
      </Card>

      {/* Weather forecast */}
      <WeatherWidget destination={trip.destination} startDate={trip.startDate} endDate={trip.endDate} />

      {/* Invite + Print */}
      <InvitePanel code={session.code} trip={trip} darkMode={darkMode} onTripUpdate={onTripUpdate} />

      {/* Push notifications */}
      {pushStatus !== "unsupported" && (
        <Card style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
          <div className="flex items-center gap-2 mb-2">
            {pushStatus === "subscribed" ? <Bell size={15} color={softColor} /> : <BellOff size={15} color={softColor} />}
            <SectionLabel>Notificaciones</SectionLabel>
          </div>
          <PremiumGate code={session.code} trip={trip} onUnlock={onTripUpdate} feature="Recibir un aviso diario con el plan del día" darkMode={darkMode}>
            <div className="flex items-center justify-between gap-3">
              <p style={{ color: softColor, fontSize: 13 }}>
                {pushStatus === "subscribed" ? "Recibirás un aviso cada mañana con el plan del día." : "Recibe un aviso cada mañana con el plan del día."}
              </p>
              <button onClick={togglePush} disabled={pushBusy} style={{
                flexShrink: 0, display: "flex", alignItems: "center", gap: 6,
                background: pushStatus === "subscribed" ? (darkMode ? "#21262D" : C.paperDark) : C.teal,
                color: pushStatus === "subscribed" ? textColor : "#fff",
                border: pushStatus === "subscribed" ? `1px solid ${cardBorder}` : "none",
                borderRadius: 6, padding: "8px 14px", fontFamily: F.mono, fontSize: 11, fontWeight: 700,
              }}>
                {pushBusy ? "…" : pushStatus === "subscribed" ? "DESACTIVAR" : "ACTIVAR"}
              </button>
            </div>
          </PremiumGate>
        </Card>
      )}

      {/* Duplicate trip */}
      <Card style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
        <div className="flex items-center gap-2 mb-2">
          <PlusSquare size={15} color={softColor} />
          <SectionLabel>Duplicar viaje</SectionLabel>
        </div>
        {!duplicatedCode ? (
          <div className="flex flex-col gap-2">
            <p style={{ color: softColor, fontSize: 13 }}>
              Crea un viaje nuevo reutilizando este itinerario, checklist y equipaje.
            </p>
            <button onClick={handleDuplicate} disabled={duplicating} style={{
              alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6,
              background: darkMode ? "#21262D" : C.paperDark, color: textColor, border: `1px solid ${cardBorder}`,
              borderRadius: 6, padding: "7px 14px", fontFamily: F.mono, fontSize: 11,
            }}>
              <PlusSquare size={12} /> {duplicating ? "DUPLICANDO…" : "DUPLICAR ESTE VIAJE"}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p style={{ color: softColor, fontSize: 13 }}>
              Nuevo viaje creado con código{" "}
              <button onClick={() => { navigator.clipboard?.writeText(duplicatedCode).catch(() => {}); setDuplicatedCopied(true); setTimeout(() => setDuplicatedCopied(false), 2000); }}
                style={{ color: textColor, fontFamily: F.mono, fontWeight: 700, background: darkMode ? "#21262D" : C.paperDark, borderRadius: 4, padding: "1px 6px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}>
                {duplicatedCode} {duplicatedCopied ? <Check size={11} color={C.teal} /> : <Copy size={10} />}
              </button>.
            </p>
            <button onClick={() => onEnterDuplicate(duplicatedCode)} style={{
              alignSelf: "flex-start", background: C.teal, color: "#fff", borderRadius: 6,
              padding: "8px 16px", fontFamily: F.mono, fontSize: 11, fontWeight: 700,
            }}>
              ENTRAR EN EL VIAJE DUPLICADO
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}

