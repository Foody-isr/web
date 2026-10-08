import type { CheckoutConfig } from "@/lib/types";
import type { PageAppearanceOverrides } from "@/lib/websiteV3Api";

export interface CommercePreviewDraft {
  checkoutConfig: CheckoutConfig | null;
  siteConfig?: Record<string, unknown>;
  appearanceOverrides: PageAppearanceOverrides | null;
  googlePlacesApiKey?: string;
  revision?: number;
  contentRevision?: number;
  activePageKey?: string;
  device?: "desktop" | "mobile";
}

/** Validates the commerce message envelope; origin/source checks remain with the receiver. */
export function readCommercePreviewDraft(value: unknown): CommercePreviewDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (data.type !== "foody-checkout-preview") return null;
  for (const key of ["checkoutConfig", "siteConfig", "appearanceOverrides"]) {
    if (data[key] != null && (typeof data[key] !== "object" || Array.isArray(data[key]))) return null;
  }
  for (const key of ["revision", "contentRevision"]) {
    if (data[key] !== undefined && (!Number.isSafeInteger(data[key]) || Number(data[key]) < 0)) return null;
  }
  if (data.activePageKey !== undefined && typeof data.activePageKey !== "string") return null;
  if (data.device !== undefined && data.device !== "desktop" && data.device !== "mobile") return null;
  return {
    checkoutConfig: (data.checkoutConfig as CheckoutConfig | null) ?? null,
    siteConfig: data.siteConfig as Record<string, unknown> | undefined,
    appearanceOverrides: (data.appearanceOverrides as PageAppearanceOverrides | null) ?? null,
    googlePlacesApiKey: typeof data.googlePlacesApiKey === "string" ? data.googlePlacesApiKey : undefined,
    revision: data.revision as number | undefined,
    contentRevision: data.contentRevision as number | undefined,
    activePageKey: data.activePageKey as string | undefined,
    device: data.device as CommercePreviewDraft["device"],
  };
}
