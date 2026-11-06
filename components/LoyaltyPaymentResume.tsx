"use client";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { fetchLoyaltyCheckout } from "@/services/api";
import { useGuestAccount } from "@/store/useGuestAccount";
import { CustomerSignIn } from "./CustomerSignIn";

/** Reopen only a recorded owned hosted page; reading this panel never calls a bank. */
export function LoyaltyPaymentResume({
  restaurant,
  request,
  order,
}: {
  restaurant: number;
  request: string;
  order: string;
}) {
  const { t } = useI18n(),
    account = useGuestAccount((s) => s.account),
    status = useGuestAccount((s) => s.status);
  const query = useQuery({
    queryKey: ["loyalty-payment-resume", restaurant, request, account?.id],
    queryFn: () => fetchLoyaltyCheckout(restaurant, account!.id, request),
    enabled: status === "authenticated" && !!account,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
  });
  if (status === "anonymous")
    return (
      <section data-loyalty-payment-resume className="space-y-4 py-6">
        <p>{t("loyaltySignInHint")}</p>
        <CustomerSignIn variant="entry" />
      </section>
    );
  return (
    <section data-loyalty-payment-resume className="space-y-4 py-6">
      {query.isPending ? (
        <p role="status">{t("loading")}</p>
      ) : query.isError || query.data?.orderId !== order ? (
        <p role="alert">{t("loyaltyReadError")}</p>
      ) : query.data.paymentStatus === "paid" ? (
        <p>{t("loyaltyCheckoutPaid")}</p>
      ) : query.data.loyaltyPaymentUrl ? (
        <button
          type="button"
          className="commerce-primary"
          disabled={query.isFetching}
          onClick={async () => {
            const expected = account?.id;
            const fresh = await query.refetch();
            if (
              !fresh.isError &&
              fresh.data?.orderId === order &&
              fresh.data.paymentStatus !== "paid" &&
              fresh.data.loyaltyPaymentUrl &&
              useGuestAccount.getState().account?.id === expected
            ) {
              window.location.assign(fresh.data.loyaltyPaymentUrl);
            }
          }}
        >
          {t("loyaltyCheckoutResumePayment")}
        </button>
      ) : (
        <p>{t("loyaltyCheckoutPaymentReview")}</p>
      )}
      <button
        type="button"
        className="commerce-secondary"
        disabled={query.isFetching || status !== "authenticated"}
        onClick={() => void query.refetch()}
      >
        {t("loyaltyRefresh")}
      </button>
    </section>
  );
}
