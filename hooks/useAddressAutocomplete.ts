'use client';
import { useQuery } from '@tanstack/react-query';
import { fetchAddressAutocompleteConfig } from '@/services/api';

/** Shares the server's restaurant-scoped autocomplete policy between forms. */
export function useAddressAutocomplete(restaurantId?: string) {
  return useQuery({
    queryKey: ['address-autocomplete', restaurantId],
    queryFn: () => fetchAddressAutocompleteConfig(restaurantId!),
    enabled: !!restaurantId,
    staleTime: 60_000,
    retry: 1,
  });
}
