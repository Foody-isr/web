import { test } from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { claimThemeBootstrap, themeBootstrapScript } from "../bootstrap";
import { themesById, pairingsById } from "../generated/themes";
import { applyTheme, applySectionColors } from "../applyTheme";
import { applySiteColors } from "../siteColors";
import type { ResolvedTheme } from "../types";
import type { WebsiteConfig } from "../../types";

function theme(id = "minimal-light"): ResolvedTheme {
  const selected = themesById[id];
  return { themeId: id, pairingId: "modern-sans", theme: selected, pairing: pairingsById["modern-sans"], brandColorOverride: "#123456", direction: "rtl", fonts: { display: "Heebo", body: "Heebo" }, layout: selected.layout, typography: { site: { template: "custom", buttonShape: "square", headingFont: "Manrope" }, roles: { itemName: { font: "Inter", weight: 700, color: "#334455" } } } };
}

function documentFixture() {
  const properties = new Map<string, string>();
  const attributes = new Map<string, string>();
  const root = {
    dataset: {} as Record<string, string>,
    style: { setProperty: (name: string, value: string) => properties.set(name, value), removeProperty: (name: string) => properties.delete(name) },
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    removeAttribute: (name: string) => attributes.delete(name),
  };
  return { properties, attributes, document: { documentElement: root, head: { appendChild() {} }, createElement: () => ({}) } };
}

test("the first HTML and hydrated theme use identical colors, typography and sparse section overrides", () => {
  const resolved = theme();
  const config = { sectionColors: { navbar: { bg: "#ab1234" }, checkout: { bg: "#cdef12", accent: "#123abc" } }, customPalette: { color_styles: { default: "style-2", styles: [{ id: "style-2", bg: "#223344", ink: "#ffffff", accent: "#ffaabb", surface: "#334455" }] } } } as unknown as WebsiteConfig;
  const initial = documentFixture();
  runInNewContext(themeBootstrapScript(resolved, config, 1), { document: initial.document });
  const live = documentFixture();
  const previousDocument = globalThis.document;
  Object.assign(globalThis, { document: live.document });
  try {
    applyTheme(resolved);
    const c = resolved.theme.tokens.colors;
    applySiteColors({ bg: c.bg, ink: c.ink, accent: resolved.brandColorOverride || c.accent, surface: c.surface, ...config.customPalette });
    applySectionColors(config.sectionColors);
  } finally {
    Object.assign(globalThis, { document: previousDocument });
  }
  assert.deepEqual(initial.properties, live.properties);
  assert.deepEqual(initial.attributes, live.attributes);
});

test("page bootstrap outranks the site bootstrap regardless of streaming order", () => {
  const fixture = documentFixture();
  const context = { document: fixture.document };
  runInNewContext(themeBootstrapScript(theme("coastal-sand"), null, 2), context);
  runInNewContext(themeBootstrapScript(theme("editorial-dark"), null, 1), context);
  assert.equal(fixture.attributes.get("data-theme"), "coastal-sand");
  assert.equal(fixture.properties.get("--bg-page"), themesById["coastal-sand"].tokens.colors.bg);
});

test("parent hydration preserves the page palette until its provider claims it", () => {
  const fixture = documentFixture();
  fixture.document.documentElement.dataset.foodyThemeDepth = "2";
  const previousDocument = globalThis.document;
  Object.assign(globalThis, { document: { ...fixture.document, querySelector: () => ({}) } });
  try {
    assert.equal(claimThemeBootstrap(1), false);
    assert.equal(fixture.document.documentElement.dataset.foodyThemeDepth, "2");
    assert.equal(claimThemeBootstrap(2), true);
    assert.equal(fixture.document.documentElement.dataset.foodyThemeDepth, undefined);
    assert.equal(claimThemeBootstrap(1), true);
  } finally {
    Object.assign(globalThis, { document: previousDocument });
  }
});

test("navigating away before hydration cannot leave a stale bootstrap owner", () => {
  const fixture = documentFixture();
  fixture.document.documentElement.dataset.foodyThemeDepth = "2";
  const previousDocument = globalThis.document;
  Object.assign(globalThis, { document: { ...fixture.document, querySelector: () => null } });
  try {
    assert.equal(claimThemeBootstrap(1), true);
    assert.equal(fixture.document.documentElement.dataset.foodyThemeDepth, undefined);
  } finally {
    Object.assign(globalThis, { document: previousDocument });
  }
});

test("an incoming restaurant removes sparse styles from the previous restaurant", () => {
  const fixture = documentFixture();
  const context = { document: fixture.document };
  runInNewContext(themeBootstrapScript(theme(), { sectionColors: { navbar: { bg: "#112233" } } } as WebsiteConfig, 1), context);
  const incoming = { ...theme(), typography: null, brandColorOverride: null };
  runInNewContext(themeBootstrapScript(incoming, null, 1), context);
  assert.equal(fixture.properties.has("--navbar-bg"), false);
  assert.equal(fixture.properties.has("--type-item-name-color"), false);
  assert.equal(fixture.properties.has("--site-button-radius"), false);
  assert.equal(fixture.attributes.has("data-site-design"), false);
  assert.equal(fixture.properties.get("--font-display"), '"Heebo"');
});

test("restaurant-authored values cannot terminate or execute the inline bootstrap", () => {
  const fixture = documentFixture();
  const value = '</script><script>globalThis.executed=true</script>\u2028\u2029"';
  const resolved = { ...theme(), typography: { site: { headingFont: value } } };
  const script = themeBootstrapScript(resolved, null, 1);
  assert.equal(script.includes("</script>"), false);
  assert.equal(script.includes("\u2028"), false);
  assert.equal(script.includes("\u2029"), false);
  const context = { document: fixture.document, executed: false };
  runInNewContext(script, context);
  assert.equal(context.executed, false);
  assert.equal(fixture.properties.get("--font-display"), JSON.stringify(value));
});
