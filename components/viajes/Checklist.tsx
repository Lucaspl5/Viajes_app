"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { ListChecks, Check, Trash2, Euro, ChevronDown } from "lucide-react";
import { C, F, inputStyle } from "./theme";
import { Card, SectionLabel, EmptyState, SkeletonCards } from "./ui";
import { uid, loadShared, saveShared } from "./utils";
import type { Session, ChecklistItem } from "./types";


export function Checklist({ code, session }: { code: string; session: Session }) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState(""); const [cost, setCost] = useState("");
  const [showBreak, setShowBreak] = useState(false);
  const key = `checklist:${code}`;
  useEffect(() => { loadShared<ChecklistItem[]>(key, []).then(it => { setItems(it); setLoading(false); }); }, [key]);
  const persist = useCallback(async (next: ChecklistItem[]) => { setItems(next); await saveShared(key, next); }, [key]);

  function addItem() {
    if (!text.trim()) return;
    const c = parseFloat(cost.replace(",", "."));
    persist([...items, { id: uid(), text: text.trim(), done: false, cost: isNaN(c) || c < 0 ? 0 : c, by: session.name, addedAt: Date.now() }]);
    setText(""); setCost("");
  }

  const total = useMemo(() => items.reduce((s, it) => s + (it.cost || 0), 0), [items]);
  const done  = useMemo(() => items.filter(it => it.done).reduce((s, it) => s + (it.cost || 0), 0), [items]);
  const pct   = total > 0 ? (done / total) * 100 : 0;
  const breakdown = useMemo(() => {
    const m: Record<string, { total: number; done: number }> = {};
    items.forEach(it => { if (!m[it.by]) m[it.by] = { total: 0, done: 0 }; m[it.by].total += it.cost || 0; if (it.done) m[it.by].done += it.cost || 0; });
    return Object.entries(m).sort((a, b) => b[1].total - a[1].total);
  }, [items]);

  if (loading) return <SkeletonCards />;
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap gap-2">
          <input placeholder="Tarea o gasto…" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && addItem()} style={{ ...inputStyle, flex: "2 1 160px" }} />
          <div style={{ position: "relative", width: 96 }}>
            <input placeholder="0,00" value={cost} onChange={e => setCost(e.target.value)} onKeyDown={e => e.key === "Enter" && addItem()} style={{ ...inputStyle, fontFamily: F.mono, paddingRight: 22 }} />
            <Euro size={11} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: C.inkSoft }} />
          </div>
          <button onClick={addItem} style={{ background: C.navy, color: C.paper, borderRadius: 5, padding: "0 18px", fontFamily: F.mono, fontSize: 12, height: 39 }}>AÑADIR</button>
        </div>
      </Card>
      <Card>
        <div className="flex items-center justify-between mb-2">
          <SectionLabel>Coste de la lista</SectionLabel>
          <span style={{ fontFamily: F.mono, fontSize: 13, color: C.inkSoft }}>{done.toFixed(2)} € / {total.toFixed(2)} €</span>
        </div>
        <div style={{ background: C.paperDark, height: 8, borderRadius: 999, overflow: "hidden" }}>
          <div className="progress-bar" style={{ background: C.teal, height: "100%", width: `${pct}%`, borderRadius: 999 }} />
        </div>
        <p style={{ fontSize: 12, color: C.inkSoft, marginTop: 6 }}>{pct.toFixed(0)}% pagado · {items.filter(it => it.done).length}/{items.length} tareas</p>
        {breakdown.length > 0 && (
          <>
            <button onClick={() => setShowBreak(v => !v)} className="flex items-center gap-1 mt-3" style={{ fontFamily: F.mono, fontSize: 11, color: C.inkSoft }}>
              <ChevronDown size={13} style={{ transform: showBreak ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} /> DESGLOSE POR PERSONA
            </button>
            {showBreak && (
              <div className="flex flex-col gap-2 mt-3">
                {breakdown.map(([p, d]) => (
                  <div key={p} className="flex items-center gap-3">
                    <div style={{ width: 22, height: 22, borderRadius: 999, background: p.toLowerCase() === session.name.toLowerCase() ? C.red : C.teal, color: "#fff", fontSize: 11, fontFamily: F.mono, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{p[0]?.toUpperCase()}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between" style={{ fontSize: 13 }}><span>{p}</span><span style={{ fontFamily: F.mono, fontSize: 12 }}>{d.done.toFixed(2)} / {d.total.toFixed(2)} €</span></div>
                      <div style={{ background: C.paperDark, height: 4, borderRadius: 999, marginTop: 3, overflow: "hidden" }}><div className="progress-bar" style={{ background: C.teal, height: "100%", width: d.total > 0 ? `${(d.done / d.total) * 100}%` : "0%", borderRadius: 999 }} /></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Card>
      <div className="flex flex-col gap-2">
        {items.map(it => (
          <div key={it.id} className="flex items-center gap-3 px-3 py-2" style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 6 }}>
            <button onClick={() => persist(items.map(x => x.id === it.id ? { ...x, done: !x.done } : x))} style={{ flexShrink: 0 }}>
              <div style={{ width: 20, height: 20, borderRadius: 5, border: `1.5px solid ${it.done ? C.teal : C.line}`, background: it.done ? C.teal : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
                {it.done && <Check size={13} color="#fff" strokeWidth={2.5} />}
              </div>
            </button>
            <div className="flex-1 min-w-0">
              <span style={{ fontSize: 14, textDecoration: it.done ? "line-through" : "none", color: it.done ? C.inkSoft : C.ink }}>{it.text}</span>
              <div style={{ fontFamily: F.mono, fontSize: 11, color: C.inkSoft, marginTop: 1 }}>{it.cost > 0 ? `${it.cost.toFixed(2)} € · ` : ""}{it.by}</div>
            </div>
            <button onClick={() => persist(items.filter(x => x.id !== it.id))} style={{ color: C.inkSoft, padding: 4 }}><Trash2 size={14} /></button>
          </div>
        ))}
        {items.length === 0 && <EmptyState icon={<ListChecks size={28} color={C.line} />} text="Lista vacía — añade la primera tarea." />}
      </div>
    </div>
  );
}

