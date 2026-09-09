"use client";

import type { Trip } from "./types";

export function isPremium(trip: Trip): boolean {
  return !!trip.premium;
}

// Starts a real Stripe Checkout for this trip's premium unlock (2,99€,
// pago único) and redirects the browser there. Premium is granted by the
// webhook (app/api/webhook/stripe/route.ts) once payment is confirmed, not
// by this function — never grant access before the money has actually moved.
//
// NOTE: this covers the web flow only. If/when the app is published as a
// native Android app in Google Play, in-app purchases made *inside that
// app* must go through Google Play Billing instead (store policy) — see
// PAGOKIT_INTEGRATION.md for why Stripe can't be used there.
export async function startPremiumCheckout(code: string): Promise<void> {
  const res = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw new Error("No se pudo iniciar el pago.");
  const { url } = await res.json();
  window.location.href = url;
}
