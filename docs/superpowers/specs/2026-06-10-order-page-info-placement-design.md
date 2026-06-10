# Order-page info placement — design

**Date:** 2026-06-10
**Status:** Approved (brainstorm), pending implementation plan
**Services:** foodyserver · foodyadmin · foodyweb

## Problem

The order/menu page currently ends with the site **footer** (a `WebsiteSection`, page `_site`), which clutters the ordering flow and collides with the floating cart button. Restaurant info (hours, address, contact, social) is split across the footer, the fixed "Plus" modal (`InfoScreen`), and the hardcoded metadata bar in the hero — none of it configurable per restaurant.

Wolt keeps the order page clean: a compact metadata bar under the hero, and all extra info behind a "More" modal. We want Foody owners to control, from the website builder, **which info appears in the metadata bar (per order mode) and which appears in the "Plus" modal**, and to drop the footer from the order page.

## Decisions (from brainstorm)

- **Footer:** hidden on the order page **always** (no toggle). Still shown on the landing page and custom pages.
- **Config UI:** simple **per-item on/off toggles** (no drag-and-drop).
- **Metadata bar:** configured **separately per order mode** (pickup / delivery / dine-in).
- **Placement is per-surface (independent), not strictly either/or:** an item may appear in the bar *and* the modal (e.g. short "Open until 22:00" in the bar, full schedule in the modal).
- **"Plus ›"** appears in the bar automatically when the modal has ≥1 enabled section.
- A bar/modal item whose underlying data is empty (e.g. Instagram with no IG link) simply does not render.

## Data model

One new `WebsiteConfig` JSONB field, `order_page_info`:

```jsonc
{
  "bar": {
    "pickup":   ["batch_week", "min_order", "fulfilment_time"],
    "delivery": ["min_order", "fulfilment_time", "instagram"],
    "dine_in":  ["hours", "wifi"]
  },
  "modal": ["about", "hours", "address", "contact", "social"],
  "modal_text": ""            // content for the custom_text modal section
}
```

- `bar.<mode>` = ordered list of enabled **bar item keys** for that mode. Render walks a canonical item order and shows those present in the list.
- `modal` = enabled **modal section keys**.
- `modal_text` = optional custom text shown when `custom_text` is in `modal`.
- The footer is dropped from the order page unconditionally — **not** stored here.

### Bar item keys

| key | renders | eligible modes | data source |
|---|---|---|---|
| `hours` | "Ouvert · 22:00" | all (non-batch) | `openingHoursConfig` |
| `min_order` | "Min ₪350" | pickup, delivery | `minimumOrderDelivery` |
| `fulfilment_time` | "Prêt en 15 min" / "25–40 min" | pickup, delivery (non-batch) | hardcoded design values |
| `batch_week` | "Pré-commande · Ouvre Mercredi 22:00" | all (batch only) | `batchConfig` |
| `wifi` | "Free WiFi" chip | dine-in | `social_links.wifi_ssid` |
| `instagram` `whatsapp` `facebook` `tiktok` | small tappable icon link | all | `social_links.<key>` |

`more` (the "Plus ›" affordance) is implicit — not a toggle.

### Modal section keys

| key | renders | data source |
|---|---|---|
| `about` | description / tagline text | `description` / `tagline` |
| `hours` | full weekly schedule | `openingHoursConfig` |
| `address` | address + map + Directions | `address` |
| `contact` | phone, email cards | `phone`, `social_links.email` |
| `social` | all social links | `social_links` |
| `custom_text` | free text block | `order_page_info.modal_text` |

### Defaults / migration

New field is nullable. When absent (existing restaurants), foodyweb falls back to **current behavior**:
- bar per mode = the items that render today (batch_week/hours, min_order, fulfilment_time, wifi for dine-in); social **off**.
- modal = about, hours, address, contact, social (current `InfoScreen` sections); custom_text **off**.

This keeps every existing restaurant visually identical until an owner edits the config — except the **footer**, which is removed from the order page for everyone (the agreed behavior).

## Changes by service

### foodyserver
- `WebsiteConfig`: add `OrderPageInfo datatypes.JSON` (`json:"order_page_info"`).
- Thread through: update input struct (`handler.go`), factory defaults (`service.go`), draft wire type + both mapping directions (`website_draft.go`).
- Audit migration SQL: `migrations/1xx_website_order_page_info.sql` (`ADD COLUMN IF NOT EXISTS order_page_info jsonb`).

### foodyadmin
- `WebsiteConfig` type (`lib/api.ts`): add `order_page_info?: OrderPageInfo`.
- New builder panel **"Infos de la page commande"** — a new sub-tab under **Paramètres** (movable; lives near contact/social which it draws on):
  - **Barre d'infos · par mode**: a mode switcher (Retrait / Livraison / Sur place); each mode shows on/off toggles for the bar item keys.
  - **Page « Plus »**: on/off toggles for the modal section keys + a "Texte personnalisé" textarea (`modal_text`).
- Wire to `order_page_info`; include it in the live-preview `postMessage` (`PreviewMessage`) so the menu preview updates live.
- Ensure `whatsapp` exists as a social-links field (Settings → Social) since it's a bar option (number → `wa.me` link). Add if missing.

### foodyweb
- `WebsiteConfig` type (`lib/types.ts`) + `services/api.ts`: parse `order_page_info` (camelCase `orderPageInfo`).
- `RestaurantHero`: build `rowItems` from `orderPageInfo.bar[orderType]` (canonical order, filtered by enabled + data present) instead of hardcoded logic; add social icon-link chips. Falls back to current logic when config absent.
- `InfoScreen`: render sections filtered by `orderPageInfo.modal`; add the `custom_text` block. Falls back to current sections when absent.
- `OrderExperience`: **remove `<SiteFooter>`** from the order page render.
- Add `orderPageInfo` to the preview `PreviewMessage` handling (`lib/themes/*`).

## Out of scope (YAGNI)

- Drag-and-drop / reordering of items (toggles only; canonical order).
- New social platforms beyond what `social_links` already supports (+ `whatsapp`).
- Footer changes on landing/custom pages (untouched).
- Per-item styling controls.

## Verification

- foodyserver: `gofmt && go build ./... && go vet ./...`.
- foodyadmin / foodyweb: `tsc --noEmit && npm run lint`.
- foodyweb visual: **production build** (`next build && next start`, prod API) + Playwright at 393px / 1440px — verify the bar reflects per-mode config, the modal reflects section config, the footer is gone, and an unconfigured restaurant is unchanged. (Dev masks prod-only CSS/purge differences.)
- Admin live-preview reflects toggles (note: preview iframe loads prod foodyweb, so the foodyweb render changes only appear after foodyweb deploys).
