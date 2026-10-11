/** All item colors inherit the menu's global style, independently of card layout. */
export function orderCardColorVariables(): Record<string, string> {
  return {
    "--order-card-bg": "var(--site-menu-card-background)",
    "--order-card-title": "var(--site-menu-card-title)",
    "--order-card-description": "var(--site-menu-card-description)",
    "--order-description-opacity": "1",
    "--order-card-price": "var(--site-menu-card-price)",
    "--order-card-border": "var(--site-menu-card-border)",
    color: "var(--site-menu-card-description)",
  };
}

/** Normal and sticky navigation share the menu style; search and icons follow its category colors. */
export function orderNavigationColorVariables(): Record<string, string> {
  const roles = {
    bg: "var(--site-menu-bar-background)",
    text: "var(--site-menu-category-text)",
    "pill-bg": "var(--site-menu-pill-background)",
    "active-bg": "var(--site-menu-active-background)",
    "active-text": "var(--site-menu-active-text)",
    "search-bg":
      "color-mix(in srgb, var(--site-menu-category-text) 12%, var(--site-menu-bar-background))",
    "search-text": "var(--site-menu-category-text)",
    accent: "var(--site-menu-category-text)",
    divider: "var(--site-menu-category-text)",
    "icon-bg": "var(--site-menu-active-background)",
    icon: "var(--site-menu-active-text)",
    "cart-bg": "var(--site-menu-active-background)",
    "cart-text": "var(--site-menu-active-text)",
  };
  return {
    ...Object.fromEntries(
      Object.entries(roles).flatMap(([role, value]) =>
        ["--cat-", "--cat-sticky-", "--cat-current-"].map((prefix) => [
          prefix + role,
          value,
        ]),
      ),
    ),
    "--surface-subtle": roles["search-bg"],
    backgroundColor: roles.bg,
    color: roles.text,
  };
}
