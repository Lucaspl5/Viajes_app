import { uid, loadShared, saveShared } from "./utils";
import type { Trip, Session, ItineraryDay, Expense, PackingItem, ChecklistItem, Idea, Booking } from "./types";

// ─── Shared trip context for every AI touchpoint ──────────────────────────────
// Both the full chat (AsistenteIA) and the per-tab quick-ask button build the
// same system prompt from the same live data, so the assistant always knows
// about gastos, equipaje, checklist, ideas and reservas — not just the trip
// name and itinerary.

export interface AiContext {
  itin: ItineraryDay[];
  gastos: Expense[];
  checklist: ChecklistItem[];
  equipaje: PackingItem[];
  ideas: Idea[];
  reservas: Booking[];
}

export async function loadAiContext(code: string): Promise<AiContext> {
  const [itin, gastos, checklist, equipaje, ideas, reservas] = await Promise.all([
    loadShared<ItineraryDay[]>(`itin:${code}`, []),
    loadShared<Expense[]>(`gastos:${code}`, []),
    loadShared<ChecklistItem[]>(`checklist:${code}`, []),
    loadShared<PackingItem[]>(`equipaje:${code}`, []),
    loadShared<Idea[]>(`ideas:${code}`, []),
    loadShared<Booking[]>(`reservas:${code}`, []),
  ]);
  return { itin, gastos, checklist, equipaje, ideas, reservas };
}

function summarize(ctx: AiContext): string {
  const parts: string[] = [];
  parts.push(ctx.itin.length
    ? `Itinerario: ${ctx.itin.length} días planificados (${ctx.itin.map(d => d.title).join("; ")}).`
    : "Itinerario: vacío todavía.");
  const totalGasto = ctx.gastos.reduce((s, e) => s + e.amount, 0);
  parts.push(ctx.gastos.length
    ? `Gastos: ${ctx.gastos.length} registrados, ${totalGasto.toFixed(2)}€ en total (últimos: ${ctx.gastos.slice(-5).map(e => `${e.description} ${e.amount}€`).join(", ")}).`
    : "Gastos: ninguno registrado todavía.");
  parts.push(ctx.checklist.length
    ? `Checklist: ${ctx.checklist.filter(i => i.done).length}/${ctx.checklist.length} hechas.`
    : "Checklist: vacía.");
  parts.push(ctx.equipaje.length
    ? `Equipaje: ${ctx.equipaje.length} artículos (${ctx.equipaje.slice(0, 8).map(i => i.text).join(", ")}${ctx.equipaje.length > 8 ? "…" : ""}).`
    : "Equipaje: lista vacía.");
  parts.push(ctx.ideas.length
    ? `Ideas propuestas: ${ctx.ideas.map(i => i.text).slice(0, 8).join("; ")}.`
    : "Ideas: ninguna todavía.");
  parts.push(ctx.reservas.length
    ? `Reservas: ${ctx.reservas.map(b => `${b.type} "${b.title}"`).join(", ")}.`
    : "Reservas: ninguna registrada.");
  return parts.join("\n");
}

export function buildSystemPrompt(trip: Trip, ctx: AiContext): string {
  return `Eres un asistente experto en planificación de viajes integrado en Bitácora de Viaje, una app colaborativa en español.

Datos del viaje actual:
- Nombre: ${trip.name}
- Destino: ${trip.destination || "no especificado"}
- Fechas: ${trip.startDate ? `${trip.startDate} → ${trip.endDate || "?"}` : "no fijadas"}
- Viajeros: ${trip.members.join(", ")} (${trip.members.length} persona${trip.members.length !== 1 ? "s" : ""})

Estado actual del viaje:
${summarize(ctx)}

Usa este contexto para dar respuestas concretas y coherentes con lo que el grupo ya tiene planeado (no repitas gastos o ideas que ya existen, ten en cuenta los días que ya tiene el itinerario, etc.).

Cuando el usuario pida crear o ampliar el itinerario, responde con tu explicación y AL FINAL incluye el itinerario en este formato JSON exacto, delimitado por \`\`\`json y \`\`\`:
{
  "itinerary": [
    { "title": "Día 1 — Nombre descriptivo", "items": [ { "time": "09:00", "text": "Descripción de la actividad" } ] }
  ]
}

Cuando el usuario pida añadir algo concreto a la app (un gasto, un artículo de equipaje, una tarea de checklist, una idea, o una reserva), responde con tu explicación y AL FINAL incluye las acciones en este formato JSON exacto, delimitado por \`\`\`actions y \`\`\` (usa solo los tipos que necesites, puedes combinar varias):
{
  "actions": [
    { "type": "add_expense", "description": "Cena de bienvenida", "amount": 25, "category": "🍽️ Comida" },
    { "type": "add_packing_item", "text": "Protector solar", "category": "🧴 Higiene" },
    { "type": "add_checklist_item", "text": "Reservar hotel" },
    { "type": "add_idea", "text": "Visitar el museo local", "note": "" },
    { "type": "add_booking", "bookingType": "hotel", "title": "Hotel Central", "location": "", "notes": "" }
  ]
}
No inventes acciones si el usuario no ha pedido añadir nada — solo úsalas cuando la petición sea clara.

Responde siempre en español. Sé concreto, práctico y entusiasta.`;
}

// ─── Structured actions the model can propose ─────────────────────────────────

export type AiAction =
  | { type: "add_expense"; description: string; amount: number; category?: string }
  | { type: "add_packing_item"; text: string; category?: string }
  | { type: "add_checklist_item"; text: string }
  | { type: "add_idea"; text: string; note?: string }
  | { type: "add_booking"; bookingType?: Booking["type"]; title: string; location?: string; notes?: string };

export function parseItinerary(text: string): { title: string; items: { time: string; text: string }[] }[] | null {
  const match = text.match(/```json\s*([\s\S]*?)```/);
  if (!match) return null;
  try { return JSON.parse(match[1]).itinerary ?? null; } catch { return null; }
}

export function parseActions(text: string): AiAction[] | null {
  const match = text.match(/```actions\s*([\s\S]*?)```/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    return Array.isArray(parsed.actions) ? parsed.actions : null;
  } catch { return null; }
}

export function stripActionBlocks(content: string): string {
  return content.replace(/```json[\s\S]*?```/g, "").replace(/```actions[\s\S]*?```/g, "").trim();
}

export function actionLabel(a: AiAction): string {
  switch (a.type) {
    case "add_expense": return `💶 Gasto: ${a.description} (${a.amount}€)`;
    case "add_packing_item": return `🧳 Equipaje: ${a.text}`;
    case "add_checklist_item": return `✅ Checklist: ${a.text}`;
    case "add_idea": return `💡 Idea: ${a.text}`;
    case "add_booking": return `🎫 Reserva: ${a.title}`;
  }
}

export async function applyAction(code: string, session: Session, action: AiAction): Promise<void> {
  switch (action.type) {
    case "add_expense": {
      const list = await loadShared<Expense[]>(`gastos:${code}`, []);
      const item: Expense = {
        id: uid(), description: action.description, amount: action.amount,
        paidBy: session.name, splitWith: [], category: action.category || "📦 Otros",
        date: new Date().toISOString().slice(0, 10),
      };
      await saveShared(`gastos:${code}`, [item, ...list]);
      return;
    }
    case "add_packing_item": {
      const list = await loadShared<PackingItem[]>(`equipaje:${code}`, []);
      const item: PackingItem = { id: uid(), text: action.text, category: action.category || "🎒 Otros", checkedBy: [] };
      await saveShared(`equipaje:${code}`, [item, ...list]);
      return;
    }
    case "add_checklist_item": {
      const list = await loadShared<ChecklistItem[]>(`checklist:${code}`, []);
      const item: ChecklistItem = { id: uid(), text: action.text, done: false, cost: 0, by: session.name, addedAt: Date.now() };
      await saveShared(`checklist:${code}`, [item, ...list]);
      return;
    }
    case "add_idea": {
      const list = await loadShared<Idea[]>(`ideas:${code}`, []);
      const item: Idea = { id: uid(), text: action.text, author: session.name, note: action.note || "", votes: {}, addedAt: Date.now() };
      await saveShared(`ideas:${code}`, [item, ...list]);
      return;
    }
    case "add_booking": {
      const list = await loadShared<Booking[]>(`reservas:${code}`, []);
      const item: Booking = {
        id: uid(), type: action.bookingType || "otro", title: action.title,
        confirmationCode: "", startDate: "", startTime: "", endDate: "", endTime: "",
        location: action.location || "", bookingUrl: "", notes: action.notes || "", amount: 0,
      };
      await saveShared(`reservas:${code}`, [item, ...list]);
      return;
    }
  }
}
