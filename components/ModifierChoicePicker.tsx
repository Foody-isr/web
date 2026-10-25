"use client";

import { useEffect, useLayoutEffect, useId, useRef, useState } from "react";
import type { MenuItemModifier } from "@/lib/types";
import { useCurrency, useI18n } from "@/lib/i18n";
import { useMenuLanguage } from "@/lib/menu-language";
import { tField } from "@/lib/translations";

type Props = {
  label: string;
  modifiers: MenuItemModifier[];
  selectedId?: string;
  characters?: boolean;
  absolutePrices?: boolean;
  descriptions?: Record<string, string>;
  onSelect: (id: string) => void;
};

/** Compact single-choice picker with a searchable list or a character grid. */
export function ModifierChoicePicker({ label, modifiers, selectedId, characters, absolutePrices = false, descriptions, onSelect }: Props) {
  const { t } = useI18n();
  const { money } = useCurrency();
  const { menuLocale } = useMenuLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | "digits" | "letters">("all");
  const [active, setActive] = useState(0);
  const [listHeight, setListHeight] = useState(256);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const id = useId();
  const name = (m: MenuItemModifier) => tField(m, "name", menuLocale) || m.name;
  const price = (value: number) => `${!absolutePrices && value > 0 ? "+" : ""}${money(value)}`;
  const selected = modifiers.find(m => m.id === selectedId);
  const filtered = modifiers.filter(m => {
    const value = name(m);
    return value.toLocaleLowerCase(menuLocale).includes(query.trim().toLocaleLowerCase(menuLocale))
      && (kind === "all" || (kind === "digits" ? /^\p{N}$/u.test(value) : /^\p{L}$/u.test(value)));
  });
  useEffect(() => {
    if (!open) return;
    const scroller = root.current?.closest<HTMLElement>("[data-item-scroll]");
    if (scroller) setListHeight(Math.max(96, Math.min(256, scroller.clientHeight - (characters ? 190 : 130))));
    search.current?.focus({ preventScroll: true });
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault(); event.stopPropagation(); setOpen(false);
        trigger.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape, true);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", escape, true); };
  }, [open, characters]);
  useLayoutEffect(() => {
    if (!open) return;
    const scroller = root.current?.closest<HTMLElement>("[data-item-scroll]");
    let secondFrame = 0;
    const adjust = () => {
      if (!scroller || !root.current) return;
      const body = scroller.getBoundingClientRect(), picker = root.current.getBoundingClientRect();
      if (picker.bottom > body.bottom) scroller.scrollTop += picker.bottom - body.bottom + 8;
    };
    // Measure after the height update and the browser's focus layout have settled.
    const frame = requestAnimationFrame(() => { adjust(); secondFrame = requestAnimationFrame(adjust); });
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(secondFrame); };
  }, [open, listHeight, characters]);
  useEffect(() => {
    const option = document.getElementById(`${id}-option-${active}`);
    const list = root.current?.querySelector<HTMLElement>('[role="listbox"]');
    if (open && option && list) {
      const bounds = list.getBoundingClientRect(), selectedBounds = option.getBoundingClientRect();
      if (selectedBounds.bottom > bounds.bottom) list.scrollTop += selectedBounds.bottom - bounds.bottom;
      else if (selectedBounds.top < bounds.top) list.scrollTop -= bounds.top - selectedBounds.top;
    }
  }, [open, active, id]);
  const choose = (modifier: MenuItemModifier) => {
    onSelect(modifier.id);
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  };
  return (
    <div ref={root} className="p-3" data-no-drag onBlur={event => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
    }}>
      <button ref={trigger} type="button" aria-label={label} aria-expanded={open} aria-controls={open ? `${id}-panel` : undefined}
        onClick={() => { setOpen(!open); setQuery(""); setActive(0); }}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-[var(--divider)] bg-[var(--surface)] px-4 py-3 text-start text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
        <span>{selected ? name(selected) : t("modifierChoose")}</span>
        <span aria-hidden="true" className="flex items-center gap-3"><span className="text-sm">{selected?.priceDelta ? price(selected.priceDelta) : ""}</span><span>{open ? "⌃" : "⌄"}</span></span>
      </button>
      {open && <div id={`${id}-panel`} className="mt-2 overflow-hidden rounded-xl border border-[var(--divider)] bg-[var(--surface)]">
        {characters && <div className="flex gap-1 border-b border-[var(--divider)] p-2" role="group" aria-label={t("modifierCharacterType")}>
          {(["all", "digits", "letters"] as const).map(value => <button key={value} type="button" aria-pressed={kind === value}
            onClick={() => { setKind(value); setActive(0); search.current?.focus(); }}
            className={`min-h-11 flex-1 rounded-lg px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${kind === value ? "bg-brand-soft font-semibold" : "text-[var(--text-soft)]"}`}>
            {t(`modifierType_${value}`)}
          </button>)}
        </div>}
        <input ref={search} role="combobox" aria-label={`${t("modifierSearch")} — ${label}`} aria-expanded={true} aria-autocomplete="list"
          aria-controls={`${id}-list`} aria-activedescendant={filtered[active] ? `${id}-option-${active}` : undefined}
          value={query} placeholder={t("modifierSearch")} onChange={event => { setQuery(event.target.value); setActive(0); }}
          onKeyDown={event => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault(); setActive(prev => Math.max(0, Math.min(filtered.length - 1, prev + (event.key === "ArrowDown" ? 1 : -1))));
            }
            if (event.key === "Enter") { event.preventDefault(); if (filtered[active]) choose(filtered[active]); }
          }} className="min-h-12 w-full border-b border-[var(--divider)] bg-transparent px-4 text-sm text-[var(--text-primary)] outline-offset-[-2px] focus-visible:outline-brand" />
        <div id={`${id}-list`} role="listbox" aria-label={label} style={{ maxHeight: listHeight }} className={`overflow-y-auto overscroll-contain ${characters ? "grid grid-cols-5 gap-2 p-3 sm:grid-cols-6" : "py-1"}`}>
          {filtered.map((modifier, index) => <button key={modifier.id} id={`${id}-option-${index}`} type="button" role="option" tabIndex={-1}
            aria-selected={modifier.id === selectedId} onMouseDown={event => event.preventDefault()} onClick={() => choose(modifier)}
            className={`${characters ? "min-h-12 rounded-lg border border-[var(--divider)] text-xl" : "flex min-h-12 w-full items-center justify-between gap-3 px-4 text-start text-sm"} ${modifier.id === selectedId ? "bg-brand text-white font-semibold" : index === active ? "bg-brand-soft text-[var(--text-primary)]" : "text-[var(--text-primary)]"}`}>
            <span>{name(modifier)}{descriptions?.[modifier.id] && <span className="block text-xs font-normal text-[var(--text-soft)]">{descriptions[modifier.id]}</span>}{characters && !!modifier.priceDelta && <span className="block text-[10px]">{price(modifier.priceDelta)}</span>}</span>{!characters && <span>{modifier.priceDelta ? price(modifier.priceDelta) : ""}</span>}
          </button>)}
        </div>
        {filtered.length === 0 && <p role="status" className="p-4 text-sm text-[var(--text-soft)]">{t("modifierNoResults")}</p>}
      </div>}
    </div>
  );
}
