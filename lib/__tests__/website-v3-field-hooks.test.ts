import assert from "node:assert/strict";
import { test } from "node:test";
import type { Restaurant, WebsiteSection } from "@/lib/types";
import type { WebsiteV3Page } from "@/lib/websiteV3Api";
import {
  websiteV3PageFieldHooks,
  websiteV3SectionFieldHooks,
} from "@/lib/websiteV3FieldHooks";

test("page hooks serialize canonical site and page values deterministically", () => {
  const restaurant = {
    websiteConfig: {
      themeId: "editorial-dark",
      pairingId: "modern-sans",
      brandColor: "#1a2b3c",
      logoSize: 64,
      navbarLogoPosition: "center",
      heroLogoSize: 125,
      navbarCta: { enabled: true, text: "Réserver E2E" },
      checkoutConfig: { note: "connected checkout" },
    },
  } as unknown as Restaurant;
  const page = {
    type: "order",
    title: "Order E2E",
    slug: "order-e2e",
    sort_order: 3,
    nav_visible: false,
    is_default: true,
    seo: { title: "SEO E2E" },
    appearance_overrides: { bg: "#f1e2d3" },
    settings: { menu_ids: [12, 15] },
  } as unknown as WebsiteV3Page;

  const hooks = websiteV3PageFieldHooks(restaurant, page);
  assert.equal(hooks["data-field-site-brand-color"], "#1a2b3c");
  assert.equal(hooks["data-field-site-navbar-cta"], "Réserver E2E");
  assert.equal(hooks["data-field-site-logo-size"], "64");
  assert.equal(hooks["data-field-site-navbar-logo-position"], "center");
  assert.equal(hooks["data-field-site-hero-logo-size"], "125");
  assert.equal(
    hooks["data-field-site-checkout-config"],
    '{"note":"connected checkout"}',
  );
  assert.equal(hooks["data-field-page-title"], "Order E2E");
  assert.equal(hooks["data-field-page-nav-visible"], "false");
  assert.equal(hooks["data-field-page-settings-menu-ids"], "[12,15]");
  assert.equal(hooks["data-field-page-seo-title"], undefined);
});

test("section hooks expose content and settings consumed by the renderer", () => {
  const section = {
    page: "about",
    sortOrder: 2,
    isVisible: true,
    layout: "split",
    content: { title: "Connected title", social_links: [{ platform: "instagram", url: "https://example.test" }] },
    settings: { color_style: "custom", custom_bg: "#213547" },
  } as unknown as WebsiteSection;

  const hooks = websiteV3SectionFieldHooks(section);
  assert.equal(hooks["data-field-section-layout"], "split");
  assert.equal(hooks["data-field-section-content-title"], "Connected title");
  assert.equal(
    hooks["data-field-section-content-social-links"],
    '[{"platform":"instagram","url":"https://example.test"}]',
  );
  assert.equal(hooks["data-field-section-settings-custom-bg"], "#213547");
});
