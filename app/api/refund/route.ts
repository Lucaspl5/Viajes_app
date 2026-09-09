import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/payments/stripe";
import { mapStripeError } from "@/lib/payments/errors";

export const runtime = "nodejs";

// POST /api/refund  body: { paymentIntentId: string }
// Header: x-admin-secret must match ADMIN_REFUND_SECRET.
//
// Bitácora de Viaje has no user accounts/sessions, so there is no per-user
// "is this your payment" check to run. Access control here is a single
// shared admin secret (Lucas only) instead — same effect, honest about the
// app having no auth system to hang a real authorization check off.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-admin-secret");
  if (!process.env.ADMIN_REFUND_SECRET || secret !== process.env.ADMIN_REFUND_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { paymentIntentId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { paymentIntentId } = body;
  if (!paymentIntentId || typeof paymentIntentId !== "string") {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const refund = await stripe.refunds.create({ payment_intent: paymentIntentId });
    // Premium is revoked by the charge.refunded webhook, not here — keeps
    // one source of truth for state changes instead of two paths to the same effect.
    return NextResponse.json({ ok: true, refundId: refund.id, status: refund.status });
  } catch (err) {
    const mapped = mapStripeError(err);
    console.error("[refund] failed", { code: mapped.code });
    return NextResponse.json({ error: mapped.code, message: mapped.message_es }, { status: 500 });
  }
}
