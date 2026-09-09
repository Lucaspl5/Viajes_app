"use client";

import { useEffect, useRef } from "react";
import { Plane } from "lucide-react";
import { animate } from "animejs";
import { C, F } from "./theme";

export function LoadingScreen({ message = "Cargando tu viaje…" }: { message?: string }) {
  const ringRef = useRef<SVGGElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ringRef.current) {
      animate(ringRef.current, { rotate: 360, loop: true, duration: 5200, ease: "linear" });
    }
    if (planeRef.current) {
      animate(planeRef.current, { rotate: [-6, 6, -6], loop: true, duration: 2200, ease: "inOut(2)" });
    }
    if (barRef.current) {
      animate(barRef.current, { translateX: ["-100%", "220%"], loop: true, duration: 1300, ease: "inOut(2)" });
    }
  }, []);

  return (
    <div
      className="dot-grid relative overflow-hidden flex items-center justify-center"
      style={{ background: `linear-gradient(135deg, ${C.navy} 0%, #0A1626 55%, #142644 100%)`, minHeight: "100dvh" }}
    >
      <div className="glow-pulse" style={{ position: "absolute", top: -80, right: -60, width: 340, height: 340, borderRadius: 999, background: `radial-gradient(circle, ${C.gold}2E, transparent 70%)`, pointerEvents: "none" }} />
      <div className="glow-pulse" style={{ position: "absolute", bottom: -60, left: 20, width: 240, height: 240, borderRadius: 999, background: `radial-gradient(circle, ${C.teal}38, transparent 70%)`, pointerEvents: "none", animationDelay: "1.5s" }} />
      <div className="glow-pulse" style={{ position: "absolute", top: "45%", left: "60%", width: 160, height: 160, borderRadius: 999, background: `radial-gradient(circle, ${C.purple}22, transparent 70%)`, pointerEvents: "none", animationDelay: "0.8s" }} />

      <div className="flex flex-col items-center gap-8" style={{ position: "relative" }}>
        {/* Passport-stamp badge: dashed ring rotating around the plane */}
        <div style={{ position: "relative", width: 108, height: 108 }}>
          <svg width="108" height="108" viewBox="0 0 108 108" style={{ position: "absolute", inset: 0 }}>
            <g ref={ringRef} style={{ transformOrigin: "54px 54px" }}>
              <circle cx="54" cy="54" r="50" fill="none" stroke={`${C.gold}55`} strokeWidth="1.5" strokeDasharray="3 7" strokeLinecap="round" />
            </g>
            <circle cx="54" cy="54" r="38" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
          </svg>
          <div ref={planeRef} style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Plane size={30} color={C.goldLight} strokeWidth={1.4} style={{ transform: "rotate(45deg)" }} />
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <p style={{ fontFamily: F.display, color: "#fff", fontSize: 21, fontWeight: 700, letterSpacing: 0.2 }}>{message}</p>
          <div style={{ width: 140, height: 3, borderRadius: 999, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
            <div ref={barRef} style={{ width: "45%", height: "100%", borderRadius: 999, background: `linear-gradient(90deg, transparent, ${C.teal}, ${C.goldLight}, transparent)` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
