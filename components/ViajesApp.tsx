"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Plane, MapPin, Camera, ListChecks,
  Copy, Check, Plus, Trash2, X, ArrowLeft,
  Euro, AlertCircle, ChevronDown, ThumbsUp, ThumbsDown,
  Luggage, Lightbulb, Wallet, Sunrise, ExternalLink,
  CheckCircle2, Circle, PiggyBank, Target, Edit2, Globe,
} from "lucide-react";

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
  paper: "#F4EFE2", paperDark: "#EAE1CB",
  ink: "#1E2A3A", inkSoft: "#5B6472",
  navy: "#16223A", navyMid: "#1E2F4A",
  red: "#BD4332", teal: "#3F7A78",
  gold: "#B8893F", goldLight: "#F0C96A",
  line: "#C9BD9F", green: "#2A7A4B",
  coral: "#D4614A", sky: "#4A90B8",
} as const;

const F = {
  display: "var(--font-display), Georgia, serif",
  mono: "var(--font-mono), 'Courier New', monospace",
  body: "var(--font-body), system-ui, sans-serif",
} as const;

const EXPENSE_CATEGORIES = ["✈️ Transporte", "🏨 Alojamiento", "🍽️ Comida", "🎭 Actividades", "🛍️ Compras", "💊 Salud", "📦 Otros"];
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
    id: "tenerife", name: "Tenerife", country: "España", flag: "🇪🇸",
    costPerPerson: 320, durationDays: 5, type: "playa",
    description: "Playa, volcán y eterna primavera a pocas horas de vuelo. El Teide, las playas negras y Los Gigantes en una isla que lo tiene todo.",
    highlights: ["Teide", "Playa de las Américas", "Los Gigantes", "Loro Parque"],
    itinerary: [
      { date: "", title: "Día 1 — Llegada y Playa de las Américas", items: [{ time: "12:00", text: "Vuelo a Tenerife Sur (TFS)" }, { time: "15:00", text: "Check-in y primer chapuzón en Playa de las Américas" }, { time: "20:30", text: "Cena en el paseo marítimo" }] },
      { date: "", title: "Día 2 — El Teide", items: [{ time: "08:00", text: "Ruta hacia el Parque Nacional del Teide" }, { time: "10:30", text: "Teleférico hasta los 3.500 m" }, { time: "14:00", text: "Bajada y visita al pueblo de La Orotava" }, { time: "20:00", text: "Cena en Puerto de la Cruz" }] },
      { date: "", title: "Día 3 — Norte salvaje", items: [{ time: "09:30", text: "Los Gigantes — acantilados de 800 m" }, { time: "11:00", text: "Excursión en barco: delfines y ballenas" }, { time: "16:30", text: "Playa de la Arena (arena negra volcánica)" }] },
      { date: "", title: "Día 4 — Loro Parque y Santa Cruz", items: [{ time: "10:00", text: "Loro Parque en Puerto de la Cruz" }, { time: "18:00", text: "Sunset en Punta del Hidalgo" }, { time: "21:00", text: "Cena de despedida en Santa Cruz" }] },
      { date: "", title: "Día 5 — Regreso", items: [{ time: "09:00", text: "Último baño en la playa" }, { time: "13:00", text: "Traslado al aeropuerto y vuelo de regreso" }] },
    ],
    mapPlaces: [
      { name: "Teide", lat: 28.27, lon: -16.64, note: "Pico más alto de España (3.718 m)" },
      { name: "Playa de las Américas", lat: 28.05, lon: -16.72, note: "Playa principal, animada" },
      { name: "Los Gigantes", lat: 28.24, lon: -16.84, note: "Acantilados espectaculares" },
      { name: "Loro Parque", lat: 28.41, lon: -16.55, note: "Parque zoológico y de naturaleza" },
      { name: "La Orotava", lat: 28.39, lon: -16.52, note: "Pueblo histórico colonial" },
    ],
  },
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
    id: "praga", name: "Praga", country: "Rep. Checa", flag: "🇨🇿",
    costPerPerson: 600, durationDays: 4, type: "ciudad",
    description: "La ciudad de las cien torres: casco medieval intacto, cerveza artesanal y el río Moldava. La joya de Europa del Este.",
    highlights: ["Castillo de Praga", "Puente Carlos", "Barrio Judío", "Reloj Astronómico"],
    itinerary: [
      { date: "", title: "Día 1 — Ciudad Vieja", items: [{ time: "13:00", text: "Llegada a Václav Havel Airport" }, { time: "16:00", text: "Plaza de la Ciudad Vieja y Reloj Astronómico (da las horas)" }, { time: "18:00", text: "Puente Carlos al atardecer" }, { time: "20:00", text: "Cena en taberna checa con cerveza Pilsner Urquell" }] },
      { date: "", title: "Día 2 — Castillo de Praga", items: [{ time: "09:00", text: "Castillo de Praga — el más grande del mundo" }, { time: "11:00", text: "Catedral de San Vito" }, { time: "12:30", text: "Callejón del Oro" }, { time: "15:00", text: "Malá Strana (ciudad pequeña)" }, { time: "17:00", text: "Colina de Petřín — vistas panorámicas" }] },
      { date: "", title: "Día 3 — Josefov y cerveza", items: [{ time: "09:30", text: "Barrio Judío Josefov y sinagoga Pinkas" }, { time: "13:00", text: "Almuerzo de svíčková con knedlíky" }, { time: "15:30", text: "Paseo por Wenceslao" }, { time: "18:00", text: "Tour de bares y cervezas artesanales de Praga" }] },
      { date: "", title: "Día 4 — Mercado y regreso", items: [{ time: "09:00", text: "Mercado de Náplavka a orillas del Moldava" }, { time: "12:00", text: "Último trdelník (dulce local)" }, { time: "15:00", text: "Traslado al aeropuerto" }] },
    ],
    mapPlaces: [
      { name: "Castillo de Praga", lat: 50.09, lon: 14.40, note: "El complejo castillo más grande del mundo" },
      { name: "Puente Carlos", lat: 50.09, lon: 14.41, note: "Puente medieval con 30 estatuas barrocas" },
      { name: "Plaza de la Ciudad Vieja", lat: 50.09, lon: 14.42, note: "Reloj Astronómico medieval del s. XV" },
      { name: "Josefov", lat: 50.09, lon: 14.42, note: "El barrio judío mejor conservado de Europa" },
      { name: "Colina de Petřín", lat: 50.08, lon: 14.40, note: "Torre-mirador, la Torre Eiffel checa" },
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
    id: "roma", name: "Roma", country: "Italia", flag: "🇮🇹",
    costPerPerson: 850, durationDays: 5, type: "cultura",
    description: "La Ciudad Eterna: 2.500 años de historia en cada esquina. Coliseo, Vaticano, pasta y dolce vita.",
    highlights: ["Coliseo", "Vaticano", "Fontana di Trevi", "Trastevere"],
    itinerary: [
      { date: "", title: "Día 1 — El Coliseo y el Foro Romano", items: [{ time: "10:00", text: "Llegada a Fiumicino" }, { time: "14:00", text: "Coliseo y Arco de Constantino (reserva previa)" }, { time: "16:30", text: "Foro Romano y Palatino" }, { time: "20:00", text: "Cena en Trastevere con carbonara auténtica" }] },
      { date: "", title: "Día 2 — El Vaticano", items: [{ time: "08:30", text: "Museos Vaticanos y Capilla Sixtina (entrada reservada)" }, { time: "12:00", text: "Basílica de San Pedro y cúpula" }, { time: "15:00", text: "Castel Sant'Angelo" }, { time: "20:00", text: "Aperitivo en el barrio Prati" }] },
      { date: "", title: "Día 3 — Centro histórico", items: [{ time: "09:30", text: "Fontana di Trevi — echar la moneda" }, { time: "10:30", text: "Panteón (2.000 años sin grietas)" }, { time: "12:00", text: "Plaza Navona" }, { time: "15:30", text: "Campo de' Fiori" }, { time: "19:30", text: "Aperitivo romano con Campari Spritz" }] },
      { date: "", title: "Día 4 — Borghese y el Aventino", items: [{ time: "09:00", text: "Galería Borghese (reserva obligatoria)" }, { time: "12:00", text: "Jardines de Villa Borghese" }, { time: "16:00", text: "Barrio de Trastevere a pie" }, { time: "20:00", text: "Cena con pizza romana en Trastevere" }] },
      { date: "", title: "Día 5 — Gelato final", items: [{ time: "09:00", text: "Barrio Testaccio (el más auténtico)" }, { time: "12:00", text: "Última pasta all'amatriciana" }, { time: "14:00", text: "Gelato de Giolitti" }, { time: "16:30", text: "Traslado al aeropuerto" }] },
    ],
    mapPlaces: [
      { name: "Coliseo", lat: 41.89, lon: 12.49, note: "Anfiteatro romano del año 80 d.C." },
      { name: "Vaticano", lat: 41.90, lon: 12.45, note: "El Estado más pequeño del mundo, Capilla Sixtina" },
      { name: "Fontana di Trevi", lat: 41.90, lon: 12.48, note: "La fuente más famosa del mundo" },
      { name: "Panteón", lat: 41.90, lon: 12.48, note: "Templo romano del año 125 d.C., cúpula sin grietas" },
      { name: "Trastevere", lat: 41.89, lon: 12.47, note: "El barrio más auténtico y bohemio de Roma" },
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
    id: "santorini", name: "Santorini", country: "Grecia", flag: "🇬🇷",
    costPerPerson: 1300, durationDays: 6, type: "playa",
    description: "Casas blancas, cúpulas azules y el atardecer más fotografiado del Mediterráneo. El lujo griego accesible.",
    highlights: ["Oía", "Caldera", "Playa Roja", "Volcán Nea Kameni"],
    itinerary: [
      { date: "", title: "Día 1 — Bienvenido a la caldera", items: [{ time: "15:00", text: "Vuelo a Santorini (JTR) vía Atenas" }, { time: "18:00", text: "Check-in en hotel en Imerovigli" }, { time: "20:00", text: "Cena con vistas al volcán y el sol hundiéndose" }] },
      { date: "", title: "Día 2 — Oía y el atardecer", items: [{ time: "09:00", text: "Ruta a pie de Fira a Oía (10 km, 3h)" }, { time: "13:00", text: "Almuerzo en Imerovigli" }, { time: "16:00", text: "Oía: casas blancas y callejones azules" }, { time: "19:30", text: "El atardecer de Oía (llegar 1h antes por el gentío)" }] },
      { date: "", title: "Día 3 — Playas volcánicas", items: [{ time: "10:00", text: "Playa Roja (Kokkini Paralia) — arena roja volcánica" }, { time: "13:00", text: "Playa Negra de Perissa" }, { time: "14:30", text: "Almuerzo con pulpo a la brasa" }, { time: "17:00", text: "Playa de Kamari" }] },
      { date: "", title: "Día 4 — Volcán y aguas termales", items: [{ time: "09:00", text: "Barco al volcán de Nea Kameni" }, { time: "11:00", text: "Baño en las aguas termales naturales" }, { time: "13:30", text: "Parada en la isla de Thirassia" }, { time: "16:00", text: "Regreso a Fira" }] },
      { date: "", title: "Día 5 — Akrotiri y vino", items: [{ time: "09:30", text: "Ruinas de Akrotiri (la Pompeya griega, 1.600 a.C.)" }, { time: "12:00", text: "Cata de vinos de la isla en bodega volcánica" }, { time: "16:00", text: "Playa de Vlychada" }] },
      { date: "", title: "Día 6 — Regreso", items: [{ time: "09:00", text: "Desayuno griego: yogur, miel y feta" }, { time: "11:00", text: "Últimas fotos y compras" }, { time: "14:00", text: "Traslado al aeropuerto" }] },
    ],
    mapPlaces: [
      { name: "Oía", lat: 36.46, lon: 25.37, note: "El atardecer más famoso del Mediterráneo" },
      { name: "Fira", lat: 36.43, lon: 25.43, note: "Capital de Santorini, al borde del cráter" },
      { name: "Playa Roja", lat: 36.35, lon: 25.40, note: "Arena volcánica roja, única en Europa" },
      { name: "Akrotiri", lat: 36.35, lon: 25.40, note: "Ruinas minoicas de 3.600 años, perfectamente conservadas" },
      { name: "Volcán Nea Kameni", lat: 36.40, lon: 25.40, note: "Volcán activo en el centro de la caldera" },
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
];

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

function project(lon: number, lat: number) {
  return {
    x: Math.max(0, Math.min(100, ((lon + 180) / 360) * 100)),
    y: Math.max(0, Math.min(70,  ((90 - lat)  / 180) * 70)),
  };
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
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) as T : fallback; } catch { return fallback; }
}
async function saveShared(key: string, value: unknown): Promise<boolean> {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
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

function Card({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={className} style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, padding: 18, ...style }}>
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

function EntryScreen({ onEnter, externalError }: { onEnter: (code: string, name: string) => Promise<void>; externalError: string }) {
  const [mode, setMode] = useState<"join" | "create">("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
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

  return (
    <div style={{ minHeight: "100dvh", fontFamily: F.body, color: C.ink, display: "flex", flexDirection: "column" }}>
      {/* Hero top panel */}
      <div
        className="dot-grid relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${C.navy} 0%, #0F1A2E 60%, #162038 100%)`, flex: "0 0 auto" }}
      >
        {/* Glow orbs */}
        <div className="glow-pulse" style={{ position: "absolute", top: -60, right: -60, width: 260, height: 260, borderRadius: 999, background: `radial-gradient(circle, ${C.gold}22, transparent 70%)`, pointerEvents: "none" }} />
        <div className="glow-pulse" style={{ position: "absolute", bottom: -40, left: 40, width: 180, height: 180, borderRadius: 999, background: `radial-gradient(circle, ${C.teal}33, transparent 70%)`, pointerEvents: "none", animationDelay: "1.5s" }} />

        <div className="max-w-5xl mx-auto px-6 py-12 relative">
          <div className="flex flex-col md:flex-row items-center gap-10">
            {/* Left: Branding */}
            <div className="flex-1 text-center md:text-left">
              <div className="float inline-block mb-6">
                <Plane size={52} color={C.gold} strokeWidth={1.2} />
              </div>
              <h1 style={{ fontFamily: F.display, fontSize: "clamp(2.2rem, 5vw, 3.6rem)", fontWeight: 700, color: "#fff", lineHeight: 1.1, letterSpacing: -1 }}>
                Bitácora<br />de Viaje
              </h1>
              <p style={{ color: "#B9C3D6", fontSize: 16, marginTop: 12, maxWidth: 340, lineHeight: 1.6 }}>
                Planifica, comparte y revive tus aventuras junto a tu gente — sin apps, sin contraseñas.
              </p>
              {/* Feature pills */}
              <div className="flex flex-wrap gap-2 mt-6 justify-center md:justify-start">
                {[
                  ["🌍", "Destinos"], ["✈️", "Itinerario"], ["🗺️", "Mapa"],
                  ["🧳", "Equipaje"], ["💶", "Gastos"], ["💡", "Ideas"], ["📸", "Fotos"],
                ].map(([icon, label]) => (
                  <span key={label} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "#B9C3D6", fontSize: 12, fontFamily: F.mono, borderRadius: 999, padding: "4px 10px" }}>
                    {icon} {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Right: Form card */}
            <div style={{ width: "100%", maxWidth: 400, background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.35)" }}>
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

// ─── Main App ─────────────────────────────────────────────────────────────────

type TabId = "resumen" | "itinerario" | "mapa" | "fotos" | "checklist" | "gastos" | "equipaje" | "ideas" | "ahorro" | "destinos";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [tab, setTab] = useState<TabId>("resumen");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [entryError, setEntryError] = useState("");

  useEffect(() => {
    (async () => {
      const last = await loadPersonal<Session | null>("lastSession", null);
      if (last?.code && last?.name) {
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

  function leave() { setSession(null); setTrip(null); setTab("resumen"); }

  const days = useCountdown(trip?.startDate ?? null);

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

  if (!session || !trip) return <EntryScreen onEnter={enter} externalError={entryError} />;

  const tabs: { id: TabId; label: string; Icon: React.ElementType }[] = [
    { id: "resumen",    label: "Inicio",     Icon: Sunrise },
    { id: "itinerario", label: "Plan",        Icon: Plane },
    { id: "mapa",       label: "Mapa",        Icon: MapPin },
    { id: "fotos",      label: "Fotos",       Icon: Camera },
    { id: "gastos",     label: "Gastos",      Icon: Wallet },
    { id: "equipaje",   label: "Equipaje",    Icon: Luggage },
    { id: "checklist",  label: "Checklist",   Icon: ListChecks },
    { id: "ideas",      label: "Ideas",       Icon: Lightbulb },
    { id: "ahorro",     label: "Ahorro",      Icon: PiggyBank },
    { id: "destinos",   label: "Destinos",    Icon: Globe },
  ];

  return (
    <div style={{ background: C.paper, fontFamily: F.body, color: C.ink, minHeight: "100dvh" }}>
      {/* Header */}
      <header style={{ background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navyMid} 100%)`, color: C.paper }} className="dot-grid">
        <div className="max-w-4xl mx-auto px-4 pt-4 pb-0">
          <button onClick={leave} className="flex items-center gap-1 mb-3" style={{ color: "#7C8AA3", fontSize: 11, fontFamily: F.mono }}>
            <ArrowLeft size={12} /> CAMBIAR DE VIAJE
          </button>

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
      <main className="max-w-4xl mx-auto px-4 py-6 fade-in" key={tab}>
        {tab === "resumen"    && <Resumen trip={trip} session={session} days={days} />}
        {tab === "itinerario" && <Itinerario code={session.code} />}
        {tab === "mapa"       && <Mapa code={session.code} />}
        {tab === "fotos"      && <Fotos code={session.code} session={session} />}
        {tab === "checklist"  && <Checklist code={session.code} session={session} />}
        {tab === "gastos"     && <Gastos code={session.code} session={session} members={trip.members} />}
        {tab === "equipaje"   && <Equipaje code={session.code} session={session} />}
        {tab === "ideas"      && <Ideas code={session.code} session={session} />}
        {tab === "ahorro"     && <Ahorro code={session.code} members={trip.members} />}
        {tab === "destinos"   && <Destinos code={session.code} onSelect={() => setTab("itinerario")} />}
      </main>
    </div>
  );
}

// ─── Resumen ──────────────────────────────────────────────────────────────────

function Resumen({ trip, session, days }: { trip: Trip; session: Session; days: number | null }) {
  const dur = tripDuration(trip.startDate, trip.endDate);

  return (
    <div className="flex flex-col gap-4">
      {/* Countdown hero card */}
      {days !== null && (
        <div style={{ background: `linear-gradient(135deg, ${C.navy}, ${C.navyMid})`, borderRadius: 12, padding: "24px 20px", color: C.paper, position: "relative", overflow: "hidden" }}>
          <div className="glow-pulse" style={{ position: "absolute", top: -30, right: -30, width: 140, height: 140, borderRadius: 999, background: `radial-gradient(circle, ${C.gold}25, transparent 70%)`, pointerEvents: "none" }} />
          <div style={{ fontFamily: F.mono, fontSize: 10, color: C.gold, letterSpacing: 2 }}>CUENTA ATRÁS</div>
          <div style={{ fontFamily: F.display, fontSize: "clamp(3rem, 10vw, 5rem)", fontWeight: 700, color: C.goldLight, lineHeight: 1, marginTop: 4 }}>
            {days > 0 ? days : days === 0 ? "¡HOY!" : "¡EN MARCHA!"}
          </div>
          {days > 0 && <div style={{ fontFamily: F.mono, fontSize: 12, color: "#9FAEC4", marginTop: 4 }}>días para {trip.destination || trip.name}</div>}
          {trip.startDate && (
            <div style={{ marginTop: 12, fontFamily: F.mono, fontSize: 11, color: "#7C8AA3" }}>
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

      {/* Tip */}
      <div style={{ border: `1px dashed ${C.line}`, borderRadius: 8, padding: "14px 16px" }}>
        <p style={{ color: C.inkSoft, fontSize: 13, lineHeight: 1.7 }}>
          Comparte el código <strong style={{ color: C.ink, fontFamily: F.mono }}>{session.code}</strong> con tu grupo.
          Usa las pestañas para planificar el <strong style={{ color: C.ink }}>itinerario</strong>, dividir los <strong style={{ color: C.ink }}>gastos</strong>, preparar el <strong style={{ color: C.ink }}>equipaje</strong> y votar <strong style={{ color: C.ink }}>ideas</strong>.
        </p>
      </div>
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

const BLOBS = [
  "M 8,20 Q 14,14 22,16 Q 30,20 28,30 Q 24,38 16,36 Q 8,30 8,20 Z",
  "M 20,42 Q 27,38 30,48 Q 28,58 24,56 Q 18,50 20,42 Z",
  "M 44,18 Q 54,14 58,22 Q 56,30 50,28 Q 44,26 44,18 Z",
  "M 46,34 Q 56,30 58,46 Q 54,56 48,52 Q 42,44 46,34 Z",
  "M 60,16 Q 78,12 84,24 Q 80,36 68,34 Q 58,26 60,16 Z",
  "M 78,48 Q 88,46 88,54 Q 84,60 80,58 Q 76,52 78,48 Z",
];

function Mapa({ code }: { code: string }) {
  const [places, setPlaces] = useState<MapPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", lat: "", lon: "", note: "" });
  const [active, setActive] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const key = `mapa:${code}`;
  useEffect(() => { loadShared<MapPlace[]>(key, []).then(p => { setPlaces(p); setLoading(false); }); }, [key]);
  const persist = useCallback(async (next: MapPlace[]) => { setPlaces(next); await saveShared(key, next); }, [key]);

  function addPlace() {
    setErr("");
    if (!form.name.trim()) { setErr("Escribe un nombre."); return; }
    const lat = parseFloat(form.lat), lon = parseFloat(form.lon);
    if (isNaN(lat) || lat < -90 || lat > 90) { setErr("Latitud inválida (−90 a 90)."); return; }
    if (isNaN(lon) || lon < -180 || lon > 180) { setErr("Longitud inválida (−180 a 180)."); return; }
    persist([...places, { id: uid(), name: form.name.trim(), lat, lon, note: form.note.trim() }]);
    setForm({ name: "", lat: "", lon: "", note: "" });
  }

  if (loading) return <SkeletonCards />;
  const activePlace = places.find(p => p.id === active);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <SectionLabel>Añadir destino</SectionLabel>
        <p style={{ color: C.inkSoft, fontSize: 12, marginTop: 4 }}>Busca &ldquo;lat long [ciudad]&rdquo; en Google. Ej: Atenas → 37.97, 23.72</p>
        <div className="flex flex-wrap gap-2 mt-3">
          <input placeholder="Nombre" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={{ ...inputStyle, flex: "2 1 140px" }} />
          <input placeholder="Lat" value={form.lat} onChange={e => setForm({ ...form, lat: e.target.value })} style={{ ...inputStyle, width: 80, fontFamily: F.mono, fontSize: 12 }} />
          <input placeholder="Lon" value={form.lon} onChange={e => setForm({ ...form, lon: e.target.value })} style={{ ...inputStyle, width: 80, fontFamily: F.mono, fontSize: 12 }} />
          <input placeholder="Nota (opcional)" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} onKeyDown={e => e.key === "Enter" && addPlace()} style={{ ...inputStyle, flex: "2 1 140px" }} />
          <button onClick={addPlace} style={{ background: C.navy, color: C.paper, borderRadius: 5, padding: "0 18px", fontFamily: F.mono, fontSize: 12, height: 39 }}>AÑADIR</button>
        </div>
        {err && <Banner type="error" msg={err} />}
      </Card>

      <Card style={{ padding: 12 }}>
        <div style={{ position: "relative", width: "100%", paddingBottom: "50%", background: "#D0E4E2", borderRadius: 6, overflow: "hidden" }}>
          <svg viewBox="0 0 100 70" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
            {BLOBS.map((d, i) => <path key={i} d={d} fill={C.teal} opacity={0.22} />)}
            {places.map(p => {
              const { x, y } = project(p.lon, p.lat);
              const isA = active === p.id;
              return (
                <g key={p.id} onClick={() => setActive(isA ? null : p.id)} style={{ cursor: "pointer" }}>
                  <circle cx={x} cy={y} r={isA ? 3 : 2} fill={isA ? C.gold : C.red} stroke="#fff" strokeWidth={0.5} />
                  {isA && <text x={x + 3.5} y={y + 1.2} fontSize={3.5} fill={C.navy} fontFamily={F.mono}>{p.name.slice(0, 16)}</text>}
                </g>
              );
            })}
          </svg>
        </div>
        {activePlace && (
          <div className="mt-2 px-2 py-1.5 rounded" style={{ background: C.paperDark, fontSize: 13 }}>
            <strong>{activePlace.name}</strong>{activePlace.note && <span style={{ color: C.inkSoft }}> — {activePlace.note}</span>}
            <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkSoft, marginLeft: 8 }}>{activePlace.lat.toFixed(2)}, {activePlace.lon.toFixed(2)}</span>
          </div>
        )}
        <p style={{ color: C.inkSoft, fontSize: 11, marginTop: 6 }}>Mapa esquemático · clic en pin para detalle</p>
      </Card>

      <div className="flex flex-col gap-2">
        {places.map(p => (
          <div key={p.id} onClick={() => setActive(p.id === active ? null : p.id)}
            className="flex items-center justify-between px-3 py-2 card-lift"
            style={{ background: active === p.id ? C.paperDark : "#fff", border: `1px solid ${C.line}`, borderRadius: 6, cursor: "pointer" }}>
            <div>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</span>
              {p.note && <span style={{ color: C.inkSoft, fontSize: 13 }}> — {p.note}</span>}
              <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkSoft, marginLeft: 8 }}>{p.lat.toFixed(2)}, {p.lon.toFixed(2)}</span>
            </div>
            <button onClick={e => { e.stopPropagation(); persist(places.filter(x => x.id !== p.id)); if (active === p.id) setActive(null); }} style={{ color: C.inkSoft, padding: 4 }}><Trash2 size={14} /></button>
          </div>
        ))}
        {places.length === 0 && <EmptyState icon={<MapPin size={28} color={C.line} />} text="Añade el primer destino arriba." />}
      </div>
    </div>
  );
}

// ─── Fotos ────────────────────────────────────────────────────────────────────

function Fotos({ code, session }: { code: string; session: Session }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ url: "", caption: "" });
  const [err, setErr] = useState("");
  const [lightbox, setLightbox] = useState<Photo | null>(null);
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
          <p style={{ color: C.inkSoft, fontSize: 12, marginTop: 4 }}>Pega la URL directa de una imagen (Google Fotos, Imgur, etc. en modo público).</p>
          <div className="flex flex-wrap gap-2 mt-3">
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

function Gastos({ code, session, members }: { code: string; session: Session; members: string[] }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ description: "", amount: "", paidBy: session.name, category: EXPENSE_CATEGORIES[0], date: "", splitWith: [] as string[] });
  const [err, setErr] = useState("");
  const [showSettle, setShowSettle] = useState(false);
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

      {/* List */}
      <div className="flex flex-col gap-2">
        {expenses.map(e => (
          <div key={e.id} className="flex items-center gap-3 px-3 py-2" style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 6 }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>{e.category.split(" ")[0]}</span>
            <div className="flex-1 min-w-0">
              <div style={{ fontWeight: 600, fontSize: 14 }}>{e.description}</div>
              <div style={{ fontFamily: F.mono, fontSize: 11, color: C.inkSoft }}>
                Pagó {e.paidBy}{e.splitWith.length > 0 ? ` · con ${e.splitWith.join(", ")}` : " · todos"} · {e.date}
              </div>
            </div>
            <span style={{ fontFamily: F.mono, fontSize: 14, fontWeight: 700, color: C.ink, flexShrink: 0 }}>{e.amount.toFixed(2)} €</span>
            <button onClick={() => persist(expenses.filter(x => x.id !== e.id))} style={{ color: C.inkSoft, padding: 4 }}><Trash2 size={14} /></button>
          </div>
        ))}
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

function DestCard({ dest, budget, onChoose }: { dest: DestinationTemplate; budget: number; onChoose: () => void }) {
  const [open, setOpen] = useState(false);
  const withinBudget = budget === 0 || dest.costPerPerson <= budget;
  const missing = budget > 0 ? dest.costPerPerson - budget : 0;
  const typeColor = TYPE_COLORS[dest.type] ?? C.inkSoft;

  return (
    <div className="card-lift" style={{ background: "#fff", border: `1px solid ${withinBudget ? C.line : C.paperDark}`, borderRadius: 10, overflow: "hidden", opacity: withinBudget ? 1 : 0.72 }}>
      <div className="flex items-start gap-3 p-4" style={{ cursor: "pointer" }} onClick={() => setOpen(v => !v)}>
        <div style={{ fontSize: 30, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>{dest.flag}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <div style={{ fontFamily: F.display, fontSize: 17, fontWeight: 700, color: C.ink }}>{dest.name}</div>
              <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkSoft }}>{dest.country} · {dest.durationDays} días</div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontFamily: F.display, fontSize: 18, fontWeight: 700, color: withinBudget ? C.green : C.red }}>
                ~{dest.costPerPerson.toLocaleString("es-ES")} €
              </div>
              <div style={{ fontFamily: F.mono, fontSize: 9, color: withinBudget ? C.green : C.red }}>
                {withinBudget
                  ? (budget > 0 ? `SOBRAN ~${(budget - dest.costPerPerson).toFixed(0)} €` : "TODO INCLUIDO · POR PERSONA")
                  : `FALTAN ~${missing.toFixed(0)} €`}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span style={{ fontFamily: F.mono, fontSize: 10, padding: "2px 8px", borderRadius: 999, background: `${typeColor}22`, color: typeColor, border: `1px solid ${typeColor}44` }}>
              {dest.type.toUpperCase()}
            </span>
            {dest.highlights.slice(0, 3).map(h => (
              <span key={h} style={{ fontFamily: F.mono, fontSize: 10, color: C.inkSoft }}>{h}</span>
            ))}
          </div>
        </div>
        <ChevronDown size={15} color={C.inkSoft} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0, marginTop: 3 }} />
      </div>

      {open && (
        <div className="fade-in" style={{ borderTop: `1px solid ${C.paperDark}` }}>
          <div className="px-4 py-3 flex flex-col gap-3">
            <p style={{ color: C.inkSoft, fontSize: 13, lineHeight: 1.6 }}>{dest.description}</p>

            <div style={{ background: C.paperDark, borderRadius: 6, padding: "10px 14px", fontFamily: F.mono, fontSize: 11, color: C.inkSoft }}>
              ✈️ Vuelo · 🏨 Alojamiento · 🍽️ Comida · 🎭 Actividades — <strong style={{ color: C.ink }}>todo incluido</strong> en ~{dest.costPerPerson.toLocaleString("es-ES")} €/persona
            </div>

            <div>
              <SectionLabel>Itinerario incluido</SectionLabel>
              <div className="flex flex-col gap-1 mt-2">
                {dest.itinerary.map((d, i) => (
                  <div key={i} className="flex gap-2 items-baseline">
                    <div style={{ fontFamily: F.mono, fontSize: 10, color: C.gold, width: 18, textAlign: "right", flexShrink: 0 }}>{i + 1}</div>
                    <div style={{ fontSize: 13, color: C.ink }}>{d.title}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>Lugares en el mapa</SectionLabel>
              <div className="flex flex-wrap gap-2 mt-2">
                {dest.mapPlaces.map(p => (
                  <div key={p.name} className="flex items-center gap-1" style={{ fontFamily: F.mono, fontSize: 11, color: C.inkSoft }}>
                    <MapPin size={10} color={C.teal} /> {p.name}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="px-4 pb-4">
            <button onClick={onChoose} style={{
              width: "100%", background: withinBudget ? C.teal : C.navy, color: "#fff",
              borderRadius: 6, padding: "12px 16px", fontFamily: F.mono, fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
            }}>
              {withinBudget ? "✈ ELEGIR ESTE DESTINO" : "ELEGIR IGUALMENTE →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Destinos({ code, onSelect }: { code: string; onSelect: () => void }) {
  const [savings, setSavings] = useState<SavingsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("todos");
  const [chosen, setChosen] = useState<DestinationTemplate | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    loadShared<SavingsConfig>(`ahorro:${code}`, { targetBudget: 0, phases: [] }).then(c => {
      setSavings(c);
      setLoading(false);
    });
  }, [code]);

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

  const visibleDests = useMemo(() =>
    DESTINATIONS.filter(d => filter === "todos" || d.type === filter),
    [filter]);

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
            <button onClick={() => setConfirming(false)} style={{ flex: 1, background: C.paperDark, color: C.inkSoft, borderRadius: 6, padding: "12px 16px", fontFamily: F.mono, fontSize: 12 }}>CANCELAR</button>
            <button onClick={() => applyDestination(chosen)} style={{ flex: 1, background: C.teal, color: "#fff", borderRadius: 6, padding: "12px 16px", fontFamily: F.mono, fontSize: 12, fontWeight: 700 }}>SÍ, APLICAR →</button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Budget header */}
      <div style={{ background: `linear-gradient(135deg, ${C.navy}, ${C.navyMid})`, borderRadius: 12, padding: "20px 20px", color: C.paper, position: "relative", overflow: "hidden" }} className="dot-grid">
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
            Configura tu plan en la pestaña <strong style={{ color: C.goldLight }}>AHORRO</strong> para ver destinos por presupuesto
          </p>
        )}
        {budgetPerPerson > 0 && (
          <div className="mt-3" style={{ fontFamily: F.mono, fontSize: 11, color: C.goldLight }}>
            {withinBudget.length} destino{withinBudget.length !== 1 ? "s" : ""} alcanzable{withinBudget.length !== 1 ? "s" : ""} con tu presupuesto actual ✓
          </div>
        )}
      </div>

      {/* Type filter pills */}
      <div className="flex flex-wrap gap-2">
        {DEST_TYPE_FILTERS.map(t => (
          <button key={t.value} onClick={() => setFilter(t.value)} style={{
            padding: "6px 12px", borderRadius: 999, fontSize: 12, fontFamily: F.mono,
            background: filter === t.value ? C.navy : C.paperDark,
            color: filter === t.value ? C.paper : C.inkSoft,
            border: `1px solid ${filter === t.value ? C.navy : C.line}`,
            transition: "all 0.15s",
          }}>
            {t.emoji} {t.label.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Within budget */}
      {withinBudget.length > 0 && (
        <div className="flex flex-col gap-3">
          {budgetPerPerson > 0 && (
            <div className="flex items-center gap-2">
              <div style={{ height: 1, flex: 1, background: `${C.green}44` }} />
              <span style={{ fontFamily: F.mono, fontSize: 10, color: C.green, letterSpacing: 1 }}>✓ PUEDES PERMITÍRTELO</span>
              <div style={{ height: 1, flex: 1, background: `${C.green}44` }} />
            </div>
          )}
          {withinBudget.map(dest => (
            <DestCard key={dest.id} dest={dest} budget={budgetPerPerson} onChoose={() => { setChosen(dest); setConfirming(true); }} />
          ))}
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
          {overBudget.map(dest => (
            <DestCard key={dest.id} dest={dest} budget={budgetPerPerson} onChoose={() => { setChosen(dest); setConfirming(true); }} />
          ))}
        </div>
      )}

      {budgetPerPerson === 0 && visibleDests.map(dest => (
        <DestCard key={dest.id} dest={dest} budget={0} onChoose={() => { setChosen(dest); setConfirming(true); }} />
      ))}

      {visibleDests.length === 0 && <EmptyState icon={<Globe size={28} color={C.line} />} text="Sin destinos con ese filtro." />}
    </div>
  );
}
