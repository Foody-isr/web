"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import { websiteContentUrl, websiteMediaUrl } from "@/lib/websiteComponents";
import { resolveRestaurantWebsiteHref } from "@/lib/restaurantWebsiteLink";
import type { SectionProps } from "./SectionRenderer";
import { getSectionBg } from "./sectionBg";
import { websiteV3SectionFieldHooks } from "@/lib/websiteV3FieldHooks";
import {
  styleVariables,
  type CSSVariableStyle,
} from "@/lib/websiteV3Appearance";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { footerCopy } from "@/lib/footerCopy";
import { usePreviewMode } from "@/lib/preview-mode";
import { submitWebsiteForm } from "@/services/api";
import {
  headerTargetHref,
  normalizeWebsiteHeader,
  type HeaderLink,
} from "@/lib/websiteHeader";
import { getFieldStyle } from "./typography";
import { contrastInk } from "@/lib/themes/contrastInk";

const PLATFORM_ICONS: Record<string, { label: string; path: string }> = {
  youtube: {
    label: "YouTube",
    path: "M23 7a3 3 0 0 0-2-2C18 4 6 4 3 5a3 3 0 0 0-2 2c-1 3-1 7 0 10a3 3 0 0 0 2 2c3 1 15 1 18 0a3 3 0 0 0 2-2c1-3 1-7 0-10ZM10 8l6 4-6 4Z",
  },
  linkedin: {
    label: "LinkedIn",
    path: "M3 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM1 8h4v14H1ZM8 8h4v2c1-2 3-3 5-3 4 0 6 2 6 6v9h-4v-8c0-2-1-3-3-3s-4 2-4 4v7H8Z",
  },
  x: {
    label: "X",
    path: "M18 2h4l-8 9 9 11h-7l-6-8-7 8H0l9-10L0 2h7l6 7ZM5 4l12 16h2L6 4Z",
  },
  pinterest: {
    label: "Pinterest",
    path: "M12 1a11 11 0 0 0-4 21l2-8c-1-2-1-5 1-6 2-1 3 0 2 3l-1 4c-1 3 3 3 5 0 2-4 0-9-5-9-6 0-8 7-5 9l-1 2C1 15 2 4 11 3c10-1 13 9 8 15-2 3-6 4-8 1l-1 4 2 0A11 11 0 0 0 12 1Z",
  },
  facebook: {
    label: "Facebook",
    path: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
  },
  instagram: {
    label: "Instagram",
    path: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z",
  },
  tiktok: {
    label: "TikTok",
    path: "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z",
  },
  whatsapp: {
    label: "WhatsApp",
    path: "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z",
  },
};

function SocialIcon({ platform }: { platform: string }) {
  const icon = PLATFORM_ICONS[platform.toLowerCase()];
  if (!icon) {
    return (
      <span className="text-xs font-bold uppercase">
        {platform.slice(0, 2)}
      </span>
    );
  }
  return (
    <svg
      className="w-5 h-5"
      viewBox="0 0 24 24"
      fill="currentColor"
      fillRule="evenodd"
    >
      <path d={icon.path} />
    </svg>
  );
}

/** Maps footer settings to variables scoped to one rendered footer section. */
export function footerStyleVariables(
  settings: Record<string, unknown> | null | undefined,
): CSSVariableStyle {
  return styleVariables(settings, [
    ["custom_bg", "--footer-bg"],
    ["custom_text", "--footer-text"],
    ["custom_muted", "--footer-muted"],
    ["custom_accent", "--footer-accent"],
    ["custom_divider", "--footer-divider"],
  ]);
}

/** Renders the shared Footer in columns or centered form, with optional restaurant content. */
export function FooterSection({ section, restaurant }: SectionProps) {
  const { locale, t } = useI18n(),
    c = footerCopy(locale);
  const content = section.content || {},
    settings = section.settings || {};
  const centered = section.layout === "centered",
    minimal = section.layout === "minimal";
  const bg = getSectionBg(
    {
      ...settings,
      bg_image:
        settings.background_mode && settings.background_mode !== "image"
          ? ""
          : websiteMediaUrl(settings.bg_image),
    },
    "default",
  );
  const shared =
    /^style-[1-6]$/.test(settings.color_style) ||
    ["default", "site"].includes(settings.color_style ?? "default");
  const palette = shared ? {} : footerStyleVariables(settings);
  const style: CSSProperties = {
    ...bg.style,
    ...palette,
    ...(palette["--footer-text"] ? { color: "var(--footer-text)" } : {}),
    ...(settings.background_mode === "color" ||
    settings.background_mode === "gradient" ||
    palette["--footer-bg"]
      ? { backgroundColor: settings.custom_bg || "var(--footer-bg)" }
      : {}),
    ...(settings.background_mode === "gradient"
      ? {
          backgroundImage: `linear-gradient(135deg, ${settings.custom_bg || "#ffffff"}, ${settings.gradient_end || "#111111"})`,
        }
      : {}),
  };
  const mutedStyle = palette["--footer-muted"]
    ? { color: "var(--footer-muted)" }
    : undefined;
  const config = restaurant.websiteConfig;
  const pages = config?.pages ?? [],
    slug = restaurant.slug || String(restaurant.id);
  const header = config?.navLayout?.header
    ? normalizeWebsiteHeader(config.navLayout.header)
    : null;
  const authored = Array.isArray(content.navigation_links)
    ? (content.navigation_links as HeaderLink[])
    : null;
  const sameHeader =
    content.same_as_header ?? (!authored && !Array.isArray(content.links));
  const inherited: HeaderLink[] = header
    ? header.navigation.enabled
      ? header.navigation.links
      : []
    : pages
        .filter((page) => page.showInNav !== false)
        .map((page, index) => ({
          id: String(index),
          label: page.label || page.slug,
          target: { kind: "page", value: page.slug },
        }));
  const safeLinks = (links: HeaderLink[]) =>
    links.flatMap((link) => {
      if (
        !link ||
        typeof link.label !== "string" ||
        !link.target ||
        typeof link.target !== "object"
      )
        return [];
      const href = headerTargetHref(
        link.target,
        slug,
        pages,
        restaurant.cateringOnly ? "/catering" : "/order",
      );
      return href
        ? [
            {
              id: link.id,
              label: link.label,
              href,
              newTab: link.target.new_tab === true,
            },
          ]
        : [];
    });
  const legacyLinks = (
    Array.isArray(content.links) ? content.links : []
  ).flatMap((link: { label?: string; url?: string }) => {
    const url = websiteContentUrl(link?.url),
      href = url && resolveRestaurantWebsiteHref(url, slug);
    return href && typeof link.label === "string"
      ? [{ id: href, label: link.label, href, newTab: false }]
      : [];
  });
  const navigation =
    content.show_navigation !== false
      ? sameHeader
        ? safeLinks(inherited)
        : authored
          ? safeLinks(authored)
          : legacyLinks
      : [];
  const external =
    content.show_external_links !== false
      ? safeLinks(
          Array.isArray(content.external_links) ? content.external_links : [],
        )
      : [];
  const nav = navigation.length ? (
    <nav
      aria-label={c.navigation}
      className={`flex flex-wrap gap-x-7 gap-y-4 text-sm ${centered ? "justify-center" : ""}`}
    >
      {navigation.map((link, i) => (
        <a
          key={i}
          href={link.href}
          target={link.newTab ? "_blank" : undefined}
          rel={link.newTab ? "noopener noreferrer" : undefined}
          className="hover:underline underline-offset-4"
        >
          {link.label}
        </a>
      ))}
    </nav>
  ) : null;
  const logoImage = websiteMediaUrl(content.logo_image || restaurant.logoUrl),
    logoType = content.logo_type ?? (logoImage ? "image" : "text");
  const logoSize =
    content.logo_size === "small"
      ? 36
      : content.logo_size === "large"
        ? 96
        : 64;
  const logo =
    content.show_logo !== false ? (
      <a
        href={`/r/${encodeURIComponent(slug)}`}
        className="inline-flex items-center"
        style={{ color: content.logo_color || undefined }}
      >
        {logoType === "image" && logoImage ? (
          <Image
            src={logoImage}
            alt={restaurant.name}
            width={logoSize}
            height={logoSize}
            className="object-contain"
            style={{ width: logoSize, height: logoSize }}
          />
        ) : (
          <span
            className="font-bold"
            style={{
              fontSize:
                content.logo_size === "small"
                  ? 18
                  : content.logo_size === "large"
                    ? 32
                    : 24,
            }}
          >
            {String(content.logo_text || restaurant.name)}
          </span>
        )}
      </a>
    ) : null;
  const details = (
    <div className="space-y-3 text-sm" style={mutedStyle}>
      {content.show_description !== false && restaurant.description && (
        <p className="whitespace-pre-line">{restaurant.description}</p>
      )}
      {content.show_address !== false && restaurant.address && (
        <p data-contact-address>{restaurant.address}</p>
      )}
      {content.show_phone !== false && restaurant.phone && (
        <a
          data-contact-phone
          className="block hover:underline"
          href={`tel:${restaurant.phone}`}
        >
          {restaurant.phone}
        </a>
      )}
      {content.show_hours !== false && restaurant.openingHours && (
        <p data-contact-hours className="whitespace-pre-line">
          {restaurant.openingHours}
        </p>
      )}
    </div>
  );
  const social =
    content.show_social !== false && Array.isArray(content.social_links)
      ? content.social_links.flatMap(
          (link: { platform?: string; url?: string }) => {
            const url = websiteContentUrl(link?.url);
            return url &&
              /^https?:\/\//i.test(url) &&
              typeof link.platform === "string"
              ? [{ url, platform: link.platform }]
              : [];
          },
        )
      : [];
  const socialColors: Record<string, string> = {
    facebook: "#1877f2",
    instagram: "#c13584",
    whatsapp: "#168d44",
    tiktok: "#111111",
    pinterest: "#bd081c",
    youtube: "#c4302b",
    linkedin: "#0077b5",
    x: "#111111",
  };
  const socialLinks = social.length ? (
    <div
      data-social-links
      className={`flex flex-wrap gap-2 ${centered ? "justify-center" : ""}`}
    >
      {social.map((link, i) => (
        <a
          key={i}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={PLATFORM_ICONS[link.platform]?.label || link.platform}
          className="inline-flex items-center justify-center min-w-11 min-h-11 rounded-full hover:opacity-75"
          style={{
            color:
              content.social_color === "light"
                ? "#ffffff"
                : content.social_color === "dark"
                  ? "#111111"
                  : content.social_color === "main"
                    ? "var(--brand)"
                    : content.social_color === "social"
                      ? socialColors[link.platform]
                      : palette["--footer-accent"]
                        ? "var(--footer-accent)"
                        : undefined,
          }}
        >
          <SocialIcon platform={link.platform} />
        </a>
      ))}
    </div>
  ) : null;
  const methods =
    content.show_payment_methods === true &&
    Array.isArray(content.payment_methods)
      ? content.payment_methods.filter(
          (method: unknown): method is string =>
            typeof method === "string" &&
            ["Visa", "Mastercard", "Amex"].includes(method),
        )
      : [];
  const copyright = String(
    content.custom_text || `© ${new Date().getFullYear()} ${restaurant.name}`,
  );
  const subscription =
    content.show_subscription === true ||
    content.show_subscription_title === true ? (
      <div className={`space-y-4 ${centered ? "max-w-md mx-auto w-full" : ""}`}>
        {content.show_subscription_title === true && (
          <p
            className="text-lg"
            style={{
              ...getFieldStyle(
                { subscription_title_size: "md", ...settings },
                "subscription_title",
              ),
              color: content.subscription_title_color || undefined,
            }}
          >
            {String(content.subscription_title || c.stayLoop)}
          </p>
        )}
        {content.show_subscription === true && (
          <FooterSubscription section={section} restaurant={restaurant} />
        )}
      </div>
    ) : null;
  return (
    <footer
      {...websiteV3SectionFieldHooks(section)}
      data-footer-layout={
        minimal ? "minimal" : centered ? "centered" : "columns"
      }
      className={`relative px-6 md:px-12 ${minimal ? "py-6" : "py-14 md:py-20"} ${bg.className}`}
      style={style}
    >
      <div className="max-w-6xl mx-auto">
        <div
          className={
            centered
              ? "text-center space-y-8"
              : minimal
                ? "flex flex-wrap items-center justify-between gap-8"
                : "grid md:grid-cols-2 gap-10 md:gap-20"
          }
        >
          <div className="space-y-6">
            {logo}
            {nav}
            {details}
          </div>
          {subscription}
        </div>
        <div
          className={`mt-10 pt-7 border-t border-current/20 ${centered ? "text-center space-y-5" : "grid md:grid-cols-2 gap-6 md:gap-20"}`}
          style={
            palette["--footer-divider"]
              ? { borderColor: "var(--footer-divider)" }
              : undefined
          }
        >
          <div
            className={`flex flex-wrap items-center gap-2 ${centered ? "justify-center" : ""}`}
          >
            {methods.map((method: string) => (
              <span
                key={method}
                aria-label={method}
                className="inline-flex h-7 w-11 items-center justify-center rounded border border-current/20 bg-white"
              >
                <svg
                  viewBox="0 0 44 28"
                  className="h-7 w-11"
                  aria-hidden="true"
                >
                  {method === "Mastercard" ? (
                    <>
                      <circle cx="17" cy="14" r="9" fill="#eb001b" />
                      <circle
                        cx="27"
                        cy="14"
                        r="9"
                        fill="#f79e1b"
                        fillOpacity="0.9"
                      />
                    </>
                  ) : method === "Amex" ? (
                    <>
                      <rect width="44" height="28" rx="3" fill="#2375bb" />
                      <text
                        x="22"
                        y="18"
                        textAnchor="middle"
                        fontFamily="Arial, sans-serif"
                        fontSize="11"
                        fontWeight="700"
                        fill="white"
                      >
                        AMEX
                      </text>
                    </>
                  ) : (
                    <text
                      x="22"
                      y="19"
                      textAnchor="middle"
                      fontFamily="Arial, sans-serif"
                      fontSize="16"
                      fontWeight="800"
                      fontStyle="italic"
                      fill="#1434cb"
                    >
                      VISA
                    </text>
                  )}
                </svg>
              </span>
            ))}
          </div>
          <div className="space-y-4">
            {socialLinks}
            {external.length > 0 && (
              <nav
                aria-label={c.external}
                style={getFieldStyle(settings, "external")}
                className={`flex flex-wrap gap-5 text-sm ${centered ? "justify-center" : ""}`}
              >
                {external.map((link, i) => (
                  <a
                    key={i}
                    href={link.href}
                    target={link.newTab ? "_blank" : undefined}
                    rel={link.newTab ? "noopener noreferrer" : undefined}
                    className="underline underline-offset-4"
                  >
                    {link.label}
                  </a>
                ))}
              </nav>
            )}
            <p
              data-footer-text
              className="text-sm"
              style={{
                ...mutedStyle,
                ...getFieldStyle(settings, "external"),
                display:
                  content.show_external_links === false ? "none" : undefined,
              }}
            >
              {copyright}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

/** Saves a footer email subscription with explicit success, retry and preview states. */
export function FooterSubscription({ section, restaurant }: SectionProps) {
  const { locale, t } = useI18n(),
    c = footerCopy(locale),
    preview = usePreviewMode();
  const [status, setStatus] = useState<"idle" | "sending" | "saved" | "failed">(
    "idle",
  );
  const content = section.content;
  if (status === "saved")
    return (
      <p role="status">
        {String(content.subscription_confirmation || c.thanks)}
      </p>
    );
  return (
    <form
      aria-label={String(content.subscription_name || c.subscription)}
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (preview || status === "sending") return;
        const data = new FormData(event.currentTarget);
        setStatus("sending");
        try {
          await submitWebsiteForm(
            restaurant.slug || String(restaurant.id),
            section.id,
            { email: String(data.get("email") ?? "") },
            String(data.get("_website") ?? ""),
          );
          setStatus("saved");
        } catch {
          setStatus("failed");
        }
      }}
    >
      <input
        type="text"
        name="_website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />
      <div className="flex border border-current/30 rounded-[var(--site-button-radius,8px)] overflow-hidden">
        <input
          aria-label={c.email}
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          placeholder={String(content.subscription_placeholder || c.email)}
          className="min-w-0 w-full bg-transparent px-4 py-3"
        />
        <button
          type="submit"
          disabled={preview || status === "sending"}
          className="shrink-0 px-5 py-3 font-semibold disabled:opacity-60"
          style={
            content.subscription_style === "outline"
              ? {
                  color: content.subscription_color || "currentColor",
                  borderInlineStart: "1px solid currentColor",
                }
              : {
                  background:
                    content.subscription_color ||
                    "var(--site-solid, var(--brand))",
                  color: /^#[a-f\d]{6}$/i.test(content.subscription_color || "")
                    ? contrastInk(content.subscription_color)
                    : "var(--site-solid-ink, var(--on-brand, white))",
                }
          }
        >
          {status === "sending"
            ? t("websiteFormSending")
            : String(content.subscription_button || c.signup)}
        </button>
      </div>
      <p className="text-xs opacity-70">{c.consent}</p>
      {preview && (
        <p className="text-xs opacity-70">{t("websiteFormPreview")}</p>
      )}
      {status === "failed" && <p role="alert">{t("websiteFormFailed")}</p>}
    </form>
  );
}
