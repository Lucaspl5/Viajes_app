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
