"use client";
import NextImage, { type ImageProps } from "next/image";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ImgHTMLAttributes,
} from "react";
import { imageFrameRect, normalizeImageFraming } from "@/lib/imageFraming";

/** Clips an authored image rectangle; absent framing preserves the original renderer. */
export function FramedImage({
  framing,
  native = false,
  intrinsicRatio = false,
  ...props
}: ImageProps & {
  framing?: unknown;
  native?: boolean;
  intrinsicRatio?: boolean;
}) {
  const normalized = normalizeImageFraming(framing);
  if (!normalized) {
    if (native) {
      const { fill, sizes, priority, quality, unoptimized, ...image } = props;
      return (
        <img
          {...(image as ImgHTMLAttributes<HTMLImageElement>)}
          alt={props.alt}
        />
      );
    }
    return <NextImage {...props} />;
  }
  return (
    <ImageViewport
      {...props}
      intrinsicRatio={intrinsicRatio}
      framing={normalized}
    />
  );
}
function ImageViewport({
  framing,
  intrinsicRatio,
  ...props
}: ImageProps & {
  framing: NonNullable<ReturnType<typeof normalizeImageFraming>>;
  intrinsicRatio: boolean;
}) {
  const host = useRef<HTMLSpanElement>(null);
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const media = matchMedia("(max-width: 767px)"),
      update = () => setMobile(media.matches);
    update();
    media.addEventListener("change", update);
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setSize({ width: rect.width, height: rect.height });
    });
    if (host.current) observer.observe(host.current);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", update);
    };
  }, []);
  const frame = mobile ? framing.mobile || framing.desktop : framing.desktop;
  const rect = imageFrameRect(
    size.width,
    size.height,
    natural.width,
    natural.height,
    frame,
  );
  const { fill, width, height, className, style, onLoad, ...image } = props;
  const viewport: CSSProperties = fill
    ? { position: "absolute", inset: 0, width: "100%", height: "100%" }
    : {
        position: "relative",
        display: "inline-block",
        width: style?.width || width || "100%",
        height: style?.height || "auto",
        aspectRatio: intrinsicRatio
          ? `${natural.width || 1} / ${natural.height || 1}`
          : `${Number(width) || natural.width || 1} / ${Number(height) || natural.height || 1}`,
      };
  return (
    <span
      ref={host}
      data-image-framed="true"
      className={className}
      style={{ ...style, ...viewport, maxWidth: "100%", overflow: "hidden" }}
    >
      <NextImage
        {...image}
        width={natural.width || 1200}
        height={natural.height || 900}
        onLoad={(e) => {
          setNatural({
            width: e.currentTarget.naturalWidth,
            height: e.currentTarget.naturalHeight,
          });
          onLoad?.(e);
        }}
        style={{
          position: "absolute",
          inset: "auto",
          maxWidth: "none",
          maxHeight: "none",
          objectFit: "fill",
          ...rect,
          opacity: rect.width ? 1 : 0,
        }}
      />
    </span>
  );
}
/** Paints framed media behind content while leaving its overlay in the host. */
export function FramedBackground({
  src,
  framing,
  overlay,
}: {
  src: string;
  framing: unknown;
  overlay?: string;
}) {
  return normalizeImageFraming(framing) ? (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: -1,
      }}
    >
      <FramedImage src={src} framing={framing} alt="" fill sizes="100vw" />
      {overlay && (
        <span style={{ position: "absolute", inset: 0, background: overlay }} />
      )}
    </span>
  ) : null;
}
