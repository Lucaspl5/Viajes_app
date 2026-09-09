"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, X, FileWarning } from "lucide-react";
import { C, F, inputStyle } from "./theme";
import { EmptyState, SkeletonCards, useCountdown } from "./ui";
import { uid, loadShared, saveShared, peekShared } from "./utils";
import type { TravelDocument } from "./types";

const KIND_LABELS: Record<TravelDocument["kind"], { label: string; emoji: string }> = {
  pasaporte: { label: "Pasaporte", emoji: "🛂" },
  visado: { label: "Visado", emoji: "📄" },
  seguro: { label: "Seguro de viaje", emoji: "🛡️" },
  checkin: { label: "Check-in de vuelo", emoji: "🧳" },
  otro: { label: "Otro", emoji: "📋" },
};

function DocRow({ doc, darkMode, onDelete }: { doc: TravelDocument; darkMode: boolean; onDelete: () => void }) {
  const days = useCountdown(doc.dueDate || null);
  const cardBg = darkMode ? "#161B22" : "#fff";
  const cardBorder = darkMode ? "#30363D" : C.line;
  const textColor = darkMode ? "#E6EDF3" : C.ink;
  const softColor = darkMode ? "#8B949E" : C.inkSoft;
  const urgent = days !== null && days <= 30;

  return (
    <div style={{ background: cardBg, border: `1px solid ${urgent ? C.red + "55" : cardBorder}`, borderRadius: 10, padding: "10px 14px" }} className="flex items-center gap-3">
      <span style={{ fontSize: 20 }}>{KIND_LABELS[doc.kind].emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: textColor }}>{doc.title || KIND_LABELS[doc.kind].label}</div>
        {doc.dueDate && (
          <div style={{ fontFamily: F.mono, fontSize: 10, color: urgent ? C.red : softColor }}>
            {days !== null && days >= 0 ? `${days} días restantes` : "vencido"} · {doc.dueDate}
          </div>
        )}
        {doc.notes && <div style={{ fontSize: 12, color: softColor, marginTop: 2 }}>{doc.notes}</div>}
      </div>
      <button onClick={onDelete} style={{ color: C.red, padding: 4 }}><Trash2 size={13} /></button>
    </div>
  );
}

export function Documentos({ code, darkMode }: { code: string; darkMode: boolean }) {
  const key = `documentos:${code}`;
  const [docs, setDocs] = useState<TravelDocument[]>(() => peekShared<TravelDocument[]>(key) ?? []);
  const [loading, setLoading] = useState(() => peekShared<TravelDocument[]>(key) === undefined);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<TravelDocument, "id">>({ kind: "pasaporte", title: "", dueDate: "", notes: "" });

  useEffect(() => { loadShared<TravelDocument[]>(key, []).then(d => { setDocs(d); setLoading(false); }); }, [key]);
  const persist = useCallback(async (next: TravelDocument[]) => { setDocs(next); await saveShared(key, next); }, [key]);

  const cardBg = darkMode ? "#161B22" : "#fff";
  const cardBorder = darkMode ? "#30363D" : C.line;
  const textColor = darkMode ? "#E6EDF3" : C.ink;
  const softColor = darkMode ? "#8B949E" : C.inkSoft;

  function openAdd() {
    setForm({ kind: "pasaporte", title: "", dueDate: "", notes: "" });
    setShowForm(true);
  }

  function save() {
    persist([...docs, { ...form, id: uid() }]);
    setShowForm(false);
  }

  const sorted = [...docs].sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));
  const formInStyle = { ...inputStyle, background: cardBg, color: textColor, border: `1px solid ${cardBorder}` };

  if (loading) return <SkeletonCards />;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <FileWarning size={15} color={softColor} />
        <span style={{ fontFamily: F.mono, fontSize: 11, color: softColor, letterSpacing: 1 }}>DOCUMENTOS Y RECORDATORIOS</span>
      </div>

      <button onClick={openAdd} style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6, background: C.teal, color: "#fff", borderRadius: 8, padding: "8px 14px", fontFamily: F.mono, fontSize: 11, fontWeight: 700 }}>
        <Plus size={13} /> AÑADIR RECORDATORIO
      </button>

      {showForm && (
        <div className="fade-in" style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", flexDirection: "column", background: "#000a" }} onClick={() => setShowForm(false)}>
          <div onClick={e => e.stopPropagation()} style={{ marginTop: "auto", background: darkMode ? "#0D1117" : C.paper, borderRadius: "20px 20px 0 0", maxHeight: "85dvh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "18px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div style={{ fontFamily: F.display, fontSize: 18, fontWeight: 700, color: textColor }}>Nuevo recordatorio</div>
              <button onClick={() => setShowForm(false)}><X size={18} color={softColor} /></button>
            </div>
            <div className="overflow-y-auto" style={{ flex: 1, padding: "16px 20px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="flex gap-2 flex-wrap">
                {(Object.keys(KIND_LABELS) as TravelDocument["kind"][]).map(k => (
                  <button key={k} onClick={() => setForm(f => ({ ...f, kind: k }))}
                    style={{ padding: "6px 12px", borderRadius: 8, fontFamily: F.mono, fontSize: 11, background: form.kind === k ? C.navy : (darkMode ? "#161B22" : "#fff"), color: form.kind === k ? "#fff" : softColor, border: `1px solid ${form.kind === k ? C.navy : cardBorder}` }}>
                    {KIND_LABELS[k].emoji} {KIND_LABELS[k].label}
                  </button>
                ))}
              </div>
              <input placeholder="Título (opcional, ej. Pasaporte de Ana)" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={formInStyle} />
              <div>
                <div style={{ fontFamily: F.mono, fontSize: 9, color: softColor, marginBottom: 4 }}>FECHA LÍMITE</div>
                <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} style={formInStyle} />
              </div>
              <textarea placeholder="Notas (opcional)" value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                style={{ ...formInStyle, minHeight: 60, resize: "vertical" }} />
              <button onClick={save} style={{ background: C.teal, color: "#fff", borderRadius: 8, padding: "12px 16px", fontFamily: F.mono, fontSize: 12, fontWeight: 700 }}>
                AÑADIR RECORDATORIO
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {sorted.map(d => (
          <DocRow key={d.id} doc={d} darkMode={darkMode} onDelete={() => persist(docs.filter(x => x.id !== d.id))} />
        ))}
        {docs.length === 0 && <EmptyState icon={<FileWarning size={24} color={C.line} />} text="Sin recordatorios. Añade pasaporte, visado, seguro o check-in." />}
      </div>
    </div>
  );
}
