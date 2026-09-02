"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Check, Trash2, X, Euro, Circle, PiggyBank, Edit2 } from "lucide-react";
import { C, F, inputStyle } from "./theme";
import { Card, SectionLabel, Field, Banner, EmptyState, SkeletonCards } from "./ui";
import { uid, loadShared, saveShared, formatMonth, monthsBetween } from "./utils";
import type { SavingsPhase, SavingsConfig } from "./types";

export function Ahorro({ code, members }: { code: string; members: string[] }) {
  const [config, setConfig] = useState<SavingsConfig>({ targetBudget: 0, phases: [] });
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState(false);
  const [targetInput, setTargetInput] = useState("");
  const [editN, setEditN] = useState(false);
  const [nInput, setNInput] = useState("");
  const [phaseForm, setPhaseForm] = useState({ name: "", startDate: "", endDate: "", amountPerPerson: "" });
  const [phaseErr, setPhaseErr] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const key = `ahorro:${code}`;

  const defaultN = Math.max(members.length, 1);
  const n = config.numPersonas != null ? config.numPersonas : defaultN;

  useEffect(() => {
    loadShared<SavingsConfig>(key, { targetBudget: 0, phases: [] }).then(c => {
      setConfig(c);
      setTargetInput(c.targetBudget > 0 ? c.targetBudget.toString() : "");
      setNInput((c.numPersonas ?? Math.max(members.length, 1)).toString());
      setLoading(false);
    });
  }, [key, members.length]);

  const persist = useCallback(async (next: SavingsConfig) => {
    setConfig(next);
    await saveShared(key, next);
  }, [key]);

  function saveTarget() {
    const v = parseFloat(targetInput.replace(",", "."));
    persist({ ...config, targetBudget: isNaN(v) || v < 0 ? 0 : v });
    setEditTarget(false);
  }

  function saveN() {
    const v = parseInt(nInput);
    const num = isNaN(v) || v < 1 ? defaultN : v;
    persist({ ...config, numPersonas: num });
    setNInput(num.toString());
    setEditN(false);
  }

  function addPhase() {
    setPhaseErr("");
    if (!phaseForm.name.trim()) { setPhaseErr("Ponle un nombre a la fase."); return; }
    const amount = parseFloat(phaseForm.amountPerPerson.replace(",", "."));
    if (isNaN(amount) || amount <= 0) { setPhaseErr("Introduce un importe por persona válido."); return; }
    if (!phaseForm.startDate || !phaseForm.endDate) { setPhaseErr("Selecciona las fechas de inicio y fin."); return; }
    if (phaseForm.endDate < phaseForm.startDate) { setPhaseErr("La fecha de fin debe ser posterior a la de inicio."); return; }

    if (editingId) {
      persist({ ...config, phases: config.phases.map(p => p.id === editingId ? { ...p, ...phaseForm, amountPerPerson: amount } : p) });
      setEditingId(null);
    } else {
      persist({ ...config, phases: [...config.phases, { id: uid(), name: phaseForm.name.trim(), startDate: phaseForm.startDate, endDate: phaseForm.endDate, amountPerPerson: amount }] });
    }
    setPhaseForm({ name: "", startDate: "", endDate: "", amountPerPerson: "" });
  }

  function startEdit(phase: SavingsPhase) {
    setEditingId(phase.id);
    setPhaseForm({ name: phase.name, startDate: phase.startDate, endDate: phase.endDate, amountPerPerson: phase.amountPerPerson.toString() });
  }

  function cancelEdit() { setEditingId(null); setPhaseForm({ name: "", startDate: "", endDate: "", amountPerPerson: "" }); setPhaseErr(""); }

  function removePhase(id: string) {
    persist({ ...config, phases: config.phases.filter(p => p.id !== id) });
    if (editingId === id) cancelEdit();
  }

  // Cumulative per phase — each phase total = monthly amount × months × people
  const phasesWithCumulative = useMemo(() => {
    let cum = 0;
    return config.phases.map(p => {
      const months = monthsBetween(p.startDate, p.endDate);
      const phaseTotal = p.amountPerPerson * months * n;
      cum += phaseTotal;
      return { ...p, months, totalPhase: phaseTotal, perPersonTotal: p.amountPerPerson * months, cumulative: cum };
    });
  }, [config.phases, n]);

  const totalPerPerson = useMemo(() => phasesWithCumulative.reduce((s, p) => s + p.perPersonTotal, 0), [phasesWithCumulative]);
  const totalGroup     = phasesWithCumulative.reduce((s, p) => s + p.totalPhase, 0);
  const target         = config.targetBudget;
  const covered        = target > 0 ? Math.min((totalGroup / target) * 100, 100) : 0;

  if (loading) return <SkeletonCards />;

  return (
    <div className="flex flex-col gap-5">
      {/* Header card */}
      <div style={{ background: `linear-gradient(135deg, ${C.navy}, ${C.navyMid})`, borderRadius: 12, padding: "22px 20px", color: C.paper, position: "relative", overflow: "hidden" }} className="dot-grid">
        <div className="glow-pulse" style={{ position: "absolute", top: -30, right: -30, width: 130, height: 130, borderRadius: 999, background: `radial-gradient(circle, ${C.gold}25, transparent 70%)`, pointerEvents: "none" }} />
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: C.gold, letterSpacing: 1.5 }}>BOTE DEL VIAJE</div>
            <div style={{ fontFamily: F.display, fontSize: "clamp(2rem,8vw,3rem)", fontWeight: 700, color: C.goldLight, lineHeight: 1, marginTop: 4 }}>
              {totalGroup.toFixed(2)} €
            </div>
            <div className="flex items-center gap-2 mt-2">
              {editN ? (
                <div className="flex items-center gap-1">
                  <input
                    value={nInput}
                    onChange={e => setNInput(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={e => { if (e.key === "Enter") saveN(); if (e.key === "Escape") setEditN(false); }}
                    style={{ ...inputStyle, width: 52, fontFamily: F.mono, fontSize: 13, textAlign: "center", padding: "4px 6px" }}
                    autoFocus
                  />
                  <button onClick={saveN} style={{ color: C.goldLight }}><Check size={14} /></button>
                  <button onClick={() => setEditN(false)} style={{ color: "#7C8AA3" }}><X size={13} /></button>
                </div>
              ) : (
                <button onClick={() => { setNInput(n.toString()); setEditN(true); }} className="flex items-center gap-1"
                  style={{ fontFamily: F.mono, fontSize: 11, color: "#9FAEC4" }}>
                  {n} {n === 1 ? "persona" : "personas"} <Edit2 size={11} color="#5C6D85" />
                </button>
              )}
              <span style={{ fontFamily: F.mono, fontSize: 11, color: "#9FAEC4" }}>· {totalPerPerson.toFixed(2)} € por persona</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div style={{ fontFamily: F.mono, fontSize: 10, color: "#7C8AA3" }}>OBJETIVO</div>
            {editTarget ? (
              <div className="flex items-center gap-2">
                <input value={targetInput} onChange={e => setTargetInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") saveTarget(); if (e.key === "Escape") setEditTarget(false); }}
                  style={{ ...inputStyle, width: 110, fontFamily: F.mono, fontSize: 14, textAlign: "right" }} autoFocus placeholder="0,00" />
                <button onClick={saveTarget} style={{ color: C.goldLight }}><Check size={16} /></button>
                <button onClick={() => setEditTarget(false)} style={{ color: "#7C8AA3" }}><X size={14} /></button>
              </div>
            ) : (
              <button onClick={() => setEditTarget(true)} className="flex items-center gap-1"
                style={{ fontFamily: F.display, fontSize: 22, fontWeight: 700, color: target > 0 ? C.goldLight : "#3A4A68" }}>
                {target > 0 ? `${target.toFixed(2)} €` : "Fijar objetivo"}
                <Edit2 size={13} color="#7C8AA3" />
              </button>
            )}
          </div>
        </div>

        {/* Progress toward target */}
        {target > 0 && (
          <div className="mt-4">
            <div style={{ background: "rgba(255,255,255,0.1)", height: 10, borderRadius: 999, overflow: "hidden" }}>
              <div className="progress-bar" style={{ background: covered >= 100 ? C.green : C.goldLight, height: "100%", width: `${covered}%`, borderRadius: 999 }} />
            </div>
            <div className="flex justify-between mt-1">
              <span style={{ fontFamily: F.mono, fontSize: 10, color: "#7C8AA3" }}>{covered.toFixed(0)}% del objetivo</span>
              {totalGroup < target && <span style={{ fontFamily: F.mono, fontSize: 10, color: "#7C8AA3" }}>Faltan {(target - totalGroup).toFixed(2)} €</span>}
              {totalGroup >= target && <span style={{ fontFamily: F.mono, fontSize: 10, color: C.green }}>✓ OBJETIVO CUBIERTO</span>}
            </div>
          </div>
        )}

        {/* Members */}
        {members.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {members.map(m => (
              <span key={m} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "#B9C3D6", fontSize: 12, fontFamily: F.mono, borderRadius: 999, padding: "3px 9px" }}>
                {m[0]?.toUpperCase()} {m}
              </span>
            ))}
          </div>
        )}
        {members.length === 0 && (
          <p style={{ fontFamily: F.mono, fontSize: 11, color: "#7C8AA3", marginTop: 8 }}>
            Únete al viaje con tu nombre para que el cálculo incluya a todas las personas.
          </p>
        )}
      </div>

      {/* Add / Edit phase form */}
      <Card>
        <SectionLabel>{editingId ? "Editar fase" : "Añadir fase de ahorro"}</SectionLabel>
        <p style={{ color: C.inkSoft, fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
          Define un período (ej. &ldquo;Agosto → Octubre&rdquo;) y cuánto aporta cada persona al mes. La app multiplica por los meses y por el número de personas.
        </p>
        <div className="flex flex-col gap-3 mt-3">
          <div className="flex flex-wrap gap-2">
            <input placeholder="Nombre de la fase  (ej. Fase 1 · Verano)" value={phaseForm.name}
              onChange={e => setPhaseForm(f => ({ ...f, name: e.target.value }))}
              style={{ ...inputStyle, flex: "2 1 180px" }} />
            <div style={{ position: "relative", flex: "0 1 130px", minWidth: 110 }}>
              <input placeholder="€/mes por persona" value={phaseForm.amountPerPerson}
                onChange={e => setPhaseForm(f => ({ ...f, amountPerPerson: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && addPhase()}
                style={{ ...inputStyle, fontFamily: F.mono, paddingRight: 22 }} />
              <Euro size={11} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: C.inkSoft }} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Field label="Inicio del ahorro">
              <input type="month" value={phaseForm.startDate} onChange={e => setPhaseForm(f => ({ ...f, startDate: e.target.value }))} style={{ ...inputStyle, flex: 1 }} />
            </Field>
            <Field label="Fin del ahorro">
              <input type="month" value={phaseForm.endDate} min={phaseForm.startDate || undefined} onChange={e => setPhaseForm(f => ({ ...f, endDate: e.target.value }))} style={{ ...inputStyle, flex: 1 }} />
            </Field>
          </div>
          {phaseErr && <Banner type="error" msg={phaseErr} />}

          {/* Preview */}
          {phaseForm.amountPerPerson && !isNaN(parseFloat(phaseForm.amountPerPerson)) && (() => {
            const amt = parseFloat(phaseForm.amountPerPerson.replace(",", "."));
            const months = phaseForm.startDate && phaseForm.endDate ? monthsBetween(phaseForm.startDate, phaseForm.endDate) : null;
            return (
              <div style={{ background: C.paperDark, borderRadius: 6, padding: "10px 14px", fontFamily: F.mono, fontSize: 12, color: C.inkSoft }}>
                {amt.toFixed(2)} €/mes × {months ?? "?"} {months ? (months === 1 ? "mes" : "meses") : "meses"} × {n} {n === 1 ? "persona" : "personas"} ={" "}
                <strong style={{ color: C.ink, fontSize: 14 }}>
                  {months ? (amt * months * n).toFixed(2) : "…"} €
                </strong>{" "}en esta fase
              </div>
            );
          })()}

          <div className="flex gap-2">
            <button onClick={addPhase} style={{ flex: 1, background: C.navy, color: C.paper, borderRadius: 5, padding: "11px 16px", fontFamily: F.mono, fontSize: 12 }}>
              {editingId ? "GUARDAR CAMBIOS" : "AÑADIR FASE"}
            </button>
            {editingId && (
              <button onClick={cancelEdit} style={{ background: C.paperDark, color: C.inkSoft, borderRadius: 5, padding: "11px 14px", fontFamily: F.mono, fontSize: 12 }}>
                CANCELAR
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Timeline of phases */}
      {phasesWithCumulative.length > 0 && (
        <div className="flex flex-col gap-3">
          <SectionLabel>Fases de ahorro</SectionLabel>
          <div className="flex flex-col gap-0 mt-1" style={{ position: "relative" }}>
            {/* Vertical line */}
            <div style={{ position: "absolute", left: 19, top: 20, bottom: 20, width: 2, background: C.line, zIndex: 0 }} />

            {phasesWithCumulative.map((phase, idx) => {
              const isLast = idx === phasesWithCumulative.length - 1;
              return (
                <div key={phase.id} className="flex gap-4 items-start" style={{ position: "relative", paddingBottom: isLast ? 0 : 20 }}>
                  {/* Circle */}
                  <div style={{ width: 40, height: 40, borderRadius: 999, background: C.navy, border: `3px solid ${C.gold}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, zIndex: 1, color: C.goldLight, fontFamily: F.mono, fontSize: 13, fontWeight: 700 }}>
                    {idx + 1}
                  </div>

                  {/* Card */}
                  <div className="flex-1 card-lift" style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, padding: "12px 14px", marginBottom: isLast ? 0 : 4 }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div style={{ fontWeight: 600, fontSize: 15, color: C.ink }}>{phase.name}</div>
                        {(phase.startDate || phase.endDate) && (
                          <div style={{ fontFamily: F.mono, fontSize: 11, color: C.inkSoft, marginTop: 2 }}>
                            {phase.startDate ? formatMonth(phase.startDate) : "?"}{" "}→{" "}{phase.endDate ? formatMonth(phase.endDate) : "?"}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => startEdit(phase)} style={{ color: C.inkSoft, padding: 4 }} aria-label="Editar"><Edit2 size={14} /></button>
                        <button onClick={() => removePhase(phase.id)} style={{ color: C.inkSoft, padding: 4 }} aria-label="Eliminar"><Trash2 size={14} /></button>
                      </div>
                    </div>

                    {/* Per person / total */}
                    <div className="flex flex-wrap gap-3 mt-3">
                      <div style={{ flex: "1 1 100px", background: C.paperDark, borderRadius: 6, padding: "8px 10px" }}>
                        <div style={{ fontFamily: F.mono, fontSize: 9, color: C.inkSoft, letterSpacing: 0.5 }}>€/MES · POR PERSONA</div>
                        <div style={{ fontFamily: F.display, fontSize: 20, fontWeight: 700, color: C.ink, marginTop: 2 }}>{phase.amountPerPerson.toFixed(2)} €</div>
                        <div style={{ fontFamily: F.mono, fontSize: 9, color: C.inkSoft, marginTop: 2 }}>× {phase.months} {phase.months === 1 ? "mes" : "meses"}</div>
                      </div>
                      <div style={{ flex: "1 1 100px", background: C.navy, borderRadius: 6, padding: "8px 10px" }}>
                        <div style={{ fontFamily: F.mono, fontSize: 9, color: C.gold, letterSpacing: 0.5 }}>TOTAL FASE</div>
                        <div style={{ fontFamily: F.display, fontSize: 20, fontWeight: 700, color: C.goldLight, marginTop: 2 }}>{phase.totalPhase.toFixed(2)} €</div>
                        <div style={{ fontFamily: F.mono, fontSize: 9, color: "#7C8AA3", marginTop: 2 }}>{n} {n === 1 ? "persona" : "personas"}</div>
                      </div>
                      <div style={{ flex: "1 1 100px", background: C.teal, borderRadius: 6, padding: "8px 10px" }}>
                        <div style={{ fontFamily: F.mono, fontSize: 9, color: "rgba(255,255,255,0.7)", letterSpacing: 0.5 }}>ACUMULADO</div>
                        <div style={{ fontFamily: F.display, fontSize: 20, fontWeight: 700, color: "#fff", marginTop: 2 }}>{phase.cumulative.toFixed(2)} €</div>
                      </div>
                    </div>

                    {/* Individual breakdown */}
                    {members.length > 1 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {members.map(m => (
                          <div key={m} className="flex items-center gap-1.5 px-2 py-1" style={{ background: C.paperDark, borderRadius: 999, fontSize: 11 }}>
                            <div style={{ width: 16, height: 16, borderRadius: 999, background: C.teal, color: "#fff", fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.mono }}>{m[0]?.toUpperCase()}</div>
                            <span style={{ fontFamily: F.mono, color: C.inkSoft }}>{m}</span>
                            <span style={{ fontFamily: F.mono, fontWeight: 600, color: C.ink }}>{phase.amountPerPerson.toFixed(2)} €</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Final total node */}
            <div className="flex gap-4 items-center" style={{ position: "relative" }}>
              <div style={{ width: 40, height: 40, borderRadius: 999, background: C.teal, border: `3px solid ${C.teal}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, zIndex: 1 }}>
                <PiggyBank size={18} color="#fff" />
              </div>
              <div style={{ flex: 1, background: C.teal, borderRadius: 8, padding: "12px 16px" }}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div style={{ fontFamily: F.mono, fontSize: 10, color: "rgba(255,255,255,0.7)", letterSpacing: 1 }}>BOTE FINAL</div>
                    <div style={{ fontFamily: F.display, fontSize: 26, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{totalGroup.toFixed(2)} €</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: F.mono, fontSize: 10, color: "rgba(255,255,255,0.7)", letterSpacing: 1 }}>POR PERSONA</div>
                    <div style={{ fontFamily: F.display, fontSize: 26, fontWeight: 700, color: C.goldLight, lineHeight: 1 }}>{totalPerPerson.toFixed(2)} €</div>
                  </div>
                </div>
                {target > 0 && (
                  <div className="mt-3" style={{ background: "rgba(255,255,255,0.12)", borderRadius: 6, padding: "6px 10px", fontFamily: F.mono, fontSize: 11, color: "rgba(255,255,255,0.9)" }}>
                    {totalGroup >= target
                      ? `✓ Presupuesto cubierto — sobran ${(totalGroup - target).toFixed(2)} €`
                      : `Objetivo: ${target.toFixed(2)} € — Faltan ${(target - totalGroup).toFixed(2)} € (${(100 - covered).toFixed(0)}%)`}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {config.phases.length === 0 && (
        <EmptyState icon={<PiggyBank size={28} color={C.line} />} text="Sin fases todavía. Añade la primera fase de ahorro." />
      )}

      {/* Help */}
      {config.phases.length === 0 && (
        <div style={{ border: `1px dashed ${C.line}`, borderRadius: 8, padding: "14px 16px" }}>
          <p style={{ color: C.inkSoft, fontSize: 13, lineHeight: 1.7 }}>
            <strong style={{ color: C.ink }}>¿Cómo funciona?</strong><br />
            Define períodos de ahorro (ej. Fase 1: agosto → octubre, Fase 2: noviembre → diciembre).
            En cada fase pones cuánto aporta cada persona a la cuenta conjunta del grupo.
            La app calcula automáticamente el bote total según el número de viajeros y te muestra cuánto tenéis acumulado al final.
          </p>
        </div>
      )}
    </div>
  );
}

