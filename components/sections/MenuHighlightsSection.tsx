"use client";

import { SectionProps } from "./SectionRenderer";

/**
 * Menu highlights placeholder section.
 * Content: title, item_ids array
 * Renders a placeholder since menu data is not available in this context.
 */
export function MenuHighlightsSection({ section }: SectionProps) {
  const { title } = section.content;
  const itemIds: number[] = section.content?.item_ids || [];

  return (
    <section className="bg-[var(--surface-subtle)] py-16 px-6">
      <div className="max-w-4xl mx-auto text-center flex flex-col gap-6">
        {title && (
          <h2 className="text-2xl md:text-3xl font-bold text-[var(--text)]">
            {title}
          </h2>
        )}
        {itemIds.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {itemIds.map((id) => (
              <div
                key={id}
                className="bg-[var(--surface)] rounded-xl p-6 flex items-center justify-center min-h-[120px]"
              >
                <p className="text-[var(--text-muted)] text-sm">
                  Featured item coming soon
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[var(--text-muted)]">
            Featured items coming soon
          </p>
        )}
      </div>
    </section>
  );
}
