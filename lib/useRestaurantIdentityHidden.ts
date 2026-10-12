"use client";

import { useEffect, useState, type RefObject } from "react";

/** Reports when scrolling has hidden every restaurant name/logo above the order toolbar. */
export function useRestaurantIdentityHidden(
  ref: RefObject<HTMLElement | null>,
  restaurantName?: string,
): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const toolbar = ref.current;
    if (!toolbar || !restaurantName) return;
    const scope =
      toolbar.closest("main") ??
      toolbar.closest(".website-storefront") ??
      document;
    const chrome = toolbar.closest<HTMLElement>(".order-menu-chrome");
    let frame = 0;
    const update = () => {
      const bounds = chrome?.getBoundingClientRect();
      const identities = scope.querySelectorAll<HTMLElement>(
        "[data-restaurant-identity], [data-navbar-brand], [data-header-element=logo]",
      );
      const visible = Array.from(identities).some((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          rect.bottom > 0 &&
          rect.top < window.innerHeight &&
          rect.right > 0 &&
          rect.left < window.innerWidth &&
          style.visibility !== "hidden" &&
          style.opacity !== "0"
        );
      });
      setHidden(
        window.scrollY > 0 &&
          (identities.length ? !visible : !!bounds && bounds.top <= 1),
      );
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    const observer = new ResizeObserver(schedule);
    observer.observe(toolbar);
    if (scope instanceof HTMLElement) observer.observe(scope);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [ref, restaurantName]);
  return hidden;
}
