"use client";

import { createContext, useContext } from "react";

export type OpenCartOverlay = (href: string, options?: { replace?: boolean }) => boolean;

/** Navigation supplied by a mounted restaurant page or checkout. */
export const CartNavigationContext = createContext<OpenCartOverlay | undefined>(undefined);

/** Opens a local cart when the current page already owns its restaurant data. */
export function useCartOverlayNavigation() {
  return useContext(CartNavigationContext);
}
