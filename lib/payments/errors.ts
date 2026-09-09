// Cross-provider error taxonomy (PagoKit). Currently only Stripe is wired up,
// but the shape stays provider-agnostic so a second provider can slot in later.
export type PaymentErrorCode =
  | "card_declined"
  | "expired_card"
  | "insufficient_funds"
  | "authentication_required"
  | "rate_limited"
  | "invalid_request"
  | "unknown";

export function mapStripeError(err: unknown): { code: PaymentErrorCode; message_es: string } {
  const stripeErr = err as { type?: string; code?: string; decline_code?: string };

  if (stripeErr?.type === "StripeCardError") {
    switch (stripeErr.decline_code ?? stripeErr.code) {
      case "insufficient_funds":
        return { code: "insufficient_funds", message_es: "Fondos insuficientes." };
      case "expired_card":
        return { code: "expired_card", message_es: "La tarjeta ha caducado." };
      default:
        return { code: "card_declined", message_es: "La tarjeta ha sido rechazada." };
    }
  }
  if (stripeErr?.code === "authentication_required") {
    return { code: "authentication_required", message_es: "El banco requiere confirmación adicional (3DS)." };
  }
  if (stripeErr?.type === "StripeRateLimitError") {
    return { code: "rate_limited", message_es: "Demasiadas solicitudes, inténtalo de nuevo en unos segundos." };
  }
  if (stripeErr?.type === "StripeInvalidRequestError") {
    return { code: "invalid_request", message_es: "Solicitud de pago inválida." };
  }
  return { code: "unknown", message_es: "No se pudo procesar el pago." };
}
