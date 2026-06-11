import type { CategoryBannerProps } from "./CategoryBanner";
import { TextBlock } from "./CategoryBanner.TextBlock";
import { roleTextStyle } from "@/lib/themes/typography";

export function ImageOverlay({ name, imageUrl, capitalize, overlay = 40 }: CategoryBannerProps) {
  if (!imageUrl) return <TextBlock name={name} capitalize={capitalize} />;
  const display = capitalize ? name.toUpperCase() : name;
  // Dark veil darkness is admin-configurable (0-100). The title keeps its own
  // drop-shadow so it stays legible even when the veil is disabled.
  const veil = Math.min(Math.max(overlay, 0), 100) / 100;
  return (
    <div className="relative my-6 h-40 sm:h-44 lg:h-48 rounded-2xl overflow-hidden">
      <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
      {veil > 0 && <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${veil})` }} />}
      <div className="relative z-10 h-full flex flex-col items-center justify-center px-4 text-center">
        <div className="w-20 sm:w-24 border-t border-white/80 mb-3 sm:mb-4" />
        {/* The responsive base size lives in the --ctb var (1.5rem mobile,
            1.875rem ≥sm) so the categoryTitle role's size multiplier + the
            overall scale apply on top of it while keeping responsiveness. */}
        <h2
          className="font-display text-white font-bold tracking-[0.15em] drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] [--ctb:1.5rem] sm:[--ctb:1.875rem]"
          style={roleTextStyle("categoryTitle", "var(--ctb)", "display", 700)}
        >
          {display}
        </h2>
        <div className="w-20 sm:w-24 border-t border-white/80 mt-3 sm:mt-4" />
      </div>
    </div>
  );
}
