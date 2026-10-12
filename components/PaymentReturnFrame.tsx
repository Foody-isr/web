"use client";

import { useMemo, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { LanguageToggle } from "@/components/LanguageToggle";
import { PageAppearanceScope } from "@/components/PageAppearanceScope";
import { useOrderRoutePage } from "@/hooks/useOrderRoutePage";
import { useI18n } from "@/lib/i18n";
import { RestaurantThemeProvider } from "@/lib/restaurant-theme";
import { useResolvedTheme } from "@/lib/themes/useResolvedTheme";
import { mergeWebsiteConfigWithPageAppearance } from "@/lib/websiteV3Appearance";
import type { Restaurant } from "@/lib/types";

/** Keeps hosted-payment return screens in the published checkout's visual context. */
export function PaymentReturnFrame({ restaurant, pageSlug, children }: {
  restaurant: Restaurant | null;
  pageSlug: string;
  children: ReactNode;
}) {
  const { data: page } = useOrderRoutePage(restaurant ? String(restaurant.id) : "", pageSlug);
  const config = useMemo(() => mergeWebsiteConfigWithPageAppearance(
    restaurant?.websiteConfig, page?.appearance_overrides, "order",
  ), [restaurant, page]);
  return (
    <RestaurantThemeProvider config={config} pageMode="commerce">
      <PaymentReturnSurface restaurant={restaurant} pageSlug={pageSlug} appearance={page?.appearance_overrides}>
        {children}
      </PaymentReturnSurface>
    </RestaurantThemeProvider>
  );
}

function PaymentReturnSurface({ restaurant, pageSlug, appearance, children }: {
  restaurant: Restaurant | null;
  pageSlug: string;
  appearance: Parameters<typeof PageAppearanceScope>[0]["appearance"];
  children: ReactNode;
}) {
  const { t, direction } = useI18n();
  const { config, resolved } = useResolvedTheme();
  const menuHref = restaurant ? `/r/${restaurant.slug || restaurant.id}/${encodeURIComponent(pageSlug || "order")}` : undefined;
  return (
    <PageAppearanceScope appearance={appearance} surface="checkout"
      palette={{ ...resolved?.theme.tokens.colors, ...config?.customPalette }}>
      <main className="commerce-surface min-h-screen bg-[var(--bg-page)] pb-12 text-[var(--text)]" dir={direction} data-payment-return>
        <header className="commerce-header !grid-cols-[minmax(0,1fr)_auto] border-b border-[var(--divider)] sm:!grid-cols-[1fr_auto_1fr]">
          <span className="hidden items-center gap-2 text-sm text-[var(--text-muted)] sm:flex">
            {t("commercePayment")}
          </span>
          {menuHref ? <Link href={menuHref} className="commerce-logo min-w-0 break-words !text-start sm:!text-center" aria-label={restaurant?.name}>
            {restaurant?.logoUrl ? <Image src={restaurant.logoUrl} alt={restaurant.name} width={120} height={48} className="max-h-12 w-auto object-contain" /> : restaurant?.name}
          </Link> : <span />}
          <LanguageToggle dropdownPlacement="below" />
        </header>
        <div className="mx-auto w-full max-w-xl px-5 pt-8 sm:pt-12">{children}</div>
      </main>
    </PageAppearanceScope>
  );
}
