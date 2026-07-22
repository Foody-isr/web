import { fetchOrder, fetchRestaurant } from "@/services/api";
import { ConfirmationPageClient } from "@/components/ConfirmationPageClient";
import { PwaHead } from "@/components/PwaHead";

type PageProps = {
  params: { orderId: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

/**
 * Post-order confirmation page. This is where the checkout flow lands users
 * after their order is created. Renders the owner-configured action buttons,
 * FAQ, and a small order recap — but NOT the live status timeline (that
 * lives at /order/tracking/[orderId] and is reachable via the "track_order"
 * action button rendered here).
 */
export default async function Page({ params, searchParams }: PageProps) {
  const restaurantId =
    typeof searchParams?.restaurantId === "string" ? searchParams.restaurantId : "";
  const tableId = typeof searchParams?.tableId === "string" ? searchParams.tableId : undefined;
  const sessionId = typeof searchParams?.sessionId === "string" ? searchParams.sessionId : undefined;

  if (!restaurantId) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="card p-6 text-center space-y-2">
          <h1 className="text-xl font-bold">Missing restaurant</h1>
          <p className="text-[var(--text-muted)]">
            The confirmation URL needs ?restaurantId=&lt;id&gt;.
          </p>
        </div>
      </main>
    );
  }

  const order = await fetchOrder(params.orderId, restaurantId);

  let menuHref: string | undefined;
  let confirmationConfig: import("@/lib/types").ConfirmationConfig | null = null;
  let restaurantName = "";
  let logoUrl: string | undefined;
  let slug = restaurantId;
  let brandColor = "#EB5204";
  try {
    const restaurant = await fetchRestaurant(restaurantId);
    slug = restaurant.slug || restaurantId;
    menuHref = tableId
      ? `/r/${slug}/table/${tableId}${sessionId ? `?sessionId=${sessionId}` : ""}`
      : `/r/${slug}/order`;
    confirmationConfig = restaurant.websiteConfig?.checkoutConfig?.confirmation ?? null;
    restaurantName = restaurant.name;
    logoUrl = restaurant.logoUrl;
    brandColor = restaurant.websiteConfig?.brandColor || brandColor;
  } catch {
    // Non-critical — confirmation page still works with defaults
  }

  return (
    <>
      {/* Make this page installable so the InstallPrompt below can offer it.
          This route is outside /r/*, so it needs its own PWA head tags. */}
      <PwaHead slug={slug} primaryColor={brandColor} title={restaurantName || "Foody"} logoUrl={logoUrl} />
      <ConfirmationPageClient
      order={order}
      orderId={params.orderId}
      restaurantId={restaurantId}
      tableId={tableId}
      sessionId={sessionId}
      menuHref={menuHref}
      receiptToken={order.receiptToken}
      confirmationConfig={confirmationConfig}
      restaurantName={restaurantName}
      logoUrl={logoUrl}
    />
    </>
  );
}
