import type { ReactNode } from "react";
import { isMobileTabQuery } from "@/lib/mobileExperience";
import { publicPath } from "@/lib/site-url";
import type { WebsitePageSearchParams } from "@/lib/websiteV3Rendering";
import { MobileTabPage } from "./MobileTabPages";

/** Identifies the public route independently of later client-side URL changes. */
export async function PublishedMobileTab({ children, searchParams }: {
  children: ReactNode;
  searchParams?: WebsitePageSearchParams;
}) {
  if (!isMobileTabQuery(Object.keys(searchParams ?? {}))) return children;
  const pathname = await publicPath("");
  return pathname ? <MobileTabPage pathname={pathname}>{children}</MobileTabPage> : children;
}
