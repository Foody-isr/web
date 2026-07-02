"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { BannerDesign, BannerSticker } from "@/lib/types";
import type { CategoryBannerProps } from "./CategoryBanner";
import { roleTextStyle } from "@/lib/themes/typography";
import { ensureFont } from "@/components/sections/typography";

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function postToParent(msg: unknown) {
  if (typeof window !== "undefined" && window.parent !== window) {
    window.parent.postMessage(msg, "*");
  }
}

/**
 * "Couleur + titre" category banner: a solid background color, a styled title
 * (the category name or custom text), and any number of positioned/rotated
 * sticker images. Inside the admin website-editor preview it is interactive —
 * clicking selects the banner (so the admin shows its controls) and stickers
 * can be dragged; every change is posted to the parent admin to persist.
 */
export function ColorTitle({ name, capitalize, design: designProp, groupId, editable = false }: CategoryBannerProps) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [design, setDesign] = useState<BannerDesign>(designProp ?? {});

  // Re-sync from props (initial data / refetch / group switch).
  useEffect(() => {
    setDesign(designProp ?? {});
  }, [designProp, groupId]);

  // In the editor, the admin pushes live design edits (bg/title/sticker add)
  // targeted at this group; apply them so the preview updates as they type.
  useEffect(() => {
    if (!editable) return;
    function onMessage(e: MessageEvent) {
      if (e.data?.type === "foody-banner-design" && String(e.data.groupId) === String(groupId)) {
        setDesign((e.data.design ?? {}) as BannerDesign);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [editable, groupId]);

  const td = design.title ?? {};
  useEffect(() => {
    if (td.font) ensureFont(td.font);
  }, [td.font]);

  // ── Sticker drag (editor only) ──
  const dragState = useRef<{ id: string } | null>(null);
  const updateStickerPos = useCallback((id: string, clientX: number, clientY: number) => {
    const box = boxRef.current;
    if (!box) return;
    const r = box.getBoundingClientRect();
    let x = clamp(((clientX - r.left) / r.width) * 100, 0, 100);
    let y = clamp(((clientY - r.top) / r.height) * 100, 0, 100);
    // Light edge snapping so corners are easy to hit.
    if (x < 10) x = 8; else if (x > 90) x = 92;
    if (y < 12) y = 10; else if (y > 88) y = 90;
    setDesign((d) => ({
      ...d,
      stickers: (d.stickers ?? []).map((s) => (s.id === id ? { ...s, xPct: Math.round(x * 10) / 10, yPct: Math.round(y * 10) / 10 } : s)),
    }));
  }, []);

  const onStickerPointerDown = (e: React.PointerEvent, id: string) => {
    if (!editable) return;
    e.stopPropagation();
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragState.current = { id };
    updateStickerPos(id, e.clientX, e.clientY);
  };
  const onStickerPointerMove = (e: React.PointerEvent, id: string) => {
    if (!editable || dragState.current?.id !== id) return;
    updateStickerPos(id, e.clientX, e.clientY);
  };
  const onStickerPointerUp = (e: React.PointerEvent, id: string) => {
    if (!editable || dragState.current?.id !== id) return;
    dragState.current = null;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    // Commit the final position (read latest from state via functional update).
    setDesign((d) => {
      if (groupId) postToParent({ type: "foody-banner-design-change", groupId, design: d });
      return d;
    });
  };

  const selectBanner = () => {
    if (editable && groupId) postToParent({ type: "foody-select-banner", groupId, design });
  };

  // ── Render ──
  const rawText = td.text && td.text.trim() ? td.text : name;

  const titleStyle: CSSProperties = {
    ...roleTextStyle("categoryTitle", "2rem", "display", 700, capitalize ? "uppercase" : "none"),
    color: td.color || "var(--text)",
    textAlign: td.align || "center",
    lineHeight: 1.05,
  };
  if (td.font) titleStyle.fontFamily = `"${td.font}", var(--font-display), sans-serif`;
  if (td.size && td.size !== 1) titleStyle.fontSize = `calc(2rem * var(--type-scale, 1) * ${td.size})`;

  const justify = td.align === "left" ? "flex-start" : td.align === "right" ? "flex-end" : "center";

  return (
    <div
      ref={boxRef}
      onPointerDown={selectBanner}
      className={`relative my-6 h-40 sm:h-44 lg:h-48 rounded-2xl overflow-hidden flex items-center px-5 ${editable ? "cursor-pointer ring-1 ring-black/5" : ""}`}
      style={{ backgroundColor: design.bgColor || "var(--surface)", justifyContent: justify }}
    >
      <h2 className="relative z-10 font-display max-w-full" style={titleStyle}>
        {rawText}
      </h2>

      {(design.stickers ?? []).map((s: BannerSticker) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={s.id}
          src={s.imageUrl}
          alt=""
          draggable={false}
          onPointerDown={(e) => onStickerPointerDown(e, s.id)}
          onPointerMove={(e) => onStickerPointerMove(e, s.id)}
          onPointerUp={(e) => onStickerPointerUp(e, s.id)}
          onPointerCancel={(e) => onStickerPointerUp(e, s.id)}
          className={`absolute z-20 select-none ${editable ? "cursor-move touch-none" : "pointer-events-none"}`}
          style={{
            left: `${s.xPct}%`,
            top: `${s.yPct}%`,
            width: `${s.widthPct}%`,
            transform: `translate(-50%, -50%) rotate(${s.rotationDeg}deg)`,
          }}
        />
      ))}
    </div>
  );
}
