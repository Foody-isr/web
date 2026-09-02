const origin = process.argv[2];
if (!origin) {
  throw new Error("Usage: node scripts/verify-website-v3-runtime.mjs <web-origin>");
}

const endpoint = new URL("/api/website-v3-capabilities", origin);
const response = await fetch(endpoint, {
  cache: "no-store",
  headers: { Accept: "application/json" },
});
if (!response.ok) {
  throw new Error(`Website V3 capability probe failed with HTTP ${response.status}`);
}

const capabilities = await response.json();
const requiredPageTypes = ["landing", "content", "order", "catering"];
const requiredSurfaces = ["page", "checkout"];
const compatible =
  capabilities?.protocol === "foody.website-v3" &&
  capabilities?.version === 1 &&
  Array.isArray(capabilities?.page_types) &&
  requiredPageTypes.every((type) => capabilities.page_types.includes(type)) &&
  Array.isArray(capabilities?.surfaces) &&
  requiredSurfaces.every((surface) => capabilities.surfaces.includes(surface)) &&
  capabilities?.publication?.marker === "foody_renderer_version" &&
  capabilities?.publication?.version === 1;

if (!compatible) {
  throw new Error("The deployed storefront does not expose the required Website V3 contract");
}

console.log(`Website V3 runtime verified at ${endpoint.origin}`);
