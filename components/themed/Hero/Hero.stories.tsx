import { Fullbleed } from "./Hero.Fullbleed";
import { CenteredCard } from "./Hero.CenteredCard";
import { MinimalBar } from "./Hero.MinimalBar";

export default { title: "Themed / Hero" };

const args = {
  imageUrl: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1200",
  name: "Daisy Dukes Boots n Bourbon",
  address: "117 St Paul St, St. Catharines, ON L2R 3M4, Canada",
  tagline: "Country diner classics, all day",
};

const wrap = (id: string, child: React.ReactNode) => (
  <div data-theme={id} data-pairing="modern-sans" className="bg-bg min-h-screen text-ink">
    <div style={{ ["--font-display" as any]: "Switzer", ["--font-body" as any]: "Switzer" }}>{child}</div>
  </div>
);

export const fullbleed = () => wrap("editorial-dark", <Fullbleed {...args} />);
export const centered_card = () => wrap("editorial-dark", <CenteredCard {...args} />);
export const minimal_bar = () => wrap("editorial-dark", <MinimalBar {...args} />);
