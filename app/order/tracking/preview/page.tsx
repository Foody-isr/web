"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ConfirmationActions, ConfirmationFAQList, ConfirmationHeader, usePreviewConfirmationConfig } from "@/components/ConfirmationActions";
import { useI18n } from "@/lib/i18n";

/**
 * Preview-only post-order page. The foodyadmin Confirmation editor loads this
 * route in an iframe and streams the draft ConfirmationConfig over postMessage.
 * NOT linked from anywhere — owner-facing preview only.
 */
function PreviewContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const restaurantId = searchParams.get("restaurantId") || "demo";
  const config = usePreviewConfirmationConfig(true);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const mockOrderId = "1234";
  const mockOrderCtx = { orderId: mockOrderId, restaurantId, receiptToken: "demo", menuHref: `/r/${restaurantId}/order` };

  return (
    <main className="min-h-screen p-6 space-y-5 max-w-lg mx-auto bg-[var(--bg-page)]">
      <div>
        <p className="text-sm text-[var(--text-muted)] mb-1">
          {t("order")} #{mockOrderId}
        </p>
        <ConfirmationHeader
          config={config}
          fallbackTitle={t("trackYourOrder")}
          fallbackSubtitle="$ 0.00"
        />
      </div>

      <div className="rounded-xl border border-dashed border-[var(--divider)] p-4 text-center text-xs text-[var(--text-muted)]">
        Aperçu — statut de la commande
      </div>

      {mounted && (
        <div className="space-y-4 pt-1">
          <ConfirmationActions config={config} ctx={mockOrderCtx} />
          <ConfirmationFAQList config={config} />
        </div>
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
