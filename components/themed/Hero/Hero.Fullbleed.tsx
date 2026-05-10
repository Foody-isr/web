import type { HeroProps } from "./Hero";

export function Fullbleed({ imageUrl, name, address, tagline }: HeroProps) {
  return (
    <section className="relative w-full min-h-[60vh] overflow-hidden">
      {imageUrl && <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(to top, var(--bg) 0%, color-mix(in srgb, var(--bg) 30%, transparent) 50%, transparent 100%)",
        }}
      />
      <div className="relative z-10 flex flex-col justify-end h-full min-h-[60vh] p-6 pb-8">
        <h1
          className="font-display text-ink leading-[1.05] tracking-tight"
          style={{
            fontSize: "var(--type-display-xl-size, 3rem)",
            fontWeight: "var(--type-display-xl-weight, 800)" as any,
            letterSpacing: "var(--type-display-xl-tracking, -0.02em)",
            lineHeight: "var(--type-display-xl-line, 1.05)",
          }}
        >
          {name}
        </h1>
        {address && (
          <p
            className="mt-2 font-display text-ink leading-tight"
            style={{ fontSize: "var(--type-display-lg-size, 2.25rem)", fontWeight: 500 }}
          >
            {address}
          </p>
        )}
        {tagline && <p className="mt-3 text-ink-muted">{tagline}</p>}
      </div>
    </section>
  );
}
