import type { CategoryBannerProps } from "./CategoryBanner";
import { TextBlock } from "./CategoryBanner.TextBlock";
import { roleTextStyle } from "@/lib/themes/typography";
import { useBannerFocalDrag } from "./useBannerFocalDrag";

export function ImageOverlay({ name, imageUrl, capitalize, overlay = 40, fit = "cover", hideTitle = false, focalX = 50, focalY = 50, editable = false, onFocalChange, onFocalCommit }: CategoryBannerProps) {
  // Hook must run before any early return (rules of hooks). It is inert unless
  // `editable` (admin preview); real customers get plain, non-interactive boxes.
  const drag = useBannerFocalDrag(editable, onFocalChange, onFocalCommit);
  if (!imageUrl) return <TextBlock name={name} capitalize={capitalize} />;
  // Dark veil darkness is admin-configurable (0-100). The title keeps its own
  // drop-shadow so it stays legible even when the veil is disabled. With
  // hideTitle (the "image-only" style) we drop both the veil and the title so
  // the banner shows the artwork untouched.
  const veil = Math.min(Math.max(overlay, 0), 100) / 100;

  const veilEl = !hideTitle && veil > 0 ? <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${veil})` }} /> : null;
  // The title overlay is identical across every fit; it's absolutely positioned
  // so it centers over the image whether the box has a fixed height or follows
  // the image's natural aspect ratio.
  const titleEl = hideTitle ? null : (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-4 text-center">
      <div className="w-20 sm:w-24 border-t border-white/80 mb-3 sm:mb-4" />
      {/* The responsive base size lives in the --ctb var (1.5rem mobile,
          1.875rem ≥sm) so the categoryTitle role's size multiplier + the
          overall scale apply on top of it while keeping responsiveness. */}
      <h2
        className="font-display text-white font-bold tracking-[0.15em] drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] [--ctb:1.5rem] sm:[--ctb:1.875rem]"
        style={roleTextStyle("categoryTitle", "var(--ctb)", "display", 700, capitalize ? "uppercase" : "none", "#ffffff")}
      >
        {name}
      </h2>
      <div className="w-20 sm:w-24 border-t border-white/80 mt-3 sm:mt-4" />
    </div>
  );

  // Focal point as CSS object-position — what stays visible when the image is
  // cropped to fill. Only meaningful when the box crops (cover/contain).
  const objStyle = { objectPosition: `${focalX}% ${focalY}%` } as const;

  // The draggable dot + crosshair cursor only render in the admin preview.
  const focalDot = editable ? (
    <div
      aria-hidden
      className="absolute z-20 w-6 h-6 -ml-3 -mt-3 rounded-full border-2 border-white bg-brand shadow-[0_0_0_2px_rgba(0,0,0,0.5)] pointer-events-none"
      style={{ left: `${focalX}%`, top: `${focalY}%` }}
    />
  ) : null;
  const editClass = editable ? "cursor-crosshair select-none touch-none" : "";

  // "natural": full-width image at its own aspect ratio — no fixed height, so the
  // whole graphic shows with no cropping and no letterbox on any screen width.
  // Nothing is cropped, so the focal point has no effect here (no dot shown).
  if (fit === "natural") {
    return (
      <div className="relative my-6 rounded-2xl overflow-hidden">
        <img src={imageUrl} alt="" className="block w-full h-auto" />
        {veilEl}
        {titleEl}
      </div>
    );
  }

  // "cover" (default) crops to fill a fixed-height box; "contain" shows the whole
  // image inside that box with a blurred, zoomed copy filling the side letterbox.
  const contain = fit === "contain";
  return (
    <div
      ref={drag.ref}
      {...drag.handlers}
      className={`relative my-6 h-40 sm:h-44 lg:h-48 rounded-2xl overflow-hidden ${editClass}`}
    >
      {contain && (
        <img
          src={imageUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl"
          style={objStyle}
          draggable={false}
        />
      )}
      <img
        src={imageUrl}
        alt=""
        className={`absolute inset-0 w-full h-full ${contain ? "object-contain" : "object-cover"}`}
        style={objStyle}
        draggable={false}
      />
      {veilEl}
      {titleEl}
      {focalDot}
    </div>
  );
}
