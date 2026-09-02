export const WEBSITE_V3_PREVIEW_PROTOCOL = "foody.website-v3" as const;
export const WEBSITE_V3_PREVIEW_PROTOCOL_VERSION = 1 as const;

export const WEBSITE_V3_PREVIEW_CAPABILITIES = {
  protocol: WEBSITE_V3_PREVIEW_PROTOCOL,
  version: WEBSITE_V3_PREVIEW_PROTOCOL_VERSION,
  page_types: ["landing", "content", "order", "catering"],
  surfaces: ["page", "checkout", "branches"],
} as const;
