"use client";

import { Restaurant } from "@/lib/types";
import { SectionRenderer } from "@/components/sections/SectionRenderer";
import { useI18n } from "@/lib/i18n";
import { useRestaurantTheme } from "@/lib/restaurant-theme";
import Image from "next/image";
import Link from "next/link";

type Props = {
  restaurant: Restaurant;
};

export function RestaurantLanding({ restaurant }: Props) {
  const { direction } = useI18n();
  const { config } = useRestaurantTheme();
  const sections = restaurant.websiteSections || [];
  const wc = config;

  const heroLayout = wc?.heroLayout || "standard";
  const welcomeText = wc?.welcomeText || restaurant.name;
  const tagline = wc?.tagline || restaurant.description || "";
  const showAddress = wc?.showAddress ?? true;
  const showPhone = wc?.showPhone ?? true;
  const showHours = wc?.showHours ?? true;

  const slug = restaurant.slug || String(restaurant.id);

  // Determine order URL based on enabled services
  const orderUrl = `/r/${slug}/order`;

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text)]" dir={direction}>
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-40 bg-[var(--surface)]/95 backdrop-blur-md border-b border-[var(--divider)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
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
          <Link
            href={orderUrl}
            className="px-5 py-2.5 rounded-full bg-brand text-white font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Order Now
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      {heroLayout === "fullscreen" ? (
        <section className="relative h-screen flex items-center justify-center text-center">
          {restaurant.coverUrl && (
            <Image
              src={restaurant.coverUrl}
              alt={restaurant.name}
              fill
              className="object-cover"
              priority
            />
          )}
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative z-10 px-6 max-w-3xl">
            <h1 className="text-4xl sm:text-6xl font-bold text-white mb-4">{welcomeText}</h1>
            {tagline && <p className="text-lg sm:text-xl text-white/80 mb-8">{tagline}</p>}
            <Link
              href={orderUrl}
              className="inline-block px-8 py-4 rounded-full bg-brand text-white font-bold text-lg hover:opacity-90 transition-opacity"
            >
              Start Your Order
            </Link>
          </div>
        </section>
      ) : heroLayout === "minimal" ? (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
          {restaurant.logoUrl && (
            <Image
              src={restaurant.logoUrl}
              alt={restaurant.name}
              width={100}
              height={100}
              className="rounded-full object-cover mx-auto mb-6"
            />
          )}
          <h1 className="text-3xl sm:text-5xl font-bold mb-4">{welcomeText}</h1>
          {tagline && <p className="text-lg text-[var(--text-muted)] mb-8 max-w-xl mx-auto">{tagline}</p>}
          <Link
            href={orderUrl}
            className="inline-block px-8 py-4 rounded-full bg-brand text-white font-bold text-lg hover:opacity-90 transition-opacity"
          >
            Start Your Order
          </Link>
        </section>
      ) : (
        /* Standard layout */
        <section className="relative">
          {restaurant.coverUrl ? (
            <>
              <div className="relative h-[50vh] sm:h-[60vh]">
                <Image
                  src={restaurant.coverUrl}
                  alt={restaurant.name}
                  fill
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-12 max-w-6xl mx-auto">
                <h1 className="text-3xl sm:text-5xl font-bold text-white mb-3">{welcomeText}</h1>
                {tagline && <p className="text-lg text-white/80 mb-6 max-w-xl">{tagline}</p>}
                <Link
                  href={orderUrl}
                  className="inline-block px-8 py-4 rounded-full bg-brand text-white font-bold text-lg hover:opacity-90 transition-opacity"
                >
                  Start Your Order
                </Link>
              </div>
            </>
          ) : (
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
              <h1 className="text-3xl sm:text-5xl font-bold mb-4">{welcomeText}</h1>
              {tagline && <p className="text-lg text-[var(--text-muted)] mb-8 max-w-xl">{tagline}</p>}
              <Link
                href={orderUrl}
                className="inline-block px-8 py-4 rounded-full bg-brand text-white font-bold text-lg hover:opacity-90 transition-opacity"
              >
                Start Your Order
              </Link>
            </div>
          )}
        </section>
      )}

      {/* Website Sections */}
      {sections.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SectionRenderer sections={sections} restaurant={restaurant} />
        </div>
      )}

      {/* Mid-page CTA */}
      <section className="py-16 text-center">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            Ready to order?
          </h2>
          <p className="text-[var(--text-muted)] mb-8">
            Browse our menu and place your order for pickup or delivery.
          </p>
          <Link
            href={orderUrl}
            className="inline-block px-8 py-4 rounded-full bg-brand text-white font-bold text-lg hover:opacity-90 transition-opacity"
          >
            View Menu & Order
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--divider)] bg-[var(--surface)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Restaurant Info */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                {restaurant.logoUrl && (
                  <Image
                    src={restaurant.logoUrl}
                    alt={restaurant.name}
                    width={48}
                    height={48}
                    className="rounded-full object-cover"
                  />
                )}
                <h3 className="font-bold text-lg">{restaurant.name}</h3>
              </div>
              {restaurant.description && (
                <p className="text-sm text-[var(--text-muted)] mb-4">{restaurant.description}</p>
              )}
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-semibold mb-3">Contact</h4>
              {showAddress && restaurant.address && (
                <p className="text-sm text-[var(--text-muted)] mb-2 flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {restaurant.address}
                </p>
              )}
              {showPhone && restaurant.phone && (
                <p className="text-sm text-[var(--text-muted)] mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <a href={`tel:${restaurant.phone}`} className="hover:text-brand transition-colors">
                    {restaurant.phone}
                  </a>
                </p>
              )}
            </div>

            {/* Hours */}
            {showHours && restaurant.openingHours && (
              <div>
                <h4 className="font-semibold mb-3">Hours</h4>
                <p className="text-sm text-[var(--text-muted)] whitespace-pre-line">
                  {restaurant.openingHours}
                </p>
              </div>
            )}
          </div>

          {/* Social Links */}
          {wc?.socialLinks && Object.keys(wc.socialLinks).length > 0 && (
            <div className="mt-8 pt-8 border-t border-[var(--divider)] flex items-center gap-4">
              {Object.entries(wc.socialLinks).map(([platform, url]) => {
                if (!url) return null;
                return (
                  <a
                    key={platform}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-[var(--surface-subtle)] flex items-center justify-center text-[var(--text-muted)] hover:text-brand hover:bg-[var(--surface-elevated)] transition-all"
                    title={platform}
                  >
                    <span className="text-xs font-bold uppercase">{platform.slice(0, 2)}</span>
                  </a>
                );
              })}
            </div>
          )}

          {/* Copyright */}
          <div className="mt-8 pt-8 border-t border-[var(--divider)] text-center text-sm text-[var(--text-soft)]">
            <p>&copy; {new Date().getFullYear()} {restaurant.name}. Powered by Foody.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
