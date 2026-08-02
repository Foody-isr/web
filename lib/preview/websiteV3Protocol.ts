export const WEBSITE_V3_STATE = "foody.website-v3.state" as const;
export const WEBSITE_V3_APPLIED = "foody.website-v3.applied" as const;
export const WEBSITE_V3_READY = "foody.website-v3.ready" as const;
export const WEBSITE_V3_NAVIGATE = "foody.website-v3.navigate" as const;

export type WebsiteV3PreviewDevice = "desktop" | "mobile";
export type WebsiteV3DraftPageType =
  | "landing"
  | "content"
  | "order"
  | "catering";

export type WebsiteV3DraftPage = {
  id?: number;
  tmp_id?: string;
  type: WebsiteV3DraftPageType;
  slug: string;
  title: string;
  sort_order: number;
  nav_visible?: boolean;
  is_homepage?: boolean;
  is_default?: boolean;
  seo?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  appearance_overrides?: Record<string, unknown>;
};

export type WebsiteV3DraftSection = {
  id?: number;
  tmp_id?: string;
  section_type: string;
  page: string;
  page_id?: number;
  page_tmp_id?: string;
  sort_order: number;
  is_visible: boolean;
  layout: string;
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
};

export type DraftStatePayload = {
  config: Record<string, unknown>;
  pages?: WebsiteV3DraftPage[];
  sections: WebsiteV3DraftSection[];
  deleted_section_ids: number[];
  deleted_page_ids?: number[];
};

export type WebsiteV3StateMessage = {
  type: typeof WEBSITE_V3_STATE;
  revision: number;
  contentRevision: number;
  restaurantId: number;
  activePageKey: string;
  device: WebsiteV3PreviewDevice;
  state: DraftStatePayload;
};

export type WebsiteV3AppliedMessage = {
  type: typeof WEBSITE_V3_APPLIED;
  revision: number;
  contentRevision: number;
  activePageKey: string;
  device: WebsiteV3PreviewDevice;
};

export type WebsiteV3ReadyMessage = {
  type: typeof WEBSITE_V3_READY;
};

export type WebsiteV3OriginPolicy = {
  configuredAdminOrigin?: string;
  currentOrigin: string;
};

export type AcceptedWebsiteV3State = {
  message: WebsiteV3StateMessage;
  page: WebsiteV3DraftPage;
};

export type WebsiteV3NavigationPage = {
  slug: string;
  label: string;
  sort_order: number;
  show_in_nav: boolean;
  is_shopping: boolean;
  type: WebsiteV3DraftPageType;
  is_homepage?: boolean;
  is_default: boolean;
};

const ADMIN_ORIGINS = {
  "app.foody-pos.co.il": "https://admin.foody-pos.co.il",
  "dev-app.foody-pos.co.il": "https://dev-admin.foody-pos.co.il",
} as const;
const LOCAL_ADMIN_ORIGIN = "http://localhost:3003";

/** Narrows untrusted data to the exact Website V3 state wire shape. */
export function isWebsiteV3StateMessage(
  data: unknown,
): data is WebsiteV3StateMessage {
  if (!hasExactKeys(data, [
    "type",
    "revision",
    "contentRevision",
    "restaurantId",
    "activePageKey",
    "device",
    "state",
  ])) {
    return false;
  }

  return (
    data.type === WEBSITE_V3_STATE &&
    isRevision(data.revision) &&
    isRevision(data.contentRevision) &&
    isPositiveInteger(data.restaurantId) &&
    isNonEmptyString(data.activePageKey) &&
    (data.device === "desktop" || data.device === "mobile") &&
    isDraftStatePayload(data.state)
  );
}

/** Narrows untrusted data to the exact Website V3 applied wire shape. */
export function isWebsiteV3AppliedMessage(
  data: unknown,
): data is WebsiteV3AppliedMessage {
  return (
    hasExactKeys(data, [
      "type",
      "revision",
      "contentRevision",
      "activePageKey",
      "device",
    ]) &&
    data.type === WEBSITE_V3_APPLIED &&
    isRevision(data.revision) &&
    isRevision(data.contentRevision) &&
    isNonEmptyString(data.activePageKey) &&
    (data.device === "desktop" || data.device === "mobile")
  );
}

/** Narrows untrusted data to the exact Website V3 ready wire shape. */
export function isWebsiteV3ReadyMessage(
  data: unknown,
): data is WebsiteV3ReadyMessage {
  return hasExactKeys(data, ["type"]) && data.type === WEBSITE_V3_READY;
}

/** Allows only the matching Foody Admin or explicit local development origins. */
export function isAllowedWebsiteV3AdminOrigin(
  origin: string,
  policy: WebsiteV3OriginPolicy,
): boolean {
  if (origin === "*" || origin === "null") return false;

  const adminOrigin = resolveWebsiteV3AdminOrigin(policy);
  if (adminOrigin && origin === adminOrigin) return true;
  if (!isLocalDevelopmentOrigin(policy.currentOrigin)) return false;
  if (origin === LOCAL_ADMIN_ORIGIN) return true;

  return origin === parseOrigin(policy.currentOrigin);
}

/** Resolves the sole trusted Admin origin for the current Website V3 preview. */
export function resolveWebsiteV3AdminOrigin(
  policy: WebsiteV3OriginPolicy,
): string | null {
  const currentURL = parseURL(policy.currentOrigin);
  if (!currentURL) return null;

  for (const [webHostname, adminOrigin] of Object.entries(ADMIN_ORIGINS)) {
    if (
      currentURL.hostname === webHostname ||
      currentURL.hostname.endsWith(`.${webHostname}`)
    ) {
      return adminOrigin;
    }
  }

  if (!isLocalDevelopmentOrigin(currentURL.origin)) return null;

  const configuredOrigin = parseOrigin(policy.configuredAdminOrigin);
  if (
    configuredOrigin &&
    (isLocalDevelopmentOrigin(configuredOrigin) ||
      Object.values(ADMIN_ORIGINS).includes(
        configuredOrigin as (typeof ADMIN_ORIGINS)[keyof typeof ADMIN_ORIGINS],
      ))
  ) {
    return configuredOrigin;
  }
  return LOCAL_ADMIN_ORIGIN;
}

/** Converts the current V3 page tree into the legacy config navigation shape. */
export function websiteV3NavigationPages(
  state: DraftStatePayload,
): WebsiteV3NavigationPage[] {
  const deletedPageIDs = new Set(state.deleted_page_ids ?? []);
  return (state.pages ?? [])
    .filter((page) => page.id === undefined || !deletedPageIDs.has(page.id))
    .slice()
    .sort((left, right) => left.sort_order - right.sort_order)
    .map((page) => ({
      slug: page.slug,
      label: page.title || page.slug,
      sort_order: page.sort_order,
      show_in_nav: page.nav_visible !== false,
      is_shopping: page.type === "order" || page.type === "catering",
      type: page.type,
      is_homepage: page.is_homepage,
      is_default: page.is_default ?? false,
    }));
}

/** Resolves a same-restaurant preview URL to its live draft page identity. */
export function resolveWebsiteV3PreviewNavigationPageKey(
  requestedSlug: string,
  pages: WebsiteV3DraftPage[],
): string | null {
  const page = requestedSlug === ""
    ? pages.find((candidate) => candidate.is_homepage === true) ??
      (pages.every((candidate) => candidate.is_homepage === undefined)
        ? pages.find((candidate) => candidate.type === "landing")
        : undefined)
    : requestedSlug === "order"
      ? pages.find(
          (candidate) => candidate.type === "order" && candidate.is_default,
        )
      : requestedSlug === "catering"
        ? pages.find(
            (candidate) =>
              candidate.type === "catering" && candidate.is_default,
          )
        : pages.find((candidate) => candidate.slug === requestedSlug);
  if (!page) return null;
  return page.id !== undefined ? String(page.id) : page.tmp_id ?? null;
}

/** Finds the active draft page using a persisted numeric ID or provisional tmp_id. */
export function resolveWebsiteV3ActivePage(
  state: DraftStatePayload,
  activePageKey: string,
): WebsiteV3DraftPage | null {
  return (
    state.pages?.find(
      (page) =>
        (page.id !== undefined && String(page.id) === activePageKey) ||
        page.tmp_id === activePageKey,
    ) ?? null
  );
}

/** Applies the protocol's origin, tenant, revision, and active-page gates. */
export function acceptWebsiteV3StateMessage({
  data,
  origin,
  expectedRestaurantId,
  lastAppliedRevision,
  originPolicy,
}: {
  data: unknown;
  origin: string;
  expectedRestaurantId: number;
  lastAppliedRevision: number;
  originPolicy: WebsiteV3OriginPolicy;
}): AcceptedWebsiteV3State | null {
  if (!isAllowedWebsiteV3AdminOrigin(origin, originPolicy)) return null;
  if (!isWebsiteV3StateMessage(data)) return null;
  if (data.restaurantId !== expectedRestaurantId) return null;
  if (data.revision <= lastAppliedRevision) return null;

  const page = resolveWebsiteV3ActivePage(data.state, data.activePageKey);
  return page ? { message: data, page } : null;
}

function isDraftStatePayload(value: unknown): value is DraftStatePayload {
  if (!isRecord(value)) return false;
  if (!isRecord(value.config)) return false;
  if (value.pages !== undefined) {
    if (!Array.isArray(value.pages) || !value.pages.every(isDraftPage)) {
      return false;
    }
  }
  if (!Array.isArray(value.sections) || !value.sections.every(isDraftSection)) {
    return false;
  }
  if (!isIntegerArray(value.deleted_section_ids)) return false;
  return (
    value.deleted_page_ids === undefined ||
    isIntegerArray(value.deleted_page_ids)
  );
}

function isDraftPage(value: unknown): value is WebsiteV3DraftPage {
  if (!isRecord(value)) return false;
  const hasID = isPositiveInteger(value.id);
  const hasTemporaryID = isNonEmptyString(value.tmp_id);
  return (
    (hasID || hasTemporaryID) &&
    (value.type === "landing" ||
      value.type === "content" ||
      value.type === "order" ||
      value.type === "catering") &&
    typeof value.slug === "string" &&
    typeof value.title === "string" &&
    Number.isInteger(value.sort_order) &&
    (value.nav_visible === undefined ||
      typeof value.nav_visible === "boolean") &&
    (value.is_homepage === undefined ||
      typeof value.is_homepage === "boolean") &&
    (value.is_default === undefined ||
      typeof value.is_default === "boolean") &&
    (value.seo === undefined || isRecord(value.seo)) &&
    (value.settings === undefined || isRecord(value.settings)) &&
    (value.appearance_overrides === undefined ||
      isRecord(value.appearance_overrides))
  );
}

function isDraftSection(value: unknown): value is WebsiteV3DraftSection {
  if (!isRecord(value)) return false;
  return (
    (isPositiveInteger(value.id) || isNonEmptyString(value.tmp_id)) &&
    isNonEmptyString(value.section_type) &&
    typeof value.page === "string" &&
    (value.page_id === undefined || isPositiveInteger(value.page_id)) &&
    (value.page_tmp_id === undefined ||
      isNonEmptyString(value.page_tmp_id)) &&
    Number.isInteger(value.sort_order) &&
    typeof value.is_visible === "boolean" &&
    typeof value.layout === "string" &&
    isRecord(value.content) &&
    isRecord(value.settings)
  );
}

function hasExactKeys<T extends string>(
  value: unknown,
  keys: readonly T[],
): value is Record<T, unknown> {
  if (!isRecord(value)) return false;
  const actualKeys = Object.keys(value);
  return (
    actualKeys.length === keys.length &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isRevision(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isIntegerArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(Number.isInteger);
}

function parseOrigin(value?: string): string | null {
  if (!value || value.includes("*")) return null;
  return parseURL(value)?.origin ?? null;
}

function parseURL(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isLocalDevelopmentOrigin(origin: string): boolean {
  try {
    const hostname = new URL(origin).hostname;
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]"
    );
  } catch {
    return false;
  }
}
