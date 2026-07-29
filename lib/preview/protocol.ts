// Website Builder v2 — unified preview protocol.
//
// Replaces the three legacy parent→iframe channels (foody-draft-state,
// foody-theme-preview, foody-checkout-preview) with ONE message that carries
// the entire editor snapshot. The old design forced the admin to mount exactly
// the right iframe or theme edits were dropped; here a single channel always
// reflects the draft, for whichever page is being edited, on whichever device.
//
// Direction: parent (foodyadmin editor) → iframe (foodyweb preview).
// The iframe→parent messages (editor-ready, section-bounds, section-click,
// scroll) are unchanged and continue to live in lib/preview-mode.ts.

export const PREVIEW_STATE = "foody-preview-state" as const;

export type PreviewDevice = "desktop" | "mobile";

// Which navbar scroll/hover state the preview should force-render, so the owner
// can design the transparent→solid animation without scrolling.
export type NavPreviewState = "top" | "scrolled" | "hover";

// Identifies the page currently being edited so the iframe shows exactly it.
export interface PreviewPageRef {
  id?: number;
  tmpId?: string;
  type: string;
  slug: string;
}

// A section as staged in the draft (admin snake_case shape). page_id/page_tmp_id
// link it to its page (v2); `page` is the legacy string kept during transition.
export interface DraftSection {
  id?: number;
  tmp_id?: string;
  section_type: string;
  page_id?: number;
  page_tmp_id?: string;
  page: string;
  sort_order: number;
  is_visible: boolean;
  layout: string;
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
}

// The full editor snapshot streamed to the preview iframe. siteConfig/navConfig
// are raw admin-shaped blobs the renderer maps as needed.
export interface PreviewState {
  page: PreviewPageRef;
  siteConfig: Record<string, unknown>;
  navConfig: Record<string, unknown> | null;
  sections: DraftSection[];
  device: PreviewDevice;
  navState: NavPreviewState;
}

export interface PreviewStateMessage {
  type: typeof PREVIEW_STATE;
  state: PreviewState;
}

/**
 * isPreviewStateMessage narrows an untrusted `postMessage` payload to our
 * message. Runs on every window message, so it must never throw on garbage
 * (extensions, other frames) — it only returns true for a well-formed state.
 */
export function isPreviewStateMessage(data: unknown): data is PreviewStateMessage {
  if (!data || typeof data !== "object") return false;
  const m = data as Record<string, unknown>;
  if (m.type !== PREVIEW_STATE) return false;
  const s = m.state as Record<string, unknown> | undefined;
  if (!s || typeof s !== "object") return false;
  const page = s.page as Record<string, unknown> | undefined;
  return (
    (s.device === "desktop" || s.device === "mobile") &&
    Array.isArray(s.sections) &&
    !!page &&
    typeof page === "object" &&
    typeof page.slug === "string" &&
    typeof page.type === "string"
  );
}
