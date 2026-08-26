import assert from "node:assert/strict";
import { test } from "node:test";
import {
  compactNavClearanceClass,
  navModeVisibility,
  navPositionClass,
  resolveNavbar,
  resolveNavbarCtaSurface,
  resolveNavbarSurface,
} from "../../components/SiteNavbar";
import { ORDER_PAGE_NAV_SIDE, resolveNavLayout } from "../navLayout";
import type { WebsiteConfig } from "../types";

test("resolved navbar styles normalize legacy inputs at the renderer boundary", () => {
  assert.equal(
    resolveNavbar({ navbarStyle: "custom" } as WebsiteConfig, null).style,
    "solid",
  );
  assert.equal(
    resolveNavbar({ navbarStyle: "hidden" } as WebsiteConfig, null).style,
    "solid",
  );
  assert.equal(
    resolveNavbar(
      { navbarStyle: "custom" } as WebsiteConfig,
      { navbar_style: "overlay" },
    ).style,
    "overlay",
  );
  assert.equal(
    resolveNavbar({ navbarStyle: "transparent" } as WebsiteConfig, null).style,
    "transparent",
  );
});

test("only an overlay navbar changes its surface on hover or focus", () => {
  assert.deepEqual(resolveNavbarSurface("solid", true, false), {
    overlayActive: false,
    transparent: false,
  });
  assert.deepEqual(resolveNavbarSurface("solid", true, true), {
    overlayActive: false,
    transparent: false,
  });
  assert.deepEqual(resolveNavbarSurface("overlay", true, false), {
    overlayActive: true,
    transparent: true,
  });
  assert.deepEqual(resolveNavbarSurface("overlay", true, true), {
    overlayActive: true,
    transparent: false,
  });
});

test("transparent CTA state resolves semantic outline colors", () => {
  assert.deepEqual(
    resolveNavbarCtaSurface(
      {
        transparent: {
          variant: "outline",
          text_color: "#ffffff",
          border_color: "#ffffff",
        },
      },
      true,
    ),
    {
      variant: "outline",
      bg: "transparent",
      text_color: "#ffffff",
      border_color: "#ffffff",
    },
  );
});

test("legacy CTA colors feed the solid state", () => {
  assert.deepEqual(
    resolveNavbarCtaSurface(
      {
        variant: "outline",
        bg: "#f8fafc",
        text_color: "#111827",
        border_color: "#334155",
      },
      false,
    ),
    {
      variant: "outline",
      bg: "#f8fafc",
      text_color: "#111827",
      border_color: "#334155",
    },
  );
});

test("unset transparent CTA keeps the existing frosted surface", () => {
  assert.deepEqual(resolveNavbarCtaSurface({}, true), {
    variant: "filled",
    bg: "rgba(255,255,255,0.18)",
    text_color: "#ffffff",
    border_color: "rgba(255,255,255,0.4)",
  });
});

test("ghost CTA resolves a transparent surface without a border", () => {
  assert.deepEqual(
    resolveNavbarCtaSurface(
      {
        transparent: {
          variant: "ghost",
          text_color: "#f8fafc",
        },
      },
      true,
    ),
    {
      variant: "ghost",
      bg: "transparent",
      text_color: "#f8fafc",
      border_color: "transparent",
    },
  );
});

test("explicit solid CTA state wins over every legacy top-level value", () => {
  assert.deepEqual(
    resolveNavbarCtaSurface(
      {
        variant: "ghost",
        bg: "#111827",
        text_color: "#f8fafc",
        border_color: "#334155",
        solid: {
          variant: "outline",
          bg: "#ffffff",
          text_color: "#0f172a",
          border_color: "#315fce",
        },
      },
      false,
    ),
    {
      variant: "outline",
      bg: "#ffffff",
      text_color: "#0f172a",
      border_color: "#315fce",
    },
  );
});

test("compact navigation floats without inheriting the full bar surface", () => {
  assert.equal(
    navModeVisibility("compact", "full", "full"),
    "hidden md:block",
  );
  assert.equal(
    navModeVisibility("compact", "full", "compact"),
    "block md:hidden",
  );
  assert.equal(
    navPositionClass("compact", "full", false),
    "absolute md:sticky inset-x-0 top-0",
  );
  assert.equal(
    navPositionClass("hidden", "compact", false),
    "sticky md:absolute inset-x-0 top-0",
  );
  assert.equal(
    compactNavClearanceClass("compact", "full", false),
    "block h-[60px] md:hidden",
  );
  assert.equal(
    compactNavClearanceClass("hidden", "compact", false),
    "hidden md:block md:h-[60px]",
  );
  assert.equal(
    compactNavClearanceClass("compact", "compact", true),
    "hidden",
  );
});

test("slim navigation keeps the link surface while hiding full and compact content", () => {
  assert.equal(
    navModeVisibility("slim", "full", ["full", "slim"]),
    "block md:block",
  );
  assert.equal(
    navModeVisibility("slim", "full", "full"),
    "hidden md:block",
  );
  assert.equal(
    navModeVisibility("slim", "full", "slim"),
    "block md:hidden",
  );
  assert.equal(
    navModeVisibility("slim", "slim", ["full", "slim"], "flex"),
    "flex md:flex",
  );
  assert.equal(
    navPositionClass("slim", "slim", false),
    "sticky md:sticky inset-x-0 top-0",
  );
});

test("the global navigation matrix preserves the slim mode", () => {
  const layout = resolveNavLayout({
    navLayout: {
      content: { desktop: "slim", mobile: "slim", bottom_bar: false },
      shopping: { desktop: "slim", mobile: "compact", bottom_bar: true },
    },
    navbarStyle: "solid",
    navbarShowLinks: true,
    navbarHamburger: "mobile",
  });

  assert.equal(layout.content.desktop, "slim");
  assert.equal(layout.content.mobile, "slim");
  assert.equal(layout.shopping.desktop, "slim");
});

test("order pages keep the universal task-focused navigation", () => {
  assert.deepEqual(ORDER_PAGE_NAV_SIDE, {
    desktop: "compact",
    mobile: "hidden",
    bottom_bar: true,
  });
});
