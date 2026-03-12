import { fetchRestaurant } from "@/services/api";
import { RestaurantThemeProvider } from "@/lib/restaurant-theme";
import { InstallPrompt } from "@/components/InstallPrompt";
import { Restaurant } from "@/lib/types";
import Script from "next/script";

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
  const primaryColor = websiteConfig?.primaryColor || "#EB5204";

  return (
    <RestaurantThemeProvider config={websiteConfig}>
      <link rel="manifest" href={`/api/manifest/${slug}`} />
      <link rel="icon" href={`/api/favicon/${slug}`} />
      <meta name="theme-color" content={primaryColor} />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta name="apple-mobile-web-app-title" content={restaurant?.name || "Foody"} />
      {restaurant?.logoUrl && (
        <link rel="apple-touch-icon" href={restaurant.logoUrl} />
      )}
      {children}
      {restaurant && (
        <InstallPrompt
          restaurantName={restaurant.name}
          primaryColor={primaryColor}
        />
      )}
      <Script id="sw-register" strategy="afterInteractive">
        {`if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(function(){})}`}
      </Script>
    </RestaurantThemeProvider>
  );
}
