"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchCustomerCheckoutProfile } from "@/services/api";
import { useGuestAccount } from "@/store/useGuestAccount";

/** Keeps remembered checkout details isolated by customer and restaurant. */
export function useCustomerCheckoutProfile(restaurantId: string, enabled = true) {
  const accountId = useGuestAccount(state => state.account?.id);
  const status = useGuestAccount(state => state.status);
  return useQuery({
    queryKey: ["customer-checkout-profile", restaurantId, accountId],
    queryFn: () => fetchCustomerCheckoutProfile(restaurantId),
    enabled: enabled && !!restaurantId && !!accountId && status === "authenticated",
    staleTime: 30_000,
    retry: false,
  });
}
