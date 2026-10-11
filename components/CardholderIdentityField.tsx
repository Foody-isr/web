"use client";

import { useState } from "react";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { useI18n } from "@/lib/i18n";

/** Ephemeral identity entry, masked by default and never persisted by this component. */
export function CardholderIdentityField({
  id,
  value,
  onChange,
  disabled = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const VisibilityIcon = visible ? EyeSlashIcon : EyeIcon;
  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-[var(--text)]"
      >
        {t("savedCardIdentityLabel")}
      </label>
      <div className="flex min-h-12 items-center rounded-[6px] border border-[var(--divider)] bg-[var(--surface)] focus-within:ring-2 focus-within:ring-[var(--brand)] focus-within:ring-offset-2 focus-within:ring-offset-[var(--surface)]">
        <input
          id={id}
          type={visible ? "text" : "password"}
          inputMode="numeric"
          autoComplete="off"
          maxLength={9}
          pattern="[0-9]{9}"
          dir="ltr"
          spellCheck={false}
          value={value}
          disabled={disabled}
          required
          onChange={(event) =>
            onChange(event.target.value.replace(/[^0-9]/g, ""))
          }
          aria-describedby={`${id}-help`}
          className="min-w-0 flex-1 rounded-[6px] bg-transparent px-4 py-3 text-base text-[var(--checkout-input,var(--text))] outline-none disabled:opacity-50"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => setVisible(!visible)}
          aria-label={t(
            visible ? "hideCardholderIdentity" : "showCardholderIdentity",
          )}
          aria-controls={id}
          className="m-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)] disabled:opacity-50"
        >
          <VisibilityIcon className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <p
        id={`${id}-help`}
        className="max-w-prose text-xs leading-relaxed text-[var(--text-muted)]"
      >
        {t("savedCardIdentityHelp")}
      </p>
    </div>
  );
}
