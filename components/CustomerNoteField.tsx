"use client";

import { useId } from "react";
import type { CustomerNoteConfig } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

/** Customer text input attached to the selected modifier or option. */
export function CustomerNoteField({
  config,
  value,
  onChange,
}: {
  config?: CustomerNoteConfig | null;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const { t } = useI18n();
  if (!config?.enabled) return null;
  const missing = config.required && !value.trim();
  return (
    <div className="px-4 pb-4 pt-2" data-no-drag>
      <label htmlFor={id} className="block text-sm font-medium mb-2">
        {config.label}
        {config.required ? " *" : ""}
      </label>
      <textarea
        id={id}
        rows={2}
        maxLength={500}
        required={config.required}
        aria-invalid={missing || undefined}
        aria-describedby={missing ? `${id}-error` : undefined}
        placeholder={config.placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-[var(--divider)] bg-transparent px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand"
      />
      {missing && (
        <p id={`${id}-error`} className="mt-1 text-sm">
          {t("customerNoteMissing")}
        </p>
      )}
    </div>
  );
}
