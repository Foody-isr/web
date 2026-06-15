"use client";

import { useCallback, useEffect, useState } from "react";
import { useResolvedTheme } from "@/lib/themes/useResolvedTheme";
import { useIsMobileViewport } from "@/lib/themes/useViewMode";
import { usePreviewMode } from "@/lib/preview-mode";
import { ImageOverlay } from "./CategoryBanner.ImageOverlay";
import { TextBlock } from "./CategoryBanner.TextBlock";
import { StripedRule } from "./CategoryBanner.StripedRule";

export type CategoryBannerProps = {
  name: string;
  imageUrl?: string;
  description?: string;
  capitalize?: boolean;
  /** Darkness (0-100) of the dark veil over the image. Only used by ImageOverlay. */
  overlay?: number;
  /** How the image fills the banner box: "cover" (crop, default), "contain" (whole image + blurred fill), or "natural" (full-width at the image's own aspect ratio). Only used by ImageOverlay. */
  fit?: "cover" | "contain" | "natural";
  /** When true, the image is shown with no overlaid title/veil (the "image-only" style). Only used by ImageOverlay. */
  hideTitle?: boolean;
  /** Banner image focal point (0-100, percent from left/top) → CSS object-position. */
  focalX?: number;
  focalY?: number;
  /** Menu group id — only used in the admin preview to report focal edits back. */
  groupId?: string;
  /** Internal (injected by CategoryBanner): the banner is editable in the preview. */
  editable?: boolean;
  /** Internal: live focal update while dragging. */
  onFocalChange?: (x: number, y: number) => void;
  /** Internal: final focal value on drag release. */
  onFocalCommit?: (x: number, y: number) => void;
};

export function CategoryBanner(props: CategoryBannerProps) {
  const { resolved, config } = useResolvedTheme();
  // Image-overlay is the product default. Admin can override per-restaurant.
  const style = config?.categoryBannerStyle ?? "image-overlay";
  const capitalize = props.capitalize ?? resolved?.layout.capitalizeBanners ?? false;
  // Default 40 preserves the legacy bg-black/40 veil; admin can dial it 0-100.
  const overlay = config?.categoryBannerOverlay ?? 40;
  // Fit is configured per device; the mobile value falls back to the desktop
  // choice when unset (empty string). `||` (not `??`) so the admin preview's
  // '' "no override" sentinel resolves to the desktop value. Starts
  // desktop-first on the server, resolves to mobile after mount.
  const isMobile = useIsMobileViewport();
  const fit = (isMobile ? config?.categoryBannerFitMobile : null) || config?.categoryBannerFit || "cover";

  // Focal-point editing: only active inside the admin website-editor preview.
  // We keep an optimistic local copy so dragging is smooth, then post the final
  // value to the parent (admin) on release; admin persists it to the group.
  const editable = usePreviewMode();
  const [focal, setFocal] = useState({ x: props.focalX ?? 50, y: props.focalY ?? 50 });
  // Re-sync when the source data changes (e.g. a refetch or switching group).
  useEffect(() => {
    setFocal({ x: props.focalX ?? 50, y: props.focalY ?? 50 });
  }, [props.focalX, props.focalY, props.groupId]);
  const commit = useCallback(
    (x: number, y: number) => {
      setFocal({ x, y });
      if (typeof window !== "undefined" && window.parent !== window && props.groupId) {
        window.parent.postMessage({ type: "foody-banner-focal", groupId: props.groupId, x, y }, "*");
      }
    },
    [props.groupId],
  );

  const merged = {
    ...props,
    capitalize,
    overlay,
    fit,
    focalX: focal.x,
    focalY: focal.y,
    editable,
    onFocalChange: (x: number, y: number) => setFocal({ x, y }),
    onFocalCommit: commit,
  };
  switch (style) {
    case "image-overlay": return <ImageOverlay {...merged} />;
    case "image-only":    return <ImageOverlay {...merged} hideTitle />;
    case "text-block":    return <TextBlock {...merged} />;
    case "striped-rule":  return <StripedRule {...merged} />;
    case "none":          return null;
    default:              return <ImageOverlay {...merged} />;
  }
}
