function expand(hex: string): string {
  const c = hex.replace("#", "");
  if (c.length === 3) return c.split("").map(ch => ch + ch).join("");
  if (c.length === 4) return c.slice(0, 3).split("").map(ch => ch + ch).join("");
  if (c.length === 8) return c.slice(0, 6);
  return c;
}

function relativeLuminance(hex: string): number {
  const c = expand(hex);
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const f = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastInk(hex: string): "#000000" | "#FFFFFF" {
  return relativeLuminance(hex) > 0.4 ? "#000000" : "#FFFFFF";
}
