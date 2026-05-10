import { useState } from "react";
import { StickyPills } from "./CategoryNav.StickyPills";
import { TabsTop } from "./CategoryNav.TabsTop";

export default { title: "Themed / CategoryNav" };

const groups = [
  { id: 1, name: "Country Diner Classics" },
  { id: 2, name: "Blue Plate Special" },
  { id: 3, name: "Grilled Bread" },
  { id: 4, name: "Gluten-Free" },
  { id: 5, name: "House Pies and Cakes" },
];

const wrap = (child: React.ReactNode) => (
  <div data-theme="editorial-dark" data-pairing="modern-sans" className="bg-bg min-h-screen relative text-ink">
    <div style={{ ["--font-display" as any]: "Switzer", ["--font-body" as any]: "Switzer" }}>{child}</div>
  </div>
);

export const PillsBottom = () => {
  const [active, setActive] = useState<number | string>(1);
  return wrap(<StickyPills groups={groups} activeGroupId={active} onSelect={setActive} position="bottom" />);
};

export const PillsTop = () => {
  const [active, setActive] = useState<number | string>(1);
  return wrap(<StickyPills groups={groups} activeGroupId={active} onSelect={setActive} position="top" />);
};

export const TabsTopStory = () => {
  const [active, setActive] = useState<number | string>(1);
  return wrap(<TabsTop groups={groups} activeGroupId={active} onSelect={setActive} />);
};
