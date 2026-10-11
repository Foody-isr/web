"use client";

import { type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useOrderRoutePage } from "@/hooks/useOrderRoutePage";
import { useResolvedTheme } from "@/lib/themes/useResolvedTheme";
import { PageAppearanceScope } from "@/components/PageAppearanceScope";
import { useCommercePreview } from "@/components/CommercePreviewProvider";

/** Keeps confirmation and its preview consistent with the selected confirmation style. */
export function CommerceAppearanceScope({
  restaurantId,
  children,
}: {
  restaurantId: string;
  children: ReactNode;
}) {
  const params = useSearchParams();
  const { active, draft } = useCommercePreview();
  const { data: page } = useOrderRoutePage(
    restaurantId,
    params.get("pageSlug") || "",
    !active,
  );
  const { config, resolved } = useResolvedTheme();
  return (
    <PageAppearanceScope
      surface="checkout"
      commerceScreen="confirmation"
      appearance={active ? draft?.appearanceOverrides : page?.appearance_overrides}
      palette={{ ...resolved?.theme.tokens.colors, ...config?.customPalette }}
    >
      {children}
    </PageAppearanceScope>
  );
}
