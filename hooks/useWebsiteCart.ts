"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";

/** Shares hover intent between the header cart icon and its detached mini-cart. */
export function useWebsiteCart() {
  const [open, setOpened] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDialogElement>(null);
  const hoverOpened = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelClose = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const setOpen = useCallback(
    (value: boolean) => {
      cancelClose();
      hoverOpened.current = false;
      setOpened(value);
    },
    [cancelClose],
  );
  const enterTrigger = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (
        event.pointerType !== "mouse" ||
        !window.matchMedia(
          "(min-width: 768px) and (hover: hover) and (pointer: fine)",
        ).matches
      )
        return;
      cancelClose();
      triggerRef.current = event.currentTarget;
      hoverOpened.current = true;
      setOpened(true);
    },
    [cancelClose],
  );
  const scheduleClose = useCallback(() => {
    cancelClose();
    if (!hoverOpened.current) return;
    timer.current = setTimeout(() => {
      if (!panelRef.current?.contains(document.activeElement)) {
        hoverOpened.current = false;
        setOpened(false);
      }
    }, 250);
  }, [cancelClose]);
  useEffect(() => cancelClose, [cancelClose]);
  return {
    open,
    setOpen,
    triggerRef,
    panelRef,
    enterTrigger,
    cancelClose,
    scheduleClose,
  };
}

/** Interaction contract shared by header-owned and order-page-owned mini-carts. */
export type WebsiteCartInteraction = ReturnType<typeof useWebsiteCart>;
