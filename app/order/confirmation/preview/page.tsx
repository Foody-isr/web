"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ConfirmationActions,
  ConfirmationFAQList,
  ConfirmationHeader,
  DEFAULT_CONFIRMATION_CONFIG,
  usePreviewConfirmationConfig,
} from "@/components/ConfirmationActions";
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

  const mockOrderId = "1234";
  const mockOrderCtx = {
    orderId: mockOrderId,
    restaurantId,
    receiptToken: "demo",
    menuHref: `/r/${restaurantId}/order`,
  };

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

      {mounted && (
        <>
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
