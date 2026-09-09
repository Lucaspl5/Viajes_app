"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Wallet2, Camera, Trash2, X, WifiOff } from "lucide-react";
import { C, F, inputStyle } from "./theme";
import { Card, SectionLabel, Banner, EmptyState, SkeletonCards } from "./ui";
import { uid, loadShared, saveShared, peekShared } from "./utils";
import { compressImage } from "./Fotos";
import type { Session, DocScan, Trip } from "./types";
import { useAnimeStagger, AnimatedIn } from "./animation";

const DOC_TYPES: { value: DocScan["type"]; label: string }[] = [
  { value: "pasaporte", label: "Pasaporte" },
  { value: "dni", label: "DNI / ID" },
  { value: "seguro", label: "Seguro de viaje" },
  { value: "visado", label: "Visado" },
  { value: "vacuna", label: "Certificado vacunas" },
  { value: "otro", label: "Otro" },
];

export function Cartera({ code, session, trip }: { code: string; session: Session; trip: Trip }) {
  const key = `cartera:${code}`;
  const [docs, setDocs] = useState<DocScan[]>(() => peekShared<DocScan[]>(key) ?? []);
  const [loading, setLoading] = useState(() => peekShared<DocScan[]>(key) === undefined);
  const [form, setForm] = useState({ type: DOC_TYPES[0].value, owner: session.name, label: "", notes: "" });
  const [err, setErr] = useState("");
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<DocScan | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  useAnimeStagger(sectionRef);

  useEffect(() => { loadShared<DocScan[]>(key, []).then(d => { setDocs(d); setLoading(false); }); }, [key]);
  const persist = useCallback(async (next: DocScan[]) => { setDocs(next); await saveShared(key, next); }, [key]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setErr("");
    try {
      const dataUrl = await compressImage(file);
      const doc: DocScan = {
        id: uid(), type: form.type, owner: form.owner, label: form.label.trim() || DOC_TYPES.find(t => t.value === form.type)!.label,
        imageUrl: dataUrl, notes: form.notes.trim(), addedAt: Date.now(),
      };
      await persist([doc, ...docs]);
      setForm({ type: DOC_TYPES[0].value, owner: session.name, label: "", notes: "" });
    } catch { setErr("Error al procesar la imagen."); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  const byOwner = docs.reduce<Record<string, DocScan[]>>((acc, d) => {
    (acc[d.owner] ??= []).push(d);
    return acc;
  }, {});

  if (loading) return <SkeletonCards />;
  return (
    <>
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ position: "relative", maxWidth: 720, width: "100%" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox.imageUrl} alt={lightbox.label} style={{ width: "100%", borderRadius: 8, maxHeight: "80vh", objectFit: "contain" }} />
            <p style={{ color: "#fff", fontSize: 14, marginTop: 10, textAlign: "center" }}>{lightbox.label} · {lightbox.owner}</p>
            {lightbox.notes && <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 4, textAlign: "center" }}>{lightbox.notes}</p>}
            <button onClick={() => setLightbox(null)} style={{ position: "absolute", top: -14, right: -14, background: C.red, color: "#fff", borderRadius: 999, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center" }}><X size={15} /></button>
          </div>
        </div>
      )}
      <div ref={sectionRef} className="flex flex-col gap-4">
        <div className="flex items-start gap-2" style={{ background: "#F0F7FF", border: "1px solid #C8DEFF", borderRadius: 10, padding: "10px 14px" }}>
          <WifiOff size={14} color={C.sky} style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ flex: 1, fontSize: 12, color: C.inkSoft, lineHeight: 1.5, margin: 0 }}>
            Guarda aquí fotos de pasaporte, DNI, seguro o visado. Se guardan también en este dispositivo, así que puedes verlas <strong style={{ color: C.ink }}>sin conexión</strong> durante el viaje.
          </p>
        </div>

        <Card>
          <SectionLabel>Añadir documento</SectionLabel>
          <div className="flex flex-wrap gap-2 mt-2">
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as DocScan["type"] }))} style={{ ...inputStyle, flex: "1 1 140px", appearance: "none" }}>
              {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} style={{ ...inputStyle, flex: "1 1 120px", appearance: "none" }}>
              {trip.members.map(m => <option key={m} value={m}>{m}</option>)}
              {!trip.members.includes(session.name) && <option value={session.name}>{session.name}</option>}
            </select>
          </div>
          <input placeholder="Etiqueta (ej. Seguro Mapfre nº 12345)" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} style={{ ...inputStyle, width: "100%", marginTop: 8, boxSizing: "border-box" }} />
          <input placeholder="Notas (opcional)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ ...inputStyle, width: "100%", marginTop: 8, boxSizing: "border-box" }} />
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFileChange} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            style={{ display: "flex", alignItems: "center", gap: 8, background: uploading ? C.inkSoft : C.navy, color: C.paper, borderRadius: 6, padding: "10px 16px", fontFamily: F.mono, fontSize: 12, width: "100%", justifyContent: "center", marginTop: 10 }}>
            <Camera size={14} /> {uploading ? "SUBIENDO…" : "HACER FOTO / SUBIR IMAGEN"}
          </button>
          {err && <Banner type="error" msg={err} />}
        </Card>

        {Object.entries(byOwner).map(([owner, items]) => (
          <div key={owner} className="flex flex-col gap-2">
            <SectionLabel>{owner}</SectionLabel>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {items.map(d => (
                <AnimatedIn key={d.id}>
                  <div className="card-lift" style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, padding: 8 }}>
                    <div onClick={() => setLightbox(d)} style={{ width: "100%", paddingBottom: "100%", position: "relative", background: C.paperDark, borderRadius: 5, overflow: "hidden", cursor: "zoom-in" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={d.imageUrl} alt={d.label} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                    <span style={{ fontFamily: F.mono, fontSize: 9, color: C.teal, letterSpacing: 0.5 }}>{DOC_TYPES.find(t => t.value === d.type)?.label.toUpperCase()}</span>
                    <p style={{ fontSize: 12, marginTop: 2, color: C.ink, lineHeight: 1.4, fontWeight: 600 }}>{d.label}</p>
                    <div className="flex items-center justify-end mt-1">
                      <button onClick={() => persist(docs.filter(x => x.id !== d.id))} style={{ color: C.inkSoft, padding: 2 }}><Trash2 size={12} /></button>
                    </div>
                  </div>
                </AnimatedIn>
              ))}
            </div>
          </div>
        ))}
        {docs.length === 0 && <EmptyState icon={<Wallet2 size={28} color={C.line} />} text="Sin documentos todavía. Sube la foto de tu pasaporte, DNI o seguro." />}
      </div>
    </>
  );
}
