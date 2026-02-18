"use client";

import { useI18n } from "@/lib/i18n";
import { useState, useRef, useEffect } from "react";

type Props = {
  variant?: "default" | "transparent";
};

const locales = ["en", "he", "fr"] as const;
const flags: Record<string, string> = { en: "🇬🇧", he: "🇮🇱", fr: "🇫🇷" };
const labels: Record<string, string> = { en: "English", he: "עברית", fr: "Français" };

export function LanguageToggle({ variant = "default" }: Props) {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition shadow-sm ${
          variant === "transparent"
            ? "bg-black/30 backdrop-blur-md text-white border border-white/20 hover:bg-black/50"
            : "bg-[var(--surface)] border border-[var(--divider)] text-[var(--text)] hover:border-brand hover:bg-[var(--surface-subtle)]"
        }`}
      >
        <span className="text-base">{flags[locale]}</span>
        <span>{labels[locale]}</span>
      </button>

      {open && (
        <div
          className={`absolute right-0 top-full mt-2 min-w-[160px] rounded-xl overflow-hidden shadow-lg border z-50 ${
            variant === "transparent"
              ? "bg-black/70 backdrop-blur-md border-white/20"
              : "bg-[var(--surface)] border-[var(--divider)]"
          }`}
        >
          {locales.map((l) => (
            <button
              key={l}
              onClick={() => {
                setLocale(l);
                setOpen(false);
              }}
              className={`flex items-center gap-3 w-full px-4 py-3 text-sm font-medium transition ${
                variant === "transparent"
                  ? `text-white hover:bg-white/10 ${l === locale ? "bg-white/15" : ""}`
                  : `text-[var(--text)] hover:bg-[var(--surface-subtle)] ${l === locale ? "bg-[var(--surface-subtle)]" : ""}`
              }`}
            >
              <span className="text-base">{flags[l]}</span>
              <span>{labels[l]}</span>
              {l === locale && <span className="ml-auto text-brand">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
