"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  DEFAULT_CONFIRMATION_CONFIG,
  usePreviewConfirmationConfig,
} from "@/components/ConfirmationActions";
import type {
  CheckoutConfig,
  OrderDeliveryInfo,
  OrderResponse,
} from "@/lib/types";
import { ConfirmationPageClient } from "@/components/ConfirmationPageClient";
import { useQuery } from "@tanstack/react-query";
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
  const restaurantId = searchParams.get("restaurantId") || "demo";
  const draftConfig = usePreviewConfirmationConfig(true);
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
    total: 24,
    items: [
      {
        id: "demo",
        menuItemId: "1",
        name: "Demo sandwich",
        quantity: 2,
        total: 24,
        details: [],
      },
    ],
    currency: "ILS",
    orderType: "delivery",
    orderStatus: "accepted",
    paymentStatus: "paid",
    deliveryAddress: "Ma'on 5",
    deliveryCity: "Tel Aviv",
    deliveryFloor: "7",
    deliveryApt: "172",
    deliveryEntryCode: "4417B",
    deliveryNotes: "Bâtiment 1",
    customFields: { code_immeuble: "4417B", allergies: "Arachides" },
  } as OrderResponse;

  const mockCheckoutConfig = {
    delivery: {
      require_auth: false,
      fields: [
        {
          id: "code_immeuble",
          kind: "custom",
          enabled: true,
          required: false,
          label: { fr: "Code immeuble", he: "קוד כניסה", en: "Building code" },
        },
        {
          id: "allergies",
          kind: "custom",
          enabled: true,
          required: false,
          label: { fr: "Allergies", he: "אלרגיות", en: "Allergies" },
        },
      ],
    },
    pickup: null,
  } as unknown as CheckoutConfig;

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
      order={{ ...mockOrder, delivery: mockDelivery }}
      orderId={mockOrderId}
      restaurantId={restaurantId}
      confirmationConfig={config}
      checkoutConfig={mockCheckoutConfig}
      menuHref={mockOrderCtx.menuHref}
      restaurantName={restaurant?.name || "Foody Demo"}
      logoUrl={restaurant?.logoUrl}
      restaurantPhone={restaurant?.phone}
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
