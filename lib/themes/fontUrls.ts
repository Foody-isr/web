import type { TypographyPairing } from "./types";

const FONTSHARE_HOSTED = new Set(["Switzer", "PP Neue Montreal"]);
const FONTSHARE_BASE = "https://api.fontshare.com/v2/css?f[]=";

function googleUrl(family: string, weights: number[]): string {
  const w = [...weights].sort((a, b) => a - b).join(";");
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${w}&display=swap`;
}

function fontshareUrl(family: string, weights: number[]): string {
  const slug = family.toLowerCase().replace(/\s+/g, "-");
  const w = [...weights].sort((a, b) => a - b).join(",");
  return `${FONTSHARE_BASE}${slug}@${w}&display=swap`;
}

export function fontUrlsForPairing(p: TypographyPairing): string[] {
  const all = [
    p.pairing.displayLatin,
    p.pairing.bodyLatin,
    p.pairing.displayHebrew,
    p.pairing.bodyHebrew,
  ];
  const urls = new Set<string>();
  for (const f of all) {
    if (FONTSHARE_HOSTED.has(f.family)) urls.add(fontshareUrl(f.family, f.weights));
    else urls.add(googleUrl(f.family, f.weights));
  }
  return [...urls];
}
