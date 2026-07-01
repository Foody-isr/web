"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n, type Locale } from "@/lib/i18n";
import { buildItemShareUrl } from "@/lib/share";

type Props = {
  itemId: string;
  lang: Locale;
  /** Pre-localized share sentence (without the URL). */
  text: string;
  /** Title for the native share sheet (the item name). */
  title: string;
};

/**
 * Share control for the item modal. Uses the native share sheet when available
 * (mobile: WhatsApp, Messages, Instagram, ...). On desktop / unsupported
 * browsers it opens a small popover with WhatsApp, Copy link, X and Facebook.
 * The shareable URL is built from the CURRENT location at click time so it works
 * across path, subdomain and custom-domain hosts.
 */
export function ShareButton({ itemId, lang, text, title }: Props) {
  const { t, direction } = useI18n();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close the fallback popover on any outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const currentUrl = () =>
    buildItemShareUrl(window.location.origin, window.location.pathname, itemId, lang);

  const handleClick = async () => {
    const url = currentUrl();
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
      } catch {
        // user cancelled or share failed — not an error
      }
      return;
    }
    setOpen((v) => !v);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — leave popover open, no crash
    }
  };

  const waHref = () => `https://wa.me/?text=${encodeURIComponent(`${text} ${currentUrl()}`)}`;
  const xHref = () =>
    `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(currentUrl())}`;
  const fbHref = () =>
    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentUrl())}`;

  return (
    <div className="relative flex-shrink-0" ref={ref} data-no-drag>
      <button
        type="button"
        onClick={handleClick}
        aria-label={t("share") || "Share"}
        className="w-14 h-14 rounded-full bg-[var(--surface-subtle)] hover:bg-[var(--divider)] flex items-center justify-center text-[var(--text-primary)] transition active:scale-[0.96]"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.7 10.7l6.6-3.4M8.7 13.3l6.6 3.4" />
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute bottom-full mb-2 z-50 min-w-[200px] rounded-2xl bg-[var(--surface)] border border-[var(--divider)] shadow-2xl overflow-hidden"
          style={direction === "rtl" ? { right: 0 } : { left: 0 }}
        >
          <a
            href={waHref()}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 text-[14px] text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition"
          >
            WhatsApp
          </a>
          <button
            type="button"
            onClick={handleCopy}
            className="w-full flex items-center gap-3 px-4 py-3 text-[14px] text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition text-start"
          >
            {copied ? t("linkCopied") || "Link copied" : t("copyLink") || "Copy link"}
          </button>
          <a
            href={xHref()}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 text-[14px] text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition"
          >
            X
          </a>
          <a
            href={fbHref()}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 text-[14px] text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition"
          >
            Facebook
          </a>
        </div>
      )}
    </div>
  );
}
