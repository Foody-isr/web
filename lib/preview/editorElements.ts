/** Semantic elements shared with the public renderer's editor interaction contract. */
export const EDITOR_ELEMENTS: Record<string, readonly string[]> = {
  hero_banner: ["headline", "subheadline", "cta_text", "image_url"],
  text_and_image: ["title", "body", "image_url", "cta_text"],
  text: ["title", "subtitle", "body", "cta_text"],
  button: ["cta_text"],
  menu_highlights: ["title", "subtitle", "cta_text"],
  featured_menu: ["title", "subtitle", "cta_text"],
  scrolling_text: ["text"],
  animated_text: ["text"],
  donation: ["title", "body", "cta_text", "image_url"],
  promo_banner: ["title", "body", "image_url"],
};

/** Rejects unknown fields; preview messages must never become arbitrary draft paths. */
export function isEditorElement(type: string, field: unknown): field is string {
  return (
    typeof field === "string" &&
    ((type === "hero_banner" && /^slides\.[0-5]\.(headline|subheadline|cta_text|image_url)$/.test(field)) ||
    Array.isArray(EDITOR_ELEMENTS[type]) && EDITOR_ELEMENTS[type].includes(field))
  );
}

/** Only plain text is editable in the canvas; media keeps its upload workflow. */
export function isInlineTextElement(
  type: string,
  field: unknown,
): field is string {
  return isEditorElement(type, field) && field !== "image_url" && !field.endsWith(".image_url");
}

/** Resolves only whitelisted campaign fields, without interpreting arbitrary object paths. */
export function editorElementValue(section: { section_type: string; content: Record<string, unknown> }, field: string): unknown {
  if (!isEditorElement(section.section_type, field)) return undefined;
  const nested = /^slides\.([0-5])\.(headline|subheadline|cta_text|image_url)$/.exec(field);
  if (!nested) return section.content[field];
  const slides = section.content.slides;
  if (!Array.isArray(slides) || slides.length > 6 || slides.some(slide => !slide || typeof slide !== "object" || Array.isArray(slide))) return undefined;
  const slide = slides[Number(nested[1])];
  return slide && typeof slide === "object" ? slide[nested[2]] : undefined;
}

/** Validates a canvas edit against the latest value, preventing stale edits from overwriting undo or reload. */
export function acceptsInlineEdit(
  section: { section_type: string; content: Record<string, unknown> },
  data: { field?: unknown; value?: unknown; previousValue?: unknown },
): data is { field: string; value: string; previousValue: string } {
  return (
    isInlineTextElement(section.section_type, data.field) &&
    typeof data.value === "string" &&
    data.value.length <= 10000 &&
    typeof data.previousValue === "string" &&
    (!data.field.startsWith("slides.") || editorElementValue(section, data.field) !== undefined) &&
    String(editorElementValue(section, data.field) ?? "") === data.previousValue
  );
}
