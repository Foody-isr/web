"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  DEFAULT_CONFIRMATION_CONFIG,
} from "@/components/ConfirmationActions";
import type {
  OrderDeliveryInfo,
  OrderResponse,
} from "@/lib/types";
import { ConfirmationPageClient } from "@/components/ConfirmationPageClient";
import { useQuery } from "@tanstack/react-query";
import { useCommercePreview } from "@/components/CommercePreviewProvider";
import { commerceSampleLines } from "@/lib/preview/commerceSample";
import { lineTotal } from "@/lib/cart";
import { useI18n } from "@/lib/i18n";
import { fetchRestaurant } from "@/services/api";

/**
 * Preview-only post-order page. The foodyadmin Confirmation editor loads this
 * route in an iframe and streams the draft ConfirmationConfig over postMessage.
 * NOT linked from anywhere — owner-facing preview only.
 *
 * Layout mirrors ConfirmationPageClient: header, small recap card, configured
 * action buttons, FAQ. No live order status timeline (that's on /tracking).
 */
function PreviewContent() {
  const searchParams = useSearchParams();
  const { locale } = useI18n();
  const sampleLines = commerceSampleLines(locale);
  const restaurantId = searchParams.get("restaurantId") || "demo";
  const { draft } = useCommercePreview();
  const draftConfig = draft?.checkoutConfig?.confirmation;
  const orderType = searchParams.get("orderType") === "pickup" ? "pickup" : "delivery";
  const config = draftConfig ?? DEFAULT_CONFIRMATION_CONFIG;
  const { data: restaurant } = useQuery({
    queryKey: ["confirmation-preview-restaurant", restaurantId],
    queryFn: () => fetchRestaurant(restaurantId),
    enabled: restaurantId !== "demo",
  });

  // Mirrors the "Your information" card on the real page, so the owner sees
  // in the editor that the customer gets their own input read back.
  const mockOrder = {
    orderId: "1234",
    total: sampleLines.reduce((sum, line) => sum + lineTotal(line), 0),
    items: sampleLines.map(line => ({ id: line.id, menuItemId: line.item.id,
      name: line.item.name, quantity: line.quantity, total: lineTotal(line), details: [] })),
    currency: "ILS",
    orderType,
    orderStatus: "accepted",
    paymentStatus: "paid",
  } as OrderResponse;

  const mockOrderId = "1234";
  const mockOrderCtx = {
    orderId: mockOrderId,
    restaurantId,
    receiptToken: "demo",
    menuHref: `/r/${restaurantId}/order`,
  };

  // Build a fake delivery info object from the live toggles so the owner can
  // see what the delivery card will look like as they edit. The card itself
  // gates each field on presence, so flipping a toggle off makes the matching
  // row disappear without us doing anything else.
  const mockDelivery = useMemo<OrderDeliveryInfo | null>(() => {
    const d = config.delivery;
    if (!d) return null;
    const info: OrderDeliveryInfo = {};
    if (d.show_courier) {
      info.courierName = "David";
      info.courierPhone = "+972 50 123 4567";
    }
    if (d.show_eta) {
      info.etaStart = "12:00";
      info.etaEnd = "12:30";
    }
    if (d.note && d.note.trim()) {
      info.note = d.note.trim();
    }
    return Object.keys(info).length > 0 ? info : null;
  }, [config.delivery]);

  return (
    <ConfirmationPageClient
      key={locale + orderType + JSON.stringify(mockDelivery)}
      order={{ ...mockOrder, currency: restaurant?.currency ?? "ILS", delivery: orderType === "delivery" ? mockDelivery : null }}
      orderId={mockOrderId}
      restaurantId={restaurantId}
      confirmationConfig={config}
      checkoutConfig={draft?.checkoutConfig}
      menuHref={mockOrderCtx.menuHref}
      restaurantName={restaurant?.name || "Foody Demo"}
      logoUrl={restaurant?.logoUrl}
      restaurantPhone={restaurant?.phone}
      receiptToken="preview"
      preview
    />
  );
}

export default function ConfirmationPreviewPage() {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <PreviewContent />
    </Suspense>
  );
}
