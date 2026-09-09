"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Camera, Trash2, X, Download, Lock } from "lucide-react";
import { C, F, inputStyle } from "./theme";
import { Card, SectionLabel, Banner, EmptyState, SkeletonCards } from "./ui";
import { uid, isValidUrl, loadShared, saveShared, peekShared } from "./utils";
import type { Session, Photo, Trip } from "./types";
import { AiQuickButton } from "./AiQuickButton";
import { isPremium } from "./premium";
import { PremiumGate } from "./PremiumGate";
import { useAnimeStagger, AnimatedIn } from "./animation";


export function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 900;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) { if (w > h) { h = Math.round(h * MAX / w); w = MAX; } else { w = Math.round(w * MAX / h); h = MAX; } }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.75));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("load")); };
    img.src = url;
  });
}

function extensionFor(url: string): string {
  const m = /^data:image\/(\w+);/.exec(url);
  if (m) return m[1] === "jpeg" ? "jpg" : m[1];
  const clean = url.split(/[?#]/)[0];
  const ext = clean.split(".").pop();
  return ext && ext.length <= 4 ? ext : "jpg";
}

export function Fotos({ code, session, trip, darkMode, onTripUpdate }: { code: string; session: Session; trip: Trip; darkMode: boolean; onTripUpdate: (t: Trip) => void }) {
  const key = `fotos:${code}`;
  const [photos, setPhotos] = useState<Photo[]>(() => peekShared<Photo[]>(key) ?? []);
  const [loading, setLoading] = useState(() => peekShared<Photo[]>(key) === undefined);
  const [form, setForm] = useState({ url: "", caption: "" });
  const [err, setErr] = useState("");
  const [lightbox, setLightbox] = useState<Photo | null>(null);
  const [uploading, setUploading] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [showZipUpsell, setShowZipUpsell] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const premium = isPremium(trip);
  const sectionRef = useRef<HTMLDivElement>(null);
  useAnimeStagger(sectionRef);
  useEffect(() => { loadShared<Photo[]>(key, []).then(p => { setPhotos(p); setLoading(false); }); }, [key]);
  const persist = useCallback(async (next: Photo[]) => { setPhotos(next); await saveShared(key, next); }, [key]);

  async function downloadZip() {
    if (!premium) { setShowZipUpsell(v => !v); return; }
    setZipping(true); setErr("");
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      let failed = 0;
      await Promise.all(photos.map(async (p, i) => {
        try {
          const res = await fetch(p.url);
          const blob = await res.blob();
          zip.file(`${String(i + 1).padStart(3, "0")}-${p.author.replace(/[^a-z0-9]/gi, "_")}.${extensionFor(p.url)}`, blob);
        } catch { failed++; }
      }));
      if (failed === photos.length) { setErr("No se pudo descargar ninguna foto."); setZipping(false); return; }
      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${trip.name || "viaje"}-fotos.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
      if (failed > 0) setErr(`${failed} foto(s) no se pudieron incluir (enlace externo bloqueado).`);
    } catch {
      setErr("Error al generar el ZIP.");
    }
    setZipping(false);
  }

  function addPhoto() {
    setErr("");
    const url = form.url.trim();
    if (!url) { setErr("Pega una URL de imagen."); return; }
    if (!isValidUrl(url)) { setErr("URL inválida. Debe empezar por https:// o http://"); return; }
    persist([{ id: uid(), url, caption: form.caption.trim(), author: session.name, addedAt: Date.now() }, ...photos]);
    setForm({ url: "", caption: "" });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true); setErr("");
    try {
      const newPhotos = await Promise.all(files.map(async f => {
        const dataUrl = await compressImage(f);
        return { id: uid(), url: dataUrl, caption: "", author: session.name, addedAt: Date.now() } as Photo;
      }));
      await persist([...newPhotos, ...photos]);
    } catch { setErr("Error al procesar la imagen."); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  if (loading) return <SkeletonCards />;
  return (
    <>
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ position: "relative", maxWidth: 720, width: "100%" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox.url} alt={lightbox.caption} style={{ width: "100%", borderRadius: 8, maxHeight: "80vh", objectFit: "contain" }} />
            {lightbox.caption && <p style={{ color: "#fff", fontSize: 14, marginTop: 10, textAlign: "center" }}>{lightbox.caption}</p>}
            <button onClick={() => setLightbox(null)} style={{ position: "absolute", top: -14, right: -14, background: C.red, color: "#fff", borderRadius: 999, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center" }}><X size={15} /></button>
          </div>
        </div>
      )}
      <div ref={sectionRef} className="flex flex-col gap-4">
        <div className="flex justify-between items-center gap-2 flex-wrap">
          {photos.length > 0 ? (
            <button onClick={downloadZip} disabled={zipping} className="flex items-center gap-1.5"
              style={{ background: premium ? C.teal : (darkMode ? "#21262D" : C.paperDark), color: premium ? "#fff" : C.inkSoft, border: premium ? "none" : `1px solid ${C.line}`, borderRadius: 999, padding: "6px 12px", fontFamily: F.mono, fontSize: 11, fontWeight: 600 }}>
              {premium ? <Download size={12} /> : <Lock size={12} />} {zipping ? "PREPARANDO ZIP…" : "DESCARGAR TODAS (ZIP)"}
            </button>
          ) : <span />}
          <AiQuickButton code={code} trip={trip} session={session} suggestions={[
            `Dame ideas de fotos imprescindibles para ${trip.destination || "mi destino"}`,
          ]} />
        </div>
        {showZipUpsell && !premium && (
          <PremiumGate code={code} trip={trip} onUnlock={onTripUpdate} feature="Descargar todas las fotos del viaje en un ZIP" darkMode={darkMode}>
            <></>
          </PremiumGate>
        )}
        <Card>
          <SectionLabel>Añadir recuerdo</SectionLabel>
          {/* File upload */}
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handleFileChange} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            style={{ display: "flex", alignItems: "center", gap: 8, background: uploading ? C.inkSoft : C.navy, color: C.paper, borderRadius: 6, padding: "10px 16px", fontFamily: F.mono, fontSize: 12, width: "100%", justifyContent: "center", marginTop: 8 }}>
            <Camera size={14} /> {uploading ? "SUBIENDO…" : "SUBIR DESDE DISPOSITIVO"}
          </button>
          <p style={{ color: C.inkSoft, fontSize: 11, textAlign: "center", fontFamily: F.mono, marginTop: 4 }}>o pega una URL</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <input placeholder="https://…" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} style={{ ...inputStyle, flex: "2 1 180px" }} />
            <input placeholder="Pie de foto (opcional)" value={form.caption} onChange={e => setForm({ ...form, caption: e.target.value })} onKeyDown={e => e.key === "Enter" && addPhoto()} style={{ ...inputStyle, flex: "1 1 120px" }} />
            <button onClick={addPhoto} style={{ background: C.navy, color: C.paper, borderRadius: 5, padding: "0 18px", fontFamily: F.mono, fontSize: 12, height: 39 }}>AÑADIR</button>
          </div>
          {err && <Banner type="error" msg={err} />}
        </Card>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map(p => (
            <AnimatedIn key={p.id}>
              <div className="card-lift" style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, padding: 8 }}>
                <div onClick={() => setLightbox(p)} style={{ width: "100%", paddingBottom: "100%", position: "relative", background: C.paperDark, borderRadius: 5, overflow: "hidden", cursor: "zoom-in" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.caption} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </div>
                {p.caption && <p style={{ fontSize: 12, marginTop: 6, color: C.ink, lineHeight: 1.4 }}>{p.caption}</p>}
                <div className="flex items-center justify-between mt-1">
                  <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkSoft }}>{p.author}</span>
                  <button onClick={() => persist(photos.filter(x => x.id !== p.id))} style={{ color: C.inkSoft, padding: 2 }}><Trash2 size={12} /></button>
                </div>
              </div>
            </AnimatedIn>
          ))}
        </div>
        {photos.length === 0 && <EmptyState icon={<Camera size={28} color={C.line} />} text="Aún no hay fotos. ¡Sé el primero!" />}
      </div>
    </>
  );
}

