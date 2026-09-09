import type { DestinationTemplate } from "./types";
import { DESTINATIONS } from "./data/destinations";

export type Season = "primavera" | "verano" | "otono" | "invierno";

export const SEASON_LABELS: Record<Season, { label: string; emoji: string }> = {
  primavera: { label: "Primavera", emoji: "🌱" },
  verano: { label: "Verano", emoji: "☀️" },
  otono: { label: "Otoño", emoji: "🍂" },
  invierno: { label: "Invierno", emoji: "❄️" },
};

export function seasonOfDate(dateStr: string): Season {
  const month = parseInt(dateStr.slice(5, 7), 10);
  if (month === 12 || month <= 2) return "invierno";
  if (month <= 5) return "primavera";
  if (month <= 8) return "verano";
  return "otono";
}

// Best-effort estimate, not real seasonal fare data: keyword overrides for
// destinations that are only sensible in a specific season, falling back to
// a broad guess from the destination's activity type.
export function inferDestinationSeasons(dest: DestinationTemplate): Season[] {
  const text = `${dest.name} ${dest.description} ${dest.highlights.join(" ")}`.toLowerCase();
  if (/esqu[íi]|nieve|aurora boreal|\bski\b/.test(text)) return ["invierno"];
  if (/trekking|himalaya|annapurna|kilimanjaro/.test(text)) return ["primavera", "otono"];
  switch (dest.type) {
    case "playa": return ["verano"];
    case "naturaleza": return ["primavera", "verano"];
    case "ciudad":
    case "cultura": return ["primavera", "otono"];
    case "aventura": return ["primavera", "verano", "otono"];
    default: return ["primavera", "verano", "otono", "invierno"];
  }
}

// Data-driven seasonal price index: average cost of destinations tagged for
// each season, relative to the average across all destinations. Not real
// market fares — a proxy built from the app's own destination catalogue.
function buildSeasonPriceIndex(): Record<Season, number> {
  const overallAvg = DESTINATIONS.reduce((s, d) => s + d.costPerPerson, 0) / DESTINATIONS.length;
  const seasons: Season[] = ["primavera", "verano", "otono", "invierno"];
  const index = {} as Record<Season, number>;
  for (const season of seasons) {
    const matching = DESTINATIONS.filter(d => inferDestinationSeasons(d).includes(season));
    const avg = matching.length > 0 ? matching.reduce((s, d) => s + d.costPerPerson, 0) / matching.length : overallAvg;
    index[season] = avg / overallAvg;
  }
  return index;
}

export const SEASON_PRICE_INDEX: Record<Season, number> = buildSeasonPriceIndex();
