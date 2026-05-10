import type { TypographyPairing, Direction } from "./types";

export function pickFont(
  pairing: TypographyPairing,
  slot: "display" | "body",
  direction: Direction,
): string {
  if (direction === "rtl") {
    return slot === "display"
      ? pairing.pairing.displayHebrew.family
      : pairing.pairing.bodyHebrew.family;
  }
  return slot === "display"
    ? pairing.pairing.displayLatin.family
    : pairing.pairing.bodyLatin.family;
}
