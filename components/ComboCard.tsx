"use client";

import { ComboMenu } from "@/lib/types";
import Image from "next/image";

type Props = {
  combo: ComboMenu;
  currency: string;
  onSelect: (combo: ComboMenu) => void;
};

/**
 * ComboCard displays a combo / set-menu offer (e.g. "Business Lunch — ₪150")
 * in the menu grid alongside regular MenuItemCards.
 */
export function ComboCard({ combo, currency, onSelect }: Props) {
  const stepsPreview = combo.steps
    .map((s) => {
      const label =
        s.minPicks === s.maxPicks
          ? `${s.minPicks} ${s.name}`
          : `${s.minPicks}–${s.maxPicks} ${s.name}`;
      return label;
    })
    .join(" + ");

  return (
    <button
      type="button"
      onClick={() => onSelect(combo)}
      className="relative flex flex-col overflow-hidden rounded-2xl border border-[var(--border-light)] bg-[var(--surface-card)] shadow-sm transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-brand text-start w-full"
    >
      {/* Image or gradient placeholder */}
      {combo.imageUrl ? (
        <div className="relative h-36 w-full">
          <Image
            src={combo.imageUrl}
            alt={combo.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 33vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>
      ) : (
        <div className="h-36 w-full bg-gradient-to-br from-brand/20 to-brand/5 flex items-center justify-center">
          <span className="text-5xl">🍽️</span>
        </div>
      )}

      {/* Badge */}
      <div className="absolute top-3 start-3 bg-brand text-white text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide shadow">
        Combo
      </div>

      {/* Content */}
      <div className="flex flex-col gap-1.5 p-4 flex-1">
        <h3 className="font-bold text-base text-[var(--text-primary)] line-clamp-1">
          {combo.name}
        </h3>
        {combo.description && (
          <p className="text-sm text-[var(--text-muted)] line-clamp-2">
            {combo.description}
          </p>
        )}
        <p className="text-xs text-[var(--text-soft)] mt-auto">{stepsPreview}</p>
        <p className="text-lg font-bold text-brand mt-1">
          {currency}
          {combo.price.toFixed(2)}
        </p>
      </div>
    </button>
  );
}
