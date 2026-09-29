# Bitácora de Viaje en Google Play con Play Billing — diseño

Fecha: 2026-09-29 · Estado: pendiente de revisión por Lucas

## Objetivo

Publicar Bitácora de Viaje en Google Play y cobrar el desbloqueo premium por viaje
(2,99 €, pago único por viaje) dentro de la app de Android mediante Google Play Billing,
manteniendo el cobro web actual con Stripe. Ambas vías activan el mismo premium del viaje.

**Éxito =** un usuario instala la app desde Play, compra premium para un viaje con Play
Billing, y todos los miembros de ese viaje (en Android o web) lo ven premium; un reembolso
de Google lo revierte en ≤ 24 h. En la web el flujo Stripe sigue igual.

## Decisiones tomadas (con Lucas, 29/09/2026)

- Objetivo: ganar dinero en Play (no solo visibilidad).
- Empaquetado: **TWA (Trusted Web Activity) generada con Bubblewrap** — la app Android abre
  `viajes-app-tau.vercel.app` en Chrome a pantalla completa. Un solo código; cada deploy en
  Vercel actualiza la app sin resubir a Play.
- Cobro en Android: **Digital Goods API + Payment Request API** de Chrome (puente oficial
  TWA ↔ Play Billing). Sin plugin nativo ni RevenueCat.
- Cuenta Play Console: no existe aún → la crea Lucas (cuenta personal, 25 $).

## Restricciones externas

- Cuenta personal nueva ⇒ **prueba cerrada con ≥ 12 testers durante 14 días seguidos**
  antes de poder pedir acceso a producción. Esto marca la fecha de lanzamiento, no el código.
- Política de Play: dentro de la app de Play no puede aparecer Stripe ni enlaces a pagar
  fuera. La app debe detectar el contexto y ocultar Stripe.
- Comisión de Google: 15 % (programa de primer millón). Precio en Play: 2,99 €.
- Requisitos de ficha: política de privacidad pública, capturas, icono 512, feature graphic,
  cuestionario de clasificación de contenido y de seguridad de datos.

## 0. Arreglo previo obligatorio: el premium no puede vivir dentro del viaje

**Problema actual (afecta también a Stripe):** `POST /api/store` guarda el blob `trip:<CODE>`
entero tal como lo envía el cliente. Por tanto:
1. Cualquiera puede activarse premium gratis enviando el viaje con `premium: true`.
2. Un dispositivo con una copia antigua del viaje sobrescribe `premium` a `false` después de
   pagar (el webhook hace read-modify-write sobre el mismo blob).

**Cambio:**
- Nueva clave solo-servidor `premium:<CODE>` en Redis con
  `{ source: "stripe" | "play", ref: <paymentIntentId | orderId>, granted_at }`.
- `setTripPremium` escribe/borra `premium:<CODE>` en vez de tocar el blob del viaje.
- `GET /api/store?key=trip:X` → devuelve el viaje con `premium` calculado desde
  `premium:<CODE>` (fuente de verdad), ignorando lo que haya dentro del blob.
- `POST /api/store` con `trip:X` → elimina el campo `premium` del valor antes de guardar.
- `isValidStoreKey` debe rechazar claves `premium:*` (nunca escribibles desde el cliente).
- Migración: los viajes que hoy tienen `premium: true` en el blob y un pago Stripe registrado
  se migran a `premium:<CODE>`; el resto (desbloqueos de la demo antigua) se decide caso a
  caso — el viaje "Navidad 2026" de Lucas se conserva premium.

## 1. Empaquetado TWA

- `bubblewrap init --manifest https://viajes-app-tau.vercel.app/manifest.json` → proyecto
  Android en un repo/carpeta aparte (`~/viajes_app_android`, fuera del proyecto Next).
- Package name: `es.fluxit.bitacora`. Firma: **Play App Signing** (Google guarda la clave de
  firma; la clave de subida se guarda local + copia en Vaultwarden).
- `public/.well-known/assetlinks.json` en la web con el SHA-256 de la clave de firma de Play
  (Digital Asset Links) — sin esto la TWA muestra la barra de URL.
- Activar en Bubblewrap `playBilling` (añade el servicio de Digital Goods al APK).
- Salida: `.aab` para subir a Play Console. Solo se regenera al cambiar icono, nombre,
  versión Android o permisos, no por cambios de la web.

## 2. Detección de contexto en la web

Nuevo módulo `components/viajes/billing/platform.ts`:
- `getPlayBilling()` → `window.getDigitalGoodsService?.("https://play.google.com/billing")`;
  si resuelve, estamos dentro de la TWA de Play.
- `PremiumGate` usa `startPremiumPurchase(code)`, que elige Play Billing o Stripe según el
  contexto. Dentro de la TWA **no se renderiza nada de Stripe**.
- Precio mostrado: en Play, el que devuelve `getDetails(["premium_viaje"])` (localizado); en
  web, el fijo de Stripe.

## 3. Flujo de compra en Play

Producto único en Play Console: `premium_viaje`, producto in-app **consumible**, 2,99 €
(consumible para poder comprarlo una vez por cada viaje distinto).

1. Cliente: `new PaymentRequest([{ supportedMethods: "https://play.google.com/billing",
   data: { sku: "premium_viaje" } }]).show()` → obtiene `purchaseToken`.
2. Cliente: `POST /api/play/verify { code, purchaseToken }`.
3. Servidor: valida `code` (`isValidTripCode`) y que el viaje exista; llama a Google Play
   Developer API `purchases.products.get(packageName, "premium_viaje", purchaseToken)` con
   cuenta de servicio.
4. Si `purchaseState === 0` (comprado): deduplica por `orderId` (SETNX, igual que los eventos
   de Stripe), escribe `premium:<CODE>` con `source: "play"`, guarda
   `play:purchase:<orderId> → { tripCode, purchaseToken }`, y **consume** la compra
   (`purchases.products.consume`, que también la reconoce). Responde `{ ok: true }`.
5. Cliente: `paymentResponse.complete("success")` y refresca el viaje.

Un `purchaseToken` ya usado para un viaje no puede activar otro (dedup por `orderId` +
registro del viaje asociado).

**Compras sin confirmar (app cerrada a mitad):** al abrir un viaje dentro de la TWA,
`listPurchases()` devuelve compras no consumidas → se reenvían a `/api/play/verify`. El
viaje destino sale del registro `play:pending:<purchaseToken>` que el cliente guarda justo
antes de `show()`; si falta, la compra se asocia al viaje abierto en ese momento.

## 4. Reembolsos

Sin Pub/Sub (YAGNI para el volumen esperado). Nuevo cron diario en `vercel.json`
(`/api/play/voided`, protegido con `CRON_SECRET`) que llama a la **Voided Purchases API**
(últimos 2 días), busca cada `orderId` en `play:purchase:*` y borra `premium:<CODE>`.
Avisos por el webhook de Telegram existente (`fluxit-tool-done`) para reembolsos y fallos.

## 5. Credenciales y configuración

- Cuenta de servicio de Google Cloud vinculada a Play Console con permiso de ver datos
  financieros y gestionar pedidos → `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` (Vercel env, solo
  producción). Lucas pega los secretos; Claude no los escribe en formularios.
- `GOOGLE_PLAY_PACKAGE_NAME=es.fluxit.bitacora`, `CRON_SECRET`.
- Dependencia nueva: `googleapis` (o llamadas REST con `google-auth-library`, lo que pese menos).

## 6. Errores

| Caso | Comportamiento |
|---|---|
| Usuario cancela el diálogo de Play | Sin mensaje de error, se cierra el upsell |
| Verificación falla (red/Google caído) | Compra queda sin consumir → se reintenta al reabrir (§3) |
| `purchaseState` pendiente (pago en efectivo, etc.) | "Pago pendiente"; se activa al reabrir cuando pase a comprado |
| Token/`orderId` ya usado | 409, no se activa de nuevo |
| Redis caído | 503, la compra queda sin consumir y se reintenta |

## 7. Pruebas

- Unitarias (se añade Vitest, el repo no tiene tests hoy): lógica de `premium:<CODE>`
  (strip en POST, merge en GET, rechazo de claves `premium:*`), verificación de compra con
  la API de Google simulada (comprado / pendiente / duplicado / cancelado), cron de anulados.
- Manual: **cuentas de prueba de licencia** de Play Console (compras sin cobro real) en la
  pista de prueba interna, en un Android real: compra, cierre a mitad, reembolso.
- Regresión web: compra Stripe en modo test sigue activando premium con la nueva clave.

## 8. Tareas de Lucas (fuera del código, en paralelo)

1. Crear cuenta de desarrollador de Play (25 $) y verificar identidad.
2. Reunir 12 testers (familia, amigos, grupo del viaje) para la prueba cerrada de 14 días.
3. Política de privacidad pública (se puede generar una página `/privacidad` en la propia web).
4. Crear cuenta de servicio en Google Cloud y vincularla en Play Console (guiado).
5. Aprobar capturas y textos de la ficha.

## Fuera de alcance

- iOS / App Store.
- Suscripciones (el modelo es pago único por viaje).
- Notificaciones en tiempo real de Google (RTDN/Pub/Sub).
- Pasar Stripe a modo real (checklist propio en `PAGOKIT_PRODUCTION_CHECKLIST.md`).
