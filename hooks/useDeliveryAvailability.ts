"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { checkDeliveryAddress, type DeliveryAddressSuggestion } from "@/services/api";
import type { FulfillmentCartItem } from "@/lib/types";

/** Resolve an address's delivery calendar; stale address responses never unlock checkout. */
export function useDeliveryAvailability(restaurantId: string, address: string, selection: DeliveryAddressSuggestion | undefined, items: FulfillmentCartItem[], enabled: boolean) {
  const [settledAddress, setSettledAddress] = useState(address);
  useEffect(() => { const timer = setTimeout(() => setSettledAddress(address), 400); return () => clearTimeout(timer); }, [address]);
  return useQuery({
    queryKey: ["delivery-availability", restaurantId, address, selection?.token, items],
    queryFn: () => checkDeliveryAddress({ restaurantId, address, city: selection?.city, lat: selection?.lat, lng: selection?.lng, items }),
    enabled: enabled && !!restaurantId && !!address.trim() && settledAddress === address,
    retry: 1, staleTime: 0,
  });
}
