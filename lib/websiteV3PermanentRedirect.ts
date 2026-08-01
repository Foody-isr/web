import { permanentRedirect } from "next/navigation";
import {
  buildWebsiteAliasTarget,
  canonicalRedirectForPage,
  type WebsiteV3Page,
} from "@/lib/websiteV3Api";

/** Permanently redirects an internal default commerce slug to its public alias. */
export function redirectDefaultWebsitePagePermanently(
  page: WebsiteV3Page,
  restaurantId: string,
  searchParams: Record<string, string | string[] | undefined>,
): false {
  const canonicalPath = canonicalRedirectForPage(page);
  if (!canonicalPath) return false;

  permanentRedirect(
    buildWebsiteAliasTarget(
      restaurantId,
      canonicalPath.slice(1),
      searchParams,
    ),
  );
}
