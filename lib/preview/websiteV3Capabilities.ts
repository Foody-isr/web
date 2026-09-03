export const WEBSITE_V3_PREVIEW_PROTOCOL = "foody.website-v3" as const;
export const WEBSITE_V3_PREVIEW_PROTOCOL_VERSION = 1 as const;
export const WEBSITE_V3_PUBLICATION_MARKER = "foody_renderer_version" as const;
export const WEBSITE_V3_RENDERER_VERSION = 1 as const;

export const WEBSITE_V3_PREVIEW_CAPABILITIES = {
  protocol: WEBSITE_V3_PREVIEW_PROTOCOL,
  version: WEBSITE_V3_PREVIEW_PROTOCOL_VERSION,
  page_types: ["landing", "content", "order", "catering"],
  surfaces: ["page", "checkout", "branches"],
  publication: {
    marker: WEBSITE_V3_PUBLICATION_MARKER,
    version: WEBSITE_V3_RENDERER_VERSION,
  },
} as const;
