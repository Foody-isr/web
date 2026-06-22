# foodyweb Checkout — Out-of-Stock & Minimum-Order Gating

**Date:** 2026-06-22
**Service:** foodyweb only (no foodyserver / foodypos changes)
**Status:** Design approved, pending spec review

## Problem

On the checkout/payment page (`app/order/checkout/page.tsx`), when an item in the
cart has gone out of stock between adding it and reaching payment, the only signal
is the raw server rejection rendered as small red text below the pay button:

> `only 0 of "L'OR ROUGE" available right now`

Three problems with this:

1. **Untranslated** — the server string is English even on a French (or Hebrew) page.
2. **Detached from the item** — the message sits at the bottom of the summary while the
   offending line is at the top of a multi-item list; the customer cannot tell which item.
3. **Reactive only** — the orange "Commander et payer" button stays fully active, so the
   customer taps into a guaranteed failure instead of being stopped beforehand.

A related inconsistency: the **minimum-order** case for delivery *already* disables the
button (`disabled={... || isBelowMinimum}`) and shows an amber banner, but the disabled
styling (`disabled:opacity-50`) keeps the button orange and looking tappable. We want both
gating reasons — out-of-stock and below-minimum — to read as clearly blocked, consistently.

## Goals

- Catch out-of-stock items **proactively**, before the customer taps pay.
- Tie the message to the **specific cart line**, translated (fr/he/en).
- Offer a **one-tap fix** per line: remove a sold-out item, or reduce quantity to the
  available count when only partial stock remains.
- Disable the pay button while **any** blocking condition holds (out-of-stock OR
  below-minimum), with a genuinely-disabled visual.
- Keep the server availability guard as the final safety net, but replace its raw English
  rejection with a translated fallback banner.

## Non-Goals

- No foodyserver or foodypos changes; no new/changed API contract.
- Combo lines are **not** proactively stock-checked in this iteration (see Limitations).
- Variant-level (per-size) availability precision is not attempted client-side; the check
  is item-level. The server guard remains authoritative for variant edge cases.

## Data Source

Checkout is a client component that today reads only the Zustand cart store. The menu (with
per-item `availabilityState` and `buildableCount`) is fetched server-side on the order page,
so there is no client cache to reuse here.

Add a client query on the checkout page:

```ts
const { data: freshMenu, refetch: refetchAvailability } = useQuery({
  queryKey: ["checkout-availability", restaurantId],
  queryFn: () => fetchMenu(restaurantId),
  enabled: !!restaurantId,
});
```

`fetchMenu` already uses `cache: "no-store"`, so each fetch is current. From the result,
build a flat lookup of every item across all menus/groups:

```ts
Map<string /* itemId */, { state?: AvailabilityState; buildableCount?: number | null }>
```

Refetched on mount and again on a failed submit (so a race-condition rejection lights up
the proactive UI).

## Pure Helper — `lib/cart-availability.ts`

Keeps the 1300-line page thin and gives the logic a unit test (matches the existing
`lib/__tests__/*.test.ts` pattern run by `node --test`).

```ts
export type LineAvailability =
  | { status: "ok" }
  | { status: "sold_out" }
  | { status: "insufficient"; available: number }; // available >= 1, < requested qty

export function computeLineAvailability(
  line: CartLine,
  availability: Map<string, { state?: AvailabilityState; buildableCount?: number | null }>,
): LineAvailability;
```

Rules for a non-combo line:

1. Combo line (`line.comboId` set) → `ok` (out of scope this iteration).
2. No entry in the map (item vanished from menu) → `ok` (let the server guard decide).
3. `state === "sold_out"` or the item is otherwise unavailable → `sold_out`.
4. `buildableCount != null && buildableCount < line.quantity`:
   - `buildableCount <= 0` → `sold_out`
   - else → `insufficient` with `available = buildableCount`
5. Otherwise → `ok`.

Derived in the page:

```ts
const lineStatus = new Map(displayLines.map((l) => [l.id, computeLineAvailability(l, availMap)]));
const hasBlockedLines = [...lineStatus.values()].some((s) => s.status !== "ok");
const checkoutBlocked = hasBlockedLines || isBelowMinimum;
```

## UI Changes (order summary, `app/order/checkout/page.tsx`)

### 1. Per-line indicator + action (line ~1212 list)

For a line whose status is not `ok`:

- Dim the line (`opacity-60`) and append a badge after the name:
  - `sold_out` → red badge, `t("soldOut")` ("Épuisé").
  - `insufficient` → amber badge, `t("onlyNLeft").replace("{n}", available)` ("Plus que {n}").
- A small action button under the line:
  - `sold_out` → `t("removeItem")` ("Retirer") → `removeItem(line.id)`.
  - `insufficient` → `t("reduceToN").replace("{n}", available)` ("Réduire à {n}")
    → `updateQuantity(line.id, available)`.

Cart store already exposes `removeItem(lineId)` and `updateQuantity(lineId, qty)`.

### 2. Blocking banner above the pay button

When `hasBlockedLines`, show an amber/red info box (same visual family as the existing
minimum-order banner) with `t("itemsUnavailableTitle")` and `t("itemsUnavailableHelp")`.
The existing minimum-order banner (line ~1196) stays as-is.

### 3. Pay button (line ~1291)

- `disabled={createOrderMutation.isPending || checkoutBlocked}`.
- Replace the weak `disabled:opacity-50` with a clearly-disabled style: grey background,
  no brand shadow, `disabled:cursor-not-allowed` — so both gating reasons look non-clickable.

### 4. Reactive fallback (line ~1314)

On `createOrderMutation.isError`, call `refetchAvailability()`, then decide the message
purely from the refetched state (no fragile parsing of the English server string):

- If `hasBlockedLines` is now true (the refetch surfaced the sold-out item) → show the
  translated `t("itemsUnavailableTitle")` banner; the per-line badges/actions are already lit.
- Otherwise (a different rejection — closed, paused, payment, etc.) → keep showing
  `error.message` as today. Those errors already have their own copy and are out of scope.

This means we never try to map the raw string to a line; the proactive path does the mapping
and the reactive path just re-triggers it.

## i18n — new keys (`lib/i18n.tsx`, en/he/fr)

| key | en | he | fr |
|---|---|---|---|
| `onlyNLeft` | `Only {n} left` | `נשארו {n}` | `Plus que {n}` |
| `reduceToN` | `Reduce to {n}` | `הפחת ל-{n}` | `Réduire à {n}` |
| `removeItem` | `Remove` | `הסר` | `Retirer` |
| `itemsUnavailableTitle` | `Some items are no longer available` | `חלק מהפריטים אינם זמינים יותר` | `Certains articles ne sont plus disponibles` |
| `itemsUnavailableHelp` | `Adjust the highlighted items to continue.` | `עדכן את הפריטים המסומנים כדי להמשיך.` | `Ajustez les articles en surbrillance pour continuer.` |

The reactive fallback reuses `itemsUnavailableTitle` (no separate key needed).

Reuse existing `soldOut`. (Hebrew strings to be confirmed during review; placeholders above
follow the existing translation tone.)

## Limitations (this iteration)

- **Combos** are not proactively checked — a combo whose underlying item is sold out will
  still rely on the server guard + translated fallback banner. Acceptable: combos are a small
  fraction of carts and per-step resolution is a larger task.
- **Variant precision** — item-level check only; a sold-out *specific size* of an otherwise
  available item may pass the proactive check and be caught by the server guard.

## Testing

- Unit test `lib/__tests__/cart-availability.test.ts` for `computeLineAvailability`: ok,
  sold_out (state), sold_out (buildableCount<=0), insufficient (1 <= count < qty), combo
  line passthrough, missing-entry passthrough.
- `npm run lint && npx tsc --noEmit` for the page/i18n changes.
- Manual: a cart with one sold-out and one low-stock item → both flagged, button disabled,
  remove/reduce actions clear the block; delivery below minimum → button disabled with banner.

## Files Touched

- `app/order/checkout/page.tsx` — availability query, derived status, per-line UI, banner,
  button disable + style, reactive fallback.
- `lib/cart-availability.ts` — new pure helper.
- `lib/__tests__/cart-availability.test.ts` — new unit test.
- `lib/i18n.tsx` — new keys (en/he/fr).
