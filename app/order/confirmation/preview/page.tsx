"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ConfirmationActions,
  ConfirmationFAQList,
  ConfirmationHeader,
  DEFAULT_CONFIRMATION_CONFIG,
  usePreviewConfirmationConfig,
} from "@/components/ConfirmationActions";
import { ConfirmationDeliveryCard } from "@/components/ConfirmationDeliveryCard";
import { CustomerInfoCard } from "@/components/CustomerInfoCard";
import type { CheckoutConfig, OrderDeliveryInfo, OrderResponse } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

/**
 * Preview-only post-order page. The foodyadmin Confirmation editor loads this
 * route in an iframe and streams the draft ConfirmationConfig over postMessage.
 * NOT linked from anywhere — owner-facing preview only.
 *
 * Layout mirrors ConfirmationPageClient: header, small recap card, configured
 * action buttons, FAQ. No live order status timeline (that's on /tracking).
 */
function PreviewContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const restaurantId = searchParams.get("restaurantId") || "demo";
  const draftConfig = usePreviewConfirmationConfig(true);
  const config = draftConfig ?? DEFAULT_CONFIRMATION_CONFIG;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Mirrors the "Your information" card on the real page, so the owner sees
  // in the editor that the customer gets their own input read back.
  const mockOrder = {
    orderId: "1234",
    total: 525,
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
        { id: "code_immeuble", kind: "custom", enabled: true, required: false,
          label: { fr: "Code immeuble", he: "קוד כניסה", en: "Building code" } },
        { id: "allergies", kind: "custom", enabled: true, required: false,
          label: { fr: "Allergies", he: "אלרגיות", en: "Allergies" } },
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
    <main className="min-h-screen p-6 space-y-6 max-w-lg mx-auto bg-[var(--bg-page)]">
      <div>
        <p className="text-sm text-[var(--text-muted)] mb-1">
          {t("order")} #{mockOrderId}
        </p>
        <ConfirmationHeader
          config={draftConfig}
          fallbackTitle={t("orderConfirmedTitle") || "Merci pour votre commande"}
          fallbackSubtitle={t("orderConfirmedSubtitle") || "$ 0.00"}
        />
      </div>

      <div className="card p-4 space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--text-muted)]">{t("total")}</span>
          <span className="font-semibold">$ 0.00</span>
        </div>
      </div>

      <CustomerInfoCard
        address={{
          street: mockOrder.deliveryAddress,
          city: mockOrder.deliveryCity,
          floor: mockOrder.deliveryFloor,
          apt: mockOrder.deliveryApt,
          entryCode: mockOrder.deliveryEntryCode,
          notes: mockOrder.deliveryNotes,
        }}
        customFields={mockOrder.customFields}
        checkoutConfig={mockCheckoutConfig}
      />

      {mounted && (
        <>
          <ConfirmationDeliveryCard delivery={mockDelivery} orderType="delivery" />
          <ConfirmationActions config={config} ctx={mockOrderCtx} />
          <ConfirmationFAQList config={config} />
        </>
      )}
    </main>
  );
}

export default function ConfirmationPreviewPage() {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <PreviewContent />
    </Suspense>
  );
}
