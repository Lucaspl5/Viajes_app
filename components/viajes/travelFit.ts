import type { DestinationTemplate } from "./types";

// Heuristic short-haul list (Europe + the nearest bits of North Africa/Turkey,
// roughly under ~4h flying from Spain) — everything else is treated as
// long-haul. Approximate, not real flight-time data.
const SHORT_HAUL_COUNTRIES = new Set([
  "Albania", "Austria", "Bosnia-Herzegovina", "Croacia", "Dinamarca", "Escocia (UK)",
  "Eslovenia", "España", "Estonia", "Francia", "Grecia", "Hungría", "Islandia",
  "Islas Feroe (Dinamarca)", "Italia", "Malta", "Montenegro", "Noruega",
  "Noruega (Ártico)", "Países Bajos", "Portugal", "Reino Unido", "República Checa",
  "Suecia", "Suiza", "Turquía", "Marruecos",
]);

// Minimum trip length for which a destination is worth considering at all —
// a weekend to Australia doesn't make sense once you count the flight time.
// Not the same as the template's authored itinerary length.
export function minReasonableDays(dest: DestinationTemplate): number {
  return SHORT_HAUL_COUNTRIES.has(dest.country) ? 2 : 5;
}

// Scales a destination's per-person cost to the trip's actual length instead
// of the template's fixed itinerary length. Assumes ~35% of the cost is
// "fixed" (flights, insurance, one-off costs) and the rest scales per day —
// an estimate, not a real fare breakdown.
const FIXED_COST_SHARE = 0.35;
export function costForDuration(dest: DestinationTemplate, tripDays: number): number {
  const fixed = dest.costPerPerson * FIXED_COST_SHARE;
  const daily = (dest.costPerPerson * (1 - FIXED_COST_SHARE)) / dest.durationDays;
  return Math.round((fixed + daily * tripDays) / 5) * 5;
}

// Each template itinerary entry becomes one calendar day when applied to a
// trip (see applyDestination in Destinos.tsx) — entries titled "Días 1-2"
// still count as a single slot. Most templates have fewer entries than their
// durationDays already (multi-day entries), so when the trip is shorter than
// the entry count we sample entries evenly across the whole itinerary
// (first, last, and evenly spaced in between) rather than just truncating
// the tail — that keeps the destination's highlights spread across the trip
// instead of losing everything after day N. When the trip is the same
// length or longer, entries are left untouched (extra days stay free —
// nothing is fabricated to fill them).
export function adaptItinerary<T>(entries: T[], tripDays: number | null): T[] {
  if (tripDays === null || tripDays >= entries.length || entries.length === 0) return entries;
  if (tripDays <= 0) return [];
  if (tripDays === 1) return [entries[0]];
  const picked: T[] = [];
  for (let i = 0; i < tripDays; i++) {
    const idx = Math.round((i * (entries.length - 1)) / (tripDays - 1));
    picked.push(entries[idx]);
  }
  return picked;
}
