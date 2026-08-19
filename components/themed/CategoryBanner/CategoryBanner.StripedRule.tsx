import type { CategoryBannerProps } from "./CategoryBanner";
import { roleTextStyle } from "@/lib/themes/typography";

export function StripedRule({ name, capitalize }: CategoryBannerProps) {
  return (
    <div className="px-4 py-5 flex items-center gap-3">
      <div className="flex-1 border-t border-divider" />
      <h2
        className="font-display font-semibold tracking-wide whitespace-nowrap"
        style={{
          ...roleTextStyle("categoryTitle", "1.125rem", "display", 600, capitalize ? "uppercase" : "none"),
          color: "var(--cat-heading, var(--text))",
        }}
      >
        {name}
      </h2>
      <div className="flex-1 border-t border-divider" />
    </div>
  );
}
