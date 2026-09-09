import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/payments/stripe";
import { markEventProcessedOnce, recordPayment, setTripPremium, getPaymentByIntentId } from "@/lib/payments/store";

export const runtime = "nodejs"; // Rule 5

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 256 * 1024) return new NextResponse(null, { status: 413 }); // Rule 10

  const signature = request.headers.get("stripe-signature");
  if (!signature) return new NextResponse(null, { status: 400 });

  const rawBody = await request.text(); // Rule 5 — never request.json() before this

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent( // Rule 3 + Rule 9 (Stripe enforces its own timestamp window)
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const firstTime = await markEventProcessedOnce(event.id); // Rule 9: event-id dedup
  if (!firstTime) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  console.log("[stripe.webhook]", { id: event.id, type: event.type, created: event.created }); // Rule 6

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "checkout.session.expired":
        // nothing to revoke — premium is only granted on completion
        break;
      case "charge.refunded":
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
      case "charge.dispute.created":
        // no automated action yet — TODO: alert Lucas via the Telegram webhook (see reference_telegram_alertas_n8n)
        break;
      default:
        console.log("[stripe.webhook] unhandled", event.type);
    }
  } catch (err) {
    console.error("[stripe.webhook] handler error", { id: event.id, code: (err as { code?: string })?.code ?? "unknown" });
    return new NextResponse(null, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const tripCode = session.metadata?.trip_code;
  if (!tripCode || session.payment_status !== "paid") return;

  const paymentIntentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id;
  if (!paymentIntentId) return;

  await recordPayment(paymentIntentId, {
    status: "succeeded",
    tripCode,
    amount: session.amount_total ?? 0,
    currency: session.currency ?? "eur",
  });

  const granted = await setTripPremium(tripCode, true);
  if (!granted) {
    // Trip was deleted/expired between checkout start and webhook delivery.
    // Payment succeeded but there's nothing to unlock — logged for manual follow-up.
    console.error("[stripe.webhook] paid but trip missing", { tripCode, paymentIntentId });
  }
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const paymentIntentId = typeof charge.payment_intent === "string"
    ? charge.payment_intent
    : charge.payment_intent?.id;
  if (!paymentIntentId) return;

  // Look up which trip this payment unlocked, then revoke premium.
  const payment = await getPaymentByIntentId(paymentIntentId);
  if (!payment) return;

  await recordPayment(paymentIntentId, {
    status: "refunded",
    tripCode: payment.tripCode,
    amount: payment.amount,
    currency: payment.currency,
  });
  await setTripPremium(payment.tripCode, false);
}
