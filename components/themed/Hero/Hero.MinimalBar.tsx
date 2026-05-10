import type { HeroProps } from "./Hero";

export function MinimalBar({ name, address }: HeroProps) {
  return (
    <section className="px-4 py-3 border-b border-divider">
      <h1 className="font-display text-ink text-base font-semibold leading-tight">{name}</h1>
      {address && <p className="text-ink-muted text-xs mt-0.5">{address}</p>}
    </section>
  );
}
