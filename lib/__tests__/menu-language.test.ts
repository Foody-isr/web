import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveMenuLocale, type MenuLanguageChoice } from "../menu-language";
import type { Locale } from "../i18n";

// Guests expect the menu to speak the language they picked for the site. The
// only way to see the restaurant's original wording is to ask for it.
test("menu content follows the UI language by default", () => {
  const cases: Array<[Locale, Locale | null]> = [
    ["he", "en"],
    ["fr", "en"],
    ["en", "he"],
    ["fr", "he"],
  ];
  for (const [ui, source] of cases) {
    assert.equal(
      resolveMenuLocale(ui, source, "translated"),
      ui,
      `ui=${ui} source=${source} should render the menu in ${ui}`,
    );
  }
});

test("choosing the original pins the menu to the restaurant's source language", () => {
  assert.equal(resolveMenuLocale("fr", "he", "original"), "he");
  assert.equal(resolveMenuLocale("en", "he", "original"), "he");
});

test("an unknown source language always falls back to the UI language", () => {
  const choices: MenuLanguageChoice[] = ["original", "translated"];
  for (const choice of choices) {
    assert.equal(resolveMenuLocale("he", null, choice), "he");
  }
});

test("no toggle is offered when the UI already matches the source language", () => {
  assert.equal(resolveMenuLocale("he", "he", "original"), "he");
  assert.equal(resolveMenuLocale("he", "he", "translated"), "he");
});
