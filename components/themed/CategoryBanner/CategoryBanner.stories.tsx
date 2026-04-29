import { ImageOverlay } from "./CategoryBanner.ImageOverlay";
import { TextBlock } from "./CategoryBanner.TextBlock";
import { StripedRule } from "./CategoryBanner.StripedRule";

export default { title: "Themed / CategoryBanner" };

const wrap = (child: React.ReactNode) => (
  <div data-theme="editorial-dark" data-pairing="modern-sans" className="bg-bg min-h-screen pt-8 text-ink">
    <div style={{ ["--font-display" as any]: "Switzer", ["--font-body" as any]: "Switzer" }}>{child}</div>
  </div>
);

const img = "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1200";

export const image_overlay = () => wrap(<ImageOverlay name="Country Diner Classics" imageUrl={img} capitalize={true} />);
export const text_block    = () => wrap(<TextBlock name="Salads" description="Crisp greens, simple dressings" capitalize={false} />);
export const striped_rule  = () => wrap(<StripedRule name="House Specials" capitalize={true} />);
