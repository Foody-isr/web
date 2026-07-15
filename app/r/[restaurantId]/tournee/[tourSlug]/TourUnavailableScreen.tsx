"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

type Props = {
  /** Server-returned 404 reason: "tour_closed" | "tour_not_found" (or any other). */
  reason: string;
  /** Where "back to the restaurant" points — the normal order site. */
  restaurantSlug: string;
};

/**
 * Shown on a tour's dedicated page when the link can't open the round's carte:
 * the tour has closed (past its ordering window) or the slug is unknown / points
 * at the wrong restaurant / is unpublished. A clear state with a way back to the
 * restaurant's normal site — never a broken screen.
 */
export function TourUnavailableScreen({ reason, restaurantSlug }: Props) {
  const { t, direction } = useI18n();
  const closed = reason === "tour_closed";
  const title = closed ? t("tourPageClosedTitle") : t("tourPageNotFoundTitle");

  return (
    <main
      className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center px-6"
      dir={direction}
    >
      <div className="w-full max-w-sm text-center">
        <div className="text-5xl mb-4" aria-hidden="true">
          🚚
        </div>
        <h1 className="text-xl font-bold text-[var(--text)]">{title}</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">{t("tourPageUnavailableBody")}</p>
        <Link
          href={`/r/${restaurantSlug}/order`}
          className="mt-6 inline-block px-6 py-3 rounded-full text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ background: "var(--brand)" }}
        >
          {t("tourPageBackToSite")}
        </Link>
      </div>
    </main>
  );
}
