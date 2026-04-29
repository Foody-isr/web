import type { ResolvedTheme } from "./types";
import { contrastInk } from "./contrastInk";
import { fontUrlsForPairing } from "./fontUrls";

const LOADED_FONT_URLS = new Set<string>();

function hexToRgbTriple(hex: string): string {
  let c = hex.replace("#", "");
  if (c.length === 3) c = c.split("").map(ch => ch + ch).join("");
  if (c.length === 8) c = c.slice(0, 6);
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

export function applyTheme(rt: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  root.setAttribute("data-theme", rt.themeId);
  root.setAttribute("data-pairing", rt.pairingId);
  root.setAttribute("dir", rt.direction);

  if (rt.brandColorOverride) {
    const ink = contrastInk(rt.brandColorOverride);
    root.style.setProperty("--accent", rt.brandColorOverride);
    root.style.setProperty("--accent-rgb", hexToRgbTriple(rt.brandColorOverride));
    root.style.setProperty("--accent-ink", ink);
    root.style.setProperty("--accent-ink-rgb", hexToRgbTriple(ink));
  } else {
    root.style.removeProperty("--accent");
    root.style.removeProperty("--accent-rgb");
    root.style.removeProperty("--accent-ink");
    root.style.removeProperty("--accent-ink-rgb");
  }

  root.style.setProperty("--font-display", `"${rt.fonts.display}"`);
  root.style.setProperty("--font-body", `"${rt.fonts.body}"`);

  for (const url of fontUrlsForPairing(rt.pairing)) {
    if (LOADED_FONT_URLS.has(url)) continue;
    LOADED_FONT_URLS.add(url);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    document.head.appendChild(link);
  }
}

export function clearTheme(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.removeAttribute("data-theme");
  root.removeAttribute("data-pairing");
  for (const prop of [
    "--accent", "--accent-rgb", "--accent-ink", "--accent-ink-rgb",
    "--font-display", "--font-body",
  ]) {
    root.style.removeProperty(prop);
  }
}
