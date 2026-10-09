"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { useWebsiteMotion } from "@/hooks/useWebsiteMotion";
import {
  entranceFrames,
  hoverFrames,
  websiteMotion,
} from "@/lib/websiteMotion";

/** Applies opt-in entry, media and button motion to a section's semantic parts. */
export function SectionMotion({
  settings,
  children,
}: {
  settings: Record<string, unknown>;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const allowed = useWebsiteMotion();
  const key = JSON.stringify(settings.motion ?? null);
  useEffect(() => {
    const container = root.current;
    const motion = websiteMotion(JSON.parse(key));
    if (!container || !allowed || !motion.enabled) return;
    const mobile = window.matchMedia("(max-width: 767px)");
    let cleanup = () => {};
    const setup = () => {
      cleanup();
      if (mobile.matches && !motion.mobile) return;
      const entrance =
        mobile.matches && motion.mobileEntrance !== "inherit"
          ? motion.mobileEntrance
          : motion.entrance;
      const animations = new Set<Animation>();
      const disposers: (() => void)[] = [];
      const animate = (
        element: HTMLElement,
        frames: Keyframe[],
        options: KeyframeAnimationOptions,
      ) => {
        const animation = element.animate(frames, options);
        animations.add(animation);
        animation.onfinish = () => {
          if (options.fill !== "forwards") {
            animation.cancel();
            animations.delete(animation);
          }
        };
        return animation;
      };
      // Separate wrappers keep entrance, image hover and scroll transforms independent.
      const parts = Array.from(
        container.querySelectorAll<HTMLElement>(
          '[data-motion-part="media"], [data-motion-part="text"]',
        ),
      );
      const targets =
        entrance === "split" && parts.length ? parts : [container];
      let entered = false;
      const reveal = () => {
        if (entrance === "none" || entered) return;
        entered = true;
        targets.forEach((target) => {
          const style =
            entrance === "split"
              ? target.getBoundingClientRect().left + target.offsetWidth / 2 <
                container.getBoundingClientRect().left +
                  container.offsetWidth / 2
                ? "from_left"
                : "from_right"
              : entrance;
          animate(target, entranceFrames(style), {
            duration: motion.duration,
            delay: motion.delay,
            easing:
              style === "bounce" ? "cubic-bezier(.215,.61,.355,1)" : "ease",
            fill: "backwards",
          });
        });
      };
      let visible = false;
      let frame = 0;
      const media = Array.from(
        container.querySelectorAll<HTMLElement>('[data-motion-part="media"]'),
      );
      const parallaxTargets = media.length ? media : [container];
      const parallax =
        motion.parallax !== "none" &&
        (!mobile.matches || motion.parallaxMobile);
      const updateScroll = () => {
        frame = 0;
        if (!visible || !parallax) return;
        // The parent never moves; using its bounds avoids a scroll feedback loop.
        const box = container.parentElement!.getBoundingClientRect();
        const progress = Math.max(
          -1,
          Math.min(
            1,
            (window.innerHeight / 2 - (box.top + box.height / 2)) /
              ((window.innerHeight + box.height) / 2),
          ),
        );
        const offset =
          progress *
          motion.parallaxAmount *
          (motion.parallax === "up" ? -1 : 1);
        parallaxTargets.forEach((target) => {
          target.style.translate = `0 ${offset}px`;
        });
      };
      const scroll = () => {
        if (!frame && visible && parallax)
          frame = requestAnimationFrame(updateScroll);
      };
      const observer =
        typeof IntersectionObserver === "undefined"
          ? null
          : new IntersectionObserver(
              ([entry]) => {
                visible = entry.isIntersecting;
                if (visible) {
                  reveal();
                  scroll();
                } else if (motion.replay) entered = false;
              },
              { threshold: 0, rootMargin: "0px 0px -40px 0px" },
            );
      if (observer) observer.observe(container.parentElement || container);
      else {
        visible = true;
        reveal();
        scroll();
      }
      if (parallax) {
        window.addEventListener("scroll", scroll, { passive: true });
        window.addEventListener("resize", scroll);
      }
      const bindHover = (target: HTMLElement, style: string) => {
        if (style === "none") return;
        let current: Animation | undefined;
        const start = (event: Event) => {
          if (
            event.type === "pointerenter" &&
            !window.matchMedia("(hover: hover)").matches
          )
            return;
          current?.cancel();
          if (current) animations.delete(current);
          const finite = style === "push" || style === "wobble";
          current = animate(target, hoverFrames(style), {
            duration: style === "wobble" ? 1000 : 300,
            easing: style === "push" ? "linear" : "ease-in-out",
            fill: finite ? "none" : "forwards",
          });
        };
        const stop = () => {
          current?.cancel();
          if (current) animations.delete(current);
        };
        target.addEventListener("pointerenter", start);
        target.addEventListener("pointerleave", stop);
        const focusTarget =
          target.closest<HTMLElement>("a,button,[tabindex]") || target;
        focusTarget.addEventListener("focus", start);
        focusTarget.addEventListener("blur", stop);
        disposers.push(() => {
          stop();
          target.removeEventListener("pointerenter", start);
          target.removeEventListener("pointerleave", stop);
          focusTarget.removeEventListener("focus", start);
          focusTarget.removeEventListener("blur", stop);
        });
      };
      const bound = new Set<HTMLElement>();
      const bindNewTargets = () => {
        const bind = (selector: string, style: string) => {
          if (style === "none") return;
          container
            .querySelectorAll<HTMLElement>(selector)
            .forEach((target) => {
              if (bound.has(target)) return;
              bound.add(target);
              bindHover(target, style);
            });
        };
        bind('img, [role="img"][data-editor-field]', motion.mediaHover);
        bind(
          'button, [data-editor-field$="cta_text"], [data-motion-part="button"]',
          motion.buttonHover,
        );
      };
      bindNewTargets();
      // Product images can arrive after the public menu request completes.
      const contentObserver = new MutationObserver(bindNewTargets);
      if (motion.mediaHover !== "none" || motion.buttonHover !== "none")
        contentObserver.observe(container, { childList: true, subtree: true });
      cleanup = () => {
        observer?.disconnect();
        contentObserver.disconnect();
        cancelAnimationFrame(frame);
        window.removeEventListener("scroll", scroll);
        window.removeEventListener("resize", scroll);
        disposers.forEach((dispose) => dispose());
        animations.forEach((animation) => animation.cancel());
        parallaxTargets.forEach((target) => {
          target.style.removeProperty("translate");
        });
      };
    };
    setup();
    mobile.addEventListener("change", setup);
    return () => {
      cleanup();
      mobile.removeEventListener("change", setup);
    };
  }, [key, allowed]);
  return (
    <div
      ref={root}
      data-website-motion={settings.motion ? "configured" : undefined}
      data-motion-enabled={websiteMotion(settings.motion).enabled}
      data-motion-mobile={websiteMotion(settings.motion).mobile}
    >
      {children}
    </div>
  );
}
