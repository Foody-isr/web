import type { CartLine } from "@/lib/types";

/** Builds isolated sample lines for cart/checkout previews, never a persisted guest cart. */
export function commerceSampleLines(locale: string): CartLine[] {
  const labels = locale === "fr" ? ["Article d’exemple", "Autre article"]
    : locale === "he" ? ["פריט לדוגמה", "פריט נוסף"] : ["Sample item", "Another item"];
  return labels.map((name, index) => ({
    id: `commerce-preview-${index}`, quantity: index === 0 ? 2 : 1,
    item: { id: `commerce-preview-${index}`, name, groupId: "preview", price: index === 0 ? 25 : 15 },
  }));
}
