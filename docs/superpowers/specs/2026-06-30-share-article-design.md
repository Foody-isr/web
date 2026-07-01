# Share Article — Design

**Date:** 2026-06-30
**Service:** foodyweb only (no foodyserver / foodypos / foodyadmin changes)
**Status:** Approved, pending implementation plan

## Problem

A customer browsing a restaurant's order page in foodyweb opens an item (article)
in the item modal. We want them to be able to **share that specific item** with
friends over WhatsApp / social networks. When the shared link is pasted into
WhatsApp, Messenger, iMessage, etc., it must show a **rich link preview**: the
item's photo plus text like *"Look at this {item name} at {restaurant name}"*.
Tapping the link should bring the recipient straight to the order page with that
item's modal already open, ready to add to cart.

## Decisions (from brainstorming)

1. **Preview type:** Rich link preview via server-side Open Graph tags (the card
   that WhatsApp/social auto-render). Not an in-app preview dialog.
2. **Link target:** The existing order page, with the item modal auto-opening —
   lowest friction to ordering. No dedicated item landing page.
3. **Share UX:** Native OS share sheet on mobile (`navigator.share`), with a
   desktop fallback menu (WhatsApp, Copy link, X, Facebook).
4. **Language:** Share text + preview match the customer's **current locale**
   (fr/en/he), using the item's translated name; the link encodes the locale so
   the recipient's preview matches.

## Non-goals (YAGNI)

- No dedicated item landing page.
- No Go single-item public endpoint (we reuse the existing `fetchMenu`). Can be
  added later if crawler latency proves to be a problem.
- No POS / admin / mobile-client changes.
- No analytics/tracking of shares (can be added later).

## Architecture

### 1. Shareable URL

Built on the client from the customer's **current location**, so it works
identically across all host shapes (`app.foody-pos.co.il/r/{id}/order`,
`{slug}.foody-pos.co.il/order`, and custom domains such as `mamietlv.co.il/order`):

```
<window.location.origin><window.location.pathname>?item={itemId}&lang={locale}
```

Using `window.location` (not a hardcoded `/r/{id}/order`) is required because on
custom domains the public path is `/order` and the `/r/{slug}/...` form only
exists internally after the middleware rewrite. Appending the query to the
current public path lets the middleware rewrite it for the crawler while keeping
the URL valid for humans. Existing query params on the page (e.g. `?type=`) are
**not** carried into the share URL — only `item` and `lang` are set.

### 2. Rich link preview (server-side Open Graph)

Extend the **existing** `generateMetadata` in
`app/r/[restaurantId]/order/page.tsx`. It already receives `searchParams`
(Next 14 — `params`/`searchParams` are plain sync objects, never awaited).

When `searchParams.item` is present:

- Fetch the menu via `fetchMenu(restaurantId, ...)` (reused; called **only** on
  item links so normal order-page loads are unaffected). Apply Next fetch
  caching/`revalidate` so repeated crawler hits are cheap.
- Find the item by id; resolve its display name in `searchParams.lang`
  (fallback chain fr → en → he or restaurant default, matching existing menu
  language behavior).
- Emit item-specific metadata, merged onto the restaurant defaults:
  - `og:title` / `twitter:title` = item name
  - `og:description` / `twitter:description` = localized sentence:
    - fr: `Découvrez {item} chez {restaurant}`
    - en: `Look at this {item} at {restaurant}`
    - he: Hebrew equivalent
  - `og:image` / `twitter:image` = the composed item OG card (see §3),
    1200×630, `twitter:card = summary_large_image`
- **Fallbacks:** if the item is not in the current carte (rotating/weekly menus),
  has no data, or the menu fetch fails, fall back to the existing
  restaurant-level OG metadata. The page must never error because of a bad/stale
  `item` param.

### 3. Item OG image

A new edge route `app/api/og/item/route.tsx`, reusing the satori / `next-og`
`ImageResponse` patterns already proven in `app/api/og/route.tsx`. A new helper
`buildItemOgImageUrl(item, restaurant, appUrl)` in `lib/og.ts` constructs its URL
(mirroring the existing `buildRestaurantOgImageUrl`).

The card renders 1200×630 with the **item photo as the hero**, plus restaurant
branding (logo or name) and the item name overlaid/composed.

- **Image safety (mandatory):** the item photo is passed through **weserv.nl**
  before satori receives it. Item uploads are frequently AVIF mislabeled with a
  `.jpg`/`.png` extension and `image/jpeg` content-type, which satori cannot
  decode. This reuses the exact transcoding approach already used for restaurant
  covers in `lib/og.ts`.
- **Fallback:** when the item has no photo, render the existing text/logo card
  (reuse `/api/og` behavior) so the preview is never broken.

Query params for the route carry everything it needs (item image URL, item name,
restaurant name, logo URL, fallback bg color) so the route itself fetches
nothing — same pattern as the current `/api/og` route.

### 4. Deep-link opens the modal

In the client order experience (`OrderExperience`):

- On mount, read `item` from `useSearchParams()`. If an item with that id exists
  in the loaded menu, open its modal (`setSelectedItem(item)`).
- Read `lang` and apply it to the i18n locale (via the existing `useI18n`
  context) so the recipient sees the page in the shared language.
- When the modal is closed, strip `item` and `lang` from the URL using
  `history.replaceState` (no navigation/refetch) so refresh and back-button
  behave sanely and the modal does not re-open.
- Item-not-found is **silent** — the order page just opens normally.

### 5. Share button (item modal)

Add a Share control to `components/ItemModal.tsx`, in the sticky footer beside
the Add-to-cart button (or as a header icon button — final placement decided
during implementation to match the existing layout). ItemModal gains the data it
needs as props: `restaurantName` and the current `locale` (and optionally a
`shareUrlBase`), passed down from `OrderExperience`.

On tap:

- Build the share URL (§1) and the localized share text:
  *"{localized sentence} {url}"* (so WhatsApp shows text + auto preview).
- **Mobile / supported browsers:** call
  `navigator.share({ title, text, url })` → native sheet (WhatsApp, Messages,
  Instagram, Telegram, etc.).
- **Desktop / no `navigator.share`:** show a small popover/menu:
  - **WhatsApp** → `https://wa.me/?text=<encoded text+url>`
  - **Copy link** → clipboard, with transient "Link copied" feedback
  - **X** → `https://twitter.com/intent/tweet?text=...&url=...`
  - **Facebook** → `https://www.facebook.com/sharer/sharer.php?u=...`

### 6. i18n

Add the new strings to the fr/en/he dictionaries used by `useI18n`:

- Share button label (e.g. fr "Partager", en "Share", he "שתף")
- The "Look at this {item} at {restaurant}" sentence (per §2, with `{item}` /
  `{restaurant}` interpolation)
- "Copy link" / "Link copied"
- Channel labels (WhatsApp, X, Facebook) where needed

**No em dash** in any user-facing string (project convention).

## Component / data flow

```
ItemModal (Share button)
   │  build url = origin+pathname + ?item=&lang=
   │  build localized text
   ├─ navigator.share(...)            (mobile)
   └─ fallback popover (WhatsApp/copy/X/FB)   (desktop)

recipient opens url
   │
order/page.tsx  generateMetadata({params, searchParams})
   │  if searchParams.item → fetchMenu → find item → item OG tags
   │     og:image = buildItemOgImageUrl(...) → /api/og/item (edge, satori, weserv)
   │  else → restaurant-level OG (unchanged)
   │
OrderExperience (client)
   │  useSearchParams().item → setSelectedItem(item)
   │  useSearchParams().lang → set i18n locale
   └  on modal close → replaceState strips item/lang
```

## Files touched

| File | Change |
|------|--------|
| `app/r/[restaurantId]/order/page.tsx` | Extend `generateMetadata` for `?item=` |
| `app/api/og/item/route.tsx` | New edge route: composed item OG card |
| `lib/og.ts` | New `buildItemOgImageUrl()` helper |
| `components/ItemModal.tsx` | Share button + native/fallback share logic; new props |
| `OrderExperience` (client order component) | Read `?item`/`?lang`, open modal, strip params on close, pass props to ItemModal |
| i18n dictionaries (fr/en/he) | New share strings |

## Error handling

- Bad/stale `?item=` (not found, sold out, wrong carte/date): preview falls back
  to restaurant-level OG; client opens the page normally without a modal.
- Item without a photo: OG card falls back to the text/logo card.
- AVIF-mislabeled photos: handled by weserv transcoding before satori.
- `navigator.share` unsupported or user-cancelled: desktop fallback popover /
  no-op (cancellation is not an error).
- Clipboard write failure: surface a non-blocking message; do not throw.

## Testing

- **OG metadata:** unit-test the item-vs-restaurant branch of the metadata
  builder (item present/found, item missing, item without photo) — assert the
  resulting title/description/image.
- **`buildItemOgImageUrl`:** assert URL construction, weserv wrapping, and the
  no-photo fallback.
- **Share URL builder:** assert it uses current origin+pathname and sets only
  `item`/`lang` (manual on path vs. custom-domain shapes).
- **`/api/og/item`:** smoke check that it returns an image for a sample item and
  for the no-photo fallback.
- **Deep-link:** manual — open `?item=<id>&lang=fr` and confirm the modal opens
  in French and the URL is cleaned on close; confirm a bad id opens the page
  normally.
- **Preview:** validate the rendered tags with a link-preview debugger
  (e.g. Facebook Sharing Debugger / a local OG inspector) against a deployed
  `?item=` URL.

## Rollout

- foodyweb only; ship to `develop` (auto-deploys to dev), then promote to `main`
  via PR per the standard flow.
- Reminder: the user co-edits foodyweb live (esp. `app/order/checkout/page.tsx`).
  Stage explicit paths on commit; never `git add -A`.
