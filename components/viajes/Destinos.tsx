"use client";

import { useState, useEffect, useMemo } from "react";
import { MapPin, X, Globe, Heart, RefreshCw } from "lucide-react";
import { C, F, inputStyle } from "./theme";
import { Perf, Card, SectionLabel, EmptyState, SkeletonCards } from "./ui";
import { uid, loadShared, saveShared, loadPersonal, savePersonal, monthsBetween } from "./utils";
import { CURRENCIES, DEST_TIPS, DEST_TYPE_FILTERS } from "./data/constants";
import { DESTINATIONS, DESTINATION_ALTERNATIVES } from "./data/destinations";
import type { ItineraryDay, MapPlace, SavingsConfig, DestinationTemplate } from "./types";


export const TYPE_COLORS: Record<string, string> = {
  playa: "#4A90B8", ciudad: "#3F7A78", cultura: "#B8893F",
  naturaleza: "#2A7A4B", aventura: "#D4614A",
};
export const TYPE_GRADIENTS: Record<string, string> = {
  playa:      "linear-gradient(135deg, #4A90B8 0%, #1a5f82 100%)",
  ciudad:     "linear-gradient(135deg, #3F7A78 0%, #1d4f4e 100%)",
  cultura:    "linear-gradient(135deg, #B8893F 0%, #7a540f 100%)",
  naturaleza: "linear-gradient(135deg, #2A7A4B 0%, #0f4f28 100%)",
  aventura:   "linear-gradient(135deg, #D4614A 0%, #8f2b18 100%)",
};

export function DestCard({ dest, budget, onChoose, onOpen, isFavorite, onToggleFavorite }: {
  dest: DestinationTemplate; budget: number; onChoose: () => void; onOpen: () => void;
  isFavorite?: boolean; onToggleFavorite?: () => void;
}) {
  const withinBudget = budget === 0 || dest.costPerPerson <= budget;
  const missing = budget > 0 ? dest.costPerPerson - budget : 0;
  const typeColor = TYPE_COLORS[dest.type] ?? C.inkSoft;
  const gradient = TYPE_GRADIENTS[dest.type] ?? TYPE_GRADIENTS.aventura;

  return (
    <div className="card-lift" onClick={onOpen} style={{
      background: "#fff", border: `1px solid ${withinBudget ? C.line : "#e0cccc"}`,
      borderRadius: 14, overflow: "hidden", cursor: "pointer",
      opacity: withinBudget ? 1 : 0.78, display: "flex", flexDirection: "column",
    }}>
      {/* Coloured header */}
      <div style={{ background: gradient, padding: "18px 16px 14px", position: "relative", minHeight: 88 }}>
        <div style={{ position: "absolute", top: 10, right: 12, background: withinBudget ? "rgba(255,255,255,0.2)" : "rgba(255,80,80,0.25)", borderRadius: 8, padding: "4px 10px" }}>
          <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 700, color: "#fff" }}>
            ~{dest.costPerPerson.toLocaleString("es-ES")} €
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 8, color: "rgba(255,255,255,0.8)", textAlign: "right" }}>
            {withinBudget
              ? (budget > 0 ? `↑ ${(budget - dest.costPerPerson).toFixed(0)} € sobrante` : "por persona")
              : `↓ faltan ${missing.toFixed(0)} €`}
          </div>
        </div>
        {onToggleFavorite && (
          <button onClick={e => { e.stopPropagation(); onToggleFavorite(); }}
            style={{ position: "absolute", top: 10, left: 12, background: "rgba(0,0,0,0.25)", borderRadius: 999, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Heart size={14} color="#fff" fill={isFavorite ? "#fff" : "transparent"} />
          </button>
        )}
        <div style={{ fontSize: 34, lineHeight: 1 }}>{dest.flag}</div>
        <div style={{ fontFamily: F.display, fontSize: 18, fontWeight: 700, color: "#fff", marginTop: 6, lineHeight: 1.2 }}>{dest.name}</div>
        <div style={{ fontFamily: F.mono, fontSize: 9, color: "rgba(255,255,255,0.75)", marginTop: 3 }}>{dest.country} · {dest.durationDays} días</div>
      </div>

      {/* Body */}
      <div style={{ padding: "12px 14px", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontFamily: F.mono, fontSize: 9, padding: "2px 8px", borderRadius: 999, background: `${typeColor}18`, color: typeColor, border: `1px solid ${typeColor}33`, alignSelf: "flex-start", letterSpacing: 0.5 }}>
          {dest.type.toUpperCase()}
        </span>
        <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {dest.description}
        </div>
        <div className="flex flex-wrap gap-1">
          {dest.highlights.slice(0, 3).map(h => (
            <span key={h} style={{ fontFamily: F.mono, fontSize: 9, color: C.inkSoft, background: C.paperDark, borderRadius: 4, padding: "2px 6px" }}>{h}</span>
          ))}
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 9, color: C.inkSoft, marginTop: 2 }}>
          VER ITINERARIO COMPLETO →
        </div>
      </div>
    </div>
  );
}

export function DestModal({ dest, budget, onChoose, onClose, alternatives, onOpenAlt }: {
  dest: DestinationTemplate; budget: number; onChoose: () => void; onClose: () => void;
  alternatives?: DestinationTemplate[]; onOpenAlt?: (d: DestinationTemplate) => void;
}) {
  const withinBudget = budget === 0 || dest.costPerPerson <= budget;
  const gradient = TYPE_GRADIENTS[dest.type] ?? TYPE_GRADIENTS.aventura;
  return (
    <div className="fade-in" style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", flexDirection: "column", background: "#000a" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ marginTop: "auto", background: C.paper, borderRadius: "20px 20px 0 0", maxHeight: "88dvh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Modal header */}
        <div style={{ background: gradient, padding: "20px 20px 16px", position: "relative", flexShrink: 0 }}>
          <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, background: "rgba(255,255,255,0.2)", borderRadius: 999, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={16} color="#fff" />
          </button>
          <div style={{ fontSize: 40 }}>{dest.flag}</div>
          <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 700, color: "#fff", marginTop: 4 }}>{dest.name}</div>
          <div style={{ fontFamily: F.mono, fontSize: 10, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>{dest.country} · {dest.durationDays} días</div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ fontFamily: F.display, fontSize: 24, fontWeight: 700, color: "#fff" }}>~{dest.costPerPerson.toLocaleString("es-ES")} €</div>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: "rgba(255,255,255,0.75)" }}>
              {withinBudget
                ? (budget > 0 ? `✓ dentro de tu presupuesto` : "todo incluido · por persona")
                : `faltan ~${(dest.costPerPerson - budget).toFixed(0)} €`}
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto" style={{ flex: 1, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ fontSize: 14, color: C.inkSoft, lineHeight: 1.7 }}>{dest.description}</p>

          <div style={{ background: `${TYPE_COLORS[dest.type] ?? C.teal}15`, borderRadius: 8, padding: "10px 14px", fontFamily: F.mono, fontSize: 11, color: C.inkSoft }}>
            ✈️ Vuelo · 🏨 Alojamiento · 🍽️ Comida · 🎭 Actividades — <strong style={{ color: C.ink }}>TODO INCLUIDO</strong>
          </div>

          {!withinBudget && alternatives && alternatives.length > 0 && (
            <div style={{ background: "#FFF5F0", borderRadius: 10, padding: "12px 14px", border: "1px solid #FDDCCC" }}>
              <div style={{ fontFamily: F.mono, fontSize: 10, color: C.coral, fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>
                ¿FUERA DE PRESUPUESTO? PRUEBA ESTO:
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {alternatives.map(alt => {
                  const altWithin = budget === 0 || alt.costPerPerson <= budget;
                  return (
                    <button key={alt.id} onClick={() => onOpenAlt?.(alt)} style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                      background: "#fff", borderRadius: 8, border: `1px solid ${altWithin ? "#C8EDCC" : "#FDDCCC"}`,
                      textAlign: "left", cursor: "pointer", width: "100%",
                    }}>
                      <span style={{ fontSize: 26, flexShrink: 0 }}>{alt.flag}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: F.display, fontSize: 14, fontWeight: 700, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{alt.name}</div>
                        <div style={{ fontFamily: F.mono, fontSize: 9, color: C.inkSoft }}>{alt.durationDays} días · {alt.country}</div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 700, color: altWithin ? C.green : C.inkSoft }}>
                          ~{alt.costPerPerson.toLocaleString("es-ES")} €
                        </div>
                        {budget > 0 && (
                          <div style={{ fontFamily: F.mono, fontSize: 8, color: altWithin ? C.green : C.inkSoft }}>
                            {altWithin ? `✓ te alcanza` : `faltan ${(alt.costPerPerson - budget).toFixed(0)} €`}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <SectionLabel>Itinerario</SectionLabel>
            <div className="flex flex-col gap-2 mt-2">
              {dest.itinerary.map((d, i) => (
                <div key={i} style={{ background: C.paperDark, borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontFamily: F.mono, fontSize: 10, color: C.gold, marginBottom: 4 }}>DÍA {i + 1}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 6 }}>{d.title}</div>
                  <div className="flex flex-col gap-1">
                    {d.items.slice(0, 3).map((it, j) => (
                      <div key={j} className="flex gap-2" style={{ fontSize: 12, color: C.inkSoft }}>
                        <span style={{ fontFamily: F.mono, fontSize: 10, color: C.teal, flexShrink: 0, width: 40 }}>{it.time}</span>
                        <span>{it.text}</span>
                      </div>
                    ))}
                    {d.items.length > 3 && <div style={{ fontFamily: F.mono, fontSize: 9, color: C.inkSoft }}>+{d.items.length - 3} más…</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <SectionLabel>Lugares del mapa</SectionLabel>
            <div className="flex flex-col gap-2 mt-2">
              {dest.mapPlaces.map(p => (
                <div key={p.name} className="flex gap-2 items-start" style={{ fontSize: 13, color: C.ink }}>
                  <MapPin size={13} color={TYPE_COLORS[dest.type] ?? C.teal} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkSoft }}>{p.note}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tips per destination */}
          {DEST_TIPS[dest.id] && (() => {
            const tips = DEST_TIPS[dest.id];
            return (
              <div style={{ background: "#F0F7FF", borderRadius: 10, padding: "12px 14px", border: "1px solid #C8DEFF" }}>
                <div style={{ fontFamily: F.mono, fontSize: 10, color: C.sky, fontWeight: 700, marginBottom: 10, letterSpacing: 1 }}>ℹ️ INFORMACIÓN PRÁCTICA</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {[
                    { icon: "📋", label: "Visado", val: tips.visa },
                    { icon: "💵", label: "Moneda", val: tips.currency },
                    { icon: "🔌", label: "Enchufe", val: tips.plug },
                    { icon: "💝", label: "Propinas", val: tips.tip },
                    { icon: "🚨", label: "Emergencias", val: tips.emergency },
                  ].map(row => (
                    <div key={row.label} className="flex gap-2 items-start" style={{ fontSize: 12 }}>
                      <span style={{ flexShrink: 0, width: 20, textAlign: "center" }}>{row.icon}</span>
                      <span style={{ fontFamily: F.mono, fontSize: 9, color: C.sky, width: 68, flexShrink: 0, paddingTop: 1 }}>{row.label.toUpperCase()}</span>
                      <span style={{ color: C.ink, lineHeight: 1.5 }}>{row.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Currency converter */}
          {(() => {
            const cur = CURRENCIES.find(c => c.destIds.some(id => dest.id.includes(id) || id.includes(dest.id)));
            if (!cur || cur.code === "EUR") return null;
            return (
              <div style={{ background: "#FFFBF0", borderRadius: 10, padding: "12px 14px", border: "1px solid #F0D9A0" }}>
                <div style={{ fontFamily: F.mono, fontSize: 10, color: C.gold, fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>💱 CONVERSOR RÁPIDO</div>
                <CurrencyWidget currency={cur} />
              </div>
            );
          })()}

          <div style={{ height: 16 }} />
        </div>

        {/* CTA */}
        <div style={{ padding: "12px 20px 24px", borderTop: `1px solid ${C.line}`, flexShrink: 0 }}>
          <button onClick={onChoose} style={{
            width: "100%", background: withinBudget ? TYPE_COLORS[dest.type] ?? C.teal : C.navy,
            color: "#fff", borderRadius: 10, padding: "14px 16px",
            fontFamily: F.mono, fontSize: 13, fontWeight: 700, letterSpacing: 0.5,
          }}>
            {withinBudget ? `✈ ELEGIR ${dest.name.toUpperCase()}` : "ELEGIR IGUALMENTE →"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CurrencyWidget({ currency }: { currency: typeof CURRENCIES[0] }) {
  const [eur, setEur] = useState("100");
  const eurNum = parseFloat(eur.replace(",", ".")) || 0;
  const converted = (eurNum * currency.rate).toLocaleString("es-ES", { maximumFractionDigits: 0 });
  const back = (1 / currency.rate).toFixed(4);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div style={{ position: "relative", flex: 1 }}>
          <input value={eur} onChange={e => setEur(e.target.value)} style={{ ...inputStyle, fontFamily: F.mono, fontSize: 14, paddingRight: 28 }} />
          <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontFamily: F.mono, fontSize: 12, color: C.inkSoft }}>€</span>
        </div>
        <RefreshCw size={14} color={C.inkSoft} />
        <div style={{ flex: 1, background: C.paperDark, borderRadius: 8, padding: "9px 12px", fontFamily: F.mono, fontSize: 14, fontWeight: 700, color: C.ink }}>
          {converted} <span style={{ fontSize: 10, fontWeight: 400, color: C.inkSoft }}>{currency.symbol}</span>
        </div>
      </div>
      <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkSoft }}>
        1 € = {currency.rate >= 10 ? Math.round(currency.rate) : currency.rate} {currency.code} · 1 {currency.code} = {back} € · {currency.name}
      </div>
    </div>
  );
}

export function Destinos({ code, startDate, onSelect }: { code: string; startDate: string | null; onSelect: () => void }) {
  const [savings, setSavings] = useState<SavingsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<DestinationTemplate | null>(null);
  const [chosen, setChosen] = useState<DestinationTemplate | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadShared<SavingsConfig>(`ahorro:${code}`, { targetBudget: 0, phases: [] }).then(c => {
      setSavings(c);
      setLoading(false);
    });
    loadPersonal<string[]>("destFavorites", []).then(ids => setFavorites(new Set(ids)));
  }, [code]);

  function toggleFavorite(id: string) {
    setFavorites(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      savePersonal("destFavorites", Array.from(next));
      return next;
    });
  }

  const budgetPerPerson = useMemo(() => {
    if (!savings) return 0;
    return savings.phases.reduce((sum, p) => {
      const months = monthsBetween(p.startDate, p.endDate);
      return sum + p.amountPerPerson * months;
    }, 0);
  }, [savings]);

  async function applyDestination(dest: DestinationTemplate) {
    const itinDays: ItineraryDay[] = dest.itinerary.map((d, i) => {
      let date = "";
      if (startDate) {
        const dt = new Date(startDate + "T12:00:00");
        dt.setDate(dt.getDate() + i);
        date = dt.toISOString().slice(0, 10);
      }
      return { ...d, id: uid(), date, items: d.items.map(it => ({ ...it, id: uid() })) };
    });
    await saveShared(`itin:${code}`, itinDays);
    const mapPlaces: MapPlace[] = dest.mapPlaces.map(p => ({ ...p, id: uid() }));
    await saveShared(`mapa:${code}`, mapPlaces);
    onSelect();
  }

  const visibleDests = useMemo(() => {
    const q = search.trim().toLowerCase();
    return DESTINATIONS.filter(d =>
      (filter === "todos" || d.type === filter || (filter === "favoritos" && favorites.has(d.id))) &&
      (filter !== "favoritos" || favorites.has(d.id)) &&
      (!q || d.name.toLowerCase().includes(q) || d.country.toLowerCase().includes(q) || d.highlights.some(h => h.toLowerCase().includes(q)))
    );
  }, [filter, search, favorites]);

  const withinBudget = useMemo(() =>
    visibleDests.filter(d => budgetPerPerson === 0 || d.costPerPerson <= budgetPerPerson),
    [visibleDests, budgetPerPerson]);

  const overBudget = useMemo(() =>
    visibleDests.filter(d => budgetPerPerson > 0 && d.costPerPerson > budgetPerPerson),
    [visibleDests, budgetPerPerson]);

  if (loading) return <SkeletonCards />;

  if (confirming && chosen) {
    return (
      <div className="flex flex-col gap-4 fade-in">
        <Card style={{ textAlign: "center", padding: "28px 20px" }}>
          <div style={{ fontSize: 52 }}>{chosen.flag}</div>
          <div style={{ fontFamily: F.display, fontSize: 24, fontWeight: 700, color: C.ink, marginTop: 8 }}>{chosen.name}</div>
          <div style={{ color: C.inkSoft, fontSize: 13, marginTop: 4, fontFamily: F.mono }}>
            {chosen.country} · {chosen.durationDays} días · todo incluido ~{chosen.costPerPerson.toLocaleString("es-ES")} €/persona
          </div>
          <Perf />
          <p style={{ color: C.inkSoft, fontSize: 14, lineHeight: 1.7 }}>
            Se va a cargar el <strong style={{ color: C.ink }}>itinerario completo</strong> y los <strong style={{ color: C.ink }}>lugares del mapa</strong> de <strong style={{ color: C.ink }}>{chosen.name}</strong> en el viaje. El contenido actual se reemplazará. ¿Continuar?
          </p>
          <div className="flex gap-3 mt-5">
            <button onClick={() => { setConfirming(false); setPreview(chosen); }} style={{ flex: 1, background: C.paperDark, color: C.inkSoft, borderRadius: 8, padding: "12px 16px", fontFamily: F.mono, fontSize: 12 }}>VOLVER</button>
            <button onClick={() => applyDestination(chosen)} style={{ flex: 1, background: C.teal, color: "#fff", borderRadius: 8, padding: "12px 16px", fontFamily: F.mono, fontSize: 12, fontWeight: 700 }}>SÍ, APLICAR →</button>
          </div>
        </Card>
      </div>
    );
  }

  const DestGrid = ({ dests }: { dests: DestinationTemplate[] }) => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
      {dests.map(dest => (
        <DestCard key={dest.id} dest={dest} budget={budgetPerPerson}
          onChoose={() => { setChosen(dest); setConfirming(true); setPreview(null); }}
          onOpen={() => setPreview(dest)}
          isFavorite={favorites.has(dest.id)}
          onToggleFavorite={() => toggleFavorite(dest.id)}
        />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Budget header */}
      <div style={{ background: `linear-gradient(135deg, ${C.navy}, ${C.navyMid})`, borderRadius: 14, padding: "20px 20px", color: C.paper, position: "relative", overflow: "hidden" }} className="dot-grid">
        <div className="glow-pulse" style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: 999, background: `radial-gradient(circle, ${C.gold}25, transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ fontFamily: F.mono, fontSize: 10, color: C.gold, letterSpacing: 1.5 }}>PRESUPUESTO POR PERSONA</div>
        <div style={{ fontFamily: F.display, fontSize: "clamp(2rem,8vw,3rem)", fontWeight: 700, color: C.goldLight, lineHeight: 1, marginTop: 4 }}>
          {budgetPerPerson > 0 ? `${budgetPerPerson.toFixed(0)} €` : "—"}
        </div>
        {budgetPerPerson > 0 ? (
          <p style={{ fontFamily: F.mono, fontSize: 11, color: "#9FAEC4", marginTop: 6 }}>
            Según tu plan de ahorro · vuelo + hotel + comida + actividades incluidos
          </p>
        ) : (
          <p style={{ fontFamily: F.mono, fontSize: 11, color: "#9FAEC4", marginTop: 6 }}>
            Configura tu plan en <strong style={{ color: C.goldLight }}>AHORRO</strong> para filtrar por presupuesto
          </p>
        )}
        {budgetPerPerson > 0 && (
          <div className="mt-3 flex gap-3" style={{ fontFamily: F.mono, fontSize: 11 }}>
            <span style={{ color: C.goldLight }}>✓ {withinBudget.length} alcanzables</span>
            {overBudget.length > 0 && <span style={{ color: "#9FAEC4" }}>· {overBudget.length} fuera de alcance</span>}
          </div>
        )}
      </div>

      <p style={{ fontFamily: F.mono, fontSize: 11, color: C.inkSoft, textAlign: "center" }}>
        Plantillas de viaje listas para aplicar — sustituyen tu plan actual
      </p>

      {/* Search */}
      <div style={{ position: "relative" }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar destino, país o actividad…"
          style={{ width: "100%", padding: "10px 16px 10px 38px", borderRadius: 10, border: `1px solid ${C.line}`, background: "#fff", fontFamily: F.mono, fontSize: 13, color: C.ink, boxSizing: "border-box" }}
        />
        <Globe size={15} color={C.inkSoft} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
        {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}><X size={14} color={C.inkSoft} /></button>}
      </div>

      {/* Type filter pills */}
      <div className="flex flex-wrap gap-2">
        {DEST_TYPE_FILTERS.map(t => (
          <button key={t.value} onClick={() => setFilter(t.value)} style={{
            padding: "7px 14px", borderRadius: 999, fontSize: 12, fontFamily: F.mono,
            background: filter === t.value ? C.navy : C.paperDark,
            color: filter === t.value ? C.paper : C.inkSoft,
            border: `1px solid ${filter === t.value ? C.navy : C.line}`,
            transition: "all 0.15s", fontWeight: filter === t.value ? 700 : 400,
          }}>
            {t.emoji} {t.label}
          </button>
        ))}
        <button onClick={() => setFilter("favoritos")} style={{
          padding: "7px 14px", borderRadius: 999, fontSize: 12, fontFamily: F.mono,
          background: filter === "favoritos" ? "#B83C5C" : C.paperDark,
          color: filter === "favoritos" ? "#fff" : C.inkSoft,
          border: `1px solid ${filter === "favoritos" ? "#B83C5C" : C.line}`,
          transition: "all 0.15s", fontWeight: filter === "favoritos" ? 700 : 400,
        }}>
          ❤️ Favoritos {favorites.size > 0 && `(${favorites.size})`}
        </button>
      </div>

      {/* Within budget */}
      {withinBudget.length > 0 && (
        <div className="flex flex-col gap-3">
          {budgetPerPerson > 0 && (
            <div className="flex items-center gap-2">
              <div style={{ height: 1, flex: 1, background: `${C.green}44` }} />
              <span style={{ fontFamily: F.mono, fontSize: 10, color: C.green, letterSpacing: 1 }}>✓ CON TU PRESUPUESTO</span>
              <div style={{ height: 1, flex: 1, background: `${C.green}44` }} />
            </div>
          )}
          <DestGrid dests={withinBudget} />
        </div>
      )}

      {/* Over budget */}
      {budgetPerPerson > 0 && overBudget.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 mt-2">
            <div style={{ height: 1, flex: 1, background: C.line }} />
            <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkSoft, letterSpacing: 1 }}>NECESITAS AHORRAR MÁS</span>
            <div style={{ height: 1, flex: 1, background: C.line }} />
          </div>
          <DestGrid dests={overBudget} />
        </div>
      )}

      {budgetPerPerson === 0 && <DestGrid dests={visibleDests} />}

      {visibleDests.length === 0 && filter === "favoritos" && <EmptyState icon={<Heart size={28} color={C.line} />} text="Aún no tienes favoritos. Pulsa el corazón en cualquier destino." />}
      {visibleDests.length === 0 && filter !== "favoritos" && <EmptyState icon={<Globe size={28} color={C.line} />} text="Sin destinos con ese filtro." />}

      {preview && (
        <DestModal
          dest={preview}
          budget={budgetPerPerson}
          onChoose={() => { setChosen(preview!); setConfirming(true); setPreview(null); }}
          onClose={() => setPreview(null)}
          alternatives={(DESTINATION_ALTERNATIVES[preview.id] ?? []).map(id => DESTINATIONS.find(d => d.id === id)).filter(Boolean) as DestinationTemplate[]}
          onOpenAlt={d => setPreview(d)}
        />
      )}
    </div>
  );
}

