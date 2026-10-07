import assert from "node:assert/strict";
import { test } from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/lib/i18n";
import { FooterSection } from "@/components/sections/FooterSection";
import type { Restaurant, WebsiteSection } from "@/lib/types";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
const restaurant = {
  id: 1,
  slug: "cafe",
  name: "Cafe",
  websiteConfig: {
    pages: [
      { slug: "home", label: "Home", isHomepage: true },
      { slug: "contact", label: "Contact", showInNav: true },
      { slug: "secret", label: "Hidden", showInNav: false },
    ],
  },
} as Restaurant;
function render(
  content: Record<string, unknown>,
  layout = "columns",
  settings: Record<string, unknown> = {},
) {
  return renderToStaticMarkup(
    <LocaleProvider>
      <FooterSection
        restaurant={restaurant}
        section={
          {
            id: 3,
            sectionType: "footer",
            content,
            settings,
            layout,
          } as WebsiteSection
        }
      />
    </LocaleProvider>,
  );
}
test("footer inherits visible header links and renders each once in centered layout", () => {
  const html = render({}, "centered");
  assert.equal((html.match(/href="\/r\/cafe\/contact"/g) ?? []).length, 1);
  assert.match(html, /href="\/r\/cafe"/);
  assert.doesNotMatch(html, /Hidden/);
});
test("footer rejects unsafe social and authored destinations and honors independent visibility", () => {
  const html = render({
    show_logo: false,
    show_navigation: false,
    show_social: false,
    social_links: [{ platform: "facebook", url: "https://facebook.com/test" }],
    external_links: [
      {
        id: "bad",
        label: "Unsafe",
        target: { kind: "url", value: "javascript:alert(1)" },
      },
    ],
  });
  assert.doesNotMatch(
    html,
    /href="javascript:|>Unsafe<|data-social-links|href="\/r\/cafe"/,
  );
  const safe = render({
    social_links: [
      { platform: "facebook", url: "javascript:alert(1)" },
      { platform: "instagram", url: "https://instagram.com/test" },
    ],
  });
  assert.doesNotMatch(safe, /href="javascript:/);
  assert.match(safe, /aria-label="Instagram"/);
});
test("footer subscription is optional, has a real email field and renders shared colors", () => {
  assert.doesNotMatch(render({}), /<form/);
  const html = render(
    {
      show_subscription: true,
      show_subscription_title: true,
      subscription_title: "News",
      subscription_button: "Join",
    },
    "columns",
    { color_style: "style-2" },
  );
  assert.match(html, /type="email" required=""/);
  assert.match(html, /News/);
  assert.match(html, /Join/);
  assert.match(html, /var\(--site-paragraph\)/);
  assert.match(
    render({ show_subscription: true }, "centered"),
    /max-w-md mx-auto w-full/,
  );
});
