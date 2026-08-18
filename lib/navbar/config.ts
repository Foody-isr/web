// Website Builder v2 — navbar config (TypeScript mirror of the Go NavbarConfigV2
// in foodyserver internal/restaurants/navbar_config.go). Field names are
// snake_case to match the raw `navbar_v2` jsonb blob delivered by the API; the
// server validates the shape (ValidateNavbarConfigJSON) so the renderer trusts
// it. Empty enum strings mean "renderer default".

export type NavbarComposition = "logo_left" | "logo_center_links_below" | "inline_center";
export type NavbarHeight = "thin" | "medium" | "tall";
export type NavbarCorners = "square" | "rounded";
export type NavbarPosition = "sticky" | "fixed" | "static";
export type NavbarActionType = "order" | "login" | "cart" | "language" | "custom";
export type NavbarActionStyle = "primary" | "ghost";

export interface NavbarLogo {
  /** Default logo asset (shown on the solid/scrolled bar). */
  default_url: string;
  /** Distinct light logo shown while the bar is transparent over the hero. */
  transparent_url: string;
  /** Display size in px; 0 = renderer default. */
  size: number;
  /** When true the logo spills below the bar, overlapping the hero. */
  overhang: boolean;
}

export interface NavbarBackground {
  color: string;
  blur: boolean;
  shadow: boolean;
  border: boolean;
  height: NavbarHeight | "";
  corners: NavbarCorners | "";
}

export interface NavbarScroll {
  /** Bar is transparent while at the top of the page, over the hero. */
  transparent_at_top: boolean;
  /** Background color once the user scrolls (solid state). */
  scrolled_color: string;
  /** Hide the bar while scrolling down, reveal on scroll up. */
  hide_on_scroll: boolean;
  position: NavbarPosition | "";
}

export interface NavbarLinks {
  color: string;
  hover_color: string;
  /** Link color once the bar is solid (scrolled). */
  scrolled_color: string;
  font: string;
}

export interface NavbarAction {
  type: NavbarActionType;
  label: string;
  link: string;
  style: NavbarActionStyle | "";
}

export interface NavbarDeviceConfig {
  composition: NavbarComposition | "";
  logo: NavbarLogo;
  background: NavbarBackground;
  scroll: NavbarScroll;
  links: NavbarLinks;
  actions: NavbarAction[];
}

export interface NavbarConfigV2 {
  desktop: NavbarDeviceConfig;
  mobile: NavbarDeviceConfig;
}

/** Pick the device config; both are authored independently in the editor. */
export function navbarForDevice(
  cfg: NavbarConfigV2 | null | undefined,
  device: "desktop" | "mobile",
): NavbarDeviceConfig | null {
  if (!cfg) return null;
  return device === "mobile" ? cfg.mobile : cfg.desktop;
}
