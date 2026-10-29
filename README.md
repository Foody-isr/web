# Foody Web (QR Ordering)

## Returning customer ordering

Checkout initializes the phone calling code from the restaurant country (ISO code), independently of the interface language or currency. Explicit country choices survive restaurant refreshes; saved or verified contacts restore their own calling code. Countries and numbering plans come from the pinned libphonenumber metadata.

Checkout enrollment stays inline. Google starts from the provider button; Email
reveals email/password fields associated with the checkout form, with no nested
form or account modal. Only the Pay action submits credentials. Creating an
account and saving entered details are combined with that checkout action; saving
a card remains a separate unchecked choice, available only when the restaurant
supports it. No email or SMS challenge is sent for this signup. A failed signup
retains the draft and allows continuing as a guest. Passwords live only in component
memory and are cleared after session creation or canceling the signup.

Email/password checkout identities are isolated until ownership is verified;
typing another person's email/phone never retrieves their data. Paid confirmation
offers optional verification later for account recovery. Authentication by Google
or a verified email code never automatically adopts an unverified identity; the
same active password-owned session is also required to promote it in place.
Deploy API migration 256 and `/auth/checkout`, `/payment-capabilities` first.

The published checkout preference `offer_sign_in` controls the optional invitation
before pickup/delivery details. Missing/true preserves it with a prominent
**Order without an account** action, usable while account loading is in progress.
False goes directly to ordering details with a discreet Sign in link. Selecting
that link explicitly opens authentication; dismissing it preserves typed details
and restores focus. Isolated preview renders an inert link. Checkout sign-in, required phone
verification, saved-address proof and delivery checks retain their rules. The
Website V3 order-journey editor drafts/previews/publishes this preference; isolated
preview shows the choice without mounting real authentication. The guest decision
survives reopening the same dialog. Deploy the matching API contract first.
Standalone email-code sign-in is no longer offered. Address verification and
password-recovery codes remain distinct; older code-only accounts can use Forgot
password to add a password without losing history. Configured Facebook and Apple
methods share the social choices at entry and checkout. The API verifies provider
credentials; the BFF binds a short-lived flow to an HttpOnly cookie and keeps the
final customer session out of JavaScript. Unconfigured methods stay hidden.
Deploy API migration 266 and the provider configuration first. Setup and live
acceptance requirements: `../foodyserver/docs/CUSTOMER_SOCIAL_SIGN_IN.md`.
Authenticated checkout restores restaurant-specific contact and complete delivery
details, including floor, apartment, entry code and instructions. A fresh address
proof comes from the API; all delivery and calendar checks remain authoritative.
Unchanged details show a saved status without a checkbox or redundant profile
write. Editing contact, delivery or enabled custom details reveals an unchecked
profile-update choice under “For your next order”, alongside the independent
card-save choice. Leaving profile updates unchecked keeps temporary details on
this order only. Account enrollment initially enables saving the entered details;
card saving remains unchecked. Save failures allow retry or continuing without
memorization. Cash and pay-later checkouts retain the same profile-update choice.

Connected pickup/delivery customers with complete details see a compact contact
and address summary. Edit opens the existing fields, and Done returns to the
reviewed summary without saving to the account until the profile-update choice
is confirmed with the order. Missing/invalid required details keep the editor
open; required consent and optional checkbox fields stay visible in summary mode.
Published field labels, custom answers, address proofs, phone verification and
calendar validation retain their existing rules. Guest checkout remains expanded.

Paused ordering and rush mode leave the menu browsable without opening the
pickup/delivery dialog. Service and timing controls stay read-only until ordering
resumes; authorized temporary test access keeps its existing expiry rules.
Future-order calendars remain discoverable. Checkout shows batch delivery/pickup
dates in the fulfillment summary only, retaining closed-ordering warnings there.

The first available, unexpired saved card is selected once per account/restaurant;
choosing a new card remains explicit and saving a card is a separate opt-in.
Both Verifone and Sumit use the existing server-owned saved-method endpoint.
Removing a Sumit method revokes its use in Foody. Required restaurant phone OTP,
provider restrictions and uncertain payment outcomes still apply. A paid Sumit
order displays a notice if its optional card registration failed. Sign-out clears
remembered addresses from in-memory storefront selections; profiles and proofs
are never persisted in browser storage. Editor previews have no account access.

Deploy API migration 253 and the profile/Sumit endpoints before this client.
No new environment variables. Synthetic browser checks:
`NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:18081 npm run build`, then
`npx playwright test -c playwright.customer.config.ts` for checkout and
`npx playwright test -c playwright.entry.config.ts` for storefront availability.

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

The fulfillment entry offers sign-in for faster ordering without a separate
optional disclaimer. Checkout keeps a compact existing-account link above contact
details and a create-account section beside card consent. Google or a one-time
email code verifies ownership for entry sign-in. Inline checkout registration uses
email/password without a challenge before payment. Connecting preserves entered contact and
delivery fields. Creating an account enables remembered details at order confirmation,
while card saving requires its own unchecked consent. New-card registration uses
the provider's existing hosted/direct flow; returning customers automatically select
their first usable saved card. Conditional OTP and provider verification still apply.

Profiles also restore published custom text fields such as building codes, scoped
to restaurant and pickup/delivery. Checkbox consent is never remembered. Switching
accounts clears private drafts; obsolete or disabled form fields are ignored.
Deploy API support for `/auth/email/code` and migration 254 before this Web version.

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

- Merge to `develop` → Vercel builds one staged production deployment from that commit.
- Point `dev-app.foody-pos.co.il` at that existing deployment and verify it against the development API.
- Production → manually promote that same deployment in Vercel, without rebuilding.
- Approved `develop` → `main` synchronizations only record release history;
  `vercel.json` disables automatic deployments from `main`.
- GitHub Actions does not install the Vercel CLI or rebuild the application for deployment.

## CI/CD Pipeline

### How It Works

| Source | Trigger | What Happens |
|--------|---------|--------------|
| Feature branch | PR to `develop` | One GitHub CI job runs lint, typecheck, contract tests, and build |
| `develop` | Merge | Vercel Git integration builds one staged production deployment |
| Ready staged deployment | Assign development alias | Verify the same artifact with the development API |
| Verified staged deployment | Manual promotion | Vercel assigns production domains without rebuilding |

### Production

- Production is never deployed by a GitHub Actions branch-push workflow.
- Vercel tracks `develop` as its Production Branch with **Auto-assign Custom Production Domains disabled**. This produces a staged artifact and leaves production on its current deployment.
- Verify the staged artifact on the development hostname first, then use **Promote** in Vercel or `vercel promote <deployment-id>`. The deployment must already have `target=production`; promoting a Preview deployment would rebuild it.
- `lib/api-origin.ts` selects the development or production API from the current hostname in both SSR and browser calls. No Google secret is configured in Vercel.
- Branch-specific Preview variables are now shared Preview variables, and the development domain has no branch binding; Vercel disallows those bindings on its Production Branch.
- Roll back from Vercel's deployment history if production verification fails.

### Development (`develop` branch)
- **Vercel staged production build** (Git integration, no GitHub Action)
- Automatically builds on push; domain assignment remains manual.
- Assign the existing artifact with `vercel alias set <deployment-url> dev-app.foody-pos.co.il --scope mickaz`.
- The development hostname routes to `https://dev-api.foody-pos.co.il` even though the staged artifact was built with production variables.

### Workflow Example

1. Branch from `develop`.
2. Open one PR back into `develop` and let GitHub CI validate it.
3. Merge the PR; Vercel creates a staged production deployment from `develop`.
4. Assign its URL to `dev-app.foody-pos.co.il` and verify development behavior.
5. Manually promote that exact staged deployment when production is approved; verify the deployment ID stays identical.

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

Restaurant pages paint their resolved colors and typography before the visible
server HTML, then update them in a layout effect before browser paint. Cart,
checkout, confirmation and tracking use `OrderThemeBoundary` to seed the public
restaurant and the originating published page together. This prevents a Foody
default or site-only palette from flashing while page appearance loads. Previews
continue to use their live draft rather than loading published appearance.

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

The page-local `website_order.layout = "rows"` renders compact menu rows and a
search field above the category navigation. `card_border = "separator"`,
`item_spacing` (0–80 px), `row_padding` (0–48 px), `image_position`
(auto/left/right), `image_size` (default/small/medium/large), `image_ratio = "wide"`
(3:2), `price_placement` (after_description/bottom), `description_lines`
(default/1/2/3/all), and `item_description_*` typography are independent controls.
Explicit photo positions remain physical in RTL; compact menus use one column on
mobile. Underlined category navigation uses the assigned active text color.
Absent settings preserve existing layouts. The renderer advertises
`order_list_styles: 1`; deploy Web before the matching Admin.

The explicit Wolt presentation uses page-local `website_order.color_preset =
"wolt"` for a black menu, gray navigation/dividers and cyan prices/active tabs.
It overlays only menu color roles and leaves the six shared site styles intact;
`"site"` (the default) restores the assigned shared style. Compact plain rows
have transparent backgrounds and no horizontal card padding. Separators always
stay straight even when an older card radius is present. The renderer advertises
`order_wolt_preset: 1`; deploy it before the matching Admin.

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

Standard headers also use `header.restaurant.info_color_style` for the service
and scheduling bar, independently of `header.color_style`. Its `default` value
keeps the existing header inheritance; an explicit style controls the service
blocks and their text. Restaurant headers retain their information-bar behavior.
The availability filter uses a native select with a separate decorative arrow,
logical padding for RTL, a visible keyboard focus and the menu's colors.

`websiteFulfillmentRules` derives permitted choices from enabled service modes,
scheduling and batch settings, independently of presentation. A sole mode is
enforced for stored selections and checkout links; a batch calendar discards
free scheduling intent. Weekly batches allow the entry service/address selector
and a clickable location bar while the batch date remains read-only. Delivery-only
restaurants can also enter and edit their address without exposing disabled modes.
Checkout still offers the enabled services using the restaurant's batch calendar.
The existing `lock_order_type` remains a menu-only lock for ordinary ordering;
weekly batches collect fulfillment on entry even when this legacy setting is on.
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


Text/image sections support independent `settings.text_bg_color` and
`settings.image_bg_color` (three/six-digit hex or `transparent`). Missing, empty
or null values retain existing section presentation. The media background is
visible behind transparent images and in contain framing; opaque image pixels
are unchanged. Text colors and buttons keep the section's selected style.
Desktop and mobile preview/publication share this renderer. It advertises
`text_image_backgrounds: 1`; deploy API → web → admin.

## Animated website text

Plain `text` sections support `settings.padding` (none/compact/normal/spacious),
`height` (auto/compact/medium/tall/full) and `width`
(auto/narrow/medium/wide/full). Heights are minimums of 240/400/560/720 px;
bounded widths are 640/960/1200 px and stay responsive. Automatic geometry
preserves the historic stacked/split presentation. The section background
remains full width. Preview and publication use the same renderer, advertising
`text_section_dimensions: 1`. Deploy API → Web → Admin.

The `animated_text` section renders `content.text` plus `content.phrases: [{text}]`, with `settings.rotating_color` and `settings.speed` (slow/normal/fast). Typography uses the existing text settings. The ending changes width by default, long text wraps on mobile, hover/focus pauses rotation, and reduced motion shows the first phrase. Editing displays static, fully reachable marquee text; preview and published pages animate.

The storefront advertises `animated_text: true` in its V3 capabilities. Deploy the API, then Foody Web, then the admin; the editor rejects an older renderer before creating or publishing an unsupported section.

## Website video playback

Standalone video sections support `video_autoplay`, `video_controls`,
`video_loop` and `video_muted` in `settings`. Unset values retain the previous
manual player. Automatic playback uses muted inline video; YouTube/Vimeo links
receive corresponding embed parameters. Full-width layout removes horizontal
insets, and `padding: "none"` removes vertical spacing. Preview and publication
use the same settings. Optional `video_height` presets `xs`, `s`, `m`, `l`
match the hero banner's 250/300/400/550 px heights. Uploaded video fills the
chosen frame without distortion; `original` or an unset height preserves its
natural proportions. Hosted players use the same frame heights. The renderer
advertises `video_playback: 1` and `video_height: 1`; deploy the
API contract before this renderer, then the admin controls.

## Component animations

Each section can opt into `settings.motion`: `enabled`, `entrance`
(none/fade/zoom/bounce/from_left/from_right/from_top/from_bottom/split),
`duration_ms` (200–3000), `delay_ms` (0–3000), `replay`, `mobile`, and
`mobile_entrance` (inherit or an entrance style). `split` reveals the media and
copy wrappers from their respective sides. `media_hover` supports
none/wobble/grow/lift; `button_hover` supports none/push/grow/lift.
`parallax` is none/up/down with `parallax_amount` (10–200 px) and an opt-in
`parallax_mobile`. `parallax_target` chooses media, text or the whole component;
`mobile_parallax`, `mobile_parallax_target` and `mobile_parallax_amount` can
override these on phones. Motion remains opt-in for existing sections; edit mode and
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

## Strict online preorders

The public restaurant `preorders_only` flag maps to `Restaurant.preordersOnly`.
For pickup/delivery, both order details and checkout require the configured
calendar even when products carry a legacy immediate-sale flag or ready stock.
Table service and delivery tours remain independent. The API owns calendar,
service and cutoff enforcement; deploy its migration 226 support first.


Website V3 menu typography inherits existing `typography.roles` when an order
text style is absent; explicit title/paragraph presets still take precedence.
Sparse page typography merges roles and uploaded font sources with the site.
Filled menus without a `category_shape` retain pill navigation. The order design
supports `category_gap` (0–80px, default 20) and `category_spacing` (0–160px,
default 48) identically in the editor preview and published storefront.

Category navigation stays sticky when `sticky_categories` is absent; an explicit
`false` keeps it in the page flow. Pills have a minimum height of 44px independently
of the selected color style. Anchor scrolling clears the measured navigation
height and the current header offset, including after typography or viewport changes.

## Delivery address autocomplete

Delivery checkout, the website fulfillment dialog, the chain selector and customer
corrections share `DeliveryAddressAutocomplete`. Google Places API (New) is called
only through the Foody server; no Google key or billing counter belongs in this app.
Deploy the new API contract first and configure its dedicated shared budget ledger
before enabling the restaurant's published `delivery.address_autocomplete` switch.
See the API README for activation and the exclusive-billing-account requirement.
Google calls are production-only (`APP_ENV=production` on the API). Local and
development browser tests use synthetic responses and spend no Google quota.

Search waits 500 ms after typing stops, with at least three characters. One UUID
session groups predictions; only a clicked prediction calls `/address-autocomplete/resolve`.
The server returns the existing signed complete-address selection. Incomplete
streets/places refine the search and cannot validate delivery. Editing invalidates
the selection. Aborted/stale requests and double clicks cannot select stale data.
Google Maps attribution stays visible; predictions are not cached in browser storage.

The mobile fulfillment dialog uses one layout across keyboard opening/dismissal:
no cover image, persistent service tabs, and a compact sign-in link beside the
confirmation button. Only the available height follows the visual viewport;
keyboard detection never hides controls or changes spacing. The field stays in
place while suggestions scroll independently. Generic address guidance remains
available to screen readers; loading, errors and Google attribution remain visible.
Regression: `npx playwright test -c playwright.fulfillment.config.ts` asserts field
positions through repeated viewport changes, service switching and sign-in.

If the server returns `address_quota_exhausted`, the form stops searching and shows:
“Le service d’adresses est momentanément indisponible. Contactez le restaurant et
transmettez-lui ce message : ADR-QUOTA.” English and Hebrew translations are included.
The form keeps delivery blocked for an unvalidated address. There is no automatic
paid overage or fallback; the restaurant can handle the customer's report directly.
Rate limiting has a separate message and no automatic retry.

Country, delivery zones/tours, selection proofs and coordinates remain server-owned.
The selected address and city carry into checkout without duplicate street fields.
A Google-validated complete address can omit `lat`/`lng` when the independent map
provider has no precise building point. Checkout keeps those coordinates absent;
city-zone validation can still succeed, while geometry and calendar checks that
need a point remain server-owned. No zero or city-centroid coordinate is invented.
The chain selector uses the chosen restaurant's policy; changing branches requires
selection again. Floor/apartment, entry code and delivery notes stay separate.

Isolated browser regression (requires free local ports 18081 and 3194):

```sh
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:18081 npm run build
npx playwright test -c playwright.address.config.ts
```

The config starts a synthetic server for SSR theme data and intercepts browser API
calls. It tests Google selection, editing, street refinements and quota exhaustion
in French and Hebrew, without live provider keys, customer data or real orders.

With the same synthetic build, run
`npx playwright test -c playwright.customer.config.ts --grep 'customer phone validation'`
to verify in French and Hebrew that invalid phone input sends neither an order nor
an OTP request, while valid Israeli and international numbers are sent in E.164.

## Checkout layout

Online card orders with weight-priced items show the estimated total separately
from the temporary authorization ceiling, using the restaurant checkout theme
in FR/HE/EN. The CTA confirms an authorization, not an immediate debit. The
published margin applies only to the weighted subtotal; an unknown policy blocks
submission instead of inventing 20%. The API validates `expected_hold_amount_minor`
and freezes the reviewed ceiling. Changed policy requires another confirmation;
cash/pay-later never claims a card hold. Deploy the matching API first. Targeted
checks: `npx tsx --test lib/__tests__/weight-hold.test.ts`; browser grep
`weight hold checkout` in `tests/visual/commerce.spec.ts` (synthetic APIs only).

Desktop checkout keeps contact and payment on the left, with fulfillment,
expandable order items, VAT-inclusive totals and the submit action on the right.
Mobile uses the same summary once: fulfillment and items above the form, totals
below it, and a fixed confirmation button. Optional sign-in and registration
open a themed modal with keyboard focus containment; guests can still check out
without an account. Published checkout fields and payment rules remain authoritative.
Cart and checkout actions cap their corner radius at 8px while preserving square
button themes. The timing row opens its editor only when scheduling is enabled.
Confirmation builder previews use the trusted editor draft and isolated sample
items, without loading the published page or using the guest's saved cart.

## Geoapify delivery tracking maps

Deploy the API with migration 238 first. Customer tracking consumes additive
`routing_provider` / `route_geometry` fields and uses the restaurant-scoped tile
proxy returned by `/public/delivery/map-config`. The Geoapify key remains on the
API; no public key or new web environment variable is needed. Road paths use
`[latitude, longitude]` coordinates. An unavailable ETA is shown as unavailable
instead of being rounded up to one minute, and map failures retain the delivery
information. Unconfigured APIs retain the OpenStreetMap basemap and approximate
tracking behavior.

The receipt-authorized tracking request refreshes once per minute while the page
is visible; WebSocket updates use the same validated payload parser. API caching
limits provider calls as GPS moves. Provider attribution remains visible.
Targeted check: `node --test --import tsx lib/__tests__/courier-tracking.test.ts`.

## First saved card (Verifone CST)

New orders follow Omer's 2026-10-18 single-payment flow: HPP charges the full
order and creates the token using token_scope only. The existing success route
waits for API verification and opens the branded confirmation. There is no
separate 1 ILS registration or second token debit. Authenticated consent remains
explicit; later confirmed orders use the No-CVV contract without CVV or TZ.
Deploy the matching API first. Invoice4U receives detailed server-priced lines.

### Historical registration links only

Previously issued links used an HPP registration amount (1.00 ILS displayed,
0.01 ILS recorded by the CST processor) and the separate order debit. Following
Omer’s 2026-10-12 clarification, the initial CVV/TZ entry stays entirely in HPP;
No-CVV token payments never collect, encrypt or send a cardholder identity.
`/r/:restaurant/payment/signup` restores the published order page's palette,
checkout color style, fonts and restaurant header, including remembered page
context. Registration verification polls automatically within a bounded window.
The original checkout confirmation authorizes the full order amount. After
verified registration, visible progress accompanies one token debit and read-only
payment confirmation, then paid pickup/delivery orders open their branded
confirmation directly. Ambiguous responses expose status checks, never automatic
debit retries. The server reports a durable `charge_attempted` claim on reload,
so the return page only reads status after any prior debit. Registration readiness
must explicitly advertise `identity_required=false` before automatic continuation.
Loading respects reduced motion, French/English/Hebrew and RTL.

The HPP signup POST is `/checkout-service/v2/checkout`, not
`/api/v2/transactions/card`. CloudWatch's `verifone.http` events contain both
with the same `order_id` but separate `payment_id`s. For an entire order, use
`{ $.event = "verifone.http" && $.order_id = 494 }` (replace the order number),
without restricting the route or payment ID. The card submission inside the
hosted HPP is made by Verifone, not by Foody's API HTTP client; its result is
available in the subsequent Checkout GET and verified transaction GET.

### Website image framing

Optional image framing records carry `desktop` and optional `mobile` values `{x, y, zoom, fit}`. Coordinates are percentages, zoom is clamped to 0.5–3, and fit is `cover` or `contain`. `FramedImage` computes the image rectangle from its natural dimensions before clipping; zooming out reveals the source instead of shrinking an already cropped image. It observes its container and viewport, preserves the existing renderer when no frame is authored, and leaves the original media URL untouched.

Header backgrounds/logos, section imagery/backgrounds/galleries, catering and chain covers, and per-item website photos consume the same framing contract. `website_order.modal_cover_url` and `modal_cover_framing` independently configure fulfillment and scheduling covers, falling back to the restaurant cover when no URL is supplied. These are optional presentation fields in the existing website draft JSON; existing published sites keep their original appearance until framing is authored.

### Scheduled storefront orders

The pickup/delivery location dialog includes the server-owned date and time
selector whenever slot scheduling is enabled. The chosen slot travels into cart
review and checkout. Changing the cart rechecks the selection and offers the next
compatible slot, never an earlier one, with a visible adjustment notice.

The API owns elapsed/service/custom production clocks and whether preparation
may span several services. Web never adds preparation time to an already chosen
fulfillment slot. Missing delivery windows and resolver errors block confirmation
with an explanation; ready-stock and weekly-batch rules retain their own behavior.

Cart and checkout distinguish the selected slot from the first compatible slot.
Removing a slower item exposes an earlier slot without silently moving a
customer's valid choice; the first-slot action carries the reviewed choice into
checkout and back to the menu. Item explanations use the refreshed catalog,
including explicit zero notices, inherited preparation and weekday overrides.
The API alone computes the joint calendar (including combo components and
quantities); pending/failed resolution and empty calendars block continuation.
Client date hints are omitted so the booking horizon follows restaurant time.

## Address-dependent delivery calendars

The address dialog, storefront fulfillment summary and checkout resolve delivery
through the restaurant-scoped public delivery check, including cart quantities.
A zone calendar applies even when products are immediately ready. Customer mode
shows allowed days/windows; automatic mode shows the assigned next window;
restaurant mode shows the next day with “Time to be confirmed” and no time picker.
Pickup suggestions switch mode explicitly and use pickup's separate calendar.
Unresolved addresses, provider errors and empty calendars do not unlock checkout.

The customer confirmation/tracking pages retain the pending status and refresh
the server-confirmed window while tracking is active. The receipt token remains
the proof needed for order details. Deploy server migration 249 before this client.
Isolated browser check: `npx playwright test -c playwright.delivery.config.ts
--grep 'delivery zone calendar'`. All API calls use synthetic in-memory fixtures.

## Notes for selected modifiers and options

The ordinary item modal renders `customer_note` configuration for selected
modifiers and reusable options, independently of `allow_notes`. Required fields
block adding/saving until filled; each note is limited to 500 characters. Text
survives cart persistence and editing, remains specific to its cart line, and is
omitted when its choice is deselected. Checkout and direct table orders send
`modifiers[].note` and `selected_variant_note`. API migration 245 must precede
this renderer. The API snapshots named notes in the existing line instructions
for the restaurant, kitchen and confirmation; existing prices remain unchanged.


## Exceptional restaurant closures

Public `calendar_closures` map to `Restaurant.calendarClosures` and contain only
inclusive local dates and affected services. Immediate availability and opening
status use the restaurant timezone. Scheduled slots and batch dates remain
server-authoritative: a closure today does not prevent ordering for an available
future date. Checkout translates `restaurant_calendar_closed` when availability
changes after the customer selected a date. No private calendar notes or event
names are sent to guests. Deploy API migration `246_restaurant_calendar.sql` first.

## Cart navigation

Opening `/order/cart` from a restaurant website or checkout uses local native
history and already loaded restaurant/page data to display an accessible dialog:
a side panel on desktop and a full-screen cart on mobile. Opening requires no
server navigation or API response; availability still refreshes in the background.
The restaurant page stays mounted, preserving menu search, category and scroll.
Continue shopping, Add more items and the restaurant logo return to the source
menu. If that menu is preserved underneath, closing restores its search and scroll;
from checkout or a content page, these actions navigate to the menu instead.
Escape, backdrop dismissal and browser Back return to the underlying page,
including checkout; Forward reopens the cart. Direct visits and reloads render
the standalone cart page.
Repeated cart activations before the route transition commits share one history
entry. Continue shopping therefore returns to the preserved menu with one click,
including after reopening the cart with browser Forward.
Both presentations reuse `CheckoutFlow`, including editing, availability,
fulfillment and checkout rules. Payment continues on `/order/checkout`.
Unknown page contexts retain the intercepted server route as a fallback.
Browser regression checks use a synthetic local API on port 43219:
`NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:43219 npm run build`, then
`npx playwright test -c playwright.cart.config.ts` (Chromium and WebKit).
The opt-in development OTP bypass is restricted to local and development hosts,
so promoting this same artifact cannot expose that control on production domains.

## Delivery map providers

The receipt-authorized courier map supports Google Map Tiles and Geoapify through
server-side, budgeted endpoints. It refreshes provider selection automatically on
quota errors and monthly resets; Google geometry/destination data is displayed
only on a Google basemap. The map includes official Google Maps attribution and
viewport copyright. No Google credential is shipped to the browser.
Enable the API's Google delivery rollout only after deploying compatible clients
and initializing the exclusive shared billing ledger; see server documentation
`docs/GOOGLE_DELIVERY.md`. Tracking payload tests include Google provenance.

## Temporary IP test access

Restaurant Settings → Temporary test access allows up to 32 public IPv4/IPv6
addresses with a required expiry within seven days. Activation pauses public
ordering indefinitely; expiration/revocation does not reopen it. The guest Web
rechecks authorization on checkout and the API enforces it on every order.
Payment and fulfillment rules still apply, with real production side effects.

Deploy API migration 251 before Web and Admin. API and guest Web require the same
server-only `ORDERING_TEST_PROXY_SECRET` (32+ random characters) per environment.
Never use a `NEXT_PUBLIC_` variable for this secret. The signed visitor IP comes
only from Vercel’s platform-owned header; arbitrary local forwarded headers do
not enable access. See the API README for the security and deployment contract.

Focused browser checks: `npx playwright test -c playwright.test-access.config.ts`
(Web uses an isolated synthetic API; Admin requires `npm run build` first).

Vercel staged production artifacts carry both server-only Web keys:
`ORDERING_TEST_PROXY_SECRET` for the production API and
`ORDERING_TEST_PROXY_SECRET_DEV` for `dev-api.foody-pos.co.il`. Each API uses its
own environment’s key as `ORDERING_TEST_PROXY_SECRET`. Preview deployments need
only the development key; never copy the production key into Preview.

The guest proxy reads Vercel’s canonical `x-forwarded-for`, which the edge
overwrites to prevent spoofing. It ignores alternate client-supplied IP headers
and does not sign forwarded headers outside Vercel.

`GET /api/ordering-test-ip` returns this browser's platform-owned IP for Admin's
**Allow my current IP** action. It uses the same IP source as ordering signatures,
disables caching and permits cross-origin reads only from the production and
development Foody Admin origins. No staff token or signing key is returned or
required. Local/self-hosted requests fail closed when no trusted IP is available.

## Digital receipt presentation

`/receipt/[token]` resolves the receipt restaurant's published Website V3 order
page and inherits its shared colour style, fonts and button shape. Guest links
carry `pageSlug` through confirmation/tracking; generic links use the default
order page. Only order pages belonging to the receipt restaurant are eligible. The existing
`checkout_config.receipt` JSON controls localized title/message, item spacing,
restaurant details, status/customer visibility and receipt actions. Missing values
keep the standard receipt. The total and order lines remain API-owned; voided
items are excluded and offered items retain their adjustment labels.

`/order/receipt/preview` uses synthetic orders and the trusted commerce preview
protocol, sharing the same receipt renderer. Printing uses a white paper layout
and hides actions; sharing reports clipboard failure and respects cancellation.
Deploy the API contract first, then this renderer (`receipt_editor: 1`), then the
Admin controls. Checks: `node --test --import tsx lib/__tests__/receipt.test.ts` and
the sibling Admin's `receipt-editor.spec.ts` browser regression.

## Documentation release contract

`docs/help/contract.json` records the reviewed source hashes and feature mappings.
`node scripts/check-help-contract.mjs --documentation-root ../foodylanding --base origin/develop`
checks local preparation. Remote CI uses a pinned immutable Landing commit and
checks all French, Hebrew and English procedures. New source and behavior changes
require an updated inventory/guide release or an exact reviewed no-user-impact
explanation. See Landing’s `docs/help/MAINTENANCE.md` for the complete workflow.


## Conditional modifier positions

The item-specific **Conditions and display** editor maps a format option or an
independent single-choice modifier to 0–12 visible positions. Repeated positions
require exactly one choice each and preserve repeated values and order through
cart editing, API validation, POS and kitchen snapshots. The shared catalog group
is not duplicated. Formats retain absolute prices; modifier prices remain deltas.
Long single-choice guest lists use a searchable compact picker; the letters/digits
presentation adds a character grid. Existing articles are not converted.

Deploy API migration `274_conditional_modifier_positions.sql` and the matching
API before these clients. Configure only after web/POS consumers are updated.
See the three-language modifier help procedure and local synthetic regression
tests. No production data or deployments are changed by local preparation.

## Descriptive variant positions

Option sets tagged `selection_role: identity` expand into required independent
positions according to the selected format. Characters use the existing compact
search/grid picker with no surcharge. The format alone supplies the absolute
price; modifiers retain their separate price deltas. Hidden positions are removed
on format changes. Cart snapshots, edits and `option_selections` API payloads
retain the original option IDs and position order, including repeated characters.
Cards and portion labels ignore descriptive dimensions for pricing/serving size.
Picker scrolling is measured after layout so its list stays above the fixed
footer. Deploy API migration 275 first. Regression: `npx playwright test -c
playwright.modifiers.config.ts`; covers both variant and modifier conditions in
Chromium/WebKit and FR/EN/HE. No existing item is automatically reconfigured.

## Website menu tabs and groups

On Website V3 order pages, multiple visible cartes have separate underlined tabs.
Only the selected carte renders its items and groups. Category-menu shapes and
visibility control the groups within that carte; hiding category navigation never
hides the carte tabs. Switching cartes clears menu search and keeps the cart.
The Admin interactive preview and public storefront share the same renderer.
Synthetic browser regression: `FOODY_MENU_TABS=1 npx playwright test -c
playwright.website-editor.config.ts menu-tabs.spec.ts` from foodyadmin.

Menu-tab text and category navigation text have separate shared menu color roles:
`menu_text` and `category_text`. **Site design → Colors → Customize menu colors →
Category menu** exposes **Menu text** independently of **Category text**. The
former colors carte tabs and their underline; category links, search and icons
keep their existing roles. Automatic menu text uses the style paragraph color
when readable against the bar, otherwise contrasting neutral ink. Explicit text
colors remain authoritative. Each role survives draft, preview and publication
and can be reset independently. The Wolt preset retains its dedicated palette.


## Manual weekly ordering

Weekly batches accept `batch_ordering_mode: calendar | manual` (default calendar).
Admin → Settings → Ordering & delivery → Orders & availability → Weekly batch
offers Manual opening or According to a calendar. Save the policy, then explicitly
open/pause using Pause online orders. Choosing manual preserves the effective pause
and clears a scheduled reopening. Automatic intake times are retained for returning
to calendar mode. Delivery days/windows, product rules, stock and existing orders
are preserved. Manual orders use the operational current delivery series through
its final service day in the restaurant timezone. Public batch timestamps are empty
in manual mode; clients must not invent a reopening countdown. Active temporary
test access must be disabled before public reopening. Deploy API migration
`277_manual_batch_ordering.sql` before the clients and publish the reviewed guides
with the feature.

## Responsive category navigation

Website V3 category-menu style applies to groups on desktop and mobile. Menu
tabs remain separately underlined. Pill/rounded selections use their active
background and text colors; underlined selections use the active text color.
Long group headings wrap inside the page instead of widening the document.
Synthetic Chromium/WebKit regression: from foodyadmin run
`FOODY_MENU_TABS=1 FOODY_MENU_LAYOUT=1 npx playwright test -c
playwright.website-editor.config.ts mobile-menu-layout.spec.ts`.

Mobile pill and rounded category links use a 36px painted surface inside a 44px
touch target, with 8px of visible space above and below at the default text size.
The mobile text scales with the configured typography; desktop geometry is
preserved. Regression: `npx playwright test -c playwright.categories.config.ts`
(Chromium and WebKit, mobile/desktop and RTL).

## Product photos

Public menu items map legacy `image_url` to the cover and ordered `image_urls`
to additional photos. Product details show clickable dots, arrows, keyboard
navigation and horizontal pointer/touch swipes only with multiple unique photos.
Hebrew follows RTL navigation. The cover alone uses the existing per-item framing.
Reopening starts on the cover; cards, availability and checkout are unchanged.
Deploy API migration 278 before the matching Admin and this renderer.
Regression: `npx playwright test -c playwright.photos.config.ts`.


## Independent order tracking facts

Guest tracking keeps payment separate from food progress. Paying, authorizing,
partially paying or refunding an order never checks off preparation or handoff.
The optional `order.lifecycle` v1 is validated for this exact Order ID, with no
parent or sibling identifiers in the public projection. Known handoff survives
refund; missing operational history remains unknown. A disabled handoff tracker
is distinct from unknown historical tracking configuration.

Legacy APIs without the projection retain their status-based path. Once v1 is
advertised, malformed, unsupported, failed or downgraded reads show unavailable
status and Retry instead of falling back to unpaid or completed food. A scoped
HTTP refresh handles order/payment WebSocket events, reconnect, foreground and
periodic refresh; stale responses and sibling QR events cannot update the order.
Pending alone preserves the existing Pay now eligibility because it may mean that
payment is expected before any attempt. It never initiates collection automatically.
Card authorizations stay protected; actual provider claims and recovery journals
retain their existing authority.
Receipt labels recognize canonical pickup and partial-payment states. Ready
notifications use the current operational facts and the guest's FR/HE/EN locale.

Synthetic regressions: `node --test --import tsx lib/__tests__/order-{timeline,tracking,lifecycle}.test.ts`
and `npx playwright test -c playwright.lifecycle.config.ts` (mobile RTL included).


## Prepared Sumit internal checkout

Compatible API/Admin/Web versions add staff-prepared pickup/delivery baskets:
`internal_checkout: link` returns a private Foody basket URL, while `card` opens
Sumit's hosted form in Admin. Both require the active configured Sumit provider;
creation requires `orders.manage`, and Admin card entry additionally requires
`payments.manage`. Recipient delivery uses the existing server-resolved zones,
minimum and retained service date, reviews recalculated fees/discounts/total, and
compares `expected_total_minor` again before payment. Admin card orders keep the
staff delivery quote. No PAN/CVV enters a Foody form or API in these flows.

One durable claim binds contacts and the hosted URL; retries resume the same
page. Uncertain creation blocks another attempt. The order stays pending and
immutable until provider confirmation; unpaid baskets expire after 24 hours via
the cancellation/stock-release path. Saved Admin orders expose recovery actions.
No schema or environment change is needed. See the FR/HE/EN prepared Sumit guide
in Landing and `docs/help/reviews/sumit-internal-checkout.json`. Release requires an immutable reviewed documentation pin and coordinated
API-first development verification. Synthetic regression tests replace Sumit;
provider acceptance is verified separately before production promotion.

### Prepared orders use the existing storefront cart

Private Sumit links redirect to `/order/cart?restaurantId=…&preparedOrderId=…&t=…`
and continue to the existing `/order/checkout` route. Both use `CheckoutFlow`,
`OrderThemeBoundary` and the published default order-page appearance, including
restaurant fonts, colors, logo and checkout fields. Previously issued links keep
working. Server-owned snapshots are adapted for `CommerceCartItems` without
writing the personal Zustand cart or accepting current catalog prices.
Prepared items/date are read-only; account/profile/card-save actions and ordinary
order creation stay outside this mode. Recipient contact/custom answers bind to
the existing order. Delivery quotes require explicit total review and are
invalidated synchronously by an edited address. Resuming an already started
payment does not collect details again. Order/payment authorization and Sumit
confirmation retain the existing API rules. Deploy custom-field-capable API first.
