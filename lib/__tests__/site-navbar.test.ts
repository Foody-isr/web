import assert from "node:assert/strict";
import { test } from "node:test";
import {
  resolveNavbar,
  resolveNavbarCtaSurface,
  resolveNavbarSurface,
} from "../../components/SiteNavbar";
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
