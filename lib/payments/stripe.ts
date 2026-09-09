import Stripe from "stripe";

// Lazy singleton — must NOT construct the client at module load time.
// Next.js imports route modules during `next build` (page-data collection)
// with no runtime env vars available yet, so a top-level `new Stripe(...)`
// or an eager env check crashes the build itself, before any request is
// ever served. Deferring construction to first use keeps the build green
// even before STRIPE_SECRET_KEY is configured in Vercel.
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set. See .env.example.");
  }
  _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-02-24.acacia", // pinned to the installed stripe@17.7.0 SDK's LatestApiVersion
    typescript: true,
  });
  return _stripe;
}

// Bitácora de Viaje sells a single fixed-price unlock per trip (no product
// catalog), so the price lives here instead of in a DB table.
export const PREMIUM_UNLOCK_PRICE_CENTS = 299; // 2.99 EUR
export const PREMIUM_UNLOCK_CURRENCY = "eur";
