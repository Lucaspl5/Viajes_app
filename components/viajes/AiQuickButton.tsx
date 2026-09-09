"use client";

import { useState, useRef } from "react";
import { Sparkles, X, RefreshCw, Send, Check, Download } from "lucide-react";
import { C, F, inputStyle } from "./theme";
import { uid } from "./utils";
import { loadAiContext, buildSystemPrompt, parseItinerary, parseActions, stripActionBlocks, actionLabel, applyAction, type AiAction } from "./ai";
import type { Trip, Session, ItineraryDay } from "./types";

// Compact "ask the AI" popover embeddable in any tab — reuses the same
// context/action pipeline as the full AsistenteIA chat, so a suggestion
// accepted here shows up immediately in Gastos/Equipaje/etc.
export function AiQuickButton({ code, trip, session, suggestions, onImportItinerary }: {
  code: string; trip: Trip; session: Session; suggestions: string[];
  onImportItinerary?: (days: ItineraryDay[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [appliedIdx, setAppliedIdx] = useState<Set<number>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const itinerary = answer ? parseItinerary(answer) : null;
  const actions = answer ? parseActions(answer) : null;

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true); setError(""); setAnswer(""); setAppliedIdx(new Set());
    try {
      const ctx = await loadAiContext(code);
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, system: buildSystemPrompt(trip, ctx), messages: [{ role: "user", content: q }] }),
      });
      if (res.status === 503) { setError("Falta configurar ANTHROPIC_API_KEY en Vercel."); setBusy(false); return; }
      if (res.status === 402) { setError("✨ Has usado tus 10 mensajes gratis con el asistente en este viaje. Hazte Premium (pestaña Inicio) para seguir sin límite."); setBusy(false); return; }
      if (!res.ok || !res.body) { setError("No se pudo conectar con la IA. Inténtalo de nuevo."); setBusy(false); return; }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
              full += parsed.delta.text;
              setAnswer(full);
            }
          } catch { /* skip */ }
        }
      }
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
    }
    setBusy(false);
  }

  async function handleApply(a: AiAction, idx: number) {
    await applyAction(code, session, a);
    setAppliedIdx(prev => new Set(prev).add(idx));
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="btn-press flex items-center gap-1.5"
        style={{ background: `${C.purple}14`, border: `1px solid ${C.purple}40`, color: C.purple, borderRadius: 999, padding: "6px 12px", fontFamily: F.mono, fontSize: 11, fontWeight: 600 }}>
        <Sparkles size={12} /> PREGUNTAR A LA IA
      </button>

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(11,25,48,0.55)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }} className="sm:items-center">
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, maxHeight: "80vh", overflowY: "auto", background: "#fff", borderRadius: "16px 16px 0 0", padding: 20 }} className="sm:rounded-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={16} color={C.purple} />
                <span style={{ fontFamily: F.mono, fontSize: 12, fontWeight: 700, color: C.ink, letterSpacing: 0.5 }}>PREGUNTAR A LA IA</span>
              </div>
              <button onClick={() => setOpen(false)} style={{ color: C.inkSoft, padding: 4 }}><X size={16} /></button>
            </div>

            {!answer && !busy && (
              <div className="flex flex-col gap-2">
                {suggestions.map(s => (
                  <button key={s} onClick={() => ask(s)}
                    style={{ textAlign: "left", background: C.paperDark, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: C.ink }}>
                    ✦ {s}
                  </button>
                ))}
              </div>
            )}

            {busy && !answer && (
              <div className="flex items-center gap-2" style={{ color: C.inkSoft, fontSize: 13, padding: "12px 0" }}>
                <RefreshCw size={14} className="animate-spin" /> Pensando…
              </div>
            )}

            {answer && (
              <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 8, padding: 12, fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {stripActionBlocks(answer)}
                {busy && <span style={{ display: "inline-block", width: 8, height: 14, background: C.inkSoft, borderRadius: 2, marginLeft: 2 }} />}
              </div>
            )}

            {itinerary && !busy && onImportItinerary && (
              <button onClick={() => {
                const importDays: ItineraryDay[] = itinerary.map((d, i) => {
                  let date = "";
                  if (trip.startDate) {
                    const dt = new Date(trip.startDate + "T12:00:00");
                    dt.setDate(dt.getDate() + i);
                    date = dt.toISOString().slice(0, 10);
                  }
                  return { id: uid(), date, title: d.title, items: d.items.map(it => ({ id: uid(), time: it.time, text: it.text })) };
                });
                onImportItinerary(importDays);
                setOpen(false);
              }} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: C.teal, color: "#fff", borderRadius: 6, padding: "9px 16px", fontFamily: F.mono, fontSize: 12 }}>
                <Download size={13} /> IMPORTAR AL PLAN
              </button>
            )}

            {actions && actions.length > 0 && !busy && (
              <div className="flex flex-col gap-2">
                {actions.map((a, i) => {
                  const applied = appliedIdx.has(i);
                  return (
                    <div key={i} className="flex items-center justify-between gap-2" style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 6, padding: "8px 12px" }}>
                      <span style={{ fontSize: 13 }}>{actionLabel(a)}</span>
                      <button disabled={applied} onClick={() => handleApply(a, i)}
                        style={{ display: "flex", alignItems: "center", gap: 4, background: applied ? C.green : C.purple, color: "#fff", borderRadius: 5, padding: "6px 10px", fontFamily: F.mono, fontSize: 11, opacity: applied ? 0.75 : 1 }}>
                        {applied ? <><Check size={12} /> AÑADIDO</> : "AÑADIR"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {error && <p style={{ color: C.red, fontSize: 12 }}>{error}</p>}

            <div className="flex gap-2">
              <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (ask(input), setInput(""))}
                placeholder="Escribe tu pregunta…" disabled={busy}
                style={{ ...inputStyle, flex: 1, fontSize: 14 }} />
              <button onClick={() => { ask(input); setInput(""); }} disabled={busy || !input.trim()}
                style={{ background: (busy || !input.trim()) ? C.inkSoft : C.purple, color: "#fff", borderRadius: 6, padding: "0 14px", display: "flex", alignItems: "center" }}>
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
