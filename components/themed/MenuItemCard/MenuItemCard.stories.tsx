import { Compact } from "./MenuItemCard.Compact";
import { Magazine } from "./MenuItemCard.Magazine";
import type { MenuItem } from "@/lib/types";

export default { title: "Themed / MenuItemCard" };

const item: MenuItem = {
  id: "1",
  groupId: "g1",
  name: "Country fried steak",
  description: "Served with mashed potatoes, green beans, beef or chicken with ham, and a biscuit",
  price: 14,
  imageUrl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600",
};

const wrap = (child: React.ReactNode) => (
  <div data-theme="editorial-dark" data-pairing="modern-sans" className="bg-bg min-h-screen p-3 text-ink">
    <div style={{ ["--font-display" as any]: "Switzer", ["--font-body" as any]: "Switzer" }}>{child}</div>
  </div>
);

export const compact = () => wrap(<Compact item={item} currencySymbol="$" density="compact" isMostPopular={true} onClick={() => {}} />);
export const magazine = () => wrap(<Magazine item={item} currencySymbol="$" density="magazine" isMostPopular={true} onClick={() => {}} />);
export const compact_no_image = () => wrap(<Compact item={{ ...item, imageUrl: undefined }} currencySymbol="$" density="compact" onClick={() => {}} />);
