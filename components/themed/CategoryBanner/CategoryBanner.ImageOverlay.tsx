import type { CategoryBannerProps } from "./CategoryBanner";
import { TextBlock } from "./CategoryBanner.TextBlock";

export function ImageOverlay({ name, imageUrl, capitalize }: CategoryBannerProps) {
  if (!imageUrl) return <TextBlock name={name} capitalize={capitalize} />;
  const display = capitalize ? name.toUpperCase() : name;
  return (
    <div className="relative my-4 w-full h-56 sm:h-64 lg:h-72 overflow-hidden">
      <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative z-10 h-full flex flex-col items-center justify-center px-4 text-center">
        <div className="w-20 sm:w-24 border-t border-white/80 mb-3 sm:mb-4" />
        <h2 className="font-display text-white text-2xl sm:text-3xl lg:text-4xl font-bold tracking-[0.15em] drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
          {display}
        </h2>
        <div className="w-20 sm:w-24 border-t border-white/80 mt-3 sm:mt-4" />
      </div>
    </div>
  );
}
