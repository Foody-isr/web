import { TopBar } from "./TopBar";

export default { title: "Themed / TopBar" };

const noop = () => {};
const args = {
  restaurantName: "Daisy Dukes Boots n Bourbon",
  logoUrl: undefined,
  cartCount: 2,
  viewMode: "magazine" as const,
  onToggleViewMode: noop,
  onOpenSearch: noop,
  onOpenFilter: noop,
  onOpenCart: noop,
  onToggleLanguage: noop,
};

const wrap = (themeId: string, child: React.ReactNode) => (
  <div data-theme={themeId} data-pairing="modern-sans" className="bg-bg min-h-screen">
    <div style={{ ["--font-display" as any]: "Switzer", ["--font-body" as any]: "Switzer" }}>
      {child}
    </div>
  </div>
);

export const editorial_dark = () => wrap("editorial-dark", <TopBar {...args} />);
export const empty_cart = () => wrap("editorial-dark", <TopBar {...args} cartCount={0} />);
export const hidden_name = () => wrap("editorial-dark", <TopBar {...args} hideName={true} />);
