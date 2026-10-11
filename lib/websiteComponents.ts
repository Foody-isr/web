/** Reject executable and protocol-relative links supplied by website content. */
export function websiteContentUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (!url || /[\\\u0000-\u0020]/.test(url) || url.startsWith("//"))
    return null;
  if (
    /^(https?:|mailto:|tel:)/i.test(url) ||
    url.startsWith("/") ||
    url.startsWith("#")
  )
    return url;
  return null;
}

/** Converts supported hosted-video URLs to privacy-preserving player URLs. */
export function websiteVideoEmbed(value: unknown): string | null {
  const safe = websiteContentUrl(value);
  if (!safe) return null;
  try {
    const url = new URL(safe);
    const host = url.hostname.toLowerCase();
    if (["youtube.com", "www.youtube.com", "youtu.be"].includes(host)) {
      const id =
        host === "youtu.be"
          ? url.pathname.slice(1)
          : (url.searchParams.get("v") ?? url.pathname.split("/").pop());
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id)
        ? `https://www.youtube-nocookie.com/embed/${id}`
        : null;
    }
    if (["vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(host)) {
      const id = url.pathname.split("/").pop();
      return id && /^\d+$/.test(id)
        ? `https://player.vimeo.com/video/${id}`
        : null;
    }
  } catch {
    return null;
  }
  return null;
}

/** Media elements accept web resources only, never telephone, email or fragment targets. */
export function websiteMediaUrl(value: unknown): string | null {
  const url = websiteContentUrl(value);
  return url && (/^https?:\/\//i.test(url) || url.startsWith("/")) ? url : null;
}
