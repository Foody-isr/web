"use client";

import { useResolvedTheme } from "@/lib/themes/useResolvedTheme";
import { getSectionBg } from "./sections/sectionBg";
import { contrastInk } from "@/lib/themes/contrastInk";
import { useI18n } from "@/lib/i18n";

/** Marketing site the attribution points at. Overridable per environment. */
const FOODY_SITE_URL =
  process.env.NEXT_PUBLIC_FOODY_SITE_URL || "https://foody-pos.co.il";

/** Renders the independent platform attribution strip on customer pages. */
export function PoweredByFoody({
  restaurantSlug,
}: {
  restaurantSlug?: string;
}) {
  const { t } = useI18n();
  const { config } = useResolvedTheme();
  const branding = config?.customPalette?.footer_branding;
  const bg = getSectionBg(
    { color_style: branding?.color_style || "default" },
    "default",
  );
  const background = /^#[a-f\d]{6}$/i.test(branding?.background || "")
    ? branding?.background
    : undefined;
  if (branding?.enabled === false) return null;

  // UTM tagging so the traffic this earns is actually measurable per restaurant.
  const href =
    `${FOODY_SITE_URL}?utm_source=restaurant&utm_medium=powered_by` +
    (restaurantSlug
      ? `&utm_campaign=${encodeURIComponent(restaurantSlug)}`
      : "");

  return (
    <div
      data-editor-region="footer-branding"
      data-editor-label="Footer branding"
      className={`mt-auto px-4 pt-3 text-center ${bg.className}`}
      // The order page's cart dock is a fixed bar that would otherwise cover
      // this. It publishes its height on :root; everywhere else this is 0.
      style={{
        ...bg.style,
        ...(background
          ? { backgroundColor: background, color: contrastInk(background) }
          : {}),
        paddingBottom: "calc(0.75rem + var(--bottom-dock-h, 0px))",
      }}
    >
      <a
        href={href}
        target="_blank"
        // No `noreferrer`: the referrer is half the point of the attribution.
        rel="noopener"
        className="text-[11px] opacity-75 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
      >
        {t("poweredByFoody")}
      </a>
    </div>
  );
}
