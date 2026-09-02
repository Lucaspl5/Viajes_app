"use client";

import { useState } from "react";
import { Copy, Check, Printer } from "lucide-react";
import { C, F } from "./theme";
import type { Trip } from "./types";

export function InvitePanel({ code, trip, darkMode }: { code: string; trip: Trip; darkMode: boolean }) {
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const softColor = darkMode ? "#8B949E" : C.inkSoft;
  const textColor = darkMode ? "#E6EDF3" : C.ink;
  const borderColor = darkMode ? "#30363D" : C.line;

  function copyCode() {
    navigator.clipboard.writeText(code).catch(() => {});
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  function copyInviteLink() {
    const tripData = btoa(encodeURIComponent(JSON.stringify(trip)));
    const url = `${window.location.origin}/?code=${code}&d=${tripData}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div style={{ border: `1px dashed ${borderColor}`, borderRadius: 8, padding: "14px 16px" }} className="flex flex-col gap-3">
      <p style={{ color: softColor, fontSize: 13, lineHeight: 1.7 }}>
        Comparte el código <button onClick={copyCode} style={{ color: textColor, fontFamily: F.mono, fontWeight: 700, background: darkMode ? "#21262D" : C.paperDark, borderRadius: 4, padding: "1px 6px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
          {code} {codeCopied ? <Check size={11} color={C.teal} /> : <Copy size={10} />}
        </button> con tu grupo, o usa el enlace de invitación.
      </p>
      <div className="flex flex-wrap gap-2">
        <button onClick={copyInviteLink} style={{ display: "flex", alignItems: "center", gap: 6, background: copied ? C.teal : C.navy, color: "#fff", fontFamily: F.mono, fontSize: 11, borderRadius: 6, padding: "7px 14px" }}>
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "¡ENLACE COPIADO!" : "COPIAR ENLACE DE INVITACIÓN"}
        </button>
        <button onClick={() => window.print()} style={{ display: "flex", alignItems: "center", gap: 6, color: softColor, fontFamily: F.mono, fontSize: 11, border: `1px solid ${borderColor}`, borderRadius: 6, padding: "7px 12px" }}>
          <Printer size={12} /> EXPORTAR PDF
        </button>
      </div>
      <p style={{ color: softColor, fontSize: 11, fontFamily: F.mono }}>
        El enlace lleva los datos del viaje, así tu grupo puede unirse directamente.
      </p>
    </div>
  );
}

