"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  Plane, MapPin, Camera, ListChecks,
  Copy, Check, Plus, Trash2, X, ArrowLeft,
  Euro, AlertCircle, ChevronDown, ThumbsUp, ThumbsDown,
  Luggage, Lightbulb, Wallet, Sunrise, ExternalLink,
  CheckCircle2, Circle, PiggyBank, Target, Edit2, Globe,
  Heart, BookOpen, CreditCard, Moon, Sun, Printer,
  Filter, BookMarked, Ticket, StickyNote, RefreshCw,
  Sparkles, Send, Download,
} from "lucide-react";
import { animate, stagger, spring } from "animejs";

const LeafletMap = dynamic(() => import("./LeafletMap"), { ssr: false });

// ─── Types ───────────────────────────────────────────────────────────────────

interface Trip {
  name: string;
  destination: string;
  startDate: string | null;
  endDate: string | null;
  members: string[];
  createdAt: number;
}
interface Session { code: string; name: string; }
interface ItineraryDay { id: string; date: string; title: string; items: ItineraryItem[]; }
interface ItineraryItem { id: string; time: string; text: string; }
interface MapPlace { id: string; name: string; lat: number; lon: number; note: string; }
interface Photo { id: string; url: string; caption: string; author: string; addedAt: number; }
interface ChecklistItem { id: string; text: string; done: boolean; cost: number; by: string; addedAt: number; }
interface Expense {
  id: string; description: string; amount: number;
  paidBy: string; splitWith: string[]; category: string; date: string;
}
interface PackingItem { id: string; text: string; category: string; checkedBy: string[]; }
interface Idea {
  id: string; text: string; author: string; note: string;
  votes: Record<string, 1 | -1>; addedAt: number;
}
interface SavingsPhase {
  id: string; name: string; startDate: string; endDate: string; amountPerPerson: number;
}
interface SavingsConfig {
  targetBudget: number; phases: SavingsPhase[]; numPersonas?: number;
}
interface Booking {
  id: string;
  type: "vuelo" | "hotel" | "actividad" | "traslado" | "otro";
  title: string;
  confirmationCode: string;
  startDate: string; startTime: string;
  endDate: string; endTime: string;
  location: string; bookingUrl: string; notes: string;
  amount: number;
}
interface DiaryEntry {
  id: string; date: string; text: string;
  author: string; mood: string; addedAt: number;
}
interface DestinationTemplate {
  id: string; name: string; country: string; flag: string;
  costPerPerson: number; durationDays: number;
  type: "playa" | "ciudad" | "cultura" | "naturaleza" | "aventura";
  description: string; highlights: string[];
  itinerary: { date: string; title: string; items: { time: string; text: string }[] }[];
  mapPlaces: { name: string; lat: number; lon: number; note: string }[];
}

// ─── Design tokens ───────────────────────────────────────────────────────────

const C = {
  // Backgrounds
  paper: "#F5F4F1", paperDark: "#ECEAE4",
  // Text
  ink: "#0E1726", inkSoft: "#64748B",
  // Brand blues — deeper, richer midnight
  navy: "#0B1930", navyMid: "#142644",
  // Accents — vivid & saturated
  teal: "#00C48C",       // electric emerald-teal
  gold: "#F59E0B",       // vivid amber
  goldLight: "#FCD34D",  // bright yellow-gold
  red: "#F43F5E",        // vivid rose-red
  coral: "#FB7185",      // soft coral
  sky: "#38BDF8",        // sky blue
  green: "#10B981",      // emerald
  purple: "#8B5CF6",     // violet accent
  // Borders
  line: "#E2DDD6",
} as const;

const F = {
  display: "var(--font-display), Georgia, serif",
  mono: "var(--font-mono), 'Courier New', monospace",
  body: "var(--font-body), system-ui, sans-serif",
} as const;

// ─── Animation utilities ──────────────────────────────────────────────────────

function useAnimeIn(ref: React.RefObject<HTMLElement | null>, deps: unknown[] = []) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.opacity = "0";
    el.style.transform = "translateY(18px)";
    animate(el, {
      opacity: [0, 1],
      translateY: [18, 0],
      duration: 520,
      ease: "out(3)",
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

function useAnimeStagger(ref: React.RefObject<HTMLElement | null>, deps: unknown[] = []) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const children = Array.from(el.children) as HTMLElement[];
    if (!children.length) return;
    children.forEach(c => { c.style.opacity = "0"; c.style.transform = "translateY(20px)"; });
    animate(children, {
      opacity: [0, 1],
      translateY: [20, 0],
      delay: stagger(65),
      duration: 460,
      ease: "out(3)",
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

function AnimatedIn({ children, className, style, delay = 0 }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties; delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.opacity = "0";
    el.style.transform = "translateY(16px)";
    animate(el, { opacity: [0, 1], translateY: [16, 0], duration: 480, delay, ease: "out(3)" });
  }, [delay]);
  return <div ref={ref} className={className} style={style}>{children}</div>;
}

const EXPENSE_CATEGORIES = ["✈️ Transporte", "🏨 Alojamiento", "🍽️ Comida", "🎭 Actividades", "🛍️ Compras", "💊 Salud", "📦 Otros"];
const BOOKING_TYPES: { value: Booking["type"]; label: string; emoji: string }[] = [
  { value: "vuelo",     label: "Vuelo",     emoji: "✈️" },
  { value: "hotel",     label: "Hotel",     emoji: "🏨" },
  { value: "actividad", label: "Actividad", emoji: "🎭" },
  { value: "traslado",  label: "Traslado",  emoji: "🚗" },
  { value: "otro",      label: "Otro",      emoji: "📋" },
];
const DIARY_MOODS = ["😊", "😍", "😎", "🥱", "😮", "🥵", "🌧️", "🎉"];
const CURRENCIES: { code: string; name: string; rate: number; symbol: string; destIds: string[] }[] = [
  { code: "JPY", name: "Yen japonés",      rate: 162,  symbol: "¥",  destIds: ["japon","japon-tokio","tokyo","osaka"] },
  { code: "THB", name: "Baht tailandés",   rate: 38,   symbol: "฿",  destIds: ["tailandia","tailandia-islas","bangkok"] },
  { code: "USD", name: "Dólar americano",  rate: 1.08, symbol: "$",  destIds: ["nueva-york","hawaii","alaska","cancun"] },
  { code: "GBP", name: "Libra esterlina",  rate: 0.86, symbol: "£",  destIds: ["londres","escocia-highlands"] },
  { code: "AUD", name: "Dólar australiano",rate: 1.65, symbol: "A$", destIds: ["australia","sydney"] },
  { code: "NZD", name: "Dólar neozelandés",rate: 1.78, symbol: "NZ$",destIds: ["nueva-zelanda"] },
  { code: "MXN", name: "Peso mexicano",    rate: 18.5, symbol: "$",  destIds: ["mexico-df","cancun"] },
  { code: "INR", name: "Rupia india",      rate: 89,   symbol: "₹",  destIds: ["india"] },
  { code: "BRL", name: "Real brasileño",   rate: 5.4,  symbol: "R$", destIds: ["brasil","rio"] },
  { code: "ARS", name: "Peso argentino",   rate: 980,  symbol: "$",  destIds: ["argentina","buenos-aires"] },
  { code: "MAD", name: "Dírham marroquí",  rate: 10.7, symbol: "د.م",destIds: ["marruecos","marruecos-norte"] },
  { code: "ZAR", name: "Rand sudafricano", rate: 20.2, symbol: "R",  destIds: ["sudafrica","kenya","tanzania"] },
  { code: "IDR", name: "Rupia indonesia",  rate: 16800,symbol: "Rp", destIds: ["indonesia-bali","borneo"] },
  { code: "VND", name: "Dong vietnamita",  rate: 26500,symbol: "₫",  destIds: ["vietnam"] },
  { code: "KRW", name: "Won surcoreano",   rate: 1430, symbol: "₩",  destIds: ["seul","corea-sur"] },
  { code: "CNY", name: "Yuan chino",       rate: 7.8,  symbol: "¥",  destIds: ["china"] },
  { code: "CHF", name: "Franco suizo",     rate: 0.96, symbol: "Fr", destIds: ["suiza-alpes"] },
  { code: "NOK", name: "Corona noruega",   rate: 11.5, symbol: "kr", destIds: ["noruega-fjords","svalbard"] },
  { code: "SEK", name: "Corona sueca",     rate: 11.2, symbol: "kr", destIds: ["estocolmo"] },
  { code: "DKK", name: "Corona danesa",    rate: 7.45, symbol: "kr", destIds: ["copenhague","islas-feroe"] },
  { code: "ISK", name: "Corona islandesa", rate: 145,  symbol: "kr", destIds: ["islandia","islandia-express","groenlandia"] },
  { code: "ILS", name: "Séquel israelí",   rate: 4.0,  symbol: "₪",  destIds: ["israel"] },
  { code: "TRY", name: "Lira turca",       rate: 35,   symbol: "₺",  destIds: ["turquia","estambul","capadocia"] },
  { code: "EGP", name: "Libra egipcia",    rate: 51,   symbol: "£",  destIds: ["egipto"] },
  { code: "MUR", name: "Rupia mauriciana", rate: 48,   symbol: "₨",  destIds: ["mauricio"] },
  { code: "XOF", name: "Franco CFA",       rate: 655,  symbol: "Fr", destIds: ["cabo-verde","senegal"] },
  { code: "PEN", name: "Sol peruano",      rate: 4.0,  symbol: "S/", destIds: ["peru","peru-trek","machu-picchu"] },
  { code: "CLP", name: "Peso chileno",     rate: 950,  symbol: "$",  destIds: ["chile","atacama"] },
  { code: "COP", name: "Peso colombiano",  rate: 4200, symbol: "$",  destIds: ["colombia","cartagena"] },
  { code: "PHP", name: "Peso filipino",    rate: 61,   symbol: "₱",  destIds: ["filipinas"] },
  { code: "KZT", name: "Tenge kazajo",     rate: 490,  symbol: "₸",  destIds: ["kazajistan"] },
  { code: "KES", name: "Chelín keniata",   rate: 138,  symbol: "KSh",destIds: ["kenya","nairobi"] },
  { code: "RWF", name: "Franco ruandés",   rate: 1380, symbol: "Fr", destIds: ["rwanda"] },
  { code: "LKR", name: "Rupia ceilanesa",  rate: 330,  symbol: "₨",  destIds: ["sri-lanka"] },
  { code: "KHR", name: "Riel camboyano",   rate: 4200, symbol: "៛",  destIds: ["cambodia","angkor"] },
];
const DEST_TIPS: Record<string, { visa: string; currency: string; plug: string; tip: string; emergency: string }> = {
  "japon":          { visa:"Sin visado hasta 90d",   currency:"Yen (¥) · solo efectivo en muchos sitios", plug:"Tipo A (igual que España)", tip:"No se propina, es casi ofensivo", emergency:"110 policía · 119 ambulancia" },
  "japon-tokio":    { visa:"Sin visado hasta 90d",   currency:"Yen (¥) · lleva efectivo", plug:"Tipo A",   tip:"No se propina", emergency:"110 policía · 119 ambulancia" },
  "tailandia":      { visa:"Sin visado hasta 30d",   currency:"Baht (฿) · ATMs abundantes", plug:"Tipo A/B/C", tip:"10% habitual en restaurantes", emergency:"191 policía · 1669 ambulancia" },
  "tailandia-islas":{ visa:"Sin visado hasta 30d",   currency:"Baht (฿)", plug:"Tipo A/B/C", tip:"10% habitual", emergency:"191 policía · 1669 ambulancia" },
  "bangkok":        { visa:"Sin visado hasta 30d",   currency:"Baht (฿)", plug:"Tipo A/B/C", tip:"10% habitual", emergency:"191 policía" },
  "indonesia-bali": { visa:"Sin visado hasta 30d",   currency:"Rupia indonesia (Rp) · negocia siempre", plug:"Tipo C/F", tip:"No obligatoria", emergency:"110 policía · 118 ambulancia" },
  "india":          { visa:"e-Visa obligatoria ~50€", currency:"Rupia (₹) · acepta tarjeta en ciudades", plug:"Tipo C/D", tip:"10-15% en restaurantes", emergency:"100 policía · 102 ambulancia" },
  "nueva-york":     { visa:"ESTA obligatorio (~21$)",  currency:"Dólar ($) · tarjeta aceptada en casi todo", plug:"Tipo A/B (adaptador)",  tip:"Propina 18-20% obligatoria en restaurantes", emergency:"911" },
  "hawaii":         { visa:"ESTA obligatorio",          currency:"Dólar ($)", plug:"Tipo A/B",   tip:"18-20% en restaurantes", emergency:"911" },
  "alaska":         { visa:"ESTA obligatorio",          currency:"Dólar ($)", plug:"Tipo A/B",   tip:"15-20% en restaurantes", emergency:"911" },
  "islandia":       { visa:"Sin visado (Schengen)",    currency:"Corona islandesa (kr)", plug:"Tipo C/F",  tip:"No tradicional, incluida en precio", emergency:"112" },
  "islandia-express":{ visa:"Sin visado (Schengen)", currency:"Corona islandesa (kr)", plug:"Tipo C/F", tip:"Incluida en precio", emergency:"112" },
  "noruega-fjords": { visa:"Sin visado (Schengen)",    currency:"Corona noruega (kr)", plug:"Tipo C/F",   tip:"No habitual", emergency:"112" },
  "marruecos":      { visa:"Sin visado hasta 90d",     currency:"Dírham (MAD) · solo para locales", plug:"Tipo C", tip:"Regateo habitual en zocos", emergency:"19 policía · 15 ambulancia" },
  "marruecos-norte":{ visa:"Sin visado hasta 90d",     currency:"Dírham (MAD) · negocia los precios", plug:"Tipo C", tip:"Regateo habitual", emergency:"19 policía" },
  "vietnam":        { visa:"Sin visado 45d · e-Visa disponible", currency:"Dong (₫) · solo efectivo en rural", plug:"Tipo A/C", tip:"No obligatoria", emergency:"113 policía · 115 ambulancia" },
  "colombia":       { visa:"Sin visado hasta 90d",     currency:"Peso colombiano ($)", plug:"Tipo A/B", tip:"Propina 10% en restaurantes", emergency:"123" },
  "peru":           { visa:"Sin visado hasta 90d",     currency:"Sol (S/) · tarjeta en ciudades", plug:"Tipo A/C", tip:"10% habitual", emergency:"105 policía · 117 ambulancia" },
  "peru-trek":      { visa:"Sin visado hasta 90d",     currency:"Sol (S/) · efectivo en ruta", plug:"Tipo A/C", tip:"Propina al guía", emergency:"105 policía" },
  "kenya":          { visa:"e-Visa obligatoria ~50$",   currency:"Chelín keniata (KSh)", plug:"Tipo G (británico)", tip:"10-15% en safari lodges", emergency:"999 policía · 999 ambulancia" },
  "tanzania":       { visa:"e-Visa obligatoria ~50$",   currency:"Chelín tanzano (TSh)", plug:"Tipo G",  tip:"Propina al guía de safari ~20$/día", emergency:"999 policía" },
  "sudafrica":      { visa:"Sin visado hasta 90d",     currency:"Rand (R) · tarjeta aceptada", plug:"Tipo M/N", tip:"10-15% en restaurantes", emergency:"10111 policía · 10177 ambulancia" },
  "seychelles":     { visa:"Sin visado",               currency:"Rupia seychellense (SCR) · USD ampliamente aceptado", plug:"Tipo G", tip:"10% habitual", emergency:"999" },
  "maldivas":       { visa:"Sin visado a la llegada",  currency:"Rufiyaa (MVR) · USD aceptado en resorts", plug:"Tipo G", tip:"No obligatoria en resorts", emergency:"119" },
  "mauricio":       { visa:"Sin visado hasta 60d",     currency:"Rupia mauriciana (₨)", plug:"Tipo G", tip:"10% en restaurantes", emergency:"999" },
  "sri-lanka":      { visa:"e-Visa obligatoria ~35$",   currency:"Rupia ceilanesa (₨)", plug:"Tipo D/G", tip:"10% en restaurantes", emergency:"119 policía" },
  "filipinas":      { visa:"Sin visado hasta 30d",     currency:"Peso (₱) · ATMs disponibles", plug:"Tipo A/B/C", tip:"10% habitual", emergency:"117 policía" },
  "borneo":         { visa:"Sin visado (parte malaya)", currency:"Ringgit (RM)", plug:"Tipo G", tip:"No habitual", emergency:"999 policía" },
  "cambodia":       { visa:"e-Visa disponible ~30$",    currency:"Dólar USD · riel como cambio", plug:"Tipo A/C/G", tip:"1-2$ por servicio", emergency:"117 policía" },
  "china":          { visa:"Visado obligatorio ~80€",   currency:"Yuan (¥) · WeChat/AliPay o efectivo", plug:"Tipo A/I", tip:"No habitual", emergency:"110 policía · 120 ambulancia" },
  "corea-sur":      { visa:"Sin visado hasta 90d",     currency:"Won (₩) · tarjeta aceptada", plug:"Tipo C/F", tip:"No habitual", emergency:"112 policía · 119 ambulancia" },
  "seul":           { visa:"Sin visado hasta 90d",     currency:"Won (₩)", plug:"Tipo C/F", tip:"No habitual", emergency:"112 policía" },
  "hong-kong":      { visa:"Sin visado hasta 90d",     currency:"Dólar HK (HK$)", plug:"Tipo G (británico)", tip:"10% en restaurantes", emergency:"999" },
  "turquia":        { visa:"Sin visado hasta 90d",     currency:"Lira (₺) · negocia precios", plug:"Tipo C/F", tip:"10-15% en restaurantes", emergency:"155 policía · 112 ambulancia" },
  "estambul":       { visa:"Sin visado hasta 90d",     currency:"Lira turca (₺)", plug:"Tipo C/F", tip:"10-15% habitual", emergency:"155 policía" },
  "capadocia":      { visa:"Sin visado hasta 90d",     currency:"Lira turca (₺)", plug:"Tipo C/F", tip:"10-15%", emergency:"112" },
  "egipto":         { visa:"Visado a la llegada 25$",  currency:"Libra egipcia (£) · USD también aceptado", plug:"Tipo C", tip:"Baksheesh (propina) muy habitual", emergency:"122 policía" },
  "israel":         { visa:"Sin visado hasta 90d",     currency:"Séquel (₪)", plug:"Tipo H", tip:"10% en restaurantes", emergency:"100 policía · 101 ambulancia" },
  "kazajistan":     { visa:"Sin visado hasta 30d",     currency:"Tenge (₸) · efectivo preferido", plug:"Tipo C/F", tip:"No habitual", emergency:"102 policía" },
  "argentina":      { visa:"Sin visado hasta 90d",     currency:"Peso (ARS) · usa casas de cambio oficiales", plug:"Tipo I/C", tip:"10% habitual", emergency:"101 policía · 107 ambulancia" },
  "chile":          { visa:"Sin visado hasta 90d",     currency:"Peso chileno ($)", plug:"Tipo C/L", tip:"10% propina voluntaria", emergency:"133 policía · 131 ambulancia" },
  "brasil":         { visa:"Sin visado hasta 90d",     currency:"Real (R$) · tarjeta ampliamente aceptada", plug:"Tipo N", tip:"10% habitual", emergency:"190 policía · 192 ambulancia" },
  "mexico-df":      { visa:"Sin visado hasta 180d",    currency:"Peso mexicano (MX$)", plug:"Tipo A/B", tip:"10-15% en restaurantes", emergency:"911" },
  "nueva-zelanda":  { visa:"NZeTA obligatorio (~17€)",  currency:"Dólar NZ (NZ$)", plug:"Tipo I", tip:"No habitual (incluida en precio)", emergency:"111" },
  "australia":      { visa:"ETA obligatorio (~20A$)",  currency:"Dólar australiano (A$)", plug:"Tipo I", tip:"No habitual", emergency:"000" },
  "sydney":         { visa:"ETA obligatorio",          currency:"Dólar australiano (A$)", plug:"Tipo I", tip:"No habitual", emergency:"000" },
  "canada-rockies": { visa:"AVE requerido (~7€)",      currency:"Dólar canadiense (CA$)", plug:"Tipo A/B", tip:"15-20% en restaurantes", emergency:"911" },
  "dolomitas":      { visa:"Sin visado (Schengen)",    currency:"Euro (€) · aceptan tarjeta", plug:"Tipo C/F", tip:"5-10% en restaurantes", emergency:"118 ambulancia" },
  "escocia-highlands":{ visa:"Sin visado hasta 6 meses", currency:"Libra (£)", plug:"Tipo G", tip:"10% en restaurantes", emergency:"999" },
  "suiza-alpes":    { visa:"Sin visado (Schengen)",    currency:"Franco suizo (Fr) · caro pero seguro", plug:"Tipo C/J", tip:"Incluida en precio", emergency:"112" },
  "azores":         { visa:"Sin visado (Portugal/UE)", currency:"Euro (€)", plug:"Tipo F", tip:"5-10% voluntaria", emergency:"112" },
  "madeira":        { visa:"Sin visado (Portugal/UE)", currency:"Euro (€)", plug:"Tipo F", tip:"5-10% voluntaria", emergency:"112" },
  "cabo-verde":     { visa:"Visado a la llegada ~25€", currency:"Escudo caboverdiano (CVE) · EUR ampliamente aceptado", plug:"Tipo C/F", tip:"10% habitual", emergency:"132 policía" },
  "islas-feroe":    { visa:"Sin visado (Área Schengen)", currency:"Corona feroesa (DKK)", plug:"Tipo C/K", tip:"No habitual", emergency:"112" },
  "svalbard":       { visa:"Sin visado (ninguna restricción)", currency:"Corona noruega (NOK)", plug:"Tipo C/F", tip:"No habitual", emergency:"02800 policía local" },
  "groenlandia":    { visa:"Sin visado para UE",       currency:"Corona danesa (DKK)", plug:"Tipo C/E/K", tip:"No habitual", emergency:"112" },
  "copenhague":     { visa:"Sin visado (Schengen)",    currency:"Corona danesa (kr)", plug:"Tipo C/E/K", tip:"Incluida en precio", emergency:"112" },
  "estocolmo":      { visa:"Sin visado (Schengen)",    currency:"Corona sueca (kr)", plug:"Tipo C/F", tip:"Incluida en precio", emergency:"112" },
  "creta":          { visa:"Sin visado (Schengen/UE)", currency:"Euro (€)", plug:"Tipo C/F", tip:"5-10% habitual", emergency:"112" },
  "corfu":          { visa:"Sin visado (UE)",          currency:"Euro (€)", plug:"Tipo C/F", tip:"5-10% habitual", emergency:"112" },
  "mykonos":        { visa:"Sin visado (UE)",          currency:"Euro (€)", plug:"Tipo C/F", tip:"10% en restaurantes", emergency:"112" },
  "cerdena":        { visa:"Sin visado (UE)",          currency:"Euro (€)", plug:"Tipo C/F", tip:"5-10% voluntaria", emergency:"118 ambulancia" },
  "milan":          { visa:"Sin visado (UE)",          currency:"Euro (€)", plug:"Tipo C/F/L", tip:"10% en restaurantes", emergency:"118 ambulancia" },
  "bora-bora":      { visa:"Sin visado hasta 90d",     currency:"Franco CFP (XPF) · tarjeta en hoteles", plug:"Tipo A", tip:"No habitual", emergency:"17 policía" },
  "republica-dominicana":{ visa:"Sin visado · paga tarjeta turista al llegar 10$", currency:"Peso dominicano · USD aceptado", plug:"Tipo A/B", tip:"10-15% en restaurantes", emergency:"911" },
  "londre":         { visa:"Sin visado hasta 6 meses", currency:"Libra esterlina (£)", plug:"Tipo G", tip:"10% en restaurantes", emergency:"999" },
  "barcelona":      { visa:"Sin visado (UE)",          currency:"Euro (€)", plug:"Tipo C/F", tip:"5-10% voluntaria", emergency:"112" },
  "paris":          { visa:"Sin visado (Schengen)",    currency:"Euro (€)", plug:"Tipo E", tip:"10% voluntaria", emergency:"15 SAMU · 112" },
  "amsterdam":      { visa:"Sin visado (Schengen)",    currency:"Euro (€)", plug:"Tipo C/F", tip:"10% voluntaria", emergency:"112" },
  "roma":           { visa:"Sin visado (UE)",          currency:"Euro (€)", plug:"Tipo C/F/L", tip:"10% en restaurantes", emergency:"118 ambulancia" },
  "portugal":       { visa:"Sin visado (UE)",          currency:"Euro (€)", plug:"Tipo C/F", tip:"5-10% voluntaria", emergency:"112" },
  "oporto":         { visa:"Sin visado (UE)",          currency:"Euro (€)", plug:"Tipo C/F", tip:"5-10% voluntaria", emergency:"112" },
};
const PACKING_CATEGORIES = ["📄 Documentos", "👕 Ropa", "🔌 Electrónica", "🧴 Higiene", "💊 Medicamentos", "🎒 Otros"];

const DEST_TYPE_FILTERS = [
  { value: "todos",      label: "Todos",      emoji: "🌍" },
  { value: "playa",      label: "Playa",      emoji: "🏖️" },
  { value: "ciudad",     label: "Ciudad",     emoji: "🏙️" },
  { value: "cultura",    label: "Cultura",    emoji: "🏛️" },
  { value: "naturaleza", label: "Naturaleza", emoji: "🌿" },
  { value: "aventura",   label: "Aventura",   emoji: "🧗" },
];

const DESTINATIONS: DestinationTemplate[] = [
  {
    id: "oporto", name: "Oporto", country: "Portugal", flag: "🇵🇹",
    costPerPerson: 340, durationDays: 3, type: "ciudad",
    description: "Vino de Oporto, azulejos azules y el río Duero entre bodegas históricas. Un fin de semana perfecto.",
    highlights: ["Livraria Lello", "Bodegas de Gaia", "Puente Luis I", "Ribeira"],
    itinerary: [
      { date: "", title: "Día 1 — Ribeira y el Duero", items: [{ time: "12:00", text: "Llegada al aeropuerto Francisco Sá Carneiro" }, { time: "16:00", text: "Barrio de la Ribeira y Cais da Ribeira" }, { time: "17:30", text: "Crucero por el río Duero" }, { time: "20:00", text: "Cena de bacalhau a brás en la Ribeira" }] },
      { date: "", title: "Día 2 — Centro histórico y vino", items: [{ time: "09:30", text: "Livraria Lello (la librería más bonita del mundo)" }, { time: "11:00", text: "Torre dos Clérigos — vistas de la ciudad" }, { time: "13:00", text: "Almuerzo en el Mercado do Bom Sucesso" }, { time: "15:00", text: "Cruzar el Puente Luis I a Vila Nova de Gaia" }, { time: "17:00", text: "Cata de vino de Oporto en las bodegas de Taylor's" }, { time: "20:30", text: "Cena en la Baixa" }] },
      { date: "", title: "Día 3 — Azulejos y regreso", items: [{ time: "09:30", text: "Estación de São Bento (azulejos históricos)" }, { time: "11:00", text: "Iglesia de San Francisco (interior dorado)" }, { time: "13:00", text: "Francesinha — el sándwich más famoso de Oporto" }, { time: "15:30", text: "Traslado al aeropuerto" }] },
    ],
    mapPlaces: [
      { name: "Ribeira", lat: 41.14, lon: -8.61, note: "Barrio ribereño histórico, Patrimonio UNESCO" },
      { name: "Livraria Lello", lat: 41.15, lon: -8.61, note: "Librería Art Nouveau inspiradora de HP" },
      { name: "Puente Luis I", lat: 41.14, lon: -8.61, note: "Vista icónica sobre el Duero" },
      { name: "Bodegas Taylor's (Gaia)", lat: 41.13, lon: -8.61, note: "Cata de vino de Oporto" },
      { name: "Estación de São Bento", lat: 41.14, lon: -8.61, note: "Azulejos históricos espectaculares" },
    ],
  },
  {
    id: "lisboa", name: "Lisboa", country: "Portugal", flag: "🇵🇹",
    costPerPerson: 420, durationDays: 4, type: "ciudad",
    description: "Fado, pastéis de nata y tranvías históricos por colinas con vistas al Tejo. La capital más acogedora de Europa.",
    highlights: ["Alfama", "Torre de Belém", "Castillo de San Jorge", "Sintra"],
    itinerary: [
      { date: "", title: "Día 1 — Llegada y Baixa", items: [{ time: "12:00", text: "Llegada al aeropuerto de Lisboa" }, { time: "16:00", text: "Rúa Augusta y Praça do Comércio" }, { time: "19:00", text: "Sunset en el mirador de Santa Catarina" }, { time: "21:00", text: "Cena con fado en Alfama" }] },
      { date: "", title: "Día 2 — Alfama y el Castillo", items: [{ time: "09:30", text: "Castillo de San Jorge" }, { time: "11:30", text: "Barrio de Alfama a pie" }, { time: "15:00", text: "Tranvía 28E cruzando la ciudad" }, { time: "18:00", text: "Mirador de Graça — mejores vistas" }] },
      { date: "", title: "Día 3 — Belém y Sintra", items: [{ time: "09:00", text: "Torre de Belém y Monasterio de los Jerónimos" }, { time: "11:30", text: "Pastel de Belém original (obligatorio)" }, { time: "14:00", text: "Tren a Sintra (30 min)" }, { time: "15:30", text: "Palacio da Pena y Quinta da Regaleira" }, { time: "20:00", text: "Regreso y cena en Príncipe Real" }] },
      { date: "", title: "Día 4 — LX Factory y regreso", items: [{ time: "10:00", text: "LX Factory — mercado creativo y brunch" }, { time: "13:00", text: "Barrio de Mouraria" }, { time: "16:00", text: "Traslado al aeropuerto" }] },
    ],
    mapPlaces: [
      { name: "Alfama", lat: 38.71, lon: -9.13, note: "Barrio histórico, corazón del fado" },
      { name: "Torre de Belém", lat: 38.69, lon: -9.22, note: "Monumento del siglo XVI, Patrimonio UNESCO" },
      { name: "Castillo de San Jorge", lat: 38.71, lon: -9.13, note: "Fortaleza con vistas panorámicas" },
      { name: "Sintra", lat: 38.80, lon: -9.39, note: "Palacio da Pena y jardines románticos" },
      { name: "LX Factory", lat: 38.70, lon: -9.18, note: "Mercado creativo en fábrica rehabilitada" },
    ],
  },
  {
    id: "marrakech", name: "Marrakech", country: "Marruecos", flag: "🇲🇦",
    costPerPerson: 500, durationDays: 5, type: "cultura",
    description: "La ciudad roja: medinas laberínticas, riads y la Djemaa el-Fna. Solo a 3 horas de vuelo de España.",
    highlights: ["Djemaa el-Fna", "Zocos", "Jardines Majorelle", "Palacio Bahía"],
    itinerary: [
      { date: "", title: "Día 1 — Llegada a la Ciudad Roja", items: [{ time: "14:00", text: "Llegada al aeropuerto Ménara" }, { time: "16:00", text: "Check-in en riad en la medina" }, { time: "18:00", text: "Primera visita a Djemaa el-Fna al atardecer" }, { time: "20:30", text: "Cena en terraza con vistas a la plaza" }] },
      { date: "", title: "Día 2 — Medina y Zocos", items: [{ time: "09:00", text: "Palacio Bahía" }, { time: "11:00", text: "Laberinto de los zocos" }, { time: "14:00", text: "Almuerzo en restaurante tradicional" }, { time: "16:00", text: "Tintorería (curtiembre de cuero)" }, { time: "18:30", text: "Hammam tradicional" }] },
      { date: "", title: "Día 3 — Jardines y cultura", items: [{ time: "09:00", text: "Jardines Majorelle (de Yves Saint Laurent)" }, { time: "12:00", text: "Museo Yves Saint Laurent" }, { time: "16:00", text: "Tumbas Saidianas" }, { time: "19:00", text: "Sunset desde el Café de France" }] },
      { date: "", title: "Día 4 — Excursión al Atlas", items: [{ time: "08:00", text: "Excursión a las montañas del Atlas o Essaouira" }, { time: "18:00", text: "Regreso a Marrakech" }, { time: "20:30", text: "Cena de despedida: cuscús y tajín" }] },
      { date: "", title: "Día 5 — Compras y vuelta", items: [{ time: "09:00", text: "Última vuelta por el zoco (especias, babuchas)" }, { time: "12:00", text: "Check-out y traslado al aeropuerto" }] },
    ],
    mapPlaces: [
      { name: "Djemaa el-Fna", lat: 31.63, lon: -7.99, note: "Plaza principal, Patrimonio Cultural UNESCO" },
      { name: "Jardines Majorelle", lat: 31.64, lon: -8.00, note: "Jardín de Yves Saint Laurent" },
      { name: "Palacio Bahía", lat: 31.62, lon: -7.99, note: "Palacio del siglo XIX, arte islámico" },
      { name: "Medina (Zocos)", lat: 31.64, lon: -7.99, note: "Mercados tradicionales laberínticos" },
      { name: "Tumbas Saidianas", lat: 31.62, lon: -7.99, note: "Mausoleo real del siglo XVI" },
    ],
  },
  {
    id: "estambul", name: "Estambul", country: "Turquía", flag: "🇹🇷",
    costPerPerson: 750, durationDays: 6, type: "cultura",
    description: "Donde Europa se encuentra con Asia: mezquitas, el Gran Bazar y el Bósforo. Una ciudad de contrastes absolutos.",
    highlights: ["Hagia Sofía", "Mezquita Azul", "Gran Bazar", "Bósforo"],
    itinerary: [
      { date: "", title: "Día 1 — Llegada a la Ciudad Imperial", items: [{ time: "14:00", text: "Llegada a Estambul Aeropuerto" }, { time: "17:00", text: "Check-in en Sultanahmet" }, { time: "19:00", text: "Primera vista de Hagia Sofía iluminada" }, { time: "21:00", text: "Cena con vistas al Bósforo en Karaköy" }] },
      { date: "", title: "Día 2 — Sultanahmet histórico", items: [{ time: "09:00", text: "Hagia Sofía (catedral, mezquita, museo — hoy mezquita)" }, { time: "11:00", text: "Mezquita Azul (Sultan Ahmet Camii)" }, { time: "13:00", text: "Cisterna Basílica subterránea" }, { time: "15:00", text: "Palacio de Topkapi y Harem" }] },
      { date: "", title: "Día 3 — Gran Bazar y Beyoğlu", items: [{ time: "09:30", text: "Gran Bazar (más de 4.000 tiendas)" }, { time: "12:00", text: "Bazar de las Especias" }, { time: "16:00", text: "Istiklal Caddesi hasta la plaza Taksim" }, { time: "21:00", text: "Música en vivo en Beyoğlu" }] },
      { date: "", title: "Día 4 — El Bósforo", items: [{ time: "09:30", text: "Crucero por el Bósforo (2 continentes)" }, { time: "13:00", text: "Almuerzo en la orilla asiática (Kadıköy)" }, { time: "16:00", text: "Mercado de Kadıköy" }, { time: "18:00", text: "Regreso en ferry — skyline al atardecer" }] },
      { date: "", title: "Día 5 — Balat y Fener", items: [{ time: "10:00", text: "Barrio de Balat (casas de colores y cafés)" }, { time: "12:00", text: "Fener y la Iglesia de San Esteban de los Búlgaros" }, { time: "16:00", text: "Bebek y el Bósforo europeo" }] },
      { date: "", title: "Día 6 — Regreso", items: [{ time: "09:00", text: "Último Turkish breakfast con simit" }, { time: "11:00", text: "Compras: lokum, frutos secos y especias" }, { time: "14:00", text: "Traslado al aeropuerto" }] },
    ],
    mapPlaces: [
      { name: "Hagia Sofía", lat: 41.01, lon: 28.98, note: "Maravilla arquitectónica del año 537 d.C." },
      { name: "Gran Bazar", lat: 41.01, lon: 28.97, note: "El bazar cubierto más grande del mundo" },
      { name: "Palacio Topkapi", lat: 41.01, lon: 28.98, note: "Residencia de los sultanes otomanos 400 años" },
      { name: "Bósforo", lat: 41.09, lon: 29.06, note: "El estrecho que separa Europa de Asia" },
      { name: "Balat", lat: 41.03, lon: 28.95, note: "Barrio histórico multiétnico con arte callejero" },
    ],
  },
  {
    id: "amsterdam", name: "Ámsterdam", country: "Países Bajos", flag: "🇳🇱",
    costPerPerson: 800, durationDays: 4, type: "ciudad",
    description: "Canales, bicicletas y los mejores museos de Europa. La ciudad más liberal y acogedora del norte.",
    highlights: ["Rijksmuseum", "Casa de Ana Frank", "Vondelpark", "Molinos Zaanse Schans"],
    itinerary: [
      { date: "", title: "Día 1 — Llegada y canales", items: [{ time: "13:00", text: "Llegada a Schiphol" }, { time: "16:00", text: "Alquiler de bicicleta" }, { time: "17:00", text: "Primer recorrido por los canales del Jordaan" }, { time: "20:00", text: "Cena con erwtensoep (sopa de guisantes)" }] },
      { date: "", title: "Día 2 — Museos y Jordaan", items: [{ time: "09:00", text: "Rijksmuseum (Rembrandt, Vermeer)" }, { time: "12:00", text: "Museumplein" }, { time: "14:00", text: "Casa de Ana Frank (reserva previa obligatoria)" }, { time: "17:00", text: "Vondelpark al atardecer" }, { time: "20:00", text: "Cena en Leidseplein" }] },
      { date: "", title: "Día 3 — Excursión a Zaanse Schans", items: [{ time: "09:00", text: "Zaanse Schans: molinos de viento, queso y zuecos" }, { time: "13:00", text: "Almuerzo con queso gouda" }, { time: "16:00", text: "Regreso y Mercado del Waterlooplein" }, { time: "19:00", text: "Heineken Experience o Jenever en un proeflokaaltje" }] },
      { date: "", title: "Día 4 — Flores y regreso", items: [{ time: "09:30", text: "Mercado de Albert Cuyp" }, { time: "11:00", text: "Bloemenmarkt (el único mercado de flores en barco)" }, { time: "13:30", text: "Almuerzo de haring (arenque) con cebolla" }, { time: "16:00", text: "Traslado al aeropuerto Schiphol" }] },
    ],
    mapPlaces: [
      { name: "Rijksmuseum", lat: 52.36, lon: 4.89, note: "Museo nacional neerlandés, Rembrandt y Vermeer" },
      { name: "Casa de Ana Frank", lat: 52.37, lon: 4.88, note: "Memorial histórico, reserva con mucha antelación" },
      { name: "Vondelpark", lat: 52.36, lon: 4.87, note: "El pulmón verde de Ámsterdam" },
      { name: "Jordaan", lat: 52.37, lon: 4.88, note: "El barrio más bohemio con canales y galerías" },
      { name: "Zaanse Schans", lat: 52.47, lon: 4.82, note: "Molinos de viento históricos, 20 min en tren" },
    ],
  },
  {
    id: "paris", name: "París", country: "Francia", flag: "🇫🇷",
    costPerPerson: 950, durationDays: 5, type: "ciudad",
    description: "La Ciudad de la Luz: Torre Eiffel, Louvre, croissants y el Sena. El viaje que todo el mundo tiene que hacer.",
    highlights: ["Torre Eiffel", "Louvre", "Montmartre", "Versalles"],
    itinerary: [
      { date: "", title: "Día 1 — La Torre Eiffel", items: [{ time: "12:00", text: "Llegada a CDG u Orly" }, { time: "16:00", text: "Torre Eiffel (sube al segundo piso, reserva previa)" }, { time: "18:30", text: "Crucero por el Sena" }, { time: "21:00", text: "Cena en Saint-Germain-des-Prés" }] },
      { date: "", title: "Día 2 — El Louvre", items: [{ time: "09:00", text: "Louvre (Mona Lisa, Venus de Milo — 3h mínimo)" }, { time: "13:00", text: "Almuerzo en Les Halles" }, { time: "15:00", text: "Jardin des Tuileries → Arco del Triunfo" }, { time: "18:00", text: "Champs-Élysées" }, { time: "22:00", text: "La Torre Eiffel iluminada desde el Trocadero" }] },
      { date: "", title: "Día 3 — Montmartre y el Marais", items: [{ time: "09:30", text: "Montmartre y Sacré-Cœur" }, { time: "12:00", text: "Place du Tertre (artistas callejeros)" }, { time: "14:30", text: "Le Marais — barrio histórico" }, { time: "16:30", text: "Centre Pompidou" }, { time: "20:00", text: "Cena en Oberkampf" }] },
      { date: "", title: "Día 4 — Versalles", items: [{ time: "09:00", text: "Tren RER C a Versalles (30 min)" }, { time: "10:00", text: "Palacio de Versalles y jardines" }, { time: "14:00", text: "Picnic en los jardines de Le Nôtre" }, { time: "17:00", text: "Regreso y aperitivo en Pigalle" }] },
      { date: "", title: "Día 5 — Último croissant", items: [{ time: "09:00", text: "Desayuno en una boulangerie de barrio" }, { time: "11:00", text: "Ópera Garnier" }, { time: "14:00", text: "Última crêpe de Nutella" }, { time: "17:00", text: "Traslado al aeropuerto" }] },
    ],
    mapPlaces: [
      { name: "Torre Eiffel", lat: 48.86, lon: 2.29, note: "El símbolo de Francia, 330 m" },
      { name: "Louvre", lat: 48.86, lon: 2.33, note: "El museo más visitado del mundo" },
      { name: "Montmartre", lat: 48.89, lon: 2.34, note: "Barrio bohemio con artistas y el Sacré-Cœur" },
      { name: "Versalles", lat: 48.80, lon: 2.12, note: "Palacio real del Rey Sol, a 30 min" },
      { name: "Notre-Dame", lat: 48.85, lon: 2.35, note: "Catedral gótica en reconstrucción" },
    ],
  },
  {
    id: "estambul-dubai", name: "Dubái", country: "EAU", flag: "🇦🇪",
    costPerPerson: 1500, durationDays: 5, type: "ciudad",
    description: "El futuro hecho realidad: el rascacielos más alto del mundo, desierto dorado y malls de lujo.",
    highlights: ["Burj Khalifa", "Desert Safari", "Palm Jumeirah", "Dubai Frame"],
    itinerary: [
      { date: "", title: "Día 1 — Bienvenido al futuro", items: [{ time: "08:00", text: "Llegada a DXB" }, { time: "15:00", text: "Dubai Mall y fuentes coreografiadas del Burj Khalifa" }, { time: "19:30", text: "Subida al Burj Khalifa (At the Top, piso 124)" }, { time: "21:00", text: "Cena en Downtown Dubai" }] },
      { date: "", title: "Día 2 — Old Dubai y el Creek", items: [{ time: "09:30", text: "Barrio histórico de Al Fahidi" }, { time: "11:00", text: "Cruce en abra (barca de madera) por el Creek" }, { time: "12:00", text: "Zoco del Oro y Zoco de las Especias" }, { time: "15:30", text: "Dubai Frame: mitad antigua y mitad moderna" }] },
      { date: "", title: "Día 3 — Safari en el desierto", items: [{ time: "14:00", text: "Recogida en el hotel" }, { time: "15:30", text: "Dune bashing en 4x4 por las dunas rojas" }, { time: "17:00", text: "Sandboard y foto al atardecer" }, { time: "18:30", text: "Campamento beduino: cena, danza del vientre y shisha" }] },
      { date: "", title: "Día 4 — Palm y playas", items: [{ time: "09:00", text: "Palm Jumeirah en monorraíl" }, { time: "11:00", text: "Atlantis: Aquaventure Waterpark" }, { time: "16:00", text: "Playa de Jumeirah" }, { time: "20:00", text: "Cena en Dubai Marina" }] },
      { date: "", title: "Día 5 — Compras y regreso", items: [{ time: "10:00", text: "Últimas compras en Dubai Mall" }, { time: "13:00", text: "Shawarma final en la ciudad" }, { time: "16:00", text: "Traslado al aeropuerto" }] },
    ],
    mapPlaces: [
      { name: "Burj Khalifa", lat: 25.20, lon: 55.27, note: "El edificio más alto del mundo (828 m)" },
      { name: "Palm Jumeirah", lat: 25.11, lon: 55.14, note: "Isla artificial en forma de palmera" },
      { name: "Al Fahidi (Old Dubai)", lat: 25.26, lon: 55.30, note: "Barrio histórico del Dubai original" },
      { name: "Desierto de Dubái", lat: 24.91, lon: 55.49, note: "Safari: dunas de arena roja" },
      { name: "Dubai Marina", lat: 25.08, lon: 55.14, note: "Canal artificial con rascacielos y vida nocturna" },
    ],
  },
  {
    id: "bangkok", name: "Bangkok + Islas", country: "Tailandia", flag: "🇹🇭",
    costPerPerson: 1400, durationDays: 10, type: "cultura",
    description: "Templos dorados, tuk-tuks, street food increíble y las playas más paradisíacas de Asia.",
    highlights: ["Gran Palacio", "Wat Pho", "Islas Phi Phi", "Street food"],
    itinerary: [
      { date: "", title: "Día 1 — Llegada a Bangkok", items: [{ time: "07:00", text: "Llegada a Suvarnabhumi Airport" }, { time: "14:00", text: "Primer street food: pad thai y mango sticky rice" }, { time: "19:00", text: "Rooftop bar con vistas a la ciudad" }] },
      { date: "", title: "Día 2 — Templos del río", items: [{ time: "07:30", text: "Wat Phra Kaew (Templo del Buda Esmeralda)" }, { time: "09:30", text: "Gran Palacio Real" }, { time: "12:00", text: "Wat Pho (Buda Reclinado de 46 m)" }, { time: "15:00", text: "Barco por el río Chao Phraya" }, { time: "17:00", text: "Wat Arun al atardecer" }] },
      { date: "", title: "Día 3 — Chatuchak y ocio", items: [{ time: "09:00", text: "Mercado de Chatuchak (el mayor del mundo en fin de semana)" }, { time: "14:00", text: "Almuerzo de tom kha gai" }, { time: "17:00", text: "Masaje thai de 2 horas" }, { time: "21:00", text: "Noche en Khaosan Road" }] },
      { date: "", title: "Días 4-5 — Excursiones", items: [{ time: "07:00", text: "Mercado flotante de Damnoen Saduak (día 4)" }, { time: "09:00", text: "Templos del camino de regreso" }, { time: "Día 5", text: "Tren a Ayutthaya — antigua capital del reino (1h30)" }, { time: "11:00", text: "Ruinas de templos entre elefantes" }] },
      { date: "", title: "Días 6-8 — Islas (Koh Samui o Phuket)", items: [{ time: "08:00", text: "Vuelo a la isla elegida" }, { time: "12:00", text: "Llegada y primera playa paradisíaca" }, { time: "Día 7", text: "Excursión a las Islas Phi Phi en barco" }, { time: "Día 8", text: "Playa, snorkel y relax total" }] },
      { date: "", title: "Días 9-10 — Vuelta a Bangkok y regreso", items: [{ time: "08:00", text: "Regreso a Bangkok" }, { time: "15:00", text: "Últimas compras en Siam" }, { time: "Día 10", text: "Traslado al aeropuerto para el vuelo de regreso" }] },
    ],
    mapPlaces: [
      { name: "Gran Palacio (Bangkok)", lat: 13.75, lon: 100.49, note: "Complejo palaciego del siglo XVIII" },
      { name: "Wat Pho", lat: 13.75, lon: 100.49, note: "Templo del Buda Reclinado de 46 m" },
      { name: "Ayutthaya", lat: 14.36, lon: 100.57, note: "Antigua capital del reino de Siam" },
      { name: "Phuket / Phi Phi", lat: 7.88, lon: 98.39, note: "Islas paradisíacas del sur" },
      { name: "Koh Samui", lat: 9.53, lon: 100.06, note: "Isla de playas y cocoteros" },
    ],
  },
  {
    id: "islandia", name: "Islandia", country: "Islandia", flag: "🇮🇸",
    costPerPerson: 2000, durationDays: 7, type: "naturaleza",
    description: "El país de fuego y hielo: auroras boreales, géiseres, cascadas imposibles y ballenas. Naturaleza en estado puro.",
    highlights: ["Aurora boreal", "Geysir", "Gullfoss", "Jökulsárlón"],
    itinerary: [
      { date: "", title: "Día 1 — Reikiavik y Blue Lagoon", items: [{ time: "07:00", text: "Llegada a Keflavík" }, { time: "10:00", text: "Reikiavik: Hallgrímskirkja y Laugavegur" }, { time: "16:00", text: "Blue Lagoon (reserva previa imprescindible)" }, { time: "21:00", text: "Cena de cordero islandés en Reikiavik" }] },
      { date: "", title: "Día 2 — Golden Circle", items: [{ time: "08:00", text: "Þingvellir: caminar entre 2 placas tectónicas" }, { time: "11:00", text: "Geysir Strokkur (erupciona cada 5-7 min)" }, { time: "13:00", text: "Cascada de Gullfoss — la más famosa de Islandia" }, { time: "22:00", text: "Caza de auroras boreales (sept-marzo)" }] },
      { date: "", title: "Día 3 — Costa Sur", items: [{ time: "08:00", text: "Seljalandsfoss (puedes rodear la cascada)" }, { time: "10:00", text: "Skógafoss — cascada de 60 m" }, { time: "13:00", text: "Glaciar Eyjafjallajökull" }, { time: "15:00", text: "Playa negra de Reynisfjara (columnas de basalto)" }, { time: "18:00", text: "Alojamiento en Vík" }] },
      { date: "", title: "Día 4 — Glaciares", items: [{ time: "09:00", text: "Laguna glaciar de Jökulsárlón (icebergs azules)" }, { time: "11:30", text: "Diamond Beach (icebergs en arena negra)" }, { time: "14:00", text: "Senderismo en el glaciar Vatnajökull" }] },
      { date: "", title: "Días 5-6 — Snæfellsnes", items: [{ time: "08:00", text: "Península de Snæfellsnes — de película de ciencia ficción" }, { time: "11:00", text: "Parque Nacional Snæfellsjökull" }, { time: "14:00", text: "Acantilados de Arnarstapi" }, { time: "Día 6", text: "Cascada de Hraunfossar y Barnafoss" }] },
      { date: "", title: "Día 7 — Última aurora y regreso", items: [{ time: "10:00", text: "Última mañana en Reikiavik" }, { time: "22:00", text: "Intento final de aurora boreal" }, { time: "Madrugada", text: "Traslado al aeropuerto de Keflavík" }] },
    ],
    mapPlaces: [
      { name: "Reikiavik", lat: 64.14, lon: -21.94, note: "Capital, la más septentrional del mundo" },
      { name: "Geysir", lat: 64.31, lon: -20.30, note: "Géiser Strokkur erupciona cada 5 min" },
      { name: "Gullfoss", lat: 64.33, lon: -20.12, note: "La cascada más famosa de Islandia" },
      { name: "Jökulsárlón", lat: 64.08, lon: -16.23, note: "Laguna glaciar con icebergs azules" },
      { name: "Playa Negra Reynisfjara", lat: 63.41, lon: -19.04, note: "Arena negra y columnas de basalto" },
    ],
  },
  {
    id: "japon", name: "Tokio + Kioto", country: "Japón", flag: "🇯🇵",
    costPerPerson: 2500, durationDays: 10, type: "cultura",
    description: "El país del sol naciente: entre rascacielos futuristas y templos de 1.000 años. Sushi, sándwiches y el Monte Fuji.",
    highlights: ["Shibuya", "Fushimi Inari", "Monte Fuji", "Shinkansen"],
    itinerary: [
      { date: "", title: "Días 1-2 — Tokio: neón y tradición", items: [{ time: "09:00", text: "Llegada a Narita o Haneda" }, { time: "Tarde", text: "Shibuya Crossing y Harajuku" }, { time: "Noche", text: "Cena en Shinjuku: ramen en máquina expendedora" }, { time: "Día 2 mañana", text: "Templo Senso-ji en Asakusa" }, { time: "Tarde", text: "Akihabara: electrónica y cultura otaku" }] },
      { date: "", title: "Días 3-4 — Tokio profundo", items: [{ time: "09:00", text: "Sushi en Tsukiji Outer Market" }, { time: "11:00", text: "Shinjuku Gyoen (jardines imperiales)" }, { time: "15:00", text: "Odaiba y teamLab Planets (imprescindible)" }, { time: "Día 4", text: "Ikebukuro o Shimokitazawa (barrios alternativos)" }] },
      { date: "", title: "Día 5 — Monte Fuji y Hakone", items: [{ time: "07:00", text: "Shinkansen a Mishima (50 min)" }, { time: "10:00", text: "Hakone: vista del Monte Fuji" }, { time: "14:00", text: "Ryokan: onsen (baño termal japonés)" }] },
      { date: "", title: "Días 6-7 — Shinkansen a Kioto", items: [{ time: "09:00", text: "Bala de tren Tokio-Kioto (2h15m)" }, { time: "13:00", text: "Fushimi Inari: 10.000 toriis rojos" }, { time: "17:00", text: "Barrio de Gion — si hay suerte, geishas" }, { time: "Día 7 mañana", text: "Kinkaku-ji (Pabellón Dorado)" }, { time: "Tarde", text: "Arashiyama: bosque de bambú" }] },
      { date: "", title: "Días 8-9 — Nara y Osaka", items: [{ time: "09:00", text: "Nara: ciervos sagrados sueltos por la ciudad" }, { time: "11:00", text: "Tōdai-ji (el mayor edificio de madera del mundo)" }, { time: "Tarde", text: "Osaka: Dotonbori, takoyaki y okonomiyaki" }, { time: "Noche", text: "Vida nocturna de Osaka" }] },
      { date: "", title: "Día 10 — Regreso", items: [{ time: "09:00", text: "Últimas compras en Don Quijote" }, { time: "14:00", text: "Traslado al aeropuerto de Osaka (KIX)" }] },
    ],
    mapPlaces: [
      { name: "Shibuya (Tokio)", lat: 35.66, lon: 139.70, note: "El cruce peatonal más concurrido del mundo" },
      { name: "Templo Senso-ji", lat: 35.71, lon: 139.80, note: "El templo budista más antiguo de Tokio" },
      { name: "Fushimi Inari (Kioto)", lat: 34.97, lon: 135.77, note: "10.000 puertas torii rojas en la montaña" },
      { name: "Monte Fuji", lat: 35.36, lon: 138.73, note: "El volcán sagrado de Japón (3.776 m)" },
      { name: "Dotonbori (Osaka)", lat: 34.67, lon: 135.50, note: "Epicentro gastronómico de Osaka" },
    ],
  },
  {
    id: "nueva-york", name: "Nueva York", country: "Estados Unidos", flag: "🇺🇸",
    costPerPerson: 2700, durationDays: 7, type: "ciudad",
    description: "La ciudad que nunca duerme: Central Park, Brooklyn Bridge, Broadway y la skyline más icónica del mundo.",
    highlights: ["Empire State", "Central Park", "Brooklyn Bridge", "Times Square"],
    itinerary: [
      { date: "", title: "Día 1 — Bienvenido a Manhattan", items: [{ time: "11:00", text: "Llegada a JFK o Newark" }, { time: "16:00", text: "Times Square — sobrecogerse, no fotografiar" }, { time: "19:00", text: "Cena en Hell's Kitchen" }, { time: "21:00", text: "The High Line al anochecer" }] },
      { date: "", title: "Día 2 — Downtown", items: [{ time: "09:00", text: "Staten Island Ferry (GRATIS, vistas de la Estatua)" }, { time: "11:00", text: "9/11 Memorial & Museum" }, { time: "15:00", text: "One World Observatory (piso 100)" }, { time: "19:00", text: "Cena en Little Italy o Chinatown" }] },
      { date: "", title: "Día 3 — Museos y Central Park", items: [{ time: "09:00", text: "Central Park con bagel del carrito" }, { time: "11:00", text: "Metropolitan Museum of Art (colección de 5.000 años)" }, { time: "15:00", text: "Guggenheim" }, { time: "20:00", text: "Jazz en Harlem" }] },
      { date: "", title: "Día 4 — Brooklyn", items: [{ time: "09:30", text: "Puente de Brooklyn a pie (30 min)" }, { time: "11:30", text: "Brooklyn Heights Promenade — mejores vistas de Manhattan" }, { time: "13:00", text: "Smorgasburg Food Market" }, { time: "16:00", text: "Williamsburg: arte callejero y cerveza artesanal" }, { time: "19:00", text: "Empire State al atardecer" }] },
      { date: "", title: "Día 5 — Cultura y Broadway", items: [{ time: "10:00", text: "MoMA (Picasso, Warhol, Pollock)" }, { time: "14:00", text: "5ª Avenida y el Rockefeller Center" }, { time: "18:00", text: "Chelsea Market" }, { time: "20:00", text: "Musical de Broadway (reserva previa)" }] },
      { date: "", title: "Días 6-7 — Barrios y regreso", items: [{ time: "10:00", text: "Astoria (Queens): barrio griego y gastronomía" }, { time: "13:00", text: "Flushing: el Chinatown más grande fuera de China" }, { time: "17:00", text: "Último paseo por el Hudson River Park" }, { time: "Día 7", text: "Traslado al aeropuerto" }] },
    ],
    mapPlaces: [
      { name: "Times Square", lat: 40.76, lon: -73.99, note: "El cruce más famoso del mundo" },
      { name: "Central Park", lat: 40.78, lon: -73.97, note: "341 hectáreas en el corazón de Manhattan" },
      { name: "Estatua de la Libertad", lat: 40.69, lon: -74.04, note: "Símbolo de libertad desde 1886" },
      { name: "Brooklyn Bridge", lat: 40.71, lon: -73.99, note: "Puente icónico del s. XIX entre barrios" },
      { name: "Empire State Building", lat: 40.75, lon: -73.99, note: "La vista más icónica de Nueva York" },
    ],
  },
  {
    id: "maldivas", name: "Maldivas", country: "Maldivas", flag: "🇲🇻",
    costPerPerson: 3800, durationDays: 7, type: "playa",
    description: "El paraíso en la tierra: bungalows sobre el agua, arrecifes de coral, rayas manta y aguas turquesas cristalinas.",
    highlights: ["Overwater bungalows", "Snorkel con mantas", "Sunset cruise", "Aguas turquesas"],
    itinerary: [
      { date: "", title: "Día 1 — Paraíso, bienvenido", items: [{ time: "12:00", text: "Conexión en Colombo o Dubai" }, { time: "16:00", text: "Llegada a Malé" }, { time: "17:00", text: "Hidroavión o speedboat al resort (30-60 min)" }, { time: "19:00", text: "Cena romántica en el pier sobre el océano" }] },
      { date: "", title: "Días 2-3 — Playa y snorkel", items: [{ time: "09:00", text: "Snorkel en el arrecife de coral del resort" }, { time: "12:00", text: "Almuerzo de langosta y marisco fresco" }, { time: "15:00", text: "Kayak y paddleboard entre peces de colores" }, { time: "18:30", text: "Sunset cruise en dhoni tradicional" }] },
      { date: "", title: "Día 4 — Mantas y tiburones", items: [{ time: "07:30", text: "Excursión de snorkel con mantas en Hanifaru Bay" }, { time: "12:00", text: "Picnic en banco de arena desierto" }, { time: "16:00", text: "Avistamiento de delfines al atardecer" }] },
      { date: "", title: "Días 5-6 — Relax y Malé", items: [{ time: "09:00", text: "Spa de cuerpo entero en el resort" }, { time: "15:00", text: "Excursión a la isla local (aldea maldiviana)" }, { time: "Día 6", text: "Visita a Malé ciudad y mercado de pescado" }] },
      { date: "", title: "Día 7 — Regreso al mundo real", items: [{ time: "08:00", text: "Último baño matinal en el Índico" }, { time: "11:00", text: "Check-out con el corazón roto" }, { time: "14:00", text: "Hidroavión a Malé y vuelo de regreso" }] },
    ],
    mapPlaces: [
      { name: "Malé", lat: 4.18, lon: 73.51, note: "Capital de Maldivas" },
      { name: "Atolón Baa", lat: 5.08, lon: 73.07, note: "Reserva de la Biosfera UNESCO con mantas" },
      { name: "Hanifaru Bay", lat: 5.19, lon: 73.00, note: "Punto de encuentro de rayas manta" },
      { name: "Atolón South Malé", lat: 4.04, lon: 73.49, note: "Islas resort de lujo" },
    ],
  },
  {
    id: "mallorca", name: "Mallorca", country: "España", flag: "🇪🇸",
    costPerPerson: 380, durationDays: 5, type: "playa",
    description: "La isla más grande de Baleares: calas escondidas de agua cristalina, Palma medieval, Serra de Tramuntana y gastronomía mallorquina.",
    highlights: ["Cala Mondragó", "Catedral de Palma", "Serra de Tramuntana", "Sóller"],
    itinerary: [
      { date: "", title: "Día 1 — Palma de Mallorca", items: [{ time: "10:00", text: "Llegada y traslado desde Son Sant Joan (30 min)" }, { time: "13:00", text: "Catedral La Seu y Palau de l'Almudaina" }, { time: "16:00", text: "Barrio Antiguo: callejuelas y tapas" }, { time: "20:00", text: "Cena de pa amb oli y ensaimada" }] },
      { date: "", title: "Día 2 — Serra de Tramuntana", items: [{ time: "09:00", text: "Carretera de montaña hasta Valldemossa" }, { time: "11:00", text: "Pueblo de Deià — casas de piedra y artistas" }, { time: "14:00", text: "Puerto de Sóller: paella frente al mar" }, { time: "17:00", text: "Tren histórico de Sóller a Palma" }] },
      { date: "", title: "Días 3-4 — Calas del sur", items: [{ time: "10:00", text: "Cala Mondragó: arena blanca y aguas turquesas" }, { time: "13:00", text: "Snorkel entre peces" }, { time: "15:00", text: "Cala d'Or: paseo marítimo y helado" }, { time: "Día 4", text: "Cala Varques (acceso a pie, la más salvaje)" }] },
      { date: "", title: "Día 5 — Regreso", items: [{ time: "09:00", text: "Mercado de l'Olivar en Palma" }, { time: "12:00", text: "Últimas compras de sobrasada y vino Malvasía" }, { time: "15:00", text: "Vuelo de regreso" }] },
    ],
    mapPlaces: [
      { name: "Catedral de Palma", lat: 39.57, lon: 2.65, note: "Gótico imponente junto al mar" },
      { name: "Cala Mondragó", lat: 39.34, lon: 3.19, note: "Parque Natural con aguas cristalinas" },
      { name: "Valldemossa", lat: 39.71, lon: 2.62, note: "Pueblo de montaña donde vivió Chopin" },
      { name: "Puerto de Sóller", lat: 39.80, lon: 2.69, note: "Puerto tranquilo con tren vintage" },
    ],
  },
  {
    id: "fuerteventura", name: "Fuerteventura", country: "España", flag: "🇪🇸",
    costPerPerson: 420, durationDays: 6, type: "playa",
    description: "Las mejores playas de Europa: dunas de Corralejo, kitesurf en Sotavento, playas de arena blanca infinitas y ambiente relajado.",
    highlights: ["Dunas de Corralejo", "Kitesurf Sotavento", "Cofete", "Isla de Lobos"],
    itinerary: [
      { date: "", title: "Día 1 — Llegada y Corralejo", items: [{ time: "11:00", text: "Llegada a Puerto del Rosario" }, { time: "14:00", text: "Corralejo: primera cerveza en la playa" }, { time: "18:00", text: "Dunas del Parque Natural al atardecer (imprescindible)" }] },
      { date: "", title: "Día 2 — Isla de Lobos", items: [{ time: "09:30", text: "Ferry a Isla de Lobos (15 min desde Corralejo)" }, { time: "10:00", text: "Snorkel en aguas vírgenes sin turistas" }, { time: "13:00", text: "Picnic en la playa" }, { time: "16:00", text: "Regreso y relajación en playa Grandes Playas" }] },
      { date: "", title: "Día 3 — Sur: Sotavento", items: [{ time: "09:00", text: "Conducción por la costa oeste" }, { time: "11:00", text: "Playa de Cofete: salvaje, solitaria, impresionante" }, { time: "14:00", text: "Playa de Sotavento: laguna de kitesurf" }, { time: "18:00", text: "Pueblo de Morro Jable" }] },
      { date: "", title: "Días 4-5 — Relax y surf", items: [{ time: "09:00", text: "Clase de surf o kitesurf" }, { time: "Tarde", text: "Antigua: molinos y queso majorero" }, { time: "Noche", text: "Restaurante de pescado fresco" }] },
      { date: "", title: "Día 6 — Regreso", items: [{ time: "10:00", text: "Última sesión de playa" }, { time: "14:00", text: "Vuelo de regreso" }] },
    ],
    mapPlaces: [
      { name: "Dunas de Corralejo", lat: 28.72, lon: -13.86, note: "Parque Natural con dunas de arena blanca" },
      { name: "Isla de Lobos", lat: 28.74, lon: -13.82, note: "Islote virgen con snorkel excepcional" },
      { name: "Playa de Cofete", lat: 28.08, lon: -14.41, note: "La playa más salvaje de Canarias" },
      { name: "Playa de Sotavento", lat: 28.24, lon: -14.16, note: "Laguna perfecta para kitesurf" },
    ],
  },
  {
    id: "budapest", name: "Budapest", country: "Hungría", flag: "🇭🇺",
    costPerPerson: 490, durationDays: 5, type: "ciudad",
    description: "La perla del Danubio: Parlamento neogótico, baños termales romanos, ruin bars y la gastronomía del Este más sorprendente de Europa.",
    highlights: ["Parlamento", "Baños Széchenyi", "Ruin bars", "Bastión de los Pescadores"],
    itinerary: [
      { date: "", title: "Día 1 — Buda y el Castillo", items: [{ time: "10:00", text: "Bastión de los Pescadores — vista panorámica" }, { time: "12:00", text: "Iglesia de Matías y Palacio Real" }, { time: "15:00", text: "Descenso en funicular" }, { time: "20:00", text: "Primer ruin bar: Szimpla Kert" }] },
      { date: "", title: "Día 2 — Pest y el Parlamento", items: [{ time: "09:00", text: "Visita al Parlamento (uno de los más hermosos del mundo)" }, { time: "12:00", text: "Gran Mercado Central: goulash y paprika" }, { time: "15:00", text: "Calle Váci y tiendas" }, { time: "19:00", text: "Crucero nocturno por el Danubio" }] },
      { date: "", title: "Día 3 — Termas", items: [{ time: "10:00", text: "Baños Széchenyi: termas art nouveau en el parque" }, { time: "14:00", text: "Lunch en terraza de Andrássy" }, { time: "16:00", text: "Museo del Terror — historia impactante del s. XX" }, { time: "20:00", text: "Cena de paprikash de pollo" }] },
      { date: "", title: "Días 4-5 — Excursión y fiesta", items: [{ time: "09:00", text: "Curva del Danubio: Esztergom y Visegrád" }, { time: "Día 5 tarde", text: "Bar crawl por el barrio judío" }, { time: "21:00", text: "Fiesta Gozsdu Udvar" }] },
    ],
    mapPlaces: [
      { name: "Parlamento de Budapest", lat: 47.51, lon: 19.05, note: "Uno de los edificios más bellos de Europa" },
      { name: "Bastión de los Pescadores", lat: 47.50, lon: 19.03, note: "Vistas panorámicas sobre el Danubio" },
      { name: "Baños Széchenyi", lat: 47.52, lon: 19.08, note: "Termas art nouveau con piscina exterior" },
      { name: "Szimpla Kert", lat: 47.50, lon: 19.07, note: "El ruin bar más famoso del mundo" },
    ],
  },
  {
    id: "malta", name: "Malta", country: "Malta", flag: "🇲🇹",
    costPerPerson: 460, durationDays: 5, type: "cultura",
    description: "La isla mediterránea donde conviven fenicios, romanos, cruzados y barrocos: megálitos prehistóricos, Valletta barroca y aguas turquesas.",
    highlights: ["Valletta", "Mdina", "Templos megalíticos", "Gozo"],
    itinerary: [
      { date: "", title: "Día 1 — Valletta", items: [{ time: "11:00", text: "Llegada a Malta International Airport" }, { time: "14:00", text: "Valletta: la capital barroca más pequeña de Europa" }, { time: "16:00", text: "Co-Catedral de San Juan con Caravaggio" }, { time: "19:00", text: "Atardecer en Upper Barrakka Gardens" }] },
      { date: "", title: "Día 2 — Mdina y Rabat", items: [{ time: "09:30", text: "Mdina: la ciudad silenciosa amurallada" }, { time: "12:00", text: "Rabat: catacumbas paleocristianas" }, { time: "15:00", text: "Blue Grotto en barco" }, { time: "19:00", text: "Cena en Marsaxlokk (pueblo de pescadores)" }] },
      { date: "", title: "Día 3 — Templos prehistóricos", items: [{ time: "09:00", text: "Templos de Tarxien (3600 a.C.)" }, { time: "11:00", text: "Hypogeo de Hal Saflieni (reserva previa)" }, { time: "15:00", text: "Three Cities en barco desde Valletta" }] },
      { date: "", title: "Días 4-5 — Gozo", items: [{ time: "08:30", text: "Ferry a la isla de Gozo (25 min)" }, { time: "10:00", text: "Azure Window (zona) y playa de Ramla" }, { time: "13:00", text: "Victoria: capital con ciudadela" }, { time: "Día 5", text: "Buceo y snorkel en las Crystal Lagoon" }] },
    ],
    mapPlaces: [
      { name: "Valletta", lat: 35.90, lon: 14.51, note: "Capital barroca Patrimonio UNESCO" },
      { name: "Mdina", lat: 35.89, lon: 14.40, note: "Ciudad silenciosa y amurallada" },
      { name: "Blue Grotto", lat: 35.82, lon: 14.43, note: "Cueva marina de aguas azul zafiro" },
      { name: "Gozo (Azure Window)", lat: 36.05, lon: 14.19, note: "Arco de roca hundido — belleza paisajística" },
    ],
  },
  {
    id: "viena", name: "Viena", country: "Austria", flag: "🇦🇹",
    costPerPerson: 750, durationDays: 5, type: "cultura",
    description: "La ciudad de los valses y Klimt: Schönbrunn, la Ópera, Prater y los cafés históricos donde Einstein y Freud tomaban su melange.",
    highlights: ["Schönbrunn", "Museo de Arte KHM", "Ópera Estatal", "Café Central"],
    itinerary: [
      { date: "", title: "Día 1 — Ringstrasse y el centro", items: [{ time: "10:00", text: "Llegada desde el aeropuerto en el City Airport Train" }, { time: "13:00", text: "Paseo por la Ringstrasse con sus palacios" }, { time: "15:00", text: "Catedral de San Esteban" }, { time: "19:00", text: "Café Central: café melange y strudel de manzana" }] },
      { date: "", title: "Día 2 — Schönbrunn y Naschmarkt", items: [{ time: "09:00", text: "Palacio de Schönbrunn y jardines (1.441 habitaciones)" }, { time: "13:00", text: "Naschmarkt: el mercado más grande de Viena" }, { time: "16:00", text: "Belvedere: El Beso de Klimt (el original)" }, { time: "19:00", text: "Aperitivo en la azotea" }] },
      { date: "", title: "Día 3 — Arte y música", items: [{ time: "10:00", text: "Kunsthistorisches Museum (KHM)" }, { time: "14:00", text: "MuseumsQuartier: arte contemporáneo" }, { time: "19:30", text: "Concierto en la Ópera Estatal o Musikverein" }] },
      { date: "", title: "Días 4-5 — Viena imperial", items: [{ time: "09:00", text: "Hofburg: residencia imperial de los Habsburgo" }, { time: "12:00", text: "Cripta Imperial: 149 ataúdes de emperadores" }, { time: "15:00", text: "Prater y la noria histórica" }, { time: "Día 5", text: "Visita a Klosterneuburg o Baden bei Wien" }] },
    ],
    mapPlaces: [
      { name: "Palacio de Schönbrunn", lat: 48.18, lon: 16.31, note: "Palacio barroco de 1.441 habitaciones" },
      { name: "Belvedere", lat: 48.19, lon: 16.38, note: "El Beso de Klimt expuesto aquí" },
      { name: "Catedral de San Esteban", lat: 48.21, lon: 16.37, note: "Gótico en el corazón de Viena" },
      { name: "Naschmarkt", lat: 48.20, lon: 16.36, note: "El gran mercado vienés al aire libre" },
    ],
  },
  {
    id: "berlin", name: "Berlín", country: "Alemania", flag: "🇩🇪",
    costPerPerson: 680, durationDays: 6, type: "ciudad",
    description: "Historia, street art y vida nocturna: el Muro, Checkpoint Charlie, Pergamón, los museos de la isla y la capital del techno mundial.",
    highlights: ["Muro de Berlín", "Puerta de Brandeburgo", "Isla de los Museos", "Techno clubs"],
    itinerary: [
      { date: "", title: "Día 1 — Historia y el Muro", items: [{ time: "10:00", text: "Llegada desde Tegel o Brandenburg BER" }, { time: "13:00", text: "East Side Gallery: el Muro pintado (1,3 km)" }, { time: "15:00", text: "Checkpoint Charlie" }, { time: "18:00", text: "Topografía del Terror" }, { time: "20:00", text: "Cena de currywurst berlinesa" }] },
      { date: "", title: "Día 2 — Centro histórico", items: [{ time: "09:00", text: "Puerta de Brandeburgo al amanecer" }, { time: "10:00", text: "Memorial al Holocausto" }, { time: "12:00", text: "Reichstag: cúpula de cristal (reserva gratis)" }, { time: "15:00", text: "Potsdamer Platz" }, { time: "19:00", text: "Cerveza en Prenzlauer Berg" }] },
      { date: "", title: "Día 3 — Isla de los Museos", items: [{ time: "09:00", text: "Pergamón Museum: altar helenístico y puerta babilónica" }, { time: "13:00", text: "Neues Museum: busto de Nefertiti" }, { time: "16:00", text: "Berliner Dom" }, { time: "19:00", text: "Hackesche Höfe" }] },
      { date: "", title: "Días 4-6 — Arte callejero y cultura", items: [{ time: "10:00", text: "Barrio de Kreuzberg: arte callejero y mercado turco" }, { time: "13:00", text: "Tempelhofer Feld: antiguo aeropuerto ahora parque" }, { time: "Noche 5", text: "Berghain o Watergate — techno hasta el amanecer" }, { time: "Día 6", text: "Potsdam: palacios de Federico el Grande" }] },
    ],
    mapPlaces: [
      { name: "Puerta de Brandeburgo", lat: 52.52, lon: 13.38, note: "El símbolo de la reunificación alemana" },
      { name: "East Side Gallery", lat: 52.51, lon: 13.44, note: "1,3 km del Muro pintado por artistas" },
      { name: "Isla de los Museos", lat: 52.52, lon: 13.40, note: "5 museos Patrimonio UNESCO" },
      { name: "Checkpoint Charlie", lat: 52.51, lon: 13.39, note: "El famoso cruce fronterizo de la Guerra Fría" },
    ],
  },
  {
    id: "edimburgo", name: "Edimburgo", country: "Escocia (UK)", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
    costPerPerson: 720, durationDays: 5, type: "cultura",
    description: "La ciudad más romántica de Gran Bretaña: castillo medieval sobre roca volcánica, Royal Mile, whisky escocés y los Highlands a un paso.",
    highlights: ["Castillo de Edimburgo", "Royal Mile", "Arthur's Seat", "Whisky tours"],
    itinerary: [
      { date: "", title: "Día 1 — Old Town", items: [{ time: "11:00", text: "Llegada y check-in en el Old Town" }, { time: "14:00", text: "Castillo de Edimburgo: One O'Clock Gun" }, { time: "17:00", text: "Royal Mile: callejones y mercados" }, { time: "20:00", text: "Pub escocés: haggis y whisky" }] },
      { date: "", title: "Día 2 — Holyrood y New Town", items: [{ time: "09:30", text: "Palacio de Holyroodhouse (residencia real)" }, { time: "12:00", text: "Arthur's Seat: subida al volcán extinto (1h)" }, { time: "15:00", text: "Georgian New Town: arquitectura neoclásica" }, { time: "19:00", text: "Whisky tour en Scotch Whisky Experience" }] },
      { date: "", title: "Día 3 — Excursión Highlands", items: [{ time: "08:00", text: "Tour en bus a Loch Ness y Glencoe" }, { time: "11:00", text: "Loch Ness: ¿aparecerá Nessie?" }, { time: "14:00", text: "Glencoe: el valle más dramático de Escocia" }, { time: "19:00", text: "Regreso a Edimburgo" }] },
      { date: "", title: "Días 4-5 — Cultura y Roslin", items: [{ time: "10:00", text: "National Museum of Scotland (gratis)" }, { time: "13:00", text: "Capilla de Rosslyn (del Código Da Vinci)" }, { time: "16:00", text: "Greyfriars Kirkyard — el cementerio más encantado" }, { time: "Día 5 noche", text: "Ghost tour nocturno por el Old Town" }] },
    ],
    mapPlaces: [
      { name: "Castillo de Edimburgo", lat: 55.95, lon: -3.20, note: "Fortaleza sobre roca volcánica del s. XII" },
      { name: "Arthur's Seat", lat: 55.94, lon: -3.16, note: "Volcán extinto con vistas de 360°" },
      { name: "Palacio de Holyroodhouse", lat: 55.95, lon: -3.17, note: "Residencia oficial de la Familia Real en Escocia" },
      { name: "Loch Ness", lat: 57.32, lon: -4.44, note: "El lago más famoso del mundo" },
    ],
  },
  {
    id: "florencia", name: "Florencia", country: "Italia", flag: "🇮🇹",
    costPerPerson: 850, durationDays: 5, type: "cultura",
    description: "La cuna del Renacimiento: los Uffizi con Botticelli, el David de Miguel Ángel, il Duomo, vino Chianti y bistecca alla fiorentina.",
    highlights: ["Galería Uffizi", "David de Miguel Ángel", "il Duomo", "Ponte Vecchio"],
    itinerary: [
      { date: "", title: "Día 1 — Centro storico", items: [{ time: "11:00", text: "Llegada a Santa Maria Novella" }, { time: "14:00", text: "Piazza del Duomo: Catedral, Baptisterio y Campanile" }, { time: "17:00", text: "Ponte Vecchio al atardecer" }, { time: "20:00", text: "Bistecca alla fiorentina en Trattoria" }] },
      { date: "", title: "Día 2 — Galería Uffizi", items: [{ time: "09:00", text: "Uffizi: La Primavera y El Nacimiento de Venus (reserva obligatoria)" }, { time: "13:00", text: "Almuerzo con vista al Arno" }, { time: "15:00", text: "Galería de la Academia: el David original" }, { time: "19:00", text: "Aperitivo en San Niccolo" }] },
      { date: "", title: "Día 3 — Oltrarno", items: [{ time: "10:00", text: "Jardines de Bóboli (panorámica de la ciudad)" }, { time: "13:00", text: "Palazzo Pitti" }, { time: "15:00", text: "Artesanos de cuero en el Oltrarno" }, { time: "18:00", text: "Piazzale Michelangelo al atardecer" }] },
      { date: "", title: "Días 4-5 — Chianti y Siena", items: [{ time: "09:00", text: "Ruta del Chianti: bodegas y vino" }, { time: "14:00", text: "Greve in Chianti: degustación" }, { time: "Día 5", text: "Siena y la Piazza del Campo" }] },
    ],
    mapPlaces: [
      { name: "il Duomo (Florencia)", lat: 43.77, lon: 11.26, note: "La cúpula de Brunelleschi — mayor del Renacimiento" },
      { name: "Galería Uffizi", lat: 43.77, lon: 11.26, note: "La colección renacentista más importante del mundo" },
      { name: "Ponte Vecchio", lat: 43.77, lon: 11.25, note: "Puente del s. XIV con joyerías" },
      { name: "Piazzale Michelangelo", lat: 43.76, lon: 11.27, note: "Mejor mirador de Florencia" },
    ],
  },
  {
    id: "atenas", name: "Atenas", country: "Grecia", flag: "🇬🇷",
    costPerPerson: 780, durationDays: 6, type: "cultura",
    description: "La cuna de la democracia occidental: la Acrópolis iluminada de noche, el Partenón, el ágora antigua, el barrio de Monastiraki y el mejor souvlaki del mundo.",
    highlights: ["Acrópolis", "Partenón", "Museo Nacional", "Monastiraki"],
    itinerary: [
      { date: "", title: "Día 1 — La Acrópolis", items: [{ time: "09:00", text: "Acrópolis: Partenón, Propileos, Erecteion (vista desde abajo primero)" }, { time: "13:00", text: "Museo de la Acrópolis (increíble)" }, { time: "16:00", text: "Barrio de Plaka: callejuelas blancas y azules" }, { time: "20:00", text: "Cena griega: moussaka, tzatziki y vino retsina" }] },
      { date: "", title: "Día 2 — Ágora y museos", items: [{ time: "09:30", text: "Ágora Antigua: donde vivían Sócrates y Aristóteles" }, { time: "12:00", text: "Templo de Hefesto (el mejor conservado de Grecia)" }, { time: "14:00", text: "Monastiraki: mercado de pulgas y souvlaki" }, { time: "17:00", text: "Colina de Licabeto: vistas panorámicas" }] },
      { date: "", title: "Días 3-4 — Excursión Cabo Sounion", items: [{ time: "09:00", text: "Templo de Poseidón en el Cabo Sounion" }, { time: "13:00", text: "Playa de Vouliagmeni: agua termal natural" }, { time: "Día 4", text: "Delfos: el ombligo del mundo (oracle)" }] },
      { date: "", title: "Días 5-6 — Islas", items: [{ time: "08:30", text: "Ferry rápido a Hidra o Egina (1h)" }, { time: "Día entero", text: "Sin coches: burros y barcos de madera" }, { time: "Día 6", text: "Mercado central de Atenas y despedida" }] },
    ],
    mapPlaces: [
      { name: "Acrópolis de Atenas", lat: 37.97, lon: 23.73, note: "La colina sagrada más famosa del mundo" },
      { name: "Ágora Antigua", lat: 37.97, lon: 23.72, note: "Centro de la vida civil ateniense" },
      { name: "Cabo Sounion", lat: 37.65, lon: 24.03, note: "Templo de Poseidón sobre el mar Egeo" },
      { name: "Monastiraki", lat: 37.98, lon: 23.73, note: "Barrio bohemio con vistas a la Acrópolis" },
    ],
  },
  {
    id: "croacia", name: "Split & Dubrovnik", country: "Croacia", flag: "🇭🇷",
    costPerPerson: 920, durationDays: 7, type: "playa",
    description: "La Dalmacia croata: el palacio romano de Diocleciano en Split, las murallas medievales de Dubrovnik (Desembarco de Reyes), islas de Hvar y Brač.",
    highlights: ["Murallas de Dubrovnik", "Palacio de Diocleciano", "Isla de Hvar", "Plitvice"],
    itinerary: [
      { date: "", title: "Días 1-2 — Split", items: [{ time: "11:00", text: "Llegada a Split. La gente vive DENTRO del palacio romano" }, { time: "14:00", text: "Peristilo y catedral (antigua tumba de Diocleciano)" }, { time: "Día 2", text: "Ferry a la Isla de Brač: Playa Zlatni Rat (la más famosa de Croacia)" }] },
      { date: "", title: "Días 3-4 — Hvar", items: [{ time: "09:30", text: "Ferry a Hvar: la isla más lujosa de Croacia" }, { time: "12:00", text: "Fortaleza española con vistas a las islas Pakleni" }, { time: "15:00", text: "Playas y kayak por las islas" }, { time: "Noche", text: "Vida nocturna de Hvar (la más animada del Adriático)" }] },
      { date: "", title: "Días 5-7 — Dubrovnik", items: [{ time: "11:00", text: "Llegada a Dubrovnik: King's Landing" }, { time: "14:00", text: "Paseo por las murallas medievales (2 km)" }, { time: "16:00", text: "Game of Thrones tour" }, { time: "Día 6", text: "Isla de Lokrum en barco" }, { time: "Día 7", text: "Teleférico al monte Srđ: toda la costa Dálmata" }] },
    ],
    mapPlaces: [
      { name: "Dubrovnik", lat: 42.65, lon: 18.09, note: "Ciudad amurallada Patrimonio UNESCO" },
      { name: "Split (Palacio Diocleciano)", lat: 43.51, lon: 16.44, note: "Palacio romano del s. IV habitado hoy" },
      { name: "Hvar", lat: 43.17, lon: 16.44, note: "La isla más elegante del Adriático" },
      { name: "Playa Zlatni Rat (Brač)", lat: 43.32, lon: 16.64, note: "La playa más famosa de Croacia" },
    ],
  },
  {
    id: "egipto", name: "Egipto", country: "Egipto", flag: "🇪🇬",
    costPerPerson: 1100, durationDays: 8, type: "cultura",
    description: "Las maravillas del mundo antiguo: las pirámides de Giza, la Esfinge, el Valle de los Reyes, el templo de Karnak y el crucero por el Nilo.",
    highlights: ["Pirámides de Giza", "Valle de los Reyes", "Karnak", "Crucero por el Nilo"],
    itinerary: [
      { date: "", title: "Días 1-2 — El Cairo y Giza", items: [{ time: "12:00", text: "Llegada a El Cairo Internacional" }, { time: "16:00", text: "Barrio Islámico: mezquita de Ibn Tulun" }, { time: "Día 2", text: "Pirámides de Giza al amanecer (sin turistas)" }, { time: "12:00", text: "La Esfinge" }, { time: "15:00", text: "Museo Egipcio: máscara de Tutankamon" }] },
      { date: "", title: "Días 3-4 — Luxor", items: [{ time: "08:00", text: "Vuelo a Luxor (1h)" }, { time: "10:00", text: "Valle de los Reyes: tumba de Tutankamon" }, { time: "14:00", text: "Templo de Hatshepsut" }, { time: "Día 4 tarde", text: "Karnak: el mayor complejo de templos del mundo" }, { time: "20:00", text: "Sound & Light Show en Karnak" }] },
      { date: "", title: "Días 5-7 — Crucero por el Nilo", items: [{ time: "09:00", text: "Embarque en crucero Luxor-Asuán" }, { time: "11:00", text: "Templo de Edfú (el mejor conservado)" }, { time: "Día 6", text: "Kom Ombo: templo doble de Sobek y Horus" }, { time: "Día 7 mañana", text: "Asuán: Presa y Templo de Philae en islote" }] },
      { date: "", title: "Día 8 — Abu Simbel", items: [{ time: "04:00", text: "Salida al amanecer a Abu Simbel (3h)" }, { time: "07:00", text: "Templos de Ramsés II y Nefertari" }, { time: "14:00", text: "Regreso a El Cairo y vuelo de vuelta" }] },
    ],
    mapPlaces: [
      { name: "Pirámides de Giza", lat: 29.98, lon: 31.13, note: "La única de las 7 Maravillas Antiguas que existe" },
      { name: "Luxor (Karnak)", lat: 25.72, lon: 32.66, note: "La mayor ciudad a cielo abierto del mundo antiguo" },
      { name: "Valle de los Reyes", lat: 25.74, lon: 32.60, note: "63 tumbas reales del Imperio Nuevo" },
      { name: "Abu Simbel", lat: 22.34, lon: 31.63, note: "Templos de Ramsés II trasladados del Nilo" },
    ],
  },
  {
    id: "mexico", name: "Riviera Maya", country: "México", flag: "🇲🇽",
    costPerPerson: 1350, durationDays: 9, type: "playa",
    description: "Playas caribeñas infinitas con aguas turquesas, cenotes mayas, Chichén Itzá, Tulum y la gastronomía mexicana más vibrante.",
    highlights: ["Chichén Itzá", "Cenotes", "Tulum", "Playas de Cancún"],
    itinerary: [
      { date: "", title: "Días 1-2 — Cancún", items: [{ time: "12:00", text: "Llegada a Cancún" }, { time: "16:00", text: "Zona Hotelera: primer baño en el Caribe" }, { time: "Día 2", text: "Isla Mujeres en barco: la playa más hermosa de Cancún" }] },
      { date: "", title: "Días 3-4 — Chichén Itzá y Valladolid", items: [{ time: "07:00", text: "Salida temprana a Chichén Itzá" }, { time: "09:00", text: "El Castillo, Juego de Pelota y Cenote Sagrado" }, { time: "14:00", text: "Valladolid: pueblo colonial y cenote Suytun" }, { time: "Día 4", text: "Cenotes Ik Kil o Hubiku" }] },
      { date: "", title: "Días 5-6 — Tulum", items: [{ time: "09:00", text: "Zona arqueológica de Tulum: pirámides sobre el mar" }, { time: "12:00", text: "Cenote Grande o Calavera" }, { time: "15:00", text: "Playa de Tulum: la más instagrameable" }, { time: "Noche", text: "Restaurantes bohemios de la Zona Hotelera" }] },
      { date: "", title: "Días 7-9 — Playa del Carmen", items: [{ time: "10:00", text: "5ª Avenida: mercados y tiendas" }, { time: "Tarde", text: "Xcaret o Xel-Há: snorkel en cenote marino" }, { time: "Día 8", text: "Cozumel: arrecife de coral (snorkel excepcional)" }, { time: "Día 9", text: "Vuelo de regreso desde Cancún" }] },
    ],
    mapPlaces: [
      { name: "Chichén Itzá", lat: 20.68, lon: -88.57, note: "Una de las Nuevas 7 Maravillas del Mundo" },
      { name: "Tulum", lat: 20.21, lon: -87.46, note: "Pirámides mayas sobre el mar Caribe" },
      { name: "Cancún", lat: 21.16, lon: -86.85, note: "Capital del Caribe mexicano" },
      { name: "Cozumel", lat: 20.42, lon: -86.92, note: "Arrecife de coral entre los mejores del mundo" },
    ],
  },
  {
    id: "cuba", name: "Cuba", country: "Cuba", flag: "🇨🇺",
    costPerPerson: 1200, durationDays: 9, type: "cultura",
    description: "La isla del tiempo detenido: La Habana Vieja colonial, coches americanos de los 50, música salsa en cada esquina, Varadero y Trinidad.",
    highlights: ["La Habana Vieja", "Coches clásicos", "Trinidad", "Varadero"],
    itinerary: [
      { date: "", title: "Días 1-3 — La Habana", items: [{ time: "12:00", text: "Llegada a José Martí Internacional" }, { time: "16:00", text: "Malecón al atardecer con mojito" }, { time: "Día 2", text: "La Habana Vieja: UNESCO. Plazas coloniales" }, { time: "Noche", text: "Son cubano en La Bodeguita del Medio" }, { time: "Día 3", text: "Revolución: Plaza de la Revolución, Che Guevara" }] },
      { date: "", title: "Días 4-5 — Viñales", items: [{ time: "08:00", text: "Bus a Viñales (3h)" }, { time: "12:00", text: "Valle de Viñales: mogotes y tabaco" }, { time: "15:00", text: "Plantación de tabaco: rolando puros" }, { time: "Día 5", text: "Cueva del Indio en barca" }] },
      { date: "", title: "Días 6-7 — Trinidad", items: [{ time: "09:00", text: "Bus a Trinidad por la costa" }, { time: "13:00", text: "Trinidad: la ciudad más bella de Cuba" }, { time: "16:00", text: "Playa Ancón" }, { time: "Noche", text: "La Ruina: sala de salsa en la Plaza Mayor" }] },
      { date: "", title: "Días 8-9 — Varadero", items: [{ time: "09:00", text: "Playa de Varadero: 22 km de arena blanca" }, { time: "Tarde", text: "Snorkel en el arrecife" }, { time: "Día 9", text: "Regreso a La Habana y vuelo de vuelta" }] },
    ],
    mapPlaces: [
      { name: "La Habana Vieja", lat: 23.14, lon: -82.35, note: "Centro histórico Patrimonio UNESCO" },
      { name: "Valle de Viñales", lat: 22.62, lon: -83.72, note: "Patrimonio UNESCO: tabaco y mogotes" },
      { name: "Trinidad", lat: 21.80, lon: -79.98, note: "La ciudad colonial más conservada del Caribe" },
      { name: "Varadero", lat: 23.16, lon: -81.26, note: "22 km de playa caribeña de arena blanca" },
    ],
  },
  {
    id: "vietnam", name: "Vietnam", country: "Vietnam", flag: "🇻🇳",
    costPerPerson: 1450, durationDays: 11, type: "aventura",
    description: "Del norte al sur: Hanói colonial, la bahía de Halong entre 2.000 islas kársticas, Hội An encantadora y la vibrante Ciudad Ho Chi Minh.",
    highlights: ["Bahía de Halong", "Hội An", "Hanói", "Mekong"],
    itinerary: [
      { date: "", title: "Días 1-2 — Hanói", items: [{ time: "11:00", text: "Llegada a Nội Bài. Barrio Antiguo: 36 calles gremiales" }, { time: "16:00", text: "Lago Hoan Kiem y templo de la Tortuga de Jade" }, { time: "Día 2", text: "Templo de la Literatura. Pho bo para desayunar" }, { time: "Noche", text: "Bia hoi (cerveza de barril callejera): 20 céntimos" }] },
      { date: "", title: "Días 3-5 — Bahía de Halong", items: [{ time: "08:00", text: "Bus y barco a la bahía" }, { time: "14:00", text: "Navegación entre 2.000 islotes kársticos" }, { time: "17:00", text: "Kayak por cuevas y lagunas interiores" }, { time: "Noche", text: "Cena y noche a bordo del junco" }, { time: "Día 5", text: "Sapa en tren nocturno" }] },
      { date: "", title: "Días 6-7 — Hội An", items: [{ time: "10:00", text: "Vuelo Hanói-Da Nang (1h)" }, { time: "13:00", text: "Hội An: el pueblo más fotogénico de Asia" }, { time: "16:00", text: "Puente japonés cubierto (s. XVIII)" }, { time: "Noche", text: "Linternas en el río Thu Bồn" }] },
      { date: "", title: "Días 8-11 — Ciudad Ho Chi Minh", items: [{ time: "10:00", text: "Vuelo a HCMC (1h30)" }, { time: "14:00", text: "Túneles de Cu Chi: red de 250 km de la guerra" }, { time: "Día 9", text: "Delta del Mekong: mercado flotante" }, { time: "Día 10", text: "HCMC: Ben Thanh Market, barrio francés" }, { time: "Día 11", text: "Vuelo de regreso" }] },
    ],
    mapPlaces: [
      { name: "Bahía de Halong", lat: 20.91, lon: 107.18, note: "Patrimonio UNESCO: 2.000 islotes kársticos" },
      { name: "Hội An", lat: 15.88, lon: 108.33, note: "Pueblo Patrimonio UNESCO con linternas" },
      { name: "Hanói (Lago Hoan Kiem)", lat: 21.03, lon: 105.85, note: "El corazón de la capital vietnamita" },
      { name: "Ciudad Ho Chi Minh", lat: 10.78, lon: 106.70, note: "La metrópolis más dinámica de Vietnam" },
    ],
  },
  {
    id: "costa-rica", name: "Costa Rica", country: "Costa Rica", flag: "🇨🇷",
    costPerPerson: 1600, durationDays: 10, type: "naturaleza",
    description: "La 'Pura Vida': volcán Arenal en erupción, jungla amazónica, tortugas marinas, playas del Pacífico y biodiversidad que concentra el 5% mundial.",
    highlights: ["Volcán Arenal", "Tortugas marinas", "Monteverde", "Playas del Pacífico"],
    itinerary: [
      { date: "", title: "Días 1-2 — San José y Volcán Poás", items: [{ time: "12:00", text: "Llegada a San José" }, { time: "Día 2", text: "Volcán Poás: la caldera más grande de Costa Rica" }, { time: "14:00", text: "Sarchi: artesanías costarricenses" }] },
      { date: "", title: "Días 3-4 — Arenal", items: [{ time: "09:00", text: "Conducción a La Fortuna (3h)" }, { time: "14:00", text: "Volcán Arenal: la silueta perfecta" }, { time: "16:00", text: "Aguas termales naturales al pie del volcán" }, { time: "Día 4", text: "Kayak en el lago Arenal y tirolina en la selva" }] },
      { date: "", title: "Días 5-6 — Monteverde", items: [{ time: "09:00", text: "Monteverde: la reserva de bosque nuboso" }, { time: "14:00", text: "Tirolina Extrema (300 m de largo)" }, { time: "Noche", text: "Tour nocturno de animales" }, { time: "Día 6", text: "Puentes colgantes entre los árboles" }] },
      { date: "", title: "Días 7-10 — Tortuguero y Playa", items: [{ time: "09:00", text: "Tortuguero: tortugas verdes poniendo huevos (junio-oct)" }, { time: "Día 8", text: "Canales en barca: monos, caimanes y tucanes" }, { time: "Días 9-10", text: "Manuel Antonio: playa + parque nacional" }] },
    ],
    mapPlaces: [
      { name: "Volcán Arenal", lat: 10.46, lon: -84.70, note: "Uno de los volcanes más activos del mundo" },
      { name: "Monteverde", lat: 10.30, lon: -84.82, note: "Reserva de bosque nuboso con tirolina extrema" },
      { name: "Tortuguero", lat: 10.54, lon: -83.50, note: "Santuario de tortugas marinas" },
      { name: "Manuel Antonio", lat: 9.39, lon: -84.14, note: "Parque nacional con playa y monos" },
    ],
  },
  {
    id: "colombia", name: "Colombia", country: "Colombia", flag: "🇨🇴",
    costPerPerson: 1300, durationDays: 10, type: "cultura",
    description: "El país de la eterna primavera: Cartagena de Indias colonial y caribeña, Medellín la ciudad más innovadora de Latinoamérica, café del Eje Cafetero y la laguna de Guatavita.",
    highlights: ["Cartagena de Indias", "Medellín", "Eje Cafetero", "Ciudad Perdida"],
    itinerary: [
      { date: "", title: "Días 1-3 — Cartagena", items: [{ time: "12:00", text: "Llegada a Cartagena. Primera cumbia al bajar del avión" }, { time: "16:00", text: "Ciudad Amurallada: plaza de los Coches y calles de colores" }, { time: "Día 2", text: "Islas del Rosario: snorkel en el Caribe" }, { time: "Día 3", text: "Castillo de San Felipe de Barajas" }] },
      { date: "", title: "Días 4-5 — Medellín", items: [{ time: "10:00", text: "Vuelo a Medellín" }, { time: "14:00", text: "Metrocable y comunas — transformación urbana" }, { time: "Día 5", text: "Pueblito Paisa y El Poblado (gastronomía y fiesta)" }] },
      { date: "", title: "Días 6-7 — Eje Cafetero", items: [{ time: "09:00", text: "Salento: el pueblo más colorido de Colombia" }, { time: "12:00", text: "Valle del Cocora: palmas de cera (150 m)" }, { time: "16:00", text: "Finca cafetera: proceso del café" }] },
      { date: "", title: "Días 8-10 — Bogotá", items: [{ time: "10:00", text: "La Candelaria: barrio colonial y grafiti tours" }, { time: "14:00", text: "Museo del Oro: 55.000 piezas precolombinas" }, { time: "Día 9", text: "Catedral de Sal de Zipaquirá" }, { time: "Día 10", text: "Vuelo de regreso" }] },
    ],
    mapPlaces: [
      { name: "Cartagena de Indias", lat: 10.39, lon: -75.49, note: "Ciudad colonial Patrimonio UNESCO" },
      { name: "Medellín", lat: 6.24, lon: -75.57, note: "Ciudad más innovadora del mundo (2013)" },
      { name: "Salento (Eje Cafetero)", lat: 4.64, lon: -75.57, note: "Corazón del café colombiano" },
      { name: "Bogotá", lat: 4.71, lon: -74.07, note: "Capital a 2.600 m de altitud" },
    ],
  },
  {
    id: "peru", name: "Perú & Machu Picchu", country: "Perú", flag: "🇵🇪",
    costPerPerson: 1700, durationDays: 10, type: "cultura",
    description: "La ciudadela inca sobre las nubes, el Camino del Inca, el Lago Titicaca, Lima gastronómica y las líneas de Nazca.",
    highlights: ["Machu Picchu", "Camino del Inca", "Lago Titicaca", "Lima"],
    itinerary: [
      { date: "", title: "Días 1-2 — Lima", items: [{ time: "12:00", text: "Llegada a Lima. Barrio de Miraflores" }, { time: "16:00", text: "Larco Mar: vista al Pacífico" }, { time: "Noche", text: "Cena: el mejor ceviche del mundo" }, { time: "Día 2", text: "Huaca Pucllana: pirámide en medio de Lima" }] },
      { date: "", title: "Días 3-4 — Cusco", items: [{ time: "08:00", text: "Vuelo a Cusco (1h15). Aclimatación (3.399m)" }, { time: "15:00", text: "Plaza de Armas y Catedral del Cusco" }, { time: "Día 4", text: "Sacsayhuamán y el Valle Sagrado" }] },
      { date: "", title: "Días 5-6 — Machu Picchu", items: [{ time: "06:00", text: "Tren a Aguas Calientes (Vistadome panorámico)" }, { time: "09:00", text: "Bus a Machu Picchu: la primera vez que lo ves sin palabras" }, { time: "12:00", text: "Subida a la Puerta del Sol (Inti Punku)" }, { time: "Día 6", text: "Machu Picchu: tour guiado y montaña Huayna Picchu" }] },
      { date: "", title: "Días 7-10 — Lago Titicaca", items: [{ time: "08:00", text: "Bus a Puno (6h por el altiplano)" }, { time: "15:00", text: "Lago Titicaca: el lago navegable más alto del mundo (3.812m)" }, { time: "Día 8", text: "Islas flotantes de los Uros" }, { time: "Día 9", text: "Isla Taquile: noche con familia quechua" }, { time: "Día 10", text: "Vuelo Lima-España" }] },
    ],
    mapPlaces: [
      { name: "Machu Picchu", lat: -13.16, lon: -72.54, note: "La ciudadela inca — 7ª Maravilla del Mundo" },
      { name: "Cusco", lat: -13.53, lon: -71.97, note: "Capital del Imperio Inca a 3.399 m" },
      { name: "Lago Titicaca", lat: -15.84, lon: -69.33, note: "El lago navegable más alto del mundo" },
      { name: "Lima", lat: -12.05, lon: -77.05, note: "Capital gastronómica de Latinoamérica" },
    ],
  },
  {
    id: "sri-lanka", name: "Sri Lanka", country: "Sri Lanka", flag: "🇱🇰",
    costPerPerson: 1850, durationDays: 10, type: "cultura",
    description: "La perla del Índico: templos budistas de Kandy, la roca fortaleza de Sigiriya, té de Nuwara Eliya, elefantes salvajes y playas doradas del sur.",
    highlights: ["Sigiriya", "Kandy (Templo del Diente)", "Safaris elefantes", "Playas del sur"],
    itinerary: [
      { date: "", title: "Días 1-2 — Colombo y Costa Oeste", items: [{ time: "12:00", text: "Llegada a Colombo" }, { time: "15:00", text: "Mercado Pettah y Fort histórico" }, { time: "Día 2", text: "Negombo: primera playa y mar cálido" }] },
      { date: "", title: "Días 3-4 — Sigiriya y Dambulla", items: [{ time: "07:00", text: "Roca de Sigiriya: 1.200 escalones hasta la cima (s. V)" }, { time: "12:00", text: "Cuevas de Dambulla: Buda gigante dorado" }, { time: "Día 4", text: "Safari en Minneriya: 300 elefantes en la laguna" }] },
      { date: "", title: "Días 5-6 — Kandy", items: [{ time: "09:00", text: "Kandy: templo del Diente de Buda (la reliquia más sagrada)" }, { time: "14:00", text: "Jardín Botánico Real de Peradeniya" }, { time: "Noche", text: "Danza tradicional kandyana" }, { time: "Día 6", text: "Plantaciones de té: Nuwara Eliya (2.000 m)" }] },
      { date: "", title: "Días 7-10 — Sur y playas", items: [{ time: "09:00", text: "Galle: fuerte colonial holandés" }, { time: "Días 8-9", text: "Playas Mirissa y Unawatuna: surf y tortugas" }, { time: "Tarde", text: "Avistamiento de ballenas azules (enero-abril)" }, { time: "Día 10", text: "Vuelo de regreso desde Colombo" }] },
    ],
    mapPlaces: [
      { name: "Sigiriya", lat: 7.95, lon: 80.76, note: "Fortaleza-palacio del s. V sobre roca volcánica" },
      { name: "Kandy", lat: 7.29, lon: 80.63, note: "Ciudad sagrada con el Templo del Diente de Buda" },
      { name: "Galle", lat: 6.03, lon: 80.22, note: "Fuerte colonial holandés Patrimonio UNESCO" },
      { name: "Minneriya", lat: 8.03, lon: 80.90, note: "Parque nacional: el mayor agrupamiento de elefantes" },
    ],
  },
  {
    id: "nepal", name: "Nepal & Himalaya", country: "Nepal", flag: "🇳🇵",
    costPerPerson: 1950, durationDays: 12, type: "aventura",
    description: "El techo del mundo: Katmandú con sus estupas y templos, el trek al Campamento Base del Everest o el circuito de Annapurna, y el lago Pokhara.",
    highlights: ["Everest Base Camp trek", "Katmandú", "Pokhara", "Annapurna"],
    itinerary: [
      { date: "", title: "Días 1-2 — Katmandú", items: [{ time: "12:00", text: "Llegada a Tribhuvan. Altitud: 1.400m" }, { time: "15:00", text: "Estupa de Boudhanath (la mayor del mundo)" }, { time: "Día 2", text: "Pashupatinath: cremaciones sagradas junto al río" }, { time: "14:00", text: "Patan: Ciudad medieval preservada" }] },
      { date: "", title: "Días 3-4 — Pokhara", items: [{ time: "08:30", text: "Vuelo a Pokhara (25 min)" }, { time: "11:00", text: "Lake Phewa: kayak con reflejo de Machhapuchhre" }, { time: "Día 4 4:00", text: "Amanecer en Sarangkot: panorámica Annapurna" }] },
      { date: "", title: "Días 5-10 — Trek Annapurna o EBC", items: [{ time: "08:00", text: "Trek Annapurna Circuit o Poon Hill (3.210m)" }, { time: "Días 5-9", text: "Sendero por aldeas sherpa, puentes de cuerda y glaciares" }, { time: "Noche", text: "Teahouses: dal bhat y té chai" }, { time: "Día 10", text: "Vuelta a Pokhara" }] },
      { date: "", title: "Días 11-12 — Regreso", items: [{ time: "09:00", text: "Vuelo a Katmandú" }, { time: "12:00", text: "Mercado de Thamel: souvenirs y thangkas" }, { time: "Noche", text: "Última cena de momo (dumplings nepaleses)" }, { time: "Día 12", text: "Vuelo de regreso" }] },
    ],
    mapPlaces: [
      { name: "Katmandú", lat: 27.71, lon: 85.32, note: "Capital a 1.400m con templos medievales" },
      { name: "Pokhara", lat: 28.21, lon: 83.99, note: "Puerta de entrada al Himalaya" },
      { name: "Everest Base Camp", lat: 28.00, lon: 86.86, note: "A 5.364m — el trek más famoso del mundo" },
      { name: "Poon Hill", lat: 28.40, lon: 83.69, note: "Panorámica de 8 cimas de más de 8.000m" },
    ],
  },
  {
    id: "sudafrica", name: "Sudáfrica & Cape Town", country: "Sudáfrica", flag: "🇿🇦",
    costPerPerson: 2200, durationDays: 11, type: "naturaleza",
    description: "Mesa Mountain sobre el Atlántico, los pingüinos de Boulders Beach, la Garden Route, la Ruta de los Vinos y el safari en Kruger.",
    highlights: ["Table Mountain", "Safari Kruger", "Garden Route", "Boulders Beach"],
    itinerary: [
      { date: "", title: "Días 1-3 — Ciudad del Cabo", items: [{ time: "12:00", text: "Llegada a Cape Town International" }, { time: "16:00", text: "Table Mountain en teleférico al atardecer" }, { time: "Día 2", text: "Cape Point: el punto más austral del continente" }, { time: "14:00", text: "Boulders Beach: pingüinos africanos libres" }, { time: "Día 3", text: "Barrio de Bo-Kaap: casas de colores" }] },
      { date: "", title: "Días 4-5 — Ruta de los Vinos", items: [{ time: "09:00", text: "Stellenbosch: bodegas de merlot" }, { time: "12:00", text: "Franschhoek: Village de origen hugonote" }, { time: "Tarde", text: "Catas y vino de world-class" }] },
      { date: "", title: "Días 6-8 — Garden Route", items: [{ time: "09:00", text: "Conducción hacia el este por la costa" }, { time: "12:00", text: "Hermanus: avistamiento de ballenas (julio-nov)" }, { time: "Día 7", text: "Tsitsikamma: zip-line sobre el bosque" }, { time: "Día 8", text: "Addo: elefantes a 3m sin barreras" }] },
      { date: "", title: "Días 9-11 — Safari Kruger", items: [{ time: "08:00", text: "Vuelo a Johannesburgo (2h)" }, { time: "14:00", text: "Entrada al Parque Kruger: los Big 5" }, { time: "Días 10-11", text: "Safaris al amanecer y al atardecer" }, { time: "Tarde 11", text: "Vuelo de regreso" }] },
    ],
    mapPlaces: [
      { name: "Table Mountain", lat: -33.96, lon: 18.41, note: "El icono de Ciudad del Cabo" },
      { name: "Cape Point", lat: -34.36, lon: 18.50, note: "Donde el Atlántico encuentra el Índico" },
      { name: "Parque Kruger", lat: -23.99, lon: 31.55, note: "El mejor safari de África con los Big 5" },
      { name: "Hermanus", lat: -34.42, lon: 19.24, note: "Mejor avistamiento terrestre de ballenas" },
    ],
  },
  {
    id: "tanzania", name: "Tanzania & Safari", country: "Tanzania", flag: "🇹🇿",
    costPerPerson: 3200, durationDays: 10, type: "naturaleza",
    description: "La Gran Migración del Serengueti, el Ngorongoro (el mayor cráter del mundo habitado), el Kilimanjaro y las playas blancas de Zanzíbar.",
    highlights: ["Gran Migración", "Ngorongoro", "Kilimanjaro", "Zanzíbar"],
    itinerary: [
      { date: "", title: "Días 1-2 — Arusha", items: [{ time: "12:00", text: "Llegada a Kilimanjaro International" }, { time: "16:00", text: "Arusha: base de los safaris del norte" }, { time: "Día 2", text: "Parque Nacional Arusha: primera noche de safari" }] },
      { date: "", title: "Días 3-4 — Serengueti", items: [{ time: "06:00", text: "Conducción al Serengueti (5h)" }, { time: "12:00", text: "Primera drive: leones, jirafas, leopardos" }, { time: "Noche", text: "Campamento de lujo bajo las estrellas" }, { time: "Día 4", text: "Gran Migración: millón de ñus cruzando el Mara" }] },
      { date: "", title: "Días 5-6 — Ngorongoro", items: [{ time: "07:00", text: "Descenso al cráter del Ngorongoro (2.200 km²)" }, { time: "09:00", text: "Rinocerontes negros (en peligro de extinción)" }, { time: "12:00", text: "Leones, elefantes, hipopótamos en el lago Magadi" }, { time: "Día 6", text: "Garganta de Olduvai: origen del Homo sapiens" }] },
      { date: "", title: "Días 7-10 — Zanzíbar", items: [{ time: "10:00", text: "Vuelo a Zanzíbar (1h)" }, { time: "14:00", text: "Stone Town: labyrinto árabe y mercado de especias" }, { time: "Días 8-9", text: "Playas de Nungwi y Kendwa: turquesa perfecto" }, { time: "Día 10", text: "Vuelo de regreso" }] },
    ],
    mapPlaces: [
      { name: "Serengueti", lat: -2.33, lon: 34.83, note: "La Gran Migración: 1,5 millones de ñus" },
      { name: "Ngorongoro", lat: -3.19, lon: 35.59, note: "El mayor cráter habitado de la Tierra" },
      { name: "Zanzíbar (Stone Town)", lat: -6.16, lon: 39.19, note: "Laberinto árabe Patrimonio UNESCO" },
      { name: "Monte Kilimanjaro", lat: -3.07, lon: 37.35, note: "La cima de África (5.895m)" },
    ],
  },
  {
    id: "seychelles", name: "Seychelles", country: "Seychelles", flag: "🇸🇨",
    costPerPerson: 3500, durationDays: 8, type: "playa",
    description: "El destino de lujo más exclusivo del mundo: rocas de granito rosa, palmeras cocos de mer, tortugas gigantes y playas que no parecen reales.",
    highlights: ["Anse Source d'Argent", "Vallee de Mai (coco de mer)", "Tortugas gigantes", "Praslin"],
    itinerary: [
      { date: "", title: "Días 1-2 — Mahé", items: [{ time: "12:00", text: "Llegada a Seychelles International (Mahé)" }, { time: "16:00", text: "Beau Vallon: primera puesta de sol tropical" }, { time: "Día 2", text: "Morne Seychellois: naturaleza prístina" }, { time: "Tarde", text: "Victoria Market: vanilla, canela y coco" }] },
      { date: "", title: "Días 3-4 — Praslin", items: [{ time: "09:00", text: "Ferry a Praslin (1h)" }, { time: "11:00", text: "Vallee de Mai: el jardín del Edén (UNESCO)" }, { time: "13:00", text: "Coco de mer: la semilla más grande del mundo (25 kg)" }, { time: "Tarde", text: "Anse Lazio: posiblemente la playa más bonita del mundo" }] },
      { date: "", title: "Días 5-6 — La Digue", items: [{ time: "09:00", text: "Ferry a La Digue (15 min)" }, { time: "10:00", text: "Anse Source d'Argent: rocas de granito y agua turquesa" }, { time: "14:00", text: "Bicicleta por la isla (solo 10 km²)" }, { time: "16:00", text: "Tortugas gigantes de Aldabra (150 años)" }] },
      { date: "", title: "Días 7-8 — Snorkel y regreso", items: [{ time: "09:00", text: "Snorkel en arrecife de coral con tortugas marinas" }, { time: "Tarde", text: "Regreso a Mahé" }, { time: "Día 8", text: "Vuelo de regreso" }] },
    ],
    mapPlaces: [
      { name: "Anse Source d'Argent (La Digue)", lat: -4.37, lon: 55.84, note: "La playa más fotografiada del mundo" },
      { name: "Vallee de Mai (Praslin)", lat: -4.33, lon: 55.73, note: "Jardín del Edén UNESCO — coco de mer" },
      { name: "Anse Lazio (Praslin)", lat: -4.29, lon: 55.70, note: "Reconocida como la mejor playa del mundo" },
      { name: "Mahé (capital Victoria)", lat: -4.62, lon: 55.45, note: "La isla principal de las Seychelles" },
    ],
  },
  {
    id: "jordania", name: "Jordania & Petra", country: "Jordania", flag: "🇯🇴",
    costPerPerson: 1400, durationDays: 8, type: "cultura",
    description: "Petra excavada en roca rosa, Wadi Rum el desierto de Marte, el Mar Muerto a -430m y la Ciudad Romana de Jerash — el Indiana Jones de los viajes.",
    highlights: ["Petra", "Wadi Rum", "Mar Muerto", "Jerash"],
    itinerary: [
      { date: "", title: "Días 1-2 — Ammán", items: [{ time: "12:00", text: "Llegada a Queen Alia International" }, { time: "15:00", text: "Ciudadela de Ammán y Teatro Romano" }, { time: "Día 2", text: "Jerash: la Roma de Oriente Medio (2.000 años)" }] },
      { date: "", title: "Días 3-4 — Petra", items: [{ time: "07:00", text: "El Siq: 1,2 km de cañón hacia el Tesoro" }, { time: "09:00", text: "Al-Khazneh: el Tesoro de Petra (Indiana Jones)" }, { time: "12:00", text: "Monasterio: 850 escalones, la vista de la vida" }, { time: "Día 4", text: "Petra by Night: 1.800 velas en el desierto" }] },
      { date: "", title: "Días 5-6 — Wadi Rum", items: [{ time: "09:00", text: "Jeep 4x4 por el desierto marciano" }, { time: "12:00", text: "Puente natural de roca" }, { time: "17:00", text: "Atardecer sobre las dunas de arena roja" }, { time: "Noche", text: "Dormir en tienda beduina bajo las estrellas" }] },
      { date: "", title: "Días 7-8 — Mar Muerto", items: [{ time: "09:00", text: "Conducción al Mar Muerto (-430m)" }, { time: "12:00", text: "Flotar sin esfuerzo, untarse de lodo negro" }, { time: "Tarde", text: "Monte Nebo: donde Moisés vio la Tierra Prometida" }, { time: "Día 8", text: "Vuelo de regreso" }] },
    ],
    mapPlaces: [
      { name: "Petra (Al-Khazneh)", lat: 30.33, lon: 35.44, note: "Ciudad Nabatea excavada en roca rosa (s. VI a.C.)" },
      { name: "Wadi Rum", lat: 29.57, lon: 35.42, note: "El desierto más espectacular de Oriente Medio" },
      { name: "Mar Muerto", lat: 31.48, lon: 35.49, note: "El punto más bajo de la Tierra (-430m)" },
      { name: "Jerash", lat: 32.28, lon: 35.90, note: "La ciudad romana mejor conservada fuera de Italia" },
    ],
  },
  {
    id: "hawaii", name: "Hawaii", country: "Estados Unidos", flag: "🇺🇸",
    costPerPerson: 3400, durationDays: 10, type: "naturaleza",
    description: "El paraíso del Pacífico: volcanes activos en la Big Island, olas legendarias de la North Shore, Napali Coast en Kauai y la magia de Maui.",
    highlights: ["Volcán Kilauea", "North Shore (surf)", "Napali Coast (Kauai)", "Camino de Hana"],
    itinerary: [
      { date: "", title: "Días 1-3 — Oahu", items: [{ time: "12:00", text: "Llegada a Honolulu" }, { time: "16:00", text: "Waikiki: primera ola con tabla de surf" }, { time: "Día 2", text: "Pearl Harbor: memoriales de la WWII" }, { time: "14:00", text: "Diamond Head: senderismo con vistas al Pacífico" }, { time: "Día 3", text: "North Shore: ver surfistas en Banzai Pipeline" }] },
      { date: "", title: "Días 4-5 — Maui", items: [{ time: "09:00", text: "Vuelo a Maui (30 min)" }, { time: "12:00", text: "Camino de Hana (64 km de curvas en la selva)" }, { time: "Día 5 04:00", text: "Haleakalā: amanecer desde el cráter del volcán" }] },
      { date: "", title: "Días 6-8 — Big Island", items: [{ time: "10:00", text: "Vuelo a Big Island" }, { time: "14:00", text: "Hawaii Volcanoes NP: lava fluyendo al mar" }, { time: "Día 7", text: "Mauna Kea al atardecer (4.205m)" }, { time: "Noche", text: "Cielo nocturno más claro del mundo (observatorio)" }, { time: "Día 8", text: "Playa negra de Punaluu y tortugas verdes" }] },
      { date: "", title: "Días 9-10 — Kauai", items: [{ time: "10:00", text: "Vuelo a Kauai" }, { time: "14:00", text: "Napali Coast en barco: acantilados de 1.200m" }, { time: "Día 10", text: "Waimea Canyon: el Gran Cañón del Pacífico" }] },
    ],
    mapPlaces: [
      { name: "Waikiki (Oahu)", lat: 21.28, lon: -157.83, note: "La playa más famosa de Hawaii" },
      { name: "Hawaii Volcanoes NP (Big Island)", lat: 19.43, lon: -155.26, note: "Kilauea: el volcán más activo del mundo" },
      { name: "Napali Coast (Kauai)", lat: 22.19, lon: -159.63, note: "Acantilados de 1.200m sobre el Pacífico" },
      { name: "Haleakalā (Maui)", lat: 20.71, lon: -156.25, note: "Cráter volcánico a 3.055m — amanecer mágico" },
    ],
  },
  {
    id: "argentina", name: "Argentina & Patagonia", country: "Argentina", flag: "🇦🇷",
    costPerPerson: 2500, durationDays: 12, type: "naturaleza",
    description: "Buenos Aires tanguera y apasionada, las Cataratas del Iguazú (las más impresionantes del mundo), la Patagonia con glaciares y el Perito Moreno.",
    highlights: ["Cataratas del Iguazú", "Perito Moreno", "Buenos Aires", "Bariloche"],
    itinerary: [
      { date: "", title: "Días 1-3 — Buenos Aires", items: [{ time: "12:00", text: "Llegada a Ezeiza" }, { time: "16:00", text: "La Boca: barrio obrero con casas de chapa de colores" }, { time: "Noche", text: "Tango en La Catedral o Café de los Angelitos" }, { time: "Día 2", text: "Palermo, San Telmo y el Cementerio de la Recoleta" }, { time: "Día 3", text: "Asado argentino: el ritual más sagrado" }] },
      { date: "", title: "Días 4-5 — Cataratas del Iguazú", items: [{ time: "08:00", text: "Vuelo a Puerto Iguazú" }, { time: "12:00", text: "Cataratas del Iguazú lado argentino" }, { time: "Día 5", text: "Cataratas lado brasileño: vista panorámica total" }] },
      { date: "", title: "Días 6-8 — Patagonia: El Calafate", items: [{ time: "10:00", text: "Vuelo a El Calafate (3h)" }, { time: "14:00", text: "Perito Moreno: glaciar azul que avanza 2m/día" }, { time: "Día 7", text: "Trekking en el glaciar: crampones sobre el hielo" }, { time: "Día 8", text: "Torres del Paine (Chile): W Trek primer día" }] },
      { date: "", title: "Días 9-12 — El Chaltén y vuelta", items: [{ time: "09:00", text: "El Chaltén: trekking al Monte Fitz Roy" }, { time: "Día 10", text: "Laguna de los Tres: el objetivo más espectacular" }, { time: "Días 11-12", text: "Regreso a Buenos Aires y vuelo" }] },
    ],
    mapPlaces: [
      { name: "Cataratas del Iguazú", lat: -25.69, lon: -54.44, note: "Las cataratas más impresionantes del mundo" },
      { name: "Glaciar Perito Moreno", lat: -50.49, lon: -73.06, note: "El glaciar que avanza 2m al día" },
      { name: "Buenos Aires", lat: -34.61, lon: -58.38, note: "Capital apasionada del tango y la carne" },
      { name: "Monte Fitz Roy", lat: -49.27, lon: -73.05, note: "El pico más fotogénico de la Patagonia" },
    ],
  },
  // ── Populares ──
  {
    id: "dubai", name: "Dubai", country: "Emiratos Árabes", flag: "🇦🇪",
    costPerPerson: 1600, durationDays: 6, type: "ciudad",
    description: "El futuro en el desierto: el Burj Khalifa (el edificio más alto del mundo), playas artificiales, zocos de oro y oro, safaris en dunas y lujo sin límites.",
    highlights: ["Burj Khalifa", "Palm Jumeirah", "Desierto en 4x4", "Zoco del Oro"],
    itinerary: [
      { date: "", title: "Día 1 — Llegada y Downtown", items: [{ time: "12:00", text: "Llegada a Dubai International (DXB)" }, { time: "17:00", text: "Burj Khalifa: subida al piso 124 al atardecer" }, { time: "19:00", text: "Dubai Fountain Show junto al lago" }, { time: "21:00", text: "Cena en Dubai Mall" }] },
      { date: "", title: "Día 2 — Old Dubai", items: [{ time: "09:00", text: "Abra (barca de madera) al Zoco del Oro" }, { time: "11:00", text: "Zoco de las Especias: azafrán y oud" }, { time: "14:00", text: "Al Fahidi: barrio histórico con bastakiya" }, { time: "20:00", text: "Brunch del viernes en hotel 5 estrellas" }] },
      { date: "", title: "Día 3 — Safari en el desierto", items: [{ time: "15:00", text: "Recogida en 4x4 Land Cruiser" }, { time: "17:00", text: "Dune bashing en las dunas rojas" }, { time: "18:30", text: "Atardecer en las dunas + foto de camello" }, { time: "20:00", text: "Cena beduina bajo las estrellas (barbacoa + danza)" }] },
      { date: "", title: "Días 4-5 — Playa y Marina", items: [{ time: "10:00", text: "JBR Beach: playa artificial con skyline" }, { time: "13:00", text: "Palm Jumeirah: monorraíl hasta Atlantis" }, { time: "16:00", text: "Dubai Marina: yates y rascacielos" }, { time: "Día 5", text: "Global Village: 90 países en un parque" }] },
      { date: "", title: "Día 6 — Regreso", items: [{ time: "09:00", text: "Souq Madinat Jumeirah" }, { time: "14:00", text: "Vuelo de regreso" }] },
    ],
    mapPlaces: [
      { name: "Burj Khalifa", lat: 25.20, lon: 55.27, note: "828m — el edificio más alto del mundo" },
      { name: "Palm Jumeirah", lat: 25.11, lon: 55.14, note: "Isla artificial en forma de palmera" },
      { name: "Zoco del Oro", lat: 25.27, lon: 55.30, note: "El mayor mercado de oro del mundo" },
      { name: "Dunas de Hatta", lat: 24.80, lon: 56.12, note: "El desierto rojo a 1h de Dubai" },
    ],
  },
  {
    id: "singapur", name: "Singapur", country: "Singapur", flag: "🇸🇬",
    costPerPerson: 1900, durationDays: 6, type: "ciudad",
    description: "La ciudad-estado más futurista del mundo: Gardens by the Bay con sus supertrees, Chinatown, Little India, la calle Hawker y el mejor street food de Asia.",
    highlights: ["Gardens by the Bay", "Marina Bay Sands", "Hawker centres", "Sentosa"],
    itinerary: [
      { date: "", title: "Día 1 — Marina Bay", items: [{ time: "11:00", text: "Llegada a Changi Airport (el mejor del mundo)" }, { time: "16:00", text: "Marina Bay Sands: piscina en el piso 57" }, { time: "20:00", text: "Gardens by the Bay: Light Show de los supertrees" }] },
      { date: "", title: "Día 2 — Barrios étnicos", items: [{ time: "09:00", text: "Chinatown: templo Sri Mariamman y mercado" }, { time: "12:00", text: "Hawker Centre Maxwell: char kway teow y laksa" }, { time: "15:00", text: "Little India: templo Sri Veeramakaliamman" }, { time: "18:00", text: "Arab Street y Kampong Glam" }] },
      { date: "", title: "Día 3 — Naturaleza urbana", items: [{ time: "09:00", text: "Singapore Botanic Gardens (UNESCO)" }, { time: "13:00", text: "Orchard Road: el shopping más lujoso de Asia" }, { time: "16:00", text: "Jewel Changi: la cascada interior más alta del mundo" }] },
      { date: "", title: "Días 4-5 — Sentosa y Universal", items: [{ time: "10:00", text: "Universal Studios Singapore" }, { time: "15:00", text: "Playa de Sentosa" }, { time: "Día 5", text: "Zoo de Singapur: el mejor del mundo (estilo libre)" }] },
      { date: "", title: "Día 6 — Regreso", items: [{ time: "10:00", text: "Chill final en Gardens by the Bay" }, { time: "14:00", text: "Vuelo de regreso" }] },
    ],
    mapPlaces: [
      { name: "Marina Bay Sands", lat: 1.28, lon: 103.86, note: "Hotel con piscina infinita en el piso 57" },
      { name: "Gardens by the Bay", lat: 1.28, lon: 103.86, note: "Supertrees y el Grove con clima artificial" },
      { name: "Hawker Centre Lau Pa Sat", lat: 1.28, lon: 103.85, note: "Comer street food de lujo a precio de kiosco" },
      { name: "Sentosa", lat: 1.25, lon: 103.83, note: "Isla de ocio con playas y Universal Studios" },
    ],
  },
  {
    id: "turquia", name: "Turquía: Estambul & Capadocia", country: "Turquía", flag: "🇹🇷",
    costPerPerson: 980, durationDays: 9, type: "cultura",
    description: "Dos mundos en uno: Estambul donde Europa se funde con Asia, el bazar de las especias, Santa Sofía — y Capadocia con globos aerostáticos sobre chimeneas de hadas.",
    highlights: ["Santa Sofía", "Gran Bazar", "Globos en Capadocia", "Pamukkale"],
    itinerary: [
      { date: "", title: "Días 1-3 — Estambul", items: [{ time: "11:00", text: "Llegada a Istanbul Airport" }, { time: "15:00", text: "Santa Sofía: 1.500 años de historia en una cúpula" }, { time: "17:00", text: "Mezquita Azul y Hipódromo" }, { time: "Día 2", text: "Gran Bazar: 4.000 tiendas" }, { time: "14:00", text: "Bazar de las Especias y crucero por el Bósforo" }, { time: "Día 3", text: "Palacio de Topkapi y el barrio de Balat" }] },
      { date: "", title: "Día 4 — Pamukkale", items: [{ time: "07:00", text: "Vuelo o bus nocturno a Pamukkale" }, { time: "11:00", text: "Terrazas de travertino blanco: bañarse en las cascadas" }, { time: "15:00", text: "Hierápolis: ciudad romana con necrópolis" }] },
      { date: "", title: "Días 5-7 — Capadocia", items: [{ time: "05:00", text: "¡Globo aerostático al amanecer sobre el valle!" }, { time: "09:00", text: "Valle de Göreme: chimeneas de hadas" }, { time: "13:00", text: "Museo al aire libre de Göreme (iglesias rupestres)" }, { time: "Día 6", text: "Ciudad subterránea de Derinkuyu (8 pisos bajo tierra)" }, { time: "Día 7", text: "Ihlara Valley: senderismo junto al río" }] },
      { date: "", title: "Días 8-9 — Costa Egea", items: [{ time: "09:00", text: "Éfeso: la ciudad romana más grande de Asia Menor" }, { time: "Día 9", text: "Vuelo de regreso desde Estambul" }] },
    ],
    mapPlaces: [
      { name: "Santa Sofía (Estambul)", lat: 41.01, lon: 28.98, note: "Basílica bizantina convertida en mezquita" },
      { name: "Göreme (Capadocia)", lat: 38.64, lon: 34.83, note: "Centro de los globos aerostáticos" },
      { name: "Pamukkale", lat: 37.92, lon: 29.12, note: "Terrazas blancas de travertino Patrimonio UNESCO" },
      { name: "Éfeso", lat: 37.94, lon: 27.34, note: "La ciudad romana mejor conservada de Asia" },
    ],
  },
  {
    id: "santorini", name: "Santorini", country: "Grecia", flag: "🇬🇷",
    costPerPerson: 1100, durationDays: 6, type: "playa",
    description: "La postal más icónica del Mediterráneo: cúpulas azules de Oia, atardeceres que paran el corazón, vino Assyrtiko volcánico y aguas turquesas de la caldera.",
    highlights: ["Atardecer de Oia", "Caldera", "Playa de Perissa", "Vino volcánico"],
    itinerary: [
      { date: "", title: "Días 1-2 — Fira y la Caldera", items: [{ time: "12:00", text: "Llegada a Santorini (JTR) o ferry desde Atenas" }, { time: "15:00", text: "Fira: paseo por el borde del cráter" }, { time: "18:00", text: "Primera cata de vino Assyrtiko volcánico" }, { time: "Día 2", text: "Crucero por la caldera: aguas termales y volcán activo" }] },
      { date: "", title: "Días 3-4 — Oia", items: [{ time: "10:00", text: "Senderismo Fira-Oia: 10 km por el borde del cráter" }, { time: "14:00", text: "Pueblo de Oia: calles blancas y cúpulas azules" }, { time: "19:30", text: "El atardecer más famoso del mundo (llegar 1h antes)" }, { time: "Día 4", text: "Akrotiri: Pompeya griega enterrada bajo ceniza" }] },
      { date: "", title: "Días 5-6 — Playas", items: [{ time: "10:00", text: "Playa Roja (Red Beach): arena volcánica rojiza" }, { time: "13:00", text: "Playa de Perissa: arena negra y aguas cristalinas" }, { time: "16:00", text: "Playa de Kamari: chiringuitos con mojito" }, { time: "Día 6", text: "Ferry a Atenas o vuelo de vuelta" }] },
    ],
    mapPlaces: [
      { name: "Oia", lat: 36.46, lon: 25.37, note: "El atardecer más fotografiado del mundo" },
      { name: "Fira", lat: 36.43, lon: 25.43, note: "Capital de Santorini sobre el borde del cráter" },
      { name: "Akrotiri", lat: 36.36, lon: 25.40, note: "La Pompeya griega bajo la ceniza volcánica" },
      { name: "Red Beach", lat: 36.35, lon: 25.39, note: "Playa de arena volcánica roja única en Europa" },
    ],
  },
  {
    id: "praga", name: "Praga", country: "República Checa", flag: "🇨🇿",
    costPerPerson: 580, durationDays: 4, type: "ciudad",
    description: "La ciudad de las cien torres: el casco medieval mejor conservado de Europa, el Puente de Carlos, el barrio judío y la cerveza más barata y buena del mundo.",
    highlights: ["Puente de Carlos", "Castillo de Praga", "Barrio Judío", "Cerveza Pilsner"],
    itinerary: [
      { date: "", title: "Día 1 — Malá Strana y el Castillo", items: [{ time: "10:00", text: "Castillo de Praga: la fortaleza más grande del mundo" }, { time: "13:00", text: "Catedral de San Vito en la cima" }, { time: "16:00", text: "Bajada por las callejuelas de Malá Strana" }, { time: "19:00", text: "Svíčková (ternera con nata) en taberna checa" }] },
      { date: "", title: "Día 2 — Staré Město", items: [{ time: "09:00", text: "Puente de Carlos al amanecer (sin turistas)" }, { time: "11:00", text: "Reloj Astronómico en la Plaza del Ayuntamiento" }, { time: "13:00", text: "Barrio Judío (Josefov): 6 sinagogas" }, { time: "20:00", text: "Pub en el casco histórico: Pilsner Urquell a 1,5€" }] },
      { date: "", title: "Días 3-4 — Vinohrady y Holešovice", items: [{ time: "10:00", text: "DOX Centre: arte contemporáneo" }, { time: "13:00", text: "Mercado de Holešovice" }, { time: "16:00", text: "Barrio de Vinohrady: cafés bohemios" }, { time: "Día 4", text: "Kutná Hora: iglesia de huesos (1h desde Praga)" }] },
    ],
    mapPlaces: [
      { name: "Castillo de Praga", lat: 50.09, lon: 14.40, note: "El complejo de castillo más grande del mundo" },
      { name: "Puente de Carlos", lat: 50.09, lon: 14.41, note: "Puente gótico del s. XIV con 30 estatuas" },
      { name: "Plaza del Ayuntamiento", lat: 50.09, lon: 14.42, note: "Reloj Astronómico medieval del s. XV" },
      { name: "Kutná Hora", lat: 49.95, lon: 15.27, note: "Iglesia de huesos con 40.000 esqueletos decorativos" },
    ],
  },
  {
    id: "roma", name: "Roma", country: "Italia", flag: "🇮🇹",
    costPerPerson: 870, durationDays: 5, type: "cultura",
    description: "La Ciudad Eterna: el Coliseo donde rugían los leones, el Vaticano con la Capilla Sixtina, la Fontana di Trevi, el Panteón y la mejor pasta del mundo.",
    highlights: ["Coliseo", "Vaticano & Capilla Sixtina", "Fontana di Trevi", "Panteón"],
    itinerary: [
      { date: "", title: "Día 1 — Roma Antigua", items: [{ time: "09:00", text: "Coliseo: el anfiteatro más grande jamás construido" }, { time: "12:00", text: "Foro Romano y Palatino" }, { time: "15:00", text: "Circo Máximo" }, { time: "20:00", text: "Cena de cacio e pepe en Trastevere" }] },
      { date: "", title: "Día 2 — Vaticano", items: [{ time: "09:00", text: "Museos Vaticanos (reserva obligatoria)" }, { time: "12:00", text: "Capilla Sixtina: el techo de Miguel Ángel" }, { time: "14:00", text: "Basílica de San Pedro y la cúpula" }, { time: "18:00", text: "Castillo de Sant'Angelo al atardecer" }] },
      { date: "", title: "Día 3 — Barroco romano", items: [{ time: "09:00", text: "Panteón: 2.000 años perfectamente conservado" }, { time: "11:00", text: "Fontana di Trevi (llegar temprano)" }, { time: "13:00", text: "Piazza di Spagna y la escalinata" }, { time: "16:00", text: "Piazza Navona con Bernini" }] },
      { date: "", title: "Días 4-5 — Barrios y excursión", items: [{ time: "10:00", text: "Trastevere: el barrio más auténtico de Roma" }, { time: "13:00", text: "Testaccio: mercado y historia obrera" }, { time: "Día 5", text: "Tívoli: Villa Adriana y Villa d'Este (1h desde Roma)" }] },
    ],
    mapPlaces: [
      { name: "Coliseo", lat: 41.89, lon: 12.49, note: "El anfiteatro romano — s. I d.C." },
      { name: "Vaticano (Capilla Sixtina)", lat: 41.90, lon: 12.45, note: "La Creación de Adán pintada por Miguel Ángel" },
      { name: "Fontana di Trevi", lat: 41.90, lon: 12.48, note: "La fuente barroca más grande del mundo" },
      { name: "Panteón", lat: 41.90, lon: 12.48, note: "El edificio mejor conservado de la Roma antigua" },
    ],
  },
  {
    id: "tenerife", name: "Tenerife", country: "España", flag: "🇪🇸",
    costPerPerson: 450, durationDays: 6, type: "naturaleza",
    description: "La isla grande de Canarias: el Teide (el volcán más alto de España), Masca entre barrancos, playas de Playa de las Américas y el bosque de laurisilva.",
    highlights: ["Teide", "Masca", "Anaga", "Playa de las Américas"],
    itinerary: [
      { date: "", title: "Día 1 — Sur y llegada", items: [{ time: "11:00", text: "Llegada a Tenerife Sur (TFS)" }, { time: "15:00", text: "Playa de las Américas: primer baño atlántico" }, { time: "19:00", text: "Los Cristianos: cerveza y puesta de sol" }] },
      { date: "", title: "Día 2 — Teide", items: [{ time: "08:00", text: "Conducción al Parque Nacional del Teide" }, { time: "11:00", text: "Teleférico al pico (3.555m)" }, { time: "14:00", text: "Parador del Teide: morcilla canaria y papas arrugadas" }, { time: "21:00", text: "Observación de estrellas: los mejores cielos de Europa" }] },
      { date: "", title: "Día 3 — Masca y Buenavista", items: [{ time: "09:00", text: "Pueblo de Masca: el más pintoresco de Canarias" }, { time: "12:00", text: "Barranco de Masca: senderismo hasta el mar (3h)" }, { time: "16:00", text: "Regreso en barco a Los Gigantes" }] },
      { date: "", title: "Días 4-6 — Norte y Anaga", items: [{ time: "09:00", text: "Bosque de laurisilva del Anaga (UNESCO)" }, { time: "13:00", text: "San Cristóbal de La Laguna: ciudad colonial" }, { time: "Día 5", text: "Playa del Duque y Costa Adeje" }, { time: "Día 6", text: "Vuelo de regreso" }] },
    ],
    mapPlaces: [
      { name: "Teide", lat: 28.27, lon: -16.64, note: "El volcán más alto de España (3.718m)" },
      { name: "Masca", lat: 28.34, lon: -16.85, note: "El pueblo más inaccesible y bonito de Tenerife" },
      { name: "Anaga", lat: 28.57, lon: -16.17, note: "Bosque de laurisilva Patrimonio UNESCO" },
      { name: "Playa de Las Américas", lat: 28.05, lon: -16.72, note: "La Costa del Sol canaria" },
    ],
  },
  // ── Europa menos conocida ──
  {
    id: "islas-feroe", name: "Islas Feroe", country: "Islas Feroe (Dinamarca)", flag: "🇫🇴",
    costPerPerson: 1400, durationDays: 6, type: "naturaleza",
    description: "El secreto mejor guardado de Europa: acantilados de 400m sobre el Atlántico Norte, pueblos de tejado de hierba, cascadas que caen al mar y ovejas por todas partes.",
    highlights: ["Múlafossur", "Lago Sørvágsvatn", "Gasadalur", "Saksun"],
    itinerary: [
      { date: "", title: "Días 1-2 — Tórshavn y alrededores", items: [{ time: "12:00", text: "Llegada a Vágar Airport" }, { time: "15:00", text: "Tórshavn: la capital más pequeña y más encantadora de Europa" }, { time: "Día 2", text: "Kirkjubøur: las ruinas de catedral más antiguas del norte" }] },
      { date: "", title: "Días 3-4 — Vágar", items: [{ time: "09:00", text: "Lago Sørvágsvatn: la ilusión óptica del lago que flota sobre el océano" }, { time: "13:00", text: "Gasadalur: cascada Múlafossur cayendo al Atlántico" }, { time: "Día 4", text: "Saksun: laguna cerrada y casas de turba" }] },
      { date: "", title: "Días 5-6 — Eysturoy y norte", items: [{ time: "09:00", text: "Gjógv: el pueblo al borde del barranco" }, { time: "12:00", text: "Eiðisvatn: el lago entre dos mares" }, { time: "15:00", text: "Viðareiði: el pueblo más al norte" }, { time: "Día 6", text: "Vuelo de regreso" }] },
    ],
    mapPlaces: [
      { name: "Múlafossur (Gasadalur)", lat: 62.10, lon: -7.37, note: "Cascada cayendo al Atlántico — la foto más viral de Feroe" },
      { name: "Lago Sørvágsvatn", lat: 62.07, lon: -7.28, note: "El lago que parece flotar sobre el océano" },
      { name: "Tórshavn", lat: 62.01, lon: -6.77, note: "La capital vikinga más pequeña del mundo" },
      { name: "Saksun", lat: 62.22, lon: -7.16, note: "Pueblo con iglesia de turba y laguna cerrada" },
    ],
  },
  {
    id: "albania", name: "Albania", country: "Albania", flag: "🇦🇱",
    costPerPerson: 490, durationDays: 7, type: "playa",
    description: "El secreto más barato del Mediterráneo: costa albanesa con aguas rivalizando con Grecia, Berat la ciudad de las mil ventanas, Gjirokastër medieval — y todo por la mitad de precio.",
    highlights: ["Riviera albanesa", "Berat", "Gjirokastër", "Lago Ohrid"],
    itinerary: [
      { date: "", title: "Días 1-2 — Tirana", items: [{ time: "12:00", text: "Llegada a Rinas. Skanderbeg Square" }, { time: "15:00", text: "Bunkart 2: búnker convertido en museo de la dictadura" }, { time: "Día 2", text: "Barrio de Blloku: antes prohibido, ahora los mejores cafés" }] },
      { date: "", title: "Días 3-4 — Berat y Gjirokastër", items: [{ time: "09:00", text: "Berat: la ciudad de las mil ventanas (UNESCO)" }, { time: "13:00", text: "Castillo de Berat con vistas" }, { time: "Día 4", text: "Gjirokastër: ciudad otomana Patrimonio UNESCO" }] },
      { date: "", title: "Días 5-7 — Riviera", items: [{ time: "10:00", text: "Ksamil: 4 islas y aguas turquesas (mejor que Grecia, mitad de precio)" }, { time: "13:00", text: "Butrint: ciudad griega-romana-bizantina (UNESCO)" }, { time: "Día 6", text: "Dhermi: la mejor playa de la riviera" }, { time: "Día 7", text: "Vuelo de regreso desde Tirana" }] },
    ],
    mapPlaces: [
      { name: "Berat", lat: 40.71, lon: 19.95, note: "Ciudad Patrimonio UNESCO — mil ventanas otomanas" },
      { name: "Ksamil", lat: 39.77, lon: 20.01, note: "Aguas turquesas que rivalizan con el Caribe" },
      { name: "Gjirokastër", lat: 40.08, lon: 20.14, note: "Ciudad otomana entera Patrimonio UNESCO" },
      { name: "Butrint", lat: 39.75, lon: 20.02, note: "Ruinas griegas, romanas y bizantinas" },
    ],
  },
  {
    id: "georgia", name: "Georgia (el país)", country: "Georgia", flag: "🇬🇪",
    costPerPerson: 720, durationDays: 8, type: "aventura",
    description: "La cuna del vino (8.000 años de viticultura), la Kazbegi con el monte Kazbeji entre nubes, Tbilisi bohemia y llena de arte, y los monasterios de roca del s. VI.",
    highlights: ["Kazbegi", "Tbilisi", "Bodega en qvevri", "Vardzia rupestre"],
    itinerary: [
      { date: "", title: "Días 1-2 — Tbilisi", items: [{ time: "12:00", text: "Llegada a Tbilisi Internacional" }, { time: "15:00", text: "Ciudad vieja: balcones de madera tallada" }, { time: "18:00", text: "Baños de azufre del barrio Abanotubani" }, { time: "Día 2", text: "Casco histórico y mercado de Narikala" }, { time: "Noche", text: "Vino naranja georgiano (Rkatsiteli en qvevri)" }] },
      { date: "", title: "Días 3-4 — Kazbegi", items: [{ time: "09:00", text: "Autopista Militar Georgiana: vistas del Cáucaso" }, { time: "13:00", text: "Kazbegi: el pueblo entre glaciares" }, { time: "15:00", text: "Subida a la iglesia de Gergeti (2.170m)" }, { time: "Día 4", text: "Senderismo al glaciar del Kazbeji" }] },
      { date: "", title: "Días 5-6 — Kakheti (vino)", items: [{ time: "09:00", text: "Región vinícola de Kakheti" }, { time: "12:00", text: "Sighnaghi: el pueblo del amor (bodas 24h)" }, { time: "15:00", text: "Bodega Twins: vino en qvevri enterrada" }, { time: "Día 6", text: "Monasterio de Alaverdi (s. XI)" }] },
      { date: "", title: "Días 7-8 — Vardzia", items: [{ time: "09:00", text: "Vardzia: ciudad rupestre del s. XII (3.000 habitaciones)" }, { time: "14:00", text: "Frontera con Armenia: Bavra" }, { time: "Día 8", text: "Regreso a Tbilisi y vuelo" }] },
    ],
    mapPlaces: [
      { name: "Tbilisi (ciudad vieja)", lat: 41.69, lon: 44.80, note: "Balcones tallados sobre el río Mtkvari" },
      { name: "Kazbegi (iglesia Gergeti)", lat: 42.66, lon: 44.65, note: "Iglesia sobre la nube con el Kazbeji detrás" },
      { name: "Sighnaghi", lat: 41.61, lon: 45.92, note: "El pueblo del amor en la región del vino" },
      { name: "Vardzia", lat: 41.38, lon: 43.28, note: "Ciudad monástica excavada en la roca (s. XII)" },
    ],
  },
  {
    id: "eslovenia", name: "Eslovenia", country: "Eslovenia", flag: "🇸🇮",
    costPerPerson: 650, durationDays: 5, type: "naturaleza",
    description: "El país más verde de Europa: el lago Bled con el castillo en el acantilado, las grutas de Postojna con dragones de cueva, Triglav nevado y Liubliana encantadora.",
    highlights: ["Lago Bled", "Grutas Postojna", "Liubliana", "Triglav"],
    itinerary: [
      { date: "", title: "Días 1-2 — Liubliana", items: [{ time: "11:00", text: "Llegada a Brnik o Trieste" }, { time: "14:00", text: "Liubliana: la capital peatonal más bonita de Europa" }, { time: "16:00", text: "Castillo de Liubliana con teleférico" }, { time: "Noche", text: "Cankarjeva nabrezje: terrazas junto al río" }] },
      { date: "", title: "Días 3-4 — Bled y Triglav", items: [{ time: "09:00", text: "Lago Bled: la postal más perfecta de Europa" }, { time: "11:00", text: "Pletna (barca tradicional) a la isla con campana de los deseos" }, { time: "14:00", text: "Castillo de Bled sobre el acantilado" }, { time: "Día 4", text: "Vintgar: gorge de 1,6 km entre paredes de roca" }] },
      { date: "", title: "Día 5 — Postojna y Predjama", items: [{ time: "09:00", text: "Grutas de Postojna: 24 km de estalactitas" }, { time: "12:00", text: "Proteus: el dragón de cueva (anfibio único)" }, { time: "14:00", text: "Castillo de Predjama: castillo empotrado en la roca" }, { time: "17:00", text: "Vuelo de regreso" }] },
    ],
    mapPlaces: [
      { name: "Lago Bled", lat: 46.36, lon: 14.09, note: "La postal perfecta: lago, isla, castillo y montaña" },
      { name: "Liubliana", lat: 46.05, lon: 14.51, note: "La capital más verde y peatonal de Europa" },
      { name: "Grutas de Postojna", lat: 45.78, lon: 14.20, note: "24 km de estalactitas — las mayores de Europa" },
      { name: "Castillo de Predjama", lat: 45.82, lon: 14.13, note: "Castillo medieval dentro de una cueva" },
    ],
  },
  {
    id: "bosnia", name: "Bosnia: Sarajevo & Mostar", country: "Bosnia-Herzegovina", flag: "🇧🇦",
    costPerPerson: 430, durationDays: 5, type: "cultura",
    description: "Donde Oriente se funde con Occidente: Sarajevo la ciudad del Puente entre religiones, el puente Stari Most de Mostar que data del s. XVI y la historia del siglo XX más impactante.",
    highlights: ["Stari Most (Mostar)", "Sarajevo", "Blagaj", "Kravice"],
    itinerary: [
      { date: "", title: "Días 1-2 — Sarajevo", items: [{ time: "11:00", text: "Llegada a Sarajevo" }, { time: "14:00", text: "Baščaršija: el gran bazar otomano" }, { time: "16:00", text: "Túnel de la Esperanza: el túnel del asedio (1992-95)" }, { time: "Día 2", text: "Esquina del Atentado: donde empezó la WWI" }, { time: "14:00", text: "Mezquita de Gazi Husrev-beg (s. XVI)" }] },
      { date: "", title: "Días 3-4 — Mostar", items: [{ time: "09:00", text: "Bus a Mostar (3h)" }, { time: "13:00", text: "Stari Most: el puente que cayó en 1993 y fue reconstruido" }, { time: "16:00", text: "Ver a los buzos saltar desde 21m al río Neretva" }, { time: "Día 4", text: "Blagaj: tekke (monasterio derviche) junto al manantial" }] },
      { date: "", title: "Día 5 — Cataratas Kravice", items: [{ time: "10:00", text: "Kravice: mini cataratas del Niágara en versión bosnia" }, { time: "14:00", text: "Počitelj: pueblo medieval otomano" }, { time: "17:00", text: "Regreso y vuelo" }] },
    ],
    mapPlaces: [
      { name: "Stari Most (Mostar)", lat: 43.34, lon: 17.82, note: "Puente del s. XVI reconstruido tras la guerra" },
      { name: "Sarajevo (Baščaršija)", lat: 43.86, lon: 18.43, note: "El gran bazar otomano del s. XV" },
      { name: "Blagaj", lat: 43.26, lon: 17.90, note: "Monasterio derviche junto a manantial kárstico" },
      { name: "Cataratas de Kravice", lat: 43.16, lon: 17.62, note: "Cascadas del Niágara en miniatura bosníaca" },
    ],
  },
  {
    id: "tallinn", name: "Tallin & Estonia", country: "Estonia", flag: "🇪🇪",
    costPerPerson: 560, durationDays: 4, type: "cultura",
    description: "El casco medieval mejor conservado del Báltico, el país más digital del mundo (e-residency, votación online), la bahía de Tallin y la isla de Saaremaa.",
    highlights: ["Old Town medieval", "Toompea Hill", "Kadriorg", "Isla Saaremaa"],
    itinerary: [
      { date: "", title: "Días 1-2 — Tallin Old Town", items: [{ time: "11:00", text: "Llegada a Lennart Meri Airport" }, { time: "14:00", text: "Toompea Hill: panorámica de la ciudad" }, { time: "16:00", text: "Raekoja Plats: la plaza medieval más bonita del Báltico" }, { time: "Noche", text: "Cerveza negra estonia en taberna medieval" }, { time: "Día 2", text: "Torres de la muralla del s. XIV: subida y vistas" }] },
      { date: "", title: "Día 3 — Kadriorg y playa", items: [{ time: "10:00", text: "Palacio de Kadriorg (regalo de Pedro el Grande)" }, { time: "13:00", text: "Kumu: el mejor museo de arte de los países bálticos" }, { time: "15:00", text: "Pirita Beach: playa báltica" }, { time: "19:00", text: "Barrio de Kalamaja: hipster y cafés de especialidad" }] },
      { date: "", title: "Día 4 — Regreso", items: [{ time: "09:00", text: "Mercado de Balti Jaam" }, { time: "12:00", text: "Último kohuke (snack de queso típico estonio)" }, { time: "14:00", text: "Vuelo de vuelta" }] },
    ],
    mapPlaces: [
      { name: "Toompea Hill (Tallin)", lat: 59.44, lon: 24.74, note: "Colina del castillo con el mejor mirador" },
      { name: "Raekoja Plats", lat: 59.44, lon: 24.75, note: "La plaza medieval más preservada del Báltico" },
      { name: "Kadriorg", lat: 59.44, lon: 24.79, note: "Palacio barroco regalado por el Zar" },
      { name: "Kalamaja", lat: 59.45, lon: 24.73, note: "Barrio bohemio con casas de madera del s. XIX" },
    ],
  },
  {
    id: "montenegro", name: "Montenegro", country: "Montenegro", flag: "🇲🇪",
    costPerPerson: 550, durationDays: 6, type: "playa",
    description: "El mini-país que lo tiene todo: la bahía de Kotor (el más impresionante fiord mediterráneo), Budva con sus playas, el lago Škoder y el Parque Nacional de Durmitor.",
    highlights: ["Bahía de Kotor", "Budva", "Durmitor", "Lago Škoder"],
    itinerary: [
      { date: "", title: "Días 1-2 — Kotor", items: [{ time: "11:00", text: "Llegada a Tivat o Dubrovnik (1h en bus)" }, { time: "14:00", text: "Casco medieval de Kotor (UNESCO)" }, { time: "16:00", text: "Subida a las murallas: 1.350 escalones y vistas" }, { time: "Día 2", text: "Bahía de Kotor en barco: la bahía más bonita del Mediterráneo" }] },
      { date: "", title: "Días 3-4 — Budva y Sveti Stefan", items: [{ time: "10:00", text: "Budva: la Mónaco balcánica" }, { time: "13:00", text: "Sveti Stefan: hotel-isla medieval (foto desde la colina)" }, { time: "Día 4", text: "Playas de Jaz y Mogren" }] },
      { date: "", title: "Días 5-6 — Durmitor", items: [{ time: "09:00", text: "Parque Nacional de Durmitor: trekking de altura" }, { time: "14:00", text: "Cañón del Tara: el cañón más profundo de Europa (1.300m)" }, { time: "Día 6", text: "Rafting en el río Tara" }] },
    ],
    mapPlaces: [
      { name: "Bahía de Kotor", lat: 42.43, lon: 18.77, note: "El fiordo mediterráneo más espectacular" },
      { name: "Sveti Stefan", lat: 42.26, lon: 18.89, note: "Hotel-isla medieval — la foto más icónica de Montenegro" },
      { name: "Cañón del Tara", lat: 43.15, lon: 19.32, note: "El cañón más profundo de Europa" },
      { name: "Durmitor", lat: 43.15, lon: 19.01, note: "Parque Nacional con picos de más de 2.500m" },
    ],
  },
  // ── Asia y Oriente Medio menos explorados ──
  {
    id: "uzbekistan", name: "Uzbekistán: Ruta de la Seda", country: "Uzbekistán", flag: "🇺🇿",
    costPerPerson: 980, durationDays: 9, type: "cultura",
    description: "Las ciudades más antiguas del mundo: Samarcanda con sus cúpulas azules de Tamerlán, Bujará con 140 monumentos medievales y Jiva la ciudad museo intacta.",
    highlights: ["Registán (Samarcanda)", "Bujará", "Jiva", "Camello en el desierto"],
    itinerary: [
      { date: "", title: "Días 1-2 — Taskent", items: [{ time: "12:00", text: "Llegada a Tashkent" }, { time: "15:00", text: "Metro de Tashkent: las estaciones más bonitas del mundo" }, { time: "Día 2", text: "Chorsu Bazaar: el bazar más grande de Asia Central" }] },
      { date: "", title: "Días 3-4 — Samarcanda", items: [{ time: "08:00", text: "Tren de alta velocidad a Samarcanda (2h)" }, { time: "11:00", text: "Registán: tres medersas del s. XV — sin palabras" }, { time: "15:00", text: "Shah-i-Zinda: callejón de mausoleos de cerámica azul" }, { time: "Día 4", text: "Tumba de Tamerlán (Gur-e-Amir)" }] },
      { date: "", title: "Días 5-6 — Bujará", items: [{ time: "09:00", text: "Tren a Bujará" }, { time: "12:00", text: "Poi Kalón: el minarete medieval que ni Gengis Kan destruyó" }, { time: "15:00", text: "Ark: la fortaleza de 2.500 años" }, { time: "Día 6", text: "Bujará Old Town de noche: la más medieval del mundo" }] },
      { date: "", title: "Días 7-9 — Jiva", items: [{ time: "09:00", text: "Vuelo a Urgench + bus a Jiva" }, { time: "13:00", text: "Itchan Kala: el centro histórico más intacto de Asia (UNESCO)" }, { time: "Día 8", text: "Desierto de Kizilkum: noche en yurta y amanecer" }, { time: "Día 9", text: "Vuelo de regreso desde Taskent" }] },
    ],
    mapPlaces: [
      { name: "Registán (Samarcanda)", lat: 39.65, lon: 66.97, note: "El complejo de medersas más impresionante de Asia" },
      { name: "Bujará Old Town", lat: 39.77, lon: 64.42, note: "La ciudad medieval más intacta de Asia Central" },
      { name: "Jiva (Itchan Kala)", lat: 41.38, lon: 60.36, note: "Ciudad museo Patrimonio UNESCO" },
      { name: "Taskent (metro)", lat: 41.30, lon: 69.24, note: "El metro con las estaciones más bellas del mundo" },
    ],
  },
  {
    id: "cambodia", name: "Camboya & Angkor Wat", country: "Camboya", flag: "🇰🇭",
    costPerPerson: 1050, durationDays: 8, type: "cultura",
    description: "El templo más grande del mundo: Angkor Wat al amanecer cuando la silueta emerge de la niebla, Ta Prohm con raíces gigantes, Phnom Penh y las playas del sur.",
    highlights: ["Angkor Wat al amanecer", "Ta Prohm (Tomb Raider)", "Phnom Penh", "Koh Rong"],
    itinerary: [
      { date: "", title: "Días 1-2 — Phnom Penh", items: [{ time: "12:00", text: "Llegada a Phnom Penh" }, { time: "15:00", text: "Palacio Real y la Pagoda de Plata" }, { time: "Día 2", text: "Tuol Sleng: prisión S-21 — historia del Khmer Rouge" }, { time: "14:00", text: "Campos de Exterminio de Choeung Ek (obligatorio)" }] },
      { date: "", title: "Días 3-5 — Siem Reap y Angkor", items: [{ time: "04:30", text: "Angkor Wat al amanecer: el momento más mágico del viaje" }, { time: "09:00", text: "Angkor Thom: la ciudad de un millón de habitantes" }, { time: "12:00", text: "Bayon: 216 caras sonrientes de piedra" }, { time: "Día 4", text: "Ta Prohm: el templo de Tomb Raider con raíces enormes" }, { time: "Día 5", text: "Templos periféricos en bici" }] },
      { date: "", title: "Días 6-8 — Playas", items: [{ time: "08:00", text: "Vuelo a Sihanoukville" }, { time: "11:00", text: "Ferry a Koh Rong: la isla más virgen de Camboya" }, { time: "Días 7-8", text: "Playa y bioluminiscencia nocturna" }] },
    ],
    mapPlaces: [
      { name: "Angkor Wat", lat: 13.41, lon: 103.87, note: "El templo más grande jamás construido (s. XII)" },
      { name: "Ta Prohm", lat: 13.43, lon: 103.89, note: "Templo devorado por raíces de la selva" },
      { name: "Phnom Penh", lat: 11.56, lon: 104.93, note: "Capital con historia del Khmer Rouge" },
      { name: "Koh Rong", lat: 10.62, lon: 103.24, note: "Isla virgen con bioluminiscencia nocturna" },
    ],
  },
  {
    id: "indonesia-bali", name: "Indonesia: Bali & Komodo", country: "Indonesia", flag: "🇮🇩",
    costPerPerson: 1550, durationDays: 11, type: "naturaleza",
    description: "La isla de los dioses: arrozales escalonados de Tegalalang, templos sobre el agua, surf en Uluwatu y los dragones de Komodo — los lagartos más grandes del mundo.",
    highlights: ["Arrozales Tegalalang", "Templo Tanah Lot", "Dragones de Komodo", "Ubud"],
    itinerary: [
      { date: "", title: "Días 1-3 — Ubud", items: [{ time: "12:00", text: "Llegada a Ngurah Rai (Denpasar)" }, { time: "16:00", text: "Ubud: el corazón cultural de Bali" }, { time: "Día 2", text: "Arrozales de Tegalalang: los más fotogénicos del mundo" }, { time: "14:00", text: "Bosque de monos de Ubud (cuidado con el móvil)" }, { time: "Día 3", text: "Templo Tirta Empul: baño de purificación" }] },
      { date: "", title: "Días 4-5 — Sur de Bali", items: [{ time: "09:00", text: "Tanah Lot: el templo sobre la roca en el mar al atardecer" }, { time: "14:00", text: "Uluwatu: templo en el acantilado + surf" }, { time: "19:00", text: "Kecak Fire Dance en el templo de Uluwatu" }, { time: "Día 5", text: "Seminyak y Canggu: cafés, surf y fiesta" }] },
      { date: "", title: "Días 6-8 — Volcán Batur", items: [{ time: "03:00", text: "Subida nocturna al Gunung Batur (1.717m)" }, { time: "06:00", text: "Amanecer sobre el volcán y el lago" }, { time: "Día 7", text: "Munduk: cascadas en la selva norte" }, { time: "Día 8", text: "Lovina Beach: avistamiento de delfines" }] },
      { date: "", title: "Días 9-11 — Komodo", items: [{ time: "09:00", text: "Vuelo a Labuan Bajo (1h)" }, { time: "13:00", text: "Isla de Komodo: dragones de Komodo en libertad" }, { time: "Día 10", text: "Pink Beach: playa de arena rosa" }, { time: "Día 11", text: "Vuelo de regreso" }] },
    ],
    mapPlaces: [
      { name: "Ubud (Tegalalang)", lat: -8.43, lon: 115.28, note: "Arrozales escalonados Patrimonio UNESCO" },
      { name: "Tanah Lot", lat: -8.62, lon: 115.09, note: "Templo sobre roca en el mar al atardecer" },
      { name: "Isla de Komodo", lat: -8.55, lon: 119.49, note: "Los dragones más grandes del mundo" },
      { name: "Uluwatu", lat: -8.83, lon: 115.09, note: "Templo en el acantilado con surf world-class" },
    ],
  },
  {
    id: "filipinas", name: "Filipinas: Palawan", country: "Filipinas", flag: "🇵🇭",
    costPerPerson: 1400, durationDays: 10, type: "playa",
    description: "La mejor isla del mundo según Condé Nast: El Nido con sus lagunas turquesas entre karst, Coron con naufragios de la WWII para bucear, y el río subterráneo más largo del mundo.",
    highlights: ["El Nido", "Coron (buceo en naufragios)", "Puerto Princesa", "Bacuit Bay"],
    itinerary: [
      { date: "", title: "Días 1-2 — Manila", items: [{ time: "12:00", text: "Llegada a NAIA" }, { time: "15:00", text: "Intramuros: ciudad amurallada española" }, { time: "Día 2", text: "Vuelo a Puerto Princesa" }] },
      { date: "", title: "Días 3-4 — Puerto Princesa", items: [{ time: "09:00", text: "Río subterráneo: 8,2 km navegables en la oscuridad" }, { time: "14:00", text: "Manglares de Honda Bay" }, { time: "Día 4", text: "Snorkel en Dos Palmas" }] },
      { date: "", title: "Días 5-7 — El Nido", items: [{ time: "08:00", text: "Vuelo a El Nido" }, { time: "10:00", text: "Tour A: Big Lagoon, Small Lagoon, Secret Lagoon" }, { time: "Día 6", text: "Tour C: Shimizu, Matinloc Shrine, Hidden Beach" }, { time: "Día 7", text: "Kayak individual entre los karst" }] },
      { date: "", title: "Días 8-10 — Coron", items: [{ time: "09:00", text: "Ferry o vuelo a Coron" }, { time: "11:00", text: "Buceo en los naufragios japoneses de la WWII" }, { time: "Día 9", text: "Lago Kayangan: el lago más limpio de Asia" }, { time: "Día 10", text: "Vuelo de regreso a Manila" }] },
    ],
    mapPlaces: [
      { name: "El Nido (Bacuit Bay)", lat: 11.19, lon: 119.39, note: "La mejor bahía del mundo — lagunitas turquesas" },
      { name: "Puerto Princesa (río subterráneo)", lat: 9.74, lon: 118.74, note: "8km de río navegable en cueva (UNESCO)" },
      { name: "Coron", lat: 11.99, lon: 120.20, note: "Naufragios de la WWII para bucear" },
      { name: "Lago Kayangan", lat: 11.97, lon: 120.14, note: "El lago más limpio de Asia" },
    ],
  },
  {
    id: "laos", name: "Laos", country: "Laos", flag: "🇱🇦",
    costPerPerson: 890, durationDays: 9, type: "naturaleza",
    description: "El país más tranquilo del Sudeste Asiático: Luang Prabang Patrimonio UNESCO con monjes al amanecer, las cascadas de Kuang Si de color turquesa y el Mekong.",
    highlights: ["Luang Prabang", "Cascadas Kuang Si", "Monjes al amanecer", "Vang Vieng"],
    itinerary: [
      { date: "", title: "Días 1-2 — Vientián", items: [{ time: "12:00", text: "Llegada a Wattay International" }, { time: "15:00", text: "Pha That Luang: el stupa nacional de Laos" }, { time: "Día 2", text: "Buda Park: jardín con 200 esculturas religiosas" }] },
      { date: "", title: "Días 3-4 — Vang Vieng", items: [{ time: "08:00", text: "Bus a Vang Vieng (4h por la selva)" }, { time: "13:00", text: "Kayak y tubing en el río Nam Song" }, { time: "Día 4", text: "Cueva de Tham Chang y laguna azul" }] },
      { date: "", title: "Días 5-7 — Luang Prabang", items: [{ time: "05:30", text: "Tak Bat: procesión de 200 monjes al amanecer" }, { time: "09:00", text: "Mercado de artesanía nocturno" }, { time: "Día 6", text: "Cascadas Kuang Si: turquesa imposible (bañarse permitido)" }, { time: "Día 7", text: "Templo Wat Xieng Thong: el más bello de Laos" }] },
      { date: "", title: "Días 8-9 — Río Mekong", items: [{ time: "09:00", text: "Crucero lento por el Mekong 2 días hasta Tailandia" }, { time: "Todo el día", text: "Pueblos remotos, paisajes de selva y karma infinito" }] },
    ],
    mapPlaces: [
      { name: "Luang Prabang", lat: 19.89, lon: 102.14, note: "Ciudad Patrimonio UNESCO junto al Mekong" },
      { name: "Cascadas de Kuang Si", lat: 19.71, lon: 101.99, note: "Cascadas de agua turquesa para bañarse" },
      { name: "Vang Vieng", lat: 18.92, lon: 102.45, note: "Valle kárstico con ríos y grutas" },
      { name: "Vientián (Pha That Luang)", lat: 17.97, lon: 102.61, note: "El símbolo nacional de Laos" },
    ],
  },
  // ── África ──
  {
    id: "marruecos-norte", name: "Marruecos: Fez & Sahara", country: "Marruecos", flag: "🇲🇦",
    costPerPerson: 850, durationDays: 9, type: "cultura",
    description: "Más allá de Marrakech: Fez la medina más grande del mundo medieval, el desierto del Sahara con noches de millones de estrellas, Chefchaouen la ciudad azul y las gargantas del Todra.",
    highlights: ["Fez Medina", "Desierto Merzouga", "Chefchaouen azul", "Gargantas Todra"],
    itinerary: [
      { date: "", title: "Días 1-2 — Chefchaouen", items: [{ time: "12:00", text: "Llegada a Tánger o vuelo a Fez" }, { time: "15:00", text: "Chefchaouen: cada calle pintada de azul índigo" }, { time: "Día 2", text: "Senderismo al mirador sobre el pueblo" }] },
      { date: "", title: "Días 3-4 — Fez", items: [{ time: "09:00", text: "Fez el-Bali: la medina medieval más grande del mundo" }, { time: "12:00", text: "Tenerías de cuero: vista desde las terrazas de las tiendas" }, { time: "15:00", text: "Medersa Bou Inania: el arte islámico más perfecto" }, { time: "Día 4", text: "Barrio judío (Mellah) y palacio Real" }] },
      { date: "", title: "Días 5-6 — Desierto Merzouga", items: [{ time: "08:00", text: "Conducción por el Alto Atlas (cordillera)" }, { time: "16:00", text: "Dunas de Erg Chebbi: subir la duna más alta (150m)" }, { time: "18:30", text: "Atardecer sahariense — silencio absoluto" }, { time: "Noche", text: "Campamento beduino, té y cielo estrellado" }] },
      { date: "", title: "Días 7-9 — Gorges y regreso", items: [{ time: "08:00", text: "Gargantas del Todra: paredes de 300m en 10m de anchura" }, { time: "13:00", text: "Valle del Dadès: kasbahs en el desierto" }, { time: "Día 8", text: "Ouarzazate: la Hollywood del desierto" }, { time: "Día 9", text: "Vuelo de regreso desde Marrakech" }] },
    ],
    mapPlaces: [
      { name: "Chefchaouen", lat: 35.17, lon: -5.27, note: "La ciudad pintada de azul del Rif" },
      { name: "Fez el-Bali", lat: 34.06, lon: -5.00, note: "La medina medieval más grande del mundo" },
      { name: "Dunas de Erg Chebbi (Merzouga)", lat: 31.10, lon: -3.97, note: "Las dunas más altas del Sahara marroquí (150m)" },
      { name: "Gargantas del Todra", lat: 31.59, lon: -5.59, note: "Paredes de 300m separadas por 10m" },
    ],
  },
  {
    id: "etiopia", name: "Etiopía", country: "Etiopía", flag: "🇪🇹",
    costPerPerson: 1600, durationDays: 11, type: "cultura",
    description: "El origen de la humanidad: Lucy y los australopitecos en el museo, las iglesias rupestres de Lalibela (el octavo milagro del mundo), el Valle del Rift y la tribu Mursi.",
    highlights: ["Iglesias de Lalibela", "Valle del Rift", "Tribu Mursi", "Danakil (el infierno)"],
    itinerary: [
      { date: "", title: "Días 1-2 — Addis Abeba", items: [{ time: "12:00", text: "Llegada a Bole International" }, { time: "15:00", text: "Museo Nacional: cráneo de Lucy (3,2 millones de años)" }, { time: "Día 2", text: "Mercado Mercato: el mayor mercado al aire libre de África" }] },
      { date: "", title: "Días 3-5 — Lalibela", items: [{ time: "08:00", text: "Vuelo a Lalibela" }, { time: "10:00", text: "Iglesias rupestres del s. XII: excavadas en la roca sólida" }, { time: "13:00", text: "Bet Giyorgis: la más perfecta, en forma de cruz desde arriba" }, { time: "Día 4", text: "Iglesias del grupo norte: túneles y liturgias en geez" }, { time: "Día 5", text: "Pueblo de Lalibela: el Jerusalén africano" }] },
      { date: "", title: "Días 6-7 — Omo Valley (tribus)", items: [{ time: "08:00", text: "Vuelo a Jinka" }, { time: "12:00", text: "Tribu Mursi: las mujeres con platos en los labios" }, { time: "Día 7", text: "Tribu Hamar: danza de la lluvia" }] },
      { date: "", title: "Días 8-11 — Depresión de Danakil", items: [{ time: "08:00", text: "La región más caliente y baja de la Tierra (-116m)" }, { time: "14:00", text: "Lago Dallol: géiseres de ácido sulfúrico multicolor" }, { time: "Noche", text: "Campamento a 50°C" }, { time: "Días 10-11", text: "Erta Ale: el lago de lava más antiguo del mundo" }] },
    ],
    mapPlaces: [
      { name: "Lalibela", lat: 12.03, lon: 39.05, note: "Iglesias rupestres del s. XII — el octavo milagro" },
      { name: "Depresión de Danakil", lat: 14.24, lon: 40.30, note: "La región más caliente de la Tierra (-116m)" },
      { name: "Addis Abeba (Museo Lucy)", lat: 9.00, lon: 38.75, note: "El cráneo de Lucy: nuestro ancestro de 3,2M de años" },
      { name: "Erta Ale", lat: 13.60, lon: 40.67, note: "El lago de lava más antiguo del mundo" },
    ],
  },
  {
    id: "namibia", name: "Namibia", country: "Namibia", flag: "🇳🇦",
    costPerPerson: 2400, durationDays: 11, type: "naturaleza",
    description: "El país más despoblado de África: las dunas rojas de Sossusvlei (las más altas del mundo), los elefantes de Etosha, Swakopmund alemana en el desierto y esqueletos de ballenas.",
    highlights: ["Dunes Sossusvlei", "Deadvlei", "Etosha", "Skeleton Coast"],
    itinerary: [
      { date: "", title: "Días 1-2 — Windhoek", items: [{ time: "12:00", text: "Llegada a Hosea Kutako" }, { time: "15:00", text: "Windhoek: ciudad alemana en el corazón de África" }, { time: "Día 2", text: "Ruta hacia el sur por el desierto" }] },
      { date: "", title: "Días 3-4 — Sossusvlei", items: [{ time: "05:00", text: "Duna 45 al amanecer: 170m de arena roja" }, { time: "07:00", text: "Deadvlei: árboles muertos de 900 años en el desierto blanco" }, { time: "10:00", text: "Big Daddy Dune: la duna más alta (325m)" }, { time: "Día 4", text: "NamibRand: la oscuridad más estrellada del mundo" }] },
      { date: "", title: "Días 5-6 — Swakopmund", items: [{ time: "09:00", text: "Swakopmund: cerveza alemana en el desierto costero" }, { time: "14:00", text: "Skeleton Coast: esqueletos de ballenas en la playa" }, { time: "Día 6", text: "Sandboarding en las dunas costeras" }] },
      { date: "", title: "Días 7-11 — Etosha", items: [{ time: "09:00", text: "Parque Nacional de Etosha: el mayor de Namibia" }, { time: "Días 7-9", text: "Waterhole: elefantes, rinocerontes y leones al abrevadero" }, { time: "Noche", text: "Night drive: guepardos y leopardos" }, { time: "Días 10-11", text: "Regreso a Windhoek y vuelo" }] },
    ],
    mapPlaces: [
      { name: "Deadvlei (Sossusvlei)", lat: -24.76, lon: 15.29, note: "Árboles muertos de 900 años en sartén blanca" },
      { name: "Duna 45", lat: -24.73, lon: 15.44, note: "La duna más famosa: 170m de arena roja" },
      { name: "Etosha", lat: -19.13, lon: 15.91, note: "El mayor parque nacional de Namibia" },
      { name: "Swakopmund", lat: -22.68, lon: 14.53, note: "Ciudad alemana en el desierto costero" },
    ],
  },
  {
    id: "rwanda", name: "Rwanda: Gorilas de Montaña", country: "Rwanda", flag: "🇷🇼",
    costPerPerson: 3100, durationDays: 7, type: "naturaleza",
    description: "La experiencia más emocionante de la vida: sentarse a 1 metro de una familia de gorilas de montaña en los Virunga, la Kigali más limpia de África y el lago Kivu.",
    highlights: ["Trekking gorilas", "Volcanoes NP", "Kigali", "Lago Kivu"],
    itinerary: [
      { date: "", title: "Días 1-2 — Kigali", items: [{ time: "12:00", text: "Llegada a Kigali Internacional" }, { time: "15:00", text: "Kigali: la capital más limpia y segura de África" }, { time: "Día 2", text: "Memorial del Genocidio: historia impactante del 1994" }, { time: "15:00", text: "Mercado artesanal y colinas de Kigali" }] },
      { date: "", title: "Días 3-5 — Parque de los Volcanes", items: [{ time: "07:00", text: "Trek de 2-6h en busca de los gorilas" }, { time: "Mediodía", text: "1 hora con la familia de gorilas: la experiencia de la vida" }, { time: "Día 4", text: "Trek de Golden Monkeys: otros primates únicos" }, { time: "Día 5", text: "Subida al Bisoke (3.711m) entre volcanes" }] },
      { date: "", title: "Días 6-7 — Lago Kivu", items: [{ time: "09:00", text: "Conducción al Lago Kivu" }, { time: "12:00", text: "Gisenyi: playa y cerveza Primus a orillas del lago" }, { time: "Día 7", text: "Kayak y visita a la isla Idjwi" }] },
    ],
    mapPlaces: [
      { name: "Parque de los Volcanes", lat: -1.47, lon: 29.54, note: "El único lugar para ver gorilas de montaña" },
      { name: "Kigali", lat: -1.95, lon: 30.06, note: "La capital más limpia de África" },
      { name: "Lago Kivu", lat: -2.05, lon: 29.21, note: "Lago de montaña entre Rwanda y Congo" },
      { name: "Volcán Bisoke", lat: -1.47, lon: 29.49, note: "3.711m — con cráter y lago en la cima" },
    ],
  },
  {
    id: "madagascar", name: "Madagascar", country: "Madagascar", flag: "🇲🇬",
    costPerPerson: 2100, durationDays: 12, type: "naturaleza",
    description: "El continente perdido: el 90% de su fauna no existe en ningún otro lugar. Baobabs gigantes al atardecer, lémures en la nariz, chamelones cambiando de color y playas de cuento.",
    highlights: ["Avenida de los Baobabs", "Lémures", "Tsingy de Bemaraha", "Playas Nosy Be"],
    itinerary: [
      { date: "", title: "Días 1-2 — Antananarivo", items: [{ time: "12:00", text: "Llegada a Ivato" }, { time: "15:00", text: "Rova: el palacio de la reina merina" }, { time: "Día 2", text: "Lemur Island: lémures comiendo de tu mano" }] },
      { date: "", title: "Días 3-4 — Avenida de los Baobabs", items: [{ time: "08:00", text: "RN7 hacia el sur: la ruta más bella de Madagascar" }, { time: "17:00", text: "Avenida de los Baobabs: los últimos gigantes vivos al atardecer" }, { time: "Noche", text: "Dormir bajo los baobabs" }] },
      { date: "", title: "Días 5-7 — Tsingy de Bemaraha", items: [{ time: "09:00", text: "Tsingy: agujas de piedra caliza de 50m (UNESCO)" }, { time: "14:00", text: "Puentes de cuerda entre las agujas" }, { time: "Día 6", text: "Bosque de baobabs del norte" }, { time: "Día 7", text: "Río Tsiribihina en canoa 3 días" }] },
      { date: "", title: "Días 8-12 — Nosy Be", items: [{ time: "09:00", text: "Vuelo a Nosy Be: las Seychelles de Madagascar" }, { time: "13:00", text: "Nosy Iranja: playa de arena blanca en banco de arena" }, { time: "Días 9-10", text: "Snorkel con mantas y tiburones ballena" }, { time: "Días 11-12", text: "Selva de Lokobe: lémures nocturnos" }] },
    ],
    mapPlaces: [
      { name: "Avenida de los Baobabs", lat: -20.25, lon: 44.42, note: "Baobabs de 800 años — símbolo de Madagascar" },
      { name: "Tsingy de Bemaraha", lat: -18.77, lon: 44.72, note: "Agujas de piedra caliza Patrimonio UNESCO" },
      { name: "Nosy Be", lat: -13.35, lon: 48.27, note: "Isla tropical con snorkel y playas vírgenes" },
      { name: "Lemur Island (Antananarivo)", lat: -19.75, lon: 47.00, note: "Lémures comiendo de tu mano" },
    ],
  },
  // ── América Latina ──
  {
    id: "bolivia", name: "Bolivia: Salar de Uyuni", country: "Bolivia", flag: "🇧🇴",
    costPerPerson: 1100, durationDays: 9, type: "naturaleza",
    description: "El espejo más grande del mundo: el Salar de Uyuni, la laguna roja con flamencos, la ciudad más alta del mundo (Potosí), el Lago Titicaca boliviano y La Paz.",
    highlights: ["Salar de Uyuni", "Laguna Colorada", "Potosí", "La Paz"],
    itinerary: [
      { date: "", title: "Días 1-2 — La Paz", items: [{ time: "12:00", text: "Llegada al aeropuerto de El Alto (4.060m)" }, { time: "15:00", text: "Teleférico urbano: la red de cable más larga del mundo" }, { time: "Noche", text: "Zona Rosa: mercado de brujas y hoja de coca" }, { time: "Día 2", text: "Camino de la Muerte en bicicleta (3.600m de descenso)" }] },
      { date: "", title: "Días 3-4 — Uyuni", items: [{ time: "08:00", text: "Vuelo a Uyuni" }, { time: "12:00", text: "Cementerio de trenes: locomotoras oxidadas en el desierto" }, { time: "15:00", text: "Primer contacto con el salar (10.582 km²)" }, { time: "Noche", text: "Hotel de sal: paredes, cama y mesa de sal" }] },
      { date: "", title: "Días 5-6 — Circuito sur (lagunas)", items: [{ time: "07:00", text: "Laguna Colorada: roja por algas + flamencos" }, { time: "12:00", text: "Géiseres Sol de Mañana a 4.850m (04:00 de la mañana)" }, { time: "15:00", text: "Laguna Verde: al pie del Volcán Licancabur" }, { time: "Día 6", text: "Horizonte perfecto del salar con charco reflectante" }] },
      { date: "", title: "Días 7-9 — Potosí y Lago Titicaca", items: [{ time: "09:00", text: "Potosí: la ciudad minera a 4.090m — el cerro que financió Europa" }, { time: "13:00", text: "Minas de Cerro Rico: descenso con dinamita activa" }, { time: "Días 8-9", text: "Lago Titicaca: Isla del Sol — cuna del Imperio Inca" }] },
    ],
    mapPlaces: [
      { name: "Salar de Uyuni", lat: -20.14, lon: -67.49, note: "El espejo más grande del mundo (10.582 km²)" },
      { name: "Laguna Colorada", lat: -22.17, lon: -67.78, note: "Laguna roja con flamencos a 4.278m" },
      { name: "Potosí", lat: -19.59, lon: -65.75, note: "La ciudad minera que financió el Imperio Español" },
      { name: "La Paz", lat: -16.50, lon: -68.15, note: "La capital más alta del mundo (3.640m)" },
    ],
  },
  {
    id: "ecuador-galapagos", name: "Ecuador & Galápagos", country: "Ecuador", flag: "🇪🇨",
    costPerPerson: 2600, durationDays: 10, type: "naturaleza",
    description: "El laboratorio de Darwin: las islas donde los animales nunca aprendieron a tener miedo a los humanos. Iguanas marinas, tortugas gigantes centenarias, lobos marinos y pingüinos en el Ecuador.",
    highlights: ["Galápagos (lobos marinos)", "Tortugas gigantes", "Quito colonial", "Volcán Cotopaxi"],
    itinerary: [
      { date: "", title: "Días 1-2 — Quito", items: [{ time: "12:00", text: "Llegada a Mariscal Sucre (2.800m)" }, { time: "15:00", text: "Quito Colonial: el centro histórico más conservado de América" }, { time: "Día 2", text: "Mitad del Mundo: foto pisando el Ecuador" }, { time: "14:00", text: "Volcán Cotopaxi (5.897m) en la distancia" }] },
      { date: "", title: "Días 3-7 — Galápagos (crucero)", items: [{ time: "08:00", text: "Vuelo a Baltra (2h)" }, { time: "12:00", text: "Embarcación en el crucero" }, { time: "Día 3", text: "Isla Santa Cruz: tortugas gigantes en libertad" }, { time: "Día 4", text: "Isla Española: piqueros patas azules y albatros" }, { time: "Día 5", text: "Isla Fernandina: iguanas marinas y lobos marinos" }, { time: "Día 6", text: "Buceo con tiburones de Galápagos" }, { time: "Día 7", text: "Pingüinos de Galápagos en la Línea del Ecuador" }] },
      { date: "", title: "Días 8-10 — Ruta Indígena", items: [{ time: "09:00", text: "Regreso a Quito" }, { time: "11:00", text: "Otavalo: mercado indígena más grande de Sudamérica" }, { time: "Día 9", text: "Laguna de Quilotoa: lago volcánico verde" }, { time: "Día 10", text: "Vuelo de regreso" }] },
    ],
    mapPlaces: [
      { name: "Galápagos (Isla Santa Cruz)", lat: -0.74, lon: -90.31, note: "El archipiélago de Darwin — fauna única" },
      { name: "Quito (Centro Histórico)", lat: -0.22, lon: -78.51, note: "El centro colonial mejor conservado de América" },
      { name: "Volcán Cotopaxi", lat: -0.68, lon: -78.44, note: "El volcán activo más alto del mundo (5.897m)" },
      { name: "Laguna Quilotoa", lat: -0.86, lon: -78.90, note: "Lago volcánico de color verde esmeralda" },
    ],
  },
  {
    id: "brasil", name: "Brasil: Río & Amazonia", country: "Brasil", flag: "🇧🇷",
    costPerPerson: 1800, durationDays: 11, type: "aventura",
    description: "Rio de Janeiro con el Cristo Redentor y el Carnaval, la selva amazónica más virgen del mundo, las cataratas de Iguazú y las playas de Florianópolis.",
    highlights: ["Cristo Redentor", "Amazonia", "Cataratas Iguazú", "Carnaval"],
    itinerary: [
      { date: "", title: "Días 1-3 — Río de Janeiro", items: [{ time: "12:00", text: "Llegada a Galeão" }, { time: "16:00", text: "Cristo Redentor al atardecer: la vista que defina Brasil" }, { time: "Día 2", text: "Ipanema y Copacabana: fútbol en la playa" }, { time: "14:00", text: "Pan de Azúcar en teleférico" }, { time: "Día 3", text: "Lapa: samba y caipirinha toda la noche" }] },
      { date: "", title: "Días 4-6 — Amazonia", items: [{ time: "08:00", text: "Vuelo a Manaus (3h)" }, { time: "14:00", text: "Confluencia del Negro y el Solimões: dos ríos que no se mezclan" }, { time: "Día 5", text: "Lodge en la selva: piranhas al atardecer" }, { time: "Día 6", text: "Canoa al amanecer: tucanes y monos capuchino" }] },
      { date: "", title: "Días 7-8 — Lençóis Maranhenses", items: [{ time: "09:00", text: "Vuelo a São Luís" }, { time: "14:00", text: "Lençóis Maranhenses: dunas blancas con lagunas de agua dulce" }, { time: "Día 8", text: "Nadar en las lagunas azules entre dunas" }] },
      { date: "", title: "Días 9-11 — Iguazú y vuelta", items: [{ time: "09:00", text: "Vuelo a Foz do Iguaçu" }, { time: "12:00", text: "Cataratas de Iguazú lado brasileño: vista panorámica" }, { time: "Día 10", text: "Lado argentino: caminar sobre el agua" }, { time: "Día 11", text: "Vuelo de regreso" }] },
    ],
    mapPlaces: [
      { name: "Cristo Redentor (Río)", lat: -22.95, lon: -43.21, note: "La estatua más famosa de Brasil" },
      { name: "Amazonia (Manaus)", lat: -3.10, lon: -60.03, note: "La selva tropical más grande del mundo" },
      { name: "Lençóis Maranhenses", lat: -2.49, lon: -43.12, note: "Dunas blancas con lagunas de agua dulce" },
      { name: "Cataratas del Iguazú (Brasil)", lat: -25.69, lon: -54.44, note: "275 cataratas — más impresionantes que las del Niágara" },
    ],
  },
  {
    id: "chile", name: "Chile: Atacama & Torres del Paine", country: "Chile", flag: "🇨🇱",
    costPerPerson: 2300, durationDays: 11, type: "naturaleza",
    description: "El país más largo del mundo: el desierto de Atacama (el más árido de la Tierra) con géiseres y flamencos, y Torres del Paine en el fin del mundo.",
    highlights: ["Valle de la Luna", "Torres del Paine", "Géiseres Tatio", "San Pedro de Atacama"],
    itinerary: [
      { date: "", title: "Días 1-4 — San Pedro de Atacama", items: [{ time: "12:00", text: "Vuelo a Calama + bus a San Pedro (1h)" }, { time: "17:00", text: "Valle de la Luna: atardecer en el desierto" }, { time: "Día 2 04:00", text: "Géiseres del Tatio: 4.320m y 86°C de vapor" }, { time: "Día 3", text: "Laguna Cejar: flotar como en el Mar Muerto" }, { time: "Día 4", text: "Atacama grande: Salar de Atacama y flamencos" }] },
      { date: "", title: "Días 5-6 — Santiago", items: [{ time: "09:00", text: "Vuelo a Santiago" }, { time: "14:00", text: "Barrio Lastarria: gastronomía chilena" }, { time: "Día 6", text: "Cerro San Cristóbal: panorámica con los Andes nevados" }] },
      { date: "", title: "Días 7-11 — Torres del Paine", items: [{ time: "08:00", text: "Vuelo a Punta Arenas + bus a Torres del Paine (5h)" }, { time: "Días 7-9", text: "W Trek: Las Torres, Valle del Francés, Mirador Grey" }, { time: "Día 10", text: "Glaciar Grey: iceberg azul y condores" }, { time: "Día 11", text: "Vuelo de regreso desde Punta Arenas" }] },
    ],
    mapPlaces: [
      { name: "Valle de la Luna (Atacama)", lat: -22.90, lon: -68.26, note: "Paisaje marciano en el desierto más árido del mundo" },
      { name: "Torres del Paine", lat: -51.00, lon: -73.00, note: "Torres de granito — trekking Patrimonio UNESCO" },
      { name: "Géiseres del Tatio", lat: -22.33, lon: -68.02, note: "El campo de géiseres más alto del mundo (4.320m)" },
      { name: "Glaciar Grey", lat: -51.10, lon: -73.24, note: "Glaciar azul con icebergs desprendiéndose" },
    ],
  },
  // ── Destinos verdaderamente insólitos ──
  {
    id: "svalbard", name: "Svalbard", country: "Noruega (Ártico)", flag: "🇸🇯",
    costPerPerson: 2800, durationDays: 7, type: "aventura",
    description: "El archipiélago más septentrional del mundo: osos polares superan en número a las personas, auroras boreales todo el invierno, sol de medianoche en verano y glaciares que llegan al mar.",
    highlights: ["Osos polares", "Auroras boreales", "Glaciar Nordenskiöld", "Longyearbyen"],
    itinerary: [
      { date: "", title: "Días 1-2 — Longyearbyen", items: [{ time: "12:00", text: "Llegada a Longyearbyen (la ciudad más al norte con vuelos regulares)" }, { time: "15:00", text: "Museo de Svalbard: historia de minería y exploración polar" }, { time: "Noche", text: "Aurora boreal desde la ciudad (oct-feb)" }, { time: "Día 2", text: "Obligatorio: llevar rifle para salir de la ciudad (osos polares)" }] },
      { date: "", title: "Días 3-4 — Safari polar", items: [{ time: "08:00", text: "Snowmobile o perros de trineo hasta el glaciar" }, { time: "12:00", text: "Glaciar de Nordenskiöld: hielo azul de 10.000 años" }, { time: "Día 4", text: "Búsqueda de osos polares en barco" }, { time: "16:00", text: "Foca de Weddell y renos árticos en la costa" }] },
      { date: "", title: "Días 5-7 — Expedición", items: [{ time: "08:00", text: "Barco de expedición al norte (82°N)" }, { time: "14:00", text: "Hielo marino: caminar sobre el pack ice" }, { time: "Noche", text: "Cena con vista a las auroras desde el barco" }, { time: "Día 7", text: "Vuelo de regreso via Oslo" }] },
    ],
    mapPlaces: [
      { name: "Longyearbyen", lat: 78.22, lon: 15.65, note: "La ciudad más al norte del mundo con vuelos regulares" },
      { name: "Nordenskiöld (glaciar)", lat: 78.47, lon: 16.54, note: "Glaciar que llega al mar ártico" },
      { name: "Ny-Ålesund", lat: 78.93, lon: 11.93, note: "El asentamiento permanente más septentrional del mundo" },
      { name: "Spitsbergen (norte)", lat: 80.00, lon: 15.00, note: "Zona de osos polares y hielo marino" },
    ],
  },
  {
    id: "mongolia", name: "Mongolia", country: "Mongolia", flag: "🇲🇳",
    costPerPerson: 1700, durationDays: 10, type: "aventura",
    description: "El país menos densamente poblado del mundo: stepas infinitas, desierto de Gobi con dinosaurios, los descendientes de Gengis Kan y una noche en yurta bajo el cielo más oscuro del planeta.",
    highlights: ["Desierto del Gobi", "Noche en yurta", "Stepas infinitas", "Festival Naadam"],
    itinerary: [
      { date: "", title: "Días 1-2 — Ulán Bator", items: [{ time: "12:00", text: "Llegada a Chinggis Khaan International" }, { time: "15:00", text: "Sukhbaatar Square: el Times Square de Mongolia" }, { time: "Día 2", text: "Monasterio Gandan: el mayor monasterio budista" }] },
      { date: "", title: "Días 3-5 — Stepas centrales", items: [{ time: "08:00", text: "Jeep 4x4 hacia las stepas: no hay carreteras, solo GPS" }, { time: "14:00", text: "Primer ger (yurta): familia nómada en la estepa" }, { time: "Noche", text: "Cielo estrellado sin ninguna luz artificial en 100km" }, { time: "Día 4", text: "A caballo por las stepas — los mejores jinetes del mundo" }, { time: "Día 5", text: "Kharkhorin: la antigua capital del Imperio Mongol" }] },
      { date: "", title: "Días 6-8 — Desierto del Gobi", items: [{ time: "08:00", text: "Vuelo interno a Dalanzadgad" }, { time: "12:00", text: "Dunas de Khongoryn Els: 800m de arena cantante" }, { time: "Día 7", text: "Yacimiento de dinosaurios: huevos de Velociraptor in situ" }, { time: "Día 8", text: "Cañón de Yolyn Am: hielo eterno en el desierto (julio)" }] },
      { date: "", title: "Días 9-10 — Regreso", items: [{ time: "09:00", text: "Vuelo a UB" }, { time: "14:00", text: "Mercado Negro de Ulán Bator: casamirmir y deels" }, { time: "Día 10", text: "Vuelo de regreso" }] },
    ],
    mapPlaces: [
      { name: "Desierto del Gobi (Khongoryn Els)", lat: 43.77, lon: 102.20, note: "Dunas cantantes de 800m en el mayor desierto de Asia" },
      { name: "Stepas centrales", lat: 47.19, lon: 102.60, note: "Estepa infinita: el mayor pastizal del mundo" },
      { name: "Kharkhorin", lat: 47.21, lon: 102.84, note: "La antigua capital del Imperio Mongol de Gengis Kan" },
      { name: "Ulán Bator", lat: 47.89, lon: 106.91, note: "La capital más fría del mundo" },
    ],
  },
  {
    id: "kirguistan", name: "Kirguistán", country: "Kirguistán", flag: "🇰🇬",
    costPerPerson: 980, durationDays: 9, type: "aventura",
    description: "La Suiza de Asia Central: nieve perpetua en las cimas del Tian Shan, el lago Son Kul a 3.000m entre yurtas y caballos, el épico cañón de Skazka y hospitalidad nómada sin igual.",
    highlights: ["Lago Son Kul", "Cañón Skazka", "Ala-Archa", "Yurtas nómadas"],
    itinerary: [
      { date: "", title: "Días 1-2 — Biskek", items: [{ time: "12:00", text: "Llegada a Manas International" }, { time: "15:00", text: "Plaza Ala-Too y la estatua de Manas" }, { time: "Día 2", text: "Cañón de Konorchek: formaciones de tierra roja" }] },
      { date: "", title: "Días 3-4 — Ala-Archa y Karakol", items: [{ time: "09:00", text: "Parque Nacional Ala-Archa: glaciares a 40 min de la capital" }, { time: "Día 4", text: "Bus a Karakol (6h por el lago Issyk-Kul: el 2º mayor lago de montaña)" }] },
      { date: "", title: "Días 5-6 — Cañón Skazka y Jeti-Oguz", items: [{ time: "09:00", text: "Cañón Skazka: formaciones de arcilla en mil colores" }, { time: "14:00", text: "Jeti-Oguz: las 7 rocas rojas y el valle de los osos" }, { time: "Día 6", text: "Barskoon: cascada y valle alpino" }] },
      { date: "", title: "Días 7-9 — Son Kul", items: [{ time: "08:00", text: "Ascenso a Son Kul (3.016m) en jeep" }, { time: "14:00", text: "Yurta junto al lago: caballos libres y el horizonte eterno" }, { time: "Noche", text: "Cena de beshbarmak con familia kirguiza" }, { time: "Día 8", text: "A caballo alrededor del lago" }, { time: "Día 9", text: "Descenso y vuelo de regreso" }] },
    ],
    mapPlaces: [
      { name: "Lago Son Kul", lat: 41.84, lon: 75.12, note: "Lago alpino a 3.016m rodeado de yurtas y caballos" },
      { name: "Cañón Skazka", lat: 42.25, lon: 77.30, note: "Formaciones de arcilla multicolor — el 'Cuento de Hadas'" },
      { name: "Ala-Archa", lat: 42.57, lon: 74.49, note: "Glaciares y cimas de más de 4.000m a 40 min de la capital" },
      { name: "Lago Issyk-Kul", lat: 42.49, lon: 77.28, note: "El segundo lago de montaña más grande del mundo" },
    ],
  },
  {
    id: "bhutan", name: "Bután", country: "Bután", flag: "🇧🇹",
    costPerPerson: 3200, durationDays: 9, type: "cultura",
    description: "El único país que mide la Felicidad Nacional Bruta: el monasterio de Tigres Nest colgado en el acantilado a 3.120m, valles sagrados protegidos del turismo masivo y el último reino budista del Himalaya.",
    highlights: ["Tigres Nest (Paro Taktsang)", "Punakha Dzong", "Senderismo himalayo", "Archery"],
    itinerary: [
      { date: "", title: "Días 1-2 — Paro y llegada", items: [{ time: "12:00", text: "Llegada a Paro — uno de los aterrizajes más difíciles del mundo" }, { time: "15:00", text: "Dzong de Rinpung: fortaleza medieval sobre el río" }, { time: "Día 2 07:00", text: "Subida al Tigres Nest (4h, 3.120m): el monasterio más sagrado de Bután" }] },
      { date: "", title: "Días 3-4 — Timpú", items: [{ time: "09:00", text: "Timpú: la única capital del mundo sin semáforos" }, { time: "12:00", text: "Memorial Chorten: la ronda budista diaria" }, { time: "15:00", text: "Takin Reserve: el animal nacional único de Bután" }, { time: "Día 4", text: "Taller de pintura de thangkas" }] },
      { date: "", title: "Días 5-6 — Valle de Punakha", items: [{ time: "09:00", text: "Paso de Dochula (3.100m): 108 stupas y el Himalaya nevado" }, { time: "13:00", text: "Punakha Dzong: la fortaleza más bella de Bután" }, { time: "Día 6", text: "Rafting en el río Pho Chhu" }] },
      { date: "", title: "Días 7-9 — Bumthang", items: [{ time: "09:00", text: "Vuelo interno a Jakar" }, { time: "12:00", text: "Valle de Bumthang: los templos más sagrados del s. VII" }, { time: "Día 8", text: "Trek de Duer Hot Springs" }, { time: "Día 9", text: "Vuelo de regreso" }] },
    ],
    mapPlaces: [
      { name: "Tigres Nest (Paro)", lat: 27.49, lon: 89.36, note: "Monasterio en el acantilado a 3.120m — lo más sagrado de Bután" },
      { name: "Punakha Dzong", lat: 27.61, lon: 89.87, note: "La fortaleza más bella del reino" },
      { name: "Timpú", lat: 27.47, lon: 89.64, note: "La única capital del mundo sin semáforos" },
      { name: "Paso de Dochula", lat: 27.50, lon: 89.74, note: "108 stupas con vistas al Himalaya en días claros" },
    ],
  },
  {
    id: "iran", name: "Irán: Persia Eterna", country: "Irán", flag: "🇮🇷",
    costPerPerson: 1100, durationDays: 10, type: "cultura",
    description: "El gran incomprendido del turismo: Isfahán con sus mezquitas de mosaico azul que quitan el habla, Persépolis la capital del Imperio Persa, Shiraz y los jardines persas — y la hospitalidad más cálida del mundo.",
    highlights: ["Mezquita Imam (Isfahán)", "Persépolis", "Bazar de Teherán", "Shiraz"],
    itinerary: [
      { date: "", title: "Días 1-2 — Teherán", items: [{ time: "12:00", text: "Llegada a IKA" }, { time: "15:00", text: "Gran Bazar de Teherán: 10km de galerías" }, { time: "Día 2", text: "Golestán Palace (UNESCO) y Museo de Joyas Nacionales (el más impresionante del mundo)" }] },
      { date: "", title: "Días 3-5 — Isfahán", items: [{ time: "08:00", text: "Vuelo a Isfahán" }, { time: "11:00", text: "Naghsh-e-Jahan: la segunda plaza más grande del mundo (UNESCO)" }, { time: "13:00", text: "Mezquita Imam: los mosaicos azules más perfectos del islam" }, { time: "16:00", text: "Puente Si-o-se-pol: 33 arcos sobre el río" }, { time: "Día 4", text: "Mezquita Sheikh Lotfollah: solo para los Shas, cúpula que cambia de color" }, { time: "Día 5", text: "Barrio armenio de Jolfa y catedral" }] },
      { date: "", title: "Días 6-7 — Yazd y desierto", items: [{ time: "09:00", text: "Yazd: la ciudad zoroástrica de adobe" }, { time: "14:00", text: "Torres del Silencio: donde los zoroastristas dejaban los muertos" }, { time: "Día 7", text: "Desierto de Dasht-e Kavir: dunas al amanecer" }] },
      { date: "", title: "Días 8-10 — Shiraz y Persépolis", items: [{ time: "09:00", text: "Persépolis: la capital imperial de Darío el Grande (518 a.C.)" }, { time: "14:00", text: "Jardín de Eram y Bagh-e Afifabad (jardines persas UNESCO)" }, { time: "Día 9", text: "Mezquita Nasir al-Mulk: el mosaico de colores que proyecta luz" }, { time: "Día 10", text: "Vuelo de regreso" }] },
    ],
    mapPlaces: [
      { name: "Mezquita Imam (Isfahán)", lat: 32.65, lon: 51.68, note: "Los mosaicos de cerámica azul más perfectos del mundo" },
      { name: "Persépolis", lat: 29.93, lon: 52.89, note: "Capital del Imperio Persa de Darío (s. VI a.C.)" },
      { name: "Yazd", lat: 31.89, lon: 54.37, note: "La ciudad zoroástrica de adobe más antigua habitada" },
      { name: "Mezquita Nasir al-Mulk (Shiraz)", lat: 29.61, lon: 52.54, note: "El arcoíris interior al amanecer" },
    ],
  },
  {
    id: "groenlandia", name: "Groenlandia", country: "Groenlandia (Dinamarca)", flag: "🇬🇱",
    costPerPerson: 3500, durationDays: 8, type: "aventura",
    description: "La isla más grande del mundo: 80% cubierta de hielo, icebergs del tamaño de rascacielos, auroras boreales todo el invierno, ballenas jorobadas y los últimos inuit.",
    highlights: ["Glaciar Sermeq (Ilulissat)", "Auroras boreales", "Icebergs gigantes", "Kayak ártico"],
    itinerary: [
      { date: "", title: "Días 1-2 — Kangerlussuaq y Nuuk", items: [{ time: "12:00", text: "Llegada a Kangerlussuaq" }, { time: "15:00", text: "Tundra ártica: bueyes almizcleros en libertad" }, { time: "Día 2", text: "Nuuk: la capital más pequeña del mundo" }, { time: "14:00", text: "Museo Nacional de Groenlandia: momias inuit de 500 años" }] },
      { date: "", title: "Días 3-5 — Ilulissat", items: [{ time: "09:00", text: "Vuelo a Ilulissat" }, { time: "12:00", text: "Fiordo de Hielo de Ilulissat (UNESCO): icebergs que producen el 10% del hielo ártico" }, { time: "15:00", text: "Kayak entre icebergs del tamaño de edificios" }, { time: "Día 4", text: "Senderismo sobre el casquete de hielo" }, { time: "Noche", text: "Aurora boreal desde el iglú de cristal" }] },
      { date: "", title: "Días 6-8 — Qaqortoq (sur)", items: [{ time: "09:00", text: "Vuelo al sur: fiordos verdes (el único verde de Groenlandia)" }, { time: "12:00", text: "Hvalsey: la iglesia vikinga más antigua del Nuevo Mundo (s. XIV)" }, { time: "Día 7", text: "Balleneros: avistamiento de ballenas jorobadas" }, { time: "Día 8", text: "Vuelo de regreso via Copenhague" }] },
    ],
    mapPlaces: [
      { name: "Fiordo de Hielo de Ilulissat", lat: 69.22, lon: -51.10, note: "Patrimonio UNESCO — icebergs de 40km de largo" },
      { name: "Nuuk", lat: 64.18, lon: -51.74, note: "La capital más pequeña del mundo (58.000 hab.)" },
      { name: "Casquete de Hielo (Inland Ice)", lat: 67.00, lon: -44.00, note: "El segundo casquete de hielo más grande del mundo" },
      { name: "Qaqortoq (sur)", lat: 60.72, lon: -46.04, note: "Fiordos verdes y restos vikingos del s. X" },
    ],
  },
  {
    id: "cabo-verde", name: "Cabo Verde", country: "Cabo Verde", flag: "🇨🇻",
    costPerPerson: 850, durationDays: 7, type: "playa",
    description: "El archipiélago africano con alma latinoamericana: Sal con sus playas de arena blanca y kitesurf, Fogo con el volcán que destruyó todo en 2014, Santiago y la música morna de Cesária Évora.",
    highlights: ["Playa Santa Maria (Sal)", "Volcán Fogo", "Mindelo (São Vicente)", "Kitesurf"],
    itinerary: [
      { date: "", title: "Días 1-3 — Isla de Sal", items: [{ time: "12:00", text: "Llegada a Amilcar Cabral (SAL)" }, { time: "15:00", text: "Playa Santa Maria: agua cálida a 26°C" }, { time: "Día 2", text: "Kitesurf o windsurf en Ponta Preta" }, { time: "Día 3", text: "Pedra de Lume: laguna de sal donde flotar" }] },
      { date: "", title: "Días 4-5 — Isla de Fogo", items: [{ time: "09:00", text: "Vuelo a Fogo" }, { time: "12:00", text: "Volcán Pico do Fogo (2.829m): subida al cráter" }, { time: "16:00", text: "Chã das Caldeiras: pueblo reconstruido después de la lava de 2014" }, { time: "Noche", text: "Vino Fogo: el único vino cultivado en la lava" }] },
      { date: "", title: "Días 6-7 — Santiago y vuelta", items: [{ time: "09:00", text: "Vuelo a Praia (Santiago)" }, { time: "12:00", text: "Cidade Velha: primera ciudad colonial europea en África (UNESCO)" }, { time: "15:00", text: "Musik de morna: el fado africano" }, { time: "Día 7", text: "Vuelo de regreso" }] },
    ],
    mapPlaces: [
      { name: "Playa Santa Maria (Sal)", lat: 16.59, lon: -22.90, note: "La mejor playa de Cabo Verde" },
      { name: "Volcán Pico do Fogo", lat: 14.95, lon: -24.35, note: "El volcán activo más imponente del Atlántico" },
      { name: "Cidade Velha (Santiago)", lat: 14.91, lon: -23.60, note: "Primera ciudad colonial europea en África tropical (UNESCO)" },
      { name: "Pedra de Lume (Sal)", lat: 16.77, lon: -22.88, note: "Laguna de sal volcánica donde se flota sin esfuerzo" },
    ],
  },
  {
    id: "mozambique", name: "Mozambique", country: "Mozambique", flag: "🇲🇿",
    costPerPerson: 1800, durationDays: 10, type: "playa",
    description: "Las playas más vírgenes de África: el archipiélago de Quirimbas sin turistas, las islas de coral del Bazaruto, las tortugas marinas de Tofo y la arquitectura colonial portuguesa de Ilha de Moçambique.",
    highlights: ["Archipiélago Quirimbas", "Isla de Moçambique (UNESCO)", "Buceo Tofo", "Bazaruto"],
    itinerary: [
      { date: "", title: "Días 1-2 — Maputo", items: [{ time: "12:00", text: "Llegada a Maputo" }, { time: "15:00", text: "Mercado de Artesanato e ferro fundido" }, { time: "Día 2", text: "Malangane: la playa más cercana a la capital" }] },
      { date: "", title: "Días 3-4 — Tofo", items: [{ time: "08:00", text: "Bus a Inhambane (7h)" }, { time: "16:00", text: "Playa de Tofo: una de las mejores playas de África" }, { time: "Día 4", text: "Buceo o snorkel con mantas y tiburones ballena" }] },
      { date: "", title: "Días 5-6 — Bazaruto", items: [{ time: "09:00", text: "Vuelo a Vilankulo" }, { time: "12:00", text: "Dhow (barco tradicional) a las islas Bazaruto" }, { time: "14:00", text: "Snorkel en el arrecife: dugongos y tortugas" }, { time: "Día 6", text: "Dos Milles Ilhas: banco de arena desierto" }] },
      { date: "", title: "Días 7-10 — Ilha de Moçambique", items: [{ time: "09:00", text: "Vuelo a Nampula + bus a Ilha de Moçambique" }, { time: "13:00", text: "Ilha de Moçambique: la ciudad de coral Patrimonio UNESCO" }, { time: "16:00", text: "Fortaleza de São Sebastião (s. XVI)" }, { time: "Días 9-10", text: "Archipiélago de Quirimbas: buceo en aguas prístinas" }] },
    ],
    mapPlaces: [
      { name: "Playa de Tofo", lat: -23.86, lon: 35.55, note: "Buceo con mantas y tiburones ballena" },
      { name: "Ilha de Moçambique", lat: -15.03, lon: 40.73, note: "Ciudad de coral Patrimonio UNESCO del s. XVI" },
      { name: "Archipiélago Bazaruto", lat: -21.65, lon: 35.45, note: "Dugongos y arrecifes vírgenes" },
      { name: "Archipiélago Quirimbas", lat: -11.10, lon: 40.65, note: "Las playas más vírgenes de África" },
    ],
  },
  {
    id: "libano", name: "Líbano", country: "Líbano", flag: "🇱🇧",
    costPerPerson: 890, durationDays: 6, type: "cultura",
    description: "La joya incomprendida del Mediterráneo Oriental: Beirut resurge entre escombros con la escena gastronómica más vibrante del mundo árabe, Baalbek con los templos romanos más grandes jamás construidos y las nieves del Líbano.",
    highlights: ["Baalbek (Roma)", "Beirut Hamra", "Cedros del Líbano", "Jbeil (Biblos)"],
    itinerary: [
      { date: "", title: "Días 1-2 — Beirut", items: [{ time: "12:00", text: "Llegada a Rafic Hariri International" }, { time: "15:00", text: "Barrio de Gemmayzeh: grafitis y cafés entre edificios en ruinas" }, { time: "19:00", text: "Barrio de Mar Mikhael: la mejor escena gastronómica del Mediterráneo Oriental" }, { time: "Día 2", text: "Corniche al amanecer + hummus en Barbar (24h)" }] },
      { date: "", title: "Día 3 — Baalbek", items: [{ time: "08:00", text: "Conducción al Valle de la Bekaa (2h)" }, { time: "11:00", text: "Baalbek: el templo romano más grande y mejor conservado del mundo" }, { time: "14:00", text: "Templo de Baco: más grande que el Partenón" }, { time: "17:00", text: "Viñedos del Bekaa: Château Musar" }] },
      { date: "", title: "Día 4 — Biblos y cedros", items: [{ time: "09:00", text: "Jbeil (Biblos): la ciudad habitada más antigua del mundo (5.000 a.C.)" }, { time: "13:00", text: "Puerto fenicio y castillo de los cruzados" }, { time: "16:00", text: "Bosque de los Cedros del Líbano (los originales del Templo de Salomón)" }] },
      { date: "", title: "Días 5-6 — Tiro y Sidón", items: [{ time: "09:00", text: "Sidón: mercado medieval y jabón de laurel" }, { time: "12:00", text: "Tiro: la ciudad fenicia con hipódromo romano en el mar" }, { time: "Día 6", text: "Regreso a Beirut y vuelo" }] },
    ],
    mapPlaces: [
      { name: "Baalbek", lat: 34.00, lon: 36.21, note: "Los templos romanos más grandes jamás construidos" },
      { name: "Beirut (Gemmayzeh)", lat: 33.89, lon: 35.52, note: "El barrio más vibrante del mundo árabe" },
      { name: "Biblos (Jbeil)", lat: 34.12, lon: 35.65, note: "La ciudad habitada más antigua del mundo (7.000 años)" },
      { name: "Cedros del Líbano", lat: 34.25, lon: 36.06, note: "Los cedros originales mencionados en la Biblia" },
    ],
  },
  // ── Alternativas budget ───────────────────────────────────────────────────
  {
    id: "japon-tokio", name: "Japón: Solo Tokio", country: "Japón", flag: "🇯🇵",
    costPerPerson: 1550, durationDays: 7, type: "cultura",
    description: "Tokio sin diluciones: la megaciudad que vive en el futuro. 7 días inmerso en la capital japonesa, de los barrios electrónicos de Akihabara a los templos milenarios de Asakusa, con escapada al mítico Monte Fuji. El viaje a Japón más accesible.",
    highlights: ["Shibuya Crossing", "Templo Senso-ji", "Akihabara", "Monte Fuji", "Comida callejera"],
    itinerary: [
      { date: "", title: "Día 1 — Shinjuku & Harajuku", items: [{ time: "13:00", text: "Llegada a Haneda/Narita, hotel en Shinjuku" }, { time: "16:00", text: "Shinjuku: el barrio de neón más denso de Tokio" }, { time: "20:00", text: "Harajuku: Takeshita Street, moda alternativa" }] },
      { date: "", title: "Día 2 — Shibuya & Asakusa", items: [{ time: "09:00", text: "Shibuya Crossing al mediodía desde el mirador" }, { time: "14:00", text: "Senso-ji, el templo budista más antiguo de Tokio" }, { time: "18:00", text: "Nakamise-dori: calle de souvenirs tradicionales" }] },
      { date: "", title: "Día 3 — Akihabara & Ueno", items: [{ time: "10:00", text: "Akihabara: la meca de la electrónica y el manga" }, { time: "14:00", text: "Ueno Park y sus 5 museos" }, { time: "19:00", text: "Izakaya en Yurakucho (bajo las vías del tren)" }] },
      { date: "", title: "Días 4-5 — Monte Fuji & Hakone", items: [{ time: "07:00", text: "Bus desde Shinjuku a la 5ª estación del Fuji" }, { time: "10:00", text: "Lago Kawaguchiko: el reflejo perfecto del Fuji" }, { time: "Día 5", text: "Hakone: onsen con vistas al Fuji y ryokan tradicional" }] },
      { date: "", title: "Días 6-7 — Ginza & Vuelo", items: [{ time: "10:00", text: "Ginza: el barrio de lujo y arte contemporáneo" }, { time: "14:00", text: "teamLab Borderless: arte digital inmersivo" }, { time: "Día 7", text: "Compras de última hora en Don Quijote, vuelo" }] },
    ],
    mapPlaces: [
      { name: "Shibuya Crossing", lat: 35.66, lon: 139.70, note: "El cruce peatonal más concurrido del mundo" },
      { name: "Templo Senso-ji (Asakusa)", lat: 35.71, lon: 139.80, note: "El templo budista más antiguo de Tokio" },
      { name: "Akihabara", lat: 35.70, lon: 139.77, note: "La meca mundial de la electrónica y el manga" },
      { name: "Monte Fuji (5ª Estación)", lat: 35.36, lon: 138.73, note: "A 2.305m, el volcán sagrado de Japón" },
      { name: "Shinjuku", lat: 35.69, lon: 139.70, note: "El epicentro del Tokio nocturno" },
    ],
  },
  {
    id: "islandia-express", name: "Islandia Express", country: "Islandia", flag: "🇮🇸",
    costPerPerson: 1350, durationDays: 5, type: "naturaleza",
    description: "El Círculo Dorado y la costa sur islandesa en 5 días compactos: el géiser que erupciona cada 5 minutos, la cascada doble de Gullfoss, la laguna de icebergs azules de Jökulsárlón y la playa de arena negra volcánica. Islandia esencial sin quitar dos semanas.",
    highlights: ["Strokkur (géiser cada 5 min)", "Gullfoss", "Jökulsárlón", "Playa negra Reynisfjara", "Aurora boreal"],
    itinerary: [
      { date: "", title: "Días 1-2 — Reikiavik & Círculo Dorado", items: [{ time: "Día 1", text: "Llegada, Hallgrímskirkja, Harpa Concert Hall" }, { time: "Día 2", text: "Þingvellir (placas tectónicas), Strokkur, Gullfoss" }] },
      { date: "", title: "Días 3-4 — Costa Sur", items: [{ time: "Día 3", text: "Seljalandsfoss (cascada que puedes rodear), Skógafoss" }, { time: "Día 4", text: "Reynisfjara: playa negra con columnas de basalto" }] },
      { date: "", title: "Día 5 — Jökulsárlón & Vuelo", items: [{ time: "06:00", text: "Jökulsárlón: la laguna de icebergs en azul eléctrico" }, { time: "10:00", text: "Diamond Beach: icebergs sobre arena negra" }, { time: "Tarde", text: "Vuelo de regreso" }] },
    ],
    mapPlaces: [
      { name: "Strokkur (Geysir)", lat: 64.31, lon: -20.30, note: "Erupciona cada 5 minutos a 30m de altura" },
      { name: "Gullfoss", lat: 64.33, lon: -20.12, note: "La mayor cascada de Islandia en dos saltos" },
      { name: "Jökulsárlón", lat: 64.08, lon: -16.23, note: "Laguna glaciar con icebergs azul eléctrico" },
      { name: "Playa Negra Reynisfjara", lat: 63.41, lon: -19.04, note: "Arena negra volcánica con columnas de basalto" },
      { name: "Þingvellir NP", lat: 64.26, lon: -21.13, note: "Donde las placas tectónicas se separan 2cm al año" },
    ],
  },
  // ── Aventura ──────────────────────────────────────────────────────────────
  {
    id: "dolomitas", name: "Dolomitas", country: "Italia", flag: "🇮🇹",
    costPerPerson: 750, durationDays: 6, type: "aventura",
    description: "Las montañas más espectaculares de Europa: agujas de roca que se tiñen de naranja al amanecer (el Enrosadira), lagos esmeralda de postal perfecta y vías ferratas sobre precipicios. A solo 2h de Venecia, sin necesitar ser alpinista.",
    highlights: ["Tre Cime di Lavaredo", "Lago di Braies", "Cortina d'Ampezzo", "Via ferrata", "Alpe di Siusi"],
    itinerary: [
      { date: "", title: "Días 1-2 — Val Gardena", items: [{ time: "10:00", text: "Llegada desde Venecia, Ortisei" }, { time: "14:00", text: "Cable car a Seceda: las vistas más icónicas de los Dolomitas" }, { time: "Día 2", text: "Alpe di Siusi: la meseta alpina más grande de Europa" }] },
      { date: "", title: "Día 3 — Tre Cime", items: [{ time: "06:00", text: "Salida al amanecer para ver las Tres Cimas en rosa" }, { time: "09:00", text: "Circuito clásico de las Tre Cime (10km, 3h)" }] },
      { date: "", title: "Día 4 — Lago di Braies", items: [{ time: "07:00", text: "Lago di Braies al amanecer (antes de que llegue la gente)" }, { time: "10:00", text: "Paseo en barca de madera por el lago" }] },
      { date: "", title: "Días 5-6 — Cortina & Vuelo", items: [{ time: "09:00", text: "Cortina d'Ampezzo: la reina de los Dolomitas" }, { time: "12:00", text: "Via ferrata Ivano Dibona (nivel medio)" }, { time: "Día 6", text: "Vuelta a Venecia, vuelo" }] },
    ],
    mapPlaces: [
      { name: "Tre Cime di Lavaredo", lat: 46.62, lon: 12.30, note: "Las tres agujas más fotografiadas de los Alpes" },
      { name: "Lago di Braies", lat: 46.70, lon: 12.08, note: "El lago de postal más bonito de Italia" },
      { name: "Seceda (Val Gardena)", lat: 46.58, lon: 11.71, note: "Las vistas más icónicas de los Dolomitas" },
      { name: "Cortina d'Ampezzo", lat: 46.54, lon: 12.14, note: "La joya de los Dolomitas" },
      { name: "Alpe di Siusi", lat: 46.54, lon: 11.63, note: "La meseta alpina más grande de Europa" },
    ],
  },
  {
    id: "escocia-highlands", name: "Escocia: Highlands", country: "Escocia (UK)", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
    costPerPerson: 980, durationDays: 6, type: "aventura",
    description: "El paisaje más dramático de Europa: páramos infinitos de brezo violeta, castillos en ruinas sobre lagos brumosos y la mítica Isla de Skye. La NC500 es el road trip más épico de Europa, comparable a la Route 1 de Alaska.",
    highlights: ["Isla de Skye (Fairy Pools)", "Glencoe", "Ben Nevis", "NC500", "Whisky en Speyside"],
    itinerary: [
      { date: "", title: "Días 1-2 — Inverness & Loch Ness", items: [{ time: "Día 1", text: "Vuelo a Inverness, alquiler de coche" }, { time: "15:00", text: "Loch Ness: Castillo Urquhart y el mítico lago negro" }, { time: "Día 2", text: "Black Isle, cascada Rogie Falls, campo de batalla Culloden" }] },
      { date: "", title: "Día 3 — Glencoe & Ben Nevis", items: [{ time: "09:00", text: "Glencoe: el valle más dramático de Escocia" }, { time: "13:00", text: "Ben Nevis: el pico más alto de Gran Bretaña (1.345m)" }] },
      { date: "", title: "Días 4-5 — Isla de Skye", items: [{ time: "09:00", text: "Fairy Pools: pozas de agua cristalina bajo cascadas" }, { time: "12:00", text: "Old Man of Storr: el icono fotográfico de Skye" }, { time: "Día 5", text: "Quiraing y Neist Point: los mejores paisajes de la isla" }] },
      { date: "", title: "Día 6 — Whisky & Vuelo", items: [{ time: "09:00", text: "Speyside: Glenfiddich o The Macallan con cata" }, { time: "Tarde", text: "Vuelo de Inverness de regreso" }] },
    ],
    mapPlaces: [
      { name: "Isla de Skye (Fairy Pools)", lat: 57.25, lon: -6.35, note: "Pozas cristalinas en plena naturaleza" },
      { name: "Glencoe", lat: 56.68, lon: -4.89, note: "El valle más dramático de Escocia" },
      { name: "Ben Nevis", lat: 56.80, lon: -5.00, note: "El pico más alto de Gran Bretaña (1.345m)" },
      { name: "Loch Ness", lat: 57.32, lon: -4.44, note: "El lago más famoso del mundo" },
      { name: "Old Man of Storr (Skye)", lat: 57.50, lon: -6.18, note: "El icono fotográfico de Skye" },
    ],
  },
  {
    id: "borneo", name: "Borneo: Selva & Orangutanes", country: "Malasia/Indonesia", flag: "🇲🇾",
    costPerPerson: 1750, durationDays: 10, type: "aventura",
    description: "La selva tropical más antigua de la Tierra (140 millones de años) y los únicos orangutanes salvajes de Asia. Buceo de primer nivel mundial en Sipadan, cuevas colosales en Mulu y río arriba hacia las tribus dayak. Una de las aventuras más completas del planeta.",
    highlights: ["Orangutanes de Sepilok", "Sipadan (top 3 buceo)", "Gunung Mulu (cuevas)", "Río Kinabatangan", "Monte Kinabalu"],
    itinerary: [
      { date: "", title: "Días 1-2 — Monte Kinabalu", items: [{ time: "Día 1", text: "Llegada a Kota Kinabalu" }, { time: "Día 2", text: "Ascenso al Monte Kinabalu (4.095m, el más alto del SE asiático)" }] },
      { date: "", title: "Días 3-5 — Orangutanes & Kinabatangan", items: [{ time: "Día 3", text: "Sandakan: Centro Sepilok (orangutanes en semilibertad)" }, { time: "Días 4-5", text: "Río Kinabatangan: probóscides, pigmeos y cocodrilos desde el barco" }] },
      { date: "", title: "Días 6-7 — Sipadan", items: [{ time: "Días 6-7", text: "Sipadan Island: tortugas, tiburones de punta negra, bancadas de barracuda" }] },
      { date: "", title: "Días 8-10 — Gunung Mulu", items: [{ time: "Día 8", text: "Vuelo a Mulu, Parque Nacional UNESCO" }, { time: "Días 9-10", text: "Sarawak Chamber (la cueva más grande del mundo), Deer Cave (2M murciélagos)" }] },
    ],
    mapPlaces: [
      { name: "Sepilok Orangutan Centre", lat: 5.87, lon: 117.93, note: "Orangutanes en semilibertad" },
      { name: "Río Kinabatangan", lat: 5.41, lon: 118.02, note: "El mejor avistamiento de fauna de Borneo" },
      { name: "Sipadan Island", lat: 4.11, lon: 118.63, note: "Top 3 destinos de buceo del mundo" },
      { name: "Parque Gunung Mulu", lat: 4.05, lon: 114.81, note: "Las cuevas más grandes del mundo, UNESCO" },
      { name: "Monte Kinabalu", lat: 6.07, lon: 116.56, note: "El pico más alto del Sudeste Asiático" },
    ],
  },
  {
    id: "kazajistan", name: "Kazajistán", country: "Kazajistán", flag: "🇰🇿",
    costPerPerson: 1050, durationDays: 8, type: "aventura",
    description: "El destino más subestimado de Asia Central: el Cañón Charyn parece Marte, el Gran Lago Almaty es verde esmeralda puro a 2.500m, las dunas de Altyn Emel emiten un sonido propio al viento y Nur-Sultan tiene una arquitectura tan futurista que parece sacada de Blade Runner.",
    highlights: ["Cañón Charyn (el Grand Canyon de Asia)", "Gran Lago Almaty", "Dunas cantarinas Altyn Emel", "Nur-Sultan (Astana)", "Tian Shan kazajo"],
    itinerary: [
      { date: "", title: "Días 1-2 — Almaty", items: [{ time: "Día 1", text: "Llegada a Almaty, Kok-Tobe por teleférico, skyline kazajo" }, { time: "Día 2", text: "Gran Lago Almaty (2.511m) — esmeralda en la montaña" }] },
      { date: "", title: "Días 3-4 — Cañón Charyn", items: [{ time: "Días 3-4", text: "Cañón Charyn: el 'Grand Canyon de Asia Central' (Valle de los Castillos)" }] },
      { date: "", title: "Días 5-6 — Altyn Emel", items: [{ time: "Días 5-6", text: "Altyn Emel: dunas cantarinas (suenan como un órgano) y bosque de saxaul" }] },
      { date: "", title: "Días 7-8 — Nur-Sultan", items: [{ time: "Día 7", text: "Vuelo a Nur-Sultan: Bayterek Tower, Khan Shatyr (la mayor carpa del mundo)" }, { time: "Día 8", text: "Palacio de la Paz y Reconciliación, vuelo de salida" }] },
    ],
    mapPlaces: [
      { name: "Cañón Charyn", lat: 43.36, lon: 79.07, note: "El Grand Canyon de Asia Central" },
      { name: "Gran Lago Almaty", lat: 43.05, lon: 76.98, note: "Lago esmeralda a 2.511m de altitud" },
      { name: "Altyn Emel NP (Dunas)", lat: 43.78, lon: 79.23, note: "Dunas que emiten sonido propio" },
      { name: "Almaty", lat: 43.23, lon: 76.94, note: "La mayor ciudad del país, con el Tian Shan de fondo" },
      { name: "Nur-Sultan (Astana)", lat: 51.18, lon: 71.45, note: "La capital futurista del siglo XXI" },
    ],
  },
  {
    id: "alaska", name: "Alaska", country: "Estados Unidos", flag: "🇺🇸",
    costPerPerson: 3500, durationDays: 10, type: "aventura",
    description: "La última frontera americana: osos grizzly pescando salmón, auroras boreales tiñendo el cielo de verde y violeta, glaciares que se derrumban en el mar y el Denali, el pico más alto de América del Norte a 6.190m. La naturaleza más indómita del hemisferio norte.",
    highlights: ["Parque Denali", "Kenai Fjords (kayak glaciares)", "Auroras en Fairbanks", "Brooks Falls (osos grizzly)", "Glaciar Mendenhall"],
    itinerary: [
      { date: "", title: "Días 1-2 — Anchorage & Kenai Fjords", items: [{ time: "Día 1", text: "Llegada a Anchorage, vuelo charter a Seward" }, { time: "Día 2", text: "Kenai Fjords: kayak entre icebergs y glaciares que caen al mar" }] },
      { date: "", title: "Días 3-5 — Parque Denali", items: [{ time: "Días 3-5", text: "Denali NP: autobús de fauna al Glaciar Eielson, grizzly, alces y caribús" }] },
      { date: "", title: "Días 6-7 — Fairbanks & Auroras", items: [{ time: "Días 6-7", text: "Fairbanks: la mejor ciudad del mundo para ver auroras boreales (ago-abril)" }] },
      { date: "", title: "Días 8-10 — Juneau & Glaciares", items: [{ time: "Día 8", text: "Vuelo a Juneau, Glaciar Mendenhall (a pie desde la ciudad)" }, { time: "Días 9-10", text: "Kayak en Tracy Arm Fjord, vuelo de regreso" }] },
    ],
    mapPlaces: [
      { name: "Parque Nacional Denali", lat: 63.73, lon: -150.49, note: "El pico más alto de América del Norte (6.190m)" },
      { name: "Kenai Fjords NP", lat: 59.78, lon: -149.65, note: "Glaciares que caen al mar, nutrias y orcas" },
      { name: "Fairbanks", lat: 64.84, lon: -147.72, note: "El mejor lugar del mundo para ver auroras boreales" },
      { name: "Glaciar Mendenhall (Juneau)", lat: 58.43, lon: -134.55, note: "El glaciar al que llegas caminando desde la ciudad" },
      { name: "Katmai NP (Brooks Falls)", lat: 58.56, lon: -154.95, note: "Los osos grizzly pescando salmón en la catarata" },
    ],
  },
  {
    id: "peru-trek", name: "Perú: Camino Inca", country: "Perú", flag: "🇵🇪",
    costPerPerson: 1800, durationDays: 9, type: "aventura",
    description: "El trek más épico de América: 43km caminando la ruta original inca a 4.215m de altitud, atravesando orquídeas, niebla y ruinas perdidas en la selva andina para llegar al amanecer a Machu Picchu por la Puerta del Sol. Una experiencia que te transforma.",
    highlights: ["Camino Inca (4 días)", "Machu Picchu: Puerta del Sol", "Wiñay Wayna", "Cusco colonial", "Paso Warmiwañusca (4.215m)"],
    itinerary: [
      { date: "", title: "Días 1-2 — Lima & Cusco", items: [{ time: "Día 1", text: "Lima: Miraflores y la mejor gastronomía de América Latina" }, { time: "Día 2", text: "Cusco (3.399m): aclimatación, Plaza de Armas, té de coca" }] },
      { date: "", title: "Días 3-6 — Camino Inca", items: [{ time: "Día 3 (KM82)", text: "Inicio del Camino: Llactapata, primera vista del Urubamba" }, { time: "Día 4", text: "Paso Warmiwañusca (4.215m): el punto más alto" }, { time: "Día 5", text: "Phuyupatamarca y Wiñay Wayna: ruinas entre orquídeas" }, { time: "Día 6 · 04:00", text: "Puerta del Sol: Machu Picchu al amanecer, sin nadie más" }] },
      { date: "", title: "Días 7-9 — Machu Picchu & Regreso", items: [{ time: "Día 7", text: "Machu Picchu: circuito completo, Huayna Picchu (opcional)" }, { time: "Día 8", text: "Aguas Calientes: baños termales, tren a Cusco" }, { time: "Día 9", text: "Mercado San Pedro, vuelo Lima" }] },
    ],
    mapPlaces: [
      { name: "KM82 (Inicio del Camino)", lat: -13.54, lon: -72.25, note: "El punto de salida del Camino Inca" },
      { name: "Paso Warmiwañusca", lat: -13.37, lon: -72.11, note: "El punto más alto del trek a 4.215m" },
      { name: "Wiñay Wayna", lat: -13.19, lon: -72.53, note: "Las ruinas incas más espectaculares del camino" },
      { name: "Puerta del Sol (Inti Punku)", lat: -13.16, lon: -72.54, note: "La entrada original a Machu Picchu al amanecer" },
      { name: "Cusco (Plaza de Armas)", lat: -13.52, lon: -71.98, note: "La capital del Imperio Inca a 3.399m" },
    ],
  },
  {
    id: "noruega-fjords", name: "Noruega: Fiordos", country: "Noruega", flag: "🇳🇴",
    costPerPerson: 1650, durationDays: 7, type: "naturaleza",
    description: "Los fiordos más espectaculares del planeta, esculpidos por glaciares de 2km de espesor. El recorrido Bergen-Flåm-Geirangerfjord es uno de los viajes más cinematográficos de Europa: trenes de montaña, ferris entre cascadas y pueblos de cuento pintados de colores.",
    highlights: ["Geirangerfjord (UNESCO)", "Trolltunga (1.100m sobre el fiordo)", "Bergen (Bryggen)", "Ferrocarril de Flåm", "Auroras boreales"],
    itinerary: [
      { date: "", title: "Días 1-2 — Bergen", items: [{ time: "Día 1", text: "Llegada a Bergen, Bryggen Hanseatic Wharf (UNESCO)" }, { time: "Día 2", text: "Funicular Fløibanen, pescaderías del muelle, Gamle Bergen" }] },
      { date: "", title: "Día 3 — Ferrocarril de Flåm", items: [{ time: "09:00", text: "El tren de montaña más bonito del mundo: 20km, 866m de desnivel" }, { time: "12:00", text: "Flåm: kayak en el Aurlandsfjord" }] },
      { date: "", title: "Días 4-5 — Geirangerfjord", items: [{ time: "Días 4-5", text: "Geirangerfjord: las 7 Hermanas (cascada de 7 saltos), Eagle Road" }] },
      { date: "", title: "Días 6-7 — Trolltunga & Oslo", items: [{ time: "Día 6", text: "Trolltunga: la roca que sobresale 700m sobre el Hardangerfjord (10h)" }, { time: "Día 7", text: "Oslo: Vigelandsparken, museo vikingo, vuelo" }] },
    ],
    mapPlaces: [
      { name: "Geirangerfjord", lat: 62.10, lon: 7.21, note: "Patrimonio UNESCO — el fiordo más famoso del mundo" },
      { name: "Bergen (Bryggen)", lat: 60.40, lon: 5.32, note: "Ciudad hanseática Patrimonio UNESCO" },
      { name: "Trolltunga", lat: 60.12, lon: 6.74, note: "Roca a 1.100m sobre el Hardangerfjord" },
      { name: "Flåm (Ferrocarril)", lat: 60.86, lon: 7.11, note: "El tren de montaña más bonito del mundo" },
      { name: "Ålesund", lat: 62.47, lon: 6.15, note: "La ciudad art nouveau sobre el Atlántico" },
    ],
  },
  {
    id: "nueva-zelanda", name: "Nueva Zelanda", country: "Nueva Zelanda", flag: "🇳🇿",
    costPerPerson: 3100, durationDays: 12, type: "aventura",
    description: "El país más aventurero del planeta: glaciares que caen al Pacífico, fiordos en el fin del mundo, bungee de 134km/h sobre Queenstown y el paisaje que hizo posible La Tierra Media. La naturaleza más extrema y variada del mundo en dos islas perfectamente organizadas.",
    highlights: ["Milford Sound", "Queenstown (aventura extrema)", "Glaciar Franz Josef", "Hobbiton (Shire de Tolkien)", "Abel Tasman"],
    itinerary: [
      { date: "", title: "Días 1-3 — Auckland & Rotorua", items: [{ time: "Día 1", text: "Llegada a Auckland, Sky Tower, vinos de Waiheke Island" }, { time: "Días 2-3", text: "Hobbiton (Matamata) + Rotorua: géiseres, cultura maorí, lodo volcánico" }] },
      { date: "", title: "Días 4-6 — Wellington & Kaikōura", items: [{ time: "Día 4", text: "Wellington: Te Papa Museum, ferry al Sur" }, { time: "Días 5-6", text: "Kaikōura: ballenas y lobos marinos, Christchurch" }] },
      { date: "", title: "Días 7-9 — Franz Josef & Wanaka", items: [{ time: "Días 7-8", text: "Franz Josef Glacier: helicóptero sobre el glaciar y cueva de hielo" }, { time: "Día 9", text: "Wanaka: el lago más fotogénico de Nueva Zelanda" }] },
      { date: "", title: "Días 10-12 — Queenstown & Milford", items: [{ time: "Día 10", text: "Queenstown: bungee AJ Hackett, Skyline Gondola" }, { time: "Día 11", text: "Milford Sound: el fiordo más bello del mundo" }, { time: "Día 12", text: "Vuelo de regreso" }] },
    ],
    mapPlaces: [
      { name: "Milford Sound", lat: -44.67, lon: 167.93, note: "El fiordo más bello del mundo, UNESCO" },
      { name: "Queenstown", lat: -45.03, lon: 168.66, note: "La capital mundial del turismo de aventura" },
      { name: "Glaciar Franz Josef", lat: -43.39, lon: 170.18, note: "Uno de los pocos glaciares que llega casi al nivel del mar" },
      { name: "Hobbiton (Matamata)", lat: -37.87, lon: 175.68, note: "El set original del Shire de Tolkien" },
      { name: "Rotorua (Géiseres)", lat: -38.14, lon: 176.25, note: "La ciudad de los géiseres y la cultura maorí" },
    ],
  },
  // ── Naturaleza adicional & Playas ──────────────────────────────────────────
  {
    id: "mauricio", name: "Isla Mauricio", country: "Mauricio", flag: "🇲🇺",
    costPerPerson: 1950, durationDays: 8, type: "playa",
    description: "La perla del Índico: lagunas de agua turquesa tan calmadas que parecen piscinas, la cascada submarina (espectacular efecto óptico desde el aire), arrecifes de coral primigenios y una gastronomía que mezcla sabores de África, India, China y Francia en la misma mesa.",
    highlights: ["Laguna azul norte", "Cascada submarina (vista aérea)", "Blue Bay Marine Park", "Chamarel (7 colores de tierra)", "Gastronomía criolla"],
    itinerary: [
      { date: "", title: "Días 1-2 — Norte (Grand Baie)", items: [{ time: "Día 1", text: "Llegada, Grand Baie, laguna norte (snorkel con delfines)" }, { time: "Día 2", text: "Tour en barco: Île aux Cerfs, vuelo charter sobre la cascada submarina" }] },
      { date: "", title: "Días 3-4 — Oeste (Black River)", items: [{ time: "Día 3", text: "Black River Gorges: senderismo en la selva nativa" }, { time: "Día 4", text: "Chamarel: tierra de 7 colores, cascada, tortuga gigante" }] },
      { date: "", title: "Días 5-6 — Sur (Blue Bay)", items: [{ time: "Días 5-6", text: "Blue Bay Marine Park: snorkel en el mejor arrecife del Índico occidental" }] },
      { date: "", title: "Días 7-8 — Relax & Vuelo", items: [{ time: "Días 7-8", text: "Flic en Flac (playa más larga), spa, vuelo nocturno" }] },
    ],
    mapPlaces: [
      { name: "Grand Baie (Laguna Norte)", lat: -20.01, lon: 57.58, note: "La laguna de agua más clara de Mauricio" },
      { name: "Blue Bay Marine Park", lat: -20.45, lon: 57.71, note: "El mejor snorkel del Índico occidental" },
      { name: "Chamarel (7 Colores)", lat: -20.44, lon: 57.37, note: "Tierra volcánica que cambia de color" },
      { name: "Black River Gorges NP", lat: -20.39, lon: 57.38, note: "La única selva nativa de Mauricio" },
      { name: "Île aux Cerfs", lat: -20.27, lon: 57.79, note: "La isla más bonita de Mauricio" },
    ],
  },
  {
    id: "kenya", name: "Kenya: Safari", country: "Kenya", flag: "🇰🇪",
    costPerPerson: 2850, durationDays: 9, type: "naturaleza",
    description: "El safari definitivo: el Masái Mara en julio-octubre alberga la Gran Migración donde 1,5 millones de ñus cruzan el río Mara entre cocodrilos. Con el Kilimanjaro nevado en el horizonte desde Amboseli y las playas de Diani como remate de lujo.",
    highlights: ["Masái Mara (Gran Migración)", "Amboseli (Kilimanjaro)", "Lago Nakuru (flamencos)", "Diani Beach", "Comunidades masái"],
    itinerary: [
      { date: "", title: "Días 1-2 — Nairobi", items: [{ time: "Día 1", text: "Llegada, Parque Nacional de Nairobi (jirafas con rascacielos de fondo)" }, { time: "Día 2", text: "David Sheldrick (elefantes huérfanos), Giraffe Centre" }] },
      { date: "", title: "Días 3-6 — Masái Mara", items: [{ time: "Días 3-6", text: "Safari en el Masái Mara: 3 días completos con game drives, cruce del río Mara" }] },
      { date: "", title: "Días 7-8 — Amboseli", items: [{ time: "Días 7-8", text: "Amboseli NP: elefantes con el Kilimanjaro nevado de fondo (la foto más icónica de África)" }] },
      { date: "", title: "Día 9 — Diani Beach & Vuelo", items: [{ time: "Día 9", text: "Vuelo a Mombasa, Diani Beach, vuelo nocturno de regreso" }] },
    ],
    mapPlaces: [
      { name: "Masái Mara NR", lat: -1.50, lon: 35.15, note: "La Gran Migración: 1,5 millones de ñus" },
      { name: "Amboseli NP", lat: -2.65, lon: 37.26, note: "Elefantes con el Kilimanjaro nevado de fondo" },
      { name: "Lago Nakuru NP", lat: -0.35, lon: 36.08, note: "El lago rosa de los flamencos" },
      { name: "Nairobi NP", lat: -1.37, lon: 36.85, note: "Safari con rascacielos de fondo — único en el mundo" },
      { name: "Diani Beach", lat: -4.28, lon: 39.57, note: "La mejor playa de África Oriental" },
    ],
  },
  // ── Cultura adicional ──────────────────────────────────────────────────────
  {
    id: "india", name: "India: Rajastán & Delhi", country: "India", flag: "🇮🇳",
    costPerPerson: 1250, durationDays: 10, type: "cultura",
    description: "La India que siempre has imaginado: palacios de maharajás, el Taj Mahal al amanecer en niebla rosa, bazares que asaltan todos los sentidos y el Ganges sagrado en Varanasi al atardecer. Rajastán es el estado más colorido y fotogénico del mundo.",
    highlights: ["Taj Mahal (amanecer)", "Jaipur Ciudad Rosa", "Jodhpur Ciudad Azul", "Varanasi (Ganges)", "Fuerte Amber"],
    itinerary: [
      { date: "", title: "Días 1-2 — Delhi", items: [{ time: "Día 1", text: "Llegada a Delhi, Lodi Garden, barrio de Hauz Khas" }, { time: "Día 2", text: "Chandni Chowk (el bazar más caótico del mundo), Red Fort, Humayun's Tomb" }] },
      { date: "", title: "Días 3-4 — Agra & Taj Mahal", items: [{ time: "05:00", text: "Amanecer en el Taj Mahal (luz rosa, sin multitudes)" }, { time: "09:00", text: "Fuerte de Agra: mármol rojo y vista al Taj desde arriba" }, { time: "Día 4", text: "Fatehpur Sikri: ciudad mogola abandonada en el desierto" }] },
      { date: "", title: "Días 5-6 — Jaipur (Ciudad Rosa)", items: [{ time: "Día 5", text: "Fuerte Amber: elefantes, espejos y vistas" }, { time: "Día 6", text: "Palacio de los Vientos (Hawa Mahal), Jantar Mantar, City Palace" }] },
      { date: "", title: "Días 7-8 — Jodhpur & Pushkar", items: [{ time: "Día 7", text: "Jodhpur (Ciudad Azul): Fuerte de Mehrangarh desde el cielo" }, { time: "Día 8", text: "Pushkar: el único templo de Brahma del mundo, lago sagrado" }] },
      { date: "", title: "Días 9-10 — Varanasi", items: [{ time: "Día 9", text: "Vuelo a Varanasi, ghats del Ganges al atardecer (Ganga Aarti)" }, { time: "Día 10", text: "Amanecer en barca por el Ganges, vuelo de regreso" }] },
    ],
    mapPlaces: [
      { name: "Taj Mahal (Agra)", lat: 27.17, lon: 78.04, note: "Una de las 7 Maravillas del Mundo Moderno" },
      { name: "Jaipur (Fuerte Amber)", lat: 26.99, lon: 75.85, note: "Palacio con espejos de los maharajás" },
      { name: "Jodhpur (Fuerte Mehrangarh)", lat: 26.30, lon: 73.02, note: "La Ciudad Azul desde la fortaleza más imponente" },
      { name: "Varanasi (Ghats del Ganges)", lat: 25.31, lon: 83.01, note: "La ciudad sagrada más antigua del mundo" },
      { name: "Delhi (Red Fort)", lat: 28.65, lon: 77.24, note: "La fortaleza mogola del siglo XVII" },
    ],
  },
  // ── Ciudad ────────────────────────────────────────────────────────────────
  {
    id: "londres", name: "Londres", country: "Reino Unido", flag: "🇬🇧",
    costPerPerson: 1100, durationDays: 5, type: "ciudad",
    description: "La capital más multicultural del mundo: museos gratuitos de primer nivel (el British, el V&A, la National Gallery), mercados que mezclan culturas de 150 países, arquitectura del Tower Bridge al Shard, y la mejor escena teatral del planeta fuera de Broadway.",
    highlights: ["British Museum (gratis)", "Borough Market", "West End teatro", "Tower Bridge", "Notting Hill"],
    itinerary: [
      { date: "", title: "Días 1-2 — Westminster & Southbank", items: [{ time: "09:00", text: "Big Ben, Westminster Abbey, Buckingham Palace" }, { time: "14:00", text: "Southbank: Tate Modern, Millennium Bridge, Borough Market" }, { time: "Día 2", text: "British Museum (gratuito), Covent Garden, West End a la noche" }] },
      { date: "", title: "Días 3-4 — Camden & East London", items: [{ time: "Día 3", text: "Camden Market, Primrose Hill, Regent's Park" }, { time: "Día 4", text: "Shoreditch (street art), Brick Lane, Torre de Londres, Tower Bridge" }] },
      { date: "", title: "Día 5 — Notting Hill & Vuelo", items: [{ time: "10:00", text: "Portobello Market, Notting Hill" }, { time: "14:00", text: "Hyde Park, Kensington Palace, V&A Museum" }, { time: "Tarde", text: "Vuelo de regreso" }] },
    ],
    mapPlaces: [
      { name: "British Museum", lat: 51.52, lon: -0.13, note: "2 millones de objetos, entrada gratuita" },
      { name: "Tower Bridge", lat: 51.51, lon: -0.07, note: "El puente victoriano más icónico de Europa" },
      { name: "Borough Market", lat: 51.51, lon: -0.09, note: "El mercado gastronómico más famoso de Londres" },
      { name: "Tate Modern", lat: 51.51, lon: -0.10, note: "El mayor museo de arte moderno del mundo, gratis" },
      { name: "Notting Hill (Portobello)", lat: 51.51, lon: -0.20, note: "El mercado de antigüedades más famoso del mundo" },
    ],
  },
  {
    id: "barcelona", name: "Barcelona", country: "España", flag: "🇪🇸",
    costPerPerson: 680, durationDays: 5, type: "ciudad",
    description: "La ciudad que inventó el diseño como forma de vida: la Sagrada Família en construcción desde 1882, el laberinto del Barrio Gótico, las Ramblas y los mercados más animados de Europa, la playa más accesible de cualquier gran ciudad y tapas que no se encuentran en ningún otro sitio.",
    highlights: ["Sagrada Família", "Barrio Gótico", "Park Güell", "La Boquería", "Barceloneta"],
    itinerary: [
      { date: "", title: "Días 1-2 — Gótico & Born", items: [{ time: "10:00", text: "Barrio Gótico: Catedral, Plaça Reial, callejones medievales" }, { time: "15:00", text: "El Born: Mercat de Santa Caterina, Palau de la Música Catalana" }, { time: "Día 2", text: "Las Ramblas, La Boquería, Barceloneta (playa)" }] },
      { date: "", title: "Días 3-4 — Modernismo Gaudí", items: [{ time: "09:00", text: "Sagrada Família (reserva anticipada obligatoria)" }, { time: "14:00", text: "Passeig de Gràcia: Casa Batlló, Casa Milà (La Pedrera)" }, { time: "Día 4", text: "Park Güell, barrio de Gràcia, Tibidabo al atardecer" }] },
      { date: "", title: "Día 5 — Poblenou & Vuelo", items: [{ time: "10:00", text: "Poblenou: el SoHo barcelonés, mercado dominical" }, { time: "13:00", text: "Montjuïc: Fundació Miró, vistas de la ciudad" }, { time: "Tarde", text: "Vuelo de regreso" }] },
    ],
    mapPlaces: [
      { name: "Sagrada Família", lat: 41.40, lon: 2.17, note: "La obra de Gaudí en construcción desde 1882" },
      { name: "Park Güell", lat: 41.41, lon: 2.15, note: "El parque-jardín de Gaudí con vistas de la ciudad" },
      { name: "Barrio Gótico", lat: 41.38, lon: 2.18, note: "El centro medieval de Barcelona" },
      { name: "La Barceloneta", lat: 41.38, lon: 2.19, note: "La playa más famosa de Barcelona" },
      { name: "Passeig de Gràcia", lat: 41.39, lon: 2.16, note: "Casa Batlló y Casa Milà, las joyas del modernismo" },
    ],
  },
  {
    id: "seul", name: "Seúl", country: "Corea del Sur", flag: "🇰🇷",
    costPerPerson: 1600, durationDays: 7, type: "ciudad",
    description: "La capital más futurista de Asia: K-pop, K-beauty y K-food mezclados con palacios de la dinastía Joseon del siglo XIV. Una ciudad de 10 millones donde la tecnología más avanzada y la tradición milenaria conviven en la misma manzana. La ciudad más instagrameable del mundo.",
    highlights: ["Gyeongbokgung (palacio)", "Hongdae (K-pop)", "Bukchon Hanok Village", "Mercado Gwangjang", "K-beauty en Myeong-dong"],
    itinerary: [
      { date: "", title: "Días 1-2 — Palacios & Historia", items: [{ time: "09:00", text: "Gyeongbokgung Palace: cambio de guardia en traje tradicional" }, { time: "14:00", text: "Bukchon Hanok Village: casas tradicionales sobre la colina" }, { time: "Día 2", text: "Insadong, Cheonggyecheon Stream, Deoksugung Palace" }] },
      { date: "", title: "Días 3-4 — K-Pop & Modernidad", items: [{ time: "Día 3", text: "Hongdae: barrio universitario, street K-pop, cafeterías de diseño" }, { time: "Día 4", text: "Myeong-dong: el mayor paraíso del K-beauty del mundo, Namsan Tower" }] },
      { date: "", title: "Días 5-7 — Gastronomía & Vuelo", items: [{ time: "Día 5", text: "Mercado de Gwangjang: bindaetteok, mayak kimbap, yukhoe" }, { time: "Día 6", text: "Gangnam, COEX, Han River (picnic tradicional)" }, { time: "Día 7", text: "Nami Island o DMZ (zona desmilitarizada), vuelo" }] },
    ],
    mapPlaces: [
      { name: "Gyeongbokgung Palace", lat: 37.58, lon: 126.98, note: "El palacio principal de la dinastía Joseon (s. XIV)" },
      { name: "Bukchon Hanok Village", lat: 37.58, lon: 126.98, note: "Casas hanok tradicionales entre rascacielos" },
      { name: "Hongdae", lat: 37.56, lon: 126.92, note: "El barrio universitario del K-pop y la creatividad" },
      { name: "Mercado de Gwangjang", lat: 37.57, lon: 126.99, note: "El mercado de comida callejera más famoso de Seúl" },
      { name: "Namsan Tower", lat: 37.55, lon: 126.99, note: "La torre y las vistas panorámicas de Seúl" },
    ],
  },
  {
    id: "sydney", name: "Sídney", country: "Australia", flag: "🇦🇺",
    costPerPerson: 2800, durationDays: 8, type: "ciudad",
    description: "La ciudad más hermosa del hemisferio sur: la Opera House como icono del siglo XX, el puerto más espectacular del mundo, playas de surfistas a 20 minutos del CBD y una diversidad cultural que convierte cada barrio en una experiencia diferente.",
    highlights: ["Opera House (icono)", "Bondi Beach", "Harbour Bridge", "Blue Mountains", "Manly Beach"],
    itinerary: [
      { date: "", title: "Días 1-2 — Sydney Harbour", items: [{ time: "09:00", text: "Circular Quay, Opera House (tour interior)" }, { time: "14:00", text: "The Rocks: barrio histórico y mercado de fin de semana" }, { time: "Día 2", text: "Harbour Bridge Climb (experiencia única), Darling Harbour" }] },
      { date: "", title: "Días 3-4 — Bondi & Playas", items: [{ time: "Día 3", text: "Bondi Beach: surf o paseo Bondi-Coogee Coastal Walk (6km)" }, { time: "Día 4", text: "Manly Beach en ferry, Taronga Zoo (koalas, canguros)" }] },
      { date: "", title: "Días 5-6 — Blue Mountains", items: [{ time: "Días 5-6", text: "Blue Mountains: Tres Hermanas (Three Sisters), Katoomba, Jenolan Caves" }] },
      { date: "", title: "Días 7-8 — Barrio Surry Hills & Vuelo", items: [{ time: "Día 7", text: "Surry Hills (café culture), Newtown, mercado de Paddington" }, { time: "Día 8", text: "Último paseo por el puerto, vuelo de regreso" }] },
    ],
    mapPlaces: [
      { name: "Opera House (Bennelong Point)", lat: -33.86, lon: 151.21, note: "El icono del siglo XX y Patrimonio UNESCO" },
      { name: "Bondi Beach", lat: -33.89, lon: 151.27, note: "La playa de surf más famosa de Australia" },
      { name: "Harbour Bridge", lat: -33.85, lon: 151.21, note: "Se puede subir hasta la cima del arco (134m)" },
      { name: "Blue Mountains (Three Sisters)", lat: -33.73, lon: 150.31, note: "Las Tres Hermanas: la formación más fotogénica de NSW" },
      { name: "Manly Beach", lat: -33.80, lon: 151.29, note: "Playa accesible en ferry desde Circular Quay" },
    ],
  },
  {
    id: "copenhague", name: "Copenhague", country: "Dinamarca", flag: "🇩🇰",
    costPerPerson: 960, durationDays: 5, type: "ciudad",
    description: "La ciudad más feliz del mundo tiene razones: el puerto de Nyhavn con sus casas de colores, la gastronomía que inventó el New Nordic (Noma cerró pero su legado está en todas partes), el diseño danés en cada esquina y el 62% de la ciudad se mueve en bicicleta.",
    highlights: ["Nyhavn (puerto de colores)", "Tivoli Gardens", "Gastronomía New Nordic", "Louisiana Museum", "Christiania"],
    itinerary: [
      { date: "", title: "Días 1-2 — Nyhavn & Palacio", items: [{ time: "10:00", text: "Nyhavn: el puerto más fotogénico de Escandinavia" }, { time: "14:00", text: "Palacio de Amalienborg (cambio de guardia), Frederiksstaden" }, { time: "Día 2", text: "Christiansborg, Rosenborg, Jardín del Rey" }] },
      { date: "", title: "Días 3-4 — Arte & Cultura", items: [{ time: "Día 3", text: "Louisiana Museum of Modern Art: arte y mar a 45km" }, { time: "Día 4", text: "Tivoli Gardens, Strøget (la calle peatonal más larga de Europa)" }] },
      { date: "", title: "Día 5 — Christiania & Vuelo", items: [{ time: "10:00", text: "Christiania: la ciudad alternativa dentro de la ciudad" }, { time: "14:00", text: "Nørrebro: el barrio más multicultural y con mejor street food" }, { time: "Tarde", text: "Vuelo de regreso" }] },
    ],
    mapPlaces: [
      { name: "Nyhavn", lat: 55.68, lon: 12.59, note: "El puerto más colorido de Escandinavia" },
      { name: "Tivoli Gardens", lat: 55.67, lon: 12.57, note: "El parque de atracciones más antiguo del mundo (1843)" },
      { name: "Palacio Amalienborg", lat: 55.68, lon: 12.59, note: "Residencia de la familia real danesa" },
      { name: "Louisiana Museum of Modern Art", lat: 55.96, lon: 12.54, note: "Arte moderno sobre el Øresund a 45min" },
      { name: "Christiania", lat: 55.67, lon: 12.60, note: "La ciudad libre y autogestionada desde 1971" },
    ],
  },
  {
    id: "estocolmo", name: "Estocolmo", country: "Suecia", flag: "🇸🇪",
    costPerPerson: 920, durationDays: 5, type: "ciudad",
    description: "La Venecia del Norte: la capital sueca se extiende sobre 14 islas donde el lago Mälaren se encuentra con el Báltico. El Gamla Stan medieval, el Museo Vasa (el barco del siglo XVII perfectamente conservado), el ABBA Museum y la gastronomía que reinventa el smörgåsbord.",
    highlights: ["Gamla Stan (ciudad medieval)", "Museo Vasa (barco s.XVII)", "ABBA Museum", "Djurgården", "Fotografiska"],
    itinerary: [
      { date: "", title: "Días 1-2 — Gamla Stan", items: [{ time: "10:00", text: "Gamla Stan: la ciudad medieval de calles empedradas y casas de colores" }, { time: "14:00", text: "Palacio Real y Riddarholmen (isla de los nobles)" }, { time: "Día 2", text: "Museo de Historia, Östermalm Market Hall" }] },
      { date: "", title: "Días 3-4 — Djurgården", items: [{ time: "Día 3", text: "Museo Vasa: el barco de guerra del siglo XVII rescatado intacto" }, { time: "Día 4", text: "ABBA Museum, Skansen (museo al aire libre), Gröna Lund" }] },
      { date: "", title: "Día 5 — Södermalm & Vuelo", items: [{ time: "10:00", text: "Södermalm: el barrio más hipster, Fotografiska, Mariatorget" }, { time: "13:00", text: "Drottningholm (palacio UNESCO), a 30min en barco" }, { time: "Tarde", text: "Vuelo de regreso" }] },
    ],
    mapPlaces: [
      { name: "Gamla Stan", lat: 59.32, lon: 18.07, note: "El centro medieval de Estocolmo, s. XIII" },
      { name: "Museo Vasa", lat: 59.33, lon: 18.09, note: "El barco de guerra del s. XVII rescatado del fondo del mar" },
      { name: "ABBA Museum (Djurgården)", lat: 59.33, lon: 18.09, note: "El museo más visitado de Suecia" },
      { name: "Fotografiska", lat: 59.32, lon: 18.08, note: "Uno de los mejores museos de fotografía del mundo" },
      { name: "Palacio Drottningholm", lat: 59.32, lon: 17.89, note: "Patrimonio UNESCO, a 30min en barco" },
    ],
  },
  {
    id: "hong-kong", name: "Hong Kong", country: "China (RAE)", flag: "🇭🇰",
    costPerPerson: 1850, durationDays: 6, type: "ciudad",
    description: "El skyline más denso del planeta: rascacielos sobre rascacielos vistos desde el Victoria Peak, el tranvía de dos pisos por la isla, mercados nocturnos en Mong Kok y una gastronomía cantonesa que es la más refinada de todo el sudeste asiático.",
    highlights: ["Victoria Peak (skyline nocturno)", "Temple Street Night Market", "Dim sum en Mong Kok", "Star Ferry", "Big Buddha (Lantau)"],
    itinerary: [
      { date: "", title: "Días 1-2 — Hong Kong Island", items: [{ time: "09:00", text: "Peak Tram + Victoria Peak: el skyline más impresionante del mundo" }, { time: "14:00", text: "Central: HSBC Building, Escaleras de Mid-Levels" }, { time: "Día 2", text: "Star Ferry a Kowloon, tranvía histórico por la isla, Wan Chai" }] },
      { date: "", title: "Días 3-4 — Kowloon", items: [{ time: "Día 3", text: "Temple Street Night Market, Mong Kok (mercado de pájaros, de flores)" }, { time: "Día 4", text: "Tsim Sha Tsui, Museo de Historia, Sinfónica de luces al atardecer" }] },
      { date: "", title: "Días 5-6 — Lantau & Vuelo", items: [{ time: "Día 5", text: "Cable car a Ngong Ping: Big Buddha (34m), Monasterio Po Lin" }, { time: "Día 6", text: "Tai O (pueblo de palafitos), vuelo de regreso" }] },
    ],
    mapPlaces: [
      { name: "Victoria Peak", lat: 22.28, lon: 114.14, note: "El mejor skyline nocturno del mundo" },
      { name: "Star Ferry", lat: 22.29, lon: 114.17, note: "El transbordador más icónico de Asia" },
      { name: "Temple Street Night Market", lat: 22.31, lon: 114.17, note: "El mercado nocturno más famoso de Kowloon" },
      { name: "Big Buddha (Lantau)", lat: 22.25, lon: 113.90, note: "El Buda de bronce más grande del mundo al aire libre" },
      { name: "Wong Tai Sin Temple", lat: 22.34, lon: 114.19, note: "El templo más visitado de Hong Kong" },
    ],
  },
  {
    id: "milan", name: "Milán", country: "Italia", flag: "🇮🇹",
    costPerPerson: 830, durationDays: 4, type: "ciudad",
    description: "La capital mundial del diseño y la moda: el Duomo más elaborado de Italia, La Última Cena de Leonardo da Vinci (reserva con meses de antelación), el Quadrilatero della Moda para mirar aunque no compres y la aperitivo más generosa del mundo como institución social.",
    highlights: ["Duomo de Milán", "La Última Cena (da Vinci)", "Quadrilatero della Moda", "Aperitivo milanés", "Lago de Como"],
    itinerary: [
      { date: "", title: "Días 1-2 — Duomo & Centro", items: [{ time: "09:00", text: "Duomo de Milán: subir a la terraza (vistas de los Alpes con nieve)" }, { time: "14:00", text: "Galleria Vittorio Emanuele II, Scala, Palazzo Reale" }, { time: "Día 2", text: "La Última Cena (reserva imprescindible), Santa Maria delle Grazie" }] },
      { date: "", title: "Día 3 — Navigli & Moda", items: [{ time: "10:00", text: "Castello Sforzesco, Parco Sempione" }, { time: "14:00", text: "Quadrilatero della Moda: Via Montenapoleone, Via della Spiga" }, { time: "19:00", text: "Aperitivo en Navigli (buffet incluido en el precio de la copa)" }] },
      { date: "", title: "Día 4 — Como & Vuelo", items: [{ time: "08:00", text: "Tren a Lago de Como: Bellagio, Varenna, paseo en barco" }, { time: "18:00", text: "Vuelo de regreso desde Milán Malpensa" }] },
    ],
    mapPlaces: [
      { name: "Duomo de Milán", lat: 45.46, lon: 9.19, note: "La catedral gótica con 3.400 estatuas y 135 agujas" },
      { name: "Santa Maria delle Grazie (La Última Cena)", lat: 45.47, lon: 9.17, note: "El fresco de Leonardo da Vinci de 1498" },
      { name: "Castello Sforzesco", lat: 45.47, lon: 9.18, note: "El castillo ducal del siglo XV" },
      { name: "Navigli", lat: 45.45, lon: 9.18, note: "El barrio de los canales, centro del aperitivo milanés" },
      { name: "Bellagio (Lago de Como)", lat: 45.99, lon: 9.26, note: "El pueblo más bonito del lago más bonito de Italia" },
    ],
  },
  // ── Playa ─────────────────────────────────────────────────────────────────
  {
    id: "creta", name: "Creta", country: "Grecia", flag: "🇬🇷",
    costPerPerson: 700, durationDays: 7, type: "playa",
    description: "La isla más grande de Grecia lo tiene todo: playas de arena rosada, el Palacio de Cnosos (la civilización más antigua de Europa), el trek de la Garganta de Samaria (el más famoso de Grecia) y la cocina cretense más sabrosa del Mediterráneo oriental.",
    highlights: ["Balos Lagoon (agua turquesa)", "Garganta de Samaria", "Cnosos (palacio minoico)", "Playa Elafonisi (arena rosada)", "Gastronomía cretense"],
    itinerary: [
      { date: "", title: "Días 1-2 — Heraklion & Cnosos", items: [{ time: "09:00", text: "Palacio de Cnosos: la civilización minoica hace 4.000 años" }, { time: "14:00", text: "Ciudad Veneciana de Heraklion: murallas, loggia, arsenales" }, { time: "Día 2", text: "Museo Arqueológico de Heraklion (el mejor de Grecia)" }] },
      { date: "", title: "Días 3-4 — Chania & Balos", items: [{ time: "Día 3", text: "Chania: el puerto veneciano más bonito del Mediterráneo" }, { time: "Día 4", text: "Laguna de Balos: agua tricolor turquesa-rosa-verde en el extremo de Creta" }] },
      { date: "", title: "Días 5-6 — Samaria & Elafonisi", items: [{ time: "Día 5", text: "Garganta de Samaria (16km, 5-6h): el cañón más espectacular de Grecia" }, { time: "Día 6", text: "Playa Elafonisi: arena rosada por algas calcáreas, laguna poco profunda" }] },
      { date: "", title: "Día 7 — Rethymno & Vuelo", items: [{ time: "10:00", text: "Rethymno: ciudad veneciana y otomana en equilibrio perfecto" }, { time: "Tarde", text: "Vuelo de regreso" }] },
    ],
    mapPlaces: [
      { name: "Palacio de Cnosos", lat: 35.30, lon: 25.16, note: "El mayor centro de la civilización minoica (s. XVIII a.C.)" },
      { name: "Laguna de Balos", lat: 35.60, lon: 23.61, note: "Agua tricolor en el extremo noroeste de Creta" },
      { name: "Playa Elafonisi", lat: 35.27, lon: 23.53, note: "Arena rosada por algas calcáreas, laguna tropical" },
      { name: "Chania (Puerto Veneciano)", lat: 35.52, lon: 24.02, note: "El puerto más fotogénico de Grecia" },
      { name: "Garganta de Samaria", lat: 35.24, lon: 23.97, note: "El trek más famoso de Grecia, 16km de cañón" },
    ],
  },
  {
    id: "corfu", name: "Corfú", country: "Grecia", flag: "🇬🇷",
    costPerPerson: 590, durationDays: 6, type: "playa",
    description: "La joya jónica: la isla más verde de Grecia, con playas de aguas verde esmeralda, un casco antiguo veneciano Patrimonio UNESCO y esa sensación de isla griega perfecta sin el agobio ni el precio de Mykonos. Accesible desde España por menos de 100€ de vuelo.",
    highlights: ["Ciudad Vieja de Corfú (UNESCO)", "Paleokastritsa", "Canal d'Amour", "Palacio Achilleion", "Playa Glyfada"],
    itinerary: [
      { date: "", title: "Días 1-2 — Ciudad de Corfú", items: [{ time: "10:00", text: "Ciudad Vieja: Liston, Spianada, Fortaleza Vieja Veneciana" }, { time: "14:00", text: "Callejones encalados del centro histórico UNESCO" }, { time: "Día 2", text: "Palacio Achilleion: villa de la Emperatriz Sissi con vistas al mar" }] },
      { date: "", title: "Días 3-4 — Norte Verde", items: [{ time: "Día 3", text: "Paleokastritsa: monasterio y cuevas en acantilados sobre el mar" }, { time: "Día 4", text: "Canal d'Amour en Sidari: estrecho de roca entre dos playas" }] },
      { date: "", title: "Días 5-6 — Playas del Sur & Vuelo", items: [{ time: "Días 5-6", text: "Glyfada, Agios Gordios, Kavos: las mejores playas del sur de la isla, vuelo" }] },
    ],
    mapPlaces: [
      { name: "Ciudad Vieja de Corfú", lat: 39.62, lon: 19.92, note: "Patrimonio UNESCO de arquitectura veneciana" },
      { name: "Paleokastritsa", lat: 39.67, lon: 19.71, note: "Cuevas azules y monasterio sobre el mar" },
      { name: "Canal d'Amour (Sidari)", lat: 39.79, lon: 19.72, note: "Estrecho natural de roca entre dos calas" },
      { name: "Palacio Achilleion", lat: 39.56, lon: 19.90, note: "Villa de la emperatriz Sissi convertida en museo" },
      { name: "Playa Glyfada", lat: 39.60, lon: 19.80, note: "La playa de arena más bonita de Corfú" },
    ],
  },
  {
    id: "cerdena", name: "Cerdeña", country: "Italia", flag: "🇮🇹",
    costPerPerson: 690, durationDays: 6, type: "playa",
    description: "La segunda isla más grande del Mediterráneo tiene aguas que rivalizan con el Caribe: la Costa Smeralda en tonos verde esmeralda, las cuevas de Neptuno solo accesibles por mar, las nuraghe prehistóricas únicas en el mundo y una gastronomía tan diferente de la italiana que parece otro país.",
    highlights: ["Costa Smeralda", "Cala Goloritzé", "Cuevas de Neptuno", "Nuraghe Su Nuraxi (UNESCO)", "Gastronomía sarda"],
    itinerary: [
      { date: "", title: "Días 1-2 — Cagliari & Sur", items: [{ time: "Día 1", text: "Cagliari: Bastione di Saint Remy, mercado de San Benedetto" }, { time: "Día 2", text: "Costa del Sur: Villasimius, Cala Brandinchi (el Caribe sardo)" }] },
      { date: "", title: "Días 3-4 — Costa Smeralda", items: [{ time: "Días 3-4", text: "Costa Smeralda: Porto Cervo, Cala di Volpe, Romazzino — agua verde irreal" }] },
      { date: "", title: "Días 5-6 — Oristano & Vuelo", items: [{ time: "Día 5", text: "Cala Goloritzé (solo en barco o trek de 2h): la cala más espectacular de Italia" }, { time: "Día 6", text: "Nuraghe Su Nuraxi (UNESCO), Alghero (ciudad catalana en Cerdeña), vuelo" }] },
    ],
    mapPlaces: [
      { name: "Cala Goloritzé", lat: 40.12, lon: 9.62, note: "La cala más espectacular de Italia, solo en barco" },
      { name: "Costa Smeralda (Porto Cervo)", lat: 41.12, lon: 9.52, note: "Aguas verde esmeralda de la costa más exclusiva de Italia" },
      { name: "Cuevas de Neptuno (Alghero)", lat: 40.57, lon: 8.16, note: "Las cuevas marinas solo accesibles por mar" },
      { name: "Nuraghe Su Nuraxi", lat: 39.83, lon: 9.00, note: "Torre prehistórica única en el mundo, UNESCO" },
      { name: "Villasimius (Costa del Sur)", lat: 39.09, lon: 9.51, note: "El Caribe sardo: agua turquesa y arena blanca" },
    ],
  },
  {
    id: "tailandia-islas", name: "Tailandia: Islas", country: "Tailandia", flag: "🇹🇭",
    costPerPerson: 1100, durationDays: 8, type: "playa",
    description: "Las islas del sur de Tailandia son la definición de paraíso tropical: acantilados de piedra caliza emergiendo del mar turquesa, playas de arena blanca fina, snorkel entre peces de colores y el mejor street food de Asia entre sesión y sesión de playa.",
    highlights: ["Phi Phi Islands", "Railay Beach (Krabi)", "Koh Tao (buceo)", "Koh Phangan", "Snorkel en aguas turquesa"],
    itinerary: [
      { date: "", title: "Días 1-2 — Bangkok & Vuelo Sur", items: [{ time: "Día 1", text: "Bangkok: Wat Pho, mercado flotante de Damnoen Saduak" }, { time: "Día 2", text: "Vuelo a Krabi o Phuket, instalación en resort" }] },
      { date: "", title: "Días 3-4 — Krabi & Railay", items: [{ time: "Día 3", text: "Railay Beach: la playa solo accesible en barco, escalada en roca" }, { time: "Día 4", text: "Four Islands Tour: snorkel entre corales, playa Poda" }] },
      { date: "", title: "Días 5-6 — Phi Phi", items: [{ time: "Días 5-6", text: "Phi Phi Islands: Maya Bay (La Playa de la película), snorkel con tiburones bebe" }] },
      { date: "", title: "Días 7-8 — Koh Tao & Vuelo", items: [{ time: "Días 7-8", text: "Koh Tao: el mejor buceo accesible de Asia, PADI en 3 días, vuelo Bangkok" }] },
    ],
    mapPlaces: [
      { name: "Railay Beach (Krabi)", lat: 8.01, lon: 98.83, note: "Playa solo accesible en barco entre acantilados" },
      { name: "Phi Phi Islands (Maya Bay)", lat: 7.68, lon: 98.77, note: "El paraíso isleño de la película The Beach" },
      { name: "Koh Tao", lat: 10.10, lon: 99.84, note: "El mejor buceo accesible de toda Asia" },
      { name: "Koh Samui", lat: 9.53, lon: 100.06, note: "La isla más grande del sur de Tailandia" },
      { name: "Patong Beach (Phuket)", lat: 7.90, lon: 98.29, note: "La playa más animada del sur de Tailandia" },
    ],
  },
  {
    id: "republica-dominicana", name: "Rep. Dominicana", country: "Rep. Dominicana", flag: "🇩🇴",
    costPerPerson: 1200, durationDays: 9, type: "playa",
    description: "El Caribe clásico: Punta Cana con 48km de playa de arena blanca, la Zona Colonial de Santo Domingo (la primera ciudad europea del Nuevo Mundo, UNESCO), las ballenas jorobadas de Samaná y el ritmo de merengue y bachata como banda sonora constante.",
    highlights: ["Punta Cana (48km playa)", "Zona Colonial Santo Domingo (UNESCO)", "Samaná (ballenas jorobadas)", "Los Haitises", "Todo incluido de calidad"],
    itinerary: [
      { date: "", title: "Días 1-3 — Punta Cana", items: [{ time: "Días 1-3", text: "Resort todo incluido en Punta Cana: catamaran, parasailing, snorkel en Isla Saona" }] },
      { date: "", title: "Días 4-5 — Santo Domingo", items: [{ time: "Día 4", text: "Santo Domingo: Zona Colonial (la primera calle, la primera catedral, el primer hospital del Nuevo Mundo)" }, { time: "Día 5", text: "Alcázar de Colón, Fortaleza Ozama, barrio Ciudad Nueva" }] },
      { date: "", title: "Días 6-8 — Samaná", items: [{ time: "Días 6-8", text: "Samaná: avistamiento de ballenas jorobadas (ene-mar) o Cascada El Limón, Las Galeras" }] },
      { date: "", title: "Día 9 — Las Terrenas & Vuelo", items: [{ time: "Día 9", text: "Las Terrenas: la playa más chic del Caribe dominicano, vuelo" }] },
    ],
    mapPlaces: [
      { name: "Punta Cana (Bávaro)", lat: 18.68, lon: -68.44, note: "48km de playa de arena blanca" },
      { name: "Santo Domingo (Zona Colonial)", lat: 18.47, lon: -69.89, note: "La primera ciudad europea del Nuevo Mundo, UNESCO" },
      { name: "Samaná (Ballenas)", lat: 19.21, lon: -69.33, note: "Avistamiento de ballenas jorobadas ene-mar" },
      { name: "Isla Saona", lat: 18.04, lon: -68.71, note: "La isla más paradisíaca del Caribe dominicano" },
      { name: "Las Terrenas", lat: 19.31, lon: -69.53, note: "La playa más cosmopolita del norte" },
    ],
  },
  {
    id: "mykonos", name: "Mykonos", country: "Grecia", flag: "🇬🇷",
    costPerPerson: 1350, durationDays: 6, type: "playa",
    description: "La reina de las Cícladas: calles encaladas de blanco cegador, molinos de viento que parecen pintados, las mejores fiestas de playa de Europa en Paradise y Super Paradise y la gastronomía más instagrameable del Mediterráneo. La isla que nunca duerme.",
    highlights: ["Chora (pueblo blanco)", "Molinos de viento icónicos", "Paradise Beach", "Delos (isla sagrada)", "Little Venice al atardecer"],
    itinerary: [
      { date: "", title: "Días 1-2 — Chora", items: [{ time: "10:00", text: "Chora: callejones encalados, laberinto anti-piratas" }, { time: "15:00", text: "Molinos de Kato Mili: las 16 aspas del icono de Mykonos" }, { time: "19:00", text: "Little Venice: cócteles sobre el mar al atardecer" }] },
      { date: "", title: "Días 3-4 — Playas", items: [{ time: "Día 3", text: "Paradise Beach y Super Paradise: beach clubs con DJ hasta la madrugada" }, { time: "Día 4", text: "Playa Elia (la más larga y tranquila), Agios Sostis" }] },
      { date: "", title: "Días 5-6 — Delos & Vuelo", items: [{ time: "Día 5", text: "Delos: la isla sagrada de Apolo, sin hoteles, solo ruinas del s. VIII a.C." }, { time: "Día 6", text: "Último día de playa, vuelo de regreso" }] },
    ],
    mapPlaces: [
      { name: "Chora (Mykonos Town)", lat: 37.45, lon: 25.33, note: "El laberinto de callejones blancos" },
      { name: "Molinos de Viento (Kato Mili)", lat: 37.44, lon: 25.32, note: "Los 16 molinos icónicos de Mykonos" },
      { name: "Paradise Beach", lat: 37.41, lon: 25.33, note: "La fiesta de playa más famosa de Europa" },
      { name: "Delos", lat: 37.40, lon: 25.27, note: "Isla sagrada de Apolo, arqueología del s. VIII a.C." },
      { name: "Little Venice", lat: 37.45, lon: 25.32, note: "Casas sobre el mar — atardecer más fotografiado de las Cícladas" },
    ],
  },
  {
    id: "bora-bora", name: "Bora Bora", country: "Polinesia Francesa", flag: "🇵🇫",
    costPerPerson: 4500, durationDays: 8, type: "playa",
    description: "La laguna más fotografiada del mundo: agua en 12 tonos de turquesa rodeando el volcán dormido del Monte Otemanu, bungalows sobre el agua con suelo transparente, buceo con tiburones de arrecife sin jaula y el silencio absoluto del Pacífico Sur. El lujo en su forma más natural.",
    highlights: ["Lagoon en 12 tonos de azul", "Bungalows sobre el agua", "Tiburones y mantarrayas sin jaula", "Monte Otemanu", "Puesta de sol sobre el Pacífico"],
    itinerary: [
      { date: "", title: "Días 1-2 — Llegada & Lagoon", items: [{ time: "Día 1", text: "Llegada, resort sobre el agua, primer baño en el lagoon" }, { time: "Día 2", text: "Snorkel guiado con tiburones nodriza y mantarrayas" }] },
      { date: "", title: "Días 3-4 — Aventura en el Agua", items: [{ time: "Día 3", text: "Buceo en el paso de las mantarrayas y tiburones grises" }, { time: "Día 4", text: "Safari 4x4 por la isla: Monte Otemanu, vistas del lagoon" }] },
      { date: "", title: "Días 5-6 — Motu Tapu", items: [{ time: "Días 5-6", text: "Picnic en Motu Tapu (el islote más bonito): playa desierta exclusiva" }] },
      { date: "", title: "Días 7-8 — Relax & Vuelo", items: [{ time: "Días 7-8", text: "Kayak al atardecer por el lagoon, spa, vuelo vía Papeete" }] },
    ],
    mapPlaces: [
      { name: "Lagoon de Bora Bora", lat: -16.51, lon: -151.74, note: "La laguna más fotografiada del mundo" },
      { name: "Monte Otemanu", lat: -16.51, lon: -151.74, note: "El volcán dormido de 727m que corona la isla" },
      { name: "Matira Beach", lat: -16.55, lon: -151.74, note: "La única playa pública de Bora Bora" },
      { name: "Motu Tapu", lat: -16.49, lon: -151.72, note: "Islote desierto con las aguas más claras de Polinesia" },
      { name: "Paso Teavanui (Buceo)", lat: -16.47, lon: -151.79, note: "El mejor punto de buceo con tiburones y mantarrayas" },
    ],
  },
  // ── Naturaleza ────────────────────────────────────────────────────────────
  {
    id: "canada-rockies", name: "Canadá: Rocosas", country: "Canadá", flag: "🇨🇦",
    costPerPerson: 2900, durationDays: 10, type: "naturaleza",
    description: "Las montañas más espectaculares de Norteamérica: el Lago Louise con un color esmeralda que parece artificial, el Icefield Parkway (la carretera más bonita del mundo) con glaciares a ambos lados y osos grizzly que cruzan la carretera con total impunidad.",
    highlights: ["Lago Louise (esmeralda irreal)", "Icefield Parkway", "Banff NP", "Jasper NP", "Lago Moraine"],
    itinerary: [
      { date: "", title: "Días 1-2 — Calgary & Banff", items: [{ time: "Día 1", text: "Llegada a Calgary, conducción a Banff (90 min)" }, { time: "Día 2", text: "Banff: Sulfur Mountain Gondola, cascadas Bow Falls" }] },
      { date: "", title: "Días 3-4 — Lago Louise & Moraine", items: [{ time: "Día 3", text: "Lago Louise: el lago esmeralda más fotografiado del mundo" }, { time: "Día 4", text: "Lago Moraine: aguas azul-turquesa entre 10 picos nevados" }] },
      { date: "", title: "Días 5-7 — Icefield Parkway", items: [{ time: "Días 5-7", text: "Icefield Parkway: Columbia Icefield (paseo en vehículo sobre el glaciar), Peyto Lake, Athabasca Falls" }] },
      { date: "", title: "Días 8-10 — Jasper & Vuelo", items: [{ time: "Días 8-9", text: "Jasper: Maligne Lake, Spirit Island, Miette Hot Springs" }, { time: "Día 10", text: "Vuelo desde Edmonton o Calgary" }] },
    ],
    mapPlaces: [
      { name: "Lago Louise", lat: 51.42, lon: -116.22, note: "El lago esmeralda más fotografiado de Canadá" },
      { name: "Lago Moraine", lat: 51.32, lon: -116.18, note: "10 picos nevados reflejados en agua azul turquesa" },
      { name: "Columbia Icefield (Banff NP)", lat: 52.22, lon: -117.23, note: "Campo de hielo de 325 km² — paseo en vehículo especializado" },
      { name: "Peyto Lake", lat: 51.72, lon: -116.54, note: "Lago con forma de zorro de color turquesa intenso" },
      { name: "Maligne Lake (Jasper)", lat: 52.72, lon: -117.63, note: "Spirit Island: la isla más fotografiada de Canadá" },
    ],
  },
  {
    id: "azores", name: "Azores", country: "Portugal", flag: "🇵🇹",
    costPerPerson: 760, durationDays: 6, type: "naturaleza",
    description: "El secreto mejor guardado de Europa: nueve islas volcánicas en el Atlántico con géiseres entre campos de hortensias, lagos de dos colores en cráteres extintos, avistamiento de 24 especies de cetáceos y baños en termas geotérmicas. A 2h30 de Lisboa.",
    highlights: ["Sete Cidades (lago bicolor)", "Avistamiento de cetáceos (24 especies)", "Cocido en la tierra (Furnas)", "Flyboard en el Atlántico", "Senderismo Pico"],
    itinerary: [
      { date: "", title: "Días 1-2 — São Miguel: Sete Cidades", items: [{ time: "Día 1", text: "Llegada a Ponta Delgada, Sete Cidades: laguna azul y verde en cráter volcánico" }, { time: "Día 2", text: "Furnas: géiseres, termas calientes, cocido cozinhado no chão (underground)" }] },
      { date: "", title: "Días 3-4 — Cetáceos & Pico", items: [{ time: "Día 3", text: "Avistamiento de cetáceos: delfines, cachalotes, ballenas azules (según temporada)" }, { time: "Día 4", text: "Isla Pico: subida al Pico (2.351m, el más alto de Portugal)" }] },
      { date: "", title: "Días 5-6 — Flores & Vuelo", items: [{ time: "Día 5", text: "Flores: la isla más verde, Pozo da Alagoinha, cascadas" }, { time: "Día 6", text: "Horta (Faial): puerto de veleros, Caldeira, vuelo" }] },
    ],
    mapPlaces: [
      { name: "Sete Cidades (São Miguel)", lat: 37.83, lon: -25.78, note: "Laguna bicolor azul-verde en cráter volcánico" },
      { name: "Furnas (Géiseres)", lat: 37.77, lon: -25.31, note: "Cocido bajo tierra por calor volcánico" },
      { name: "Monte Pico", lat: 38.47, lon: -28.40, note: "El volcán activo más alto de Portugal (2.351m)" },
      { name: "Caldeira de Faial", lat: 38.59, lon: -28.71, note: "Cráter volcánico de 2km de diámetro" },
      { name: "Horta (Marina)", lat: 38.53, lon: -28.63, note: "El puerto de referencia de los veleros del Atlántico" },
    ],
  },
  {
    id: "madeira", name: "Madeira", country: "Portugal", flag: "🇵🇹",
    costPerPerson: 560, durationDays: 5, type: "naturaleza",
    description: "La isla de la eterna primavera: las levadas (canales de irrigación del siglo XV) forman la red de senderismo más única del mundo, los acantilados de 580m del Cabo Girão son los más altos de Europa y las flores que no conocen el invierno hacen de la isla un jardín botánico natural.",
    highlights: ["Senderismo levadas", "Cabo Girão (580m acantilado)", "Pico Ruivo (cima)", "Funchal (mercado & casino)", "Mirador Pico do Areeiro"],
    itinerary: [
      { date: "", title: "Días 1-2 — Funchal", items: [{ time: "Día 1", text: "Funchal: Mercado dos Lavradores, teleférico al Monte, Jardín Botánico" }, { time: "Día 2", text: "Poncha y bolo do caco, toboganes de cesto del Monte" }] },
      { date: "", title: "Día 3 — Levada do Caldeirão", items: [{ time: "08:00", text: "Levada do Caldeirão Verde: 14km entre laurisilva y túneles" }, { time: "15:00", text: "Llegada a la cascada secreta en el interior de la montaña" }] },
      { date: "", title: "Día 4 — Pico do Areeiro → Ruivo", items: [{ time: "07:00", text: "Pico do Areeiro (1.818m): amanecer sobre las nubes" }, { time: "10:00", text: "Trek Areeiro → Pico Ruivo (1.862m): el techo de Madeira" }] },
      { date: "", title: "Día 5 — Cabo Girão & Vuelo", items: [{ time: "09:00", text: "Cabo Girão: la plataforma de cristal sobre 580m de acantilado" }, { time: "12:00", text: "Câmara de Lobos (el favorito de Churchill), vuelo" }] },
    ],
    mapPlaces: [
      { name: "Cabo Girão", lat: 32.64, lon: -17.01, note: "El acantilado más alto de Europa (580m), plataforma de cristal" },
      { name: "Pico Ruivo", lat: 32.75, lon: -16.94, note: "El punto más alto de Madeira (1.862m)" },
      { name: "Funchal (Mercado dos Lavradores)", lat: 32.65, lon: -16.91, note: "El mercado más colorido de Portugal" },
      { name: "Pico do Areeiro", lat: 32.74, lon: -16.93, note: "Amanecer sobre las nubes a 1.818m" },
      { name: "Levada do Caldeirão Verde", lat: 32.78, lon: -16.98, note: "La ruta de levada más espectacular de Madeira" },
    ],
  },
  {
    id: "suiza-alpes", name: "Suiza: Alpes", country: "Suiza", flag: "🇨🇭",
    costPerPerson: 1400, durationDays: 7, type: "naturaleza",
    description: "Los Alpes perfectamente organizados: el tren cogwheel que sube al Jungfraujoch (3.454m, el techo de Europa), el Matterhorn reflejado en el lago de Zermatt al atardecer, el Glacier Express cruzando 291 puentes entre montañas nevadas. La naturaleza más accesible del mundo.",
    highlights: ["Jungfraujoch (3.454m techo de Europa)", "Matterhorn (Zermatt)", "Glacier Express", "Lago de Lucerna", "Grindelwald"],
    itinerary: [
      { date: "", title: "Días 1-2 — Interlaken & Grindelwald", items: [{ time: "Día 1", text: "Llegada a Interlaken: entre el Lago Thun y el Brienz" }, { time: "Día 2", text: "Grindelwald: senderismo con vistas al Eiger, Mönch y Jungfrau" }] },
      { date: "", title: "Días 3-4 — Jungfraujoch", items: [{ time: "Día 3", text: "Jungfraujoch: el techo de Europa a 3.454m, meseta glaciar" }, { time: "Día 4", text: "Lauterbrunnen: 72 cascadas en un valle vertical" }] },
      { date: "", title: "Días 5-6 — Zermatt", items: [{ time: "Días 5-6", text: "Zermatt: Matterhorn al atardecer, sin coches, teleférico al Klein Matterhorn (3.883m)" }] },
      { date: "", title: "Día 7 — Lucerna & Vuelo", items: [{ time: "Día 7", text: "Lucerna: Puente de la Capilla (1333), lago y vuelo" }] },
    ],
    mapPlaces: [
      { name: "Jungfraujoch (Grindelwald)", lat: 46.55, lon: 7.98, note: "El techo de Europa a 3.454m, glacier eterno" },
      { name: "Matterhorn (Zermatt)", lat: 45.98, lon: 7.66, note: "El pico más icónico del mundo (4.478m)" },
      { name: "Lauterbrunnen", lat: 46.59, lon: 7.91, note: "El valle con 72 cascadas — inspiración de Tolkien" },
      { name: "Glacier Express (Ruta)", lat: 46.62, lon: 8.05, note: "El tren más lento del mundo — el más bonito" },
      { name: "Lucerna (Puente de la Capilla)", lat: 47.05, lon: 8.31, note: "El puente de madera cubierto más antiguo de Europa (1333)" },
    ],
  },
  {
    id: "australia", name: "Australia", country: "Australia", flag: "🇦🇺",
    costPerPerson: 3300, durationDays: 10, type: "naturaleza",
    description: "El continente-país más biodiverso: la Gran Barrera de Coral (el mayor organismo vivo de la Tierra con 2.900 arrecifes), el desierto rojo de Uluru que cambia de naranja a morado según la hora, koalas en eucaliptos y los 12 Apóstoles sobre el Índico.",
    highlights: ["Gran Barrera de Coral", "Uluru (Ayers Rock)", "Koalas & canguros", "The Great Ocean Road", "Whitsunday Islands"],
    itinerary: [
      { date: "", title: "Días 1-2 — Sídney", items: [{ time: "Días 1-2", text: "Sídney: Opera House, Bondi Beach, Harbour Bridge (ver destino ciudad)" }] },
      { date: "", title: "Días 3-5 — Gran Barrera de Coral", items: [{ time: "Días 3-5", text: "Cairns: buceo o snorkel en la Gran Barrera de Coral, Daintree Rainforest" }] },
      { date: "", title: "Días 6-7 — Uluru", items: [{ time: "Días 6-7", text: "Uluru: amanecer sobre Ayers Rock (color naranja), Kata Tjuta (Monte Olga)" }] },
      { date: "", title: "Días 8-10 — Melbourne & Great Ocean Road", items: [{ time: "Día 8", text: "Melbourne: Queen Victoria Market, barrio de Fitzroy" }, { time: "Días 9-10", text: "Great Ocean Road: 12 Apóstoles, Loch Ard Gorge, Phillip Island (pingüinos), vuelo" }] },
    ],
    mapPlaces: [
      { name: "Gran Barrera de Coral (Cairns)", lat: -16.92, lon: 145.78, note: "El mayor organismo vivo de la Tierra (2.900 arrecifes)" },
      { name: "Uluru (Ayers Rock)", lat: -25.35, lon: 131.04, note: "El monolito sagrado en el corazón de Australia" },
      { name: "12 Apóstoles (Great Ocean Road)", lat: -38.66, lon: 143.10, note: "Pilares de roca caliza sobre el Océano Índico" },
      { name: "Phillip Island (Pingüinos)", lat: -38.47, lon: 145.24, note: "El desfile de pingüinos más grande del hemisferio sur" },
      { name: "Whitsunday Islands", lat: -20.27, lon: 148.99, note: "74 islas tropicales en el corazón de la Gran Barrera" },
    ],
  },
  // ── Cultura ───────────────────────────────────────────────────────────────
  {
    id: "china", name: "China: Pekín & Xi'an", country: "China", flag: "🇨🇳",
    costPerPerson: 1800, durationDays: 10, type: "cultura",
    description: "La civilización más antigua e ininterrumpida del mundo: la Ciudad Prohibida que albergó 24 emperadores, la Gran Muralla que serpentea 21.000km, el Ejército de Terracota (8.000 soldados enterrados hace 2.200 años) y la cocina de Pekín y Sichuan que todo lo cambia.",
    highlights: ["Gran Muralla (Mutianyu)", "Ciudad Prohibida", "Ejército de Terracota (Xi'an)", "Templo del Cielo", "Barrio Hutong"],
    itinerary: [
      { date: "", title: "Días 1-2 — Pekín: Centro Histórico", items: [{ time: "09:00", text: "Plaza Tiananmen, Ciudad Prohibida (la mayor colección del mundo)" }, { time: "15:00", text: "Templo del Cielo, Parque Jingshan (vista aérea de la Ciudad Prohibida)" }] },
      { date: "", title: "Días 3-4 — Gran Muralla & Hutong", items: [{ time: "Día 3", text: "Gran Muralla: sección Mutianyu (la más espectacular, sin masas)" }, { time: "Día 4", text: "Barrio Hutong: rickshaw tour, Palacio de Verano" }] },
      { date: "", title: "Días 5-6 — Xi'an", items: [{ time: "Día 5", text: "Vuelo a Xi'an: Ejército de Terracota (Mausoleo de Qin Shi Huang)" }, { time: "Día 6", text: "Muralla de Xi'an en bicicleta, Barrio Muslim (baozi, yangrou paomo)" }] },
      { date: "", title: "Días 7-8 — Shanghái (opcional)", items: [{ time: "Días 7-8", text: "Shanghái: el Bund (skyline de Pudong), Yuyuan Garden, barrio francés" }] },
      { date: "", title: "Días 9-10 — Gastronomía & Vuelo", items: [{ time: "Días 9-10", text: "Hot pot de Sichuan, dim sum cantonés, mercado nocturno, vuelo" }] },
    ],
    mapPlaces: [
      { name: "Ciudad Prohibida (Pekín)", lat: 39.92, lon: 116.39, note: "980 edificios, 24 emperadores, 600 años de historia" },
      { name: "Gran Muralla (Mutianyu)", lat: 40.44, lon: 116.56, note: "La sección más espectacular y menos masificada" },
      { name: "Ejército de Terracota (Xi'an)", lat: 34.38, lon: 109.27, note: "8.000 soldados de terracota de hace 2.200 años" },
      { name: "Templo del Cielo (Pekín)", lat: 39.88, lon: 116.41, note: "Donde el Hijo del Cielo comunicaba con el Cielo" },
      { name: "El Bund (Shanghái)", lat: 31.24, lon: 121.49, note: "El skyline más espectacular de Asia" },
    ],
  },
  {
    id: "corea-sur", name: "Corea del Sur", country: "Corea del Sur", flag: "🇰🇷",
    costPerPerson: 1550, durationDays: 8, type: "cultura",
    description: "El milagro asiático: en 60 años pasó de ser uno de los países más pobres del mundo a liderar el K-pop y la innovación tecnológica, con palacios de la dinastía Joseon del siglo XIV, una cocina (kimchi, bibimbap, galbi) cada vez más reconocida y una cultura de cafeterías de diseño inigualable.",
    highlights: ["Gyeongbokgung (palacio s.XIV)", "Jeju Island", "Templo Bulguksa", "K-food: bibimbap y BBQ", "Bukchon Hanok Village"],
    itinerary: [
      { date: "", title: "Días 1-3 — Seúl", items: [{ time: "Días 1-3", text: "Seúl: Gyeongbokgung, Bukchon, Hongdae, Myeong-dong (ver destino ciudad Seúl)" }] },
      { date: "", title: "Días 4-5 — Gyeongju", items: [{ time: "Día 4", text: "Tren KTX a Gyeongju: la Kioto de Corea, capital de Silla 1.000 años" }, { time: "Día 5", text: "Bulguksa (UNESCO), Seokguram (UNESCO), Tumuli Park (montículos reales)" }] },
      { date: "", title: "Días 6-7 — Jeju Island", items: [{ time: "Días 6-7", text: "Jeju: Hallasan (1.950m, el más alto de Corea), Manjanggul (cueva de lava), Cheonjeyeon Falls" }] },
      { date: "", title: "Día 8 — Seúl & Vuelo", items: [{ time: "Día 8", text: "Vuelta a Seúl, N Seoul Tower, mercado de Namdaemun, vuelo" }] },
    ],
    mapPlaces: [
      { name: "Gyeongbokgung Palace (Seúl)", lat: 37.58, lon: 126.98, note: "El palacio principal de la dinastía Joseon (s. XIV)" },
      { name: "Bulguksa (Gyeongju)", lat: 35.79, lon: 129.33, note: "El templo budista más importante de Corea, UNESCO" },
      { name: "Jeju Island (Hallasan)", lat: 33.36, lon: 126.53, note: "La isla volcánica, el volcán más alto de Corea" },
      { name: "Manjanggul (Jeju)", lat: 33.53, lon: 126.77, note: "Una de las cuevas de lava más largas del mundo" },
      { name: "Bukchon Hanok Village", lat: 37.58, lon: 126.99, note: "Casas hanok tradicionales entre rascacielos de Seúl" },
    ],
  },
  {
    id: "israel", name: "Israel & Tierra Santa", country: "Israel", flag: "🇮🇱",
    costPerPerson: 1450, durationDays: 8, type: "cultura",
    description: "El destino más concentrado de historia del mundo: Jerusalén con el Muro de las Lamentaciones, la Cúpula de la Roca y el Via Crucis en el mismo kilómetro cuadrado. Tel Aviv como capital del Mediterráneo moderno con una gastronomía que es referencia mundial.",
    highlights: ["Jerusalén (Ciudad Antigua)", "Tel Aviv (gastronomía)", "Mar Muerto (flotación)", "Masada al amanecer", "Caesarea"],
    itinerary: [
      { date: "", title: "Días 1-2 — Tel Aviv", items: [{ time: "Día 1", text: "Tel Aviv: Mercado Carmel, Rothschild Blvd, Nachalat Binyamin" }, { time: "Día 2", text: "Jaffa (Yafo): la ciudad más antigua de Israel, mercado de las pulgas" }] },
      { date: "", title: "Días 3-5 — Jerusalén", items: [{ time: "Día 3", text: "Ciudad Antigua: Muro Occidental, Cúpula de la Roca, Via Crucis" }, { time: "Día 4", text: "Monte de los Olivos, Monte Sión, mercado árabe de la Vía Dolorosa" }, { time: "Día 5", text: "Yad Vashem (Holocausto), Machaneh Yehuda (mercado), museos" }] },
      { date: "", title: "Días 6-7 — Mar Muerto & Masada", items: [{ time: "Día 6", text: "Mar Muerto: flotar sin esfuerzo al punto más bajo de la Tierra (-430m)" }, { time: "Día 7", text: "Masada: fortaleza herodiana donde 960 judíos resistieron a Roma (cable car o Snake Path al amanecer)" }] },
      { date: "", title: "Día 8 — Haifa & Vuelo", items: [{ time: "Día 8", text: "Haifa: Jardines Bahá'í (Patrimonio UNESCO), Caesarea (anfiteatro romano), vuelo" }] },
    ],
    mapPlaces: [
      { name: "Jerusalén (Ciudad Antigua)", lat: 31.78, lon: 35.23, note: "Las 3 religiones monoteístas en el mismo kilómetro" },
      { name: "Tel Aviv (Jaffa)", lat: 32.05, lon: 34.75, note: "La ciudad más vieja de Israel, ahora barrio bohemio" },
      { name: "Mar Muerto", lat: 31.56, lon: 35.47, note: "El punto más bajo de la Tierra (-430m), aguas de sal" },
      { name: "Masada", lat: 31.31, lon: 35.35, note: "Fortaleza herodiana sobre el acantilado del desierto" },
      { name: "Jardines Bahá'í (Haifa)", lat: 32.82, lon: 34.99, note: "Los jardines en terraza más perfectos del mundo, UNESCO" },
    ],
  },
  {
    id: "mexico-df", name: "México: CDMX & Oaxaca", country: "México", flag: "🇲🇽",
    costPerPerson: 1300, durationDays: 9, type: "cultura",
    description: "Ciudad de México es la ciudad más grande de América Latina: museos de talla mundial, la mejor gastronomía de América (reconocida por la UNESCO), Teotihuacán a 50km con pirámides que rivalizan con las egipcias y Oaxaca como la capital culinaria y cultural del México profundo.",
    highlights: ["Teotihuacán (Pirámides)", "CDMX: Frida Kahlo & Bellas Artes", "Oaxaca (mole & mezcal)", "Monte Albán (zapoteca)", "Mercado de Tlacolula"],
    itinerary: [
      { date: "", title: "Días 1-3 — Ciudad de México", items: [{ time: "Día 1", text: "Zócalo, Catedral Metropolitana, Templo Mayor (azteca bajo la catedral)" }, { time: "Día 2", text: "Coyoacán: Museo Frida Kahlo, mercado local, chocolate caliente" }, { time: "Día 3", text: "Bellas Artes, Bosque Chapultepec, Museo Nacional de Antropología (el mejor de México)" }] },
      { date: "", title: "Día 4 — Teotihuacán", items: [{ time: "08:00", text: "Teotihuacán: Pirámide del Sol (65m, 248 escalones), Pirámide de la Luna" }, { time: "14:00", text: "Calzada de los Muertos, Templo de Quetzalcóatl" }] },
      { date: "", title: "Días 5-7 — Oaxaca", items: [{ time: "Día 5", text: "Vuelo a Oaxaca: Zócalo, mercado Benito Juárez, chapulines" }, { time: "Día 6", text: "Monte Albán (ciudad zapoteca sobre la colina, 500 a.C.)" }, { time: "Día 7", text: "Mercado de Tlacolula, mezcal artesanal en Matatlán, tlayudas" }] },
      { date: "", title: "Días 8-9 — Oaxaca Costa & Vuelo", items: [{ time: "Días 8-9", text: "Hierve el Agua (cascadas petrificadas), Puerto Escondido, vuelo CDMX" }] },
    ],
    mapPlaces: [
      { name: "Teotihuacán (Pirámide del Sol)", lat: 19.69, lon: -98.84, note: "La tercera pirámide más grande del mundo" },
      { name: "Ciudad de México (Bellas Artes)", lat: 19.43, lon: -99.14, note: "El Palacio de Bellas Artes con murales de Rivera" },
      { name: "Coyoacán (Frida Kahlo)", lat: 19.35, lon: -99.16, note: "La Casa Azul de Frida Kahlo" },
      { name: "Oaxaca (Zócalo)", lat: 17.06, lon: -96.72, note: "La capital cultural del México profundo" },
      { name: "Monte Albán", lat: 17.04, lon: -96.77, note: "Ciudad zapoteca sobre una colina aplanada (500 a.C.)" },
    ],
  },
  {
    id: "puerto-rico", name: "Puerto Rico", country: "Puerto Rico (EE.UU.)", flag: "🇵🇷",
    costPerPerson: 1100, durationDays: 7, type: "playa",
    description: "La Isla del Encanto: el colorido Viejo San Juan colonial, El Yunque el único bosque tropical lluvioso de EE.UU., playas de ensueño y la cultura boricua más vibrante del Caribe.",
    highlights: ["Viejo San Juan", "El Yunque", "Playa Flamenco (Culebra)", "Bioluminiscencia (Vieques)"],
    itinerary: [
      { date: "", title: "Día 1 — Viejo San Juan", items: [{ time: "12:00", text: "Llegada al Aeropuerto Luis Muñoz Marín" }, { time: "15:00", text: "Viejo San Juan: calles adoquinadas de azul cobalto" }, { time: "16:30", text: "Castillo San Felipe del Morro — atardecer épico" }, { time: "20:00", text: "Cena de mofongo con camarones en La Perla" }] },
      { date: "", title: "Día 2 — Fuertes y casco histórico", items: [{ time: "09:00", text: "Castillo San Cristóbal (el más grande del Caribe)" }, { time: "11:30", text: "Catedral de San Juan Bautista (1521)" }, { time: "14:00", text: "Paseo de la Princesa y la bahía" }, { time: "17:00", text: "Barrio La Placita en Santurce: cultura y música" }] },
      { date: "", title: "Día 3 — El Yunque", items: [{ time: "08:00", text: "El Yunque: único bosque tropical lluvioso de EE.UU." }, { time: "10:00", text: "Cascada La Mina — nadar en agua dulce de selva" }, { time: "13:00", text: "Playa Luquillo: la playa más popular de la isla" }, { time: "19:00", text: "Kioskos de Luquillo: alcapurrias, bacalaítos y piñas coladas" }] },
      { date: "", title: "Día 4 — Culebra (la mejor playa)", items: [{ time: "07:30", text: "Ferry a Culebra (1h) o vuelo en avioneta (10 min)" }, { time: "10:00", text: "Playa Flamenco: top 3 mejores playas del mundo" }, { time: "14:00", text: "Snorkel en Playa Carlos Rosario" }, { time: "18:00", text: "Regreso y cena de arroz con gandules" }] },
      { date: "", title: "Día 5 — Vieques y bioluminiscencia", items: [{ time: "08:00", text: "Ferry a Vieques (1h) — la isla más tranquila" }, { time: "11:00", text: "Playa Sun Bay: 1 km de arena dorada sin aglomeraciones" }, { time: "14:00", text: "Refugio Nacional de Vida Silvestre" }, { time: "21:00", text: "Kayak nocturno en Mosquito Bay: bioluminiscencia más brillante del mundo" }] },
      { date: "", title: "Días 6-7 — Ponce y regreso", items: [{ time: "09:00", text: "Ponce: la segunda ciudad de Puerto Rico" }, { time: "11:00", text: "Museo de Arte de Ponce (Leighton, Rubens)" }, { time: "14:00", text: "Parque de Bombas: cuartel más fotogénico del mundo" }, { time: "Día 7", text: "Última mañana en Condado: compras y regreso" }] },
    ],
    mapPlaces: [
      { name: "Castillo San Felipe del Morro", lat: 18.47, lon: -66.12, note: "Fortaleza del s. XVI con vistas al Atlántico" },
      { name: "El Yunque", lat: 18.32, lon: -65.77, note: "El único bosque tropical lluvioso de EE.UU." },
      { name: "Playa Flamenco (Culebra)", lat: 18.33, lon: -65.31, note: "Una de las 10 mejores playas del mundo" },
      { name: "Mosquito Bay (Vieques)", lat: 18.07, lon: -65.43, note: "La bahía bioluminiscente más brillante del planeta" },
      { name: "Viejo San Juan", lat: 18.47, lon: -66.12, note: "Centro histórico colonial Patrimonio UNESCO" },
    ],
  },
  {
    id: "jamaica", name: "Jamaica", country: "Jamaica", flag: "🇯🇲",
    costPerPerson: 1050, durationDays: 7, type: "playa",
    description: "La isla del reggae y Bob Marley: Montego Bay, el río Negro, Dunn's River Falls, la filosofía rastafari y el mejor ron del Caribe.",
    highlights: ["Dunn's River Falls", "Bob Marley Museum", "Blue Mountains", "Seven Mile Beach"],
    itinerary: [
      { date: "", title: "Días 1-2 — Montego Bay", items: [{ time: "12:00", text: "Llegada a Sangster International (Montego Bay)" }, { time: "15:00", text: "Hip Strip: animación, bares y playa Doctor's Cave" }, { time: "Día 2", text: "Rafting en el Río Grande entre selva tropical" }] },
      { date: "", title: "Días 3-4 — Ocho Ríos", items: [{ time: "09:00", text: "Dunn's River Falls: subir la cascada de 180m en cadena humana" }, { time: "13:00", text: "Bob Marley Museum (Nine Mile, su lugar de nacimiento)" }, { time: "Día 4", text: "Mystic Mountain: tirolina y bobsleigh entre la selva" }] },
      { date: "", title: "Días 5-6 — Negril", items: [{ time: "10:00", text: "Seven Mile Beach: la playa más larga de Jamaica" }, { time: "17:00", text: "Rick's Café: atardecer + salto en el acantilado" }, { time: "Noche", text: "Reggae en vivo toda la noche" }, { time: "Día 6", text: "Snorkel en arrecife y clase de cocina jamaicana" }] },
      { date: "", title: "Día 7 — Kingston y regreso", items: [{ time: "09:00", text: "Kingston: mercado y gastronomía local" }, { time: "13:00", text: "Último jerk chicken con festival bread" }, { time: "16:00", text: "Vuelo de regreso" }] },
    ],
    mapPlaces: [
      { name: "Dunn's River Falls", lat: 18.43, lon: -77.01, note: "Cascada escalonada de 180m para subir" },
      { name: "Seven Mile Beach (Negril)", lat: 18.27, lon: -78.36, note: "La playa de arena más larga de Jamaica" },
      { name: "Bob Marley Museum (Kingston)", lat: 17.99, lon: -76.79, note: "La casa donde vivió y grabó Bob Marley" },
      { name: "Blue Mountains", lat: 18.04, lon: -76.63, note: "El café más famoso del mundo a 2.256m" },
    ],
  },
  {
    id: "miami", name: "Miami & Florida", country: "Estados Unidos", flag: "🇺🇸",
    costPerPerson: 1600, durationDays: 7, type: "ciudad",
    description: "La ciudad más latina de EE.UU.: Art Deco en South Beach, Little Havana, los Everglades con cocodrilos, Key West en el extremo sur y la mejor fiesta nocturna de América.",
    highlights: ["South Beach (Art Deco)", "Little Havana", "Everglades", "Key West"],
    itinerary: [
      { date: "", title: "Días 1-2 — South Beach", items: [{ time: "12:00", text: "Llegada a MIA" }, { time: "15:00", text: "South Beach: Ocean Drive y edificios Art Deco" }, { time: "18:00", text: "Paseo por Lincoln Road" }, { time: "Día 2", text: "Wynwood Walls: el barrio del arte urbano más famoso del mundo" }] },
      { date: "", title: "Día 3 — Little Havana y Coconut Grove", items: [{ time: "10:00", text: "Little Havana: café cubano y dominó en Calle Ocho" }, { time: "13:00", text: "Versailles Restaurant: el almuerzo más cubano fuera de Cuba" }, { time: "16:00", text: "Coconut Grove: bares con vista a la bahía Biscayne" }] },
      { date: "", title: "Día 4 — Everglades", items: [{ time: "08:00", text: "Parque Nacional Everglades: el río de hierba" }, { time: "10:00", text: "Airboat entre cocodrilos y manatíes" }, { time: "14:00", text: "Almuerzo de gator (caimán) en el parque" }, { time: "17:00", text: "Regreso y sunset en la playa" }] },
      { date: "", title: "Días 5-6 — Keys & Key West", items: [{ time: "09:00", text: "Overseas Highway: 42 puentes sobre el Atlántico y el Golfo" }, { time: "13:00", text: "Bahía Honda: snorkel en aguas cristalinas" }, { time: "16:00", text: "Key West: la ciudad más al sur de EE.UU. continental" }, { time: "18:00", text: "Mallory Square: el festival del atardecer" }, { time: "Día 6", text: "Casa de Hemingway y bares del Old Town" }] },
      { date: "", title: "Día 7 — Regreso", items: [{ time: "10:00", text: "Último baño en South Beach" }, { time: "14:00", text: "Vuelo de regreso" }] },
    ],
    mapPlaces: [
      { name: "South Beach", lat: 25.78, lon: -80.13, note: "La playa más famosa de EE.UU. con Art Deco" },
      { name: "Everglades", lat: 25.29, lon: -80.90, note: "Pantanos únicos con cocodrilos y manatíes" },
      { name: "Key West", lat: 24.56, lon: -81.78, note: "El extremo sur continental de EE.UU." },
      { name: "Wynwood Walls", lat: 25.80, lon: -80.20, note: "El barrio de arte urbano más famoso del mundo" },
    ],
  },
  {
    id: "nueva-orleans", name: "Nueva Orleans", country: "Estados Unidos", flag: "🇺🇸",
    costPerPerson: 1200, durationDays: 5, type: "cultura",
    description: "La ciudad más musical del mundo: jazz en cada esquina del French Quarter, carnavales Mardi Gras, vudú, cocina criolla y los cementerios más pintorescos de América.",
    highlights: ["French Quarter", "Jazz en Frenchmen Street", "Gastronomía criolla", "Garden District"],
    itinerary: [
      { date: "", title: "Días 1-2 — French Quarter", items: [{ time: "12:00", text: "Llegada a MSY" }, { time: "15:00", text: "Bourbon Street y Royal Street" }, { time: "18:00", text: "Preservación Hall: jazz auténtico desde 1961" }, { time: "Día 2", text: "Jackson Square, Catedral de San Luis y Mercado Francés" }] },
      { date: "", title: "Día 3 — Gastronomía criolla", items: [{ time: "10:00", text: "Café Du Monde: beignets con azúcar glas (obligatorio)" }, { time: "13:00", text: "Dooky Chase: cocina criolla histórica de los derechos civiles" }, { time: "16:00", text: "Frenchmen Street: jazz callejero al atardecer" }] },
      { date: "", title: "Días 4-5 — Garden District y swamps", items: [{ time: "09:00", text: "Swamp tour: caimanes en los bayous" }, { time: "14:00", text: "Garden District: mansiones de la Belle Époque" }, { time: "16:00", text: "Cementerio de Lafayette: las tumbas sobre el suelo" }, { time: "Día 5", text: "Compras en Magazine Street y vuelo" }] },
    ],
    mapPlaces: [
      { name: "French Quarter", lat: 29.96, lon: -90.06, note: "El corazón histórico de la ciudad" },
      { name: "Preservation Hall", lat: 29.96, lon: -90.07, note: "La sala de jazz más famosa desde 1961" },
      { name: "Garden District", lat: 29.93, lon: -90.09, note: "Mansiones victorianas y cementerios únicos" },
      { name: "Frenchmen Street", lat: 29.96, lon: -90.06, note: "La calle del jazz en vivo más auténtica" },
    ],
  },
  {
    id: "costa-amalfi", name: "Costa Amalfitana", country: "Italia", flag: "🇮🇹",
    costPerPerson: 1200, durationDays: 6, type: "playa",
    description: "La costa más dramática de Europa: acantilados verticales con pueblos de colores colgantes, Positano, Ravello, el Vesubio y Pompeya, todo con limoncello y pizza napolitana.",
    highlights: ["Positano", "Ravello", "Pompeya", "Capri"],
    itinerary: [
      { date: "", title: "Días 1-2 — Nápoles y Pompeya", items: [{ time: "12:00", text: "Llegada a Napoli Capodichino" }, { time: "15:00", text: "Pizza napolitana en la pizzería más antigua del mundo (Brandi, 1780)" }, { time: "Día 2", text: "Pompeya: la ciudad romana congelada en el tiempo" }, { time: "14:00", text: "Monte Vesubio: subir al cráter activo" }] },
      { date: "", title: "Días 3-4 — Costa Amalfitana", items: [{ time: "09:00", text: "Positano: el pueblo más fotografiado de Italia" }, { time: "12:00", text: "Almuerzo con vistas al mar Tirreno" }, { time: "15:00", text: "Amalfi: catedral y casco histórico" }, { time: "Día 4", text: "Ravello: jardines de Villa Rufolo (vistas de infarto)" }] },
      { date: "", title: "Días 5-6 — Capri", items: [{ time: "09:00", text: "Ferry a Capri (40 min desde Amalfi)" }, { time: "11:00", text: "Gruta Azul: cueva marina con luz espectacular" }, { time: "14:00", text: "Anacapri: Jardín de Augusto" }, { time: "16:00", text: "Via Krupp con vistas al Mediterráneo" }, { time: "Día 6", text: "Regreso y vuelo desde Nápoles" }] },
    ],
    mapPlaces: [
      { name: "Positano", lat: 40.63, lon: 14.49, note: "El pueblo más pintoresco de Italia" },
      { name: "Pompeya", lat: 40.75, lon: 14.49, note: "Ciudad romana sepultada en el 79 d.C." },
      { name: "Capri (Gruta Azul)", lat: 40.55, lon: 14.22, note: "La cueva marina más famosa del Mediterráneo" },
      { name: "Ravello", lat: 40.65, lon: 14.61, note: "Jardines sobre los acantilados con vistas absolutas" },
    ],
  },
  {
    id: "sevilla", name: "Sevilla", country: "España", flag: "🇪🇸",
    costPerPerson: 480, durationDays: 4, type: "cultura",
    description: "La capital del flamenco y la pasión española: la Giralda mora, el Real Alcázar de Game of Thrones, la Plaza de España, tapas infinitas y el barrio Santa Cruz laberíntico.",
    highlights: ["Real Alcázar", "Catedral & Giralda", "Barrio de Triana", "Flamenco en vivo"],
    itinerary: [
      { date: "", title: "Día 1 — Catedral y Giralda", items: [{ time: "10:00", text: "Llegada a Aeropuerto SVQ" }, { time: "13:00", text: "Catedral de Sevilla — la más grande del mundo gótico" }, { time: "15:00", text: "Giralda: subir sin escalones (rampas árabes)" }, { time: "18:00", text: "Barrio de Santa Cruz: calles que huelen a azahar" }, { time: "21:00", text: "Tapas en la Calle Betis: carrillada y cazón en adobo" }] },
      { date: "", title: "Día 2 — Real Alcázar y Plaza de España", items: [{ time: "09:00", text: "Real Alcázar: palacios mudéjares (escenario de GOT)" }, { time: "12:00", text: "Plaza de España: la más grandiosa de España" }, { time: "16:00", text: "Parque María Luisa" }, { time: "19:00", text: "Tablao flamenco: arte puro en vivo" }] },
      { date: "", title: "Días 3-4 — Triana y Carmona", items: [{ time: "10:00", text: "Triana: cerámica, flamenco y el puente de Triana" }, { time: "13:00", text: "Mercado de Triana: gazpacho y montaditos" }, { time: "Día 4", text: "Carmona: la ciudad más antigua de Europa habitada" }, { time: "16:00", text: "Vuelo de regreso" }] },
    ],
    mapPlaces: [
      { name: "Real Alcázar", lat: 37.38, lon: -5.99, note: "Palacio mudéjar Patrimonio UNESCO (escenario GOT)" },
      { name: "Catedral & Giralda", lat: 37.39, lon: -5.99, note: "La catedral gótica más grande del mundo" },
      { name: "Plaza de España", lat: 37.38, lon: -5.99, note: "La plaza más grandiosa de España (1929)" },
      { name: "Barrio de Triana", lat: 37.38, lon: -6.01, note: "Cuna del flamenco y la cerámica sevillana" },
    ],
  },
  {
    id: "los-angeles", name: "Los Ángeles", country: "Estados Unidos", flag: "🇺🇸",
    costPerPerson: 2000, durationDays: 7, type: "ciudad",
    description: "La capital del entretenimiento: Hollywood, las playas de Malibú, museos de clase mundial, Santa Mónica al atardecer, Disneyland y la comida más diversa del planeta.",
    highlights: ["Hollywood & Walk of Fame", "Santa Mónica", "Malibu", "Getty Center"],
    itinerary: [
      { date: "", title: "Días 1-2 — Hollywood y Beverly Hills", items: [{ time: "12:00", text: "Llegada a LAX" }, { time: "16:00", text: "Hollywood Boulevard: Walk of Fame y TCL Chinese Theatre" }, { time: "Día 2", text: "Beverly Hills: Rodeo Drive y mansiones" }, { time: "14:00", text: "Griffith Observatory: vistas de Los Ángeles y el Hollywood Sign" }] },
      { date: "", title: "Días 3-4 — Playas", items: [{ time: "09:00", text: "Venice Beach: paseo marítimo, skate park y artistas" }, { time: "13:00", text: "Santa Mónica: el famoso muelle y la Ruta 66" }, { time: "Día 4", text: "Malibú: playas de surfistas y Point Dume" }] },
      { date: "", title: "Día 5 — Museos", items: [{ time: "10:00", text: "Getty Center: arquitectura y arte europeo (entrada gratuita)" }, { time: "14:00", text: "LACMA o el Broad (arte contemporáneo)" }, { time: "19:00", text: "Cena en Melrose Place o Silver Lake" }] },
      { date: "", title: "Días 6-7 — Disneyland & regreso", items: [{ time: "09:00", text: "Disneyland en Anaheim — el original (45 min en coche)" }, { time: "Día 7", text: "Compras en The Grove y vuelo de regreso" }] },
    ],
    mapPlaces: [
      { name: "Hollywood Sign", lat: 34.13, lon: -118.32, note: "El icono de Los Ángeles y el cine mundial" },
      { name: "Santa Mónica Pier", lat: 34.01, lon: -118.50, note: "El final de la Ruta 66 sobre el Pacífico" },
      { name: "Venice Beach", lat: 33.99, lon: -118.47, note: "La playa más excéntrica de California" },
      { name: "Getty Center", lat: 34.08, lon: -118.47, note: "Museo de arte con vistas de 360° de LA" },
    ],
  },
];

// ─── Destination alternatives map ────────────────────────────────────────────
const DESTINATION_ALTERNATIVES: Record<string, string[]> = {
  "japon":          ["japon-tokio", "bangkok", "vietnam"],
  "maldivas":       ["seychelles", "mauricio", "sri-lanka"],
  "seychelles":     ["mauricio", "cabo-verde", "filipinas"],
  "hawaii":         ["tenerife", "fuerteventura", "mallorca"],
  "tanzania":       ["kenya", "sudafrica", "rwanda"],
  "nueva-york":     ["paris", "amsterdam", "roma"],
  "islandia":       ["islandia-express", "noruega-fjords", "islas-feroe"],
  "argentina":      ["chile", "colombia", "peru"],
  "alaska":         ["noruega-fjords", "islandia", "svalbard"],
  "nueva-zelanda":  ["argentina", "chile", "islandia"],
  "kenya":          ["tanzania", "sudafrica", "namibia"],
  "sudafrica":      ["kenya", "namibia", "rwanda"],
  "svalbard":       ["islandia-express", "noruega-fjords", "islas-feroe"],
  "groenlandia":    ["islandia-express", "svalbard", "islas-feroe"],
  "borneo":         ["indonesia-bali", "filipinas", "vietnam"],
  "peru-trek":      ["peru", "bolivia", "chile"],
  "india":          ["sri-lanka", "cambodia", "marruecos-norte"],
};

// ─── Utilities ───────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 9); }

function genTripCode() {
  const L = "ABCDEFGHJKLMNPQRSTUVWXYZ", N = "23456789";
  let c = "";
  for (let i = 0; i < 3; i++) c += L[Math.floor(Math.random() * L.length)];
  c += "-";
  for (let i = 0; i < 3; i++) c += N[Math.floor(Math.random() * N.length)];
  return c;
}

function formatDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}
function formatDateFull(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}
function tripDuration(s: string | null, e: string | null) {
  if (!s || !e) return null;
  return Math.round((new Date(e + "T12:00:00").getTime() - new Date(s + "T12:00:00").getTime()) / 86_400_000) + 1;
}
function isValidUrl(s: string) {
  try { const u = new URL(s); return u.protocol === "https:" || u.protocol === "http:"; } catch { return false; }
}

// ─── Storage ─────────────────────────────────────────────────────────────────

async function loadShared<T>(key: string, fallback: T): Promise<T> {
  // Try remote KV first (works across devices), fall back to localStorage
  try {
    const res = await fetch(`/api/store?key=${encodeURIComponent(key)}`);
    if (res.ok) {
      const data = await res.json();
      if (data !== null) {
        // Keep local cache in sync
        try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* ignore */ }
        return data as T;
      }
      // KV is reachable but key doesn't exist yet — migrate from localStorage
      try {
        const local = localStorage.getItem(key);
        if (local) {
          const parsed = JSON.parse(local) as T;
          // Seed KV with local data (fire-and-forget)
          fetch("/api/store", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key, value: parsed }),
          }).catch(() => {});
          return parsed;
        }
      } catch { /* ignore */ }
    }
  } catch { /* network issue — fall through */ }
  // localStorage fallback
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) as T : fallback; } catch { return fallback; }
}

async function saveShared(key: string, value: unknown): Promise<boolean> {
  // Save to localStorage immediately for responsiveness
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  // Then persist to remote KV
  try {
    const res = await fetch("/api/store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    if (res.ok) return true;
    // 503 means KV not configured yet — not an error, just not synced
    if (res.status === 503) return true;
  } catch { /* network issue */ }
  return true; // local save succeeded
}

async function loadPersonal<T>(key: string, fallback: T): Promise<T> {
  try { const r = localStorage.getItem(`_p:${key}`); return r ? JSON.parse(r) as T : fallback; } catch { return fallback; }
}
async function savePersonal(key: string, value: unknown) {
  try { localStorage.setItem(`_p:${key}`, JSON.stringify(value)); } catch { /* ignore */ }
}

// ─── Small components ─────────────────────────────────────────────────────────

function Perf() {
  return (
    <div className="flex items-center gap-1 py-2" aria-hidden>
      {Array.from({ length: 36 }).map((_, i) => (
        <div key={i} style={{ width: 4, height: 4, borderRadius: 999, background: C.line, flexShrink: 0 }} />
      ))}
    </div>
  );
}

function Card({ children, className, style, hover = true }: { children: React.ReactNode; className?: string; style?: React.CSSProperties; hover?: boolean }) {
  return (
    <div
      className={`${hover ? "card-lift" : ""} ${className ?? ""}`}
      style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", ...style }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <span style={{ fontFamily: F.mono, fontSize: 11, color: C.inkSoft, letterSpacing: 1 }}>{children.toUpperCase()}</span>;
}

const inputStyle: React.CSSProperties = {
  border: `1px solid ${C.line}`, borderRadius: 5, padding: "9px 11px",
  fontSize: 14, fontFamily: F.body, color: C.ink, background: "#FCFAF4", width: "100%",
};

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1 flex-1">
      <span style={{ fontSize: 11, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 0.5 }}>{label.toUpperCase()}</span>
      {children}
      {hint && <span style={{ fontSize: 11, color: C.inkSoft }}>{hint}</span>}
    </label>
  );
}

function Banner({ type, msg }: { type: "error" | "success"; msg: string }) {
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

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10" style={{ color: C.inkSoft, fontSize: 13, textAlign: "center" }}>
      {icon}
      <p style={{ maxWidth: 260 }}>{text}</p>
    </div>
  );
}

function SkeletonCards() {
  return (
    <div className="flex flex-col gap-4">
      {[100, 140, 80].map((h, i) => <div key={i} className="skeleton" style={{ height: h }} />)}
    </div>
  );
}

// ─── Countdown ───────────────────────────────────────────────────────────────

function useCountdown(dateStr: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr + "T00:00:00").getTime() - now) / 86_400_000);
}

// ─── Hero / Entry screen ──────────────────────────────────────────────────────

function EntryScreen({ onEnter, externalError, prefillCode }: { onEnter: (code: string, name: string) => Promise<void>; externalError: string; prefillCode?: string }) {
  const [mode, setMode] = useState<"join" | "create">(prefillCode ? "join" : "create");
  const [name, setName] = useState("");
  const [code, setCode] = useState(prefillCode ?? "");
  const [tripName, setTripName] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, [mode]);

  async function handleJoin() {
    if (!name.trim()) { setError("Escribe tu nombre."); return; }
    if (!code.trim()) { setError("Escribe el código del viaje."); return; }
    setBusy(true); setError("");
    const t = await loadShared<Trip | null>(`trip:${code.trim().toUpperCase()}`, null);
    if (!t) { setError("No existe ese código. Revísalo o crea un viaje nuevo."); setBusy(false); return; }
    await onEnter(code.trim().toUpperCase(), name.trim());
    setBusy(false);
  }

  async function handleCreate() {
    if (!name.trim()) { setError("Escribe tu nombre."); return; }
    if (!tripName.trim()) { setError("Escribe el nombre del viaje."); return; }
    if (startDate && endDate && endDate < startDate) { setError("La fecha de fin debe ser posterior a la de inicio."); return; }
    setBusy(true); setError("");
    let newCode = genTripCode(), tries = 0;
    while ((await loadShared<Trip | null>(`trip:${newCode}`, null)) !== null && tries < 10) { newCode = genTripCode(); tries++; }
    const trip: Trip = { name: tripName.trim(), destination: destination.trim(), startDate: startDate || null, endDate: endDate || null, members: [], createdAt: Date.now() };
    const ok = await saveShared(`trip:${newCode}`, trip);
    if (!ok) { setError("Error al guardar el viaje. Inténtalo de nuevo."); setBusy(false); return; }
    await onEnter(newCode, name.trim());
    setBusy(false);
  }

  const isJoin = mode === "join";

  // Landing entrance animation
  const heroRef = useRef<HTMLDivElement>(null);
  const formCardRef = useRef<HTMLDivElement>(null);
  const pillsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const tl = [
      { el: heroRef.current, opts: { opacity: [0, 1], translateY: [30, 0], duration: 700, ease: "out(3)" } },
      { el: formCardRef.current, opts: { opacity: [0, 1], translateY: [40, 0], scale: [0.96, 1], duration: 600, delay: 160, ease: "out(3)" } },
    ];
    tl.forEach(({ el, opts }) => {
      if (!el) return;
      el.style.opacity = "0";
      animate(el, opts as Parameters<typeof animate>[1]);
    });
    if (pillsRef.current) {
      const pills = Array.from(pillsRef.current.children) as HTMLElement[];
      pills.forEach(p => { p.style.opacity = "0"; p.style.transform = "scale(0.85)"; });
      animate(pills, { opacity: [0, 1], scale: [0.85, 1], delay: stagger(40, { start: 320 }), duration: 380, ease: "out(2)" });
    }
  }, []);

  return (
    <div style={{ minHeight: "100dvh", fontFamily: F.body, color: C.ink, display: "flex", flexDirection: "column" }}>
      {/* Hero top panel */}
      <div
        className="dot-grid relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${C.navy} 0%, #0A1626 55%, #142644 100%)`, flex: "0 0 auto" }}
      >
        {/* Glow orbs */}
        <div className="glow-pulse" style={{ position: "absolute", top: -60, right: -60, width: 300, height: 300, borderRadius: 999, background: `radial-gradient(circle, ${C.gold}28, transparent 70%)`, pointerEvents: "none" }} />
        <div className="glow-pulse" style={{ position: "absolute", bottom: -40, left: 40, width: 200, height: 200, borderRadius: 999, background: `radial-gradient(circle, ${C.teal}35, transparent 70%)`, pointerEvents: "none", animationDelay: "1.5s" }} />
        <div className="glow-pulse" style={{ position: "absolute", top: "40%", left: "35%", width: 150, height: 150, borderRadius: 999, background: `radial-gradient(circle, ${C.purple}20, transparent 70%)`, pointerEvents: "none", animationDelay: "3s" }} />

        <div className="max-w-5xl mx-auto px-6 py-12 relative">
          <div className="flex flex-col md:flex-row items-center gap-10">
            {/* Left: Branding */}
            <div ref={heroRef} className="flex-1 text-center md:text-left">
              <div className="float inline-block mb-6">
                <Plane size={52} color={C.gold} strokeWidth={1.2} />
              </div>
              <h1 style={{ fontFamily: F.display, fontSize: "clamp(2.4rem, 5vw, 3.8rem)", fontWeight: 700, color: "#fff", lineHeight: 1.05, letterSpacing: -1 }}>
                Bitácora<br />de Viaje
              </h1>
              <p style={{ color: "#AAB8D0", fontSize: 16, marginTop: 14, maxWidth: 340, lineHeight: 1.65 }}>
                Planifica, comparte y revive tus aventuras junto a tu gente — sin apps, sin contraseñas.
              </p>
              {/* Feature pills */}
              <div ref={pillsRef} className="flex flex-wrap gap-2 mt-6 justify-center md:justify-start">
                {[
                  ["🌍", "Destinos"], ["✈️", "Itinerario"], ["🗺️", "Mapa"],
                  ["🧳", "Equipaje"], ["💶", "Gastos"], ["💡", "Ideas"], ["📸", "Fotos"],
                ].map(([icon, label]) => (
                  <span key={label} style={{ background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.14)", color: "#C3D0E8", fontSize: 12, fontFamily: F.mono, borderRadius: 999, padding: "5px 11px" }}>
                    {icon} {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Right: Form card */}
            <div ref={formCardRef} style={{ width: "100%", maxWidth: 400, background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)" }}>
              {/* Mode toggle */}
              <div className="flex" style={{ borderBottom: `1px solid ${C.line}` }}>
                {([["create", "✈ Crear viaje"], ["join", "Unirme"]] as const).map(([k, label]) => (
                  <button key={k} onClick={() => { setMode(k); setError(""); }} style={{
                    flex: 1, padding: "13px 8px", fontSize: 12, fontWeight: 600,
                    fontFamily: F.mono, letterSpacing: 0.4,
                    color: mode === k ? C.navy : C.inkSoft,
                    background: mode === k ? C.paperDark : "transparent",
                    borderBottom: mode === k ? `2px solid ${C.red}` : "2px solid transparent",
                    transition: "all 0.15s",
                  }}>
                    {label.toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="p-5 flex flex-col gap-3" style={{ background: C.paper }}>
                <Field label="Tu nombre">
                  <input ref={nameRef} value={name} onChange={e => setName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && (isJoin ? handleJoin() : handleCreate())}
                    placeholder="Ej. Lucas" style={inputStyle} autoComplete="given-name" />
                </Field>

                {isJoin ? (
                  <Field label="Código del viaje" hint="Pídelo al organizador">
                    <input value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
                      onKeyDown={e => e.key === "Enter" && handleJoin()}
                      placeholder="Ej. ABC-234" maxLength={7}
                      style={{ ...inputStyle, fontFamily: F.mono, letterSpacing: 2 }} />
                  </Field>
                ) : (
                  <>
                    <Field label="Nombre del viaje">
                      <input value={tripName} onChange={e => setTripName(e.target.value)} placeholder="Ej. Grecia 2027" style={inputStyle} />
                    </Field>
                    <Field label="Destino principal (opcional)">
                      <input value={destination} onChange={e => setDestination(e.target.value)} placeholder="Ej. Santorini, Grecia" style={inputStyle} />
                    </Field>
                    <div className="flex gap-3">
                      <Field label="Inicio"><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} /></Field>
                      <Field label="Fin"><input type="date" value={endDate} min={startDate || undefined} onChange={e => setEndDate(e.target.value)} style={inputStyle} /></Field>
                    </div>
                  </>
                )}

                {(error || externalError) && <Banner type="error" msg={error || externalError} />}

                <button disabled={busy} onClick={isJoin ? handleJoin : handleCreate} style={{
                  marginTop: 2, background: busy ? C.inkSoft : C.navy, color: C.paper,
                  fontFamily: F.mono, fontWeight: 600, fontSize: 13, letterSpacing: 0.5,
                  padding: "13px 16px", borderRadius: 6, transition: "background 0.15s",
                }}>
                  {busy ? "UN MOMENTO…" : isJoin ? "ENTRAR AL VIAJE →" : "CREAR VIAJE →"}
                </button>

                <p style={{ color: C.inkSoft, fontSize: 11, textAlign: "center", fontFamily: F.mono }}>
                  SIN CONTRASEÑAS · COMPARTE EL CÓDIGO
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trip history */}
      {(() => {
        let history: { code: string; name: string; destination: string; leftAt: number }[] = [];
        try { history = JSON.parse(localStorage.getItem("trip_history") ?? "[]"); } catch { /* */ }
        if (!history.length) return null;
        return (
          <div style={{ background: C.paper, padding: "24px 24px 12px", maxWidth: 800, margin: "0 auto", width: "100%" }}>
            <p style={{ fontFamily: F.mono, fontSize: 10, color: C.inkSoft, letterSpacing: 1.5, marginBottom: 10 }}>VIAJES RECIENTES</p>
            <div className="flex flex-col gap-2">
              {history.map(h => (
                <button key={h.code} onClick={() => { setCode(h.code); setMode("join"); }}
                  style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 14px", textAlign: "left", cursor: "pointer", transition: "border-color 0.15s" }}
                  onMouseOver={e => (e.currentTarget.style.borderColor = C.teal)}
                  onMouseOut={e => (e.currentTarget.style.borderColor = C.line)}>
                  <Plane size={15} color={C.inkSoft} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: C.ink }}>{h.name}</span>
                    {h.destination && <span style={{ color: C.inkSoft, fontSize: 12 }}> · {h.destination}</span>}
                  </div>
                  <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkSoft, background: C.paperDark, borderRadius: 4, padding: "2px 6px" }}>{h.code}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Bottom decorative strip */}
      <div style={{ background: C.paper, padding: "28px 24px", textAlign: "center" }}>
        <p style={{ color: C.inkSoft, fontSize: 13, maxWidth: 480, margin: "0 auto", lineHeight: 1.7 }}>
          Crea un viaje, comparte el código con tu grupo y planificad juntos desde cualquier dispositivo.
          Itinerario, mapa, fotos, gastos divididos y lista de equipaje — todo en uno.
        </p>
      </div>
    </div>
  );
}

// ─── Weather widget ───────────────────────────────────────────────────────────

const WMO: Record<number, string> = {
  0:"☀️",1:"🌤️",2:"⛅",3:"☁️",45:"🌫️",48:"🌫️",
  51:"🌦️",53:"🌦️",55:"🌧️",61:"🌧️",63:"🌧️",65:"🌧️",
  71:"🌨️",73:"🌨️",75:"❄️",80:"🌦️",81:"🌧️",82:"⛈️",
  95:"⛈️",96:"⛈️",99:"⛈️",
};

function WeatherWidget({ destination, startDate, endDate }: { destination: string; startDate: string | null; endDate: string | null }) {
  type DayWeather = { date: string; max: number; min: number; code: number; rain: number };
  const [data, setData] = useState<DayWeather[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!destination || !startDate) return;
    const today = new Date().toISOString().slice(0, 10);
    const cutoff = new Date(Date.now() + 16 * 864e5).toISOString().slice(0, 10);
    if (startDate > cutoff) return; // too far in future, skip
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destination)}&count=1&language=es&format=json`).then(r => r.json());
        if (!geo.results?.length) return;
        const { latitude: lat, longitude: lon } = geo.results[0];
        const s = startDate < today ? today : startDate;
        const e = endDate && endDate <= cutoff ? endDate : cutoff;
        const wx = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&timezone=auto&start_date=${s}&end_date=${e}`).then(r => r.json());
        if (!cancelled && wx.daily) {
          setData(wx.daily.time.map((d: string, i: number) => ({
            date: d, max: Math.round(wx.daily.temperature_2m_max[i]),
            min: Math.round(wx.daily.temperature_2m_min[i]),
            code: wx.daily.weathercode[i], rain: Math.round(wx.daily.precipitation_sum[i] ?? 0),
          })));
        }
      } catch { /* silent — weather is optional */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [destination, startDate, endDate]);

  if (!destination || !startDate) return null;
  if (loading) return <div style={{ height: 80, borderRadius: 10 }} className="skeleton" />;
  if (!data?.length) return null;

  return (
    <Card>
      <SectionLabel>{`Tiempo en ${destination.split(",")[0]}`}</SectionLabel>
      <div className="flex gap-4 mt-3 overflow-x-auto no-scrollbar pb-1">
        {data.slice(0, 8).map(d => (
          <div key={d.date} style={{ textAlign: "center", minWidth: 48, flex: "0 0 48px" }}>
            <div style={{ fontSize: 24 }}>{WMO[d.code] ?? "🌡️"}</div>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkSoft, marginTop: 2 }}>{d.date.slice(5)}</div>
            <div style={{ fontFamily: F.mono, fontSize: 13, fontWeight: 700, color: C.ink }}>{d.max}°</div>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkSoft }}>{d.min}°</div>
            {d.rain > 0 && <div style={{ fontFamily: F.mono, fontSize: 9, color: C.sky }}>💧{d.rain}mm</div>}
          </div>
        ))}
      </div>
      <p style={{ fontFamily: F.mono, fontSize: 10, color: C.inkSoft, marginTop: 6 }}>Datos: Open-Meteo</p>
    </Card>
  );
}

// ─── Asistente IA ─────────────────────────────────────────────────────────────

interface ChatMsg { role: "user" | "assistant"; content: string; }

function AsistenteIA({ code: _code, trip, session: _session, onImportItinerary }: {
  code: string; trip: Trip; session: Session;
  onImportItinerary: (days: ItineraryDay[]) => void;
}) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [noKey, setNoKey] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const systemPrompt = `Eres un asistente experto en planificación de viajes integrado en Bitácora de Viaje, una app colaborativa en español.

Datos del viaje actual:
- Nombre: ${trip.name}
- Destino: ${trip.destination || "no especificado"}
- Fechas: ${trip.startDate ? `${trip.startDate} → ${trip.endDate || "?"}` : "no fijadas"}
- Viajeros: ${trip.members.join(", ")} (${trip.members.length} persona${trip.members.length !== 1 ? "s" : ""})

Cuando el usuario pida crear un itinerario o plan de viaje, responde con tu explicación y AL FINAL incluye el itinerario en este formato JSON exacto, delimitado por \`\`\`json y \`\`\`:
{
  "itinerary": [
    {
      "title": "Día 1 — Nombre descriptivo",
      "items": [
        { "time": "09:00", "text": "Descripción de la actividad" }
      ]
    }
  ]
}

Responde siempre en español. Sé concreto, práctico y entusiasta.`;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, streaming]);

  function extractItinerary(text: string): { title: string; items: { time: string; text: string }[] }[] | null {
    const match = text.match(/```json\s*([\s\S]*?)```/);
    if (!match) return null;
    try {
      const parsed = JSON.parse(match[1]);
      return parsed.itinerary ?? null;
    } catch { return null; }
  }

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    const newMsgs: ChatMsg[] = [...msgs, { role: "user", content: text }];
    setMsgs(newMsgs);
    setStreaming(true);
    setNoKey(false);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: systemPrompt,
          messages: newMsgs.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (res.status === 503) {
        setNoKey(true);
        setMsgs(m => [...m, { role: "assistant", content: "⚠️ No hay clave ANTHROPIC_API_KEY configurada en Vercel. Añádela en Settings → Environment Variables." }]);
        setStreaming(false);
        return;
      }

      if (!res.ok || !res.body) {
        setMsgs(m => [...m, { role: "assistant", content: "Error al conectar con la IA. Inténtalo de nuevo." }]);
        setStreaming(false);
        return;
      }

      // Parse SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      setMsgs(m => [...m, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            // Anthropic SSE: event type content_block_delta
            if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
              fullText += parsed.delta.text;
              setMsgs(m => [...m.slice(0, -1), { role: "assistant", content: fullText }]);
            }
          } catch { /* skip malformed events */ }
        }
      }
    } catch {
      setMsgs(m => [...m, { role: "assistant", content: "Error de red. Comprueba tu conexión." }]);
    }
    setStreaming(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  const lastAssistantMsg = [...msgs].reverse().find(m => m.role === "assistant");
  const itinerary = lastAssistantMsg ? extractItinerary(lastAssistantMsg.content) : null;

  function renderMsgContent(content: string) {
    // Strip the json block for display, show clean text
    return content.replace(/```json[\s\S]*?```/g, "").trim();
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={16} color={C.purple} />
          <SectionLabel>Asistente de Planificación</SectionLabel>
        </div>
        <p style={{ color: C.inkSoft, fontSize: 13 }}>
          Pídeme un itinerario, consejos, presupuesto estimado o cualquier cosa sobre {trip.destination || "tu destino"}.
        </p>
      </Card>

      {/* Chat messages */}
      <div className="flex flex-col gap-3" style={{ minHeight: 200 }}>
        {msgs.length === 0 && (
          <div className="flex flex-col gap-2">
            {[
              `Crea un itinerario de ${trip.destination || "mi viaje"} para ${trip.members.length} personas`,
              "¿Qué presupuesto diario necesito?",
              "¿Qué documentación necesito para este viaje?",
              "Dame 5 restaurantes imprescindibles",
            ].map(s => (
              <button key={s} onClick={() => { setInput(s); inputRef.current?.focus(); }}
                style={{ textAlign: "left", background: C.paperDark, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: C.ink, cursor: "pointer", transition: "background 0.15s" }}
                onMouseOver={e => (e.currentTarget.style.background = C.line)}
                onMouseOut={e => (e.currentTarget.style.background = C.paperDark)}>
                ✦ {s}
              </button>
            ))}
          </div>
        )}

        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "85%",
              background: m.role === "user" ? C.navy : "#fff",
              color: m.role === "user" ? "#fff" : C.ink,
              border: m.role === "assistant" ? `1px solid ${C.line}` : "none",
              borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              padding: "10px 14px",
              fontSize: 14,
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}>
              {m.role === "assistant" ? renderMsgContent(m.content) : m.content}
              {m.role === "assistant" && streaming && i === msgs.length - 1 && (
                <span style={{ display: "inline-block", width: 8, height: 14, background: C.inkSoft, borderRadius: 2, marginLeft: 2, animation: "fadeIn 0.5s ease infinite alternate" }} />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Import itinerary button */}
      {itinerary && !streaming && (
        <Card style={{ background: `${C.teal}10`, border: `1px solid ${C.teal}40` }}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p style={{ fontWeight: 600, fontSize: 14 }}>Itinerario generado — {itinerary.length} días</p>
              <p style={{ color: C.inkSoft, fontSize: 12 }}>Importar reemplazará el itinerario actual</p>
            </div>
            <button onClick={() => {
              const importDays: ItineraryDay[] = itinerary.map(d => ({
                id: uid(), date: "", title: d.title,
                items: d.items.map(it => ({ id: uid(), time: it.time, text: it.text })),
              }));
              onImportItinerary(importDays);
            }} style={{ display: "flex", alignItems: "center", gap: 6, background: C.teal, color: "#fff", borderRadius: 6, padding: "9px 16px", fontFamily: F.mono, fontSize: 12 }}>
              <Download size={13} /> IMPORTAR AL PLAN
            </button>
          </div>
        </Card>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
          placeholder={streaming ? "La IA está respondiendo…" : "Escribe tu pregunta…"}
          disabled={streaming}
          style={{ ...inputStyle, flex: 1, fontSize: 14 }} />
        <button onClick={send} disabled={streaming || !input.trim()}
          style={{ background: (streaming || !input.trim()) ? C.inkSoft : C.purple, color: "#fff", borderRadius: 6, padding: "0 16px", display: "flex", alignItems: "center", gap: 6, fontFamily: F.mono, fontSize: 12, transition: "background 0.15s", minWidth: 56 }}>
          {streaming ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </div>
      {noKey && (
        <Banner type="error" msg='Añade ANTHROPIC_API_KEY en Vercel → Settings → Environment Variables → Redeploy' />
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

type TabId = "resumen" | "itinerario" | "mapa" | "fotos" | "checklist" | "gastos" | "equipaje" | "ideas" | "ahorro" | "destinos" | "reservas" | "diario" | "asistente";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [tab, setTab] = useState<TabId>("resumen");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [entryError, setEntryError] = useState("");
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("darkMode") === "1";
  });

  useEffect(() => {
    (async () => {
      // Handle invite link: /?code=XYZ&d=<base64tripdata>
      const params = new URLSearchParams(window.location.search);
      const urlCode = params.get("code");
      const urlData = params.get("d");
      let inviteTripObj: Trip | null = null;
      if (urlCode && urlData) {
        try {
          inviteTripObj = JSON.parse(decodeURIComponent(atob(urlData))) as Trip;
          await saveShared(`trip:${urlCode}`, inviteTripObj);
          setInviteCode(urlCode);
        } catch { /* malformed invite link */ }
        window.history.replaceState({}, "", window.location.pathname);
      }

      const last = await loadPersonal<Session | null>("lastSession", null);
      if (last?.code && last?.name) {
        // If the invite link is for the same trip we're already in, use the fresher data
        if (inviteTripObj && urlCode === last.code) {
          // Make sure we're still in the members list
          if (!inviteTripObj.members.some(m => m.toLowerCase() === last.name.toLowerCase())) {
            inviteTripObj.members = [...inviteTripObj.members, last.name];
            await saveShared(`trip:${last.code}`, inviteTripObj);
          }
          setSession(last); setTrip(inviteTripObj); setLoading(false); return;
        }
        const t = await loadShared<Trip | null>(`trip:${last.code}`, null);
        if (t) { setSession(last); setTrip(t); }
      }
      setLoading(false);
    })();
  }, []);

  async function enter(code: string, name: string) {
    setLoading(true); setEntryError("");
    const t = await loadShared<Trip | null>(`trip:${code}`, null);
    if (!t) { setLoading(false); setEntryError("No se pudo cargar el viaje. Inténtalo de nuevo."); return; }
    if (!t.members.some(m => m.toLowerCase() === name.toLowerCase())) {
      t.members = [...t.members, name];
      await saveShared(`trip:${code}`, t);
    }
    await savePersonal("lastSession", { code, name });
    setSession({ code, name }); setTrip(t); setLoading(false);
  }

  function leave() {
    if (session && trip) {
      try {
        const prev = JSON.parse(localStorage.getItem("trip_history") ?? "[]") as { code: string; name: string; destination: string; leftAt: number }[];
        const entry = { code: session.code, name: trip.name, destination: trip.destination, leftAt: Date.now() };
        localStorage.setItem("trip_history", JSON.stringify([entry, ...prev.filter(h => h.code !== entry.code)].slice(0, 8)));
      } catch { /* ignore */ }
    }
    setSession(null); setTrip(null); setTab("resumen");
  }

  function toggleDark() {
    setDarkMode(d => {
      const next = !d;
      localStorage.setItem("darkMode", next ? "1" : "0");
      return next;
    });
  }

  const days = useCountdown(trip?.startDate ?? null);
  const contentRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    el.style.opacity = "0";
    el.style.transform = "translateY(10px)";
    animate(el, { opacity: [0, 1], translateY: [10, 0], duration: 280, ease: "out(2)",
      onComplete: () => { el.style.transform = ""; } });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [tab, session]);

  const [syncToast, setSyncToast] = useState(false);
  const tripRef = useRef<Trip | null>(null);
  useEffect(() => { tripRef.current = trip; }, [trip]);

  // PWA install prompt
  const [pwaPrompt, setPwaPrompt] = useState<any>(null); // BeforeInstallPromptEvent not in lib.dom yet
  const [pwaDismissed, setPwaDismissed] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("pwa_dismissed") === "1") { setPwaDismissed(true); return; }
    const handler = (e: any) => { e.preventDefault(); setPwaPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    if (!session) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/store?key=${encodeURIComponent(`trip:${session.code}`)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data) return;
        if (JSON.stringify(data) !== JSON.stringify(tripRef.current)) {
          setTrip(data as Trip);
          setSyncToast(true);
          setTimeout(() => setSyncToast(false), 3000);
        }
      } catch { /* silent */ }
    };
    const id = setInterval(poll, 30000);
    return () => clearInterval(id);
  }, [session]);

  if (loading) {
    return (
      <div style={{ background: C.paper, minHeight: "100dvh", fontFamily: F.body }} className="flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="float"><Plane size={32} color={C.gold} strokeWidth={1.3} /></div>
          <p style={{ fontFamily: F.mono, color: C.inkSoft, fontSize: 13 }}>cargando…</p>
        </div>
      </div>
    );
  }

  if (!session || !trip) return <EntryScreen onEnter={enter} externalError={entryError} prefillCode={inviteCode ?? undefined} />;

  const tabs: { id: TabId; label: string; Icon: React.ElementType }[] = [
    { id: "resumen",    label: "Inicio",     Icon: Sunrise },
    { id: "asistente",  label: "IA",         Icon: Sparkles },
    { id: "reservas",   label: "Reservas",   Icon: Ticket },
    { id: "itinerario", label: "Plan",        Icon: Plane },
    { id: "mapa",       label: "Mapa",        Icon: MapPin },
    { id: "fotos",      label: "Fotos",       Icon: Camera },
    { id: "diario",     label: "Diario",      Icon: BookOpen },
    { id: "gastos",     label: "Gastos",      Icon: Wallet },
    { id: "equipaje",   label: "Equipaje",    Icon: Luggage },
    { id: "checklist",  label: "Checklist",   Icon: ListChecks },
    { id: "ideas",      label: "Ideas",       Icon: Lightbulb },
    { id: "ahorro",     label: "Ahorro",      Icon: PiggyBank },
    { id: "destinos",   label: "Destinos",    Icon: Globe },
  ];

  const dk = darkMode ? {
    bg: "#0D1117", bgCard: "#161B22", bgHeader: "linear-gradient(135deg,#0D1117 0%,#161B22 100%)",
    text: "#E6EDF3", textSoft: "#8B949E", border: "#30363D", paper: "#0D1117",
  } : null;

  return (
    <div style={{ background: dk ? dk.bg : C.paper, fontFamily: F.body, color: dk ? dk.text : C.ink, minHeight: "100dvh", transition: "background 0.3s" }}>
      {/* Header */}
      <header style={{ background: dk ? dk.bgHeader : `linear-gradient(135deg, ${C.navy} 0%, ${C.navyMid} 60%, #1A3560 100%)`, color: C.paper }} className="dot-grid">
        <div className="max-w-4xl mx-auto px-4 pt-4 pb-0">
          <div className="flex items-center justify-between mb-3">
            <button onClick={leave} className="flex items-center gap-1" style={{ color: "#7C8AA3", fontSize: 11, fontFamily: F.mono }}>
              <ArrowLeft size={12} /> CAMBIAR DE VIAJE
            </button>
            <div className="flex items-center gap-2">
              <SyncButton code={session.code} onSync={t => setTrip(t)} />
              <button onClick={toggleDark} style={{ color: "#7C8AA3", padding: "4px 8px", borderRadius: 6, border: "1px solid #2D3E5A", display: "flex", alignItems: "center", gap: 4, fontFamily: F.mono, fontSize: 10 }}>
                {darkMode ? <Sun size={12} /> : <Moon size={12} />} {darkMode ? "CLARO" : "OSCURO"}
              </button>
            </div>
          </div>

          <div className="flex items-start justify-between flex-wrap gap-3 pb-4">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="flex items-center gap-2 mb-1">
                <span style={{ fontFamily: F.mono, fontSize: 10, color: C.gold, letterSpacing: 1.5 }}>TARJETA DE EMBARQUE</span>
              </div>
              <h1 style={{ fontFamily: F.display, fontSize: "clamp(1.6rem, 4vw, 2.2rem)", fontWeight: 700, lineHeight: 1.15 }} className="truncate">
                {trip.name}
              </h1>
              {trip.destination && (
                <p className="flex items-center gap-1 mt-1" style={{ color: "#B9C3D6", fontSize: 13 }}>
                  <MapPin size={12} />{trip.destination}
                </p>
              )}
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              <button
                onClick={() => { navigator.clipboard?.writeText(session.code).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
                className="flex items-center gap-2"
                style={{ border: "1px solid #3A4A68", borderRadius: 5, padding: "6px 12px", fontFamily: F.mono, fontSize: 13, letterSpacing: 1.5, background: "rgba(255,255,255,0.06)", color: copied ? C.goldLight : C.paper, transition: "color 0.2s" }}
                title="Copiar código"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />} {session.code}
              </button>
              {days !== null && (
                <div className="text-right">
                  <div style={{ fontFamily: F.display, fontSize: 28, fontWeight: 700, color: C.goldLight, lineHeight: 1 }}>
                    {days > 0 ? days : days === 0 ? "✈" : "🌍"}
                  </div>
                  <div style={{ fontFamily: F.mono, fontSize: 9, color: "#7C8AA3", letterSpacing: 1 }}>
                    {days > 0 ? "DÍAS RESTANTES" : days === 0 ? "¡ES HOY!" : "EN CURSO"}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tab bar */}
          <nav className="flex no-scrollbar" style={{ borderTop: "1px dashed #2D3E5A", overflowX: "auto" }}>
            {tabs.map(({ id, label, Icon }) => (
              <button key={id} onClick={() => setTab(id)}
                className="flex items-center gap-1.5 whitespace-nowrap"
                style={{
                  padding: "10px 12px", fontFamily: F.mono, fontSize: 10, letterSpacing: 0.4,
                  color: tab === id ? C.paper : "#5C6D85",
                  borderBottom: tab === id ? `2px solid ${C.goldLight}` : "2px solid transparent",
                  transition: "color 0.15s",
                }}
                aria-current={tab === id ? "page" : undefined}
              >
                <Icon size={12} />{label.toUpperCase()}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main ref={contentRef as React.RefObject<HTMLElement>} className="max-w-4xl mx-auto px-4 py-6" style={{ opacity: 0 }}>
        {tab === "resumen"    && <Resumen trip={trip} session={session} days={days} darkMode={darkMode} />}
        {tab === "reservas"   && <Reservas code={session.code} session={session} darkMode={darkMode} />}
        {tab === "itinerario" && <Itinerario code={session.code} />}
        {tab === "mapa"       && <Mapa code={session.code} />}
        {tab === "fotos"      && <Fotos code={session.code} session={session} />}
        {tab === "diario"     && <Diario code={session.code} session={session} darkMode={darkMode} />}
        {tab === "checklist"  && <Checklist code={session.code} session={session} />}
        {tab === "gastos"     && <Gastos code={session.code} session={session} members={trip.members} darkMode={darkMode} />}
        {tab === "equipaje"   && <Equipaje code={session.code} session={session} />}
        {tab === "ideas"      && <Ideas code={session.code} session={session} />}
        {tab === "ahorro"     && <Ahorro code={session.code} members={trip.members} />}
        {tab === "destinos"   && <Destinos code={session.code} onSelect={() => setTab("itinerario")} />}
        {tab === "asistente"  && <AsistenteIA code={session.code} trip={trip} session={session} onImportItinerary={async (days) => { await saveShared(`itin:${session.code}`, days); setTab("itinerario"); }} />}
      </main>
      {syncToast && (
        <div style={{ position: "fixed", bottom: 20, right: 20, background: C.teal, color: "#fff", borderRadius: 20, padding: "8px 16px", fontSize: 12, fontFamily: "var(--font-mono)", zIndex: 9999, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }} className="fade-in">
          ✓ SINCRONIZADO
        </div>
      )}
      {pwaPrompt && !pwaDismissed && (
        <div className="fade-in" style={{ position: "fixed", bottom: 72, left: 12, right: 12, background: C.navy, borderRadius: 14, padding: "14px 16px", zIndex: 9998, display: "flex", alignItems: "center", gap: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: F.mono, fontSize: 11, color: C.goldLight, letterSpacing: 1, margin: 0 }}>INSTALAR APP</p>
            <p style={{ fontSize: 13, color: "#8BAFD4", marginTop: 2, margin: 0 }}>Añadir Bitácora a tu pantalla de inicio</p>
          </div>
          <button onClick={async () => { await pwaPrompt.prompt(); setPwaPrompt(null); }}
            style={{ background: C.teal, color: "#fff", borderRadius: 8, padding: "8px 14px", fontFamily: F.mono, fontSize: 11, whiteSpace: "nowrap" }}>
            INSTALAR
          </button>
          <button onClick={() => { localStorage.setItem("pwa_dismissed", "1"); setPwaDismissed(true); setPwaPrompt(null); }}
            style={{ color: "#8BAFD4", padding: 4 }}><X size={16} /></button>
        </div>
      )}
    </div>
  );
}

// ─── Resumen ──────────────────────────────────────────────────────────────────

function Resumen({ trip, session, days, darkMode }: { trip: Trip; session: Session; days: number | null; darkMode: boolean }) {
  const dur = tripDuration(trip.startDate, trip.endDate);
  const [coverUrl, setCoverUrl] = useState("");
  const [coverInput, setCoverInput] = useState("");
  const [showCoverEdit, setShowCoverEdit] = useState(false);
  const coverKey = `cover:${session.code}`;

  useEffect(() => {
    loadShared<string>(coverKey, "").then(u => { setCoverUrl(u); setCoverInput(u); });
  }, [coverKey]);

  async function saveCover() {
    await saveShared(coverKey, coverInput.trim());
    setCoverUrl(coverInput.trim());
    setShowCoverEdit(false);
  }

  const cardBg = darkMode ? "#161B22" : "#fff";
  const cardBorder = darkMode ? "#30363D" : C.line;
  const textColor = darkMode ? "#E6EDF3" : C.ink;
  const softColor = darkMode ? "#8B949E" : C.inkSoft;

  // Stagger entrance for the whole resumen section
  const sectionRef = useRef<HTMLDivElement>(null);
  useAnimeStagger(sectionRef);

  // Spring bounce for the countdown
  const countdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = countdownRef.current;
    if (!el || days === null) return;
    el.style.opacity = "0";
    el.style.transform = "scale(0.88)";
    animate(el, {
      opacity: [0, 1],
      scale: [0.88, 1],
      duration: 900,
      ease: spring({ stiffness: 180, damping: 14, mass: 1 }),
    });
  }, [days]);

  return (
    <div ref={sectionRef} className="flex flex-col gap-4">
      {/* Cover photo hero */}
      {(coverUrl || showCoverEdit) && (
        <div style={{ borderRadius: 14, overflow: "hidden", position: "relative" }}>
          {coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt="Portada del viaje" style={{ width: "100%", height: 200, objectFit: "cover", display: "block" }} onError={() => setCoverUrl("")} />
          )}
          {!coverUrl && <div style={{ height: 80, background: C.paperDark, display: "flex", alignItems: "center", justifyContent: "center", color: C.inkSoft, fontFamily: F.mono, fontSize: 12 }}>Sin foto de portada</div>}
          <button onClick={() => setShowCoverEdit(v => !v)} style={{ position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,0.55)", color: "#fff", borderRadius: 6, padding: "4px 10px", fontFamily: F.mono, fontSize: 10 }}>
            <Edit2 size={11} style={{ display: "inline", marginRight: 4 }} />PORTADA
          </button>
        </div>
      )}
      {!coverUrl && !showCoverEdit && (
        <button onClick={() => setShowCoverEdit(true)} style={{ border: `1px dashed ${C.line}`, borderRadius: 10, padding: "10px 16px", color: C.inkSoft, fontFamily: F.mono, fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
          <Camera size={13} /> AÑADIR FOTO DE PORTADA DEL VIAJE
        </button>
      )}
      {showCoverEdit && (
        <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 10, padding: "14px 16px" }} className="flex flex-col gap-2">
          <div style={{ fontFamily: F.mono, fontSize: 10, color: softColor }}>URL de imagen de portada</div>
          <div className="flex gap-2">
            <input value={coverInput} onChange={e => setCoverInput(e.target.value)} placeholder="https://…/foto.jpg"
              style={{ ...inputStyle, flex: 1, background: darkMode ? "#0D1117" : "#fff", color: textColor, border: `1px solid ${cardBorder}` }} />
            <button onClick={saveCover} style={{ background: C.teal, color: "#fff", borderRadius: 6, padding: "0 14px", fontFamily: F.mono, fontSize: 11 }}>OK</button>
            <button onClick={() => setShowCoverEdit(false)} style={{ color: softColor, padding: "0 8px" }}><X size={14} /></button>
          </div>
        </div>
      )}

      {/* Countdown hero card */}
      {days !== null && (
        <div ref={countdownRef} style={{ background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navyMid} 60%, #1A3560 100%)`, borderRadius: 14, padding: "26px 22px", color: C.paper, position: "relative", overflow: "hidden" }}>
          <div className="glow-pulse" style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: 999, background: `radial-gradient(circle, ${C.gold}30, transparent 70%)`, pointerEvents: "none" }} />
          <div className="glow-pulse" style={{ position: "absolute", bottom: -20, left: 20, width: 120, height: 120, borderRadius: 999, background: `radial-gradient(circle, ${C.teal}25, transparent 70%)`, pointerEvents: "none", animationDelay: "2s" }} />
          <div style={{ fontFamily: F.mono, fontSize: 10, color: C.gold, letterSpacing: 2.5 }}>CUENTA ATRÁS</div>
          <div style={{ fontFamily: F.display, fontSize: "clamp(3.2rem, 11vw, 5.5rem)", fontWeight: 700, color: C.goldLight, lineHeight: 1, marginTop: 4 }}>
            {days > 0 ? days : days === 0 ? "¡HOY!" : "¡EN MARCHA!"}
          </div>
          {days > 0 && <div style={{ fontFamily: F.mono, fontSize: 12, color: "#8BAFD4", marginTop: 4 }}>días para {trip.destination || trip.name}</div>}
          {trip.startDate && (
            <div style={{ marginTop: 12, fontFamily: F.mono, fontSize: 11, color: "#6080A4" }}>
              {formatDate(trip.startDate)}{trip.endDate ? ` → ${formatDate(trip.endDate)}` : ""}{dur ? ` · ${dur} días` : ""}
            </div>
          )}
        </div>
      )}

      {/* Crew */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <SectionLabel>Tripulación</SectionLabel>
          <span style={{ fontFamily: F.mono, fontSize: 11, background: C.paperDark, color: C.inkSoft, borderRadius: 999, padding: "1px 7px" }}>{trip.members.length}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {trip.members.map(m => {
            const isMe = m.toLowerCase() === session.name.toLowerCase();
            return (
              <div key={m} className="flex items-center gap-2 px-3 py-1.5 card-lift"
                style={{ background: isMe ? C.navy : C.paperDark, borderRadius: 999, fontSize: 13, color: isMe ? C.paper : C.ink, fontWeight: isMe ? 600 : 400, border: isMe ? `1px solid ${C.navyMid}` : `1px solid ${C.line}` }}>
                <div style={{ width: 22, height: 22, borderRadius: 999, background: isMe ? C.red : C.teal, color: "#fff", fontSize: 11, fontFamily: F.mono, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600 }}>
                  {m[0]?.toUpperCase()}
                </div>
                {m}
                {isMe && <span style={{ fontSize: 9, color: C.goldLight, fontFamily: F.mono }}>TÚ</span>}
              </div>
            );
          })}
          {trip.members.length === 0 && <p style={{ color: C.inkSoft, fontSize: 13 }}>Sin miembros todavía.</p>}
        </div>
      </Card>

      {/* Weather forecast */}
      <WeatherWidget destination={trip.destination} startDate={trip.startDate} endDate={trip.endDate} />

      {/* Invite + Print */}
      <InvitePanel code={session.code} trip={trip} darkMode={darkMode} />
    </div>
  );
}

function SyncButton({ code, onSync }: { code: string; onSync: (t: Trip) => void }) {
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "no_kv">("idle");

  async function sync() {
    setSyncing(true); setStatus("idle");
    try {
      const res = await fetch(`/api/store?key=${encodeURIComponent(`trip:${code}`)}`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          // Also update localStorage with the fresh data
          try { localStorage.setItem(`trip:${code}`, JSON.stringify(data)); } catch { /* ignore */ }
          onSync(data as Trip);
          setStatus("ok");
          setTimeout(() => setStatus("idle"), 2500);
          setSyncing(false);
          return;
        }
      }
      if (res.status === 503) {
        setStatus("no_kv");
        setTimeout(() => setStatus("idle"), 4000);
      }
    } catch { /* network error */ }
    setSyncing(false);
  }

  const label = status === "ok" ? "SINCRONIZADO" : status === "no_kv" ? "SIN KV" : "SYNC";
  const color = status === "ok" ? C.teal : status === "no_kv" ? C.gold : "#7C8AA3";
  const title = status === "no_kv" ? "Activa Vercel KV en el dashboard para sincronizar entre dispositivos" : "Sincronizar viaje";

  return (
    <button onClick={sync} disabled={syncing} title={title}
      style={{ color, padding: "4px 8px", borderRadius: 6, border: "1px solid #2D3E5A", display: "flex", alignItems: "center", gap: 4, fontFamily: "var(--font-mono)", fontSize: 10, transition: "color 0.2s" }}>
      {status === "ok" ? <Check size={11} /> : <RefreshCw size={11} className={syncing ? "animate-spin" : ""} />}
      {label}
    </button>
  );
}

function InvitePanel({ code, trip, darkMode }: { code: string; trip: Trip; darkMode: boolean }) {
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

// ─── Itinerario ───────────────────────────────────────────────────────────────

function Itinerario({ code }: { code: string }) {
  const [days, setDays] = useState<ItineraryDay[]>([]);
  const [loading, setLoading] = useState(true);
  const key = `itin:${code}`;
  useEffect(() => { loadShared<ItineraryDay[]>(key, []).then(d => { setDays(d); setLoading(false); }); }, [key]);
  const persist = useCallback(async (next: ItineraryDay[]) => { setDays(next); await saveShared(key, next); }, [key]);

  const addDay = () => persist([...days, { id: uid(), date: "", title: `Día ${days.length + 1}`, items: [] }]);
  const removeDay = (id: string) => persist(days.filter(d => d.id !== id));
  const updateDay = (id: string, p: Partial<ItineraryDay>) => persist(days.map(d => d.id === id ? { ...d, ...p } : d));
  const addItem = (dayId: string) => persist(days.map(d => d.id === dayId ? { ...d, items: [...d.items, { id: uid(), time: "", text: "" }] } : d));
  const updateItem = (dayId: string, itemId: string, p: Partial<ItineraryItem>) =>
    persist(days.map(d => d.id === dayId ? { ...d, items: d.items.map(it => it.id === itemId ? { ...it, ...p } : it) } : d));
  const removeItem = (dayId: string, itemId: string) =>
    persist(days.map(d => d.id === dayId ? { ...d, items: d.items.filter(it => it.id !== itemId) } : d));

  if (loading) return <SkeletonCards />;
  return (
    <div className="flex flex-col gap-4">
      {days.map(d => (
        <Card key={d.id}>
          <div className="flex items-start gap-3">
            <div className="flex-1 flex flex-col gap-2">
              <input value={d.title} onChange={e => updateDay(d.id, { title: e.target.value })}
                style={{ ...inputStyle, fontFamily: F.display, fontWeight: 700, fontSize: 20, border: "none", padding: 0, background: "transparent" }} placeholder="Título del día" />
              {d.date && <p style={{ fontFamily: F.mono, fontSize: 10, color: C.gold, letterSpacing: 0.5 }}>{formatDateFull(d.date)}</p>}
              <input type="date" value={d.date} onChange={e => updateDay(d.id, { date: e.target.value })} style={{ ...inputStyle, width: 175, fontSize: 13 }} />
            </div>
            <button onClick={() => removeDay(d.id)} style={{ color: C.inkSoft, padding: 4 }} aria-label="Eliminar día"><Trash2 size={15} /></button>
          </div>
          <Perf />
          <div className="flex flex-col gap-2">
            {d.items.map(it => (
              <div key={it.id} className="flex items-center gap-2">
                <input value={it.time} onChange={e => updateItem(d.id, it.id, { time: e.target.value })} placeholder="10:00" maxLength={5}
                  style={{ ...inputStyle, width: 72, fontFamily: F.mono, fontSize: 12 }} />
                <input value={it.text} onChange={e => updateItem(d.id, it.id, { text: e.target.value })}
                  onKeyDown={e => e.key === "Enter" && addItem(d.id)} placeholder="Visita al Partenón…" style={{ ...inputStyle, flex: 1 }} />
                <button onClick={() => removeItem(d.id, it.id)} style={{ color: C.inkSoft, padding: 4 }} aria-label="Eliminar"><X size={15} /></button>
              </div>
            ))}
            {d.items.length === 0 && <p style={{ color: C.inkSoft, fontSize: 13 }}>Sin paradas todavía.</p>}
          </div>
          <button onClick={() => addItem(d.id)} className="flex items-center gap-1 mt-3" style={{ fontFamily: F.mono, fontSize: 12, color: C.teal }}>
            <Plus size={13} /> AÑADIR PARADA
          </button>
        </Card>
      ))}
      <button onClick={addDay} className="flex items-center justify-center gap-2 py-3"
        style={{ border: `1px dashed ${C.line}`, borderRadius: 8, color: C.inkSoft, fontFamily: F.mono, fontSize: 13 }}
        onMouseOver={e => (e.currentTarget.style.background = C.paperDark)}
        onMouseOut={e => (e.currentTarget.style.background = "transparent")}>
        <Plus size={15} /> AÑADIR DÍA
      </button>
      {days.length === 0 && <EmptyState icon={<Plane size={28} color={C.line} />} text="El itinerario está vacío. Añade el primer día." />}
    </div>
  );
}

// ─── Mapa ─────────────────────────────────────────────────────────────────────

function Mapa({ code }: { code: string }) {
  const [places, setPlaces] = useState<MapPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingLatLon, setPendingLatLon] = useState<{ lat: number; lon: number } | null>(null);
  const [form, setForm] = useState({ name: "", note: "" });
  const [err, setErr] = useState("");
  const key = `mapa:${code}`;
  useEffect(() => { loadShared<MapPlace[]>(key, []).then(p => { setPlaces(p); setLoading(false); }); }, [key]);
  const persist = useCallback(async (next: MapPlace[]) => { setPlaces(next); await saveShared(key, next); }, [key]);

  function handleMapClick(lat: number, lon: number) {
    setPendingLatLon({ lat, lon });
    setErr("");
  }

  function addPlace() {
    setErr("");
    if (!form.name.trim()) { setErr("Escribe un nombre para el lugar."); return; }
    if (!pendingLatLon) { setErr("Haz clic en el mapa para marcar la ubicación."); return; }
    persist([...places, { id: uid(), name: form.name.trim(), lat: pendingLatLon.lat, lon: pendingLatLon.lon, note: form.note.trim() }]);
    setForm({ name: "", note: "" });
    setPendingLatLon(null);
  }

  if (loading) return <SkeletonCards />;

  return (
    <div className="flex flex-col gap-4">
      {/* Map first */}
      <Card style={{ padding: 8 }}>
        <LeafletMap places={places} onMapClick={handleMapClick} pendingLatLon={pendingLatLon} height="380px" />
        {pendingLatLon ? (
          <p style={{ color: C.teal, fontSize: 12, fontFamily: F.mono, marginTop: 6, textAlign: "center" }}>
            📍 {pendingLatLon.lat.toFixed(4)}, {pendingLatLon.lon.toFixed(4)} — Añade el nombre abajo
          </p>
        ) : (
          <p style={{ color: C.inkSoft, fontSize: 12, fontFamily: F.mono, marginTop: 6, textAlign: "center" }}>
            Haz clic en el mapa para añadir un lugar · Clic en un pin para ver detalles
          </p>
        )}
      </Card>

      {/* Add place form */}
      <Card>
        <SectionLabel>Añadir lugar</SectionLabel>
        <div className="flex flex-wrap gap-2 mt-3">
          <input placeholder="Nombre del lugar" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            style={{ ...inputStyle, flex: "2 1 180px" }} />
          <input placeholder="Nota (opcional)" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}
            onKeyDown={e => e.key === "Enter" && addPlace()}
            style={{ ...inputStyle, flex: "2 1 180px" }} />
          <button onClick={addPlace} style={{ background: pendingLatLon ? C.navy : C.inkSoft, color: C.paper, borderRadius: 5, padding: "0 18px", fontFamily: F.mono, fontSize: 12, height: 39, transition: "background 0.2s" }}>
            AÑADIR
          </button>
        </div>
        {err && <Banner type="error" msg={err} />}
      </Card>

      {/* Places list */}
      <div className="flex flex-col gap-2">
        {places.map(p => (
          <div key={p.id} className="flex items-center justify-between px-3 py-2 card-lift"
            style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 6 }}>
            <div>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</span>
              {p.note && <span style={{ color: C.inkSoft, fontSize: 13 }}> — {p.note}</span>}
              <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkSoft, marginLeft: 8 }}>{p.lat.toFixed(4)}, {p.lon.toFixed(4)}</span>
            </div>
            <button onClick={() => persist(places.filter(x => x.id !== p.id))} style={{ color: C.inkSoft, padding: 4 }}><Trash2 size={14} /></button>
          </div>
        ))}
        {places.length === 0 && <EmptyState icon={<MapPin size={28} color={C.line} />} text="Haz clic en el mapa para añadir el primer lugar." />}
      </div>
    </div>
  );
}

// ─── Fotos ────────────────────────────────────────────────────────────────────

function compressImage(file: File): Promise<string> {
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

function Fotos({ code, session }: { code: string; session: Session }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ url: "", caption: "" });
  const [err, setErr] = useState("");
  const [lightbox, setLightbox] = useState<Photo | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const key = `fotos:${code}`;
  useEffect(() => { loadShared<Photo[]>(key, []).then(p => { setPhotos(p); setLoading(false); }); }, [key]);
  const persist = useCallback(async (next: Photo[]) => { setPhotos(next); await saveShared(key, next); }, [key]);

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
      <div className="flex flex-col gap-4">
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
            <div key={p.id} className="card-lift" style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, padding: 8 }}>
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
          ))}
        </div>
        {photos.length === 0 && <EmptyState icon={<Camera size={28} color={C.line} />} text="Aún no hay fotos. ¡Sé el primero!" />}
      </div>
    </>
  );
}

// ─── Checklist ────────────────────────────────────────────────────────────────

function Checklist({ code, session }: { code: string; session: Session }) {
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
          <SectionLabel>Presupuesto</SectionLabel>
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

// ─── Gastos divididos ─────────────────────────────────────────────────────────

function calculateSettlements(expenses: Expense[], members: string[]) {
  if (members.length === 0) return [];
  const balances: Record<string, number> = {};
  members.forEach(m => (balances[m] = 0));

  for (const exp of expenses) {
    const involved = exp.splitWith.length > 0 ? exp.splitWith : members;
    const share = exp.amount / involved.length;
    balances[exp.paidBy] = (balances[exp.paidBy] || 0) + exp.amount - share;
    involved.forEach(m => { if (m !== exp.paidBy) balances[m] = (balances[m] || 0) - share; });
  }

  const debtors = Object.entries(balances).filter(([, b]) => b < -0.01).map(([n, b]) => ({ name: n, amount: Math.abs(b) })).sort((a, b) => b.amount - a.amount);
  const creditors = Object.entries(balances).filter(([, b]) => b > 0.01).map(([n, b]) => ({ name: n, amount: b })).sort((a, b) => b.amount - a.amount);
  const settlements: { from: string; to: string; amount: number }[] = [];
  let di = 0, ci = 0;
  const d = debtors.map(x => ({ ...x })), c = creditors.map(x => ({ ...x }));
  while (di < d.length && ci < c.length) {
    const pay = Math.min(d[di].amount, c[ci].amount);
    if (pay > 0.01) settlements.push({ from: d[di].name, to: c[ci].name, amount: pay });
    d[di].amount -= pay; c[ci].amount -= pay;
    if (d[di].amount < 0.01) di++;
    if (c[ci].amount < 0.01) ci++;
  }
  return settlements;
}

function Gastos({ code, session, members, darkMode }: { code: string; session: Session; members: string[]; darkMode: boolean }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ description: "", amount: "", paidBy: session.name, category: EXPENSE_CATEGORIES[0], date: "", splitWith: [] as string[] });
  const [err, setErr] = useState("");
  const [showSettle, setShowSettle] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filterCat, setFilterCat] = useState("");
  const [filterPerson, setFilterPerson] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const key = `gastos:${code}`;
  useEffect(() => { loadShared<Expense[]>(key, []).then(e => { setExpenses(e); setLoading(false); }); }, [key]);
  const persist = useCallback(async (next: Expense[]) => { setExpenses(next); await saveShared(key, next); }, [key]);

  function addExpense() {
    setErr("");
    if (!form.description.trim()) { setErr("Escribe una descripción."); return; }
    const amount = parseFloat(form.amount.replace(",", "."));
    if (isNaN(amount) || amount <= 0) { setErr("Importe inválido."); return; }
    if (!form.paidBy) { setErr("¿Quién pagó?"); return; }
    persist([...expenses, { id: uid(), description: form.description.trim(), amount, paidBy: form.paidBy, splitWith: form.splitWith, category: form.category, date: form.date || new Date().toISOString().slice(0, 10) }]);
    setForm(f => ({ ...f, description: "", amount: "", date: "" }));
  }

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      if (filterCat && e.category !== filterCat) return false;
      if (filterPerson && e.paidBy !== filterPerson) return false;
      if (filterFrom && e.date < filterFrom) return false;
      if (filterTo && e.date > filterTo) return false;
      return true;
    });
  }, [expenses, filterCat, filterPerson, filterFrom, filterTo]);

  const activeFilters = [filterCat, filterPerson, filterFrom, filterTo].filter(Boolean).length;

  const total = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);
  const perPerson = useMemo(() => {
    const m: Record<string, number> = {};
    members.forEach(mb => (m[mb] = 0));
    expenses.forEach(e => {
      const involved = e.splitWith.length > 0 ? e.splitWith : members;
      const share = e.amount / involved.length;
      m[e.paidBy] = (m[e.paidBy] || 0) + e.amount;
      involved.forEach(mb => (m[mb] = (m[mb] || 0) - share));
    });
    return m;
  }, [expenses, members]);

  const settlements = useMemo(() => calculateSettlements(expenses, members), [expenses, members]);

  if (loading) return <SkeletonCards />;

  return (
    <div className="flex flex-col gap-4">
      {/* Add form */}
      <Card>
        <SectionLabel>Añadir gasto</SectionLabel>
        <div className="flex flex-col gap-3 mt-3">
          <div className="flex flex-wrap gap-2">
            <input placeholder="Descripción (cena, taxi…)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              onKeyDown={e => e.key === "Enter" && addExpense()} style={{ ...inputStyle, flex: "2 1 160px" }} />
            <div style={{ position: "relative", width: 110 }}>
              <input placeholder="0,00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} style={{ ...inputStyle, fontFamily: F.mono, paddingRight: 22 }} />
              <Euro size={11} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: C.inkSoft }} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={form.paidBy} onChange={e => setForm({ ...form, paidBy: e.target.value })} style={{ ...inputStyle, flex: "1 1 120px", appearance: "none" }}>
              {members.length > 0 ? members.map(m => <option key={m} value={m}>{m}</option>) : <option value={session.name}>{session.name}</option>}
            </select>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={{ ...inputStyle, flex: "1 1 140px", appearance: "none" }}>
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={{ ...inputStyle, flex: "0 1 160px" }} />
          </div>
          {members.length > 1 && (
            <div>
              <SectionLabel>Dividir entre (vacío = todos)</SectionLabel>
              <div className="flex flex-wrap gap-2 mt-2">
                {members.map(m => {
                  const checked = form.splitWith.includes(m);
                  return (
                    <button key={m} onClick={() => setForm(f => ({ ...f, splitWith: checked ? f.splitWith.filter(x => x !== m) : [...f.splitWith, m] }))}
                      style={{ padding: "4px 10px", borderRadius: 999, fontSize: 12, fontFamily: F.mono, background: checked ? C.teal : C.paperDark, color: checked ? "#fff" : C.inkSoft, border: `1px solid ${checked ? C.teal : C.line}`, transition: "all 0.15s" }}>
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {err && <Banner type="error" msg={err} />}
          <button onClick={addExpense} style={{ background: C.navy, color: C.paper, borderRadius: 5, padding: "11px 16px", fontFamily: F.mono, fontSize: 12, letterSpacing: 0.4 }}>AÑADIR GASTO</button>
        </div>
      </Card>

      {/* Summary */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>Resumen</SectionLabel>
          <span style={{ fontFamily: F.display, fontSize: 22, fontWeight: 700, color: C.ink }}>{total.toFixed(2)} €</span>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.entries(perPerson).map(([name, bal]) => (
            <div key={name} style={{ flex: "1 1 110px", background: C.paperDark, borderRadius: 6, padding: "10px 12px", textAlign: "center" }}>
              <div style={{ fontFamily: F.mono, fontSize: 11, color: C.inkSoft }}>{name}</div>
              <div style={{ fontFamily: F.display, fontSize: 18, fontWeight: 700, color: bal >= 0 ? C.green : C.red, marginTop: 2 }}>
                {bal >= 0 ? "+" : ""}{bal.toFixed(2)} €
              </div>
              <div style={{ fontFamily: F.mono, fontSize: 9, color: C.inkSoft }}>{bal >= 0 ? "A COBRAR" : "A PAGAR"}</div>
            </div>
          ))}
        </div>

        {settlements.length > 0 && (
          <>
            <button onClick={() => setShowSettle(v => !v)} className="flex items-center gap-1" style={{ fontFamily: F.mono, fontSize: 11, color: C.inkSoft }}>
              <ChevronDown size={13} style={{ transform: showSettle ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} /> LIQUIDACIONES
            </button>
            {showSettle && (
              <div className="flex flex-col gap-2 mt-3">
                {settlements.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded" style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>{s.from}</span>
                    <span style={{ color: C.inkSoft }}>le paga</span>
                    <span style={{ fontWeight: 600 }}>{s.to}</span>
                    <span style={{ marginLeft: "auto", fontFamily: F.mono, fontWeight: 700, color: C.green }}>{s.amount.toFixed(2)} €</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {expenses.length > 0 && settlements.length === 0 && (
          <p style={{ fontSize: 13, color: C.green, fontFamily: F.mono }}>✓ TODO SALDADO</p>
        )}
      </Card>

      {/* Filters */}
      <div>
        <button onClick={() => setShowFilters(v => !v)} className="flex items-center gap-2"
          style={{ fontFamily: F.mono, fontSize: 11, color: activeFilters > 0 ? C.teal : C.inkSoft, border: `1px solid ${activeFilters > 0 ? C.teal : C.line}`, borderRadius: 6, padding: "6px 12px" }}>
          <Filter size={12} /> FILTRAR {activeFilters > 0 && `(${activeFilters} activos)`}
        </button>
        {showFilters && (
          <div style={{ background: darkMode ? "#161B22" : C.paperDark, borderRadius: 10, padding: "12px 14px", marginTop: 8 }} className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ ...inputStyle, flex: "1 1 140px", appearance: "none", background: darkMode ? "#0D1117" : "#fff", color: darkMode ? "#E6EDF3" : C.ink }}>
                <option value="">Todas las categorías</option>
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filterPerson} onChange={e => setFilterPerson(e.target.value)} style={{ ...inputStyle, flex: "1 1 110px", appearance: "none", background: darkMode ? "#0D1117" : "#fff", color: darkMode ? "#E6EDF3" : C.ink }}>
                <option value="">Todas las personas</option>
                {members.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} placeholder="Desde"
                style={{ ...inputStyle, flex: "0 1 155px", background: darkMode ? "#0D1117" : "#fff", color: darkMode ? "#E6EDF3" : C.ink }} />
              <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} placeholder="Hasta"
                style={{ ...inputStyle, flex: "0 1 155px", background: darkMode ? "#0D1117" : "#fff", color: darkMode ? "#E6EDF3" : C.ink }} />
            </div>
            {activeFilters > 0 && (
              <button onClick={() => { setFilterCat(""); setFilterPerson(""); setFilterFrom(""); setFilterTo(""); }}
                style={{ fontFamily: F.mono, fontSize: 10, color: C.coral, alignSelf: "flex-start" }}>
                <X size={10} style={{ display: "inline" }} /> LIMPIAR FILTROS
              </button>
            )}
          </div>
        )}
      </div>

      {activeFilters > 0 && (
        <div style={{ fontFamily: F.mono, fontSize: 11, color: C.inkSoft }}>
          Mostrando {filteredExpenses.length} de {expenses.length} gastos · total filtrado: {filteredExpenses.reduce((s,e) => s+e.amount,0).toFixed(2)} €
        </div>
      )}

      {/* List */}
      <div className="flex flex-col gap-2">
        {filteredExpenses.map(e => (
          <div key={e.id} className="flex items-center gap-3 px-3 py-2" style={{ background: darkMode ? "#161B22" : "#fff", border: `1px solid ${darkMode ? "#30363D" : C.line}`, borderRadius: 6 }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>{e.category.split(" ")[0]}</span>
            <div className="flex-1 min-w-0">
              <div style={{ fontWeight: 600, fontSize: 14, color: darkMode ? "#E6EDF3" : C.ink }}>{e.description}</div>
              <div style={{ fontFamily: F.mono, fontSize: 11, color: darkMode ? "#8B949E" : C.inkSoft }}>
                Pagó {e.paidBy}{e.splitWith.length > 0 ? ` · con ${e.splitWith.join(", ")}` : " · todos"} · {e.date}
              </div>
            </div>
            <span style={{ fontFamily: F.mono, fontSize: 14, fontWeight: 700, color: darkMode ? "#E6EDF3" : C.ink, flexShrink: 0 }}>{e.amount.toFixed(2)} €</span>
            <button onClick={() => persist(expenses.filter(x => x.id !== e.id))} style={{ color: darkMode ? "#8B949E" : C.inkSoft, padding: 4 }}><Trash2 size={14} /></button>
          </div>
        ))}
        {filteredExpenses.length === 0 && expenses.length > 0 && <EmptyState icon={<Filter size={28} color={C.line} />} text="Ningún gasto coincide con los filtros." />}
        {expenses.length === 0 && <EmptyState icon={<Wallet size={28} color={C.line} />} text="Sin gastos todavía. Añade el primero." />}
      </div>
    </div>
  );
}

// ─── Equipaje ─────────────────────────────────────────────────────────────────

const PACKING_TEMPLATES: Record<string, string[]> = {
  "📄 Documentos":  ["DNI / Pasaporte", "Seguro de viaje", "Tarjeta de crédito", "Reservas imprimidas", "EHIC / tarjeta sanitaria"],
  "👕 Ropa":        ["Camisetas", "Pantalones", "Ropa interior", "Calcetines", "Abrigo / chaqueta", "Bañador", "Ropa de deporte"],
  "🔌 Electrónica": ["Cargador móvil", "Adaptador enchufe", "Auriculares", "Power bank", "Cámara de fotos"],
  "🧴 Higiene":     ["Cepillo de dientes", "Pasta de dientes", "Champú", "Desodorante", "Crema solar"],
  "💊 Medicamentos":["Analgésicos", "Antidiarreicos", "Tiritas", "Pastillas para el mareo"],
};

function Equipaje({ code, session }: { code: string; session: Session }) {
  const [items, setItems] = useState<PackingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>(PACKING_CATEGORIES[0]);
  const [text, setText] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set(PACKING_CATEGORIES));
  const key = `equipaje:${code}`;
  useEffect(() => { loadShared<PackingItem[]>(key, []).then(it => { setItems(it); setLoading(false); }); }, [key]);
  const persist = useCallback(async (next: PackingItem[]) => { setItems(next); await saveShared(key, next); }, [key]);

  function addItem() {
    if (!text.trim()) return;
    persist([...items, { id: uid(), text: text.trim(), category: activeCategory, checkedBy: [] }]);
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

  const totalItems = items.length;
  const checkedItems = items.filter(it => it.checkedBy.length > 0).length;

  if (loading) return <SkeletonCards />;

  return (
    <div className="flex flex-col gap-4">
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

      {/* By category */}
      {PACKING_CATEGORIES.map(cat => {
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
                    <div key={it.id} className="flex items-center gap-3 px-4 py-2" style={{ borderBottom: `1px solid ${C.paperDark}` }}>
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

// ─── Ideas / Votos ────────────────────────────────────────────────────────────

function Ideas({ code, session }: { code: string; session: Session }) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState(""); const [note, setNote] = useState("");
  const key = `ideas:${code}`;
  useEffect(() => { loadShared<Idea[]>(key, []).then(it => { setIdeas(it); setLoading(false); }); }, [key]);
  const persist = useCallback(async (next: Idea[]) => { setIdeas(next); await saveShared(key, next); }, [key]);

  function addIdea() {
    if (!text.trim()) return;
    persist([...ideas, { id: uid(), text: text.trim(), author: session.name, note: note.trim(), votes: {}, addedAt: Date.now() }]);
    setText(""); setNote("");
  }

  function vote(id: string, val: 1 | -1) {
    persist(ideas.map(idea => {
      if (idea.id !== id) return idea;
      const current = idea.votes[session.name];
      const newVotes = { ...idea.votes };
      if (current === val) delete newVotes[session.name];
      else newVotes[session.name] = val;
      return { ...idea, votes: newVotes };
    }));
  }

  const sorted = useMemo(() => [...ideas].sort((a, b) => {
    const scoreA = Object.values(a.votes).reduce((s, v) => s + v, 0);
    const scoreB = Object.values(b.votes).reduce((s, v) => s + v, 0);
    return scoreB - scoreA;
  }), [ideas]);

  if (loading) return <SkeletonCards />;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <SectionLabel>Proponer idea</SectionLabel>
        <p style={{ color: C.inkSoft, fontSize: 12, marginTop: 4 }}>Actividades, restaurantes, planes… El grupo vota.</p>
        <div className="flex flex-col gap-2 mt-3">
          <input placeholder="Ej. Visitar el cabo de Gata al atardecer" value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addIdea()} style={inputStyle} />
          <input placeholder="Nota o enlace (opcional)" value={note} onChange={e => setNote(e.target.value)} style={inputStyle} />
          <button onClick={addIdea} style={{ background: C.navy, color: C.paper, borderRadius: 5, padding: "11px 16px", fontFamily: F.mono, fontSize: 12 }}>PROPONER</button>
        </div>
      </Card>

      <div className="flex flex-col gap-3">
        {sorted.map(idea => {
          const score = Object.values(idea.votes).reduce((s, v) => s + v, 0);
          const myVote = idea.votes[session.name];
          const upCount = Object.values(idea.votes).filter(v => v === 1).length;
          const downCount = Object.values(idea.votes).filter(v => v === -1).length;
          return (
            <Card key={idea.id} className="card-lift" style={{ padding: "14px 16px" }}>
              <div className="flex items-start gap-3">
                {/* Vote column */}
                <div className="flex flex-col items-center gap-1 shrink-0" style={{ minWidth: 40 }}>
                  <button className="vote-btn" onClick={() => vote(idea.id, 1)}
                    style={{ color: myVote === 1 ? C.green : C.line, display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <ThumbsUp size={18} fill={myVote === 1 ? C.green : "none"} />
                    <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkSoft }}>{upCount}</span>
                  </button>
                  <div style={{ fontFamily: F.display, fontSize: 18, fontWeight: 700, color: score > 0 ? C.green : score < 0 ? C.red : C.inkSoft }}>{score > 0 ? "+" : ""}{score}</div>
                  <button className="vote-btn" onClick={() => vote(idea.id, -1)}
                    style={{ color: myVote === -1 ? C.red : C.line, display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <ThumbsDown size={18} fill={myVote === -1 ? C.red : "none"} />
                    <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkSoft }}>{downCount}</span>
                  </button>
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p style={{ fontWeight: 600, fontSize: 15, color: C.ink }}>{idea.text}</p>
                  {idea.note && (
                    isValidUrl(idea.note)
                      ? <a href={idea.note} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1" style={{ color: C.sky, fontSize: 12, marginTop: 3 }}><ExternalLink size={11} />{idea.note.slice(0, 50)}…</a>
                      : <p style={{ color: C.inkSoft, fontSize: 13, marginTop: 3 }}>{idea.note}</p>
                  )}
                  <p style={{ fontFamily: F.mono, fontSize: 10, color: C.inkSoft, marginTop: 4 }}>Por {idea.author}</p>
                </div>
                <button onClick={() => persist(ideas.filter(x => x.id !== idea.id))} style={{ color: C.inkSoft, padding: 4, flexShrink: 0 }}><Trash2 size={14} /></button>
              </div>
            </Card>
          );
        })}
        {ideas.length === 0 && <EmptyState icon={<Lightbulb size={28} color={C.line} />} text="Sin ideas todavía. ¡Propón la primera actividad!" />}
      </div>
    </div>
  );
}

// ─── Ahorro (Plan de ahorro por fases) ────────────────────────────────────────

function formatMonth(dateStr: string) {
  if (!dateStr) return "";
  return new Date(dateStr + "-01T12:00:00").toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

function monthsBetween(start: string, end: string): number {
  if (!start || !end) return 1;
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  return Math.max(1, (ey - sy) * 12 + (em - sm) + 1);
}

function Ahorro({ code, members }: { code: string; members: string[] }) {
  const [config, setConfig] = useState<SavingsConfig>({ targetBudget: 0, phases: [] });
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState(false);
  const [targetInput, setTargetInput] = useState("");
  const [editN, setEditN] = useState(false);
  const [nInput, setNInput] = useState("");
  const [phaseForm, setPhaseForm] = useState({ name: "", startDate: "", endDate: "", amountPerPerson: "" });
  const [phaseErr, setPhaseErr] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const key = `ahorro:${code}`;

  const defaultN = Math.max(members.length, 1);
  const n = config.numPersonas != null ? config.numPersonas : defaultN;

  useEffect(() => {
    loadShared<SavingsConfig>(key, { targetBudget: 0, phases: [] }).then(c => {
      setConfig(c);
      setTargetInput(c.targetBudget > 0 ? c.targetBudget.toString() : "");
      setNInput((c.numPersonas ?? Math.max(members.length, 1)).toString());
      setLoading(false);
    });
  }, [key, members.length]);

  const persist = useCallback(async (next: SavingsConfig) => {
    setConfig(next);
    await saveShared(key, next);
  }, [key]);

  function saveTarget() {
    const v = parseFloat(targetInput.replace(",", "."));
    persist({ ...config, targetBudget: isNaN(v) || v < 0 ? 0 : v });
    setEditTarget(false);
  }

  function saveN() {
    const v = parseInt(nInput);
    const num = isNaN(v) || v < 1 ? defaultN : v;
    persist({ ...config, numPersonas: num });
    setNInput(num.toString());
    setEditN(false);
  }

  function addPhase() {
    setPhaseErr("");
    if (!phaseForm.name.trim()) { setPhaseErr("Ponle un nombre a la fase."); return; }
    const amount = parseFloat(phaseForm.amountPerPerson.replace(",", "."));
    if (isNaN(amount) || amount <= 0) { setPhaseErr("Introduce un importe por persona válido."); return; }
    if (!phaseForm.startDate || !phaseForm.endDate) { setPhaseErr("Selecciona las fechas de inicio y fin."); return; }
    if (phaseForm.endDate < phaseForm.startDate) { setPhaseErr("La fecha de fin debe ser posterior a la de inicio."); return; }

    if (editingId) {
      persist({ ...config, phases: config.phases.map(p => p.id === editingId ? { ...p, ...phaseForm, amountPerPerson: amount } : p) });
      setEditingId(null);
    } else {
      persist({ ...config, phases: [...config.phases, { id: uid(), name: phaseForm.name.trim(), startDate: phaseForm.startDate, endDate: phaseForm.endDate, amountPerPerson: amount }] });
    }
    setPhaseForm({ name: "", startDate: "", endDate: "", amountPerPerson: "" });
  }

  function startEdit(phase: SavingsPhase) {
    setEditingId(phase.id);
    setPhaseForm({ name: phase.name, startDate: phase.startDate, endDate: phase.endDate, amountPerPerson: phase.amountPerPerson.toString() });
  }

  function cancelEdit() { setEditingId(null); setPhaseForm({ name: "", startDate: "", endDate: "", amountPerPerson: "" }); setPhaseErr(""); }

  function removePhase(id: string) {
    persist({ ...config, phases: config.phases.filter(p => p.id !== id) });
    if (editingId === id) cancelEdit();
  }

  // Cumulative per phase — each phase total = monthly amount × months × people
  const phasesWithCumulative = useMemo(() => {
    let cum = 0;
    return config.phases.map(p => {
      const months = monthsBetween(p.startDate, p.endDate);
      const phaseTotal = p.amountPerPerson * months * n;
      cum += phaseTotal;
      return { ...p, months, totalPhase: phaseTotal, perPersonTotal: p.amountPerPerson * months, cumulative: cum };
    });
  }, [config.phases, n]);

  const totalPerPerson = useMemo(() => phasesWithCumulative.reduce((s, p) => s + p.perPersonTotal, 0), [phasesWithCumulative]);
  const totalGroup     = phasesWithCumulative.reduce((s, p) => s + p.totalPhase, 0);
  const target         = config.targetBudget;
  const covered        = target > 0 ? Math.min((totalGroup / target) * 100, 100) : 0;

  if (loading) return <SkeletonCards />;

  return (
    <div className="flex flex-col gap-5">
      {/* Header card */}
      <div style={{ background: `linear-gradient(135deg, ${C.navy}, ${C.navyMid})`, borderRadius: 12, padding: "22px 20px", color: C.paper, position: "relative", overflow: "hidden" }} className="dot-grid">
        <div className="glow-pulse" style={{ position: "absolute", top: -30, right: -30, width: 130, height: 130, borderRadius: 999, background: `radial-gradient(circle, ${C.gold}25, transparent 70%)`, pointerEvents: "none" }} />
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: C.gold, letterSpacing: 1.5 }}>BOTE DEL VIAJE</div>
            <div style={{ fontFamily: F.display, fontSize: "clamp(2rem,8vw,3rem)", fontWeight: 700, color: C.goldLight, lineHeight: 1, marginTop: 4 }}>
              {totalGroup.toFixed(2)} €
            </div>
            <div className="flex items-center gap-2 mt-2">
              {editN ? (
                <div className="flex items-center gap-1">
                  <input
                    value={nInput}
                    onChange={e => setNInput(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={e => { if (e.key === "Enter") saveN(); if (e.key === "Escape") setEditN(false); }}
                    style={{ ...inputStyle, width: 52, fontFamily: F.mono, fontSize: 13, textAlign: "center", padding: "4px 6px" }}
                    autoFocus
                  />
                  <button onClick={saveN} style={{ color: C.goldLight }}><Check size={14} /></button>
                  <button onClick={() => setEditN(false)} style={{ color: "#7C8AA3" }}><X size={13} /></button>
                </div>
              ) : (
                <button onClick={() => { setNInput(n.toString()); setEditN(true); }} className="flex items-center gap-1"
                  style={{ fontFamily: F.mono, fontSize: 11, color: "#9FAEC4" }}>
                  {n} {n === 1 ? "persona" : "personas"} <Edit2 size={11} color="#5C6D85" />
                </button>
              )}
              <span style={{ fontFamily: F.mono, fontSize: 11, color: "#9FAEC4" }}>· {totalPerPerson.toFixed(2)} € por persona</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div style={{ fontFamily: F.mono, fontSize: 10, color: "#7C8AA3" }}>OBJETIVO</div>
            {editTarget ? (
              <div className="flex items-center gap-2">
                <input value={targetInput} onChange={e => setTargetInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") saveTarget(); if (e.key === "Escape") setEditTarget(false); }}
                  style={{ ...inputStyle, width: 110, fontFamily: F.mono, fontSize: 14, textAlign: "right" }} autoFocus placeholder="0,00" />
                <button onClick={saveTarget} style={{ color: C.goldLight }}><Check size={16} /></button>
                <button onClick={() => setEditTarget(false)} style={{ color: "#7C8AA3" }}><X size={14} /></button>
              </div>
            ) : (
              <button onClick={() => setEditTarget(true)} className="flex items-center gap-1"
                style={{ fontFamily: F.display, fontSize: 22, fontWeight: 700, color: target > 0 ? C.goldLight : "#3A4A68" }}>
                {target > 0 ? `${target.toFixed(2)} €` : "Fijar objetivo"}
                <Edit2 size={13} color="#7C8AA3" />
              </button>
            )}
          </div>
        </div>

        {/* Progress toward target */}
        {target > 0 && (
          <div className="mt-4">
            <div style={{ background: "rgba(255,255,255,0.1)", height: 10, borderRadius: 999, overflow: "hidden" }}>
              <div className="progress-bar" style={{ background: covered >= 100 ? C.green : C.goldLight, height: "100%", width: `${covered}%`, borderRadius: 999 }} />
            </div>
            <div className="flex justify-between mt-1">
              <span style={{ fontFamily: F.mono, fontSize: 10, color: "#7C8AA3" }}>{covered.toFixed(0)}% del objetivo</span>
              {totalGroup < target && <span style={{ fontFamily: F.mono, fontSize: 10, color: "#7C8AA3" }}>Faltan {(target - totalGroup).toFixed(2)} €</span>}
              {totalGroup >= target && <span style={{ fontFamily: F.mono, fontSize: 10, color: C.green }}>✓ OBJETIVO CUBIERTO</span>}
            </div>
          </div>
        )}

        {/* Members */}
        {members.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {members.map(m => (
              <span key={m} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "#B9C3D6", fontSize: 12, fontFamily: F.mono, borderRadius: 999, padding: "3px 9px" }}>
                {m[0]?.toUpperCase()} {m}
              </span>
            ))}
          </div>
        )}
        {members.length === 0 && (
          <p style={{ fontFamily: F.mono, fontSize: 11, color: "#7C8AA3", marginTop: 8 }}>
            Únete al viaje con tu nombre para que el cálculo incluya a todas las personas.
          </p>
        )}
      </div>

      {/* Add / Edit phase form */}
      <Card>
        <SectionLabel>{editingId ? "Editar fase" : "Añadir fase de ahorro"}</SectionLabel>
        <p style={{ color: C.inkSoft, fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
          Define un período (ej. &ldquo;Agosto → Octubre&rdquo;) y cuánto aporta cada persona al mes. La app multiplica por los meses y por el número de personas.
        </p>
        <div className="flex flex-col gap-3 mt-3">
          <div className="flex flex-wrap gap-2">
            <input placeholder="Nombre de la fase  (ej. Fase 1 · Verano)" value={phaseForm.name}
              onChange={e => setPhaseForm(f => ({ ...f, name: e.target.value }))}
              style={{ ...inputStyle, flex: "2 1 180px" }} />
            <div style={{ position: "relative", flex: "0 1 130px", minWidth: 110 }}>
              <input placeholder="€/mes por persona" value={phaseForm.amountPerPerson}
                onChange={e => setPhaseForm(f => ({ ...f, amountPerPerson: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && addPhase()}
                style={{ ...inputStyle, fontFamily: F.mono, paddingRight: 22 }} />
              <Euro size={11} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: C.inkSoft }} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Field label="Inicio del ahorro">
              <input type="month" value={phaseForm.startDate} onChange={e => setPhaseForm(f => ({ ...f, startDate: e.target.value }))} style={{ ...inputStyle, flex: 1 }} />
            </Field>
            <Field label="Fin del ahorro">
              <input type="month" value={phaseForm.endDate} min={phaseForm.startDate || undefined} onChange={e => setPhaseForm(f => ({ ...f, endDate: e.target.value }))} style={{ ...inputStyle, flex: 1 }} />
            </Field>
          </div>
          {phaseErr && <Banner type="error" msg={phaseErr} />}

          {/* Preview */}
          {phaseForm.amountPerPerson && !isNaN(parseFloat(phaseForm.amountPerPerson)) && (() => {
            const amt = parseFloat(phaseForm.amountPerPerson.replace(",", "."));
            const months = phaseForm.startDate && phaseForm.endDate ? monthsBetween(phaseForm.startDate, phaseForm.endDate) : null;
            return (
              <div style={{ background: C.paperDark, borderRadius: 6, padding: "10px 14px", fontFamily: F.mono, fontSize: 12, color: C.inkSoft }}>
                {amt.toFixed(2)} €/mes × {months ?? "?"} {months ? (months === 1 ? "mes" : "meses") : "meses"} × {n} {n === 1 ? "persona" : "personas"} ={" "}
                <strong style={{ color: C.ink, fontSize: 14 }}>
                  {months ? (amt * months * n).toFixed(2) : "…"} €
                </strong>{" "}en esta fase
              </div>
            );
          })()}

          <div className="flex gap-2">
            <button onClick={addPhase} style={{ flex: 1, background: C.navy, color: C.paper, borderRadius: 5, padding: "11px 16px", fontFamily: F.mono, fontSize: 12 }}>
              {editingId ? "GUARDAR CAMBIOS" : "AÑADIR FASE"}
            </button>
            {editingId && (
              <button onClick={cancelEdit} style={{ background: C.paperDark, color: C.inkSoft, borderRadius: 5, padding: "11px 14px", fontFamily: F.mono, fontSize: 12 }}>
                CANCELAR
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Timeline of phases */}
      {phasesWithCumulative.length > 0 && (
        <div className="flex flex-col gap-3">
          <SectionLabel>Fases de ahorro</SectionLabel>
          <div className="flex flex-col gap-0 mt-1" style={{ position: "relative" }}>
            {/* Vertical line */}
            <div style={{ position: "absolute", left: 19, top: 20, bottom: 20, width: 2, background: C.line, zIndex: 0 }} />

            {phasesWithCumulative.map((phase, idx) => {
              const isLast = idx === phasesWithCumulative.length - 1;
              return (
                <div key={phase.id} className="flex gap-4 items-start" style={{ position: "relative", paddingBottom: isLast ? 0 : 20 }}>
                  {/* Circle */}
                  <div style={{ width: 40, height: 40, borderRadius: 999, background: C.navy, border: `3px solid ${C.gold}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, zIndex: 1, color: C.goldLight, fontFamily: F.mono, fontSize: 13, fontWeight: 700 }}>
                    {idx + 1}
                  </div>

                  {/* Card */}
                  <div className="flex-1 card-lift" style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, padding: "12px 14px", marginBottom: isLast ? 0 : 4 }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div style={{ fontWeight: 600, fontSize: 15, color: C.ink }}>{phase.name}</div>
                        {(phase.startDate || phase.endDate) && (
                          <div style={{ fontFamily: F.mono, fontSize: 11, color: C.inkSoft, marginTop: 2 }}>
                            {phase.startDate ? formatMonth(phase.startDate) : "?"}{" "}→{" "}{phase.endDate ? formatMonth(phase.endDate) : "?"}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => startEdit(phase)} style={{ color: C.inkSoft, padding: 4 }} aria-label="Editar"><Edit2 size={14} /></button>
                        <button onClick={() => removePhase(phase.id)} style={{ color: C.inkSoft, padding: 4 }} aria-label="Eliminar"><Trash2 size={14} /></button>
                      </div>
                    </div>

                    {/* Per person / total */}
                    <div className="flex flex-wrap gap-3 mt-3">
                      <div style={{ flex: "1 1 100px", background: C.paperDark, borderRadius: 6, padding: "8px 10px" }}>
                        <div style={{ fontFamily: F.mono, fontSize: 9, color: C.inkSoft, letterSpacing: 0.5 }}>€/MES · POR PERSONA</div>
                        <div style={{ fontFamily: F.display, fontSize: 20, fontWeight: 700, color: C.ink, marginTop: 2 }}>{phase.amountPerPerson.toFixed(2)} €</div>
                        <div style={{ fontFamily: F.mono, fontSize: 9, color: C.inkSoft, marginTop: 2 }}>× {phase.months} {phase.months === 1 ? "mes" : "meses"}</div>
                      </div>
                      <div style={{ flex: "1 1 100px", background: C.navy, borderRadius: 6, padding: "8px 10px" }}>
                        <div style={{ fontFamily: F.mono, fontSize: 9, color: C.gold, letterSpacing: 0.5 }}>TOTAL FASE</div>
                        <div style={{ fontFamily: F.display, fontSize: 20, fontWeight: 700, color: C.goldLight, marginTop: 2 }}>{phase.totalPhase.toFixed(2)} €</div>
                        <div style={{ fontFamily: F.mono, fontSize: 9, color: "#7C8AA3", marginTop: 2 }}>{n} {n === 1 ? "persona" : "personas"}</div>
                      </div>
                      <div style={{ flex: "1 1 100px", background: C.teal, borderRadius: 6, padding: "8px 10px" }}>
                        <div style={{ fontFamily: F.mono, fontSize: 9, color: "rgba(255,255,255,0.7)", letterSpacing: 0.5 }}>ACUMULADO</div>
                        <div style={{ fontFamily: F.display, fontSize: 20, fontWeight: 700, color: "#fff", marginTop: 2 }}>{phase.cumulative.toFixed(2)} €</div>
                      </div>
                    </div>

                    {/* Individual breakdown */}
                    {members.length > 1 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {members.map(m => (
                          <div key={m} className="flex items-center gap-1.5 px-2 py-1" style={{ background: C.paperDark, borderRadius: 999, fontSize: 11 }}>
                            <div style={{ width: 16, height: 16, borderRadius: 999, background: C.teal, color: "#fff", fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.mono }}>{m[0]?.toUpperCase()}</div>
                            <span style={{ fontFamily: F.mono, color: C.inkSoft }}>{m}</span>
                            <span style={{ fontFamily: F.mono, fontWeight: 600, color: C.ink }}>{phase.amountPerPerson.toFixed(2)} €</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Final total node */}
            <div className="flex gap-4 items-center" style={{ position: "relative" }}>
              <div style={{ width: 40, height: 40, borderRadius: 999, background: C.teal, border: `3px solid ${C.teal}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, zIndex: 1 }}>
                <PiggyBank size={18} color="#fff" />
              </div>
              <div style={{ flex: 1, background: C.teal, borderRadius: 8, padding: "12px 16px" }}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div style={{ fontFamily: F.mono, fontSize: 10, color: "rgba(255,255,255,0.7)", letterSpacing: 1 }}>BOTE FINAL</div>
                    <div style={{ fontFamily: F.display, fontSize: 26, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{totalGroup.toFixed(2)} €</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: F.mono, fontSize: 10, color: "rgba(255,255,255,0.7)", letterSpacing: 1 }}>POR PERSONA</div>
                    <div style={{ fontFamily: F.display, fontSize: 26, fontWeight: 700, color: C.goldLight, lineHeight: 1 }}>{totalPerPerson.toFixed(2)} €</div>
                  </div>
                </div>
                {target > 0 && (
                  <div className="mt-3" style={{ background: "rgba(255,255,255,0.12)", borderRadius: 6, padding: "6px 10px", fontFamily: F.mono, fontSize: 11, color: "rgba(255,255,255,0.9)" }}>
                    {totalGroup >= target
                      ? `✓ Presupuesto cubierto — sobran ${(totalGroup - target).toFixed(2)} €`
                      : `Objetivo: ${target.toFixed(2)} € — Faltan ${(target - totalGroup).toFixed(2)} € (${(100 - covered).toFixed(0)}%)`}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {config.phases.length === 0 && (
        <EmptyState icon={<PiggyBank size={28} color={C.line} />} text="Sin fases todavía. Añade la primera fase de ahorro." />
      )}

      {/* Help */}
      {config.phases.length === 0 && (
        <div style={{ border: `1px dashed ${C.line}`, borderRadius: 8, padding: "14px 16px" }}>
          <p style={{ color: C.inkSoft, fontSize: 13, lineHeight: 1.7 }}>
            <strong style={{ color: C.ink }}>¿Cómo funciona?</strong><br />
            Define períodos de ahorro (ej. Fase 1: agosto → octubre, Fase 2: noviembre → diciembre).
            En cada fase pones cuánto aporta cada persona a la cuenta conjunta de Revolut.
            La app calcula automáticamente el bote total según el número de viajeros y te muestra cuánto tenéis acumulado al final.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Destinos ─────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  playa: "#4A90B8", ciudad: "#3F7A78", cultura: "#B8893F",
  naturaleza: "#2A7A4B", aventura: "#D4614A",
};
const TYPE_GRADIENTS: Record<string, string> = {
  playa:      "linear-gradient(135deg, #4A90B8 0%, #1a5f82 100%)",
  ciudad:     "linear-gradient(135deg, #3F7A78 0%, #1d4f4e 100%)",
  cultura:    "linear-gradient(135deg, #B8893F 0%, #7a540f 100%)",
  naturaleza: "linear-gradient(135deg, #2A7A4B 0%, #0f4f28 100%)",
  aventura:   "linear-gradient(135deg, #D4614A 0%, #8f2b18 100%)",
};

function DestCard({ dest, budget, onChoose, onOpen, isFavorite, onToggleFavorite }: {
  dest: DestinationTemplate; budget: number; onChoose: () => void; onOpen: () => void;
  isFavorite?: boolean; onToggleFavorite?: () => void;
}) {
  const withinBudget = budget === 0 || dest.costPerPerson <= budget;
  const missing = budget > 0 ? dest.costPerPerson - budget : 0;
  const typeColor = TYPE_COLORS[dest.type] ?? C.inkSoft;
  const gradient = TYPE_GRADIENTS[dest.type] ?? TYPE_GRADIENTS.aventura;

  return (
    <div className="card-lift" onClick={onOpen} style={{
      background: "#fff", border: `1px solid ${withinBudget ? C.line : "#e0cccc"}`,
      borderRadius: 14, overflow: "hidden", cursor: "pointer",
      opacity: withinBudget ? 1 : 0.78, display: "flex", flexDirection: "column",
    }}>
      {/* Coloured header */}
      <div style={{ background: gradient, padding: "18px 16px 14px", position: "relative", minHeight: 88 }}>
        <div style={{ position: "absolute", top: 10, right: 12, background: withinBudget ? "rgba(255,255,255,0.2)" : "rgba(255,80,80,0.25)", borderRadius: 8, padding: "4px 10px" }}>
          <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 700, color: "#fff" }}>
            ~{dest.costPerPerson.toLocaleString("es-ES")} €
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 8, color: "rgba(255,255,255,0.8)", textAlign: "right" }}>
            {withinBudget
              ? (budget > 0 ? `↑ ${(budget - dest.costPerPerson).toFixed(0)} € sobrante` : "por persona")
              : `↓ faltan ${missing.toFixed(0)} €`}
          </div>
        </div>
        {onToggleFavorite && (
          <button onClick={e => { e.stopPropagation(); onToggleFavorite(); }}
            style={{ position: "absolute", top: 10, left: 12, background: "rgba(0,0,0,0.25)", borderRadius: 999, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Heart size={14} color="#fff" fill={isFavorite ? "#fff" : "transparent"} />
          </button>
        )}
        <div style={{ fontSize: 34, lineHeight: 1 }}>{dest.flag}</div>
        <div style={{ fontFamily: F.display, fontSize: 18, fontWeight: 700, color: "#fff", marginTop: 6, lineHeight: 1.2 }}>{dest.name}</div>
        <div style={{ fontFamily: F.mono, fontSize: 9, color: "rgba(255,255,255,0.75)", marginTop: 3 }}>{dest.country} · {dest.durationDays} días</div>
      </div>

      {/* Body */}
      <div style={{ padding: "12px 14px", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontFamily: F.mono, fontSize: 9, padding: "2px 8px", borderRadius: 999, background: `${typeColor}18`, color: typeColor, border: `1px solid ${typeColor}33`, alignSelf: "flex-start", letterSpacing: 0.5 }}>
          {dest.type.toUpperCase()}
        </span>
        <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {dest.description}
        </div>
        <div className="flex flex-wrap gap-1">
          {dest.highlights.slice(0, 3).map(h => (
            <span key={h} style={{ fontFamily: F.mono, fontSize: 9, color: C.inkSoft, background: C.paperDark, borderRadius: 4, padding: "2px 6px" }}>{h}</span>
          ))}
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 9, color: C.inkSoft, marginTop: 2 }}>
          VER ITINERARIO COMPLETO →
        </div>
      </div>
    </div>
  );
}

function DestModal({ dest, budget, onChoose, onClose, alternatives, onOpenAlt }: {
  dest: DestinationTemplate; budget: number; onChoose: () => void; onClose: () => void;
  alternatives?: DestinationTemplate[]; onOpenAlt?: (d: DestinationTemplate) => void;
}) {
  const withinBudget = budget === 0 || dest.costPerPerson <= budget;
  const gradient = TYPE_GRADIENTS[dest.type] ?? TYPE_GRADIENTS.aventura;
  return (
    <div className="fade-in" style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", flexDirection: "column", background: "#000a" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ marginTop: "auto", background: C.paper, borderRadius: "20px 20px 0 0", maxHeight: "88dvh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Modal header */}
        <div style={{ background: gradient, padding: "20px 20px 16px", position: "relative", flexShrink: 0 }}>
          <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, background: "rgba(255,255,255,0.2)", borderRadius: 999, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={16} color="#fff" />
          </button>
          <div style={{ fontSize: 40 }}>{dest.flag}</div>
          <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 700, color: "#fff", marginTop: 4 }}>{dest.name}</div>
          <div style={{ fontFamily: F.mono, fontSize: 10, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>{dest.country} · {dest.durationDays} días</div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ fontFamily: F.display, fontSize: 24, fontWeight: 700, color: "#fff" }}>~{dest.costPerPerson.toLocaleString("es-ES")} €</div>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: "rgba(255,255,255,0.75)" }}>
              {withinBudget
                ? (budget > 0 ? `✓ dentro de tu presupuesto` : "todo incluido · por persona")
                : `faltan ~${(dest.costPerPerson - budget).toFixed(0)} €`}
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto" style={{ flex: 1, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ fontSize: 14, color: C.inkSoft, lineHeight: 1.7 }}>{dest.description}</p>

          <div style={{ background: `${TYPE_COLORS[dest.type] ?? C.teal}15`, borderRadius: 8, padding: "10px 14px", fontFamily: F.mono, fontSize: 11, color: C.inkSoft }}>
            ✈️ Vuelo · 🏨 Alojamiento · 🍽️ Comida · 🎭 Actividades — <strong style={{ color: C.ink }}>TODO INCLUIDO</strong>
          </div>

          {!withinBudget && alternatives && alternatives.length > 0 && (
            <div style={{ background: "#FFF5F0", borderRadius: 10, padding: "12px 14px", border: "1px solid #FDDCCC" }}>
              <div style={{ fontFamily: F.mono, fontSize: 10, color: C.coral, fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>
                ¿FUERA DE PRESUPUESTO? PRUEBA ESTO:
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {alternatives.map(alt => {
                  const altWithin = budget === 0 || alt.costPerPerson <= budget;
                  return (
                    <button key={alt.id} onClick={() => onOpenAlt?.(alt)} style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                      background: "#fff", borderRadius: 8, border: `1px solid ${altWithin ? "#C8EDCC" : "#FDDCCC"}`,
                      textAlign: "left", cursor: "pointer", width: "100%",
                    }}>
                      <span style={{ fontSize: 26, flexShrink: 0 }}>{alt.flag}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: F.display, fontSize: 14, fontWeight: 700, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{alt.name}</div>
                        <div style={{ fontFamily: F.mono, fontSize: 9, color: C.inkSoft }}>{alt.durationDays} días · {alt.country}</div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 700, color: altWithin ? C.green : C.inkSoft }}>
                          ~{alt.costPerPerson.toLocaleString("es-ES")} €
                        </div>
                        {budget > 0 && (
                          <div style={{ fontFamily: F.mono, fontSize: 8, color: altWithin ? C.green : C.inkSoft }}>
                            {altWithin ? `✓ te alcanza` : `faltan ${(alt.costPerPerson - budget).toFixed(0)} €`}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <SectionLabel>Itinerario</SectionLabel>
            <div className="flex flex-col gap-2 mt-2">
              {dest.itinerary.map((d, i) => (
                <div key={i} style={{ background: C.paperDark, borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontFamily: F.mono, fontSize: 10, color: C.gold, marginBottom: 4 }}>DÍA {i + 1}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 6 }}>{d.title}</div>
                  <div className="flex flex-col gap-1">
                    {d.items.slice(0, 3).map((it, j) => (
                      <div key={j} className="flex gap-2" style={{ fontSize: 12, color: C.inkSoft }}>
                        <span style={{ fontFamily: F.mono, fontSize: 10, color: C.teal, flexShrink: 0, width: 40 }}>{it.time}</span>
                        <span>{it.text}</span>
                      </div>
                    ))}
                    {d.items.length > 3 && <div style={{ fontFamily: F.mono, fontSize: 9, color: C.inkSoft }}>+{d.items.length - 3} más…</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <SectionLabel>Lugares del mapa</SectionLabel>
            <div className="flex flex-col gap-2 mt-2">
              {dest.mapPlaces.map(p => (
                <div key={p.name} className="flex gap-2 items-start" style={{ fontSize: 13, color: C.ink }}>
                  <MapPin size={13} color={TYPE_COLORS[dest.type] ?? C.teal} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkSoft }}>{p.note}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tips per destination */}
          {DEST_TIPS[dest.id] && (() => {
            const tips = DEST_TIPS[dest.id];
            return (
              <div style={{ background: "#F0F7FF", borderRadius: 10, padding: "12px 14px", border: "1px solid #C8DEFF" }}>
                <div style={{ fontFamily: F.mono, fontSize: 10, color: C.sky, fontWeight: 700, marginBottom: 10, letterSpacing: 1 }}>ℹ️ INFORMACIÓN PRÁCTICA</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {[
                    { icon: "📋", label: "Visado", val: tips.visa },
                    { icon: "💵", label: "Moneda", val: tips.currency },
                    { icon: "🔌", label: "Enchufe", val: tips.plug },
                    { icon: "💝", label: "Propinas", val: tips.tip },
                    { icon: "🚨", label: "Emergencias", val: tips.emergency },
                  ].map(row => (
                    <div key={row.label} className="flex gap-2 items-start" style={{ fontSize: 12 }}>
                      <span style={{ flexShrink: 0, width: 20, textAlign: "center" }}>{row.icon}</span>
                      <span style={{ fontFamily: F.mono, fontSize: 9, color: C.sky, width: 68, flexShrink: 0, paddingTop: 1 }}>{row.label.toUpperCase()}</span>
                      <span style={{ color: C.ink, lineHeight: 1.5 }}>{row.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Currency converter */}
          {(() => {
            const cur = CURRENCIES.find(c => c.destIds.some(id => dest.id.includes(id) || id.includes(dest.id)));
            if (!cur || cur.code === "EUR") return null;
            return (
              <div style={{ background: "#FFFBF0", borderRadius: 10, padding: "12px 14px", border: "1px solid #F0D9A0" }}>
                <div style={{ fontFamily: F.mono, fontSize: 10, color: C.gold, fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>💱 CONVERSOR RÁPIDO</div>
                <CurrencyWidget currency={cur} />
              </div>
            );
          })()}

          <div style={{ height: 16 }} />
        </div>

        {/* CTA */}
        <div style={{ padding: "12px 20px 24px", borderTop: `1px solid ${C.line}`, flexShrink: 0 }}>
          <button onClick={onChoose} style={{
            width: "100%", background: withinBudget ? TYPE_COLORS[dest.type] ?? C.teal : C.navy,
            color: "#fff", borderRadius: 10, padding: "14px 16px",
            fontFamily: F.mono, fontSize: 13, fontWeight: 700, letterSpacing: 0.5,
          }}>
            {withinBudget ? `✈ ELEGIR ${dest.name.toUpperCase()}` : "ELEGIR IGUALMENTE →"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CurrencyWidget({ currency }: { currency: typeof CURRENCIES[0] }) {
  const [eur, setEur] = useState("100");
  const eurNum = parseFloat(eur.replace(",", ".")) || 0;
  const converted = (eurNum * currency.rate).toLocaleString("es-ES", { maximumFractionDigits: 0 });
  const back = (1 / currency.rate).toFixed(4);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div style={{ position: "relative", flex: 1 }}>
          <input value={eur} onChange={e => setEur(e.target.value)} style={{ ...inputStyle, fontFamily: F.mono, fontSize: 14, paddingRight: 28 }} />
          <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontFamily: F.mono, fontSize: 12, color: C.inkSoft }}>€</span>
        </div>
        <RefreshCw size={14} color={C.inkSoft} />
        <div style={{ flex: 1, background: C.paperDark, borderRadius: 8, padding: "9px 12px", fontFamily: F.mono, fontSize: 14, fontWeight: 700, color: C.ink }}>
          {converted} <span style={{ fontSize: 10, fontWeight: 400, color: C.inkSoft }}>{currency.symbol}</span>
        </div>
      </div>
      <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkSoft }}>
        1 € = {currency.rate >= 10 ? Math.round(currency.rate) : currency.rate} {currency.code} · 1 {currency.code} = {back} € · {currency.name}
      </div>
    </div>
  );
}

function Destinos({ code, onSelect }: { code: string; onSelect: () => void }) {
  const [savings, setSavings] = useState<SavingsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<DestinationTemplate | null>(null);
  const [chosen, setChosen] = useState<DestinationTemplate | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadShared<SavingsConfig>(`ahorro:${code}`, { targetBudget: 0, phases: [] }).then(c => {
      setSavings(c);
      setLoading(false);
    });
    loadPersonal<string[]>("destFavorites", []).then(ids => setFavorites(new Set(ids)));
  }, [code]);

  function toggleFavorite(id: string) {
    setFavorites(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      savePersonal("destFavorites", Array.from(next));
      return next;
    });
  }

  const budgetPerPerson = useMemo(() => {
    if (!savings) return 0;
    return savings.phases.reduce((sum, p) => {
      const months = monthsBetween(p.startDate, p.endDate);
      return sum + p.amountPerPerson * months;
    }, 0);
  }, [savings]);

  async function applyDestination(dest: DestinationTemplate) {
    const itinDays: ItineraryDay[] = dest.itinerary.map(d => ({
      ...d, id: uid(), items: d.items.map(it => ({ ...it, id: uid() })),
    }));
    await saveShared(`itin:${code}`, itinDays);
    const mapPlaces: MapPlace[] = dest.mapPlaces.map(p => ({ ...p, id: uid() }));
    await saveShared(`mapa:${code}`, mapPlaces);
    onSelect();
  }

  const visibleDests = useMemo(() => {
    const q = search.trim().toLowerCase();
    return DESTINATIONS.filter(d =>
      (filter === "todos" || d.type === filter || (filter === "favoritos" && favorites.has(d.id))) &&
      (filter !== "favoritos" || favorites.has(d.id)) &&
      (!q || d.name.toLowerCase().includes(q) || d.country.toLowerCase().includes(q) || d.highlights.some(h => h.toLowerCase().includes(q)))
    );
  }, [filter, search, favorites]);

  const withinBudget = useMemo(() =>
    visibleDests.filter(d => budgetPerPerson === 0 || d.costPerPerson <= budgetPerPerson),
    [visibleDests, budgetPerPerson]);

  const overBudget = useMemo(() =>
    visibleDests.filter(d => budgetPerPerson > 0 && d.costPerPerson > budgetPerPerson),
    [visibleDests, budgetPerPerson]);

  if (loading) return <SkeletonCards />;

  if (confirming && chosen) {
    return (
      <div className="flex flex-col gap-4 fade-in">
        <Card style={{ textAlign: "center", padding: "28px 20px" }}>
          <div style={{ fontSize: 52 }}>{chosen.flag}</div>
          <div style={{ fontFamily: F.display, fontSize: 24, fontWeight: 700, color: C.ink, marginTop: 8 }}>{chosen.name}</div>
          <div style={{ color: C.inkSoft, fontSize: 13, marginTop: 4, fontFamily: F.mono }}>
            {chosen.country} · {chosen.durationDays} días · todo incluido ~{chosen.costPerPerson.toLocaleString("es-ES")} €/persona
          </div>
          <Perf />
          <p style={{ color: C.inkSoft, fontSize: 14, lineHeight: 1.7 }}>
            Se va a cargar el <strong style={{ color: C.ink }}>itinerario completo</strong> y los <strong style={{ color: C.ink }}>lugares del mapa</strong> de <strong style={{ color: C.ink }}>{chosen.name}</strong> en el viaje. El contenido actual se reemplazará. ¿Continuar?
          </p>
          <div className="flex gap-3 mt-5">
            <button onClick={() => { setConfirming(false); setPreview(chosen); }} style={{ flex: 1, background: C.paperDark, color: C.inkSoft, borderRadius: 8, padding: "12px 16px", fontFamily: F.mono, fontSize: 12 }}>VOLVER</button>
            <button onClick={() => applyDestination(chosen)} style={{ flex: 1, background: C.teal, color: "#fff", borderRadius: 8, padding: "12px 16px", fontFamily: F.mono, fontSize: 12, fontWeight: 700 }}>SÍ, APLICAR →</button>
          </div>
        </Card>
      </div>
    );
  }

  const DestGrid = ({ dests }: { dests: DestinationTemplate[] }) => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
      {dests.map(dest => (
        <DestCard key={dest.id} dest={dest} budget={budgetPerPerson}
          onChoose={() => { setChosen(dest); setConfirming(true); setPreview(null); }}
          onOpen={() => setPreview(dest)}
          isFavorite={favorites.has(dest.id)}
          onToggleFavorite={() => toggleFavorite(dest.id)}
        />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Budget header */}
      <div style={{ background: `linear-gradient(135deg, ${C.navy}, ${C.navyMid})`, borderRadius: 14, padding: "20px 20px", color: C.paper, position: "relative", overflow: "hidden" }} className="dot-grid">
        <div className="glow-pulse" style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: 999, background: `radial-gradient(circle, ${C.gold}25, transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ fontFamily: F.mono, fontSize: 10, color: C.gold, letterSpacing: 1.5 }}>PRESUPUESTO POR PERSONA</div>
        <div style={{ fontFamily: F.display, fontSize: "clamp(2rem,8vw,3rem)", fontWeight: 700, color: C.goldLight, lineHeight: 1, marginTop: 4 }}>
          {budgetPerPerson > 0 ? `${budgetPerPerson.toFixed(0)} €` : "—"}
        </div>
        {budgetPerPerson > 0 ? (
          <p style={{ fontFamily: F.mono, fontSize: 11, color: "#9FAEC4", marginTop: 6 }}>
            Según tu plan de ahorro · vuelo + hotel + comida + actividades incluidos
          </p>
        ) : (
          <p style={{ fontFamily: F.mono, fontSize: 11, color: "#9FAEC4", marginTop: 6 }}>
            Configura tu plan en <strong style={{ color: C.goldLight }}>AHORRO</strong> para filtrar por presupuesto
          </p>
        )}
        {budgetPerPerson > 0 && (
          <div className="mt-3 flex gap-3" style={{ fontFamily: F.mono, fontSize: 11 }}>
            <span style={{ color: C.goldLight }}>✓ {withinBudget.length} alcanzables</span>
            {overBudget.length > 0 && <span style={{ color: "#9FAEC4" }}>· {overBudget.length} fuera de alcance</span>}
          </div>
        )}
      </div>

      {/* Search */}
      <div style={{ position: "relative" }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar destino, país o actividad…"
          style={{ width: "100%", padding: "10px 16px 10px 38px", borderRadius: 10, border: `1px solid ${C.line}`, background: "#fff", fontFamily: F.mono, fontSize: 13, color: C.ink, boxSizing: "border-box" }}
        />
        <Globe size={15} color={C.inkSoft} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
        {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}><X size={14} color={C.inkSoft} /></button>}
      </div>

      {/* Type filter pills */}
      <div className="flex flex-wrap gap-2">
        {DEST_TYPE_FILTERS.map(t => (
          <button key={t.value} onClick={() => setFilter(t.value)} style={{
            padding: "7px 14px", borderRadius: 999, fontSize: 12, fontFamily: F.mono,
            background: filter === t.value ? C.navy : C.paperDark,
            color: filter === t.value ? C.paper : C.inkSoft,
            border: `1px solid ${filter === t.value ? C.navy : C.line}`,
            transition: "all 0.15s", fontWeight: filter === t.value ? 700 : 400,
          }}>
            {t.emoji} {t.label}
          </button>
        ))}
        <button onClick={() => setFilter("favoritos")} style={{
          padding: "7px 14px", borderRadius: 999, fontSize: 12, fontFamily: F.mono,
          background: filter === "favoritos" ? "#B83C5C" : C.paperDark,
          color: filter === "favoritos" ? "#fff" : C.inkSoft,
          border: `1px solid ${filter === "favoritos" ? "#B83C5C" : C.line}`,
          transition: "all 0.15s", fontWeight: filter === "favoritos" ? 700 : 400,
        }}>
          ❤️ Favoritos {favorites.size > 0 && `(${favorites.size})`}
        </button>
      </div>

      {/* Within budget */}
      {withinBudget.length > 0 && (
        <div className="flex flex-col gap-3">
          {budgetPerPerson > 0 && (
            <div className="flex items-center gap-2">
              <div style={{ height: 1, flex: 1, background: `${C.green}44` }} />
              <span style={{ fontFamily: F.mono, fontSize: 10, color: C.green, letterSpacing: 1 }}>✓ CON TU PRESUPUESTO</span>
              <div style={{ height: 1, flex: 1, background: `${C.green}44` }} />
            </div>
          )}
          <DestGrid dests={withinBudget} />
        </div>
      )}

      {/* Over budget */}
      {budgetPerPerson > 0 && overBudget.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 mt-2">
            <div style={{ height: 1, flex: 1, background: C.line }} />
            <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkSoft, letterSpacing: 1 }}>NECESITAS AHORRAR MÁS</span>
            <div style={{ height: 1, flex: 1, background: C.line }} />
          </div>
          <DestGrid dests={overBudget} />
        </div>
      )}

      {budgetPerPerson === 0 && <DestGrid dests={visibleDests} />}

      {visibleDests.length === 0 && filter === "favoritos" && <EmptyState icon={<Heart size={28} color={C.line} />} text="Aún no tienes favoritos. Pulsa el corazón en cualquier destino." />}
      {visibleDests.length === 0 && filter !== "favoritos" && <EmptyState icon={<Globe size={28} color={C.line} />} text="Sin destinos con ese filtro." />}

      {preview && (
        <DestModal
          dest={preview}
          budget={budgetPerPerson}
          onChoose={() => { setChosen(preview!); setConfirming(true); setPreview(null); }}
          onClose={() => setPreview(null)}
          alternatives={(DESTINATION_ALTERNATIVES[preview.id] ?? []).map(id => DESTINATIONS.find(d => d.id === id)).filter(Boolean) as DestinationTemplate[]}
          onOpenAlt={d => setPreview(d)}
        />
      )}
    </div>
  );
}

// ─── Reservas ─────────────────────────────────────────────────────────────────

const BOOKING_TYPE_ICONS: Record<string, string> = { vuelo: "✈️", hotel: "🏨", actividad: "🎭", traslado: "🚗", otro: "📋" };

function Reservas({ code, session, darkMode }: { code: string; session: Session; darkMode: boolean }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [form, setForm] = useState<Omit<Booking, "id">>({
    type: "vuelo", title: "", confirmationCode: "", startDate: "", startTime: "",
    endDate: "", endTime: "", location: "", bookingUrl: "", notes: "", amount: 0,
  });
  const [err, setErr] = useState("");
  const key = `reservas:${code}`;

  useEffect(() => { loadShared<Booking[]>(key, []).then(b => { setBookings(b); setLoading(false); }); }, [key]);
  const persist = useCallback(async (next: Booking[]) => { setBookings(next); await saveShared(key, next); }, [key]);

  const cardBg = darkMode ? "#161B22" : "#fff";
  const cardBorder = darkMode ? "#30363D" : C.line;
  const textColor = darkMode ? "#E6EDF3" : C.ink;
  const softColor = darkMode ? "#8B949E" : C.inkSoft;
  const paperBg = darkMode ? "#0D1117" : C.paper;

  function openAdd() {
    setEditing(null);
    setForm({ type: "vuelo", title: "", confirmationCode: "", startDate: "", startTime: "", endDate: "", endTime: "", location: "", bookingUrl: "", notes: "", amount: 0 });
    setShowForm(true); setErr("");
  }

  function openEdit(b: Booking) {
    setEditing(b);
    setForm({ type: b.type, title: b.title, confirmationCode: b.confirmationCode, startDate: b.startDate, startTime: b.startTime, endDate: b.endDate, endTime: b.endTime, location: b.location, bookingUrl: b.bookingUrl, notes: b.notes, amount: b.amount });
    setShowForm(true); setErr("");
  }

  function save() {
    setErr("");
    if (!form.title.trim()) { setErr("Escribe un título."); return; }
    if (!form.startDate) { setErr("Fecha de inicio necesaria."); return; }
    if (editing) {
      persist(bookings.map(b => b.id === editing.id ? { ...form, id: editing.id } : b));
    } else {
      persist([...bookings, { ...form, id: uid() }]);
    }
    setShowForm(false);
  }

  const sorted = [...bookings].sort((a, b) => a.startDate.localeCompare(b.startDate));

  if (loading) return <SkeletonCards />;

  const formInStyle = { ...inputStyle, background: cardBg, color: textColor, border: `1px solid ${cardBorder}` };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${C.navy}, ${C.navyMid})`, borderRadius: 14, padding: "20px 20px", color: C.paper, position: "relative", overflow: "hidden" }} className="dot-grid">
        <div className="glow-pulse" style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: 999, background: `radial-gradient(circle, ${C.teal}30, transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ fontFamily: F.mono, fontSize: 10, color: C.gold, letterSpacing: 1.5 }}>MIS RESERVAS</div>
        <div style={{ fontFamily: F.display, fontSize: 28, fontWeight: 700, color: C.paper, marginTop: 4 }}>
          {bookings.length} {bookings.length === 1 ? "reserva" : "reservas"}
        </div>
        <p style={{ fontFamily: F.mono, fontSize: 11, color: "#9FAEC4", marginTop: 4 }}>
          Vuelos · hoteles · actividades · traslados — todo en un lugar
        </p>
      </div>

      <button onClick={openAdd} style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        background: C.teal, color: "#fff", borderRadius: 10, padding: "12px 16px",
        fontFamily: F.mono, fontSize: 12, fontWeight: 700,
      }}>
        <Plus size={14} /> AÑADIR RESERVA
      </button>

      {/* Form modal */}
      {showForm && (
        <div className="fade-in" style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", flexDirection: "column", background: "#000a" }} onClick={() => setShowForm(false)}>
          <div onClick={e => e.stopPropagation()} style={{ marginTop: "auto", background: paperBg, borderRadius: "20px 20px 0 0", maxHeight: "90dvh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "18px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div style={{ fontFamily: F.display, fontSize: 18, fontWeight: 700, color: textColor }}>{editing ? "Editar reserva" : "Nueva reserva"}</div>
              <button onClick={() => setShowForm(false)}><X size={18} color={softColor} /></button>
            </div>
            <div className="overflow-y-auto" style={{ flex: 1, padding: "16px 20px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Type selector */}
              <div className="flex gap-2 flex-wrap">
                {BOOKING_TYPES.map(t => (
                  <button key={t.value} onClick={() => setForm(f => ({ ...f, type: t.value }))}
                    style={{ padding: "6px 12px", borderRadius: 8, fontFamily: F.mono, fontSize: 11, background: form.type === t.value ? C.navy : (darkMode ? "#161B22" : C.paperDark), color: form.type === t.value ? "#fff" : softColor, border: `1px solid ${form.type === t.value ? C.navy : cardBorder}` }}>
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>

              <input placeholder="Título (Vuelo MAD → NRT, Hotel Shinjuku…)" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={{ ...formInStyle, fontSize: 15 }} />

              <div className="flex gap-2 flex-wrap">
                <div style={{ flex: "1 1 200px" }}>
                  <div style={{ fontFamily: F.mono, fontSize: 9, color: softColor, marginBottom: 4 }}>SALIDA / INICIO</div>
                  <div className="flex gap-2">
                    <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} style={{ ...formInStyle, flex: 1 }} />
                    <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} style={{ ...formInStyle, width: 90 }} />
                  </div>
                </div>
                <div style={{ flex: "1 1 200px" }}>
                  <div style={{ fontFamily: F.mono, fontSize: 9, color: softColor, marginBottom: 4 }}>LLEGADA / FIN</div>
                  <div className="flex gap-2">
                    <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} style={{ ...formInStyle, flex: 1 }} />
                    <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} style={{ ...formInStyle, width: 90 }} />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <input placeholder="Código de confirmación" value={form.confirmationCode}
                  onChange={e => setForm(f => ({ ...f, confirmationCode: e.target.value }))} style={{ ...formInStyle, flex: "1 1 150px", fontFamily: F.mono }} />
                <div style={{ position: "relative", flex: "0 1 130px" }}>
                  <input placeholder="Importe" value={form.amount === 0 ? "" : String(form.amount)}
                    onChange={e => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} style={{ ...formInStyle, paddingRight: 26, width: "100%" }} />
                  <Euro size={11} style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", color: softColor }} />
                </div>
              </div>

              <input placeholder="Lugar / aeropuerto / hotel (opcional)" value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))} style={formInStyle} />
              <input placeholder="Enlace de reserva (opcional)" value={form.bookingUrl}
                onChange={e => setForm(f => ({ ...f, bookingUrl: e.target.value }))} style={formInStyle} />
              <textarea placeholder="Notas adicionales…" value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                style={{ ...formInStyle, minHeight: 70, resize: "vertical" }} />

              {err && <Banner type="error" msg={err} />}
              <button onClick={save} style={{ background: C.teal, color: "#fff", borderRadius: 8, padding: "12px 16px", fontFamily: F.mono, fontSize: 12, fontWeight: 700 }}>
                {editing ? "GUARDAR CAMBIOS" : "AÑADIR RESERVA"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Booking cards */}
      <div className="flex flex-col gap-3">
        {sorted.map(b => (
          <div key={b.id} style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ background: `linear-gradient(135deg, ${C.navyMid}, ${C.navy})`, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22 }}>{BOOKING_TYPE_ICONS[b.type]}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: F.display, fontSize: 16, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.title}</div>
                <div style={{ fontFamily: F.mono, fontSize: 10, color: "#8A9BC1" }}>
                  {b.startDate}{b.startTime ? ` ${b.startTime}` : ""}{(b.endDate && b.endDate !== b.startDate) ? ` → ${b.endDate}${b.endTime ? ` ${b.endTime}` : ""}` : ""}
                </div>
              </div>
              {b.amount > 0 && <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 700, color: C.goldLight, flexShrink: 0 }}>{b.amount.toFixed(0)} €</div>}
            </div>
            <div style={{ padding: "10px 16px" }} className="flex flex-col gap-1.5">
              {b.confirmationCode && (
                <div className="flex items-center gap-2">
                  <span style={{ fontFamily: F.mono, fontSize: 9, color: softColor, width: 90 }}>CONFIRMA</span>
                  <span style={{ fontFamily: F.mono, fontSize: 12, fontWeight: 700, color: C.teal, letterSpacing: 1 }}>{b.confirmationCode}</span>
                  <button onClick={() => navigator.clipboard?.writeText(b.confirmationCode)} style={{ color: softColor, padding: 2 }}><Copy size={11} /></button>
                </div>
              )}
              {b.location && (
                <div className="flex items-center gap-2">
                  <span style={{ fontFamily: F.mono, fontSize: 9, color: softColor, width: 90 }}>LUGAR</span>
                  <span style={{ fontSize: 13, color: textColor }}>{b.location}</span>
                </div>
              )}
              {b.bookingUrl && (
                <a href={b.bookingUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1"
                  style={{ fontFamily: F.mono, fontSize: 10, color: C.sky, marginTop: 2 }}>
                  <ExternalLink size={10} /> VER RESERVA
                </a>
              )}
              {b.notes && <p style={{ fontSize: 12, color: softColor, lineHeight: 1.5, marginTop: 2 }}>{b.notes}</p>}
              <div className="flex gap-2 mt-2">
                <button onClick={() => openEdit(b)} style={{ fontFamily: F.mono, fontSize: 10, color: softColor, border: `1px solid ${cardBorder}`, borderRadius: 5, padding: "4px 10px", display: "flex", alignItems: "center", gap: 4 }}>
                  <Edit2 size={10} /> EDITAR
                </button>
                <button onClick={() => persist(bookings.filter(x => x.id !== b.id))} style={{ fontFamily: F.mono, fontSize: 10, color: C.red, border: `1px solid ${C.red}33`, borderRadius: 5, padding: "4px 10px", display: "flex", alignItems: "center", gap: 4 }}>
                  <Trash2 size={10} /> ELIMINAR
                </button>
              </div>
            </div>
          </div>
        ))}
        {bookings.length === 0 && <EmptyState icon={<Ticket size={28} color={C.line} />} text="Sin reservas todavía. Añade vuelos, hoteles y actividades." />}
      </div>
    </div>
  );
}

// ─── Diario ───────────────────────────────────────────────────────────────────

function Diario({ code, session, darkMode }: { code: string; session: Session; darkMode: boolean }) {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [mood, setMood] = useState(DIARY_MOODS[0]);
  const [editId, setEditId] = useState<string | null>(null);
  const key = `diario:${code}`;

  useEffect(() => { loadShared<DiaryEntry[]>(key, []).then(e => { setEntries(e); setLoading(false); }); }, [key]);
  const persist = useCallback(async (next: DiaryEntry[]) => { setEntries(next); await saveShared(key, next); }, [key]);

  const cardBg = darkMode ? "#161B22" : "#fff";
  const cardBorder = darkMode ? "#30363D" : C.line;
  const textColor = darkMode ? "#E6EDF3" : C.ink;
  const softColor = darkMode ? "#8B949E" : C.inkSoft;

  function save() {
    if (!text.trim()) return;
    if (editId) {
      persist(entries.map(e => e.id === editId ? { ...e, text: text.trim(), date, mood } : e));
      setEditId(null);
    } else {
      persist([{ id: uid(), date, text: text.trim(), author: session.name, mood, addedAt: Date.now() }, ...entries]);
    }
    setText(""); setMood(DIARY_MOODS[0]);
  }

  function startEdit(e: DiaryEntry) {
    setText(e.text); setDate(e.date); setMood(e.mood); setEditId(e.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.addedAt - a.addedAt);

  if (loading) return <SkeletonCards />;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <SectionLabel>{editId ? "Editando entrada" : "Nueva entrada"}</SectionLabel>
        <div className="flex flex-col gap-3 mt-3">
          <div className="flex gap-2 items-center flex-wrap">
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, flex: "0 0 auto", background: darkMode ? "#0D1117" : "#fff", color: textColor, border: `1px solid ${cardBorder}` }} />
            <div className="flex gap-1 flex-wrap">
              {DIARY_MOODS.map(m => (
                <button key={m} onClick={() => setMood(m)} style={{ fontSize: 20, opacity: mood === m ? 1 : 0.4, transition: "opacity 0.15s", transform: mood === m ? "scale(1.2)" : "scale(1)" }}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <textarea value={text} onChange={e => setText(e.target.value)} placeholder="¿Cómo fue el día? ¿Qué viste, comiste, sentiste?…"
            style={{ ...inputStyle, minHeight: 120, resize: "vertical", lineHeight: 1.6, background: darkMode ? "#0D1117" : "#fff", color: textColor, border: `1px solid ${cardBorder}` }} />
          <div className="flex gap-2">
            <button onClick={save} style={{ flex: 1, background: C.navy, color: C.paper, borderRadius: 8, padding: "11px 16px", fontFamily: F.mono, fontSize: 12, fontWeight: 700 }}>
              {editId ? "GUARDAR CAMBIOS" : "GUARDAR ENTRADA"}
            </button>
            {editId && (
              <button onClick={() => { setEditId(null); setText(""); setMood(DIARY_MOODS[0]); }}
                style={{ background: darkMode ? "#161B22" : C.paperDark, color: softColor, borderRadius: 8, padding: "11px 16px", fontFamily: F.mono, fontSize: 12 }}>
                CANCELAR
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Entries */}
      <div className="flex flex-col gap-3">
        {sorted.map(e => (
          <div key={e.id} style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ background: `linear-gradient(135deg, ${C.navy}22, ${C.navyMid}22)`, padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${cardBorder}` }}>
              <span style={{ fontSize: 22 }}>{e.mood}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: F.mono, fontSize: 12, fontWeight: 600, color: textColor }}>{formatDateFull(e.date)}</div>
                <div style={{ fontFamily: F.mono, fontSize: 10, color: softColor }}>{e.author}</div>
              </div>
              <button onClick={() => startEdit(e)} style={{ color: softColor, padding: 4 }}><Edit2 size={13} /></button>
              <button onClick={() => persist(entries.filter(x => x.id !== e.id))} style={{ color: softColor, padding: 4 }}><Trash2 size={13} /></button>
            </div>
            <div style={{ padding: "12px 16px", fontSize: 14, color: textColor, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{e.text}</div>
          </div>
        ))}
        {entries.length === 0 && <EmptyState icon={<BookOpen size={28} color={C.line} />} text="Tu diario de viaje está vacío. Escribe la primera entrada." />}
      </div>
    </div>
  );
}
