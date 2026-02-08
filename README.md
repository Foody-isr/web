# Foody Web (QR Ordering)

Next.js 14 App Router web experience for guests scanning a table QR code to browse the menu, add items, and place orders. Built to integrate with the Go backend in `foodyserver`.

## Quick start
```bash
cd foodyweb
npm install
npm run dev
```

## After making changes
- Lint/format: `npm run lint`
- Type check: `npm run type-check` (if configured) or `tsc --noEmit`
- Tests (if added): `npm test`

Env:
- `NEXT_PUBLIC_API_BASE_URL` – Go server base URL (e.g. `http://localhost:8080`)
- `NEXT_PUBLIC_WS_BASE_URL` – WebSocket host (defaults to API base with `ws` protocol)
- `NEXT_PUBLIC_API_TOKEN` – optional dev JWT for staff-only endpoints (guest flow works without it)

## Routes
- `/order?restaurantId=<id>&tableId=<code>&sessionId=<uuid>` – QR deep link; redirects to `/order/[restaurantId]/[tableId]`
- `/order/[restaurantId]/[tableId]` – Menu + cart flow (SSR menu load); forwards `sessionId` to backend
- `/order/checkout` – Checkout with OTP phone verification for pickup/delivery orders
- `/order/tracking/[orderId]` – Live order tracking (WebSocket) with `?restaurantId=<id>&tableId=<code>` for context
- `/receipt/[token]` – Digital receipt (shareable link, SMS notification)
- `/orders` – Order history lookup by verified phone number
- Legacy: `/r/[restaurantId]/[tableId]` remains usable for manual navigation

## Integration with foodyserver (Go)
- REST base: `/api/v1`
  - Public/guest: `GET /api/v1/public/menu?restaurant_id=<id>`; `POST /api/v1/public/orders?restaurant_id=<id>` with `{"table_number":"A1","table_code":"A1","session_id":"<uuid>","items":[{"menu_item_id":1,"quantity":2,"notes":""}]}`; `GET /api/v1/public/orders/:id?restaurant_id=<id>`; `GET /api/v1/public/sessions/:id`
  - QR resolve: `GET /qr/resolve?r=<restaurantId>&t=<tableCode>&s=<signature>` redirects to the web app deep link after validating the HMAC.
  - Staff: existing protected endpoints (menu management, orders) still require Bearer tokens. Owners/managers can mint QR codes via `POST /api/v1/restaurants/:id/tables/:tableId/qr`.
  - Restaurants list (`GET /api/v1/restaurants`) used only by the dev jump box (needs token).
- WebSocket:
  - Guest tracking: `/ws/guest?restaurant_id=<id>&order_id=<id>` (no auth). If `NEXT_PUBLIC_API_TOKEN` is set, it will be appended as `token=...` for debugging.
  - Staff feed: `/ws?restaurant_id=<id>` remains auth-protected.
- Status mapping: Go statuses (`received`, `open`, `in_kitchen`, `ready`, `served`, `delivered`, `paid`, `cancelled`) are reflected in the timeline UI.

## Tech
Next.js App Router, TypeScript, Tailwind, Zustand, TanStack Query, Framer Motion. Light/dark ready, RTL/i18n placeholders for EN/HE.

## Payment Integration (PayPlus)
Online payment processing via PayPlus (Israeli payment gateway).

### Payment Flow
1. **Guest orders with payment**: When creating an order with `payment_required: true`, the response includes a `payment_url` field.
2. **Redirect to PayPlus**: Frontend redirects user to `payment_url` for secure payment processing.
3. **Payment completion**: PayPlus redirects user to:
   - Success: `/r/{restaurantId}/payment/success?orderId={id}`
   - Failure: `/r/{restaurantId}/payment/failed?orderId={id}`
4. **Retry payment**: If payment fails, user can retry via the failure page.

### Payment Routes
- `/r/[restaurantId]/payment/success` – Payment success confirmation page
- `/r/[restaurantId]/payment/failed` – Payment failure page with retry option

## VAT (Israel)
Prices are displayed with 18% VAT included. The checkout page shows VAT breakdown.
See `lib/constants.ts` for VAT calculation utilities.
