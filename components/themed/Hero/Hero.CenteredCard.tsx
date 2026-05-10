import type { HeroProps } from "./Hero";

export function CenteredCard({ imageUrl, name, address, tagline }: HeroProps) {
  return (
    <section className="px-4 pt-6 pb-2">
      <div className="relative w-full max-w-2xl mx-auto rounded-xl overflow-hidden shadow-banner">
        {imageUrl && <img src={imageUrl} alt="" className="w-full aspect-[16/9] object-cover" />}
      </div>
      <div className="text-center mt-4">
        <h1
          className="font-display text-ink"
          style={{
            fontSize: "var(--type-display-lg-size, 2.25rem)",
            fontWeight: "var(--type-display-lg-weight, 700)" as any,
            lineHeight: "var(--type-display-lg-line, 1.1)",
            letterSpacing: "var(--type-display-lg-tracking, -0.015em)",
          }}
        >
          {name}
        </h1>
        {address && <p className="mt-1 text-ink-muted text-sm">{address}</p>}
        {tagline && <p className="mt-2 text-ink-soft text-sm">{tagline}</p>}
      </div>
    </section>
  );
}
