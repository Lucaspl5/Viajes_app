"use client";

import { useState, useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { C, F } from "./theme";

export function Perf() {
  return (
    <div className="flex items-center gap-1 py-2" aria-hidden>
      {Array.from({ length: 36 }).map((_, i) => (
        <div key={i} style={{ width: 4, height: 4, borderRadius: 999, background: C.line, flexShrink: 0 }} />
      ))}
    </div>
  );
}

export function Card({ children, className, style, hover = true }: { children: React.ReactNode; className?: string; style?: React.CSSProperties; hover?: boolean }) {
  return (
    <div
      className={`${hover ? "card-lift" : ""} ${className ?? ""}`}
      style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", ...style }}
    >
      {children}
    </div>
  );
}

export function SectionLabel({ children }: { children: string }) {
  return <span style={{ fontFamily: F.mono, fontSize: 11, color: C.inkSoft, letterSpacing: 1 }}>{children.toUpperCase()}</span>;
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1 flex-1">
      <span style={{ fontSize: 11, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 0.5 }}>{label.toUpperCase()}</span>
      {children}
      {hint && <span style={{ fontSize: 11, color: C.inkSoft }}>{hint}</span>}
    </label>
  );
}

export function Banner({ type, msg }: { type: "error" | "success"; msg: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded" style={{
      background: type === "error" ? "#FEF2F2" : "#F0FDF4",
      border: `1px solid ${type === "error" ? "#FECACA" : "#BBF7D0"}`,
      color: type === "error" ? C.red : C.green, fontSize: 13,
    }}>
      <AlertCircle size={14} />{msg}
    </div>
  );
}

export function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10" style={{ color: C.inkSoft, fontSize: 13, textAlign: "center" }}>
      {icon}
      <p style={{ maxWidth: 260 }}>{text}</p>
    </div>
  );
}

export function SkeletonCards() {
  return (
    <div className="flex flex-col gap-4">
      {[100, 140, 80].map((h, i) => <div key={i} className="skeleton" style={{ height: h }} />)}
    </div>
  );
}

export function useCountdown(dateStr: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr + "T00:00:00").getTime() - now) / 86_400_000);
}
