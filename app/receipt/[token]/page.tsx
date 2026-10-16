import { fetchReceipt, fetchRestaurant } from "@/services/api";
import { getWebsiteV3SiteContext } from "@/lib/websiteV3PageContext";
import { resolveCanonicalWebsitePage } from "@/lib/websiteV3Api";
import { mergeWebsiteConfigWithPageAppearance } from "@/lib/websiteV3Appearance";
import { ReceiptClient, ReceiptUnavailable } from "@/components/ReceiptClient";

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ pageSlug?: string | string[] }>;
};

export default async function ReceiptPage(props: PageProps) {
  const params = await props.params;
  const search = await props.searchParams;
  const pageSlug = typeof search?.pageSlug === "string" ? search.pageSlug : "";
  try {
    const receipt = await fetchReceipt(params.token);

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

export const metadata = {
  title: "Receipt",
  description: "View your order receipt",
  // A receipt is personal, and its link is guessable to anyone who sees it
  // once. Keep it out of every index.
  robots: { index: false, follow: false },
};
