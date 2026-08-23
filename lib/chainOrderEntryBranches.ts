/**
 * Returns the branches the global order selector should display.
 *
 * Delivery starts with the public chain list so customers can see that a
 * branch exists. Once an address is resolved, the server-filtered list becomes
 * authoritative and only branches serving that address remain visible.
 */
export function chainOrderEntryBranchSource<T>(
  branches: T[],
  orderType: "pickup" | "delivery",
  resolvedDeliveryBranches: T[] | null,
): T[] {
  if (orderType === "delivery" && resolvedDeliveryBranches !== null) {
    return resolvedDeliveryBranches;
  }
  return branches;
}
