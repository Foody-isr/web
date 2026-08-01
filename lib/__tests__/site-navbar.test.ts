import assert from "node:assert/strict";
import { test } from "node:test";
import {
  resolveNavbar,
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
