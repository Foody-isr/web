/** Anchors the desktop mini-cart under its icon while keeping it in the viewport. */
export function websiteCartPosition(
  anchor: { left: number; right: number; bottom: number },
  viewport: { width: number; height: number },
  rtl: boolean,
) {
  const width = Math.min(420, viewport.width - 48);
  const top = Math.max(16, Math.min(anchor.bottom + 8, viewport.height - 96));
  const left = Math.max(
    24,
    Math.min(
      rtl ? anchor.left : anchor.right - width,
      viewport.width - width - 24,
    ),
  );
  return { inset: "auto", top, left, maxHeight: viewport.height - top - 24 };
}
