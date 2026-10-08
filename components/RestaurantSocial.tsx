import React from "react";

/* ── Social bar items: link normalization + minimal monochrome icons ── */
export type SocialPlatform = "instagram" | "whatsapp" | "facebook" | "tiktok";

/** Resolves a restaurant social profile to its public destination. */
export function socialHref(p: SocialPlatform, v: string): string {
  if (/^https?:\/\//i.test(v)) return v;
  switch (p) {
    case "instagram":
      return `https://instagram.com/${v.replace(/^@/, "")}`;
    case "whatsapp":
      return `https://wa.me/${v.replace(/[^\d]/g, "")}`;
    case "facebook":
      return `https://facebook.com/${v}`;
    case "tiktok":
      return `https://tiktok.com/@${v.replace(/^@/, "")}`;
  }
}

export const SOCIAL_ICON: Record<SocialPlatform, React.ReactNode> = {
  instagram: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  ),
  whatsapp: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.1-1.3A10 10 0 1 0 12 2Zm5.2 13.8c-.2.6-1.2 1.2-1.7 1.2-.4 0-1 .2-3.4-.9-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8 0-1.3.7-2 .9-2.2.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.5c-.2.2-.3.4-.1.7.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.2.1.4.1.6-.1l.7-.9c.2-.2.4-.2.6-.1l1.9.9c.2.1.4.2.4.3.1.2.1.7-.1 1.3Z" />
    </svg>
  ),
  facebook: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.2c-1.2 0-1.6.8-1.6 1.5V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z" />
    </svg>
  ),
  tiktok: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.5 3c.3 2 1.5 3.5 3.5 3.7v2.5c-1.2.1-2.4-.3-3.5-1v6.6a5.8 5.8 0 1 1-5.8-5.8c.3 0 .6 0 .9.1v2.6a3.2 3.2 0 1 0 2.3 3V3h2.6Z" />
    </svg>
  ),
};
