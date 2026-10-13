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
export function websiteVideoEmbed(value: unknown, playback?: WebsiteVideoPlayback): string | null {
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
      if (!id || !/^[a-zA-Z0-9_-]{11}$/.test(id)) return null;
      return videoEmbedParameters(`https://www.youtube-nocookie.com/embed/${id}`, playback, id);
    }
    if (["vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(host)) {
      const id = url.pathname.split("/").pop();
      return id && /^\d+$/.test(id)
        ? videoEmbedParameters(`https://player.vimeo.com/video/${id}`, playback)
        : null;
    }
  } catch {
    return null;
  }
  return null;
}

export type WebsiteVideoPlayback = {
  autoplay: boolean;
  controls: boolean;
  loop: boolean;
  muted: boolean;
};

/** Preserves legacy player defaults and starts automatic playback muted. */
export function websiteVideoPlayback(settings: Record<string, unknown>): WebsiteVideoPlayback {
  const autoplay = settings.video_autoplay === true;
  return {
    autoplay,
    controls: settings.video_controls !== false,
    loop: settings.video_loop === true,
    muted: autoplay || settings.video_muted === true,
  };
}

function videoEmbedParameters(embed: string, playback?: WebsiteVideoPlayback, youtubeId?: string): string {
  if (!playback || (!playback.autoplay && playback.controls && !playback.loop && !playback.muted)) return embed;
  const url = new URL(embed);
  url.searchParams.set("autoplay", playback.autoplay ? "1" : "0");
  url.searchParams.set("controls", playback.controls ? "1" : "0");
  url.searchParams.set("loop", playback.loop ? "1" : "0");
  url.searchParams.set(youtubeId ? "mute" : "muted", playback.muted ? "1" : "0");
  url.searchParams.set("playsinline", "1");
  if (youtubeId && playback.loop) url.searchParams.set("playlist", youtubeId);
  return url.toString();
}

/** Media elements accept web resources only, never telephone, email or fragment targets. */
export function websiteMediaUrl(value: unknown): string | null {
  const url = websiteContentUrl(value);
  return url && (/^https?:\/\//i.test(url) || url.startsWith("/")) ? url : null;
}
