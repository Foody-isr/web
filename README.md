# Foody Web (QR Ordering)

Next.js 14 App Router web experience for guests scanning a table QR code to browse the menu, add items, and place orders. Built to integrate with the Go backend in `foodyserver`.

## Environments

| Environment | Domain | API | Branch |
|-------------|--------|-----|--------|
| **Production** | `app.foody-pos.co.il` | `api.foody-pos.co.il` | `main` |
| **Development** | `dev-app.foody-pos.co.il` | `dev-api.foody-pos.co.il` | `develop` |
| **Local** | `localhost:3000` | `localhost:8080` | any |

**Key Differences:**
- **Production**: Real PayPlus payments, live database
- **Development**: PayPlus sandbox (test cards), isolated database

## Quick start
```bash
cd foodyweb
npm install
npm run dev
```

## Quick Commands

### Running Locally
```bash
# Development (local)
npm run dev

# Build for production
npm run build

# Lint/format
npm run lint
```

### Environment Setup
```bash
# Create .env.local for local development
cat > .env.local << EOF
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_WS_BASE_URL=ws://localhost:8080
EOF

# For testing against dev server
cat > .env.local << EOF
NEXT_PUBLIC_API_BASE_URL=https://dev-api.foody-pos.co.il
NEXT_PUBLIC_WS_BASE_URL=wss://dev-api.foody-pos.co.il
EOF
```

### Vercel Deployment
Deployments are automatic:
- Push to `main` → deploys to `app.foody-pos.co.il`
- Push to `develop` → deploys to `dev-app.foody-pos.co.il`

## CI/CD Pipeline

### How It Works

| Branch | Trigger | What Happens |
|--------|---------|--------------|
| `main` | Push | GitHub Action → Vercel Production deploy to `app.foody-pos.co.il` |
| `develop` | Push | Vercel auto-preview deploy to `dev-app.foody-pos.co.il` |
| PR to `main` | Open PR | CI runs (lint + typecheck + build) |

### Production (`main` branch)
- **GitHub Action** (`.github/workflows/deploy.yml`) runs on push to `main`
- Uses Vercel CLI with `--prod` flag
- Deploys to: **`app.foody-pos.co.il`**
- Uses production env vars from Vercel

### Development (`develop` branch)
- **Vercel auto-preview** (Git integration, no GitHub Action)
- Automatically deploys on push
- Deploys to: **`dev-app.foody-pos.co.il`**
- Uses Preview env vars (`NEXT_PUBLIC_API_BASE_URL=https://dev-api.foody-pos.co.il`)

### Workflow Example
```bash
# Work on feature → push to develop → auto-deploys to dev
git checkout develop
# make changes
git push origin develop
# → Vercel deploys to dev-app.foody-pos.co.il

# When ready for prod → merge to main
git checkout main
git merge develop
git push origin main
# → GitHub Action deploys to app.foody-pos.co.il
```

### Server Commands (for API debugging)
```bash
# SSH to production server
ssh -i foody-server-production-key-pair.pem ubuntu@api.foody-pos.co.il

# SSH to development server
ssh -i foody-server-dev-key-pair.pem ubuntu@16.16.251.118

# View API logs (production)
ssh -i foody-server-production-key-pair.pem ubuntu@api.foody-pos.co.il "docker logs -f foody-api"

# View API logs (development)
ssh -i foody-server-dev-key-pair.pem ubuntu@16.16.251.118 "docker logs -f foody-api"

# Check payment webhook logs
ssh -i foody-server-production-key-pair.pem ubuntu@api.foody-pos.co.il "docker logs foody-api 2>&1 | grep -i payplus"
```

### PayPlus Sandbox Testing (Dev Environment)
```bash
# 1. Open dev-app.foody-pos.co.il
# 2. Create an order with online payment
# 3. Use sandbox test cards:
#    - Success: 4580 4580 4580 4580 (CVV: 123, any future date)
#    - Failure: 1234 1234 1234 1234
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

## Web Push Notifications
Guests can opt-in to browser push notifications on the order tracking page. When their order is ready, they receive a notification even if the tab is closed or phone is locked.

### How It Works
1. When the tracking page loads, a Service Worker (`public/sw.js`) is registered
2. A banner appears: "Get notified when your order is ready"
3. On tap, the browser requests notification permission
4. If granted, a PushSubscription is created and sent to the API (`POST /api/v1/public/push/subscribe`)
5. When staff marks the order as ready, the server sends a Web Push notification
6. The Service Worker displays the notification with vibration
7. Tapping the notification opens/focuses the tracking page

### Key Files
- `public/sw.js` — Service Worker (push event listener + notification display)
- `hooks/usePushNotifications.ts` — React hook for subscription lifecycle
- `services/api.ts` — `getVAPIDPublicKey()`, `subscribeToPush()`, `unsubscribeFromPush()`
- `components/OrderTrackingClient.tsx` — Push opt-in banner UI

### Browser Support
- Android Chrome: Full support
- iOS Safari 16.4+: Supported when added to home screen as PWA
- Desktop Chrome/Firefox/Edge: Full support
