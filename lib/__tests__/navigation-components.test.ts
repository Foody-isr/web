import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("navbar CTA exposes its resolved semantic variant", () => {
  const navbar = source("components/SiteNavbar.tsx");
  const ctaStart = navbar.indexOf("const ctaBtn");
  const ctaEnd = navbar.indexOf(") : null;", ctaStart);

  assert.notEqual(ctaStart, -1, "navbar CTA render block is missing");
  assert.notEqual(ctaEnd, -1, "navbar CTA render block is incomplete");

  const ctaRender = navbar.slice(ctaStart, ctaEnd);
  assert.match(ctaRender, /<Link/);
  assert.match(
    ctaRender,
    /data-navbar-cta-variant=\{ctaSurface\.variant\}/,
  );
});
