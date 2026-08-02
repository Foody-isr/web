# AGENTS.md — foodyweb

## Service

Next.js App Router application for guest QR ordering and public restaurant websites. It consumes public Foody API contracts and renders ordering, catering, website pages, checkout, tracking, and PWA behavior.

Read `README.md` before editing.

## Conventions

- Use Next.js App Router with `app/**/page.tsx` and layouts.
- Centralize API calls in `services/api.ts`; do not issue raw API fetches from UI components when a client method belongs in the service layer.
- Keep shared API and menu types aligned with the server contract.
- Use Zustand for cart state and TanStack Query for server state.
- Use Tailwind classes; do not add CSS modules.
- Use existing locale and RTL providers for user-facing copy and layout direction.
- Reusable components live in `components/`; route-specific UI stays near its route.

## Public Website Routing

- Subdomain middleware rewrites restaurant hosts to `/r/{restaurant}` routes.
- Website V3 published pages are the source of truth for page navigation and canonical commerce aliases.
- Order and catering canonical routes must resolve consistently without redirect loops.
- Preview behavior and published behavior should use the same normalized page and section data whenever possible.
- Do not expose draft-only state in public rendering.

## Menu and Ordering

- Guest-facing menus use menu groups, not internal item categories.
- Items without a visible web-enabled group must not appear.
- Multi-menu tabs are shown only when more than one relevant menu exists.
- Cart mutations go through `useCartStore` actions.
- Variant prices replace item base prices; modifier prices remain deltas.
- Order payloads include `selected_variant_id` when a variant is selected.

## Themes and PWA

- Restaurant theme CSS variables are managed by `RestaurantThemeProvider`.
- Preserve dynamic manifest, favicon, service worker, and subdomain behavior when changing public layouts.
- Navigation, logo, footer, and page-specific appearance overrides must remain deterministic between server and client rendering.

## Validation

During iteration, run the narrowest relevant tests and type checks.

Before push, run:

```bash
npm run lint && npx tsc --noEmit
```

Run `npm run build` when changing routes, server components, middleware, configuration, or deployment-sensitive behavior.

## Important Paths

- API client: `services/api.ts`
- Shared types: `lib/types.ts`
- Public restaurant routes: `app/r/`
- Order experience: `components/OrderExperience.tsx`
- Item modal: `components/ItemModal.tsx`
- Cart store: `store/useCartStore.ts`
- Theme provider: `lib/restaurant-theme.tsx`
- Subdomain routing: `middleware.ts`
- Checkout: `app/order/checkout/page.tsx`
