"use client";

import { useState, useEffect, useRef } from "react";
import { RefreshCw, Sparkles, Send, Download, Check } from "lucide-react";
import { C, F, inputStyle } from "./theme";
import { Card, SectionLabel, Banner } from "./ui";
import { uid } from "./utils";
import { loadAiContext, buildSystemPrompt, parseItinerary, parseActions, stripActionBlocks, actionLabel, applyAction, type AiAction, type AiContext } from "./ai";
import type { Trip, Session, ItineraryDay, ChatMsg } from "./types";

export function AsistenteIA({ code, trip, session, onImportItinerary }: {
  code: string; trip: Trip; session: Session;
  onImportItinerary: (days: ItineraryDay[]) => void;
}) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [noKey, setNoKey] = useState(false);
  const [context, setContext] = useState<AiContext | null>(null);
  const [appliedIdx, setAppliedIdx] = useState<Set<number>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadAiContext(code).then(setContext); }, [code]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, streaming]);

  async function send(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text || streaming) return;
    setInput("");
    const newMsgs: ChatMsg[] = [...msgs, { role: "user", content: text }];
    setMsgs(newMsgs);
    setStreaming(true);
    setNoKey(false);

    const ctx = context ?? await loadAiContext(code);
    if (!context) setContext(ctx);
    const systemPrompt = buildSystemPrompt(trip, ctx);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          system: systemPrompt,
          messages: newMsgs.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (res.status === 503) {
        setNoKey(true);
        setMsgs(m => [...m, { role: "assistant", content: "⚠️ No hay clave ANTHROPIC_API_KEY configurada en Vercel. Añádela en Settings → Environment Variables." }]);
        setStreaming(false);
        return;
      }

      if (!res.ok || !res.body) {
        setMsgs(m => [...m, { role: "assistant", content: "Error al conectar con la IA. Inténtalo de nuevo." }]);
        setStreaming(false);
        return;
      }

      // Parse SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      setMsgs(m => [...m, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            // Anthropic SSE: event type content_block_delta
            if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
              fullText += parsed.delta.text;
              setMsgs(m => [...m.slice(0, -1), { role: "assistant", content: fullText }]);
            }
          } catch { /* skip malformed events */ }
        }
      }
    } catch {
      setMsgs(m => [...m, { role: "assistant", content: "Error de red. Comprueba tu conexión." }]);
    }
    setStreaming(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  const lastAssistantMsg = [...msgs].reverse().find(m => m.role === "assistant");
  const itinerary = lastAssistantMsg ? parseItinerary(lastAssistantMsg.content) : null;
  const actions = lastAssistantMsg ? parseActions(lastAssistantMsg.content) : null;

  async function handleApplyAction(a: AiAction, idx: number) {
    await applyAction(code, session, a);
    setAppliedIdx(prev => new Set(prev).add(idx));
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={16} color={C.purple} />
          <SectionLabel>Asistente de Planificación</SectionLabel>
        </div>
        <p style={{ color: C.inkSoft, fontSize: 13 }}>
          Pídeme un itinerario, consejos, o que añada gastos, equipaje, ideas o reservas directamente a {trip.destination || "tu viaje"}.
        </p>
      </Card>

      {/* Chat messages */}
      <div className="flex flex-col gap-3" style={{ minHeight: 200 }}>
        {msgs.length === 0 && (
          <div className="flex flex-col gap-2">
            {[
              `Crea un itinerario de ${trip.destination || "mi viaje"} para ${trip.members.length} personas`,
              "¿Qué presupuesto diario necesito?",
              "Añade protector solar y adaptador de corriente al equipaje",
              "Dame 5 restaurantes imprescindibles",
            ].map(s => (
              <button key={s} onClick={() => { setInput(s); inputRef.current?.focus(); }}
                style={{ textAlign: "left", background: C.paperDark, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: C.ink, cursor: "pointer", transition: "background 0.15s" }}
                onMouseOver={e => (e.currentTarget.style.background = C.line)}
                onMouseOut={e => (e.currentTarget.style.background = C.paperDark)}>
                ✦ {s}
              </button>
            ))}
          </div>
        )}

        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "85%",
              background: m.role === "user" ? C.navy : "#fff",
              color: m.role === "user" ? "#fff" : C.ink,
              border: m.role === "assistant" ? `1px solid ${C.line}` : "none",
              borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              padding: "10px 14px",
              fontSize: 14,
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}>
              {m.role === "assistant" ? stripActionBlocks(m.content) : m.content}
              {m.role === "assistant" && streaming && i === msgs.length - 1 && (
                <span style={{ display: "inline-block", width: 8, height: 14, background: C.inkSoft, borderRadius: 2, marginLeft: 2, animation: "fadeIn 0.5s ease infinite alternate" }} />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Import itinerary button */}
      {itinerary && !streaming && (
        <Card style={{ background: `${C.teal}10`, border: `1px solid ${C.teal}40` }}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p style={{ fontWeight: 600, fontSize: 14 }}>Itinerario generado — {itinerary.length} días</p>
              <p style={{ color: C.inkSoft, fontSize: 12 }}>Importar reemplazará el itinerario actual</p>
            </div>
            <button onClick={() => {
              const importDays: ItineraryDay[] = itinerary.map((d, i) => {
                let date = "";
                if (trip.startDate) {
                  const dt = new Date(trip.startDate + "T12:00:00");
                  dt.setDate(dt.getDate() + i);
                  date = dt.toISOString().slice(0, 10);
                }
                return {
                  id: uid(), date, title: d.title,
                  items: d.items.map(it => ({ id: uid(), time: it.time, text: it.text })),
                };
              });
              onImportItinerary(importDays);
            }} style={{ display: "flex", alignItems: "center", gap: 6, background: C.teal, color: "#fff", borderRadius: 6, padding: "9px 16px", fontFamily: F.mono, fontSize: 12 }}>
              <Download size={13} /> IMPORTAR AL PLAN
            </button>
          </div>
        </Card>
      )}

      {/* Proposed actions */}
      {actions && actions.length > 0 && !streaming && (
        <Card style={{ background: `${C.purple}0D`, border: `1px solid ${C.purple}40` }}>
          <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Propuesta de la IA — {actions.length} elemento{actions.length !== 1 ? "s" : ""}</p>
          <div className="flex flex-col gap-2">
            {actions.map((a, i) => {
              const applied = appliedIdx.has(i);
              return (
                <div key={i} className="flex items-center justify-between gap-2" style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 6, padding: "8px 12px" }}>
                  <span style={{ fontSize: 13 }}>{actionLabel(a)}</span>
                  <button disabled={applied} onClick={() => handleApplyAction(a, i)}
                    style={{ display: "flex", alignItems: "center", gap: 4, background: applied ? C.green : C.purple, color: "#fff", borderRadius: 5, padding: "6px 10px", fontFamily: F.mono, fontSize: 11, opacity: applied ? 0.75 : 1 }}>
                    {applied ? <><Check size={12} /> AÑADIDO</> : "AÑADIR"}
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
          placeholder={streaming ? "La IA está respondiendo…" : "Escribe tu pregunta…"}
          disabled={streaming}
          style={{ ...inputStyle, flex: 1, fontSize: 14 }} />
        <button onClick={() => send()} disabled={streaming || !input.trim()}
          style={{ background: (streaming || !input.trim()) ? C.inkSoft : C.purple, color: "#fff", borderRadius: 6, padding: "0 16px", display: "flex", alignItems: "center", gap: 6, fontFamily: F.mono, fontSize: 12, transition: "background 0.15s", minWidth: 56 }}>
          {streaming ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </div>
      {noKey && (
        <Banner type="error" msg='Añade ANTHROPIC_API_KEY en Vercel → Settings → Environment Variables → Redeploy' />
      )}
    </div>
  );
}
