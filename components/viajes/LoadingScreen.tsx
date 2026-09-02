"use client";

import { useEffect, useRef } from "react";
import { Plane } from "lucide-react";
import { animate } from "animejs";
import { C, F } from "./theme";

export function LoadingScreen({ message = "Cargando tu viaje…" }: { message?: string }) {
  const planeRef = useRef<HTMLDivElement>(null);
  const dashRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    if (planeRef.current) {
      animate(planeRef.current, {
        translateX: [0, 176],
        translateY: [0, -16, 0],
        loop: true,
        duration: 1600,
        ease: "inOut(2)",
      });
    }
    if (dashRef.current) {
      const len = dashRef.current.getTotalLength();
      dashRef.current.style.strokeDasharray = `${len}`;
      animate(dashRef.current, {
        strokeDashoffset: [len, 0],
        loop: true,
        duration: 1600,
        ease: "inOut(2)",
      });
    }
  }, []);

  return (
    <div
      className="dot-grid relative overflow-hidden flex items-center justify-center"
      style={{ background: `linear-gradient(135deg, ${C.navy} 0%, #0A1626 55%, #142644 100%)`, minHeight: "100dvh" }}
    >
      <div className="glow-pulse" style={{ position: "absolute", top: -60, right: -60, width: 300, height: 300, borderRadius: 999, background: `radial-gradient(circle, ${C.gold}28, transparent 70%)`, pointerEvents: "none" }} />
      <div className="glow-pulse" style={{ position: "absolute", bottom: -40, left: 40, width: 200, height: 200, borderRadius: 999, background: `radial-gradient(circle, ${C.teal}35, transparent 70%)`, pointerEvents: "none", animationDelay: "1.5s" }} />

      <div className="flex flex-col items-center gap-7" style={{ position: "relative" }}>
        <div style={{ position: "relative", width: 196, height: 46 }}>
          <svg width="196" height="46" viewBox="0 0 196 46" style={{ position: "absolute", inset: 0 }}>
            <path
              ref={dashRef}
              d="M10,32 Q98,4 186,32"
              fill="none"
              stroke="rgba(255,255,255,0.28)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <div ref={planeRef} style={{ position: "absolute", left: 2, top: 14 }}>
            <Plane size={22} color={C.gold} strokeWidth={1.6} style={{ transform: "rotate(90deg)" }} />
          </div>
        </div>

        <div className="flex flex-col items-center gap-2.5">
          <p style={{ fontFamily: F.mono, color: "#fff", fontSize: 13, letterSpacing: 0.4 }}>{message}</p>
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="loading-dot"
                style={{ width: 5, height: 5, borderRadius: 999, background: C.gold, animationDelay: `${i * 0.16}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
