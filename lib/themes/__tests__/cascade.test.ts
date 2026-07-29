import { test } from "node:test";
import assert from "node:assert/strict";
import { resolvePageTokens, tokenDiff } from "../cascade";

test("desktop = site base with page base overrides layered on", () => {
  const r = resolvePageTokens(
    { primary: "#000000", surface: "#ffffff" },
    { base: { primary: "#e06c5a" } },
    "desktop",
  );
  assert.deepEqual(r, { primary: "#e06c5a", surface: "#ffffff" });
});

test("mobile layers mobile overrides on top of base + page", () => {
  const r = resolvePageTokens(
    { primary: "#000000", surface: "#ffffff" },
    { base: { primary: "#111111" }, mobile: { surface: "#eeeeee" } },
    "mobile",
  );
  assert.deepEqual(r, { primary: "#111111", surface: "#eeeeee" });
});

test("desktop ignores mobile-only overrides", () => {
  const r = resolvePageTokens(
    { surface: "#ffffff" },
    { mobile: { surface: "#000000" } },
    "desktop",
  );
  assert.deepEqual(r, { surface: "#ffffff" });
});

test("no page overrides = pure site base (full inherit), both devices", () => {
  const base = { primary: "#000000" };
  assert.deepEqual(resolvePageTokens(base, null, "desktop"), base);
  assert.deepEqual(resolvePageTokens(base, undefined, "mobile"), base);
});

test("nullish site base resolves to just the page overrides", () => {
  assert.deepEqual(
    resolvePageTokens(null, { base: { primary: "#abcabc" } }, "desktop"),
    { primary: "#abcabc" },
  );
  assert.deepEqual(resolvePageTokens(undefined, null, "mobile"), {});
});

test("inputs are never mutated", () => {
  const base = { primary: "#000000" };
  const page = { base: { primary: "#ffffff" }, mobile: { surface: "#eeeeee" } };
  resolvePageTokens(base, page, "mobile");
  assert.deepEqual(base, { primary: "#000000" });
  assert.deepEqual(page, { base: { primary: "#ffffff" }, mobile: { surface: "#eeeeee" } });
});

test("tokenDiff returns only overridden entries", () => {
  const base = { primary: "#000000", surface: "#ffffff" };
  const resolved = { primary: "#e06c5a", surface: "#ffffff" };
  assert.deepEqual(tokenDiff(base, resolved), { primary: "#e06c5a" });
});

test("tokenDiff on a fully-inherited map is empty", () => {
  const base = { primary: "#000000", surface: "#ffffff" };
  assert.deepEqual(tokenDiff(base, { ...base }), {});
});

test("tokenDiff surfaces a token the resolved map adds over a nullish base", () => {
  assert.deepEqual(tokenDiff(null, { primary: "#000000" }), { primary: "#000000" });
});
