import type { CategoryBannerProps } from "./CategoryBanner";
import { roleTextStyle } from "@/lib/themes/typography";

export function StripedRule({ name, capitalize }: CategoryBannerProps) {
  const display = capitalize ? name.toUpperCase() : name;
  return (
    <div className="px-4 py-5 flex items-center gap-3">
      <div className="flex-1 border-t border-divider" />
      <h2
        className="font-display text-ink font-semibold tracking-wide whitespace-nowrap"
        style={roleTextStyle("categoryTitle", "1.125rem", "display", 600)}
      >
        {display}
      </h2>
      <div className="flex-1 border-t border-divider" />
    </div>
  );
}
