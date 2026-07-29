"use client";

// Website Builder v2 — SiteNavbarAuto.
//
// Renders the structured v2 navbar (SiteNavbarV2 — composition presets, scroll
// states, dual-logo swap) when the restaurant has a navbar_v2 config, and falls
// back to the legacy SiteNavbar otherwise. This is the dual-read seam: existing
// restaurants (no navbar_v2) render exactly as before; a restaurant that
// configures the v2 navbar in the builder gets the new bar. Safe by construction
// — the fallback is the current behavior.

import { useEffect, useState } from "react";
import { SiteNavbar } from "@/components/SiteNavbar";
import { SiteNavbarV2 } from "@/components/SiteNavbarV2";
import { navbarForDevice, type NavbarConfigV2 } from "@/lib/navbar/config";
import { fetchNavbarV2 } from "@/lib/websiteV2Api";
import { buildNavPageItems } from "@/lib/siteNav";
import type { Restaurant } from "@/lib/types";

export function SiteNavbarAuto({
  restaurant,
  overHero,
}: {
  restaurant: Restaurant;
  overHero?: boolean;
}) {
  const [nav, setNav] = useState<NavbarConfigV2 | null>(null);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchNavbarV2(restaurant.slug || String(restaurant.id))
      .then((n) => alive && setNav(n))
      .catch(() => alive && setNav(null));
    return () => {
      alive = false;
    };
  }, [restaurant]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // No v2 config → the working legacy navbar, unchanged.
  if (!nav) return <SiteNavbar restaurant={restaurant} overHero={overHero} />;

  const device = mobile ? "mobile" : "desktop";
  const links = buildNavPageItems(restaurant, "Traiteur").map((i) => ({
    label: i.label,
    href: i.href,
  }));
  return (
    <SiteNavbarV2
      config={navbarForDevice(nav, device)}
      device={device}
      links={links}
      brandName={restaurant.name}
    />
  );
}
