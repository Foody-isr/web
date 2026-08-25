"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  createCateringQuote,
  fetchCateringCatalog,
  type CateringCatalogGroupPublic,
  type CateringCatalogItemPublic,
  type CateringChoiceGroupPublic,
  type CateringChoiceItemPublic,
  type CateringOptionPublic,
  type CateringQuotePayload,
  type CateringQuoteResult,
  type CateringServicePublic,
} from "@/services/api";
import { CateringQuoteView } from "@/components/CateringQuoteView";
import { SiteNavbar, useNavLayoutSide } from "@/components/SiteNavbar";
import { BottomNav } from "@/components/BottomNav";
import { SectionRenderer } from "@/components/sections/SectionRenderer";
import { usePageSections } from "@/lib/usePageSections";
import { hasLeadingVisibleHero } from "@/lib/websiteV3Rendering";
import { SiteFooter } from "@/components/SiteFooter";
import { PoweredByFoody } from "@/components/PoweredByFoody";
import { Restaurant, WebsiteSection } from "@/lib/types";
import { useI18n, type Locale } from "@/lib/i18n";
import { tField, type TranslatableEntity } from "@/lib/translations";
import { currencySymbol, CURRENCY_CODE } from "@/lib/constants";

const CURRENCY = currencySymbol(CURRENCY_CODE);
const INPUT_CLASS =
  "w-full rounded-xl border border-[var(--divider)] bg-[var(--surface)] px-4 py-3 text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--catering-accent,var(--brand))]";

type Stage = "services" | "configure" | "checkout" | "result";
type Catalog = { groups: CateringCatalogGroupPublic[]; items: CateringCatalogItemPublic[]; options: CateringOptionPublic[] };
type FormulaChoices = Record<number, Record<number, number>>;
type AllFormulaChoices = Record<number, FormulaChoices>;
type Props = {
  restaurant: Restaurant;
  services: CateringServicePublic[];
  /** Canonical V3 page identity and sections. Omitted by the legacy route. */
  pageSlug?: string;
  pageSections?: WebsiteSection[];
  showFooter?: boolean;
  /** Website Builder preview is view-only and cannot create a quote. */
  previewMode?: boolean;
};

// CateringServicePublic has no index signature, so tField (which expects
// TranslatableEntity) needs an explicit cast. Kept local — the DTO stays untouched.
function serviceField(service: CateringServicePublic, field: "name" | "description", locale: Locale): string {
  return tField(service as unknown as TranslatableEntity, field, locale, service[field]);
}

// Per-locale name/description for catalog items and options (source value falls
// back when a translation is missing), mirroring the classic menu.
function itemField(item: CateringCatalogItemPublic, field: "name" | "description" | "overview", locale: Locale): string {
  return tField(item as unknown as TranslatableEntity, field, locale, item[field]);
}
function optionField(option: CateringOptionPublic, field: "name" | "description", locale: Locale): string {
  return tField(option as unknown as TranslatableEntity, field, locale, option[field]);
}
function groupField(group: CateringCatalogGroupPublic, locale: Locale): string {
  return tField(group as unknown as TranslatableEntity, "name", locale, group.name);
}
function choiceGroupField(group: CateringChoiceGroupPublic, field: "name" | "description", locale: Locale): string {
  return tField(group as unknown as TranslatableEntity, field, locale, group[field]);
}
function choiceItemField(item: CateringChoiceItemPublic, field: "name" | "description", locale: Locale): string {
  return tField(item as unknown as TranslatableEntity, field, locale, item[field]);
}

// The per-person rate at a given guest count: the highest tier whose min_guests
// is reached, else the flat base price. Mirrors the server's authoritative rule.
function effectivePerPersonRate(item: CateringCatalogItemPublic, guests: number): number {
  let rate = item.basePrice;
  let best = -1;
  for (const tier of item.priceTiers ?? []) {
    if (guests >= tier.minGuests && tier.minGuests > best) {
      rate = tier.price;
      best = tier.minGuests;
    }
  }
  return rate;
}

// A formule's description is often a run-on list of what's included, separated
// by pipes / newlines / bullets. Split it into a clean, scannable list.
function parseInclusions(desc: string): string[] {
  if (!desc) return [];
  return desc
    .split(/[|\n•·]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const fmtPrice = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(2));

export function CateringExperience({
  restaurant,
  services,
  pageSlug,
  pageSections,
  showFooter = false,
  previewMode = false,
}: Props) {
  const { t, locale } = useI18n();
  const slug = restaurant.slug || String(restaurant.id);
  // Builder-authored marketing sections for this page, rendered above the shop
  // (hero, text+image, gallery, image cards...). Live-previews in the builder.
  const canonicalPageSlug = pageSlug ?? "catering";
  const {
    sections: liveSections,
    overrideSections,
  } = usePageSections(restaurant, canonicalPageSlug);
  const cateringSections = overrideSections
    ? liveSections
    : pageSections ?? liveSections;
  const canonicalFooterSections = pageSections?.some(
    (section) => section.sectionType === "footer",
  )
    ? pageSections
    : undefined;
  const shoppingSide = useNavLayoutSide("shopping");

  const [stage, setStage] = useState<Stage>("services");
  const [service, setService] = useState<CateringServicePublic | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [guests, setGuests] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Set<number>>(new Set());
  const [formulaChoices, setFormulaChoices] = useState<AllFormulaChoices>({});
  const [configuringItem, setConfiguringItem] = useState<CateringCatalogItemPublic | null>(null);
  const [eventDate, setEventDate] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [eventCity, setEventCity] = useState("");
  const [quoteResult, setQuoteResult] = useState<CateringQuoteResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSelectService(picked: CateringServicePublic) {
    setError(null);
    setLoadingCatalog(true);
    try {
      const data = await fetchCateringCatalog(restaurant.id, picked.id);
      setService(picked);
      setCatalog(data);
      setActiveGroupId(null);
      setQuantities({});
      setSelectedOptions(new Set());
      setFormulaChoices({});
      setStage("configure");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingCatalog(false);
    }
  }

  // How many articles the customer may pick. "" = auto: one for per_person
  // formulas (the guest count drives the price), several for per_unit items.
  const singleSelect =
    !!service && (service.selectionMode || (service.pricingModel === "per_person" ? "single" : "multiple")) === "single";

  function setQty(item: CateringCatalogItemPublic, next: number) {
    setQuantities((prev) => {
      const copy = { ...prev };
      if (next <= 0) delete copy[item.id];
      else copy[item.id] = next;
      return copy;
    });
  }

  // per_unit counter. In single-select mode, picking a new item replaces the
  // one already chosen.
  function stepQty(item: CateringCatalogItemPublic, direction: 1 | -1) {
    const current = quantities[item.id] ?? 0;
    const minQty = Math.max(1, item.minQuantity || 1);
    const next = direction > 0 ? (current === 0 ? minQty : current + 1) : current - 1 < minQty ? 0 : current - 1;
    if (singleSelect && direction > 0 && current === 0) {
      setQuantities({ [item.id]: next });
      return;
    }
    setQty(item, next);
  }

  // per_person select toggle — no quantity (guests are the multiplier).
  function toggleItem(item: CateringCatalogItemPublic) {
    setQuantities((prev) => {
      if ((prev[item.id] ?? 0) > 0) {
        const copy = { ...prev };
        delete copy[item.id];
        setFormulaChoices((all) => {
          const next = { ...all };
          delete next[item.id];
          return next;
        });
        return copy;
      }
      return singleSelect ? { [item.id]: 1 } : { ...prev, [item.id]: 1 };
    });
  }

  function configureFormula(item: CateringCatalogItemPublic, choices: FormulaChoices) {
    setFormulaChoices((previous) => singleSelect ? { [item.id]: choices } : { ...previous, [item.id]: choices });
    setQuantities((previous) => singleSelect ? { [item.id]: 1 } : { ...previous, [item.id]: 1 });
    setConfiguringItem(null);
  }

  function toggleOption(optionId: number) {
    setSelectedOptions((prev) => {
      const next = new Set(prev);
      if (next.has(optionId)) next.delete(optionId);
      else next.add(optionId);
      return next;
    });
  }

  // Mirrors the server pricing formula (per_person item = rate×guests×qty where
  // rate honours guest-count price tiers; per_unit AND custom_quote = base×qty;
  // option fixed = price, per_person = price×guests). Informational only — the
  // server total is authoritative.
  const estimatedTotal = useMemo(() => {
    if (!catalog || !service) return 0;
    let total = 0;
    for (const item of catalog.items) {
      const qty = quantities[item.id] ?? 0;
      if (qty <= 0) continue;
      if (service.pricingModel === "per_person") total += effectivePerPersonRate(item, guests) * guests * qty;
      else total += item.basePrice * qty;
      const itemChoices = formulaChoices[item.id] ?? {};
      for (const group of item.choiceGroups ?? []) {
        const selected = itemChoices[group.id] ?? {};
        for (const option of group.items) {
          const choiceQty = selected[option.menuItemId] ?? 0;
          if (choiceQty <= 0) continue;
          const factor = service.pricingModel === "per_person" ? guests * qty : qty;
          total += option.priceDelta * choiceQty * factor;
        }
      }
    }
    for (const option of catalog.options) {
      if (!selectedOptions.has(option.id)) continue;
      total += option.priceMode === "per_person" ? option.price * guests : option.price;
    }
    return total;
  }, [catalog, service, quantities, guests, selectedOptions, formulaChoices]);

  const hasItems = Object.values(quantities).some((q) => q > 0);
  const selectedItems = useMemo(
    () => catalog?.items.filter((item) => (quantities[item.id] ?? 0) > 0) ?? [],
    [catalog, quantities],
  );
  const choicesComplete = useMemo(() => selectedItems.every((item) => (item.choiceGroups ?? []).every((group) => {
    const count = Object.values(formulaChoices[item.id]?.[group.id] ?? {}).reduce((sum, quantity) => sum + quantity, 0);
    return count >= group.minSelections && count <= group.maxSelections;
  })), [selectedItems, formulaChoices]);
  const selectedItemCount = selectedItems.reduce((sum, item) => sum + (quantities[item.id] ?? 0), 0);
  const canSubmit =
    customerName.trim().length > 0 &&
    customerPhone.trim().length > 0 &&
    eventCity.trim().length > 0 &&
    hasItems &&
    choicesComplete &&
    !previewMode &&
    !submitting;

  function scrollToTop() {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function goToCheckout() {
    if (!hasItems || !choicesComplete || previewMode) return;
    setError(null);
    setStage("checkout");
    requestAnimationFrame(scrollToTop);
  }

  function backToCatalog() {
    setError(null);
    setStage("configure");
    requestAnimationFrame(scrollToTop);
  }

  async function handleSubmit() {
    if (previewMode || !service || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: CateringQuotePayload = {
        restaurantId: restaurant.id,
        serviceId: service.id,
        guests,
        eventDate: eventDate || undefined,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim() || undefined,
        customerLocale: locale,
        eventCity: eventCity.trim(),
        items: Object.entries(quantities)
          .filter(([, qty]) => qty > 0)
          .map(([catalogItemId, quantity]) => ({ catalogItemId: Number(catalogItemId), quantity })),
        choices: Object.entries(formulaChoices).flatMap(([catalogItemId, groups]) =>
          Object.entries(groups).flatMap(([choiceGroupId, selections]) =>
            Object.entries(selections)
              .filter(([, quantity]) => quantity > 0)
              .map(([menuItemId, quantity]) => ({
                catalogItemId: Number(catalogItemId),
                choiceGroupId: Number(choiceGroupId),
                menuItemId: Number(menuItemId),
                quantity,
              })),
          ),
        ),
        optionIds: Array.from(selectedOptions),
      };
      const result = await createCateringQuote(payload);
      setQuoteResult(result);
      setStage("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  function backToServices() {
    setStage("services");
    setService(null);
    setCatalog(null);
    setActiveGroupId(null);
    setQuantities({});
    setSelectedOptions(new Set());
    setFormulaChoices({});
    setConfiguringItem(null);
    setQuoteResult(null);
    setError(null);
  }

  return (
    <main className="relative min-h-screen bg-[var(--catering-bg,var(--bg))] text-[var(--text)]">
      {/* Catering is a shopping page: the top bar drops to the shopping modes and
          the mobile bottom bar carries navigation. Overlay floats only when
          marketing sections (a hero) sit behind the bar. */}
      {stage === "checkout" ? (
        <header className="sticky top-0 z-50 border-b border-[var(--divider)] bg-[var(--surface)]/95 px-4 py-4 backdrop-blur">
          <div className="relative mx-auto flex max-w-5xl items-center justify-center">
            <button
              type="button"
              onClick={backToCatalog}
              aria-label={t("catering_back_to_selection")}
              className="absolute start-0 rounded-lg px-2 py-1 text-sm font-semibold text-[var(--text-muted)] transition hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--catering-accent,var(--brand))]"
            >
              <span aria-hidden>←</span><span className="hidden sm:inline"> {t("catering_back_to_selection")}</span>
            </button>
            <div className="text-center">
              <p className="font-bold text-[var(--text)]">{t("catering_checkout_title")}</p>
              <p className="text-xs text-[var(--text-muted)]">{restaurant.name}</p>
            </div>
          </div>
        </header>
      ) : (
        <SiteNavbar
          restaurant={restaurant}
          activeKey={pageSlug ?? "catering"}
          pageType="shopping"
          overHero={hasLeadingVisibleHero(cateringSections)}
        />
      )}

      {/* Builder-authored marketing sections (hero, about, gallery, cards)
          render above the shop, live-previewing inside the website builder. */}
      {stage !== "checkout" && cateringSections.length > 0 && (
        <SectionRenderer sections={cateringSections} restaurant={restaurant} />
      )}

      {stage !== "checkout" && (
        <header className="border-b border-[var(--divider)] px-4 pb-4 pt-6">
          <h1 className="text-xl font-bold">{t("catering_title")}</h1>
          <p className="text-sm text-[var(--text-muted)]">{restaurant.name}</p>
        </header>
      )}

      {error && (
        <div className="mx-4 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Services stage */}
      {stage === "services" &&
        (services.length === 0 ? (
          <div className="px-4 py-16 text-center text-[var(--text-muted)]">{t("catering_no_services")}</div>
        ) : (
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <h2 className="mb-3 text-sm font-semibold text-[var(--text-muted)]">{t("catering_choose_service")}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {services.map((svc) => (
                <button
                  key={svc.id}
                  data-catering-service={svc.id}
                  type="button"
                  disabled={loadingCatalog}
                  onClick={() => handleSelectService(svc)}
                  className="w-full rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-4 text-start shadow-sm transition hover:border-[var(--catering-accent,var(--brand))] hover:shadow-md disabled:opacity-50"
                >
                  <h3 className="font-bold text-[var(--text)]">{serviceField(svc, "name", locale)}</h3>
                  {svc.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--text-muted)]">
                      {serviceField(svc, "description", locale)}
                    </p>
                  )}
                </button>
              ))}
            </div>
            {loadingCatalog && <p className="mt-4 animate-pulse text-center text-sm text-[var(--text-muted)]">…</p>}
          </div>
        ))}

      {/* Configure stage */}
      {stage === "configure" && service && catalog && (
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[var(--text)]">{serviceField(service, "name", locale)}</h2>
            <button type="button" onClick={backToServices} className="text-sm font-semibold text-[var(--catering-accent,var(--brand))]">
              {t("catering_back")}
            </button>
          </div>

          {service.pricingModel === "per_person" && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-4 shadow-sm">
              <div>
                <p className="font-bold text-[var(--text)]">{t("catering_guest_count_title")}</p>
                <p className="text-sm text-[var(--text-muted)]">{t("catering_guest_count_hint")}</p>
              </div>
              <label className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[var(--text-muted)]">{t("catering_guests")}</span>
                <input
                  type="number"
                  min={1}
                  value={guests || ""}
                  onChange={(event) => setGuests(Math.max(1, Math.floor(Number(event.target.value) || 1)))}
                  className="w-24 rounded-xl border border-[var(--divider)] bg-[var(--surface-subtle)] px-3 py-2 text-center font-bold tabular-nums text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--catering-accent,var(--brand))]"
                />
              </label>
            </div>
          )}

          {catalog.groups.length > 0 && (
            <nav
              aria-label={t("catering_groups")}
              className="sticky z-30 -mx-4 overflow-x-auto border-y border-[var(--divider)] bg-[var(--catering-bg,var(--bg))]/95 px-4 py-3 shadow-sm backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
              style={{ top: "var(--nav-sticky-h, 0px)" }}
            >
              <div className="flex min-w-max gap-2">
                <button
                  type="button"
                  aria-pressed={activeGroupId === null}
                  onClick={() => setActiveGroupId(null)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    activeGroupId === null
                      ? "bg-[var(--catering-accent,var(--brand))] text-[var(--catering-button-ink,var(--ink-on-accent))] shadow-sm"
                      : "border border-[var(--divider)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                >
                  {t("catering_all_groups")}
                </button>
                {catalog.groups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    aria-pressed={activeGroupId === group.id}
                    onClick={() => setActiveGroupId(group.id)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      activeGroupId === group.id
                        ? "bg-[var(--catering-accent,var(--brand))] text-[var(--catering-button-ink,var(--ink-on-accent))] shadow-sm"
                        : "border border-[var(--divider)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]"
                    }`}
                  >
                    {groupField(group, locale)}
                  </button>
                ))}
              </div>
            </nav>
          )}

          {(() => {
            // In single-select mode, once a prestation is chosen show only it,
            // with a way to switch — the rest are hidden to keep it a clear
            // "pick one" flow.
            const keys = Object.keys(quantities);
            const selectedId = singleSelect && keys.length > 0 ? Number(keys[0]) : null;
            const shown = selectedId != null
              ? catalog.items.filter((i) => i.id === selectedId)
              : activeGroupId == null
                ? catalog.items
                : catalog.items.filter((i) => i.groupId === activeGroupId);
            return (
              <section className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {shown.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    qty={quantities[item.id] ?? 0}
                    guests={guests}
                    pricingModel={service.pricingModel}
                    onStep={stepQty}
                    onSelect={toggleItem}
                    onConfigure={setConfiguringItem}
                    t={t}
                    locale={locale}
                  />
                ))}
                {selectedId != null && catalog.items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => { setQuantities({}); setFormulaChoices({}); }}
                    className="w-full rounded-xl border border-[var(--divider)] py-2.5 text-sm font-semibold text-[var(--catering-accent,var(--brand))] transition hover:bg-[var(--surface-subtle)] sm:col-span-2 xl:col-span-3"
                  >
                    {t("catering_choose_another")}
                  </button>
                )}
              </section>
            );
          })()}

          {catalog.options.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">{t("catering_options")}</h3>
              <div className="space-y-2">
                {catalog.options.map((option) => (
                  <OptionRow
                    key={option.id}
                    option={option}
                    checked={selectedOptions.has(option.id)}
                    onToggle={toggleOption}
                    locale={locale}
                  />
                ))}
              </div>
            </section>
          )}

          <div className="sticky z-30 -mx-4 border-t border-[var(--divider)] bg-[var(--catering-bg,var(--bg))]/95 px-4 py-3 shadow-[0_-10px_30px_rgba(0,0,0,0.12)] backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
            style={{ bottom: shoppingSide.bottom_bar ? "var(--bottomnav-h)" : 0 }}
          >
            <div className="mx-auto flex max-w-3xl items-center gap-4 rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-3 ps-4 shadow-lg">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-[var(--text-muted)]">
                  {hasItems
                    ? selectedItemCount === 1
                      ? t("catering_selected_one")
                      : t("catering_selected_many").replace("{n}", String(selectedItemCount))
                    : t("catering_select_to_continue")}
                </p>
                <p className="text-lg font-bold tabular-nums text-[var(--text)]">{`${CURRENCY}${estimatedTotal.toFixed(2)}`}</p>
              </div>
              <button
                type="button"
                disabled={!hasItems || !choicesComplete || previewMode}
                onClick={goToCheckout}
                className="shrink-0 rounded-xl bg-[var(--catering-accent,var(--brand))] px-5 py-3 font-bold text-[var(--catering-button-ink,var(--ink-on-accent))] transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--catering-accent,var(--brand))] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 sm:px-8"
              >
                {t("catering_continue_quote")} →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout stage */}
      {stage === "checkout" && service && catalog && (
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center justify-center gap-2" aria-label={t("catering_quote_progress")}>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-green-500 text-sm font-bold text-white">✓</span>
            <span className="h-0.5 w-10 bg-green-500" />
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--catering-accent,var(--brand))] text-sm font-bold text-[var(--catering-button-ink,var(--ink-on-accent))]">2</span>
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <form
              onSubmit={(event) => { event.preventDefault(); handleSubmit(); }}
              className="order-last space-y-5 rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-5 shadow-sm sm:p-7 lg:order-none"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--catering-accent,var(--brand))]">{t("catering_step_details")}</p>
                <h2 className="mt-1 text-2xl font-bold text-[var(--text)]">{t("catering_event_details_title")}</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">{t("catering_event_details_hint")}</p>
              </div>

              <fieldset className="space-y-4">
                <legend className="mb-3 font-bold text-[var(--text)]">{t("catering_event_section")}</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="min-w-0">
                    <label htmlFor="catering-guests" className="mb-1.5 block text-sm font-medium text-[var(--text-muted)]">{t("catering_guests")}</label>
                    <input
                      id="catering-guests"
                      type="number"
                      min={1}
                      value={guests || ""}
                      onChange={(e) => setGuests(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                      onBlur={() => { if (!guests || guests < 1) setGuests(1); }}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className="min-w-0">
                    <label htmlFor="catering-event-date" className="mb-1.5 block text-sm font-medium text-[var(--text-muted)]">{t("catering_event_date")}</label>
                    <input
                      id="catering-event-date"
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className={`${INPUT_CLASS} min-w-0 appearance-none`}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="catering-event-city" className="mb-1.5 block text-sm font-medium text-[var(--text-muted)]">{t("catering_event_city")}</label>
                  <input
                    id="catering-event-city"
                    type="text"
                    required
                    value={eventCity}
                    onChange={(e) => setEventCity(e.target.value)}
                    placeholder={t("catering_event_city_placeholder")}
                    className={INPUT_CLASS}
                  />
                </div>
              </fieldset>

              <div className="border-t border-[var(--divider)]" />

              <fieldset className="space-y-4">
                <legend className="mb-3 font-bold text-[var(--text)]">{t("catering_your_details")}</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="catering-name" className="mb-1.5 block text-sm font-medium text-[var(--text-muted)]">{t("catering_name")}</label>
                    <input id="catering-name" type="text" required value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={INPUT_CLASS} />
                  </div>
                  <div>
                    <label htmlFor="catering-phone" className="mb-1.5 block text-sm font-medium text-[var(--text-muted)]">{t("catering_phone")}</label>
                    <input id="catering-phone" type="tel" required dir="ltr" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className={INPUT_CLASS} />
                  </div>
                </div>
                <div>
                  <label htmlFor="catering-email" className="mb-1.5 block text-sm font-medium text-[var(--text-muted)]">{t("catering_email")}</label>
                  <input id="catering-email" type="email" dir="ltr" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} className={INPUT_CLASS} />
                </div>
              </fieldset>

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full rounded-xl bg-[var(--catering-accent,var(--brand))] py-4 font-bold text-[var(--catering-button-ink,var(--ink-on-accent))] shadow-lg shadow-brand/30 transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--catering-accent,var(--brand))] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? t("catering_submitting") : t("catering_get_quote")}
              </button>
            </form>

            <aside className="order-first rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-5 shadow-sm lg:order-none lg:sticky lg:top-24">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">{t("catering_your_selection")}</p>
                  <h3 className="mt-1 font-bold text-[var(--text)]">{serviceField(service, "name", locale)}</h3>
                </div>
                <button type="button" onClick={backToCatalog} className="text-sm font-semibold text-[var(--catering-accent,var(--brand))] hover:underline">
                  {t("catering_change_selection")}
                </button>
              </div>
              <ul className="mt-4 divide-y divide-[var(--divider)]">
                {selectedItems.map((item) => (
                  <li key={item.id} className="py-3 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="font-medium text-[var(--text)]">{itemField(item, "name", locale)}</span>
                      <span className="shrink-0 tabular-nums text-[var(--text-muted)]">× {quantities[item.id]}</span>
                    </div>
                    {item.choiceGroups.map((group) => {
                      const selected = formulaChoices[item.id]?.[group.id] ?? {};
                      const labels = group.items.flatMap((option) => {
                        const quantity = selected[option.menuItemId] ?? 0;
                        if (quantity <= 0) return [];
                        return [`${quantity > 1 ? `${quantity}× ` : ""}${choiceItemField(option, "name", locale)}`];
                      });
                      return labels.length > 0 ? (
                        <p key={group.id} className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                          <span className="font-semibold">{choiceGroupField(group, "name", locale)}:</span> {labels.join(", ")}
                        </p>
                      ) : null;
                    })}
                  </li>
                ))}
                {catalog.options.filter((option) => selectedOptions.has(option.id)).map((option) => (
                  <li key={`option-${option.id}`} className="flex justify-between gap-4 py-3 text-sm">
                    <span className="text-[var(--text-muted)]">+ {optionField(option, "name", locale)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-end justify-between border-t border-[var(--divider)] pt-4">
                <span className="text-sm text-[var(--text-muted)]">{t("catering_estimated_total")}</span>
                <span className="text-2xl font-bold tabular-nums text-[var(--text)]">{`${CURRENCY}${estimatedTotal.toFixed(2)}`}</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">{t("catering_total_updates_hint")}</p>
            </aside>
          </div>
        </div>
      )}

      {/* Result stage */}
      {stage === "result" && quoteResult && (
        <div className="px-4 py-10 text-center">
          <div className="mx-auto max-w-md rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-6 shadow-sm">
            <CateringQuoteView quote={quoteResult} restaurantId={restaurant.id} />

            <Link
              href={`/r/${slug}/catering/quote/${quoteResult.publicToken}`}
              className="mt-6 block break-all rounded-xl border border-dashed border-[var(--divider)] px-4 py-3 text-xs font-mono text-[var(--catering-accent,var(--brand))] transition hover:border-[var(--catering-accent,var(--brand))]"
            >
              {`/r/${slug}/catering/quote/${quoteResult.publicToken}`}
            </Link>

            <button
              type="button"
              onClick={backToServices}
              className="mt-3 w-full rounded-xl bg-[var(--catering-accent,var(--brand))] py-3 font-bold text-[var(--catering-button-ink,var(--ink-on-accent))] transition hover:opacity-90"
            >
              {t("catering_back")}
            </button>
          </div>
        </div>
      )}

      {configuringItem && (
        <FormulaConfigurator
          item={configuringItem}
          initial={formulaChoices[configuringItem.id]}
          locale={locale}
          pricingModel={service?.pricingModel ?? "per_person"}
          guests={guests}
          onClose={() => setConfiguringItem(null)}
          onComplete={(choices) => configureFormula(configuringItem, choices)}
          t={t}
        />
      )}

      {showFooter && stage !== "checkout" && (
        <SiteFooter
          restaurant={restaurant}
          sectionsOverride={canonicalFooterSections}
        />
      )}

      {stage !== "checkout" && <PoweredByFoody restaurantSlug={restaurant.slug} />}

      {shoppingSide.bottom_bar && stage !== "checkout" && (
        <>
          <BottomNav
            restaurant={restaurant}
            active={pageSlug
              ? { kind: "page", key: pageSlug }
              : { kind: "catering-alias" }}
          />
          <div className="md:hidden" style={{ height: "var(--bottomnav-h)" }} aria-hidden />
        </>
      )}
    </main>
  );
}

function defaultFormulaChoices(item: CateringCatalogItemPublic, initial?: FormulaChoices): FormulaChoices {
  if (initial) return structuredClone(initial);
  const next: FormulaChoices = {};
  for (const group of item.choiceGroups) {
    const selected: Record<number, number> = {};
    let remaining = group.maxSelections;
    for (const option of group.items) {
      const quantity = Math.min(option.defaultQuantity, remaining, group.maxPerItem || group.maxSelections);
      if (quantity > 0) {
        selected[option.menuItemId] = quantity;
        remaining -= quantity;
      }
    }
    next[group.id] = selected;
  }
  return next;
}

function FormulaConfigurator({
  item,
  initial,
  locale,
  pricingModel,
  guests,
  onClose,
  onComplete,
  t,
}: {
  item: CateringCatalogItemPublic;
  initial?: FormulaChoices;
  locale: Locale;
  pricingModel: string;
  guests: number;
  onClose: () => void;
  onComplete: (choices: FormulaChoices) => void;
  t: (key: string) => string;
}) {
  const [choices, setChoices] = useState<FormulaChoices>(() => defaultFormulaChoices(item, initial));
  const [activeIndex, setActiveIndex] = useState(0);
  const group = item.choiceGroups[activeIndex];
  const selected = choices[group.id] ?? {};
  const selectedCount = Object.values(selected).reduce((sum, quantity) => sum + quantity, 0);
  const groupComplete = selectedCount >= group.minSelections && selectedCount <= group.maxSelections;
  const allComplete = item.choiceGroups.every((candidate) => {
    const count = Object.values(choices[candidate.id] ?? {}).reduce((sum, quantity) => sum + quantity, 0);
    return count >= candidate.minSelections && count <= candidate.maxSelections;
  });
  const hasChefSelection = group.items.some((option) => option.defaultQuantity > 0);

  const setQuantity = (menuItemId: number, quantity: number) => {
    setChoices((previous) => {
      const currentGroup = { ...(previous[group.id] ?? {}) };
      if (quantity <= 0) delete currentGroup[menuItemId];
      else currentGroup[menuItemId] = quantity;
      return { ...previous, [group.id]: currentGroup };
    });
  };

  const toggle = (option: CateringChoiceItemPublic) => {
    const current = selected[option.menuItemId] ?? 0;
    if (current > 0) {
      setQuantity(option.menuItemId, 0);
      return;
    }
    if (selectedCount < group.maxSelections) setQuantity(option.menuItemId, 1);
  };

  const resetChefSelection = () => {
    const defaults = defaultFormulaChoices({ ...item, choiceGroups: [group] })[group.id] ?? {};
    setChoices((previous) => ({ ...previous, [group.id]: defaults }));
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={itemField(item, "name", locale)}>
      <div className="flex h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl border border-[var(--divider)] bg-[var(--catering-bg,var(--bg))] shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-3xl">
        <header className="shrink-0 border-b border-[var(--divider)] bg-[var(--surface)] px-4 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--catering-accent,var(--brand))]">{t("catering_formula_configure_eyebrow")}</p>
              <h2 className="mt-1 text-xl font-bold text-[var(--text)] sm:text-2xl">{itemField(item, "name", locale)}</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">{t("catering_formula_configure_hint")}</p>
            </div>
            <button type="button" onClick={onClose} aria-label={t("catering_cancel")} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--divider)] text-xl text-[var(--text-muted)] hover:text-[var(--text)]">×</button>
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {item.choiceGroups.map((candidate, index) => {
              const count = Object.values(choices[candidate.id] ?? {}).reduce((sum, quantity) => sum + quantity, 0);
              const complete = count >= candidate.minSelections && count <= candidate.maxSelections;
              return (
                <button key={candidate.id} type="button" onClick={() => setActiveIndex(index)} className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition ${index === activeIndex ? "border-[var(--catering-accent,var(--brand))] bg-[var(--catering-accent,var(--brand))] text-[var(--catering-button-ink,var(--ink-on-accent))]" : "border-[var(--divider)] bg-[var(--surface-subtle)] text-[var(--text-muted)]"}`}>
                  <span className={`grid h-5 w-5 place-items-center rounded-full text-xs ${complete ? "bg-green-500 text-white" : "bg-black/10"}`}>{complete ? "✓" : index + 1}</span>
                  {choiceGroupField(candidate, "name", locale)}
                  <span className="opacity-75">{count}/{candidate.maxSelections}</span>
                </button>
              );
            })}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-[var(--text)]">{choiceGroupField(group, "name", locale)}</h3>
              {choiceGroupField(group, "description", locale) && <p className="mt-1 text-sm text-[var(--text-muted)]">{choiceGroupField(group, "description", locale)}</p>}
            </div>
            <div className={`rounded-full px-3 py-1.5 text-sm font-bold tabular-nums ${groupComplete ? "bg-green-500/15 text-green-600" : "bg-[var(--catering-accent,var(--brand))]/10 text-[var(--catering-accent,var(--brand))]"}`}>
              {t("catering_formula_selected_count").replace("{selected}", String(selectedCount)).replace("{max}", String(group.maxSelections))}
            </div>
          </div>
          {hasChefSelection && (
            <button type="button" onClick={resetChefSelection} className="mt-3 rounded-full border border-[var(--divider)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--catering-accent,var(--brand))] hover:border-[var(--catering-accent,var(--brand))]">
              {t("catering_formula_use_chef_selection")}
            </button>
          )}

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((option) => {
              const quantity = selected[option.menuItemId] ?? 0;
              const selectedOption = quantity > 0;
              const atLimit = selectedCount >= group.maxSelections && !selectedOption;
              return (
                <article key={option.id} className={`overflow-hidden rounded-2xl border bg-[var(--surface)] transition ${selectedOption ? "border-[var(--catering-accent,var(--brand))] shadow-md shadow-brand/10" : "border-[var(--divider)]"} ${atLimit ? "opacity-55" : ""}`}>
                  {option.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={option.imageUrl} alt="" className="aspect-[16/8] w-full object-cover" />
                  )}
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-bold text-[var(--text)]">{choiceItemField(option, "name", locale)}</h4>
                        {choiceItemField(option, "description", locale) && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--text-muted)]">{choiceItemField(option, "description", locale)}</p>}
                        {option.priceDelta !== 0 && <p className="mt-2 text-xs font-bold text-[var(--catering-accent,var(--brand))]">{option.priceDelta > 0 ? "+" : ""}{CURRENCY}{fmtPrice(option.priceDelta)} {pricingModel === "per_person" ? t("catering_per_person") : ""}</p>}
                      </div>
                      {group.maxPerItem === 1 && <button type="button" disabled={atLimit} onClick={() => toggle(option)} aria-label={choiceItemField(option, "name", locale)} className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-sm font-bold ${selectedOption ? "border-[var(--catering-accent,var(--brand))] bg-[var(--catering-accent,var(--brand))] text-[var(--catering-button-ink,var(--ink-on-accent))]" : "border-[var(--divider)]"}`}>{selectedOption ? "✓" : "+"}</button>}
                    </div>
                    {group.maxPerItem === 0 && (
                      <div className="mt-3 flex items-center justify-end gap-2">
                        <button type="button" disabled={quantity === 0} onClick={() => setQuantity(option.menuItemId, quantity - 1)} className="grid h-8 w-8 place-items-center rounded-full border border-[var(--divider)] disabled:opacity-30">−</button>
                        <span className="min-w-6 text-center font-bold tabular-nums">{quantity}</span>
                        <button type="button" disabled={selectedCount >= group.maxSelections} onClick={() => setQuantity(option.menuItemId, quantity + 1)} className="grid h-8 w-8 place-items-center rounded-full bg-[var(--catering-accent,var(--brand))] font-bold text-[var(--catering-button-ink,var(--ink-on-accent))] disabled:opacity-30">+</button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          {selectedCount >= group.maxSelections && group.items.some((option) => !(selected[option.menuItemId] > 0)) && (
            <p className="mt-4 text-center text-sm text-[var(--text-muted)]">{t("catering_formula_limit_reached")}</p>
          )}
        </div>

        <footer className="shrink-0 border-t border-[var(--divider)] bg-[var(--surface)] px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={() => activeIndex === 0 ? onClose() : setActiveIndex((index) => index - 1)} className="rounded-xl border border-[var(--divider)] px-4 py-3 text-sm font-bold text-[var(--text)]">
              {activeIndex === 0 ? t("catering_cancel") : `← ${t("catering_previous")}`}
            </button>
            {activeIndex < item.choiceGroups.length - 1 ? (
              <button type="button" disabled={!groupComplete} onClick={() => setActiveIndex((index) => index + 1)} className="rounded-xl bg-[var(--catering-accent,var(--brand))] px-5 py-3 font-bold text-[var(--catering-button-ink,var(--ink-on-accent))] disabled:opacity-40">
                {t("catering_next")} →
              </button>
            ) : (
              <button type="button" disabled={!allComplete} onClick={() => onComplete(choices)} className="rounded-xl bg-[var(--catering-accent,var(--brand))] px-5 py-3 font-bold text-[var(--catering-button-ink,var(--ink-on-accent))] disabled:opacity-40">
                {t("catering_add_configured_formula")}
              </button>
            )}
          </div>
          <p className="mt-2 text-center text-xs text-[var(--text-muted)]">{t("catering_formula_price_for_guests").replace("{guests}", String(guests))}</p>
        </footer>
      </div>
    </div>
  );
}

function ItemRow({
  item,
  qty,
  guests,
  pricingModel,
  onStep,
  onSelect,
  onConfigure,
  t,
  locale,
}: {
  item: CateringCatalogItemPublic;
  qty: number;
  guests: number;
  pricingModel: string;
  onStep: (item: CateringCatalogItemPublic, direction: 1 | -1) => void;
  onSelect: (item: CateringCatalogItemPublic) => void;
  onConfigure: (item: CateringCatalogItemPublic) => void;
  t: (key: string) => string;
  locale: Locale;
}) {
  const [expanded, setExpanded] = useState(false);
  const isPerPerson = pricingModel === "per_person";
  const rate = isPerPerson ? effectivePerPersonRate(item, guests) : item.basePrice;
  const units = Math.max(qty, 1);
  const lineTotal = isPerPerson ? rate * guests * units : item.basePrice * units;
  const name = itemField(item, "name", locale);
  const overview = itemField(item, "overview", locale).trim();
  const inclusions = parseInclusions(itemField(item, "description", locale));
  const shown = expanded ? inclusions : inclusions.slice(0, 6);
  const tiers = [...(item.priceTiers ?? [])].sort((a, b) => a.minGuests - b.minGuests);
  const activeTierMin = isPerPerson
    ? tiers.reduce((best, tr) => (guests >= tr.minGuests && tr.minGuests > best ? tr.minGuests : best), -1)
    : -1;

  const isConfigurable = (item.choiceGroups?.length ?? 0) > 0;
  const stepper = isConfigurable ? (
      <button
        type="button"
        onClick={() => onConfigure(item)}
        className={`shrink-0 rounded-full px-5 py-2 text-sm font-bold transition hover:opacity-90 ${
          qty > 0
            ? "bg-[var(--catering-accent,var(--brand))] text-[var(--catering-button-ink,var(--ink-on-accent))]"
            : "border border-[var(--catering-accent,var(--brand))] text-[var(--catering-accent,var(--brand))]"
        }`}
      >
        {qty > 0 ? `✓ ${t("catering_modify_formula")}` : t("catering_customize_formula")}
      </button>
    ) : isPerPerson ? (
      // per_person: pick the formula (no counter — guests are the multiplier).
      <button
        type="button"
        onClick={() => onSelect(item)}
        className={`shrink-0 rounded-full px-5 py-2 text-sm font-bold transition hover:opacity-90 ${
          qty > 0
            ? "bg-[var(--catering-accent,var(--brand))] text-[var(--catering-button-ink,var(--ink-on-accent))]"
            : "border border-[var(--catering-accent,var(--brand))] text-[var(--catering-accent,var(--brand))]"
        }`}
      >
        {qty > 0 ? `✓ ${t("catering_selected")}` : t("catering_choose")}
      </button>
    ) : qty === 0 ? (
      <button
        type="button"
        onClick={() => onStep(item, 1)}
        className="shrink-0 rounded-full bg-[var(--catering-accent,var(--brand))] px-5 py-2 text-sm font-bold text-[var(--catering-button-ink,var(--ink-on-accent))] transition hover:opacity-90"
      >
        {t("catering_add")}
      </button>
    ) : (
      <div className="flex shrink-0 items-center gap-2 rounded-full border border-[var(--divider)] bg-[var(--surface-subtle)] p-1">
        <button
          type="button"
          aria-label={t("catering_quantity")}
          onClick={() => onStep(item, -1)}
          className="h-8 w-8 rounded-full bg-[var(--surface)] font-bold text-[var(--text)] transition hover:bg-brand/10"
        >
          −
        </button>
        <span className="min-w-[1.5rem] text-center font-semibold tabular-nums">{qty}</span>
        <button
          type="button"
          aria-label={t("catering_quantity")}
          onClick={() => onStep(item, 1)}
          className="h-8 w-8 rounded-full bg-[var(--surface)] font-bold text-[var(--text)] transition hover:bg-brand/10"
        >
          +
        </button>
      </div>
    );

  return (
    <article
      className={`h-full overflow-hidden rounded-2xl border bg-[var(--surface)] transition ${
        qty > 0 ? "border-[var(--catering-accent,var(--brand))] shadow-md shadow-brand/10" : "border-[var(--divider)]"
      }`}
    >
      <div className="flex h-full flex-col">
        {/* Photo */}
        <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-[var(--surface-subtle)]">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt={name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full min-h-[150px] w-full items-center justify-center">
              <svg className="h-9 w-9 text-[var(--text-muted)] opacity-30" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v7a2 2 0 002 2h0V3M5 3v18M14 3c-1.5 1-2 3-2 5s.5 3 2 4v9M14 3v9" />
              </svg>
            </div>
          )}
          {isPerPerson && (
            <span className="absolute start-3 top-3 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
              {`${CURRENCY}${fmtPrice(rate)}`} {t("catering_per_person")}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <h4 className="text-lg font-bold leading-tight text-[var(--text)]">{name}</h4>
            {stepper}
          </div>

          {overview && (
            <p className="text-sm leading-relaxed text-[var(--text-muted)]">{overview}</p>
          )}

          {isConfigurable && (
            <div className="flex flex-wrap gap-1.5">
              {item.choiceGroups.map((group) => (
                <span key={group.id} className="rounded-full border border-[var(--divider)] bg-[var(--surface-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--text-muted)]">
                  {choiceGroupField(group, "name", locale)} · {group.minSelections === group.maxSelections ? group.maxSelections : `${group.minSelections}–${group.maxSelections}`}
                </span>
              ))}
            </div>
          )}

          {inclusions.length > 0 && (
            <div>
              <ul className="grid gap-y-1 text-sm text-[var(--text-muted)]">
                {shown.map((line, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--catering-accent,var(--brand))]" />
                    <span className="leading-snug">{line}</span>
                  </li>
                ))}
              </ul>
              {inclusions.length > 6 && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="mt-1.5 text-xs font-semibold text-[var(--catering-accent,var(--brand))] hover:underline"
                >
                  {expanded ? t("catering_see_less") : `+ ${inclusions.length - 6} ${t("catering_see_more")}`}
                </button>
              )}
            </div>
          )}

          {/* Price + tiers */}
          <div className="mt-auto border-t border-[var(--divider)] pt-3">
            {isPerPerson ? (
              <>
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold tabular-nums text-[var(--text)]">{`${CURRENCY}${fmtPrice(rate)}`}</span>
                    <span className="text-sm text-[var(--text-muted)]">{t("catering_per_person")}</span>
                  </div>
                  <div className="text-end text-sm text-[var(--text-muted)]">
                    <span className="tabular-nums">{`× ${guests} ${t("catering_guests_word")}`}</span>
                    {qty > 0 && <span className="ms-1 font-semibold text-[var(--text)]">{`= ${CURRENCY}${fmtPrice(lineTotal)}`}</span>}
                  </div>
                </div>
                {tiers.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {tiers.map((tr) => (
                      <span
                        key={tr.minGuests}
                        className={`rounded-full px-2.5 py-1 text-xs tabular-nums transition ${
                          tr.minGuests === activeTierMin
                            ? "bg-[var(--catering-accent,var(--brand))] font-semibold text-[var(--catering-button-ink,var(--ink-on-accent))]"
                            : "border border-[var(--divider)] text-[var(--text-muted)]"
                        }`}
                      >
                        {`${t("catering_from")} ${tr.minGuests} · ${CURRENCY}${fmtPrice(tr.price)}`}
                      </span>
                    ))}
                  </div>
                )}
                {item.minGuests > 1 && (
                  <p className="mt-2 text-xs text-[var(--text-muted)]">
                    {t("catering_min_guests").replace("{n}", String(item.minGuests))}
                  </p>
                )}
              </>
            ) : (
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-2xl font-bold tabular-nums text-[var(--text)]">{`${CURRENCY}${fmtPrice(item.basePrice)}`}</span>
                {item.minQuantity > 1 && (
                  <span className="text-xs text-[var(--text-muted)]">
                    {t("catering_min_qty").replace("{n}", String(item.minQuantity))}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function OptionRow({
  option,
  checked,
  onToggle,
  locale,
}: {
  option: CateringOptionPublic;
  checked: boolean;
  onToggle: (id: number) => void;
  locale: Locale;
}) {
  const desc = optionField(option, "description", locale);
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-3">
      <input type="checkbox" checked={checked} onChange={() => onToggle(option.id)} className="mt-1 h-4 w-4 accent-[var(--catering-accent,var(--brand))]" />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-[var(--text)]">{optionField(option, "name", locale)}</span>
        {desc && <span className="block text-xs text-[var(--text-muted)]">{desc}</span>}
      </span>
      <span className="whitespace-nowrap text-sm font-bold text-[var(--text)]">{`${CURRENCY}${option.price}`}</span>
    </label>
  );
}
