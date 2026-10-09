# Foody Web (QR Ordering)

Next.js 14 App Router web experience for guests scanning a table QR code to browse the menu, add items, and place orders. Built to integrate with the Go backend in `foodyserver`.

## Environments

| Environment | Domain | API | Source |
|-------------|--------|-----|--------|
| **Production** | `app.foody-pos.co.il` | `api.foody-pos.co.il` | Manually promoted Vercel deployment from `develop` |
| **Development** | `dev-app.foody-pos.co.il` | `dev-api.foody-pos.co.il` | `develop` |
| **Local** | `localhost:3000` | `localhost:8080` | any branch |

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

Vercel's native Git integration owns deployments:

- Merge to `develop` → Vercel creates the development deployment for `dev-app.foody-pos.co.il`.
- Production → manually promote the verified `develop` deployment in Vercel.
- Approved `develop` → `main` synchronizations only record release history;
  `vercel.json` disables automatic deployments from `main`.
- GitHub Actions does not install the Vercel CLI or rebuild the application for deployment.

## CI/CD Pipeline

### How It Works

| Source | Trigger | What Happens |
|--------|---------|--------------|
| Feature branch | PR to `develop` | One GitHub CI job runs lint, typecheck, contract tests, and build |
| `develop` | Merge | Vercel Git integration deploys the development environment |
| Verified Vercel deployment | Manual promotion | Vercel promotes to `app.foody-pos.co.il` with production variables |

### Production

- Production is never deployed by a GitHub Actions branch-push workflow.
- Verify the `develop` deployment first, then use **Promote to Production** in Vercel.
- Roll back from Vercel's deployment history if production verification fails.

### Development (`develop` branch)
- **Vercel auto-preview** (Git integration, no GitHub Action)
- Automatically deploys on push
- Deploys to: **`dev-app.foody-pos.co.il`**
- Uses Preview env vars (`NEXT_PUBLIC_API_BASE_URL=https://dev-api.foody-pos.co.il`)

### Workflow Example

1. Branch from `develop`.
2. Open one PR back into `develop` and let GitHub CI validate it.
3. Merge the PR; Vercel deploys the development environment directly.
4. Test `dev-app.foody-pos.co.il`.
5. Manually promote that deployment in Vercel when production is approved.

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
- `/order/checkout` – Single-page checkout with required contact phone; SMS verification is disabled by default and can be explicitly enabled by the restaurant
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
3. **Payment return**: The provider redirects the user to:
   - Success: `/r/{restaurantId}/payment/success?orderId={id}`
   - Failure: `/r/{restaurantId}/payment/failed?orderId={id}`
   The success route does not trust the redirect itself. It waits for the API-owned
   payment status and only renders success for `paid` or `authorized`; declined
   and refunded payments go to the failure route, while delayed confirmation is
   shown as pending.
4. **Retry payment**: If payment fails, user can retry via the failure page.

### Payment Routes
- `/r/[restaurantId]/payment/success` – Payment success confirmation page
- `/r/[restaurantId]/payment/failed` – Payment failure page with retry option

## VAT (Israel)
Prices are displayed with 18% VAT included. The checkout page shows VAT breakdown.
See `lib/constants.ts` for VAT calculation utilities.

## White-Label PWA & Subdomain Routing

Each restaurant gets its own branded experience that feels like a standalone app, not a Foody-branded site.

### Subdomain Routing
- Restaurants are accessible via `{slug}.app.foody-pos.co.il` (e.g., `joes-pizza.app.foody-pos.co.il`)
- Middleware (`middleware.ts`) rewrites subdomain requests to `/r/{slug}` internally
- Backward-compatible: `/r/{slug}` paths still work directly
- **Infra requirement**: Wildcard DNS `*.app.foody-pos.co.il` + wildcard SSL cert (one record, not per-restaurant)

### Dynamic Theming
- Restaurant owners customize colors, fonts, hero layout, and content via **foodyadmin** → Website page
- `RestaurantThemeProvider` (`lib/restaurant-theme.tsx`) sets CSS custom properties at runtime:
  - `--brand`, `--brand-dark`, `--brand-light`, `--price` from `primaryColor`
  - Google Fonts loaded dynamically for the selected `fontFamily`
- Theme data comes from `WebsiteConfig` embedded in the restaurant API response

Website V3 order menus select one of six global color styles via
`appearance_overrides.website_order.color_style`. Each style stores sparse menu
color overrides in `custom_palette.color_styles.styles[].menu`: list background
and headings, category bar and normal/selected pills, item background, name,
price, description and border. Automatic colors resolve against their actual
surfaces; portions use the price color. Generic section and checkout colors
remain separate from these menu roles. Shared styles take precedence over old
page-local colors and child style assignments; sites without shared styles
retain the legacy renderer. Shape, spacing, typography and image settings remain
page-local. Menu groups, availability and cart behavior are unchanged.
The admin README describes the isolated Mamie appearance fixtures.

Item details inherit the menu's global color style, or select another using
`website_order.item_color_style`. Sparse `styles[].item_detail` roles control
the sheet, name, description, price, options, selection and action bar through
`websiteItemAppearance`; checkout styles do not override them. Bounded
`item_layout`, `item_width` and `item_radius` choices complement image aspect
ratio and fit. The cover preset restores a compact, rounded sheet with a
full-width image. Editor previews show the action's active colors while
preventing cart mutations; public availability and option validation still apply.

`nav_layout.header.layout = "restaurant"` uses the shared `SiteHeader` for a
cover, framed logo, name, hamburger and live restaurant information. The optional
`header.restaurant` object controls height, visibility, the information bar's
shared color style and its optional `info_layout` (`modern` or `classic`). Explicit
layout choices are independent of ordering permissions: Modern shows service
blocks with per-field mode/time permissions; Classic shows only restaurant facts.
Fixed batch dates stay visible and read-only in Modern. Missing layout values
retain the previous presentation for compatibility. Only one bar is rendered.
This layout replaces the order-page cover; standard header
layouts retain their existing behavior. API support must be deployed first.

`websiteFulfillmentRules` derives permitted choices from enabled service modes,
scheduling and batch settings, independently of presentation. A sole mode is
enforced for stored selections and checkout links; a batch calendar discards
free scheduling intent. The existing `lock_order_type` remains a menu-only lock.
Restaurant/server validation continues to own availability and order acceptance.

### PWA (Progressive Web App)
- Dynamic manifest per restaurant: `/api/manifest/{slug}` returns `application/manifest+json` with restaurant name, logo, and theme color
- Dynamic favicon: `/api/favicon/{slug}` proxies to restaurant's logo
- Service worker (`public/sw.js`) provides offline caching and push notification handling
- "Add to Home Screen" banner (`InstallPrompt` component) appears after page load, branded with restaurant colors
- Apple PWA meta tags injected in restaurant layout

### QR Scanner
- "Scan QR Code" button in the restaurant hero info bar (for delivery/pickup order types)
- Uses native `BarcodeDetector` Web API (no npm dependencies)
- Full-screen camera overlay with real-time QR detection
- Parses Foody QR URLs and navigates to table session

### Key Files
| Purpose | Path |
|---------|------|
| Subdomain middleware | `middleware.ts` |
| Theme provider | `lib/restaurant-theme.tsx` |
| Restaurant layout (PWA meta) | `app/r/[restaurantId]/layout.tsx` |
| Dynamic manifest API | `app/api/manifest/[slug]/route.ts` |
| Dynamic favicon API | `app/api/favicon/[slug]/route.ts` |
| Install prompt | `components/InstallPrompt.tsx` |
| QR scanner | `components/QRScanner.tsx` |
| Service worker | `public/sw.js` |

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


Website V3 order pages can override header presentation via
`appearance_overrides.order_header` (version 1). `resolvePageHeader` composes
layout, scroll, color style, background, restaurant information and logo size
with the current shared header content. Preview and public rendering use the
same appearance merge. Other page types ignore this field; absent/null values
inherit the site header. Logo image/text/links, navigation and fulfillment are
never taken from the page override. API support must precede the editor release.

Global color styles preserve all valid authored colors, including low-contrast
combinations. Inherited menu and item colors are not recolored when their surface
changes. Automatic defaults apply only to colors that have not been specified.


## Animated website text

The `animated_text` section renders `content.text` plus `content.phrases: [{text}]`, with `settings.rotating_color` and `settings.speed` (slow/normal/fast). Typography uses the existing text settings. The ending changes width by default, long text wraps on mobile, hover/focus pauses rotation, and reduced motion shows the first phrase. Editing displays static, fully reachable marquee text; preview and published pages animate.

The storefront advertises `animated_text: true` in its V3 capabilities. Deploy the API, then Foody Web, then the admin; the editor rejects an older renderer before creating or publishing an unsupported section.

## Component animations

Each section can opt into `settings.motion`: `enabled`, `entrance`
(none/fade/zoom/bounce/from_left/from_right/from_top/from_bottom/split),
`duration_ms` (200–3000), `delay_ms` (0–3000), `replay`, `mobile`, and
`mobile_entrance` (inherit or an entrance style). `split` reveals the media and
copy wrappers from their respective sides. `media_hover` supports
none/wobble/grow/lift; `button_hover` supports none/push/grow/lift.
`parallax` is none/up/down with `parallax_amount` (10–80 px) and an opt-in
`parallax_mobile`. Motion remains opt-in for existing sections; edit mode and
reduced-motion preferences stop it. Intersection observers pause offscreen
rotation; listeners and animations are cleaned up on configuration changes.

Animated text now defaults to `word_animation: swirl`: 400 ms letter rotations,
staggered by 20 ms at normal speed, with a 500 ms width transition. Alternatives
are fade, slide and none. `resize_width: false` reserves the widest phrase.
Normal/slow/fast hold times are 1000/2500/600 ms plus the letter stagger.
Measurements use untransformed glyph widths, preserve graphemes and wrap on mobile.
Testimonial carousel settings are `carousel_autoplay` (opt-in),
`carousel_interval` (2000–15000 ms, default 5000) and `carousel_duration`
(100–2000 ms, default 500). Hover, focus, manual navigation and the pause button
stop automatic rotation.

The renderer advertises `component_animations: 1`; deploy API → web → admin.
