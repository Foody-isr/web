import { fetchRestaurant } from "@/services/api";
import { RestaurantThemeProvider } from "@/lib/restaurant-theme";
import { Restaurant } from "@/lib/types";
import { PwaHead } from "@/components/PwaHead";

export const dynamic = "force-dynamic";

type LayoutProps = {
  children: React.ReactNode;
  params: { restaurantId: string };
};

export default async function RestaurantLayout({ children, params }: LayoutProps) {
  let restaurant: Restaurant | null = null;
  try {
    restaurant = await fetchRestaurant(params.restaurantId);
  } catch {
    // If restaurant fetch fails, proceed without customization
  }

  const websiteConfig = restaurant?.websiteConfig || null;
  const slug = restaurant?.slug || params.restaurantId;
  const primaryColor = websiteConfig?.brandColor || "#EB5204";

  return (
    <RestaurantThemeProvider config={websiteConfig}>
      <PwaHead
        slug={slug}
        primaryColor={primaryColor}
        title={restaurant?.name || "Foody"}
        logoUrl={restaurant?.logoUrl}
      />
      {children}
    </RestaurantThemeProvider>
  );
}
