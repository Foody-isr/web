"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { useI18n } from "@/lib/i18n";
import { websiteOrderCopy } from "@/lib/websiteOrder";

/** Shares the current header's native menu across saved header compositions. */
export function HeaderMenuDialog({
  open,
  onClose,
  style,
  order = false,
  catalogue,
  children,
}: {
  open: boolean;
  onClose: () => void;
  style?: CSSProperties;
  order?: boolean;
  catalogue?: { brand: ReactNode; onChangeMode?: () => void; onInfo?: () => void };
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
      data-order-menu={order || undefined}
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
      {catalogue && <div className="website-catalogue-drawer-only website-catalogue-drawer-start">
        {catalogue.brand}
        {catalogue.onChangeMode && <button type="button" onClick={() => { onClose(); catalogue.onChangeMode?.(); }}>
          {websiteOrderCopy(locale).changeMode}
        </button>}
        {catalogue.onInfo && <button type="button" onClick={() => { onClose(); catalogue.onInfo?.(); }}>
          {websiteOrderCopy(locale).info}
        </button>}
      </div>}
      {children}
    </dialog>
  );
}
