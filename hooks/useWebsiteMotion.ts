"use client";
import { useEffect, useState } from "react";

/** Pauses website motion while editing, in background tabs and for reduced motion. */
export function useWebsiteMotion(motion?: unknown) {
  const settings =
    motion && typeof motion === "object"
      ? (motion as Record<string, unknown>)
      : {};
  const enabled = settings.enabled !== false;
  const mobile = settings.mobile !== false;
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const viewport = window.matchMedia("(max-width: 767px)");
    const update = () =>
      setAllowed(
        enabled &&
          (mobile || !viewport.matches) &&
          !preference.matches &&
          !document.hidden &&
          document.documentElement.dataset.websiteEditor !== "edit",
      );
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-website-editor"],
    });
    preference.addEventListener("change", update);
    viewport.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      observer.disconnect();
      preference.removeEventListener("change", update);
      viewport.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [enabled, mobile]);
  return allowed;
}
