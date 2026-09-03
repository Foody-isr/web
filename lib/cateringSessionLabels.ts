import type { Locale } from "@/lib/i18n";
import { formatLongDateLabel } from "@/lib/scheduling";

type SessionLabelSource = {
  label?: string;
  date?: string;
};

/** Human-readable date used everywhere a catering session is presented. */
export function cateringSessionDate(
  session: SessionLabelSource,
  locale: Locale,
): string {
  return formatLongDateLabel(session.date ?? "", locale);
}

/**
 * Keeps a meaningful Admin-authored session name, but never exposes an ISO date
 * that was temporarily stored as the session label by the search journey.
 */
export function cateringSessionTitle(
  session: SessionLabelSource,
  locale: Locale,
): string {
  const label = session.label?.trim() ?? "";
  const date = cateringSessionDate(session, locale);
  if (!label || label === session.date) return date || label;
  return label;
}

/** Compact label that guarantees the date remains visible exactly once. */
export function cateringSessionSummary(
  session: SessionLabelSource,
  locale: Locale,
): string {
  const title = cateringSessionTitle(session, locale);
  const date = cateringSessionDate(session, locale);
  if (!date || title === date) return title;
  return `${title} · ${date}`;
}
