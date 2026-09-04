"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, ChevronDown, Luggage, CheckCircle2, Circle, Briefcase } from "lucide-react";
import { C, F, inputStyle } from "./theme";
import { Card, SectionLabel, EmptyState, SkeletonCards } from "./ui";
import { uid, loadShared, saveShared, peekShared } from "./utils";
import { PACKING_CATEGORIES } from "./data/constants";
import type { Session, PackingItem, Trip } from "./types";
import { AiQuickButton } from "./AiQuickButton";
import { useAnimeStagger, AnimatedIn } from "./animation";


export const PACKING_TEMPLATES: Record<string, string[]> = {
  "📄 Documentos":  ["DNI / Pasaporte", "Seguro de viaje", "Tarjeta de crédito", "Reservas imprimidas", "EHIC / tarjeta sanitaria"],
  "👕 Ropa":        ["Camisetas", "Pantalones", "Ropa interior", "Calcetines", "Abrigo / chaqueta", "Bañador", "Ropa de deporte"],
  "🔌 Electrónica": ["Cargador móvil", "Adaptador enchufe", "Auriculares", "Power bank", "Cámara de fotos"],
  "🧴 Higiene":     ["Cepillo de dientes", "Pasta de dientes", "Champú", "Desodorante", "Crema solar"],
  "💊 Medicamentos":["Analgésicos", "Antidiarreicos", "Tiritas", "Pastillas para el mareo"],
};

export function Equipaje({ code, session, trip }: { code: string; session: Session; trip: Trip }) {
  const key = `equipaje:${code}`;
  const [items, setItems] = useState<PackingItem[]>(() => peekShared<PackingItem[]>(key) ?? []);
  const [loading, setLoading] = useState(() => peekShared<PackingItem[]>(key) === undefined);
  const [activeCategory, setActiveCategory] = useState<string>(PACKING_CATEGORIES[0]);
  const [text, setText] = useState("");
  const [bag, setBag] = useState("");
  const [groupBy, setGroupBy] = useState<"categoria" | "bolsa">("categoria");
  const [expanded, setExpanded] = useState<Set<string>>(new Set(PACKING_CATEGORIES));
  const [collapsedBags, setCollapsedBags] = useState<Set<string>>(new Set());
  const sectionRef = useRef<HTMLDivElement>(null);
  useAnimeStagger(sectionRef);
  useEffect(() => { loadShared<PackingItem[]>(key, []).then(it => { setItems(it); setLoading(false); }); }, [key]);
  const persist = useCallback(async (next: PackingItem[]) => { setItems(next); await saveShared(key, next); }, [key]);

  function addItem() {
    if (!text.trim()) return;
    persist([...items, { id: uid(), text: text.trim(), category: activeCategory, checkedBy: [], bag: bag.trim() }]);
    setText("");
  }

  function addTemplate(cat: string) {
    const existing = new Set(items.filter(i => i.category === cat).map(i => i.text));
    const toAdd = (PACKING_TEMPLATES[cat] || []).filter(t => !existing.has(t)).map(text => ({ id: uid(), text, category: cat, checkedBy: [] }));
    if (toAdd.length > 0) persist([...items, ...toAdd]);
  }

  function toggleCheck(id: string) {
    persist(items.map(it => {
      if (it.id !== id) return it;
      const already = it.checkedBy.includes(session.name);
      return { ...it, checkedBy: already ? it.checkedBy.filter(x => x !== session.name) : [...it.checkedBy, session.name] };
    }));
  }

  function toggleCategory(cat: string) {
    setExpanded(prev => { const n = new Set(prev); n.has(cat) ? n.delete(cat) : n.add(cat); return n; });
  }

  function toggleBagGroup(b: string) {
    setCollapsedBags(prev => { const n = new Set(prev); n.has(b) ? n.delete(b) : n.add(b); return n; });
  }

  function setItemBag(id: string, newBag: string) {
    persist(items.map(it => it.id === id ? { ...it, bag: newBag.trim() } : it));
  }

  const existingBags = Array.from(new Set(items.map(i => i.bag).filter((b): b is string => !!b))).sort();
  const UNASSIGNED_BAG = "Sin bolsa asignada";

  const totalItems = items.length;
  const checkedItems = items.filter(it => it.checkedBy.length > 0).length;

  if (loading) return <SkeletonCards />;

  return (
    <div ref={sectionRef} className="flex flex-col gap-4">
      <div className="flex justify-end">
        <AiQuickButton code={code} trip={trip} session={session} suggestions={[
          `Añade lo esencial para el clima de ${trip.destination || "mi destino"}`,
          "¿Qué documentación no debo olvidar?",
          "Sugiéreme equipo especial para las actividades del viaje",
        ]} />
      </div>

      {/* Progress */}
      {totalItems > 0 && (
        <Card style={{ padding: "14px 18px" }}>
          <div className="flex items-center justify-between mb-2">
            <SectionLabel>Progreso del equipaje</SectionLabel>
            <span style={{ fontFamily: F.mono, fontSize: 13, color: C.inkSoft }}>{checkedItems}/{totalItems}</span>
          </div>
          <div style={{ background: C.paperDark, height: 8, borderRadius: 999, overflow: "hidden" }}>
            <div className="progress-bar" style={{ background: C.teal, height: "100%", width: `${totalItems > 0 ? (checkedItems / totalItems) * 100 : 0}%`, borderRadius: 999 }} />
          </div>
        </Card>
      )}

      {/* Add item */}
      <Card>
        <SectionLabel>Añadir elemento</SectionLabel>
        <div className="flex flex-wrap gap-2 mt-3">
          <select value={activeCategory} onChange={e => setActiveCategory(e.target.value)} style={{ ...inputStyle, flex: "1 1 160px", appearance: "none" }}>
            {PACKING_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input placeholder="Qué llevar…" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && addItem()} style={{ ...inputStyle, flex: "2 1 160px" }} />
          <input placeholder="Bolsa (opcional, p. ej. Maleta 1)" list="bag-suggestions" value={bag} onChange={e => setBag(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addItem()} style={{ ...inputStyle, flex: "1 1 160px" }} />
          <datalist id="bag-suggestions">
            {existingBags.map(b => <option key={b} value={b} />)}
          </datalist>
          <button onClick={addItem} style={{ background: C.navy, color: C.paper, borderRadius: 5, padding: "0 18px", fontFamily: F.mono, fontSize: 12, height: 39 }}>AÑADIR</button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {Object.keys(PACKING_TEMPLATES).map(cat => (
            <button key={cat} onClick={() => addTemplate(cat)} style={{ padding: "4px 10px", borderRadius: 999, fontSize: 11, fontFamily: F.mono, background: C.paperDark, color: C.inkSoft, border: `1px solid ${C.line}` }}>
              + plantilla {cat.split(" ")[0]}
            </button>
          ))}
        </div>
      </Card>

      {/* View toggle */}
      {totalItems > 0 && (
        <div className="flex items-center gap-2">
          <SectionLabel>Agrupar por</SectionLabel>
          <div className="flex gap-1">
            <button onClick={() => setGroupBy("categoria")} style={{ padding: "4px 12px", borderRadius: 999, fontSize: 11, fontFamily: F.mono, background: groupBy === "categoria" ? C.navy : C.paperDark, color: groupBy === "categoria" ? C.paper : C.inkSoft, border: `1px solid ${C.line}` }}>
              Categoría
            </button>
            <button onClick={() => setGroupBy("bolsa")} style={{ padding: "4px 12px", borderRadius: 999, fontSize: 11, fontFamily: F.mono, background: groupBy === "bolsa" ? C.navy : C.paperDark, color: groupBy === "bolsa" ? C.paper : C.inkSoft, border: `1px solid ${C.line}` }}>
              Bolsa
            </button>
          </div>
        </div>
      )}

      {/* By bag */}
      {groupBy === "bolsa" && [...existingBags, ...(items.some(i => !i.bag) ? [UNASSIGNED_BAG] : [])].map(b => {
        const bagItems = items.filter(it => (it.bag || UNASSIGNED_BAG) === b);
        if (bagItems.length === 0) return null;
        const isExpanded = !collapsedBags.has(b);
        const doneCount = bagItems.filter(it => it.checkedBy.length > 0).length;
        return (
          <Card key={b} style={{ padding: 0, overflow: "hidden" }}>
            <button onClick={() => toggleBagGroup(b)} className="w-full flex items-center justify-between px-4 py-3"
              style={{ borderBottom: isExpanded ? `1px solid ${C.line}` : "none" }}>
              <div className="flex items-center gap-2">
                <Briefcase size={14} color={C.inkSoft} />
                <span style={{ fontFamily: F.mono, fontSize: 12, color: C.ink, fontWeight: 600 }}>{b}</span>
                <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkSoft }}>({doneCount}/{bagItems.length})</span>
              </div>
              <ChevronDown size={14} color={C.inkSoft} style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
            </button>
            {isExpanded && (
              <div className="flex flex-col">
                {bagItems.map(it => {
                  const isMeChecked = it.checkedBy.includes(session.name);
                  return (
                    <div key={it.id} className="flex items-center gap-3 px-4 py-2" style={{ borderBottom: `1px solid ${C.paperDark}` }}>
                      <button onClick={() => toggleCheck(it.id)} style={{ flexShrink: 0 }}>
                        {isMeChecked ? <CheckCircle2 size={20} color={C.teal} /> : <Circle size={20} color={C.line} />}
                      </button>
                      <span style={{ flex: 1, fontSize: 14, textDecoration: isMeChecked ? "line-through" : "none", color: isMeChecked ? C.inkSoft : C.ink }}>{it.text}</span>
                      <input defaultValue={it.bag || ""} list="bag-suggestions" placeholder="Sin bolsa"
                        onBlur={e => e.target.value.trim() !== (it.bag || "") && setItemBag(it.id, e.target.value)}
                        onKeyDown={e => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                        style={{ ...inputStyle, width: 110, height: 28, fontSize: 11, padding: "0 8px" }} />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })}

      {/* By category */}
      {groupBy === "categoria" && PACKING_CATEGORIES.map(cat => {
        const catItems = items.filter(it => it.category === cat);
        if (catItems.length === 0) return null;
        const isExpanded = expanded.has(cat);
        const doneCount = catItems.filter(it => it.checkedBy.length > 0).length;
        return (
          <Card key={cat} style={{ padding: 0, overflow: "hidden" }}>
            <button onClick={() => toggleCategory(cat)} className="w-full flex items-center justify-between px-4 py-3"
              style={{ borderBottom: isExpanded ? `1px solid ${C.line}` : "none" }}>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 16 }}>{cat.split(" ")[0]}</span>
                <span style={{ fontFamily: F.mono, fontSize: 12, color: C.ink, fontWeight: 600 }}>{cat.split(" ").slice(1).join(" ")}</span>
                <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkSoft }}>({doneCount}/{catItems.length})</span>
              </div>
              <ChevronDown size={14} color={C.inkSoft} style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
            </button>
            {isExpanded && (
              <div className="flex flex-col">
                {catItems.map(it => {
                  const isMeChecked = it.checkedBy.includes(session.name);
                  const othersChecked = it.checkedBy.filter(x => x !== session.name);
                  return (
                    <AnimatedIn key={it.id}>
                      <div className="flex items-center gap-3 px-4 py-2" style={{ borderBottom: `1px solid ${C.paperDark}` }}>
                        <button onClick={() => toggleCheck(it.id)} style={{ flexShrink: 0 }}>
                          {isMeChecked
                            ? <CheckCircle2 size={20} color={C.teal} />
                            : <Circle size={20} color={C.line} />}
                        </button>
                        <span style={{ flex: 1, fontSize: 14, textDecoration: isMeChecked ? "line-through" : "none", color: isMeChecked ? C.inkSoft : C.ink }}>{it.text}</span>
                        {othersChecked.length > 0 && (
                          <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkSoft }}>✓ {othersChecked.join(", ")}</span>
                        )}
                        <button onClick={() => persist(items.filter(x => x.id !== it.id))} style={{ color: C.inkSoft, padding: 4 }}><X size={13} /></button>
                      </div>
                    </AnimatedIn>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })}

      {items.length === 0 && <EmptyState icon={<Luggage size={28} color={C.line} />} text="La maleta está vacía. Añade elementos o usa las plantillas." />}
    </div>
  );
}

