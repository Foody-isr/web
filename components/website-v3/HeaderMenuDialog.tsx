"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { useI18n } from "@/lib/i18n";

/** Shares the current header's native menu across saved header compositions. */
export function HeaderMenuDialog({
  open,
  onClose,
  style,
  children,
}: {
  open: boolean;
  onClose: () => void;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const { direction, locale, t } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (open) dialog?.showModal();
    else dialog?.close();
    return () => dialog?.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="website-header-menu-dialog"
      style={style}
      dir={direction}
      onCancel={onClose}
      aria-label={t("navPrimary") || "Navigation"}
    >
      <button
        type="button"
        className="website-header-close"
        aria-label={locale === "fr" ? "Fermer" : locale === "he" ? "סגירה" : "Close"}
        onClick={onClose}
      >
        <XMarkIcon width={24} height={24} />
      </button>
      {children}
    </dialog>
  );
}
