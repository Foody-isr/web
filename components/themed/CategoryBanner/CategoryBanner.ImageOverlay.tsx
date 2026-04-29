import type { CategoryBannerProps } from "./CategoryBanner";
import { TextBlock } from "./CategoryBanner.TextBlock";

export function ImageOverlay({ name, imageUrl, capitalize }: CategoryBannerProps) {
  if (!imageUrl) return <TextBlock name={name} capitalize={capitalize} />;
  const display = capitalize ? name.toUpperCase() : name;
  return (
    <div className="relative my-3 mx-3 h-44 rounded-lg overflow-hidden shadow-banner">
      <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/35" />
      <div className="relative z-10 h-full flex flex-col items-center justify-center px-4 text-center">
        <div className="w-16 border-t border-white/70 mb-3" />
        <h2 className="font-display text-white text-2xl font-bold tracking-wide">{display}</h2>
        <div className="w-16 border-t border-white/70 mt-3" />
      </div>
    </div>
  );
}
