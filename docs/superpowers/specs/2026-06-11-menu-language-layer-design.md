# Menu Language Layer (Wolt-style) — Design

**Date:** 2026-06-11 · **Status:** approved, implemented same day

## Problem

foodyweb had one language setting: the UI locale (en/he/fr, browser-detected,
switchable in the hamburger drawer). Menu content auto-followed it via
`tField(entity, field, locale)`. Wolt separates the two: the app chrome follows
the user's system language, while menu content stays in the restaurant's
original language unless the guest explicitly opts into machine translation.

## Decisions (user-approved)

- **Persistence:** the guest's translate choice is remembered **per restaurant**
  (localStorage). After the banner, a slim control in the same spot lets them
  flip anytime.
- **Scope:** the menu-language choice applies **everywhere** menu content
  renders: menu page, item modal, cart drawer, split payment, checkout summary.
- UI strings (`t()`), page direction, and checkout form-field labels keep
  following the system language.

## Architecture

### Server (foodyserver)

`GET /api/v1/public/restaurants/:idOrSlug` now returns `default_locale` (the
restaurant's authoring language, already on the model). One line in
`internal/restaurants/handler.go` `GetPublic`.

### foodyweb

- **`lib/menu-language.tsx` — `MenuLanguageProvider`** (mounted in
  `app/providers.tsx` inside `LocaleProvider`). State: `restaurantId`,
  `sourceLocale`, `choice ∈ unset|original|translated`, persisted at
  `foody.menu-lang.<restaurantId>`. Derives:
  - `menuLocale` — locale for entity content: `translated → uiLocale`,
    otherwise `sourceLocale`; falls back to `uiLocale` when the source is
    unknown (old cached API payloads), preserving legacy behavior.
  - `offerTranslation` (banner) / `canToggle` (slim control), both false when
    UI language = source language.
  - `configure(restaurantId, sourceLocale)` — called by pages that own
    restaurant data (OrderExperience, checkout).
- **Resolution trick:** the translations map never stores the source locale
  (source lives in entity columns), so passing `sourceLocale` to the existing
  `tField()` renders the original. No `tField` changes; call sites switch from
  `locale` to `menuLocale`.
- **`components/MenuTranslateBanner.tsx`:** banner ("This menu is in {source}.
  Would you like to view a machine translation in {target}?" — Translate /
  Not now) when `offerTranslation`; slim line ("Translated to X · Show
  original" / "Menu shown in X · Translate to Y") when `canToggle`. Rendered in
  OrderExperience below the order-type selector.
- **Migrated call sites:** OrderExperience (group banners), MenuItemCard,
  themed MenuItemCard Compact/Magazine, CategoryTabs (group tabs), ItemModal
  (incl. option sets, modifiers, portions), CartDrawer, SplitPayment, checkout
  order summary (`line.item.name` → `tField`, `formatModifierLabel` now gets
  `menuLocale`). Search in OrderExperience deliberately keeps matching BOTH the
  source columns and the UI-locale translation regardless of display mode.
- **i18n:** `menuLang*` + `langName_*` keys added in en/he/fr.

## Error handling / rollout

- Old API payload without `default_locale` → `sourceLocale` null → behavior
  identical to before the feature (translate by UI locale, no banner). The web
  can deploy before or after the server.
- Missing translations still fall back to source text inside `tField`.

## Testing

`tsc --noEmit` + `next lint` green. Manual verification on dev: banner shows
when UI ≠ source, choice persists per restaurant, toggle flips content
everywhere, no banner when UI = source.
