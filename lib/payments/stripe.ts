import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set. See .env.example.");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-02-24.acacia", // pinned to the installed stripe@17.7.0 SDK's LatestApiVersion
  typescript: true,
});

// Bitácora de Viaje sells a single fixed-price unlock per trip (no product
// catalog), so the price lives here instead of in a DB table.
export const PREMIUM_UNLOCK_PRICE_CENTS = 299; // 2.99 EUR
export const PREMIUM_UNLOCK_CURRENCY = "eur";
