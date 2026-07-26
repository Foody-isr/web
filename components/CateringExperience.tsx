"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  createCateringQuote,
  fetchCateringCatalog,
  type CateringCatalogItemPublic,
  type CateringOptionPublic,
  type CateringQuotePayload,
  type CateringQuoteResult,
  type CateringServicePublic,
} from "@/services/api";
import { CateringQuoteView } from "@/components/CateringQuoteView";
import { SiteTopNav } from "@/components/SiteTopNav";
import { SectionRenderer } from "@/components/sections/SectionRenderer";
import { usePageSections } from "@/lib/usePageSections";
import { Restaurant } from "@/lib/types";
import { useI18n, type Locale } from "@/lib/i18n";
import { tField, type TranslatableEntity } from "@/lib/translations";
import { currencySymbol, CURRENCY_CODE } from "@/lib/constants";

const CURRENCY = currencySymbol(CURRENCY_CODE);
const INPUT_CLASS =
  "w-full rounded-xl border border-[var(--divider)] bg-[var(--surface)] px-4 py-3 text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-brand";

type Stage = "services" | "configure" | "result";
type Catalog = { items: CateringCatalogItemPublic[]; options: CateringOptionPublic[] };
type Props = { restaurant: Restaurant; services: CateringServicePublic[] };

// CateringServicePublic has no index signature, so tField (which expects
// TranslatableEntity) needs an explicit cast. Kept local — the DTO stays untouched.
function serviceField(service: CateringServicePublic, field: "name" | "description", locale: Locale): string {
  return tField(service as unknown as TranslatableEntity, field, locale, service[field]);
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

export function CateringExperience({ restaurant, services }: Props) {
  const { t, locale } = useI18n();
  const slug = restaurant.slug || String(restaurant.id);
  // Builder-authored marketing sections for this page, rendered above the shop
  // (hero, text+image, gallery, image cards...). Live-previews in the builder.
  const { sections: cateringSections } = usePageSections(restaurant, "catering");

  const [stage, setStage] = useState<Stage>("services");
  const [service, setService] = useState<CateringServicePublic | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [guests, setGuests] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Set<number>>(new Set());
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
      setQuantities({});
      setSelectedOptions(new Set());
      setStage("configure");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingCatalog(false);
    }
  }

  function setQty(item: CateringCatalogItemPublic, next: number) {
    setQuantities((prev) => {
      const copy = { ...prev };
      if (next <= 0) delete copy[item.id];
      else copy[item.id] = next;
      return copy;
    });
  }

  function stepQty(item: CateringCatalogItemPublic, direction: 1 | -1) {
    const current = quantities[item.id] ?? 0;
    const minQty = Math.max(1, item.minQuantity || 1);
    if (direction > 0) setQty(item, current === 0 ? minQty : current + 1);
    else setQty(item, current - 1 < minQty ? 0 : current - 1);
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
    }
    for (const option of catalog.options) {
      if (!selectedOptions.has(option.id)) continue;
      total += option.priceMode === "per_person" ? option.price * guests : option.price;
    }
    return total;
  }, [catalog, service, quantities, guests, selectedOptions]);

  const hasItems = Object.values(quantities).some((q) => q > 0);
  const canSubmit =
    customerName.trim().length > 0 &&
    customerPhone.trim().length > 0 &&
    eventCity.trim().length > 0 &&
    hasItems &&
    !submitting;

  async function handleSubmit() {
    if (!service || !canSubmit) return;
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
    setQuantities({});
    setSelectedOptions(new Set());
    setQuoteResult(null);
    setError(null);
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <SiteTopNav restaurant={restaurant} activeKey="catering" />

      {/* Builder-authored marketing sections (hero, about, gallery, cards)
          render above the shop, live-previewing inside the website builder. */}
      {cateringSections.length > 0 && (
        <SectionRenderer sections={cateringSections} restaurant={restaurant} />
      )}

      <header className="border-b border-[var(--divider)] px-4 pb-4 pt-6">
        <h1 className="text-xl font-bold">{t("catering_title")}</h1>
        <p className="text-sm text-[var(--text-muted)]">{restaurant.name}</p>
      </header>

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
          <div className="px-4 py-6">
            <h2 className="mb-3 text-sm font-semibold text-[var(--text-muted)]">{t("catering_choose_service")}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {services.map((svc) => (
                <button
                  key={svc.id}
                  type="button"
                  disabled={loadingCatalog}
                  onClick={() => handleSelectService(svc)}
                  className="w-full rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-4 text-start shadow-sm transition hover:border-brand hover:shadow-md disabled:opacity-50"
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
        <div className="space-y-6 px-4 py-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[var(--text)]">{serviceField(service, "name", locale)}</h2>
            <button type="button" onClick={backToServices} className="text-sm font-semibold text-brand">
              {t("catering_back")}
            </button>
          </div>

          <section className="space-y-3">
            {catalog.items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                qty={quantities[item.id] ?? 0}
                guests={guests}
                pricingModel={service.pricingModel}
                onStep={stepQty}
                t={t}
              />
            ))}
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <label className="mb-1 block text-sm font-medium text-[var(--text-muted)]">{t("catering_guests")}</label>
              <input
                type="number"
                min={1}
                value={guests}
                onChange={(e) => setGuests(Math.max(1, Number(e.target.value) || 1))}
                className={INPUT_CLASS}
              />
            </div>
            <div className="min-w-0">
              <label className="mb-1 block text-sm font-medium text-[var(--text-muted)]">
                {t("catering_event_date")}
              </label>
              {/* min-w-0 + appearance-none stop the native date control from forcing
                  an intrinsic width that overflows the viewport on mobile. */}
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className={`${INPUT_CLASS} min-w-0 appearance-none`}
              />
            </div>
          </div>

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
                  />
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">{t("catering_your_details")}</h3>
            <div className="grid gap-3">
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={t("catering_name")}
                className={INPUT_CLASS}
              />
              <input
                type="tel"
                required
                dir="ltr"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder={t("catering_phone")}
                className={INPUT_CLASS}
              />
              <input
                type="email"
                dir="ltr"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder={t("catering_email")}
                className={INPUT_CLASS}
              />
              <input
                type="text"
                required
                value={eventCity}
                onChange={(e) => setEventCity(e.target.value)}
                placeholder={t("catering_event_city")}
                className={INPUT_CLASS}
              />
            </div>
          </section>

          <div className="flex items-center justify-between rounded-2xl border border-[var(--divider)] bg-[var(--surface-subtle)] p-4">
            <span className="text-sm text-[var(--text-muted)]">{t("catering_estimated_total")}</span>
            <span className="text-lg font-bold text-[var(--text)]">{`${CURRENCY}${estimatedTotal.toFixed(2)}`}</span>
          </div>

          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="w-full rounded-xl bg-brand py-4 font-bold text-white shadow-lg shadow-brand/30 transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? t("catering_submitting") : t("catering_get_quote")}
          </button>
        </div>
      )}

      {/* Result stage */}
      {stage === "result" && quoteResult && (
        <div className="px-4 py-10 text-center">
          <div className="mx-auto max-w-md rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-6 shadow-sm">
            <CateringQuoteView quote={quoteResult} restaurantId={restaurant.id} />

            <Link
              href={`/r/${slug}/catering/quote/${quoteResult.publicToken}`}
              className="mt-6 block break-all rounded-xl border border-dashed border-[var(--divider)] px-4 py-3 text-xs font-mono text-brand transition hover:border-brand"
            >
              {`/r/${slug}/catering/quote/${quoteResult.publicToken}`}
            </Link>

            <button
              type="button"
              onClick={backToServices}
              className="mt-3 w-full rounded-xl bg-brand py-3 font-bold text-white transition hover:bg-brand-dark"
            >
              {t("catering_back")}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function ItemRow({
  item,
  qty,
  guests,
  pricingModel,
  onStep,
  t,
}: {
  item: CateringCatalogItemPublic;
  qty: number;
  guests: number;
  pricingModel: string;
  onStep: (item: CateringCatalogItemPublic, direction: 1 | -1) => void;
  t: (key: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const isPerPerson = pricingModel === "per_person";
  const rate = isPerPerson ? effectivePerPersonRate(item, guests) : item.basePrice;
  const units = Math.max(qty, 1);
  const lineTotal = isPerPerson ? rate * guests * units : item.basePrice * units;
  const inclusions = parseInclusions(item.description);
  const shown = expanded ? inclusions : inclusions.slice(0, 6);
  const tiers = [...(item.priceTiers ?? [])].sort((a, b) => a.minGuests - b.minGuests);
  const activeTierMin = isPerPerson
    ? tiers.reduce((best, tr) => (guests >= tr.minGuests && tr.minGuests > best ? tr.minGuests : best), -1)
    : -1;

  const stepper =
    qty === 0 ? (
      <button
        type="button"
        onClick={() => onStep(item, 1)}
        className="shrink-0 rounded-full bg-brand px-5 py-2 text-sm font-bold text-white transition hover:bg-brand-dark"
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
      className={`overflow-hidden rounded-2xl border bg-[var(--surface)] transition ${
        qty > 0 ? "border-brand shadow-md shadow-brand/10" : "border-[var(--divider)]"
      }`}
    >
      <div className="flex flex-col sm:flex-row">
        {/* Photo */}
        <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-[var(--surface-subtle)] sm:aspect-auto sm:w-2/5">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
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
            <h4 className="text-lg font-bold leading-tight text-[var(--text)]">{item.name}</h4>
            {stepper}
          </div>

          {inclusions.length > 0 && (
            <div>
              <ul className="grid gap-x-4 gap-y-1 text-sm text-[var(--text-muted)] sm:grid-cols-2">
                {shown.map((line, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand" />
                    <span className="leading-snug">{line}</span>
                  </li>
                ))}
              </ul>
              {inclusions.length > 6 && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="mt-1.5 text-xs font-semibold text-brand hover:underline"
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
                            ? "bg-brand font-semibold text-white"
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
}: {
  option: CateringOptionPublic;
  checked: boolean;
  onToggle: (id: number) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-3">
      <input type="checkbox" checked={checked} onChange={() => onToggle(option.id)} className="mt-1 h-4 w-4 accent-brand" />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-[var(--text)]">{option.name}</span>
        {option.description && <span className="block text-xs text-[var(--text-muted)]">{option.description}</span>}
      </span>
      <span className="whitespace-nowrap text-sm font-bold text-[var(--text)]">{`${CURRENCY}${option.price}`}</span>
    </label>
  );
}
