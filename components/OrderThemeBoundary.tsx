import type { ReactNode } from "react";
import { OrderThemeBridge } from "@/app/order/OrderThemeBridge";
import { fetchOrderThemeSeed } from "@/lib/orderTheme";

export type OrderThemeSearchParams = Record<string, string | string[] | undefined>;

/** Supply published restaurant colors in the first HTML, while previews use their live draft. */
export async function OrderThemeBoundary({ children, searchParams }: { children: ReactNode; searchParams?: OrderThemeSearchParams }) {
  const restaurantId = typeof searchParams?.restaurantId === "string" ? searchParams.restaurantId : "";
  const pageSlug = typeof searchParams?.pageSlug === "string" ? searchParams.pageSlug : "";
  const preview = searchParams?.preview === "1";
  const initialTheme = restaurantId && !preview ? await fetchOrderThemeSeed(restaurantId, pageSlug) : undefined;
  return <OrderThemeBridge initialTheme={initialTheme}>{children}</OrderThemeBridge>;
}
