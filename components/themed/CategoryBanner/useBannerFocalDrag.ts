"use client";

import { useCallback, useRef, useState } from "react";

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Drag-a-dot focal point editing for a category banner, used only inside the
 * admin website-editor preview. Returns a ref to attach to the banner box and
 * pointer handlers that translate a click/drag into a 0-100 focal coordinate.
 * `onChange` fires continuously (for live object-position feedback); `onCommit`
 * fires on release so the parent can persist the final value.
 */
export function useBannerFocalDrag(
  editable: boolean,
  onChange?: (x: number, y: number) => void,
  onCommit?: (x: number, y: number) => void,
) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const last = useRef({ x: 50, y: 50 });

  const fromEvent = useCallback(
    (clientX: number, clientY: number) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = clamp(((clientX - r.left) / r.width) * 100, 0, 100);
      const y = clamp(((clientY - r.top) / r.height) * 100, 0, 100);
      const rx = Math.round(x * 10) / 10;
      const ry = Math.round(y * 10) / 10;
      last.current = { x: rx, y: ry };
      onChange?.(rx, ry);
    },
    [onChange],
  );

  const handlers = editable
    ? {
        onPointerDown: (e: React.PointerEvent) => {
          e.preventDefault();
          (e.target as Element).setPointerCapture?.(e.pointerId);
          setDragging(true);
          fromEvent(e.clientX, e.clientY);
        },
        onPointerMove: (e: React.PointerEvent) => {
          if (dragging) fromEvent(e.clientX, e.clientY);
        },
        onPointerUp: (e: React.PointerEvent) => {
          if (!dragging) return;
          setDragging(false);
          (e.target as Element).releasePointerCapture?.(e.pointerId);
          onCommit?.(last.current.x, last.current.y);
        },
        onPointerCancel: () => {
          if (!dragging) return;
          setDragging(false);
          onCommit?.(last.current.x, last.current.y);
        },
      }
    : {};

  return { ref, handlers, dragging };
}
