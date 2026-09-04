export interface Trip {
  name: string;
  destination: string;
  startDate: string | null;
  endDate: string | null;
  members: string[];
  createdAt: number;
  premium?: boolean;
  planning?: TripPlanning;
}
export interface DateOption { id: string; startDate: string; endDate: string; votes: string[]; }
export interface DestOption { id: string; name: string; votes: string[]; }
export interface TripPlanning { open: boolean; dateOptions: DateOption[]; destOptions: DestOption[]; }
export interface Session { code: string; name: string; }
export interface ItineraryDay { id: string; date: string; title: string; items: ItineraryItem[]; }
export interface ItineraryItem { id: string; time: string; text: string; }
export interface MapPlace { id: string; name: string; lat: number; lon: number; note: string; }
export interface Photo { id: string; url: string; caption: string; author: string; addedAt: number; }
export interface ChecklistItem { id: string; text: string; done: boolean; cost: number; by: string; addedAt: number; }
export interface Expense {
  id: string; description: string; amount: number;
  paidBy: string; splitWith: string[]; category: string; date: string;
  // amount is always the EUR equivalent (used for totals/settlements);
  // these two are set only when the expense was entered in another currency.
  origCurrency?: string; origAmount?: number;
}
export interface PackingItem { id: string; text: string; category: string; checkedBy: string[]; bag?: string; }
export interface Idea {
  id: string; text: string; author: string; note: string;
  votes: Record<string, 1 | -1>; addedAt: number;
}
export interface SavingsPhase {
  id: string; name: string; startDate: string; endDate: string; amountPerPerson: number;
}
export interface SavingsConfig {
  targetBudget: number; phases: SavingsPhase[]; numPersonas?: number;
}
export interface Booking {
  id: string;
  type: "vuelo" | "hotel" | "actividad" | "traslado" | "otro";
  title: string;
  confirmationCode: string;
  startDate: string; startTime: string;
  endDate: string; endTime: string;
  location: string; bookingUrl: string; notes: string;
  amount: number;
}
export interface DiaryEntry {
  id: string; date: string; text: string;
  author: string; mood: string; addedAt: number;
}
export interface DestinationTemplate {
  id: string; name: string; country: string; flag: string;
  costPerPerson: number; durationDays: number;
  type: "playa" | "ciudad" | "cultura" | "naturaleza" | "aventura";
  description: string; highlights: string[];
  itinerary: { date: string; title: string; items: { time: string; text: string }[] }[];
  mapPlaces: { name: string; lat: number; lon: number; note: string }[];
}
export interface ChatMsg { role: "user" | "assistant"; content: string; }
export interface TravelDocument {
  id: string;
  kind: "pasaporte" | "visado" | "seguro" | "checkin" | "otro";
  title: string;
  dueDate: string;
  notes: string;
}
export type TabId = "resumen" | "itinerario" | "mapa" | "fotos" | "checklist" | "gastos" | "equipaje" | "ideas" | "ahorro" | "destinos" | "reservas" | "diario" | "asistente";
