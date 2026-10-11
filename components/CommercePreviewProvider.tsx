"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { readCommercePreviewDraft, type CommercePreviewDraft } from "@/lib/preview/commerceProtocol";
import { isAllowedWebsiteV3AdminOrigin, resolveWebsiteV3AdminOrigin } from "@/lib/preview/websiteV3Protocol";

const PreviewContext = createContext<{ active: boolean; draft: CommercePreviewDraft | null }>({ active: false, draft: null });

/** Shares one trusted draft and acknowledgement across every commerce preview screen. */
export function CommercePreviewProvider({ children }: { children: ReactNode }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const active = params.get("preview") === "1" || pathname === "/order/confirmation/preview";
  const [received, setReceived] = useState<{ draft: CommercePreviewDraft; origin: string } | null>(null);
  useEffect(() => {
    if (!active || window.parent === window) return;
    const policy = { currentOrigin: window.location.origin, configuredAdminOrigin: process.env.NEXT_PUBLIC_ADMIN_ORIGIN };
    const adminOrigin = resolveWebsiteV3AdminOrigin(policy);
    if (!adminOrigin) return;
    function onMessage(event: MessageEvent) {
      if (event.source !== window.parent || !isAllowedWebsiteV3AdminOrigin(event.origin, policy)) return;
      const data = readCommercePreviewDraft(event.data);
      if (!data) return;
      setReceived(current => {
        if (typeof data.revision === "number" && typeof current?.draft.revision === "number" && data.revision < current.draft.revision) return current;
        return { origin: event.origin, draft: data };
      });
    }
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "foody-checkout-preview-ready" }, adminOrigin);
    return () => window.removeEventListener("message", onMessage);
  }, [active]);

  // Acknowledge after React commits the received draft, as on the menu preview.
  useEffect(() => {
    if (!active || !received) return;
    const { draft, origin } = received;
    window.parent.postMessage({ type: "foody-checkout-preview-applied", revision: draft.revision,
      contentRevision: draft.contentRevision, activePageKey: draft.activePageKey, device: draft.device }, origin);
  }, [active, received]);

  // Keep links inside the sample screen; no navigation to a real order/account.
  useEffect(() => {
    if (!active) return;
    const blockLink = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest("a")) event.preventDefault();
    };
    document.addEventListener("click", blockLink, true);
    return () => document.removeEventListener("click", blockLink, true);
  }, [active]);
  return <PreviewContext.Provider value={{ active, draft: active ? received?.draft ?? null : null }}>{children}</PreviewContext.Provider>;
}

/** Reads the draft supplied by the commerce editor, without touching persisted guest state. */
export function useCommercePreview() { return useContext(PreviewContext); }
