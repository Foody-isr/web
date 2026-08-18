"use client";

// SiteNavbarAuto — thin passthrough to the config-based SiteNavbar.
//
// An earlier iteration rendered a separate structured navbar (SiteNavbarV2) when
// a restaurant had a `navbar_v2` config. That parallel navbar was abandoned: the
// website builder edits the legacy config.navbar_* fields (colours, dual logo,
// CTA, composition, typography) which SiteNavbar reads via useNavbarSettings —
// so they preview live (foody-draft-state) and render on the published site.
// Rendering SiteNavbarV2 off a stale published navbar_v2 would shadow those
// edits, so this always renders SiteNavbar. Kept as a component so call sites
// (RestaurantLanding) don't need to change.

import { SiteNavbar } from "@/components/SiteNavbar";
import type { Restaurant } from "@/lib/types";

export function SiteNavbarAuto({
  restaurant,
  overHero,
}: {
  restaurant: Restaurant;
  overHero?: boolean;
}) {
  return <SiteNavbar restaurant={restaurant} overHero={overHero} />;
}
