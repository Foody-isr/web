"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRightIcon, ClockIcon, MapPinIcon, PhoneIcon, ShoppingBagIcon } from "@heroicons/react/24/outline";
import type { Restaurant } from "@/lib/types";
import { RestaurantThemeProvider } from "@/lib/restaurant-theme";
import { SiteNavbar } from "@/components/SiteNavbar";
import { SiteFooter } from "@/components/SiteFooter";
import { PoweredByFoody } from "@/components/PoweredByFoody";
import { useI18n } from "@/lib/i18n";

const COPY = {
  en: { eyebrow: "Local branch", order: "Order from this branch", global: "Visit the main website", details: "Branch information" },
  fr: { eyebrow: "Succursale locale", order: "Commander dans cette succursale", global: "Visiter le site principal", details: "Informations de la succursale" },
  he: { eyebrow: "סניף מקומי", order: "הזמנה מהסניף", global: "לאתר הראשי", details: "פרטי הסניף" },
} as const;

/** Lightweight branch homepage. Brand chrome is inherited; operational facts
 * and the direct order destination always remain scoped to the local branch. */
export function ChainBranchLanding({
  restaurant,
  brandRestaurant,
}: {
  restaurant: Restaurant;
  brandRestaurant: Restaurant;
}) {
  const { locale } = useI18n();
  const copy = COPY[locale];
  const slug = restaurant.slug || String(restaurant.id);
  const globalSlug = restaurant.chainSlug || brandRestaurant.slug || String(brandRestaurant.id);

  return (
    <RestaurantThemeProvider config={restaurant.websiteConfig ?? null} pageMode="website">
      <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text)]">
        <SiteNavbar restaurant={restaurant} activeKey="home" pageType="content" overHero={Boolean(restaurant.coverUrl)} />
        <main>
          <section className="relative isolate min-h-[68vh] overflow-hidden">
            {restaurant.coverUrl ? (
              <Image src={restaurant.coverUrl} alt="" fill priority className="object-cover" style={{ objectPosition: `${restaurant.coverFocalX ?? 50}% ${restaurant.coverFocalY ?? 50}%` }} />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/20" />
            <div className="relative mx-auto flex min-h-[68vh] max-w-7xl items-end px-6 pb-14 pt-32 md:px-10 md:pb-20">
              <div className="max-w-3xl text-white">
                <p className="mb-4 text-xs font-bold uppercase tracking-[.2em] text-white/70">{restaurant.chainName || brandRestaurant.name} · {copy.eyebrow}</p>
                <div className="flex items-center gap-4">
                  {restaurant.logoUrl ? <Image src={restaurant.logoUrl} alt={restaurant.name} width={88} height={88} className="h-20 w-20 rounded-2xl bg-white object-contain p-2 shadow-xl md:h-24 md:w-24" /> : null}
                  <h1 className="text-5xl font-bold tracking-[-.045em] md:text-7xl">{restaurant.name}</h1>
                </div>
                {restaurant.description ? <p className="mt-6 max-w-2xl text-base leading-7 text-white/80 md:text-lg">{restaurant.description}</p> : null}
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href={`/r/${encodeURIComponent(slug)}/order`} className="inline-flex items-center gap-2 rounded-full bg-[var(--brand)] px-6 py-3.5 font-bold text-white shadow-lg transition hover:-translate-y-0.5">
                    <ShoppingBagIcon className="h-5 w-5" /> {copy.order}
                  </Link>
                  <Link href={`/r/${encodeURIComponent(globalSlug)}`} className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/10 px-6 py-3.5 font-semibold text-white backdrop-blur transition hover:bg-white/20">
                    {copy.global} <ArrowRightIcon className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-6 py-12 md:px-10 md:py-16">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--brand)]">{copy.details}</p>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {restaurant.address ? <Fact icon={<MapPinIcon />} value={restaurant.address} /> : null}
              {restaurant.phone ? <Fact icon={<PhoneIcon />} value={restaurant.phone} href={`tel:${restaurant.phone}`} /> : null}
              {restaurant.openingHours ? <Fact icon={<ClockIcon />} value={restaurant.openingHours} /> : null}
            </div>
          </section>
        </main>
        <SiteFooter restaurant={restaurant} />
        <PoweredByFoody restaurantSlug={restaurant.slug} />
      </div>
    </RestaurantThemeProvider>
  );
}

function Fact({ icon, value, href }: { icon: React.ReactNode; value: string; href?: string }) {
  const content = <><span className="h-5 w-5 shrink-0 text-[var(--brand)] [&>svg]:h-5 [&>svg]:w-5">{icon}</span><span>{value}</span></>;
  const classes = "flex min-h-20 items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-5 py-4 text-sm font-semibold";
  return href ? <a href={href} className={classes}>{content}</a> : <div className={classes}>{content}</div>;
}
