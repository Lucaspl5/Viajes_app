// Generic thank-you page — NOT the source of truth for unlocking premium.
// The webhook (app/api/webhook/stripe/route.ts) grants access; this page
// just tells the traveler to go back and refresh.
export default function CheckoutSuccessPage() {
  return (
    <main style={{ padding: 40, textAlign: "center", fontFamily: "system-ui" }}>
      <h1>¡Gracias!</h1>
      <p>Tu viaje se desbloqueará en unos segundos. Vuelve a la app y refresca.</p>
    </main>
  );
}
