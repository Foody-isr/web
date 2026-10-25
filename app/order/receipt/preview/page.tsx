"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ReceiptClient } from "@/components/ReceiptClient";
import { useCommercePreview } from "@/components/CommercePreviewProvider";
import { commerceSampleLines } from "@/lib/preview/commerceSample";
import { useI18n } from "@/lib/i18n";
import { fetchRestaurant, type ReceiptData } from "@/services/api";

function PreviewContent() {
  const params = useSearchParams();
  const restaurantId = params.get("restaurantId") || "demo";
  const { locale } = useI18n();
  const { draft } = useCommercePreview();
  const { data: restaurant } = useQuery({
    queryKey: ["receipt-preview-restaurant", restaurantId],
    queryFn: () => fetchRestaurant(restaurantId),
    enabled: restaurantId !== "demo",
  });
  const lines = commerceSampleLines(locale);
  const form =
    params.get("orderType") === "pickup"
      ? draft?.checkoutConfig?.pickup
      : draft?.checkoutConfig?.delivery;
  const customFields = Object.fromEntries(
    (form?.fields ?? [])
      .filter((field) => field.kind === "custom" && field.enabled)
      .map((field) => [
        field.id,
        field.type === "checkbox"
          ? true
          : field.type === "select"
            ? field.options?.[0]?.value || ""
            : { fr: "Exemple", en: "Example", he: "דוגמה" }[locale],
      ]),
  );
  const draftLogo = draft?.siteConfig?.restaurant_logo_url;
  const receipt: ReceiptData = {
    restaurant: {
      id: Number(restaurant?.id) || 1,
      name: restaurant?.name || "Foody Demo",
      address: restaurant?.address || "",
      phone: restaurant?.phone || "",
      logo_url: typeof draftLogo === "string" ? draftLogo : restaurant?.logoUrl,
    },
    order: {
      id: 1234,
      receipt_token: "preview",
      customer_name: "Alex",
      customer_phone: "",
      custom_fields: customFields,
      order_type: params.get("orderType") === "pickup" ? "pickup" : "delivery",
      order_source: "website_order",
      order_status: "accepted",
      payment_status: "paid",
      created_at: "2026-10-16T12:20:00Z",
      total_amount: lines.reduce(
        (sum, line) => sum + line.item.price * line.quantity,
        0,
      ),
    },
    items: lines.map((line, index) => ({
      id: index + 1,
      name: line.item.name,
      quantity: line.quantity,
      unit_price: line.item.price,
      total: line.item.price * line.quantity,
    })),
  };
  return (
    <ReceiptClient
      receipt={receipt}
      checkoutConfig={draft?.checkoutConfig}
      appearance={draft?.appearanceOverrides}
      currency={restaurant?.currency}
      timezone={restaurant?.timezone}
      preview
    />
  );
}

/** Isolated receipt preview driven by the same trusted draft as checkout. */
export default function ReceiptPreviewPage() {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <PreviewContent />
    </Suspense>
  );
}
