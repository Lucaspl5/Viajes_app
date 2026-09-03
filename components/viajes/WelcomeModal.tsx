"use client";

import { useEffect, useState } from "react";
import { Plane, X, Sparkles, Ticket, Camera, ListChecks, Luggage, Lightbulb, PiggyBank, Globe, BookOpen, Wallet } from "lucide-react";
import { C, F } from "./theme";
import { loadPersonal, savePersonal } from "./utils";

const SECTIONS: { icon: React.ElementType; label: string; text: string }[] = [
  { icon: Wallet, label: "Gastos", text: "Divide gastos y calcula quién debe a quién." },
  { icon: ListChecks, label: "Checklist", text: "Tareas y pagos pendientes antes de salir." },
  { icon: Luggage, label: "Equipaje", text: "Lista de qué llevar, marcada entre todos." },
  { icon: Ticket, label: "Reservas", text: "Vuelos, hoteles y actividades en un sitio." },
  { icon: Camera, label: "Fotos", text: "Álbum compartido del viaje." },
  { icon: BookOpen, label: "Diario", text: "Anota recuerdos día a día." },
  { icon: Lightbulb, label: "Ideas", text: "Propón planes y el grupo vota." },
  { icon: Sparkles, label: "Asistente IA", text: "Pide itinerarios o consejos al instante." },
  { icon: PiggyBank, label: "Ahorro", text: "Plan de ahorro para pagar el viaje." },
  { icon: Globe, label: "Destinos", text: "Ideas de destinos con datos prácticos." },
];

export function WelcomeModal() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    loadPersonal("welcomeSeen", false).then(seen => { if (!seen) setShow(true); });
  }, []);

  function dismiss() {
    setShow(false);
    savePersonal("welcomeSeen", true);
  }

  if (!show) return null;

  return (
    <div onClick={dismiss} style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(11,25,48,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} className="fade-in sm:items-center">
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, maxHeight: "88dvh", overflowY: "auto", background: "#fff", borderRadius: "20px 20px 0 0" }} className="sm:rounded-2xl">
        <div style={{ background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navyMid} 60%, #1A3560 100%)`, padding: "24px 22px", position: "relative", color: "#fff" }} className="dot-grid">
          <button onClick={dismiss} style={{ position: "absolute", top: 14, right: 14, color: "#9FAEC4" }}><X size={18} /></button>
          <Plane size={28} color={C.gold} strokeWidth={1.4} />
          <p style={{ fontFamily: F.display, fontSize: 22, fontWeight: 700, marginTop: 8 }}>Bienvenido a bordo</p>
          <p style={{ fontSize: 13, color: "#B9C3D6", marginTop: 4 }}>Esto es lo que puedes hacer en cada viaje:</p>
        </div>
        <div style={{ padding: "18px 20px 22px" }} className="flex flex-col gap-3">
          {SECTIONS.map(({ icon: Icon, label, text }) => (
            <div key={label} className="flex items-start gap-3">
              <div style={{ width: 30, height: 30, borderRadius: 8, background: C.paperDark, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={15} color={C.navy} />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{label}</p>
                <p style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.4 }}>{text}</p>
              </div>
            </div>
          ))}
          <button onClick={dismiss} style={{ marginTop: 6, background: C.teal, color: "#fff", borderRadius: 8, padding: "12px 16px", fontFamily: F.mono, fontSize: 12, fontWeight: 700 }}>
            ENTENDIDO, ¡VAMOS!
          </button>
        </div>
      </div>
    </div>
  );
}
