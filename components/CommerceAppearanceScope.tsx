"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useOrderRoutePage } from "@/hooks/useOrderRoutePage";
import { useResolvedTheme } from "@/lib/themes/useResolvedTheme";
import { PageAppearanceScope } from "@/components/PageAppearanceScope";
import type { PageAppearanceOverrides } from "@/lib/websiteV3Api";

/** Keeps post-order screens and their builder preview in the menu's appearance scope. */
export function CommerceAppearanceScope({
  restaurantId,
  children,
}: {
  restaurantId: string;
  children: ReactNode;
}) {
  const params = useSearchParams();
  const { data: page } = useOrderRoutePage(
    restaurantId,
    params.get("pageSlug") || "",
  );
  const { config, resolved } = useResolvedTheme();
  const [draft, setDraft] = useState<PageAppearanceOverrides | null>(null);
  useEffect(() => {
    if (params.get("preview") !== "1") return;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "foody-checkout-preview") {
        setDraft(event.data.appearanceOverrides ?? null);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [params]);
  return (
    <PageAppearanceScope
      surface="checkout"
      appearance={draft ?? page?.appearance_overrides}
      palette={{ ...resolved?.theme.tokens.colors, ...config?.customPalette }}
    >
      {children}
    </PageAppearanceScope>
  );
}
