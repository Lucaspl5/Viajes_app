# Production Checklist — Stripe (Bitácora de Viaje)

Before flipping to live keys, do every item below.

## 1. Replace test keys with live keys

- [ ] In the Stripe dashboard, switch to live mode and generate live keys.
- [ ] Set `STRIPE_SECRET_KEY` to `sk_live_…` — via `vercel env add`, NOT in `.env.example`.
- [ ] Set `STRIPE_PUBLISHABLE_KEY` to `pk_live_…`.
- [ ] Set `STRIPE_WEBHOOK_SECRET` — this is regenerated for the live webhook endpoint (see step 2).
- [ ] Set `ADMIN_REFUND_SECRET` to a real random value (`openssl rand -hex 32`), not the placeholder.

## 2. Configure webhook endpoint in the live Stripe dashboard

- [ ] Create a webhook endpoint pointing to `https://<prod-domain>/api/webhook/stripe`.
- [ ] Subscribe to: `checkout.session.completed`, `checkout.session.expired`, `charge.refunded`, `charge.dispute.created`.
- [ ] Copy the new `whsec_…` into Vercel env vars.

## 3. Deploy target secrets (Vercel)

```bash
vercel env add STRIPE_SECRET_KEY production
vercel env add STRIPE_PUBLISHABLE_KEY production
vercel env add STRIPE_WEBHOOK_SECRET production
vercel env add ADMIN_REFUND_SECRET production
vercel env add PUBLIC_URL production   # https://<prod-domain>
```

## 4. Final sanity test

- [ ] Make a real €2.99 purchase on the live app from a different device.
- [ ] Confirm the webhook fired and the trip's `premium` flag flipped to `true` in Redis.
- [ ] Issue a refund via `POST /api/refund` (with `x-admin-secret`). Confirm `charge.refunded`
      fired and `premium` flipped back to `false`.

## 5. Monitor

- [ ] Watch Vercel function logs for `[stripe.webhook] handler error` in the first 24h.
- [ ] Set up a Stripe dashboard alert for failed charges.

## 6. Before publishing to Google Play (separate project, not covered here)

- [ ] Do **not** reuse this Stripe flow for in-app purchases made from inside the published
      Android app — implement Google Play Billing (native) or RevenueCat for that instead.
      See the limitation note in `PAGOKIT_INTEGRATION.md`.
