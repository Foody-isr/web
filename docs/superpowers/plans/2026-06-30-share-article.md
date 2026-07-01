# Share Article Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a foodyweb guest share a specific menu item from the item modal to WhatsApp / social, producing a rich link preview (item photo + "Look at this {item} at {restaurant}") whose link opens the order page with that item's modal already open.

**Architecture:** A client share control builds a deep link from the current location (`<origin><pathname>?item={id}&lang={locale}`). The order page's existing `generateMetadata` is extended so that when `?item=` is present it emits item-specific Open Graph tags + an item OG image (new edge route). `OrderExperience` reads `?item`/`?lang` on mount to open the modal and set the language, and strips the params on close. Shared image-transcoding helpers are extracted so the new OG route reuses the proven weserv/satori pipeline.

**Tech Stack:** Next.js 14 App Router (React 18), TypeScript, Tailwind, `next/og` (satori, edge runtime), images.weserv.nl for JPEG transcoding, `node:test` + `tsx` for unit tests on pure `lib/` helpers.

## Global Constraints

- **Scope: foodyweb only.** No foodyserver / foodypos / foodyadmin changes.
- **No em dash (`—`) in any user-facing string.** Use natural phrasing.
- **Validate every task:** `npm run lint` and `npx tsc --noEmit`. For tasks touching `lib/` pure helpers also run the unit tests (`node --test --import tsx ./lib/__tests__/<file>.test.ts`).
- **Unit-test harness only covers pure `lib/` functions** (`node --test --import tsx './lib/**/__tests__/*.test.ts'`). React components and API routes are NOT unit-tested here — validate them with lint + tsc + a manual `next dev` check.
- **Item photos MUST be passed through images.weserv.nl** before satori (`next/og`) receives them — the upload pipeline stores AVIF/WebP under `.jpg`/`.png` names that satori cannot decode.
- **Next 14: `params` and `searchParams` are plain sync objects** — never `await` them or call `React.use()` on them.
- **Branch:** foodyweb is on `develop`; commit there. Do NOT create feature branches.
- **Staging:** stage explicit file paths on every commit; never `git add -A` (the user co-edits this repo live, especially `app/order/checkout/page.tsx`).
- **Supported locales:** `"en" | "he" | "fr"` (the `Locale` type in `lib/i18n.tsx`).

---

## File Structure

| File | Responsibility |
|------|----------------|
| `lib/og-render.ts` (new) | Edge-safe shared OG-image helpers extracted from `app/api/og/route.tsx`: `detectSatoriCompatibleMime`, `buildProxiedJpegUrl`, `fetchAndVerify`, `colorFromName`. |
| `app/api/og/route.tsx` (modify) | Restaurant OG image route — refactored to import the shared helpers instead of defining them locally. Behavior unchanged. |
| `lib/share.ts` (new) | Pure share helpers usable on server + client: `toLocale`, `shareTextTemplate`, `buildItemShareText`, `buildItemShareUrl`. |
| `lib/og.ts` (modify) | Add `buildItemOgImageUrl(...)` next to the existing `buildRestaurantOgImageUrl`. |
| `app/api/og/item/route.tsx` (new) | Edge route rendering the 1200×630 item OG card (photo hero + name overlay; text-card fallback when no photo). |
| `app/r/[restaurantId]/order/page.tsx` (modify) | Extend `generateMetadata` to emit item OG tags when `?item=` is present. |
| `components/ShareButton.tsx` (new) | Reusable share control: native share sheet with a desktop fallback popover (WhatsApp, Copy link, X, Facebook). |
| `components/ItemModal.tsx` (modify) | Accept `restaurantName`; render `ShareButton` in the footer. |
| `components/OrderExperience.tsx` (modify) | Read `?item`/`?lang` on mount; pass `restaurantName` to `ItemModal`; strip params on modal close. |
| `lib/i18n.tsx` (modify) | Add `copyLink` and `linkCopied` strings to en/he/fr. |
| `lib/__tests__/og-render.test.ts`, `lib/__tests__/share.test.ts`, `lib/__tests__/og.test.ts` (new) | Unit tests for the pure helpers. |

---

## Task 1: Extract shared OG-image helpers into `lib/og-render.ts`

This is a DRY refactor so Task 4's new route reuses the proven pipeline rather than duplicating ~50 lines. Behavior of the existing `/api/og` route must stay identical.

**Files:**
- Create: `foodyweb/lib/og-render.ts`
- Create: `foodyweb/lib/__tests__/og-render.test.ts`
- Modify: `foodyweb/app/api/og/route.tsx`

**Interfaces:**
- Produces:
  - `detectSatoriCompatibleMime(bytes: Uint8Array): string | null`
  - `buildProxiedJpegUrl(rawUrl: string, width: number): string | null`
  - `fetchAndVerify(rawUrl: string, width: number): Promise<FetchOutcome>` where `FetchOutcome = { ok: true; proxiedUrl: string; mime: string; bytes: number } | { ok: false; reason: string }`
  - `colorFromName(name: string): string`

- [ ] **Step 1: Write the failing test**

Create `foodyweb/lib/__tests__/og-render.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildProxiedJpegUrl, detectSatoriCompatibleMime, colorFromName } from "../og-render";

test("buildProxiedJpegUrl wraps an https source through weserv as jpg", () => {
  const out = buildProxiedJpegUrl("https://cdn.example.com/path/photo.jpg?v=2", 1200);
  assert.ok(out);
  const u = new URL(out!);
  assert.equal(u.host, "images.weserv.nl");
  assert.equal(u.searchParams.get("url"), "cdn.example.com/path/photo.jpg?v=2");
  assert.equal(u.searchParams.get("w"), "1200");
  assert.equal(u.searchParams.get("output"), "jpg");
});

test("buildProxiedJpegUrl rejects non-http(s) urls", () => {
  assert.equal(buildProxiedJpegUrl("data:image/png;base64,abc", 600), null);
  assert.equal(buildProxiedJpegUrl("not a url", 600), null);
});

test("detectSatoriCompatibleMime recognizes png and jpeg magic bytes", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]);
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const other = new Uint8Array([0x00, 0x01, 0x02, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(detectSatoriCompatibleMime(png), "image/png");
  assert.equal(detectSatoriCompatibleMime(jpg), "image/jpeg");
  assert.equal(detectSatoriCompatibleMime(other), null);
});

test("colorFromName is deterministic and returns an hsl string", () => {
  assert.equal(colorFromName("Mamie Tlv"), colorFromName("Mamie Tlv"));
  assert.match(colorFromName("Mamie Tlv"), /^hsl\(\d+, 55%, 30%\)$/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd foodyweb && node --test --import tsx ./lib/__tests__/og-render.test.ts`
Expected: FAIL — `Cannot find module '../og-render'`.

- [ ] **Step 3: Create `lib/og-render.ts` with the helpers moved verbatim**

Create `foodyweb/lib/og-render.ts` (copy the bodies from `app/api/og/route.tsx` exactly, just exported):

```ts
// Edge-safe helpers shared by the OG image routes (/api/og and /api/og/item).
// Extracted from app/api/og/route.tsx so item + restaurant cards reuse the same
// weserv transcode + satori-compatibility pipeline instead of duplicating it.

export function colorFromName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  const hue = h % 360;
  return `hsl(${hue}, 55%, 30%)`;
}

/**
 * Detects whether the leading bytes look like an image format satori can decode.
 * We treat JPEG and PNG as first-class; satori has known issues rendering WebP
 * inside `next/og` so we only accept files where the bytes match these formats.
 */
export function detectSatoriCompatibleMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  return null;
}

/**
 * Builds an images.weserv.nl URL that transcodes the source to JPEG. The S3
 * upload pipeline currently stores AVIF/WebP bytes under .png/.jpg names with
 * mismatched content-types; satori can't decode AVIF and struggles with WebP.
 * weserv re-encodes server-side regardless of source. `bg=white` flattens
 * transparent PNGs (e.g. logos) onto white instead of weserv's default black.
 */
export function buildProxiedJpegUrl(rawUrl: string, width: number): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    const stripped = `${parsed.host}${parsed.pathname}${parsed.search}`;
    const proxied = new URL("https://images.weserv.nl/");
    proxied.searchParams.set("url", stripped);
    proxied.searchParams.set("w", String(width));
    proxied.searchParams.set("output", "jpg");
    proxied.searchParams.set("q", "80");
    proxied.searchParams.set("bg", "white");
    return proxied.toString();
  } catch {
    return null;
  }
}

export type FetchOutcome =
  | { ok: true; proxiedUrl: string; mime: string; bytes: number }
  | { ok: false; reason: string };

export async function fetchAndVerify(rawUrl: string, width: number): Promise<FetchOutcome> {
  const proxiedUrl = buildProxiedJpegUrl(rawUrl, width);
  if (!proxiedUrl) return { ok: false, reason: "invalid source url" };
  try {
    const res = await fetch(proxiedUrl, { cache: "no-store" });
    if (!res.ok) return { ok: false, reason: `weserv http ${res.status}` };
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const mime = detectSatoriCompatibleMime(bytes);
    if (!mime) {
      return {
        ok: false,
        reason: `unrecognized magic bytes from weserv (len=${bytes.length} ct=${res.headers.get("content-type")})`,
      };
    }
    return { ok: true, proxiedUrl, mime, bytes: bytes.length };
  } catch (err) {
    return { ok: false, reason: `fetch threw: ${(err as Error).message ?? String(err)}` };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd foodyweb && node --test --import tsx ./lib/__tests__/og-render.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Rewire `app/api/og/route.tsx` to import the shared helpers**

In `foodyweb/app/api/og/route.tsx`:

1. Add the import directly under the existing imports (lines 1-2):

```tsx
import { fetchAndVerify, colorFromName } from "@/lib/og-render";
```

2. Delete the now-duplicated local definitions: `colorFromName` (lines 6-13), `detectSatoriCompatibleMime` (lines 22-32), `buildProxiedJpegUrl` (lines 34-60), the `FetchOutcome` type (lines 62-64), and `fetchAndVerify` (lines 66-85). Keep `clampPercent` and `jsonResponse` local (they are route-specific). The route body (`GET`) is unchanged — it still calls `fetchAndVerify(...)` and `colorFromName(...)`, now from the import.

- [ ] **Step 6: Validate the refactor**

Run: `cd foodyweb && npx tsc --noEmit && npm run lint`
Expected: no type errors, no new lint errors.

Manual smoke (optional but recommended): `npm run dev`, then open `http://localhost:3000/api/og?name=TestResto&debug=1` and confirm it returns `{"picked":"color-fallback",...}` JSON (proves the route still resolves the shared helpers).

- [ ] **Step 7: Commit**

```bash
cd foodyweb
git add lib/og-render.ts lib/__tests__/og-render.test.ts app/api/og/route.tsx
git commit -m "refactor(og): extract shared image helpers into lib/og-render"
```

---

## Task 2: Pure share helpers in `lib/share.ts`

**Files:**
- Create: `foodyweb/lib/share.ts`
- Create: `foodyweb/lib/__tests__/share.test.ts`

**Interfaces:**
- Consumes: `Locale` type from `@/lib/i18n`.
- Produces:
  - `toLocale(value: string | null | undefined): Locale` — returns the value if it is a supported locale, else `"en"`.
  - `shareTextTemplate(locale: Locale): string` — the per-locale sentence template containing `{item}` and `{restaurant}` placeholders.
  - `buildItemShareText(locale: Locale, itemName: string, restaurantName: string): string`
  - `buildItemShareUrl(origin: string, pathname: string, itemId: string, lang: string): string`

- [ ] **Step 1: Write the failing test**

Create `foodyweb/lib/__tests__/share.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { toLocale, buildItemShareText, buildItemShareUrl } from "../share";

test("toLocale accepts supported locales and defaults to en", () => {
  assert.equal(toLocale("fr"), "fr");
  assert.equal(toLocale("he"), "he");
  assert.equal(toLocale("en"), "en");
  assert.equal(toLocale("de"), "en");
  assert.equal(toLocale(null), "en");
  assert.equal(toLocale(undefined), "en");
});

test("buildItemShareText interpolates item and restaurant per locale", () => {
  assert.equal(
    buildItemShareText("en", "Tuna Salad", "Mamie Tlv"),
    "Look at this Tuna Salad at Mamie Tlv",
  );
  assert.equal(
    buildItemShareText("fr", "Salade Tuna", "Mamie Tlv"),
    "Regarde Salade Tuna chez Mamie Tlv",
  );
  // Hebrew template includes both values
  const he = buildItemShareText("he", "סלט טונה", "Mamie Tlv");
  assert.ok(he.includes("סלט טונה"));
  assert.ok(he.includes("Mamie Tlv"));
});

test("buildItemShareText contains no em dash", () => {
  for (const loc of ["en", "fr", "he"] as const) {
    assert.ok(!buildItemShareText(loc, "X", "Y").includes("—"));
  }
});

test("buildItemShareUrl appends only item and lang to current path", () => {
  assert.equal(
    buildItemShareUrl("https://app.foody-pos.co.il", "/r/lori-cash/order", "42", "fr"),
    "https://app.foody-pos.co.il/r/lori-cash/order?item=42&lang=fr",
  );
});

test("buildItemShareUrl drops any pre-existing query on the path", () => {
  const out = buildItemShareUrl("https://mamietlv.co.il", "/order", "7", "he");
  const u = new URL(out);
  assert.equal(u.origin, "https://mamietlv.co.il");
  assert.equal(u.pathname, "/order");
  assert.equal(u.searchParams.get("item"), "7");
  assert.equal(u.searchParams.get("lang"), "he");
  assert.equal([...u.searchParams.keys()].length, 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd foodyweb && node --test --import tsx ./lib/__tests__/share.test.ts`
Expected: FAIL — `Cannot find module '../share'`.

- [ ] **Step 3: Create `lib/share.ts`**

```ts
import type { Locale } from "./i18n";

const SUPPORTED_LOCALES: Locale[] = ["en", "he", "fr"];

/** Coerce an arbitrary string (e.g. a `?lang=` param) to a supported Locale. */
export function toLocale(value: string | null | undefined): Locale {
  return value && SUPPORTED_LOCALES.includes(value as Locale) ? (value as Locale) : "en";
}

// Per-locale share sentence. `{item}` and `{restaurant}` are interpolated.
// Centralized here so the client share control AND the server-side OG
// description (generateMetadata) render identical copy. No em dash (project rule).
const SHARE_TEXT_TEMPLATES: Record<Locale, string> = {
  en: "Look at this {item} at {restaurant}",
  fr: "Regarde {item} chez {restaurant}",
  he: "תראו את {item} ב{restaurant}",
};

export function shareTextTemplate(locale: Locale): string {
  return SHARE_TEXT_TEMPLATES[locale] ?? SHARE_TEXT_TEMPLATES.en;
}

export function buildItemShareText(locale: Locale, itemName: string, restaurantName: string): string {
  return shareTextTemplate(locale)
    .replace("{item}", itemName)
    .replace("{restaurant}", restaurantName);
}

/**
 * Build a shareable deep link to a single item. Takes the CURRENT origin +
 * pathname (so it works on app.foody-pos.co.il/r/{id}/order, subdomains, and
 * custom domains like mamietlv.co.il/order alike) and sets only `item` + `lang`,
 * dropping any pre-existing query on the page.
 */
export function buildItemShareUrl(origin: string, pathname: string, itemId: string, lang: string): string {
  const u = new URL(pathname, origin);
  u.search = "";
  u.searchParams.set("item", itemId);
  u.searchParams.set("lang", lang);
  return u.toString();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd foodyweb && node --test --import tsx ./lib/__tests__/share.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Validate types**

Run: `cd foodyweb && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd foodyweb
git add lib/share.ts lib/__tests__/share.test.ts
git commit -m "feat(share): pure item share url + text helpers"
```

---

## Task 3: `buildItemOgImageUrl` in `lib/og.ts`

**Files:**
- Modify: `foodyweb/lib/og.ts`
- Create: `foodyweb/lib/__tests__/og.test.ts`

**Interfaces:**
- Consumes: `Restaurant` type from `./types`.
- Produces:
  - `buildItemOgImageUrl(opts: { itemName: string; itemImageUrl?: string; restaurant: Restaurant; appUrl: string }): string` — returns a `/api/og/item?...` URL with `iname`, `rname`, optional `img` (only when `itemImageUrl` set) and optional `bg` (only when `restaurant.backgroundColor` set).

- [ ] **Step 1: Write the failing test**

Create `foodyweb/lib/__tests__/og.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildItemOgImageUrl } from "../og";
import type { Restaurant } from "../types";

function resto(p: Partial<Restaurant> = {}): Restaurant {
  return {
    id: 1,
    name: "Mamie Tlv",
    deliveryEnabled: true,
    pickupEnabled: true,
    dineInEnabled: true,
    ...p,
  } as Restaurant;
}

test("buildItemOgImageUrl includes item name, restaurant name and image", () => {
  const out = buildItemOgImageUrl({
    itemName: "Salade Tuna",
    itemImageUrl: "https://cdn.example.com/x.jpg",
    restaurant: resto({ backgroundColor: "#FF5733" }),
    appUrl: "https://app.foody-pos.co.il",
  });
  const u = new URL(out);
  assert.equal(u.pathname, "/api/og/item");
  assert.equal(u.searchParams.get("iname"), "Salade Tuna");
  assert.equal(u.searchParams.get("rname"), "Mamie Tlv");
  assert.equal(u.searchParams.get("img"), "https://cdn.example.com/x.jpg");
  assert.equal(u.searchParams.get("bg"), "#FF5733");
});

test("buildItemOgImageUrl omits img when item has no photo", () => {
  const out = buildItemOgImageUrl({
    itemName: "Coca",
    restaurant: resto(),
    appUrl: "https://app.foody-pos.co.il",
  });
  const u = new URL(out);
  assert.equal(u.searchParams.has("img"), false);
  assert.equal(u.searchParams.has("bg"), false);
  assert.equal(u.searchParams.get("iname"), "Coca");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd foodyweb && node --test --import tsx ./lib/__tests__/og.test.ts`
Expected: FAIL — `buildItemOgImageUrl` is not exported from `../og`.

- [ ] **Step 3: Add `buildItemOgImageUrl` to `lib/og.ts`**

Append to `foodyweb/lib/og.ts` (after `buildRestaurantOgImageUrl`):

```ts
/**
 * Builds the og:image URL for a single shared item. Points at the /api/og/item
 * edge route, which renders the item photo as the hero (transcoded via weserv)
 * with the item + restaurant name overlaid, and falls back to a text card when
 * the item has no photo.
 */
export function buildItemOgImageUrl(opts: {
  itemName: string;
  itemImageUrl?: string;
  restaurant: Restaurant;
  appUrl: string;
}): string {
  const url = new URL("/api/og/item", opts.appUrl);
  url.searchParams.set("iname", opts.itemName);
  url.searchParams.set("rname", opts.restaurant.name);
  if (opts.itemImageUrl) url.searchParams.set("img", opts.itemImageUrl);
  if (opts.restaurant.backgroundColor) url.searchParams.set("bg", opts.restaurant.backgroundColor);
  return url.toString();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd foodyweb && node --test --import tsx ./lib/__tests__/og.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Validate types**

Run: `cd foodyweb && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd foodyweb
git add lib/og.ts lib/__tests__/og.test.ts
git commit -m "feat(og): buildItemOgImageUrl helper"
```

---

## Task 4: Item OG image edge route `/api/og/item`

**Files:**
- Create: `foodyweb/app/api/og/item/route.tsx`

**Interfaces:**
- Consumes: `fetchAndVerify`, `colorFromName` from `@/lib/og-render` (Task 1).
- Produces: `GET(request)` returning a 1200×630 `ImageResponse`.

- [ ] **Step 1: Create the route**

Create `foodyweb/app/api/og/item/route.tsx`:

```tsx
import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { fetchAndVerify, colorFromName } from "@/lib/og-render";

export const runtime = "edge";

const cacheHeaders = {
  "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
};

/**
 * Item OG card (1200×630) for a shared menu item.
 *   ?iname=  item name (hero text)
 *   ?rname=  restaurant name (eyebrow)
 *   ?img=    item photo URL (optional; rendered full-bleed when decodable)
 *   ?bg=     #RRGGBB fallback background (optional)
 *
 * When the photo decodes via weserv it is the hero with a dark gradient and the
 * name overlaid. Otherwise we render a text card on the brand/derived color so
 * the preview is never broken.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const itemName = searchParams.get("iname") || "";
  const restaurantName = searchParams.get("rname") || "Foody";
  const img = searchParams.get("img");
  const bg = searchParams.get("bg");

  if (img) {
    const result = await fetchAndVerify(img, 1200);
    if (result.ok) {
      return new ImageResponse(
        (
          <div style={{ display: "flex", position: "relative", width: "100%", height: "100%", backgroundColor: "#121316" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={result.proxiedUrl}
              alt=""
              width={1200}
              height={630}
              style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, objectFit: "cover" }}
            />
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                display: "flex",
                flexDirection: "column",
                padding: "60px 64px",
                background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.0) 100%)",
              }}
            >
              <div style={{ display: "flex", fontSize: 30, fontWeight: 600, color: "rgba(255,255,255,0.85)", marginBottom: 8 }}>
                {restaurantName}
              </div>
              <div style={{ display: "flex", fontSize: 64, fontWeight: 800, color: "#FFFFFF", lineHeight: 1.05, letterSpacing: "-0.02em" }}>
                {itemName}
              </div>
            </div>
          </div>
        ),
        { width: 1200, height: 630, headers: cacheHeaders },
      );
    }
  }

  const backgroundColor = bg && /^#[0-9a-fA-F]{6}$/.test(bg) ? bg : colorFromName(restaurantName);
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          alignItems: "flex-start",
          justifyContent: "center",
          backgroundColor,
          fontFamily: "sans-serif",
          padding: 80,
        }}
      >
        <div style={{ display: "flex", fontSize: 32, fontWeight: 600, color: "rgba(255,255,255,0.8)", marginBottom: 16 }}>
          {restaurantName}
        </div>
        <div style={{ display: "flex", fontSize: 96, fontWeight: 800, color: "#FFFFFF", lineHeight: 1.05, letterSpacing: "-0.02em" }}>
          {itemName}
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: cacheHeaders },
  );
}
```

- [ ] **Step 2: Validate types + lint**

Run: `cd foodyweb && npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 3: Manual smoke test**

Run `npm run dev`, then open in a browser:
- Photo card: `http://localhost:3000/api/og/item?iname=Salade%20Tuna&rname=Mamie%20Tlv&img=<a-real-item-image-url>` → expect the photo with the name overlaid at the bottom.
- Fallback card: `http://localhost:3000/api/og/item?iname=Coca%20Cola&rname=Mamie%20Tlv` → expect a colored card with the text.

Confirm both return a 1200×630 PNG image (no error).

- [ ] **Step 4: Commit**

```bash
cd foodyweb
git add app/api/og/item/route.tsx
git commit -m "feat(og): item OG image route with photo hero + text fallback"
```

---

## Task 5: Extend `generateMetadata` for `?item=`

**Files:**
- Modify: `foodyweb/app/r/[restaurantId]/order/page.tsx`

**Interfaces:**
- Consumes: `fetchMenu` (already imported), `buildItemOgImageUrl` from `@/lib/og`, `buildItemShareText`, `buildItemShareUrl`, `toLocale` from `@/lib/share`, `tField` from `@/lib/translations`.

- [ ] **Step 1: Update imports + PageProps type**

In `foodyweb/app/r/[restaurantId]/order/page.tsx`:

1. Change the og import (line 6) to also pull the item helper:

```tsx
import { buildRestaurantOgImageUrl, buildItemOgImageUrl } from "@/lib/og";
```

2. Add new imports after it:

```tsx
import { buildItemShareText, buildItemShareUrl, toLocale } from "@/lib/share";
import { tField } from "@/lib/translations";
```

3. Extend the `searchParams` type (line 12):

```tsx
type PageProps = {
  params: { restaurantId: string };
  searchParams?: { type?: string; preview_date?: string; item?: string; lang?: string };
};
```

- [ ] **Step 2: Replace `generateMetadata` to branch on `?item=`**

Replace the whole `generateMetadata` function (lines 23-58) with:

```tsx
export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  try {
    const restaurant = await fetchRestaurant(params.restaurantId);

    // Item share link: emit item-specific OG so WhatsApp/social show the item
    // photo + "Look at this {item} at {restaurant}". Falls back to the
    // restaurant-level card when the item can't be resolved (stale link,
    // rotating carte, fetch failure) so the page never errors on a bad param.
    const itemId = searchParams?.item;
    if (itemId) {
      const lang = toLocale(searchParams?.lang);
      try {
        const menu = await fetchMenu(String(restaurant.id));
        const item = menu.items.find((i) => i.id === itemId);
        if (item) {
          const itemName = tField(item, "name", lang, item.name);
          const description = buildItemShareText(lang, itemName, restaurant.name);
          const ogImageUrl = buildItemOgImageUrl({
            itemName,
            itemImageUrl: item.imageUrl,
            restaurant,
            appUrl: APP_URL,
          });
          const url = buildItemShareUrl(APP_URL, `/r/${params.restaurantId}/order`, itemId, lang);
          return {
            title: itemName,
            description,
            openGraph: {
              title: itemName,
              description,
              type: "website",
              url,
              siteName: "Foody",
              images: [{ url: ogImageUrl, width: 1200, height: 630, alt: itemName }],
            },
            twitter: {
              card: "summary_large_image",
              title: itemName,
              description,
              images: [ogImageUrl],
            },
          };
        }
      } catch {
        // fall through to restaurant-level metadata
      }
    }

    const title = `${restaurant.name} - Menu | Foody`;
    const description = `Order from ${restaurant.name} online. Fast, easy, and delicious!`;
    const ogImageUrl = buildRestaurantOgImageUrl(restaurant, APP_URL);

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "website",
        url: `${APP_URL}/r/${params.restaurantId}/order`,
        siteName: "Foody",
        images: [
          {
            url: ogImageUrl,
            width: 1200,
            height: 630,
            alt: `${restaurant.name} - Menu`,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [ogImageUrl],
      },
    };
  } catch {
    return { title: "Foody - Order Food Online" };
  }
}
```

- [ ] **Step 3: Validate types + lint**

Run: `cd foodyweb && npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Run `npm run dev`. With a real restaurant slug and a real item id from its menu, open:
`http://localhost:3000/r/<slug>/order?item=<itemId>&lang=fr`

Then view the page source (or use a meta inspector) and confirm:
- `<meta property="og:title" content="<localized item name>">`
- `<meta property="og:description" content="Regarde <item> chez <restaurant>">`
- `<meta property="og:image" content=".../api/og/item?iname=...&rname=...&img=...">`

Also confirm a bad id (`?item=999999`) still renders the restaurant-level OG (no crash).

- [ ] **Step 5: Commit**

```bash
cd foodyweb
git add "app/r/[restaurantId]/order/page.tsx"
git commit -m "feat(share): item-specific Open Graph metadata on order page"
```

---

## Task 6: `ShareButton` component + i18n strings

**Files:**
- Create: `foodyweb/components/ShareButton.tsx`
- Modify: `foodyweb/lib/i18n.tsx`

**Interfaces:**
- Consumes: `buildItemShareUrl` from `@/lib/share`; `useI18n` from `@/lib/i18n`; `Locale` type from `@/lib/i18n`.
- Produces: `ShareButton({ itemId, lang, text, title }: { itemId: string; lang: Locale; text: string; title: string })` — a React component.

- [ ] **Step 1: Add i18n strings**

In `foodyweb/lib/i18n.tsx`, add two keys to each locale block. (`share` already exists in all three.)

In the `en` block, after `copied: "Copied",` (line 290):

```tsx
    copyLink: "Copy link",
    linkCopied: "Link copied",
```

In the `he` block, after `copied: "הועתק",` (line 744):

```tsx
    copyLink: "העתק קישור",
    linkCopied: "הקישור הועתק",
```

In the `fr` block, find the `copy`/`copied` entries (mirroring en) and add after them:

```tsx
    copyLink: "Copier le lien",
    linkCopied: "Lien copié",
```

If the `fr` block does not already have `copy`/`copied`, add all four lines (`copy`, `copied`, `copyLink`, `linkCopied`) in the same relative position as in `en`. Verify with: `cd foodyweb && grep -n "copyLink\|linkCopied" lib/i18n.tsx` → expect 3 matches each.

- [ ] **Step 2: Create the component**

Create `foodyweb/components/ShareButton.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n, type Locale } from "@/lib/i18n";
import { buildItemShareUrl } from "@/lib/share";

type Props = {
  itemId: string;
  lang: Locale;
  /** Pre-localized share sentence (without the URL). */
  text: string;
  /** Title for the native share sheet (the item name). */
  title: string;
};

/**
 * Share control for the item modal. Uses the native share sheet when available
 * (mobile: WhatsApp, Messages, Instagram, ...). On desktop / unsupported
 * browsers it opens a small popover with WhatsApp, Copy link, X and Facebook.
 * The shareable URL is built from the CURRENT location at click time so it works
 * across path, subdomain and custom-domain hosts.
 */
export function ShareButton({ itemId, lang, text, title }: Props) {
  const { t, direction } = useI18n();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close the fallback popover on any outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const currentUrl = () =>
    buildItemShareUrl(window.location.origin, window.location.pathname, itemId, lang);

  const handleClick = async () => {
    const url = currentUrl();
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
      } catch {
        // user cancelled or share failed — not an error
      }
      return;
    }
    setOpen((v) => !v);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — leave popover open, no crash
    }
  };

  const waHref = () => `https://wa.me/?text=${encodeURIComponent(`${text} ${currentUrl()}`)}`;
  const xHref = () =>
    `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(currentUrl())}`;
  const fbHref = () =>
    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentUrl())}`;

  return (
    <div className="relative flex-shrink-0" ref={ref} data-no-drag>
      <button
        type="button"
        onClick={handleClick}
        aria-label={t("share") || "Share"}
        className="w-14 h-14 rounded-full bg-[var(--surface-subtle)] hover:bg-[var(--divider)] flex items-center justify-center text-[var(--text-primary)] transition active:scale-[0.96]"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.7 10.7l6.6-3.4M8.7 13.3l6.6 3.4" />
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute bottom-full mb-2 z-50 min-w-[200px] rounded-2xl bg-[var(--surface)] border border-[var(--divider)] shadow-2xl overflow-hidden"
          style={direction === "rtl" ? { right: 0 } : { left: 0 }}
        >
          <a
            href={waHref()}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 text-[14px] text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition"
          >
            WhatsApp
          </a>
          <button
            type="button"
            onClick={handleCopy}
            className="w-full flex items-center gap-3 px-4 py-3 text-[14px] text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition text-start"
          >
            {copied ? t("linkCopied") || "Link copied" : t("copyLink") || "Copy link"}
          </button>
          <a
            href={xHref()}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 text-[14px] text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition"
          >
            X
          </a>
          <a
            href={fbHref()}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 text-[14px] text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition"
          >
            Facebook
          </a>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Validate types + lint**

Run: `cd foodyweb && npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd foodyweb
git add components/ShareButton.tsx lib/i18n.tsx
git commit -m "feat(share): ShareButton with native sheet + desktop fallback"
```

---

## Task 7: Wire `ShareButton` into `ItemModal`

**Files:**
- Modify: `foodyweb/components/ItemModal.tsx`

**Interfaces:**
- Consumes: `ShareButton` from `@/components/ShareButton`; `buildItemShareText` from `@/lib/share`; `locale` from `useI18n`.
- Produces: `ItemModal` now requires a `restaurantName: string` prop.

- [ ] **Step 1: Add the import**

In `foodyweb/components/ItemModal.tsx`, after the existing component imports (around line 12, after the `VerbPalette` import):

```tsx
import { ShareButton } from "@/components/ShareButton";
import { buildItemShareText } from "@/lib/share";
```

- [ ] **Step 2: Add the `restaurantName` prop**

Update the `Props` type (lines 20-24) and the destructure (line 68):

```tsx
type Props = {
  item?: MenuItem | null;
  restaurantName: string;
  onClose: () => void;
  onAdd: (item: MenuItem, quantity: number, note?: string, modifiers?: MenuItemModifier[], selectedVariantId?: number, selectedVariantName?: string, selectedVariantPrice?: number) => void;
};
```

```tsx
export function ItemModal({ item, restaurantName, onClose, onAdd }: Props) {
  const { t, direction, locale } = useI18n();
```

(`locale` is added to the existing `useI18n()` destructure.)

- [ ] **Step 3: Compute the share text**

Right after `const itemDescription = ...` (line 72), add:

```tsx
  const shareText = item ? buildItemShareText(locale, itemName, restaurantName) : "";
```

- [ ] **Step 4: Render `ShareButton` in the footer**

Replace the footer's single-button block (lines 706-744, the `<button onClick={...}>Add to cart</button>`) so the button sits in a row beside the share control. Wrap the existing add-to-cart `<button>` and the new ShareButton in a flex row:

```tsx
              <div className="flex items-center gap-3">
                {item && (
                  <ShareButton
                    itemId={item.id}
                    lang={locale}
                    text={shareText}
                    title={itemName}
                  />
                )}
                <button
                  onClick={() => {
                    if (!canAdd) return;
                    onAdd(
                      item,
                      qty,
                      note,
                      pickedModifiers,
                      resolvedVariant?.id,
                      resolvedVariant?.name,
                      resolvedVariant?.price,
                    );
                    onClose();
                  }}
                  disabled={!canAdd}
                  className={`flex-1 py-4 rounded-full font-bold text-[15px] transition flex items-center justify-center gap-2 ${
                    canAdd
                      ? "bg-brand text-white hover:bg-brand-dark active:scale-[0.99]"
                      : "bg-[var(--surface-subtle)] text-[var(--text-soft)] cursor-not-allowed"
                  }`}
                  style={
                    canAdd
                      ? {
                          boxShadow:
                            "0 10px 24px -8px color-mix(in srgb, var(--brand) 55%, transparent)",
                        }
                      : undefined
                  }
                >
                  {canAdd ? (
                    <>
                      <span>{t("addToCart")}</span>
                      <span className="opacity-50">·</span>
                      <span className="tabular-nums">₪{(unitPrice * qty).toFixed(2)}</span>
                    </>
                  ) : (
                    <span>{t("selectRequired") || "Please select required options"}</span>
                  )}
                </button>
              </div>
```

(The only change to the add-to-cart button itself is `w-full` → `flex-1`; everything else is preserved.)

- [ ] **Step 5: Validate types + lint**

Run: `cd foodyweb && npx tsc --noEmit && npm run lint`
Expected: `tsc` reports an error at the `ItemModal` usage in `OrderExperience.tsx` (missing `restaurantName` prop). That is expected and fixed in Task 8. If you are running tasks out of order, apply Task 8 Step 3 first. Lint should pass.

- [ ] **Step 6: Commit**

```bash
cd foodyweb
git add components/ItemModal.tsx
git commit -m "feat(share): share button in item modal footer"
```

---

## Task 8: Deep-link handling in `OrderExperience`

**Files:**
- Modify: `foodyweb/components/OrderExperience.tsx`

**Interfaces:**
- Consumes: `useSearchParams` from `next/navigation`; `toLocale` from `@/lib/share`; `setLocale` from `useI18n`; `menu.items`; `setSelectedItem`.

- [ ] **Step 1: Add imports + hooks**

In `foodyweb/components/OrderExperience.tsx`:

1. Update the navigation import (line 49):

```tsx
import { useRouter, useSearchParams } from "next/navigation";
```

2. Add the share helper import near the other `@/lib` imports (e.g. after line 30 `import { tField } from "@/lib/translations";`):

```tsx
import { toLocale } from "@/lib/share";
```

3. Add `setLocale` to the `useI18n()` destructure (line 66):

```tsx
  const { t, direction, locale, setLocale } = useI18n();
```

4. Add the search params hook right after `const router = useRouter();` (line 65):

```tsx
  const searchParams = useSearchParams();
```

- [ ] **Step 2: Add the deep-link effect**

Immediately AFTER the `const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);` line (line 614), add:

```tsx
  // Deep link from a shared item URL (?item=<id>&lang=<locale>): apply the
  // shared language and open that item's modal once on mount. Silent if the id
  // is not in the current menu (stale link / rotating carte).
  useEffect(() => {
    const lang = searchParams.get("lang");
    if (lang) setLocale(toLocale(lang));
    const itemId = searchParams.get("item");
    if (itemId) {
      const found = menu.items.find((i) => i.id === itemId);
      if (found) setSelectedItem(found);
    }
    // Run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

- [ ] **Step 3: Add a close handler that strips the params + pass `restaurantName`**

Replace the `ItemModal` usage (lines 1272-1276) with:

```tsx
      <ItemModal
        item={selectedItem}
        restaurantName={restaurant.name}
        onClose={() => {
          setSelectedItem(null);
          if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            if (url.searchParams.has("item") || url.searchParams.has("lang")) {
              url.searchParams.delete("item");
              url.searchParams.delete("lang");
              window.history.replaceState(null, "", url.pathname + url.search + url.hash);
            }
          }
        }}
        onAdd={handleAddToCart}
      />
```

- [ ] **Step 4: Validate types + lint**

Run: `cd foodyweb && npx tsc --noEmit && npm run lint`
Expected: no errors (this resolves the missing-prop error from Task 7).

- [ ] **Step 5: Manual end-to-end check**

Run `npm run dev`. Using a real restaurant slug + a real item id:

1. Open `http://localhost:3000/r/<slug>/order`, click an item → modal opens. Confirm the share button appears in the footer next to Add to cart.
2. Click share on desktop → fallback popover appears with WhatsApp / Copy link / X / Facebook. Click Copy link → label changes to "Link copied"; paste and confirm it is `<origin>/r/<slug>/order?item=<id>&lang=<locale>`.
3. Open that copied URL in a new tab → the page loads, switches to the link's language, and the item modal opens automatically.
4. Close the modal → the URL loses `?item`/`?lang` (no reload).
5. Open `?item=999999` (bad id) → page opens normally, no modal, no error.

- [ ] **Step 6: Commit**

```bash
cd foodyweb
git add components/OrderExperience.tsx
git commit -m "feat(share): open item modal from shared deep link"
```

---

## Final Validation

- [ ] **Run the full foodyweb validation + tests**

```bash
cd foodyweb
npm test
npm run lint
npx tsc --noEmit
```

Expected: all unit tests pass; no lint errors; no type errors.

- [ ] **Optional: full preview check**

Per the project's prod-verify habit, a `next build` + `next start` and a link-preview inspector (e.g. the Facebook Sharing Debugger against a deployed dev URL) is the most faithful way to confirm WhatsApp/social render the item card. This requires the change to be on `dev-app.foody-pos.co.il` first (push to `develop`).

---

## Notes / Deferred (YAGNI)

- **Logo compositing** on the item OG card is intentionally omitted (avoids a second weserv fetch + layout); the restaurant name text is enough for v1.
- **Single-item public API endpoint** is not added; `generateMetadata` reuses `fetchMenu`. On a shared-link human visit this fetches the menu in both `generateMetadata` and the page render. Acceptable for v1; revisit (React `cache()` or a dedicated endpoint) only if it shows up as a latency problem.
- **Share analytics** are out of scope.
