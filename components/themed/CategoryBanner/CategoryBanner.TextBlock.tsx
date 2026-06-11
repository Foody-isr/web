import type { CategoryBannerProps } from "./CategoryBanner";
import { roleTextStyle } from "@/lib/themes/typography";

export function TextBlock({ name, description, capitalize }: CategoryBannerProps) {
  const display = capitalize ? name.toUpperCase() : name;
  return (
    <div className="px-4 py-5">
      <h2
        className="font-display text-ink"
        style={{
          ...roleTextStyle(
            "categoryTitle",
            "var(--type-display-lg-size, 2.25rem)",
            "display",
            "var(--type-display-lg-weight, 700)",
          ),
          lineHeight: "var(--type-display-lg-line, 1.1)",
          letterSpacing: "var(--type-display-lg-tracking, -0.015em)",
        }}
      >
        {display}
      </h2>
      <div className="mt-2 w-12 border-t border-divider" />
      {description && <p className="mt-2 text-ink-muted text-sm">{description}</p>}
    </div>
  );
}
