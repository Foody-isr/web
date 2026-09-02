import assert from "node:assert/strict";
import { test } from "node:test";
import { localizeContent } from "../sectionLocale";

test("stale translations do not restore a cleared section field", () => {
  const content = { headline: "", subheadline: "Texte source" };
  const localized = localizeContent(
    content,
    {
      headline: { he: "כותרת ישנה" },
      subheadline: { he: "טקסט מתורגם" },
    },
    "he",
  );

  assert.equal(localized.headline, "");
  assert.equal(localized.subheadline, "טקסט מתורגם");
  assert.equal(content.subheadline, "Texte source", "source content is not mutated");
});

test("stale nested translations do not restore removed or blank fields", () => {
  const content = {
    cards: [{ subtitle: "   " }, { subtitle: "Texte actif" }],
  };
  const localized = localizeContent(
    content,
    {
      "cards.0.subtitle": { he: "טקסט ישן" },
      "cards.1.subtitle": { he: "טקסט פעיל" },
      "cards.2.subtitle": { he: "כרטיס שנמחק" },
    },
    "he",
  );
  const cards = localized.cards as Array<{ subtitle: string }>;

  assert.equal(cards[0].subtitle, "   ");
  assert.equal(cards[1].subtitle, "טקסט פעיל");
  assert.equal(cards.length, 2);
});

test("owner-authored titles and link labels keep their original names", () => {
  const content = {
    headline: "Cookaz",
    subheadline: "Cuisine pour tous",
    cards: [{ title: "FOOD TRUCK", subtitle: "Repas sur place" }],
    buttons: [{ label: "La Boutique" }],
    promotions: [{ cta_label: "Découvrir" }],
    reviews: [{ name: "Jean Dupont" }],
  };
  const localized = localizeContent(
    content,
    {
      headline: { he: "קוקאץ" },
      subheadline: { he: "מטבח לכולם" },
      "cards.0.title": { he: "משאית מזון" },
      "cards.0.subtitle": { he: "ארוחה במקום" },
      "buttons.0.label": { he: "החנות" },
      "promotions.0.cta_label": { he: "לגלות" },
      "reviews.0.name": { he: "ז'אן דופון" },
    },
    "he",
  );
  const cards = localized.cards as Array<{ title: string; subtitle: string }>;
  const buttons = localized.buttons as Array<{ label: string }>;
  const promotions = localized.promotions as Array<{ cta_label: string }>;
  const reviews = localized.reviews as Array<{ name: string }>;

  assert.equal(localized.headline, "Cookaz");
  assert.equal(localized.subheadline, "מטבח לכולם");
  assert.equal(cards[0].title, "FOOD TRUCK");
  assert.equal(cards[0].subtitle, "ארוחה במקום");
  assert.equal(buttons[0].label, "La Boutique");
  assert.equal(promotions[0].cta_label, "Découvrir");
  assert.equal(reviews[0].name, "Jean Dupont");
  assert.equal(content.cards[0].subtitle, "Repas sur place", "source content is not mutated");
});
