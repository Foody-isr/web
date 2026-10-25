import type { Metadata } from "next";
import { cache } from "react";
import { fetchReceipt, fetchRestaurant } from "@/services/api";
import { buildOrderLinkMetadata } from "@/lib/orderLinkMetadata";
import { requestOrigin } from "@/lib/site-url";
import { getWebsiteV3SiteContext } from "@/lib/websiteV3PageContext";
import { resolveCanonicalWebsitePage } from "@/lib/websiteV3Api";
import { mergeWebsiteConfigWithPageAppearance } from "@/lib/websiteV3Appearance";
import { ReceiptClient, ReceiptUnavailable } from "@/components/ReceiptClient";

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ pageSlug?: string | string[] }>;
};

const getReceipt = cache(fetchReceipt);

/** Resolves the preview restaurant from the authorized receipt, never from query parameters. */
export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { token } = await props.params;
  const origin = await requestOrigin();
  try {
    const receipt = await getReceipt(token);
    const restaurant = await fetchRestaurant(String(receipt.restaurant.id)).catch(
      () => ({ name: receipt.restaurant.name, logoUrl: receipt.restaurant.logo_url }),
    );
    return buildOrderLinkMetadata("receipt", restaurant, origin);
  } catch {
    return buildOrderLinkMetadata("receipt", null, origin);
  }
}

export default async function ReceiptPage(props: PageProps) {
  const params = await props.params;
  const search = await props.searchParams;
  const pageSlug = typeof search?.pageSlug === "string" ? search.pageSlug : "";
  try {
    const receipt = await getReceipt(params.token);

    // Only published presentation is loaded; receipt access stays token-scoped.
    let restaurant: import("@/lib/types").Restaurant | null = null;
    let menuSlug = "order";
    let appearance:
      | import("@/lib/websiteV3Api").PageAppearanceOverrides
      | null = null;
    try {
      const context = await getWebsiteV3SiteContext(
        String(receipt.restaurant.id),
      );
      restaurant = context.restaurant;
      const page =
        context.pages.find(
          (page) => page.type === "order" && page.slug === pageSlug,
        ) ?? resolveCanonicalWebsitePage(context.pages, "order");
      appearance = page?.appearance_overrides ?? null;
      if (page && !page.is_default) menuSlug = page.slug;
    } catch {
      // Presentation is optional; the token-authorized receipt stays available.
      restaurant = await fetchRestaurant(String(receipt.restaurant.id)).catch(
        () => null,
      );
    }
    const config = mergeWebsiteConfigWithPageAppearance(
      restaurant?.websiteConfig,
      appearance,
      "order",
    );
    const slug = restaurant?.slug || String(receipt.restaurant.id);
    return (
      <ReceiptClient
        receipt={receipt}
        checkoutConfig={config?.checkoutConfig}
        websiteConfig={config}
        appearance={appearance}
        currency={restaurant?.currency}
        timezone={restaurant?.timezone}
        menuHref={`/r/${slug}/${encodeURIComponent(menuSlug)}`}
        historyHref={`/r/${slug}/orders`}
      />
    );
  } catch {
    return <ReceiptUnavailable />;
  }
}
