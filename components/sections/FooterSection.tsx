"use client";

import Image from "next/image";
import { SectionProps } from "./SectionRenderer";

type SocialLink = {
  platform: string;
  url: string;
};

const PLATFORM_ICONS: Record<string, { label: string; path: string }> = {
  facebook: { label: "Facebook", path: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" },
  instagram: { label: "Instagram", path: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" },
  tiktok: { label: "TikTok", path: "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" },
  whatsapp: { label: "WhatsApp", path: "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" },
};

function SocialIcon({ platform }: { platform: string }) {
  const icon = PLATFORM_ICONS[platform.toLowerCase()];
  if (!icon) {
    return <span className="text-xs font-bold uppercase">{platform.slice(0, 2)}</span>;
  }
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d={icon.path} />
    </svg>
  );
}

/**
 * Footer section with restaurant info, contact, social links, and copyright.
 * Content: { show_logo, show_description, show_address, show_phone, show_hours, custom_text, social_links }
 * Settings: { color_style, custom_bg, custom_text }
 * Layout: columns | centered | minimal
 */
export function FooterSection({ section, restaurant }: SectionProps) {
  const content = section.content || {};
  const layout = section.layout || "columns";
  const colorStyle = section.settings?.color_style || "dark";

  const showLogo = content.show_logo !== false;
  const showDescription = content.show_description !== false;
  const showAddress = content.show_address !== false;
  const showPhone = content.show_phone !== false;
  const showHours = content.show_hours !== false;
  const customText = content.custom_text || "";
  const socialLinks: SocialLink[] = content.social_links || [];

  const colorClasses: Record<string, string> = {
    brand: "bg-[var(--brand)] text-white",
    light: "bg-[var(--surface)] text-[var(--text)]",
    dark: "bg-gray-900 text-gray-300",
  };

  const isCustom = colorStyle === "custom";
  const customStyle = isCustom ? { backgroundColor: section.settings?.custom_bg || "#1a1a2e", color: section.settings?.custom_text || "#d1d5db" } : undefined;
  const colorClass = isCustom ? "" : colorClasses[colorStyle] || colorClasses.dark;

  const year = new Date().getFullYear();
  const copyright =
    customText || `\u00A9 ${year} ${restaurant.name}. Powered by Foody.`;

  const socialBgClass =
    colorStyle === "brand" || colorStyle === "dark" || isCustom
      ? "bg-white/10 hover:bg-white/20"
      : "bg-[var(--surface-subtle)] hover:bg-[var(--brand)] hover:text-white";

  const socialIconLinks = socialLinks.length > 0 ? (
    <div className="flex items-center justify-center gap-4">
      {socialLinks.map((link, i) => (
        <a
          key={i}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={PLATFORM_ICONS[link.platform.toLowerCase()]?.label || link.platform}
          className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors ${socialBgClass}`}
        >
          <SocialIcon platform={link.platform} />
        </a>
      ))}
    </div>
  ) : null;

  if (layout === "minimal") {
    return (
      <footer
        className={`py-6 px-6 ${colorClass}`}
        style={customStyle}
      >
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          {showLogo && (
            <div className="flex items-center gap-2">
              {restaurant.logoUrl && (
                <Image
                  src={restaurant.logoUrl}
                  alt={restaurant.name}
                  width={28}
                  height={28}
                  className="rounded-full object-cover"
                />
              )}
              <span className="font-semibold text-sm">{restaurant.name}</span>
            </div>
          )}
          {socialIconLinks && <div>{socialIconLinks}</div>}
          <p className="text-xs opacity-60">{copyright}</p>
        </div>
      </footer>
    );
  }

  if (layout === "centered") {
    return (
      <footer
        className={`py-12 px-6 ${colorClass}`}
        style={customStyle}
      >
        <div className="max-w-4xl mx-auto text-center space-y-6">
          {showLogo && (
            <div className="flex items-center justify-center gap-3">
              {restaurant.logoUrl && (
                <Image
                  src={restaurant.logoUrl}
                  alt={restaurant.name}
                  width={40}
                  height={40}
                  className="rounded-full object-cover"
                />
              )}
              <span className="font-bold text-xl">{restaurant.name}</span>
            </div>
          )}
          {showDescription && restaurant.description && (
            <p className="text-sm opacity-75 max-w-md mx-auto">
              {restaurant.description}
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-4 text-sm opacity-75">
            {showAddress && restaurant.address && (
              <span>{restaurant.address}</span>
            )}
            {showPhone && restaurant.phone && (
              <a href={`tel:${restaurant.phone}`} className="hover:opacity-100 transition-opacity">{restaurant.phone}</a>
            )}
          </div>
          {showHours && restaurant.openingHours && (
            <p className="text-sm opacity-75 whitespace-pre-line">{restaurant.openingHours}</p>
          )}
          {socialIconLinks && <div>{socialIconLinks}</div>}
          <p className="text-xs opacity-50">{copyright}</p>
        </div>
      </footer>
    );
  }

  // Default: columns layout
  return (
    <footer
      className={`py-12 px-6 ${colorClass}`}
      style={customStyle}
    >
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Column 1: Brand */}
        <div className="space-y-3">
          {showLogo && (
            <div className="flex items-center gap-3">
              {restaurant.logoUrl && (
                <Image
                  src={restaurant.logoUrl}
                  alt={restaurant.name}
                  width={40}
                  height={40}
                  className="rounded-full object-cover"
                />
              )}
              <span className="font-bold text-lg">{restaurant.name}</span>
            </div>
          )}
          {showDescription && restaurant.description && (
            <p className="text-sm opacity-75 leading-relaxed">
              {restaurant.description}
            </p>
          )}
        </div>

        {/* Column 2: Contact */}
        <div className="space-y-3">
          <h4 className="font-semibold text-sm uppercase tracking-wider opacity-60">
            Contact
          </h4>
          {showAddress && restaurant.address && (
            <p className="text-sm opacity-75">{restaurant.address}</p>
          )}
          {showPhone && restaurant.phone && (
            <p className="text-sm opacity-75">{restaurant.phone}</p>
          )}
          {showHours && restaurant.openingHours && (
            <p className="text-sm opacity-75">{restaurant.openingHours}</p>
          )}
        </div>

        {/* Column 3: Social */}
        <div className="space-y-3">
          {socialLinks.length > 0 && (
            <>
              <h4 className="font-semibold text-sm uppercase tracking-wider opacity-60">
                Follow Us
              </h4>
              {socialIconLinks}
            </>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="max-w-6xl mx-auto mt-8 pt-6 border-t border-white/10">
        <p className="text-xs opacity-50 text-center">{copyright}</p>
      </div>
    </footer>
  );
}
