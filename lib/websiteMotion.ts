export const ENTRANCE_STYLES = [
  "none",
  "fade",
  "zoom",
  "bounce",
  "from_left",
  "from_right",
  "from_top",
  "from_bottom",
  "split",
] as const;
export type EntranceStyle = (typeof ENTRANCE_STYLES)[number];
const choice = <T extends string>(
  value: unknown,
  choices: readonly T[],
  fallback: T,
): T => (choices.includes(value as T) ? (value as T) : fallback);
const bounded = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;

/** Normalizes saved animation options without trusting legacy or imported JSON. */
export function websiteMotion(value: unknown) {
  const raw =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return {
    enabled: raw.enabled === true,
    entrance: choice(raw.entrance, ENTRANCE_STYLES, "fade"),
    mobileEntrance: choice(
      raw.mobile_entrance,
      [...ENTRANCE_STYLES, "inherit"] as const,
      "inherit",
    ),
    duration: bounded(raw.duration_ms, 1250, 200, 3000),
    delay: bounded(raw.delay_ms, 0, 0, 3000),
    replay: raw.replay === true,
    mobile: raw.mobile !== false,
    mediaHover: choice(
      raw.media_hover,
      ["none", "wobble", "grow", "lift"] as const,
      "none",
    ),
    buttonHover: choice(
      raw.button_hover,
      ["none", "push", "grow", "lift"] as const,
      "none",
    ),
    parallax: choice(raw.parallax, ["none", "up", "down"] as const, "none"),
    parallaxAmount: bounded(raw.parallax_amount, 20, 10, 80),
    parallaxMobile: raw.parallax_mobile === true,
  };
}

/** Entry keyframes reproduce the reference's zoom and directional reveals. */
export function entranceFrames(style: EntranceStyle): Keyframe[] {
  if (style === "bounce")
    return [
      { opacity: 0, transform: "scale(.3)", offset: 0 },
      { transform: "scale(1.1)", offset: 0.2 },
      { transform: "scale(.9)", offset: 0.4 },
      { opacity: 1, transform: "scale(1.03)", offset: 0.6 },
      { transform: "scale(.97)", offset: 0.8 },
      { opacity: 1, transform: "scale(1)", offset: 1 },
    ];
  if (style === "zoom")
    return [
      { opacity: 0, transform: "scale(.3)" },
      { opacity: 1, offset: 0.5 },
      { opacity: 1, transform: "scale(1)" },
    ];
  const transform =
    (
      {
        from_left: "translateX(-100%)",
        from_right: "translateX(100%)",
        from_top: "translateY(-100%)",
        from_bottom: "translateY(100%)",
      } as Record<string, string>
    )[style] || "none";
  return [
    { opacity: 0, transform },
    { opacity: 1, transform: "none" },
  ];
}

/** Finite hover animations work with keyboard focus as well as a pointer. */
export function hoverFrames(style: string): Keyframe[] {
  if (style === "wobble")
    return [0, 8, -6, 4, -2, 1, 0].map((x) => ({
      transform: `translateX(${x}px)`,
    }));
  if (style === "push")
    return [
      { transform: "scale(1)" },
      { transform: "scale(.8)" },
      { transform: "scale(1)" },
    ];
  return [
    { transform: "none" },
    { transform: style === "lift" ? "translateY(-6px)" : "scale(1.04)" },
  ];
}
