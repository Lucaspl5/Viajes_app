import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getStripe, PREMIUM_UNLOCK_PRICE_CENTS, PREMIUM_UNLOCK_CURRENCY } from "@/lib/payments/stripe";
import { isValidTripCode } from "@/lib/payments/store";
import { checkRateLimit, clientIp } from "@/lib/redis";

export const runtime = "nodejs";

// POST /api/checkout  body: { code: "ABC-1234" }
// Creates a Stripe Checkout Session to unlock premium for one trip.
// Server sets the price — the client never gets to choose the amount.
export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(`checkout:${clientIp(req)}`, 20, 60);
  if (!rl.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { code } = body;
  if (!isValidTripCode(code)) {
    return NextResponse.json({ error: "invalid_trip_code" }, { status: 400 });
  }

  const idempotencyKey = randomUUID(); // Rule 4

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: PREMIUM_UNLOCK_CURRENCY,
              product_data: { name: `Bitácora de Viaje — Premium (viaje ${code})` },
              unit_amount: PREMIUM_UNLOCK_PRICE_CENTS,
            },
            quantity: 1,
          },
        ],
        success_url: `${process.env.PUBLIC_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.PUBLIC_URL}/checkout/cancel`,
        metadata: { trip_code: code },
      },
      { idempotencyKey }
    );
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[checkout] failed", { code: (err as { code?: string })?.code ?? "unknown" });
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }
}
