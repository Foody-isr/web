// Edge-safe helpers shared by the OG image routes (/api/og and /api/og/item).
// Share the weserv transcode and Satori format check across both routes.

export function colorFromName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  const hue = h % 360;
  return `hsl(${hue}, 55%, 30%)`;
}

/**
 * Detects whether the leading bytes look like an image format satori can decode.
 * We treat JPEG and PNG as first-class; satori has known issues rendering WebP
 * inside `next/og` so we only accept files where the bytes match these formats.
 */
export function detectSatoriCompatibleMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  return null;
}

/**
 * Builds an images.weserv.nl URL that transcodes the source to JPEG. The S3
 * upload pipeline currently stores AVIF/WebP bytes under .png/.jpg names with
 * mismatched content-types; satori can't decode AVIF and struggles with WebP.
 * weserv re-encodes server-side regardless of source. `bg=white` flattens
 * transparent PNGs (e.g. logos) onto white instead of weserv's default black.
 */
export function buildProxiedJpegUrl(rawUrl: string, width: number): string | null {
  return buildProxiedImageUrl(rawUrl, {
    w: String(width),
    output: "jpg",
    q: "80",
    bg: "white",
  });
}

/** Keeps logo transparency and fits both dimensions within the center of the card. */
export function buildProxiedLogoUrl(rawUrl: string, size: number): string | null {
  return buildProxiedImageUrl(rawUrl, {
    w: String(size),
    h: String(size),
    fit: "inside",
    output: "png",
  });
}

function buildProxiedImageUrl(
  rawUrl: string,
  options: Record<string, string>,
): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    const stripped = `${parsed.host}${parsed.pathname}${parsed.search}`;
    const proxied = new URL("https://images.weserv.nl/");
    proxied.search = new URLSearchParams({ url: stripped, ...options }).toString();
    return proxied.toString();
  } catch {
    return null;
  }
}

export type FetchOutcome =
  | { ok: true; proxiedUrl: string; mime: string; bytes: number }
  | { ok: false; reason: string };

/** Confirms the proxy served image bytes that the card renderer supports. */
export async function fetchAndVerify(
  rawUrl: string,
  width: number,
  mode: "photo" | "logo" = "photo",
): Promise<FetchOutcome> {
  const proxiedUrl = mode === "logo"
    ? buildProxiedLogoUrl(rawUrl, width)
    : buildProxiedJpegUrl(rawUrl, width);
  if (!proxiedUrl) return { ok: false, reason: "invalid source url" };
  try {
    const res = await fetch(proxiedUrl, { cache: "no-store" });
    if (!res.ok) return { ok: false, reason: `weserv http ${res.status}` };
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const mime = detectSatoriCompatibleMime(bytes);
    if (!mime) {
      return {
        ok: false,
        reason: `unrecognized magic bytes from weserv (len=${bytes.length} ct=${res.headers.get("content-type")})`,
      };
    }
    return { ok: true, proxiedUrl, mime, bytes: bytes.length };
  } catch (err) {
    return { ok: false, reason: `fetch threw: ${(err as Error).message ?? String(err)}` };
  }
}
