# CLAUDE.md — foodyweb

> Claude Code reads this file automatically when working inside `foodyweb/`.
> See also: root `CLAUDE.md` for full monorepo context.

## Service Identity
- **Framework**: Next.js 14 (App Router) with React 18
- **Styling**: Tailwind CSS (no CSS modules)
- **State**: Zustand (client cart) + TanStack Query (server data)
- **Role**: Guest-facing QR ordering web app

## Key Conventions
- **Routing**: App Router — `app/{route}/page.tsx` + `layout.tsx`
- **API client**: All calls centralized in `services/api.ts`. Never use raw `fetch` in components.
- **Cart state**: `store/useCartStore.ts` (Zustand + localStorage persist)
- **Server state**: TanStack Query hooks in `hooks/` directory
- **i18n**: Context-based (en/he). Use `useI18n()` hook for translations.
- **Components**: In `components/` — shared/reusable. Page-specific UI in `app/{route}/`.
- **Providers**: Wrapped in `app/providers.tsx` (QueryClient, LocaleProvider, etc.)
- **Environment**: `NEXT_PUBLIC_API_BASE_URL` in `.env.local` (gitignored)

## Validate Before Push
```bash
npm run lint && npx tsc --noEmit
```

## Multi-Menu / Cartes
- `fetchMenu` in `services/api.ts` parses `{menus: [{id, name, categories: [...]}]}` response
- `MenuData` type in `lib/types.ts` represents a single carte with its groupes and articles
- `OrderExperience.tsx` shows horizontal menu tabs when `menus.length > 1` (hidden for single-carte restaurants)
- Each carte tab filters categories/items to that carte's groupes

## Important Files
| Purpose | Path |
|---------|------|
| API client (all endpoints) | `services/api.ts` |
| Menu types (MenuData, MenuResponse) | `lib/types.ts` |
| Order experience (menu tabs) | `components/OrderExperience.tsx` |
| Cart store (Zustand) | `store/useCartStore.ts` |
| Checkout flow | `app/order/checkout/page.tsx` |
| Push notifications hook | `hooks/usePushNotifications.ts` |
| Service worker | `public/sw.js` |
| i18n translations | `lib/i18n.tsx` |
| Tailwind config | `tailwind.config.ts` |
| CI workflow | `.github/workflows/ci.yml` |

## Important Files (continued)
| Purpose | Path |
|---------|------|
| Subdomain middleware | `middleware.ts` |
| Theme provider | `lib/restaurant-theme.tsx` |
| Restaurant layout (PWA) | `app/r/[restaurantId]/layout.tsx` |
| Dynamic manifest API | `app/api/manifest/[slug]/route.ts` |
| Dynamic favicon API | `app/api/favicon/[slug]/route.ts` |
| Install prompt | `components/InstallPrompt.tsx` |
| QR scanner | `components/QRScanner.tsx` |
| Service worker | `public/sw.js` |
| WebsiteConfig type | `lib/types.ts` |

## Patterns to Follow
- Types for API responses go in `services/api.ts` (co-located with the client)
- Use `useQuery` / `useMutation` from TanStack Query for all server interactions
- Cart modifications go through `useCartStore` actions
- Tailwind classes directly on elements — no utility wrappers unless heavily reused
- RTL support via `direction` in locale provider (Hebrew is RTL)
- Restaurant theming via CSS custom properties (`--brand`, `--brand-dark`, etc.) set by `RestaurantThemeProvider`
- Subdomain routing handled by `middleware.ts` — rewrites `{slug}.domain` → `/r/{slug}` internally
