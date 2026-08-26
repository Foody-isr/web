"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { structuredInclusionGroups } from "@/lib/cateringInclusions";
import { cateringCarouselImages } from "@/lib/cateringGallery";
import { CateringItemGallery } from "@/components/CateringItemGallery";

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

function suggestedGuestCount(items: CateringCatalogItemPublic[]): number {
  const minimums = items.map((item) => Math.max(1, item.minGuests || 1));
  return minimums.length > 0 ? Math.min(...minimums) : 1;
}

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
  const [detailsItem, setDetailsItem] = useState<CateringCatalogItemPublic | null>(null);
  const [eventDate, setEventDate] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [eventCity, setEventCity] = useState("");
  const [quoteResult, setQuoteResult] = useState<CateringQuoteResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeItemDetails = useCallback(() => setDetailsItem(null), []);

  async function handleSelectService(picked: CateringServicePublic) {
    setError(null);
    setLoadingCatalog(true);
    try {
      const data = await fetchCateringCatalog(restaurant.id, picked.id);
      setService(picked);
      setCatalog(data);
      setActiveGroupId(null);
      setQuantities({});
      setGuests(suggestedGuestCount(data.items));
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
      setGuests((count) => Math.max(count, item.minGuests || 1));
      setQuantities({ [item.id]: next });
      return;
    }
    if (direction > 0 && current === 0) setGuests((count) => Math.max(count, item.minGuests || 1));
    setQty(item, next);
  }

  // per_person select toggle — no quantity (guests are the multiplier).
  function toggleItem(item: CateringCatalogItemPublic) {
    if ((quantities[item.id] ?? 0) <= 0) {
      setGuests((count) => Math.max(count, item.minGuests || 1));
    }
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
    setGuests((count) => Math.max(count, item.minGuests || 1));
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

  function handleDetailsSelect(item: CateringCatalogItemPublic) {
    setDetailsItem(null);
    if ((quantities[item.id] ?? 0) > 0) {
      setQty(item, 0);
      return;
    }
    if (service?.pricingModel === "per_person") toggleItem(item);
    else stepQty(item, 1);
  }

  function handleDetailsConfigure(item: CateringCatalogItemPublic) {
    setDetailsItem(null);
    setConfiguringItem(item);
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
  const catalogGuestMinimum = catalog ? suggestedGuestCount(catalog.items) : 1;
  const selectedGuestMinimum = selectedItems.reduce(
    (minimum, item) => Math.max(minimum, item.minGuests || 1),
    catalogGuestMinimum,
  );
  const guestMinimumMet = guests >= selectedGuestMinimum;
  useEffect(() => {
    if (!hasItems && selectedOptions.size > 0) setSelectedOptions(new Set());
  }, [hasItems, selectedOptions]);
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
    guestMinimumMet &&
    !previewMode &&
    !submitting;

  function scrollToTop() {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function goToCheckout() {
    if (!hasItems || !choicesComplete || !guestMinimumMet || previewMode) return;
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
    setDetailsItem(null);
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

      {stage !== "checkout" && <h1 className="sr-only">{t("catering_title")}</h1>}

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
        <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--catering-accent,var(--brand))]">
                {t("catering_step_selection")}
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
                {serviceField(service, "name", locale)}
              </h2>
            </div>
            <button
              type="button"
              onClick={backToServices}
              className="rounded-full border border-[var(--divider)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text-muted)] transition hover:border-[var(--catering-accent,var(--brand))] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--catering-accent,var(--brand))]"
            >
              <span aria-hidden>←</span> {t("catering_back")}
            </button>
          </div>

          {service.pricingModel === "per_person" && (
            <section className="rounded-3xl border border-[var(--divider)] bg-[var(--surface)] p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--catering-accent,var(--brand))] text-sm font-bold text-[var(--catering-button-ink,var(--ink-on-accent))]">
                    1
                  </span>
                  <div>
                    <p className="font-bold text-[var(--text)]">{t("catering_guest_count_title")}</p>
                    <p className="mt-0.5 text-sm text-[var(--text-muted)]">{t("catering_guest_count_hint")}</p>
                    {selectedGuestMinimum > 1 && (
                      <p className="mt-1.5 text-xs font-semibold text-[var(--catering-accent,var(--brand))]">
                        {t("catering_guest_minimum_hint").replace("{n}", String(selectedGuestMinimum))}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center self-start rounded-2xl border border-[var(--divider)] bg-[var(--surface-subtle)] p-1 sm:self-auto">
                  <button
                    type="button"
                    disabled={guests <= selectedGuestMinimum}
                    onClick={() => setGuests((count) => Math.max(selectedGuestMinimum, count - 1))}
                    aria-label={t("catering_decrease_guests")}
                    className="grid h-10 w-10 place-items-center rounded-xl text-lg font-bold text-[var(--text)] transition hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    −
                  </button>
                  <label className="px-1 text-center">
                    <span className="sr-only">{t("catering_guests")}</span>
                    <input
                      type="number"
                      min={selectedGuestMinimum}
                      value={guests || ""}
                      aria-label={t("catering_guests")}
                      onChange={(event) => setGuests(Math.max(selectedGuestMinimum, Math.floor(Number(event.target.value) || selectedGuestMinimum)))}
                      className="w-20 border-0 bg-transparent px-2 text-center text-xl font-bold tabular-nums text-[var(--text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--catering-accent,var(--brand))]"
                    />
                    <span className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                      {t("catering_guests_word")}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setGuests((count) => count + 1)}
                    aria-label={t("catering_increase_guests")}
                    className="grid h-10 w-10 place-items-center rounded-xl text-lg font-bold text-[var(--text)] transition hover:bg-[var(--surface)]"
                  >
                    +
                  </button>
                </div>
              </div>
            </section>
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

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="min-w-0 space-y-7">
              <section>
                <div className="mb-3 flex items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[var(--divider)] bg-[var(--surface)] text-sm font-bold text-[var(--text)]">
                    2
                  </span>
                  <h3 className="text-lg font-bold text-[var(--text)]">{t("catering_choose_formula_title")}</h3>
                </div>
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
                    <div className={shown.length === 1 ? "max-w-2xl" : "grid items-stretch gap-4 sm:grid-cols-2"}>
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
                          onDetails={setDetailsItem}
                          t={t}
                          locale={locale}
                        />
                      ))}
                      {selectedId != null && catalog.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => { setQuantities({}); setFormulaChoices({}); setSelectedOptions(new Set()); }}
                          className="mt-3 w-full rounded-xl border border-dashed border-[var(--divider)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold text-[var(--catering-accent,var(--brand))] transition hover:border-[var(--catering-accent,var(--brand))] hover:bg-[var(--surface-subtle)]"
                        >
                          {t("catering_choose_another")}
                        </button>
                      )}
                    </div>
                  );
                })()}
              </section>

              {hasItems && catalog.options.length > 0 && (
                <section className="border-t border-[var(--divider)] pt-6">
                  <div className="mb-3">
                    <h3 className="font-bold text-[var(--text)]">{t("catering_options")}</h3>
                    <p className="mt-0.5 text-sm text-[var(--text-muted)]">{t("catering_options_hint")}</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {catalog.options.map((option) => (
                      <OptionRow
                        key={option.id}
                        option={option}
                        checked={selectedOptions.has(option.id)}
                        onToggle={toggleOption}
                        locale={locale}
                        t={t}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>

            <SelectionSummary
              className="hidden lg:block"
              service={service}
              selectedItems={selectedItems}
              quantities={quantities}
              selectedOptions={catalog.options.filter((option) => selectedOptions.has(option.id))}
              guests={guests}
              estimatedTotal={estimatedTotal}
              choicesComplete={choicesComplete}
              guestMinimumMet={guestMinimumMet}
              minimumGuests={selectedGuestMinimum}
              previewMode={previewMode}
              onContinue={goToCheckout}
              locale={locale}
              t={t}
            />
          </div>

          <div
            className="sticky z-30 -mx-4 border-t border-[var(--divider)] bg-[var(--catering-bg,var(--bg))]/95 px-4 py-3 shadow-[0_-10px_30px_rgba(0,0,0,0.12)] backdrop-blur sm:-mx-6 sm:px-6 lg:hidden"
            style={{ bottom: shoppingSide.bottom_bar ? "var(--bottomnav-h)" : 0 }}
          >
            <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-2.5 ps-4 shadow-lg">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-[var(--text-muted)]">
                  {hasItems
                    ? selectedItemCount === 1
                      ? t("catering_selected_one")
                      : t("catering_selected_many").replace("{n}", String(selectedItemCount))
                    : t("catering_select_to_continue")}
                </p>
                <p className="text-lg font-bold tabular-nums text-[var(--text)]">{`${CURRENCY}${fmtPrice(estimatedTotal)}`}</p>
              </div>
              <button
                type="button"
                disabled={!hasItems || !choicesComplete || !guestMinimumMet || previewMode}
                onClick={goToCheckout}
                className="shrink-0 rounded-xl bg-[var(--catering-accent,var(--brand))] px-5 py-3 text-sm font-bold text-[var(--catering-button-ink,var(--ink-on-accent))] transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--catering-accent,var(--brand))] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {t("catering_continue_details")} <span aria-hidden>→</span>
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
                      min={selectedGuestMinimum}
                      value={guests || ""}
                      onChange={(e) => setGuests(Math.max(selectedGuestMinimum, Math.floor(Number(e.target.value) || selectedGuestMinimum)))}
                      className={INPUT_CLASS}
                    />
                    {selectedGuestMinimum > 1 && (
                      <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                        {t("catering_guest_minimum_hint").replace("{n}", String(selectedGuestMinimum))}
                      </p>
                    )}
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
                {selectedItems.map((item) => {
                  const inclusionGroups = structuredInclusionGroups(item, locale);
                  return (
                  <li key={item.id} className="py-3 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="font-medium text-[var(--text)]">{itemField(item, "name", locale)}</span>
                      <span className="shrink-0 tabular-nums text-[var(--text-muted)]">× {quantities[item.id]}</span>
                    </div>
                    {inclusionGroups.length > 0 && (
                      <div className="mt-2 rounded-lg bg-[var(--surface-subtle)] px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t("catering_included_in_formula")}</p>
                        <div className="mt-1 space-y-1.5 text-xs leading-relaxed text-[var(--text-muted)]">
                          {inclusionGroups.map((group) => (
                            <p key={group.id}>
                              {group.title && <span className="font-semibold text-[var(--text)]">{group.title}: </span>}
                              {group.items.join(", ")}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
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
                  );
                })}
                {catalog.options.filter((option) => selectedOptions.has(option.id)).map((option) => (
                  <li key={`option-${option.id}`} className="flex justify-between gap-4 py-3 text-sm">
                    <span className="text-[var(--text-muted)]">+ {optionField(option, "name", locale)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-end justify-between border-t border-[var(--divider)] pt-4">
                <span className="text-sm text-[var(--text-muted)]">{t("catering_estimated_total")}</span>
                <span className="text-2xl font-bold tabular-nums text-[var(--text)]">{`${CURRENCY}${fmtPrice(estimatedTotal)}`}</span>
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

      {detailsItem && service && (
        <ItemDetailsSheet
          item={detailsItem}
          qty={quantities[detailsItem.id] ?? 0}
          guests={guests}
          pricingModel={service.pricingModel}
          onClose={closeItemDetails}
          onSelect={handleDetailsSelect}
          onConfigure={handleDetailsConfigure}
          locale={locale}
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
  onDetails,
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
  onDetails: (item: CateringCatalogItemPublic) => void;
  t: (key: string) => string;
  locale: Locale;
}) {
  const isPerPerson = pricingModel === "per_person";
  const rate = isPerPerson ? effectivePerPersonRate(item, guests) : item.basePrice;
  const name = itemField(item, "name", locale);
  const overview = itemField(item, "overview", locale).trim();
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
        {qty > 0 ? `✓ ${t("catering_modify_formula")}` : t("catering_choose_and_customize")}
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
      className={`group h-full overflow-hidden rounded-3xl border bg-[var(--surface)] shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg motion-reduce:transform-none ${
        qty > 0 ? "border-[var(--catering-accent,var(--brand))] ring-1 ring-[var(--catering-accent,var(--brand))]" : "border-[var(--divider)]"
      }`}
    >
      <div className="flex h-full flex-col">
        <button
          type="button"
          onClick={() => onDetails(item)}
          aria-label={`${t("catering_view_details")} — ${name}`}
          className="block w-full flex-1 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--catering-accent,var(--brand))]"
        >
          {item.imageUrl ? (
            <div className="relative aspect-[16/7] w-full overflow-hidden bg-[var(--surface-subtle)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.imageUrl} alt={name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02] motion-reduce:transform-none" />
            </div>
          ) : (
            <div className="h-1.5 w-full bg-[var(--catering-accent,var(--brand))]" aria-hidden />
          )}
          <div className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <h4 className="text-xl font-bold leading-tight tracking-tight text-[var(--text)]">{name}</h4>
              {qty > 0 && (
                <span className="shrink-0 rounded-full bg-[var(--catering-accent,var(--brand))] px-2.5 py-1 text-[11px] font-bold text-[var(--catering-button-ink,var(--ink-on-accent))]">
                  ✓ {t("catering_selected")}
                </span>
              )}
            </div>
            {overview && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--text-muted)]">{overview}</p>}
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[var(--catering-accent,var(--brand))]">
              {t("catering_view_details")} <span aria-hidden>→</span>
            </span>
          </div>
        </button>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 border-t border-[var(--divider)] bg-[var(--surface-subtle)] p-4 sm:px-5">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold tabular-nums text-[var(--text)]">{`${CURRENCY}${fmtPrice(rate)}`}</span>
              {isPerPerson && <span className="text-sm text-[var(--text-muted)]">{t("catering_per_person")}</span>}
            </div>
            {isPerPerson && item.minGuests > 1 && (
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">{t("catering_min_guests").replace("{n}", String(item.minGuests))}</p>
            )}
            {!isPerPerson && item.minQuantity > 1 && (
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">{t("catering_min_qty").replace("{n}", String(item.minQuantity))}</p>
            )}
          </div>
          {stepper}
        </div>
      </div>
    </article>
  );
}

function SelectionSummary({
  className,
  service,
  selectedItems,
  quantities,
  selectedOptions,
  guests,
  estimatedTotal,
  choicesComplete,
  guestMinimumMet,
  minimumGuests,
  previewMode,
  onContinue,
  locale,
  t,
}: {
  className?: string;
  service: CateringServicePublic;
  selectedItems: CateringCatalogItemPublic[];
  quantities: Record<number, number>;
  selectedOptions: CateringOptionPublic[];
  guests: number;
  estimatedTotal: number;
  choicesComplete: boolean;
  guestMinimumMet: boolean;
  minimumGuests: number;
  previewMode: boolean;
  onContinue: () => void;
  locale: Locale;
  t: (key: string) => string;
}) {
  const hasItems = selectedItems.length > 0;
  const canContinue = hasItems && choicesComplete && guestMinimumMet && !previewMode;
  const buttonLabel = !hasItems
    ? t("catering_choose_formula_prompt")
    : !choicesComplete
      ? t("catering_complete_formula")
      : !guestMinimumMet
        ? t("catering_minimum_required").replace("{n}", String(minimumGuests))
        : t("catering_continue_details");

  return (
    <aside
      className={`${className ?? ""} sticky rounded-3xl border border-[var(--divider)] bg-[var(--surface)] p-5 shadow-lg`}
      style={{ top: "calc(var(--nav-sticky-h, 0px) + 1.5rem)" }}
    >
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--catering-accent,var(--brand))]">
        {t("catering_summary_title")}
      </p>
      <h3 className="mt-1 text-lg font-bold text-[var(--text)]">{serviceField(service, "name", locale)}</h3>

      {hasItems ? (
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl bg-[var(--surface-subtle)] p-4">
            <p className="text-xs font-semibold text-[var(--text-muted)]">
              {t("catering_guest_summary").replace("{n}", String(guests))}
            </p>
            <ul className="mt-2 space-y-2">
              {selectedItems.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3 text-sm">
                  <span className="font-bold leading-snug text-[var(--text)]">{itemField(item, "name", locale)}</span>
                  {service.pricingModel !== "per_person" && (
                    <span className="shrink-0 tabular-nums text-[var(--text-muted)]">× {quantities[item.id]}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {selectedOptions.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t("catering_options")}</p>
              <ul className="mt-2 space-y-1.5 text-sm text-[var(--text-muted)]">
                {selectedOptions.map((option) => (
                  <li key={option.id} className="flex gap-2"><span aria-hidden>+</span><span>{optionField(option, "name", locale)}</span></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-[var(--divider)] bg-[var(--surface-subtle)] p-5 text-center">
          <span className="mx-auto grid h-10 w-10 place-items-center rounded-full border border-[var(--divider)] bg-[var(--surface)] text-lg text-[var(--text-muted)]" aria-hidden>✓</span>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">{t("catering_summary_empty")}</p>
        </div>
      )}

      <div className="mt-5 border-t border-[var(--divider)] pt-4">
        <div className="flex items-end justify-between gap-3">
          <span className="text-sm text-[var(--text-muted)]">{t("catering_estimated_total")}</span>
          <span className="text-3xl font-bold tracking-tight tabular-nums text-[var(--text)]">{`${CURRENCY}${fmtPrice(estimatedTotal)}`}</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">{t("catering_total_updates_hint")}</p>
        <button
          type="button"
          disabled={!canContinue}
          onClick={onContinue}
          className="mt-4 w-full rounded-xl bg-[var(--catering-accent,var(--brand))] px-4 py-3.5 text-sm font-bold text-[var(--catering-button-ink,var(--ink-on-accent))] transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--catering-accent,var(--brand))] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {buttonLabel} {canContinue && <span aria-hidden>→</span>}
        </button>
      </div>
    </aside>
  );
}

function ItemDetailsSheet({
  item,
  qty,
  guests,
  pricingModel,
  onClose,
  onSelect,
  onConfigure,
  locale,
  t,
}: {
  item: CateringCatalogItemPublic;
  qty: number;
  guests: number;
  pricingModel: string;
  onClose: () => void;
  onSelect: (item: CateringCatalogItemPublic) => void;
  onConfigure: (item: CateringCatalogItemPublic) => void;
  locale: Locale;
  t: (key: string) => string;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef(true);
  const isPerPerson = pricingModel === "per_person";
  const isConfigurable = item.choiceGroups.length > 0;
  const rate = isPerPerson ? effectivePerPersonRate(item, guests) : item.basePrice;
  const name = itemField(item, "name", locale);
  const overview = itemField(item, "overview", locale).trim();
  const carouselImages = useMemo(() => cateringCarouselImages(item, locale), [item, locale]);
  const inclusionGroups = useMemo(() => {
    const structured = structuredInclusionGroups(item, locale);
    if (structured.length > 0) return structured;
    const legacy = parseInclusions(itemField(item, "description", locale));
    return legacy.length > 0 ? [{ id: "legacy", title: "", description: "", items: legacy }] : [];
  }, [item, locale]);
  const [openInclusionGroups, setOpenInclusionGroups] = useState<Set<string>>(() => new Set(inclusionGroups[0] ? [inclusionGroups[0].id] : []));
  const tiers = [...item.priceTiers].sort((a, b) => a.minGuests - b.minGuests);
  const titleId = `catering-item-details-${item.id}`;
  const allInclusionGroupsOpen = inclusionGroups.length > 0 && inclusionGroups.every((group) => openInclusionGroups.has(group.id));

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      if (restoreFocusRef.current) previouslyFocused?.focus();
    };
  }, [onClose]);

  const handlePrimaryAction = () => {
    if (isConfigurable) {
      restoreFocusRef.current = false;
      onConfigure(item);
    }
    else onSelect(item);
  };

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/55 backdrop-blur-sm" role="presentation" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
        className="flex h-full w-full flex-col overflow-hidden bg-[var(--surface)] shadow-2xl sm:max-w-[34rem] sm:border-s sm:border-[var(--divider)]"
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--divider)] bg-[var(--surface)] px-4 py-3 sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--catering-accent,var(--brand))]">{t("catering_formula_details")}</p>
            <h2 id={titleId} className="mt-0.5 text-lg font-bold text-[var(--text)]">{name}</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={t("catering_close_details")}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--divider)] bg-[var(--surface-subtle)] text-xl text-[var(--text-muted)] transition hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--catering-accent,var(--brand))]"
          >
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <CateringItemGallery
            images={carouselImages}
            galleryLabel={t("catering_gallery_label")}
            previousLabel={t("catering_gallery_previous")}
            nextLabel={t("catering_gallery_next")}
            photoCountLabel={(current, total) => t("catering_gallery_photo_count").replace("{current}", String(current)).replace("{total}", String(total))}
          />
          <div className="space-y-6 p-5 sm:p-6">
            {overview && <p className="text-base leading-relaxed text-[var(--text-muted)]">{overview}</p>}

            {inclusionGroups.length > 0 && (
              <section>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--text)]">{t("catering_included_in_formula")}</h3>
                  {inclusionGroups.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setOpenInclusionGroups(allInclusionGroupsOpen ? new Set() : new Set(inclusionGroups.map((group) => group.id)))}
                      className="text-xs font-bold text-[var(--catering-accent,var(--brand))] hover:underline"
                    >
                      {allInclusionGroupsOpen ? t("catering_collapse_all") : t("catering_expand_all")}
                    </button>
                  )}
                </div>
                <div className="mt-3 space-y-2">
                  {inclusionGroups.map((group) => {
                    const open = openInclusionGroups.has(group.id);
                    const hasHeading = Boolean(group.title);
                    return (
                      <div key={group.id} className="overflow-hidden rounded-2xl border border-[var(--divider)] bg-[var(--surface-subtle)]">
                        {hasHeading ? (
                          <button
                            type="button"
                            aria-expanded={open}
                            onClick={() => setOpenInclusionGroups((previous) => {
                              const next = new Set(previous);
                              if (next.has(group.id)) next.delete(group.id); else next.add(group.id);
                              return next;
                            })}
                            className="flex w-full items-center gap-3 border-s-4 border-s-[var(--catering-accent,var(--brand))] px-4 py-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--catering-accent,var(--brand))]"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-bold uppercase tracking-[0.08em] text-[var(--text)]">{group.title}</span>
                              {group.description && <span className="mt-0.5 block text-xs text-[var(--text-muted)]">{group.description}</span>}
                            </span>
                            <span className="shrink-0 text-xs font-semibold text-[var(--text-muted)]">{t("catering_elements_count").replace("{n}", String(group.items.length))}</span>
                            <span aria-hidden className={`text-lg text-[var(--catering-accent,var(--brand))] transition-transform ${open ? "rotate-180" : ""}`}>⌄</span>
                          </button>
                        ) : null}
                        {(open || !hasHeading) && (
                          <ul className={`${hasHeading ? "border-t border-[var(--divider)]" : ""} space-y-2 px-4 py-3`}>
                            {group.items.map((line, index) => (
                              <li key={`${line}-${index}`} className="flex gap-2.5 text-sm leading-snug text-[var(--text-muted)]">
                                <span className="shrink-0 font-bold text-[var(--catering-accent,var(--brand))]">✓</span>
                                <span>{line}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {item.choiceGroups.length > 0 && (
              <section className="border-t border-[var(--divider)] pt-5">
                <h3 className="font-bold text-[var(--text)]">{t("catering_choices_in_formula")}</h3>
                <div className="mt-3 space-y-3">
                  {item.choiceGroups.map((group) => (
                    <div key={group.id} className="rounded-2xl border border-[var(--divider)] bg-[var(--surface-subtle)] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-[var(--text)]">{choiceGroupField(group, "name", locale)}</p>
                          {choiceGroupField(group, "description", locale) && (
                            <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">{choiceGroupField(group, "description", locale)}</p>
                          )}
                        </div>
                        <span className="shrink-0 rounded-full bg-[var(--surface-subtle)] px-2.5 py-1 text-xs font-bold text-[var(--text-muted)]">
                          {group.minSelections === group.maxSelections ? group.maxSelections : `${group.minSelections}–${group.maxSelections}`}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">
                        {group.items.map((choice) => choiceItemField(choice, "name", locale)).join(" · ")}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {isPerPerson && tiers.length > 0 && (
              <section className="border-t border-[var(--divider)] pt-5">
                <h3 className="font-bold text-[var(--text)]">{t("catering_price_levels")}</h3>
                <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--divider)] bg-[var(--surface-subtle)]">
                  {tiers.map((tier) => (
                    <div key={tier.minGuests} className="flex items-center justify-between border-b border-[var(--divider)] px-4 py-3 last:border-b-0">
                      <span className="text-sm text-[var(--text-muted)]">{t("catering_from_guests").replace("{n}", String(tier.minGuests))}</span>
                      <span className="font-bold tabular-nums text-[var(--text)]">{`${CURRENCY}${fmtPrice(tier.price)} ${t("catering_per_person")}`}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>

        <footer className="shrink-0 border-t border-[var(--divider)] bg-[var(--surface)] p-4 sm:px-6">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs text-[var(--text-muted)]">
                {isPerPerson ? t("catering_price_for_guests").replace("{n}", String(guests)) : t("catering_unit_price")}
              </p>
              <p className="text-2xl font-bold tabular-nums text-[var(--text)]">
                {isPerPerson ? `${CURRENCY}${fmtPrice(rate * guests)}` : `${CURRENCY}${fmtPrice(rate)}`}
              </p>
            </div>
            {isPerPerson && item.minGuests > 1 && (
              <p className="text-end text-xs text-[var(--text-muted)]">{t("catering_min_guests").replace("{n}", String(item.minGuests))}</p>
            )}
          </div>
          <button
            type="button"
            onClick={handlePrimaryAction}
            className={`w-full rounded-xl px-4 py-3.5 font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--catering-accent,var(--brand))] focus-visible:ring-offset-2 ${
              qty > 0 && !isConfigurable
                ? "border border-[var(--catering-accent,var(--brand))] text-[var(--catering-accent,var(--brand))]"
                : "bg-[var(--catering-accent,var(--brand))] text-[var(--catering-button-ink,var(--ink-on-accent))] hover:opacity-90"
            }`}
          >
            {isConfigurable
              ? qty > 0 ? t("catering_modify_formula") : t("catering_choose_and_customize")
              : qty > 0 ? t("catering_remove_selection") : t("catering_choose_this_formula")}
          </button>
        </footer>
      </section>
    </div>
  );
}

function OptionRow({
  option,
  checked,
  onToggle,
  locale,
  t,
}: {
  option: CateringOptionPublic;
  checked: boolean;
  onToggle: (id: number) => void;
  locale: Locale;
  t: (key: string) => string;
}) {
  const desc = optionField(option, "description", locale);
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border bg-[var(--surface)] p-4 transition ${checked ? "border-[var(--catering-accent,var(--brand))] ring-1 ring-[var(--catering-accent,var(--brand))]" : "border-[var(--divider)] hover:border-[var(--catering-accent,var(--brand))]"}`}>
      <input type="checkbox" checked={checked} onChange={() => onToggle(option.id)} className="mt-1 h-4 w-4 accent-[var(--catering-accent,var(--brand))]" />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-[var(--text)]">{optionField(option, "name", locale)}</span>
        {desc && <span className="block text-xs text-[var(--text-muted)]">{desc}</span>}
      </span>
      <span className="whitespace-nowrap text-sm font-bold text-[var(--text)]">
        {`${CURRENCY}${fmtPrice(option.price)}`}{option.priceMode === "per_person" ? ` ${t("catering_per_person")}` : ""}
      </span>
    </label>
  );
}
