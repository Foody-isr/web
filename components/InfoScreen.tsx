"use client";

import { Restaurant, OrderPageModalSection, OrderType } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { useRestaurantTheme } from "@/lib/restaurant-theme";
import { modalSectionsFor } from "@/lib/orderPageInfo";
import {
  DAY_KEYS,
  type DayKey,
  checkRestaurantAvailability,
  restaurantWeekday,
} from "@/lib/availability";
import { useEffect } from "react";
import Image from "next/image";

type Props = {
  open: boolean;
  onClose: () => void;
  restaurant: Restaurant;
  /** Which service the hours are shown for. Defaults to dine-in. */
  orderType?: OrderType;
};

// Social platforms shown in the "Réseaux sociaux" modal section (email lives in
// Contact). Each entry knows its icon and how to turn a handle into a URL.
const SOCIAL_PLATFORMS: { key: string; label: string; icon: string; href: (v: string) => string }[] = [
  { key: "instagram", label: "Instagram", icon: "📷", href: (v) => (/^https?:\/\//i.test(v) ? v : `https://instagram.com/${v.replace(/^@/, "")}`) },
  { key: "whatsapp", label: "WhatsApp", icon: "💬", href: (v) => (/^https?:\/\//i.test(v) ? v : `https://wa.me/${v.replace(/[^\d]/g, "")}`) },
  { key: "facebook", label: "Facebook", icon: "👍", href: (v) => (/^https?:\/\//i.test(v) ? v : `https://facebook.com/${v}`) },
  { key: "tiktok", label: "TikTok", icon: "🎵", href: (v) => (/^https?:\/\//i.test(v) ? v : `https://tiktok.com/@${v.replace(/^@/, "")}`) },
  { key: "twitter", label: "X", icon: "𝕏", href: (v) => (/^https?:\/\//i.test(v) ? v : `https://x.com/${v.replace(/^@/, "")}`) },
  { key: "youtube", label: "YouTube", icon: "▶️", href: (v) => (/^https?:\/\//i.test(v) ? v : `https://youtube.com/${v}`) },
];

/**
 * Restaurant About / Info panel — slides in from the right when the customer
 * taps the "Plus →" pill on the hero. Full-bleed over the menu beneath.
 *
 * Sections:
 *   • À propos        — restaurant description
 *   • Horaires        — week schedule with today highlighted, Open/Closed pill
 *   • Adresse         — stylised map placeholder + street + Itinéraire button
 *   • Contact         — phone / email / instagram as tappable cards
 *   • Propulsé par Foody
 */
export function InfoScreen({ open, onClose, restaurant, orderType }: Props) {
  const { t, direction, locale } = useI18n();
  const { config: themeConfig } = useRestaurantTheme();
  const isRTL = direction === "rtl";

  // ESC closes — accessibility nicety
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // "Today" and "open now" are the restaurant's, not the visitor's: this panel
  // used to read the browser clock and always the dine-in schedule, so it could
  // claim "Open now" while the storefront banner said the opposite.
  const service: OrderType = orderType ?? "dine_in";
  const todayIdx = DAY_KEYS.indexOf(restaurantWeekday(restaurant));
  const isOpenNow = restaurant.openingHoursConfig
    ? checkRestaurantAvailability(restaurant, service).isOpen
    : null;

  const dayLabel = (key: DayKey): string => {
    const map: Record<DayKey, string> = {
      sunday: t("daySunday") || "Sunday",
      monday: t("dayMonday") || "Monday",
      tuesday: t("dayTuesday") || "Tuesday",
      wednesday: t("dayWednesday") || "Wednesday",
      thursday: t("dayThursday") || "Thursday",
      friday: t("dayFriday") || "Friday",
      saturday: t("daySaturday") || "Saturday",
    };
    return map[key];
  };

  const cfg = restaurant.openingHoursConfig;

  // Which sections to show, from the website-builder config (falls back to the
  // default set when unconfigured). A section renders only when it's enabled
  // AND has data.
  // From the resolved theme config so the builder's live preview updates
  // instantly; falls back to the static prop for the customer page.
  const orderPageInfo = themeConfig?.orderPageInfo ?? restaurant.websiteConfig?.orderPageInfo;
  const enabledSections = modalSectionsFor(orderPageInfo);
  const has = (key: OrderPageModalSection) => enabledSections.includes(key);
  const social = (restaurant.websiteConfig?.socialLinks ?? {}) as Record<string, string | undefined>;
  const socialEntries = SOCIAL_PLATFORMS.filter((p) => social[p.key]?.trim());
  const modalText = orderPageInfo?.modalText?.trim();

  return (
    <>
      {/* Desktop backdrop — only visible when the panel is a side drawer */}
      <div
        aria-hidden
        onClick={onClose}
        className={`hidden sm:block fixed inset-0 z-[69] bg-black/45 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />
      <div
        aria-hidden={!open}
        role="dialog"
        aria-label={t("aboutRestaurant") || "About this restaurant"}
        className="fixed top-0 bottom-0 inset-x-0 sm:inset-x-auto sm:end-0 sm:start-auto sm:w-[440px] sm:max-w-[90vw] z-[70] flex flex-col bg-[var(--bg-page)] transition-transform duration-300"
        style={{
          transform: open
            ? "translateX(0)"
            : isRTL
              ? "translateX(-100%)"
              : "translateX(100%)",
          pointerEvents: open ? "auto" : "none",
          boxShadow: open ? "-12px 0 30px rgba(30,44,24,0.18)" : "none",
          willChange: "transform",
        }}
        dir={direction}
      >
      {/* Hero strip with back button */}
      <div className="relative h-44 sm:h-52 flex-shrink-0 overflow-hidden">
        {restaurant.coverUrl ? (
          <Image
            src={restaurant.coverUrl}
            alt={restaurant.name}
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-brand to-brand-dark" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none" />

        {/* Back chevron */}
        <button
          onClick={onClose}
          aria-label={t("back") || "Back"}
          className="absolute top-4 start-4 w-11 h-11 rounded-full bg-white/95 shadow-[0_4px_12px_rgba(0,0,0,0.18)] flex items-center justify-center hover:bg-white active:scale-[0.96] transition"
        >
          <svg className="w-4 h-4 text-[var(--text-primary)] rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m14 6-6 6 6 6" />
          </svg>
        </button>

        {/* Title bottom-aligned */}
        <div
          className={`absolute bottom-4 inset-x-0 px-5 sm:px-7 ${isRTL ? "text-right" : "text-left"}`}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/80 drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]">
            {t("aboutPrefix") || "À propos de"}
          </p>
          <h1 className="text-[26px] sm:text-[30px] font-extrabold leading-none tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.55)] mt-1">
            {restaurant.name}
          </h1>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 sm:px-7 pt-5 pb-8 space-y-6">
        {/* About */}
        {has("about") && (restaurant.description || restaurant.websiteConfig?.tagline) && (
          <Section icon="ℹ️" title={t("about") || "À propos"}>
            <p className="text-[14px] text-[var(--text-primary)] leading-relaxed font-medium">
              {restaurant.description || restaurant.websiteConfig?.tagline}
            </p>
          </Section>
        )}

        {/* Hours */}
        {has("hours") && cfg && (
          <Section
            icon="🕐"
            title={t("openingHours") || "Opening hours"}
            statusPill={
              isOpenNow === null
                ? undefined
                : isOpenNow
                  ? { label: t("openNow") || "Open now", tone: "open" }
                  : { label: t("closed") || "Closed", tone: "closed" }
            }
          >
            <div className="rounded-2xl overflow-hidden bg-[var(--surface)] border border-[var(--divider)]">
              {DAY_KEYS.map((key, i) => {
                const slot = cfg[service]?.[key];
                const isToday = i === todayIdx;
                const closed = !slot || slot.closed;
                return (
                  <div
                    key={key}
                    className={`flex items-center justify-between gap-3 px-4 py-3 ${
                      i < DAY_KEYS.length - 1 ? "border-b border-[var(--divider)]" : ""
                    } ${isToday ? "bg-brand/10" : ""}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`text-[14px] ${isToday ? "font-extrabold" : "font-semibold"} text-[var(--text-primary)]`}
                      >
                        {dayLabel(key)}
                      </span>
                      {isToday && (
                        <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-brand">
                          · {t("today") || "Today"}
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[14px] font-bold tabular-nums ${
                        closed ? "text-red-600" : "text-[var(--text-primary)]"
                      }`}
                    >
                      {closed ? t("closed") || "Closed" : `${slot!.open} – ${slot!.close}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Address */}
        {has("address") && restaurant.address && (
          <Section icon="📍" title={t("address") || "Adresse"}>
            <div className="rounded-2xl overflow-hidden bg-[var(--surface)] border border-[var(--divider)]">
              <MapPlaceholder />
              <div className="flex items-start gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-extrabold text-[var(--text-primary)]">
                    {restaurant.address}
                  </p>
                </div>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(restaurant.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-brand text-white text-[12px] font-extrabold active:scale-[0.96] transition"
                >
                  <span>🧭</span>
                  {t("directions") || "Directions"}
                </a>
              </div>
            </div>
          </Section>
        )}

        {/* Contact */}
        {has("contact") && (restaurant.phone || social.email) && (
          <Section icon="📞" title={t("contact") || "Contact"}>
            <div className="flex flex-col gap-2">
              {restaurant.phone && (
                <ContactCard
                  icon="📞"
                  label={t("phone") || "Phone"}
                  value={restaurant.phone}
                  href={`tel:${restaurant.phone.replace(/\s/g, "")}`}
                />
              )}
              {social.email && (
                <ContactCard
                  icon="✉️"
                  label={t("email") || "Email"}
                  value={social.email}
                  href={`mailto:${social.email}`}
                />
              )}
            </div>
          </Section>
        )}

        {/* Social networks */}
        {has("social") && socialEntries.length > 0 && (
          <Section icon="🔗" title={t("socialNetworks") || "Réseaux sociaux"}>
            <div className="flex flex-col gap-2">
              {socialEntries.map((p) => (
                <ContactCard
                  key={p.key}
                  icon={p.icon}
                  label={p.label}
                  value={social[p.key] as string}
                  href={p.href((social[p.key] as string).trim())}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Custom text */}
        {has("custom_text") && modalText && (
          <Section icon="📝" title={t("moreInfo") || "Infos"}>
            <p className="text-[14px] text-[var(--text-primary)] leading-relaxed font-medium whitespace-pre-line">
              {modalText}
            </p>
          </Section>
        )}

        {/* Footer credit */}
        <p className="text-center text-[11px] text-[var(--text-soft)] font-semibold pt-2">
          {locale === "fr" ? "Propulsé par " : locale === "he" ? "מופעל על ידי " : "Powered by "}
          <span className="font-extrabold text-brand">Foody</span>
        </p>
      </div>
    </div>
    </>
  );
}

/* ──────────────────────────── Section ─────────────────────────────────── */

function Section({
  icon,
  title,
  statusPill,
  children,
}: {
  icon: string;
  title: string;
  statusPill?: { label: string; tone: "open" | "closed" };
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2.5 px-1">
        <span className="text-base">{icon}</span>
        <h3 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--text-soft)]">
          {title}
        </h3>
        {statusPill && (
          <span
            className={`ms-auto inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-full text-[10px] font-extrabold ${
              statusPill.tone === "open"
                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                : "bg-red-50 text-red-700 ring-1 ring-red-200"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                statusPill.tone === "open" ? "bg-emerald-600" : "bg-red-600"
              }`}
            />
            {statusPill.label}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

/* ──────────────────────────── Contact Card ────────────────────────────── */

function ContactCard({
  icon,
  label,
  value,
  href,
}: {
  icon: string;
  label: string;
  value: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
      className="flex items-center gap-3 px-3.5 py-3 rounded-2xl bg-[var(--surface)] border border-[var(--divider)] hover:bg-[var(--surface-subtle)] active:scale-[0.99] transition no-underline"
    >
      <span className="flex-shrink-0 w-9 h-9 rounded-xl bg-brand/12 flex items-center justify-center text-base">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--text-soft)]">
          {label}
        </p>
        <p className="text-[14px] font-bold text-[var(--text-primary)] mt-0.5 truncate">{value}</p>
      </div>
      <svg className="w-3.5 h-3.5 text-[var(--text-soft)] rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" />
      </svg>
    </a>
  );
}

/* ───────────────────────── Map Placeholder ────────────────────────────── */

function MapPlaceholder() {
  return (
    <div
      className="relative h-36 overflow-hidden"
      style={{ background: "linear-gradient(180deg, var(--surface-subtle) 0%, var(--surface-subtle) 100%)" }}
    >
      <svg
        viewBox="0 0 360 140"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full"
        aria-hidden
      >
        {/* Block tiles */}
        <g fill="var(--surface)" opacity="0.65">
          <rect x="0" y="0" width="120" height="60" />
          <rect x="130" y="0" width="110" height="60" />
          <rect x="250" y="0" width="110" height="60" />
          <rect x="0" y="70" width="90" height="70" />
          <rect x="100" y="70" width="140" height="70" />
          <rect x="250" y="70" width="110" height="70" />
        </g>
        {/* Roads */}
        <g stroke="var(--divider)" strokeWidth="6" fill="none">
          <line x1="0" y1="65" x2="360" y2="65" />
          <line x1="125" y1="0" x2="125" y2="140" />
          <line x1="245" y1="0" x2="245" y2="140" />
          <line x1="95" y1="65" x2="95" y2="140" />
        </g>
        {/* Pin */}
        <g transform="translate(180 75)">
          <circle r="22" fill="color-mix(in srgb, var(--brand) 18%, transparent)" />
          <circle r="14" fill="color-mix(in srgb, var(--brand) 32%, transparent)" />
          <circle r="8" fill="var(--brand)" />
          <circle r="3" fill="#fff" />
        </g>
      </svg>
      <span className="absolute top-2.5 start-3 inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/85 text-[10px] font-extrabold uppercase tracking-[0.1em] text-[var(--text-soft)]">
        Carte
      </span>
    </div>
  );
}
