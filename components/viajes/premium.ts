"use client";

import { saveShared } from "./utils";
import type { Trip } from "./types";

export function isPremium(trip: Trip): boolean {
  return !!trip.premium;
}

// Placeholder unlock until Google Play Billing is wired in for this trip's
// premium flag — swap this function's body for a real purchase flow once
// the app is published and Billing is set up.
export async function unlockPremiumDemo(code: string, trip: Trip): Promise<Trip> {
  const next = { ...trip, premium: true };
  await saveShared(`trip:${code}`, next);
  return next;
}
