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

## Important Files
| Purpose | Path |
|---------|------|
| API client (all endpoints) | `services/api.ts` |
| Cart store (Zustand) | `store/useCartStore.ts` |
| Checkout flow | `app/order/checkout/page.tsx` |
| Push notifications hook | `hooks/usePushNotifications.ts` |
| Service worker | `public/sw.js` |
| i18n translations | `lib/i18n.tsx` |
| Tailwind config | `tailwind.config.ts` |
| CI workflow | `.github/workflows/ci.yml` |

## Patterns to Follow
- Types for API responses go in `services/api.ts` (co-located with the client)
- Use `useQuery` / `useMutation` from TanStack Query for all server interactions
- Cart modifications go through `useCartStore` actions
- Tailwind classes directly on elements — no utility wrappers unless heavily reused
- RTL support via `direction` in locale provider (Hebrew is RTL)
