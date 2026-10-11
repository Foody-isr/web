/** Reads authored phrases defensively, preserving their order and translated text. */
export function animatedTextPhrases(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).flatMap((phrase) => {
    const text =
      phrase && typeof phrase.text === "string" ? phrase.text.trim() : "";
    return text ? [text] : [];
  });
}

/** Time between phrase changes, shared by the preview and published section. */
export function animatedTextInterval(speed: unknown): number {
  return speed === "slow" ? 2500 : speed === "fast" ? 600 : 1000;
}

/** Splits visual letters without tearing emoji or combining accents apart. */
export function animatedTextLetters(text: string): string[] {
  if (typeof Intl.Segmenter === "function")
    return Array.from(
      new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text),
      ({ segment }) => segment,
    );
  return Array.from(text);
}
