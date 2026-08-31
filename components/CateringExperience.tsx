"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  createCateringQuote,
  createCateringDeposit,
  fetchCateringCatalog,
  type CateringCatalogGroupPublic,
  type CateringCatalogItemPublic,
  type CateringCatalogPublic,
  type CateringChoiceGroupPublic,
  type CateringChoiceItemPublic,
  type CateringOptionPublic,
  type CateringOfferServiceModePublic,
  type CateringQuotePayload,
  type CateringQuoteSessionPayload,
  type CateringFlowConfigPublic,
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
import { CateringFlowWizard } from "@/components/CateringFlowWizard";
import { CateringDateInput } from "@/components/CateringDateInput";
import { cateringOfferMinimumGuests, cateringOfferSearchState, defaultCateringSearchFlow, offerMatchesCateringSearch } from "@/lib/cateringSearch";
import { cateringSessionDate, cateringSessionSummary, cateringSessionTitle } from "@/lib/cateringSessionLabels";
import {
  estimateFlowAdjustment,
  estimateSessionFlowAdjustment,
  describeFlowAnswer,
  selectedCatalogPerGuestRate,
  selectedSessionCatalogPerGuestRate,
  sessionCatalogPerGuestRate,
  resolveCatalogPricing,
  visibleFlowSteps,
  visibleSessionFlowSteps,
  type CateringFlowAnswers,
} from "@/lib/cateringFlow";
import {
  cateringBasePath,
  cateringItemPath,
  cateringServicePath,
  parseCateringPath,
} from "@/lib/cateringRoutes";

const CURRENCY = currencySymbol(CURRENCY_CODE);
const INPUT_CLASS =
  "w-full rounded-xl border border-[var(--divider)] bg-[var(--surface)] px-4 py-3 text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--catering-accent,var(--brand))]";

type Stage = "services" | "journey" | "configure" | "options" | "checkout" | "result";
type Catalog = CateringCatalogPublic;
type FormulaChoices = Record<number, Record<number, number>>;
type AllFormulaChoices = Record<number, FormulaChoices>;
type OptionQuantities = Record<number, number>;
type SessionSelectionDraft = {
  quantities: Record<number, number>;
  selectedOptions: OptionQuantities;
  formulaChoices: AllFormulaChoices;
  serviceModes: Record<number, string>;
};

const emptySessionDraft = (): SessionSelectionDraft => ({ quantities: {}, selectedOptions: {}, formulaChoices: {}, serviceModes: {} });

function nextAddedSessionID(sessions: CateringQuoteSessionPayload[]): string {
  let index = sessions.length + 1;
  while (sessions.some((session) => session.id === `added_${index}`)) index += 1;
  return `added_${index}`;
}

type Props = {
  restaurant: Restaurant;
  services: CateringServicePublic[];
  /** Canonical V3 page identity and sections. Omitted by the legacy route. */
  pageSlug?: string;
  pageSections?: WebsiteSection[];
  showFooter?: boolean;
  /** Website Builder preview is view-only and cannot create a quote. */
  previewMode?: boolean;
  /** Server-resolved deep link. Keeps direct URLs fast and returns 404 for stale slugs. */
  initialSelection?: {
    service: CateringServicePublic;
    catalog: CateringCatalogPublic;
    item?: CateringCatalogItemPublic;
  } | null;
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
function serviceModeField(mode: CateringOfferServiceModePublic, field: "name" | "description", locale: Locale): string {
  return tField(mode as unknown as TranslatableEntity, field, locale, mode[field]);
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

function effectiveServiceModeRate(item: CateringCatalogItemPublic, serviceModeId: string | undefined, guests: number): number {
  const fallback = effectivePerPersonRate(item, guests);
  const modes = item.serviceModes ?? [];
  const selected = modes.find((mode) => mode.id === serviceModeId) ?? (modes.length === 1 ? modes[0] : undefined);
  if (selected?.price !== undefined) return selected.price;
  if (!serviceModeId && modes.length > 1) {
    const prices = modes.flatMap((mode) => mode.price === undefined ? [] : [mode.price]);
    if (prices.length > 0) return Math.min(...prices);
  }
  return fallback;
}

function estimateCatalogSelection({ catalog, service, quantities, selectedOptions, formulaChoices, serviceModes, guests, catalogRate, catalogRates }: {
  catalog: Catalog;
  service: CateringServicePublic;
  quantities: Record<number, number>;
  selectedOptions: OptionQuantities;
  formulaChoices: AllFormulaChoices;
  serviceModes: Record<number, string>;
  guests: number;
  catalogRate?: number;
  catalogRates?: Record<number, number>;
}): number {
  let total = 0;
  for (const item of catalog.items) {
    const quantity = quantities[item.id] ?? 0;
    if (quantity <= 0) continue;
    const modeRate = effectiveServiceModeRate(item, serviceModes[item.id], guests);
    if (service.pricingModel === "per_person") total += (catalogRates?.[item.id] ?? catalogRate ?? modeRate) * guests * quantity;
    else total += modeRate * quantity;
    const itemChoices = formulaChoices[item.id] ?? {};
    for (const group of item.choiceGroups ?? []) {
      const selected = itemChoices[group.id] ?? {};
      for (const option of group.items) {
        const choiceQuantity = selected[option.id] ?? 0;
        if (choiceQuantity <= 0) continue;
        const factor = service.pricingModel === "per_person" ? guests * quantity : quantity;
        total += option.priceDelta * choiceQuantity * factor;
      }
    }
  }
  for (const option of catalog.options) {
    const optionQuantity = selectedOptions[option.id] ?? 0;
    if (optionQuantity <= 0) continue;
    if (option.priceMode === "per_person") total += option.price * guests;
    else if (option.priceMode === "per_unit") total += option.price * optionQuantity;
    else total += option.price;
  }
  return total;
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

// Catalog imports sometimes place a raw, all-caps ingredient dump in the
// editorial overview field. Prefer the structured inclusions in that case so
// the card remains readable without rewriting restaurant-authored copy.
function isRawUppercaseCopy(value: string): boolean {
  const latinLetters = value.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/g) ?? [];
  if (latinLetters.length < 12) return false;
  return !latinLetters.some((letter) => letter === letter.toLocaleLowerCase() && letter !== letter.toLocaleUpperCase());
}

const fmtPrice = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(2));

function suggestedGuestCount(items: CateringCatalogItemPublic[]): number {
  const minimums = items.map((item) => Math.max(1, item.minGuests || 1));
  return minimums.length > 0 ? Math.min(...minimums) : 1;
}

function localizedFlowConfig(config: CateringFlowConfigPublic, locale: Locale): CateringFlowConfigPublic {
  return {
    ...config,
    steps: config.steps.map((step) => ({
      ...step,
      title: tField(step as unknown as TranslatableEntity, "title", locale, step.title),
      description: tField(step as unknown as TranslatableEntity, "description", locale, step.description ?? ""),
      options: step.options?.map((option) => ({
        ...option,
        label: tField(option as unknown as TranslatableEntity, "label", locale, option.label),
        description: tField(option as unknown as TranslatableEntity, "description", locale, option.description ?? ""),
      })),
      schedule: step.schedule ? {
        ...step.schedule,
        slots: step.schedule.slots?.map((slot) => ({
          ...slot,
          label: tField(slot as unknown as TranslatableEntity, "label", locale, slot.label),
          description: tField(slot as unknown as TranslatableEntity, "description", locale, slot.description ?? ""),
        })),
      } : undefined,
    })),
  };
}

export function CateringExperience({
  restaurant,
  services,
  pageSlug,
  pageSections,
  showFooter = false,
  previewMode = false,
  initialSelection,
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

  const [stage, setStage] = useState<Stage>(initialSelection ? "journey" : "services");
  const [service, setService] = useState<CateringServicePublic | null>(initialSelection?.service ?? null);
  const [catalog, setCatalog] = useState<Catalog | null>(initialSelection?.catalog ?? null);
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [guests, setGuests] = useState(() => initialSelection ? suggestedGuestCount(initialSelection.catalog.items) : 1);
  const [selectedOptions, setSelectedOptions] = useState<OptionQuantities>({});
  const [formulaChoices, setFormulaChoices] = useState<AllFormulaChoices>({});
  const [selectedServiceModes, setSelectedServiceModes] = useState<Record<number, string>>({});
  const [configuringItem, setConfiguringItem] = useState<CateringCatalogItemPublic | null>(null);
  const [detailsItem, setDetailsItem] = useState<CateringCatalogItemPublic | null>(initialSelection?.item ?? null);
  const [eventDate, setEventDate] = useState("");
  const [flowAnswers, setFlowAnswers] = useState<CateringFlowAnswers>({});
  const [sessionAnswers, setSessionAnswers] = useState<Record<string, CateringFlowAnswers>>({});
  const [sessions, setSessions] = useState<CateringQuoteSessionPayload[]>([]);
  const [sessionDrafts, setSessionDrafts] = useState<Record<string, SessionSelectionDraft>>({});
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [journeyComplete, setJourneyComplete] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [eventCity, setEventCity] = useState("");
  const [quoteResult, setQuoteResult] = useState<CateringQuoteResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const customerFlowConfig = useMemo(() => service
    ? service.flowConfig?.enabled
      ? localizedFlowConfig(service.flowConfig, locale)
      : defaultCateringSearchFlow(t)
    : undefined, [locale, service, t]);
  const journeyHasSteps = Boolean(service && customerFlowConfig?.steps.length);
  const journeyCollectsGuests = Boolean(journeyComplete && customerFlowConfig?.steps.some((step) => step.kind === "guest_count"));
  const journeyCollectsSchedule = Boolean(journeyComplete && customerFlowConfig?.steps.some((step) => step.kind === "schedule"));
  const quoteSessions = useMemo(() => {
    if (!customerFlowConfig?.enabled) return [];
    return sessions;
  }, [customerFlowConfig, sessions]);
  const resetToServices = useCallback(() => {
    setStage("services");
    setService(null);
    setCatalog(null);
    setActiveGroupId(null);
    setQuantities({});
    setSelectedOptions({});
    setFormulaChoices({});
    setSelectedServiceModes({});
    setConfiguringItem(null);
    setDetailsItem(null);
    setFlowAnswers({});
    setSessionAnswers({});
    setSessions([]);
    setSessionDrafts({});
    setActiveSessionId(null);
    setJourneyComplete(false);
    setQuoteResult(null);
    setError(null);
  }, []);

  const handleSelectService = useCallback(async (
    picked: CateringServicePublic,
    route?: { pushHistory?: boolean; itemSlug?: string },
  ) => {
    setError(null);
    setLoadingCatalog(true);
    try {
      const data = await fetchCateringCatalog(restaurant.id, picked.id);
      setService(picked);
      setCatalog(data);
      setActiveGroupId(null);
      setQuantities({});
      setGuests(suggestedGuestCount(data.items));
      setSelectedOptions({});
      setFormulaChoices({});
      setSelectedServiceModes({});
      setFlowAnswers({});
      setSessionAnswers({});
      setSessions([]);
      setSessionDrafts({});
      setActiveSessionId(null);
      setJourneyComplete(false);
      setDetailsItem(route?.itemSlug ? data.items.find((item) => item.slug === route.itemSlug) ?? null : null);
      setStage("journey");
      if (route?.pushHistory && typeof window !== "undefined") {
        window.history.pushState(
          { ...(window.history.state ?? {}), __foodyCateringView: "service" },
          "",
          cateringServicePath(slug, picked.slug),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingCatalog(false);
    }
  }, [restaurant.id, slug]);

  const openItemDetails = useCallback((item: CateringCatalogItemPublic) => {
    setDetailsItem(item);
    if (!service || typeof window === "undefined") return;
    const path = cateringItemPath(slug, service.slug, item.slug);
    if (window.location.pathname === path) return;
    window.history.pushState(
      { ...(window.history.state ?? {}), __foodyCateringView: "item" },
      "",
      path,
    );
  }, [service, slug]);

  const closeItemDetails = useCallback(() => {
    setDetailsItem(null);
    if (!service || typeof window === "undefined") return;
    const route = parseCateringPath(window.location.pathname, slug);
    if (!route?.itemSlug) return;
    if (window.history.state?.__foodyCateringView === "item") {
      window.history.back();
      return;
    }
    window.history.replaceState(
      { ...(window.history.state ?? {}), __foodyCateringView: "service" },
      "",
      cateringServicePath(slug, service.slug),
    );
  }, [service, slug]);

  useEffect(() => {
    const syncFromHistory = () => {
      const route = parseCateringPath(window.location.pathname, slug);
      if (!route) return;
      if (!route.serviceSlug) {
        resetToServices();
        return;
      }
      const picked = services.find((candidate) => candidate.slug === route.serviceSlug);
      if (!picked) return;
      if (service?.slug !== picked.slug || !catalog) {
        void handleSelectService(picked, { itemSlug: route.itemSlug });
        return;
      }
      setStage(!journeyComplete ? "journey" : "configure");
      setDetailsItem(route.itemSlug ? catalog.items.find((item) => item.slug === route.itemSlug) ?? null : null);
    };
    window.addEventListener("popstate", syncFromHistory);
    return () => window.removeEventListener("popstate", syncFromHistory);
  }, [catalog, handleSelectService, journeyComplete, resetToServices, service?.slug, services, slug]);

  // Offer groups are combinable by default; single-select remains available as
  // an explicit Admin choice for genuinely mutually-exclusive offers.
  const singleSelect = !!service && service.selectionMode === "single";
  const currentSessionId = activeSessionId ?? quoteSessions[0]?.id ?? null;
  const activeSession = quoteSessions.find((session) => session.id === currentSessionId);
  const selectionGuests = activeSession?.guests || guests;
  const searchDate = activeSession?.date || eventDate;
  const matchingItems = useMemo(() => catalog?.items.filter((item) => offerMatchesCateringSearch(item, selectionGuests, searchDate, customerFlowConfig)) ?? [], [catalog, customerFlowConfig, searchDate, selectionGuests]);
  const suggestedItems = useMemo(() => catalog?.items
    .filter((item) => cateringOfferSearchState(item, selectionGuests, searchDate, customerFlowConfig) === "guest_minimum")
    .map((item) => ({ item, minimumGuests: cateringOfferMinimumGuests(item, customerFlowConfig, searchDate) }))
    .sort((left, right) => left.minimumGuests - right.minimumGuests || left.item.name.localeCompare(right.item.name)) ?? [], [catalog, customerFlowConfig, searchDate, selectionGuests]);

  function setSelectionGuests(value: number | ((current: number) => number)) {
    const next = typeof value === "function" ? value(selectionGuests) : value;
    if (!activeSession) {
      setGuests(next);
      return;
    }
    setSessions((current) => current.map((session) => session.id === activeSession.id ? { ...session, guests: next } : session));
  }

  function applySuggestedMinimum(item: CateringCatalogItemPublic) {
    const minimum = Math.max(1, cateringOfferMinimumGuests(item, customerFlowConfig, searchDate) || 1);
    if (quoteSessions.length <= 1) setGuests(minimum);
    setSelectionGuests(minimum);
    setActiveGroupId(null);
    requestAnimationFrame(scrollToTop);
  }

  function currentSessionDraft(): SessionSelectionDraft {
    return {
      quantities: { ...quantities },
      selectedOptions: { ...selectedOptions },
      formulaChoices: structuredClone(formulaChoices),
      serviceModes: { ...selectedServiceModes },
    };
  }

  function switchSession(sessionId: string, copyCurrent = false) {
    if (currentSessionId) {
      setSessionDrafts((current) => ({ ...current, [currentSessionId]: currentSessionDraft() }));
    }
    const target = copyCurrent ? currentSessionDraft() : sessionDrafts[sessionId] ?? emptySessionDraft();
    setQuantities({ ...target.quantities });
    setSelectedOptions({ ...target.selectedOptions });
    setFormulaChoices(structuredClone(target.formulaChoices));
    setSelectedServiceModes({ ...target.serviceModes });
    setActiveSessionId(sessionId);
    setActiveGroupId(null);
    requestAnimationFrame(scrollToTop);
  }

  function addSession() {
    if (!service?.allowExtraSessions || sessions.length >= service.maxSessions) return;
    const id = nextAddedSessionID(sessions);
    const date = activeSession?.date || eventDate || sessions[0]?.date || "";
    const savedDraft = currentSessionDraft();
    if (currentSessionId) {
      setSessionDrafts((current) => ({ ...current, [currentSessionId]: savedDraft, [id]: emptySessionDraft() }));
    }
    setSessions((current) => [...current, {
      id,
      label: t("catering_session_number").replace("{number}", String(current.length + 1)),
      date,
      guests: selectionGuests,
    }]);
    setQuantities({});
    setSelectedOptions({});
    setFormulaChoices({});
    setSelectedServiceModes({});
    setActiveSessionId(id);
    setActiveGroupId(null);
  }

  function updateAddedSessionDate(sessionId: string, date: string) {
    setSessions((current) => current.map((session) => session.id === sessionId ? { ...session, date } : session));
    setSessionDrafts((current) => ({ ...current, [sessionId]: emptySessionDraft() }));
    if (sessionId === currentSessionId) {
      setQuantities({});
      setSelectedOptions({});
      setFormulaChoices({});
      setSelectedServiceModes({});
      setActiveGroupId(null);
    }
  }

  function removeAddedSession(sessionId: string) {
    if (sessions.length <= 1) return;
    const remaining = sessions.filter((session) => session.id !== sessionId);
    setSessions(remaining);
    setSessionDrafts((current) => {
      const next = { ...current };
      delete next[sessionId];
      return next;
    });
    setSessionAnswers((current) => {
      const next = { ...current };
      delete next[sessionId];
      return next;
    });
    if (sessionId !== currentSessionId) return;
    const target = remaining[0];
    const draft = sessionDrafts[target.id] ?? emptySessionDraft();
    setQuantities({ ...draft.quantities });
    setSelectedOptions({ ...draft.selectedOptions });
    setFormulaChoices(structuredClone(draft.formulaChoices));
    setSelectedServiceModes({ ...draft.serviceModes });
    setActiveSessionId(target.id);
    setActiveGroupId(null);
  }

  function setQty(item: CateringCatalogItemPublic, next: number) {
    setQuantities((prev) => {
      const copy = { ...prev };
      if (next <= 0) delete copy[item.id];
      else copy[item.id] = next;
      return copy;
    });
    setSelectedServiceModes((previous) => {
      const nextModes = { ...previous };
      if (next <= 0) delete nextModes[item.id];
      else if (!nextModes[item.id] && item.serviceModes.length === 1) nextModes[item.id] = item.serviceModes[0].id;
      return nextModes;
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
      setSelectedServiceModes(item.serviceModes.length === 1 ? { [item.id]: item.serviceModes[0].id } : {});
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
        setSelectedServiceModes((all) => {
          const next = { ...all };
          delete next[item.id];
          return next;
        });
        return copy;
      }
      setSelectedServiceModes((all) => singleSelect
        ? (item.serviceModes.length === 1 ? { [item.id]: item.serviceModes[0].id } : {})
        : (item.serviceModes.length === 1 ? { ...all, [item.id]: item.serviceModes[0].id } : all));
      return singleSelect ? { [item.id]: 1 } : { ...prev, [item.id]: 1 };
    });
  }

  function configureFormula(item: CateringCatalogItemPublic, choices: FormulaChoices) {
    setFormulaChoices((previous) => singleSelect ? { [item.id]: choices } : { ...previous, [item.id]: choices });
    setQuantities((previous) => singleSelect ? { [item.id]: 1 } : { ...previous, [item.id]: 1 });
    setSelectedServiceModes((previous) => singleSelect
      ? (item.serviceModes.length === 1 ? { [item.id]: item.serviceModes[0].id } : (previous[item.id] ? { [item.id]: previous[item.id] } : {}))
      : (item.serviceModes.length === 1 ? { ...previous, [item.id]: item.serviceModes[0].id } : previous));
    setConfiguringItem(null);
  }

  function toggleOption(optionId: number) {
    setSelectedOptions((prev) => {
      const next = { ...prev };
      if ((next[optionId] ?? 0) > 0) delete next[optionId];
      else next[optionId] = 1;
      return next;
    });
  }

  function setOptionQuantity(optionId: number, quantity: number) {
    setSelectedOptions((previous) => {
      const next = { ...previous };
      if (quantity <= 0) delete next[optionId];
      else next[optionId] = quantity;
      return next;
    });
  }

  function handleDetailsSelect(item: CateringCatalogItemPublic) {
    closeItemDetails();
    if ((quantities[item.id] ?? 0) > 0) {
      setQty(item, 0);
      return;
    }
    if (service?.pricingModel === "per_person") toggleItem(item);
    else stepQty(item, 1);
  }

  function handleDetailsConfigure(item: CateringCatalogItemPublic) {
    closeItemDetails();
    setConfiguringItem(item);
  }

  const resolvedSessionDrafts = useMemo(() => {
    const resolved = { ...sessionDrafts };
    if (currentSessionId) resolved[currentSessionId] = { quantities, selectedOptions, formulaChoices, serviceModes: selectedServiceModes };
    return resolved;
  }, [currentSessionId, formulaChoices, quantities, selectedOptions, selectedServiceModes, sessionDrafts]);

  // Informational estimate mirroring the authoritative API: every occurrence
  // owns a catalog basket and is calculated independently before being summed.
  const sessionTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    if (!catalog || !service) return totals;
    const bookingRate = selectedCatalogPerGuestRate(service.flowConfig, flowAnswers);
    for (const session of quoteSessions) {
      const draft = resolvedSessionDrafts[session.id] ?? emptySessionDraft();
      const sessionGuests = session.guests || guests;
      const rate = selectedSessionCatalogPerGuestRate(service.flowConfig, flowAnswers, sessionAnswers[session.id] ?? {})
        ?? sessionCatalogPerGuestRate(service.flowConfig, session)
        ?? bookingRate;
      const centralRates = Object.fromEntries(catalog.items.flatMap((item) => {
        const resolved = resolveCatalogPricing(service.flowConfig, item.id, sessionGuests, session, flowAnswers, sessionAnswers[session.id] ?? {}, draft.serviceModes[item.id]);
        return resolved.rate === undefined ? [] : [[item.id, resolved.rate]];
      }));
      totals[session.id] = estimateCatalogSelection({ catalog, service, ...draft, guests: sessionGuests, catalogRate: rate, catalogRates: centralRates })
        + estimateSessionFlowAdjustment(service.flowConfig, flowAnswers, sessionAnswers[session.id] ?? {}, sessionGuests);
    }
    return totals;
  }, [catalog, flowAnswers, guests, quoteSessions, resolvedSessionDrafts, service, sessionAnswers]);

  const activeEstimatedTotal = currentSessionId
    ? sessionTotals[currentSessionId] ?? 0
    : catalog && service
      ? estimateCatalogSelection({
        catalog, service, quantities, selectedOptions, formulaChoices, serviceModes: selectedServiceModes, guests: selectionGuests,
        catalogRate: selectedCatalogPerGuestRate(service.flowConfig, flowAnswers),
        catalogRates: Object.fromEntries(catalog.items.flatMap((item) => {
          const resolved = resolveCatalogPricing(service.flowConfig, item.id, selectionGuests, undefined, flowAnswers, {}, selectedServiceModes[item.id]);
          return resolved.rate === undefined ? [] : [[item.id, resolved.rate]];
        })),
      })
      : 0;
  const estimatedTotal = quoteSessions.length > 0
    ? Object.values(sessionTotals).reduce((sum, subtotal) => sum + subtotal, 0) + estimateFlowAdjustment(service?.flowConfig, flowAnswers, quoteSessions, guests)
    : activeEstimatedTotal + estimateFlowAdjustment(service?.flowConfig, flowAnswers, quoteSessions, guests);
  const displayedCatalogRates = useMemo(() => {
    if (!catalog || !service) return {} as Record<number, number>;
    const activeGuests = activeSession?.guests || selectionGuests;
    return Object.fromEntries(catalog.items.flatMap((item) => {
      const resolved = resolveCatalogPricing(service.flowConfig, item.id, activeGuests, activeSession, flowAnswers, activeSession ? sessionAnswers[activeSession.id] ?? {} : {}, selectedServiceModes[item.id]);
      return resolved.rate === undefined ? [] : [[item.id, resolved.rate]];
    }));
  }, [activeSession, catalog, flowAnswers, selectedServiceModes, selectionGuests, service, sessionAnswers]);

  const hasItems = Object.values(quantities).some((q) => q > 0);
  const selectedItems = useMemo(
    () => catalog?.items.filter((item) => (quantities[item.id] ?? 0) > 0) ?? [],
    [catalog, quantities],
  );
  const availableOptions = useMemo(() => catalog?.options.filter((option) => option.catalogItemId === null || (quantities[option.catalogItemId] ?? 0) > 0) ?? [], [catalog, quantities]);
  const catalogGuestMinimum = catalog ? suggestedGuestCount(catalog.items) : 1;
  const selectedGuestMinimum = selectedItems.reduce(
    (minimum, item) => Math.max(minimum, item.minGuests || 1),
    catalogGuestMinimum,
  );
  const guestMinimumMet = selectionGuests >= selectedGuestMinimum;
  useEffect(() => {
    const allowed = new Set(availableOptions.map((option) => option.id));
    setSelectedOptions((previous) => {
      const next = Object.fromEntries(Object.entries(previous).filter(([id]) => allowed.has(Number(id))));
      return Object.keys(next).length === Object.keys(previous).length ? previous : next;
    });
  }, [availableOptions]);
  const choicesComplete = useMemo(() => selectedItems.every((item) => (item.choiceGroups ?? []).every((group) => {
    const count = Object.values(formulaChoices[item.id]?.[group.id] ?? {}).reduce((sum, quantity) => sum + quantity, 0);
    return count >= group.minSelections && count <= group.maxSelections;
  })), [selectedItems, formulaChoices]);
  const serviceModesComplete = selectedItems.every((item) => item.serviceModes.length <= 1 || item.serviceModes.some((mode) => mode.id === selectedServiceModes[item.id]));
  const selectedItemCount = selectedItems.reduce((sum, item) => sum + (quantities[item.id] ?? 0), 0);
  const sessionDraftComplete = (session: CateringQuoteSessionPayload, draft: SessionSelectionDraft): boolean => {
    const selected = catalog?.items.filter((item) => (draft.quantities[item.id] ?? 0) > 0) ?? [];
    if (selected.length === 0) return false;
    const sessionGuests = session.guests || guests;
    return selected.every((item) => sessionGuests >= Math.max(1, item.minGuests || 1) && (item.serviceModes.length <= 1 || item.serviceModes.some((mode) => mode.id === draft.serviceModes[item.id])) && item.choiceGroups.every((group) => {
      const count = Object.values(draft.formulaChoices[item.id]?.[group.id] ?? {}).reduce((sum, quantity) => sum + quantity, 0);
      return count >= group.minSelections && count <= group.maxSelections;
    }));
  };
  const allSessionsComplete = quoteSessions.length === 0 || quoteSessions.every((session) => sessionDraftComplete(session, resolvedSessionDrafts[session.id] ?? emptySessionDraft()));
  const hasOptionStep = (catalog?.options.length ?? 0) > 0;
  const currentSessionIndex = currentSessionId ? quoteSessions.findIndex((session) => session.id === currentSessionId) : -1;
  const nextSession = currentSessionIndex >= 0 ? quoteSessions[currentSessionIndex + 1] : undefined;
  const nextSessionLabel = nextSession ? cateringSessionTitle(nextSession, locale) : "";
  const configurationContinueLabel = nextSession
    ? t("catering_configure_next_session").replace("{session}", nextSessionLabel)
    : hasOptionStep
      ? t("catering_continue_options")
      : t("catering_continue_details");
  const selectedOptionCount = Object.values(selectedOptions).filter((quantity) => quantity > 0).length;
  const optionsContinueLabel = selectedOptionCount > 0
    ? nextSession
      ? t("catering_options_next_session").replace("{session}", nextSessionLabel)
      : t("catering_continue_details")
    : t("catering_continue_without_options");
  const canSubmit =
    customerName.trim().length > 0 &&
    customerPhone.trim().length > 0 &&
    eventCity.trim().length > 0 &&
    (quoteSessions.length > 0 ? allSessionsComplete : hasItems && choicesComplete && serviceModesComplete && guestMinimumMet) &&
    !previewMode &&
    !submitting;

  function scrollToTop() {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function openOptionsOrCheckout(savedDrafts = sessionDrafts) {
    if (hasOptionStep) {
      const firstSession = quoteSessions[0];
      if (firstSession) {
        const firstDraft = savedDrafts[firstSession.id] ?? emptySessionDraft();
        setActiveSessionId(firstSession.id);
        setQuantities({ ...firstDraft.quantities });
        setSelectedOptions({ ...firstDraft.selectedOptions });
        setFormulaChoices(structuredClone(firstDraft.formulaChoices));
        setSelectedServiceModes({ ...firstDraft.serviceModes });
      }
      setStage("options");
    } else {
      setStage("checkout");
    }
    requestAnimationFrame(scrollToTop);
  }

  function continueFromConfiguration() {
    if (!hasItems || !choicesComplete || !serviceModesComplete || !guestMinimumMet || previewMode) return;
    if (currentSessionId) {
      const savedDrafts = { ...sessionDrafts, [currentSessionId]: currentSessionDraft() };
      setSessionDrafts(savedDrafts);
      const currentIndex = quoteSessions.findIndex((session) => session.id === currentSessionId);
      const nextSession = quoteSessions[currentIndex + 1];
      if (nextSession) {
        switchSession(nextSession.id);
        return;
      }
      if (!allSessionsComplete) return;
      setError(null);
      openOptionsOrCheckout(savedDrafts);
      return;
    }
    setError(null);
    openOptionsOrCheckout();
  }

  function continueFromOptions() {
    if (previewMode) return;
    if (currentSessionId) {
      const savedDrafts = { ...sessionDrafts, [currentSessionId]: currentSessionDraft() };
      setSessionDrafts(savedDrafts);
      const currentIndex = quoteSessions.findIndex((session) => session.id === currentSessionId);
      const nextSession = quoteSessions[currentIndex + 1];
      if (nextSession) {
        const nextDraft = savedDrafts[nextSession.id] ?? emptySessionDraft();
        setActiveSessionId(nextSession.id);
        setQuantities({ ...nextDraft.quantities });
        setSelectedOptions({ ...nextDraft.selectedOptions });
        setFormulaChoices(structuredClone(nextDraft.formulaChoices));
        setSelectedServiceModes({ ...nextDraft.serviceModes });
        requestAnimationFrame(scrollToTop);
        return;
      }
    }
    setError(null);
    setStage("checkout");
    requestAnimationFrame(scrollToTop);
  }

  function backToCatalog() {
    setError(null);
    setStage(hasOptionStep ? "options" : "configure");
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
        items: quoteSessions.length > 0 ? [] : Object.entries(quantities)
          .filter(([, qty]) => qty > 0)
          .map(([catalogItemId, quantity]) => ({ catalogItemId: Number(catalogItemId), quantity, serviceModeId: selectedServiceModes[Number(catalogItemId)] || undefined })),
        choices: quoteSessions.length > 0 ? [] : Object.entries(formulaChoices).flatMap(([catalogItemId, groups]) =>
          Object.entries(groups).flatMap(([choiceGroupId, selections]) =>
            Object.entries(selections)
              .filter(([, quantity]) => quantity > 0)
              .map(([choiceItemId, quantity]) => ({
                catalogItemId: Number(catalogItemId),
                choiceGroupId: Number(choiceGroupId),
                choiceItemId: Number(choiceItemId),
                quantity,
              })),
          ),
        ),
        optionIds: [],
        options: quoteSessions.length > 0 ? [] : Object.entries(selectedOptions).filter(([, quantity]) => quantity > 0).map(([optionId, quantity]) => ({ optionId: Number(optionId), quantity })),
        sessions: quoteSessions.map((session) => {
          const draft = resolvedSessionDrafts[session.id] ?? emptySessionDraft();
          return {
            ...session,
            items: Object.entries(draft.quantities).filter(([, quantity]) => quantity > 0).map(([catalogItemId, quantity]) => ({ catalogItemId: Number(catalogItemId), quantity, serviceModeId: draft.serviceModes[Number(catalogItemId)] || undefined })),
            choices: Object.entries(draft.formulaChoices).flatMap(([catalogItemId, groups]) => Object.entries(groups).flatMap(([choiceGroupId, selections]) => Object.entries(selections).filter(([, quantity]) => quantity > 0).map(([choiceItemId, quantity]) => ({
              catalogItemId: Number(catalogItemId), choiceGroupId: Number(choiceGroupId), choiceItemId: Number(choiceItemId), quantity,
            })))),
            optionIds: [],
            options: Object.entries(draft.selectedOptions).filter(([, quantity]) => quantity > 0).map(([optionId, quantity]) => ({ optionId: Number(optionId), quantity })),
            flowAnswers: sessionAnswers[session.id] ?? {},
          };
        }),
        flowAnswers,
      };
      const result = await createCateringQuote(payload);
      setQuoteResult(result);
      setStage("result");
      if (result.status === "auto_approved" && result.depositAmount > 0) {
        try {
          const payment = await createCateringDeposit(restaurant.id, result.publicToken);
          window.location.assign(payment.paymentUrl);
        } catch (paymentError) {
          // The quote is already safely persisted. Keep its retry button on
          // screen when the gateway is temporarily unavailable.
          setError(paymentError instanceof Error ? paymentError.message : String(paymentError));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  function backToServices() {
    const currentRoute = typeof window !== "undefined"
      ? parseCateringPath(window.location.pathname, slug)
      : null;
    const canReturnThroughHistory = typeof window !== "undefined"
      && window.history.state?.__foodyCateringView === "service";
    resetToServices();
    if (!currentRoute?.serviceSlug || typeof window === "undefined") return;
    if (canReturnThroughHistory) {
      window.history.back();
      return;
    }
    window.history.replaceState(
      { ...(window.history.state ?? {}), __foodyCateringView: "hub" },
      "",
      cateringBasePath(slug),
    );
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
                <Link
                  key={svc.id}
                  href={cateringServicePath(slug, svc.slug)}
                  data-catering-service={svc.id}
                  aria-disabled={loadingCatalog}
                  onClick={(event) => {
                    if (loadingCatalog) {
                      event.preventDefault();
                      return;
                    }
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                    event.preventDefault();
                    void handleSelectService(svc, { pushHistory: !previewMode });
                  }}
                  className={`w-full rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-4 text-start shadow-sm transition hover:border-[var(--catering-accent,var(--brand))] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--catering-accent,var(--brand))] ${loadingCatalog ? "pointer-events-none opacity-50" : ""}`}
                >
                  <h3 className="font-bold text-[var(--text)]">{serviceField(svc, "name", locale)}</h3>
                  {svc.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--text-muted)]">
                      {serviceField(svc, "description", locale)}
                    </p>
                  )}
                </Link>
              ))}
            </div>
            {loadingCatalog && <p className="mt-4 animate-pulse text-center text-sm text-[var(--text-muted)]">…</p>}
          </div>
        ))}

      {/* Guided search: one decision per screen. A safe guest/date journey is
          generated automatically when the restaurant has not configured one. */}
      {stage === "journey" && service && customerFlowConfig?.enabled && (
        <CateringFlowWizard
          serviceName={serviceField(service, "name", locale)}
          config={customerFlowConfig}
          answers={flowAnswers}
          sessionAnswers={sessionAnswers}
          sessions={sessions}
          guests={guests}
          onAnswers={setFlowAnswers}
          onSessionAnswers={setSessionAnswers}
          onSessions={setSessions}
          onGuests={setGuests}
          onExit={backToServices}
          onComplete={() => {
            setJourneyComplete(true);
            if (quoteSessions[0]?.date) setEventDate(quoteSessions[0].date);
            const firstSession = quoteSessions[0];
            const firstDraft = firstSession ? sessionDrafts[firstSession.id] ?? emptySessionDraft() : emptySessionDraft();
            setActiveSessionId(firstSession?.id ?? null);
            setQuantities({ ...firstDraft.quantities });
            setSelectedOptions({ ...firstDraft.selectedOptions });
            setFormulaChoices(structuredClone(firstDraft.formulaChoices));
            setSelectedServiceModes({ ...firstDraft.serviceModes });
            setStage("configure");
            requestAnimationFrame(scrollToTop);
          }}
          locale={locale}
          t={t}
        />
      )}

      {/* Configure stage */}
      {stage === "configure" && service && catalog && (
        <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
          <QuoteProgress
            activeStep={0}
            steps={hasOptionStep
              ? [t("catering_progress_formula"), t("catering_progress_options"), t("catering_progress_details")]
              : [t("catering_progress_formula"), t("catering_progress_details")]}
            label={t("catering_quote_progress")}
          />
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--catering-accent,var(--brand))]">
                {t("catering_search_results_eyebrow")}
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
                {matchingItems.length > 0
                  ? t("catering_search_results_title").replace("{count}", String(matchingItems.length))
                  : t("catering_search_no_results_title")}
              </h2>
              <p className="mt-1 text-sm text-[var(--text)] opacity-70">{matchingItems.length > 0
                ? t("catering_search_results_hint").replace("{guests}", String(selectionGuests))
                : t("catering_search_no_results_for_guests").replace("{guests}", String(selectionGuests))}</p>
            </div>
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
              {journeyHasSteps && (
                <button type="button" onClick={() => { if (currentSessionId) setSessionDrafts((current) => ({ ...current, [currentSessionId]: currentSessionDraft() })); setStage("journey"); }} className="min-w-0 rounded-full border border-[var(--catering-accent,var(--brand))] bg-[var(--surface)] px-3 py-2.5 text-sm font-semibold text-[var(--catering-accent,var(--brand))] transition hover:bg-[var(--surface-subtle)] sm:px-4 sm:py-2">
                  <span className="sm:hidden"><span aria-hidden>✎</span> {t("catering_flow_edit")}</span>
                  <span className="hidden sm:inline">{t("catering_flow_edit_reception")}</span>
                </button>
              )}
              <button
                type="button"
                onClick={backToServices}
                className={`min-w-0 rounded-full border border-[var(--divider)] bg-[var(--surface)] px-3 py-2.5 text-sm font-semibold text-[var(--text-muted)] transition hover:border-[var(--catering-accent,var(--brand))] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--catering-accent,var(--brand))] sm:px-4 sm:py-2 ${journeyHasSteps ? "" : "col-span-2"}`}
              >
                <span aria-hidden>←</span> {t("catering_back")}
              </button>
            </div>
          </div>

          {quoteSessions.length > 0 && (
            <section className="rounded-3xl border border-[var(--divider)] bg-[var(--surface)] p-4 shadow-sm sm:p-5">
              <div className={`grid gap-4 ${quoteSessions.length === 1 ? "lg:grid-cols-[minmax(0,1fr)_minmax(20rem,32rem)] lg:items-center" : ""}`}>
                <div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--catering-accent,var(--brand))]">{t("catering_session_configuration")}</p>
                    <p className="mt-1 text-sm text-[var(--text)] opacity-70">{t("catering_session_configuration_hint")}</p>
                  </div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {service.allowExtraSessions && quoteSessions.length < service.maxSessions && (
                    <button type="button" onClick={addSession} className="w-full rounded-full bg-[var(--catering-accent,var(--brand))] px-4 py-2.5 text-sm font-bold text-[var(--catering-button-ink,var(--ink-on-accent))] shadow-sm transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--catering-accent,var(--brand))] focus-visible:ring-offset-2 sm:w-auto sm:py-2">
                      <span aria-hidden>＋</span> {t("catering_add_session")}
                    </button>
                  )}
                  {quoteSessions.length > 1 && <button type="button" disabled={!hasItems} onClick={() => {
                    const draft = currentSessionDraft();
                    setSessionDrafts(Object.fromEntries(quoteSessions.map((session) => [session.id, { quantities: { ...draft.quantities }, selectedOptions: { ...draft.selectedOptions }, formulaChoices: structuredClone(draft.formulaChoices), serviceModes: { ...draft.serviceModes } }])));
                  }} className="rounded-full border border-[var(--catering-accent,var(--brand))] px-4 py-2 text-sm font-semibold text-[var(--catering-accent,var(--brand))] disabled:opacity-40">{t("catering_copy_selection_all_sessions")}</button>}
                  </div>
                </div>
                <div className={`grid gap-2 ${quoteSessions.length > 1 ? "sm:grid-cols-2 lg:grid-cols-3" : ""}`}>
                {quoteSessions.map((session, index) => {
                  const draft = resolvedSessionDrafts[session.id] ?? emptySessionDraft();
                  const complete = sessionDraftComplete(session, draft);
                  const active = session.id === currentSessionId;
                  const added = session.id.startsWith("added_");
                  const sessionTitle = cateringSessionTitle(session, locale);
                  const sessionDate = cateringSessionDate(session, locale);
                  return <div key={session.id} className={`overflow-hidden rounded-2xl border transition ${active ? "border-[var(--catering-accent,var(--brand))] bg-[var(--catering-accent,var(--brand))]/10 shadow-sm" : "border-[var(--divider)] bg-[var(--surface-subtle)] hover:border-[var(--catering-accent,var(--brand))]"}`}>
                    <button type="button" aria-pressed={active} onClick={() => switchSession(session.id)} className="w-full p-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--catering-accent,var(--brand))]">
                      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-[var(--text)] opacity-65">{t("catering_session_number").replace("{number}", String(index + 1))}</p><p className="mt-0.5 font-bold text-[var(--text)]">{sessionTitle}</p>{sessionTitle !== sessionDate && <p className="mt-1 text-xs text-[var(--text)] opacity-65">{sessionDate}{session.startTime ? ` · ${session.startTime}` : ""}</p>}{sessionTitle === sessionDate && session.startTime && <p className="mt-1 text-xs text-[var(--text)] opacity-65">{session.startTime}</p>}</div><span aria-hidden className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${complete ? "bg-emerald-500 text-white" : active ? "bg-[var(--catering-accent,var(--brand))]/20 text-[var(--catering-accent,var(--brand))]" : "border border-[var(--divider)] text-[var(--text)]"}`}>{complete ? "✓" : "•"}</span></div>
                      <div className="mt-2 flex items-center justify-between border-t border-[var(--divider)] pt-2 text-sm"><span className="text-[var(--text)] opacity-70">{complete ? t("catering_session_ready") : t("catering_session_to_configure")}</span><span dir="ltr" className="font-bold tabular-nums text-[var(--text)]">{CURRENCY}{fmtPrice(sessionTotals[session.id] ?? 0)}</span></div>
                    </button>
                    {added && (
                      <div className="flex items-end gap-2 border-t border-[var(--divider)] bg-[var(--surface)]/60 p-3">
                        <label className="min-w-0 flex-1">
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t("catering_session_date")}</span>
                          <CateringDateInput value={session.date} onChange={(date) => updateAddedSessionDate(session.id, date)} locale={locale} ariaLabel={t("catering_session_date")} compact />
                        </label>
                        <button type="button" onClick={() => removeAddedSession(session.id)} className="rounded-lg border border-[var(--divider)] px-3 py-2 text-sm font-semibold text-[var(--text-muted)] hover:border-red-400 hover:text-red-500" aria-label={t("catering_remove_session")}>×</button>
                      </div>
                    )}
                  </div>;
                })}
                </div>
              </div>
            </section>
          )}

          {service.pricingModel === "per_person" && !customerFlowConfig?.enabled && (
            <section className="rounded-3xl border border-[var(--divider)] bg-[var(--surface)] p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="font-bold text-[var(--text)]">{t("catering_guest_count_title")}</p>
                    <p className="mt-0.5 text-sm text-[var(--text-muted)]">{t("catering_guest_count_hint")}</p>
                    {selectedGuestMinimum > 1 && (
                      <p className="mt-1.5 text-xs font-semibold text-[var(--catering-accent,var(--brand))]">
                        {t("catering_guest_minimum_hint").replace("{n}", String(selectedGuestMinimum))}
                      </p>
                    )}
                </div>
                <div className="flex items-center self-start rounded-2xl border border-[var(--divider)] bg-[var(--surface-subtle)] p-1 sm:self-auto">
                  <button
                    type="button"
                    disabled={selectionGuests <= selectedGuestMinimum}
                    onClick={() => setSelectionGuests((count) => Math.max(selectedGuestMinimum, count - 1))}
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
                      value={selectionGuests || ""}
                      aria-label={t("catering_guests")}
                      onChange={(event) => setSelectionGuests(Math.max(selectedGuestMinimum, Math.floor(Number(event.target.value) || selectedGuestMinimum)))}
                      className="w-20 border-0 bg-transparent px-2 text-center text-xl font-bold tabular-nums text-[var(--text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--catering-accent,var(--brand))]"
                    />
                    <span className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                      {t("catering_guests_word")}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setSelectionGuests((count) => count + 1)}
                    aria-label={t("catering_increase_guests")}
                    className="grid h-10 w-10 place-items-center rounded-xl text-lg font-bold text-[var(--text)] transition hover:bg-[var(--surface)]"
                  >
                    +
                  </button>
                </div>
              </div>
            </section>
          )}

          {catalog.groups.length > 0 && matchingItems.length > 0 && (
            <nav
              aria-label={t("catering_groups")}
              className="-mx-4 overflow-x-auto border-y border-[var(--divider)] bg-[var(--catering-bg,var(--bg))] px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
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
                {catalog.groups.filter((group) => matchingItems.some((item) => item.groupId === group.id)).map((group) => (
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

          <section aria-labelledby="catering-formula-title">
            <h3 id="catering-formula-title" className="mb-3 text-lg font-bold text-[var(--text)]">
              {t("catering_choose_formula_title")}
            </h3>
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="min-w-0 space-y-7">
                <section>
                {(() => {
                  // In single-select mode, once a prestation is chosen show only it,
                  // with a way to switch — the rest are hidden to keep it a clear
                  // "pick one" flow.
                  const keys = Object.keys(quantities);
                  const selectedId = singleSelect && keys.length > 0 ? Number(keys[0]) : null;
                  const shown = selectedId != null
                    ? matchingItems.filter((i) => i.id === selectedId)
                    : activeGroupId == null
                      ? matchingItems
                      : matchingItems.filter((i) => i.groupId === activeGroupId);
                  return (
                    <div className={shown.length === 1 ? "max-w-2xl" : "grid items-stretch gap-4 sm:grid-cols-2"}>
                      {shown.length === 0 && (matchingItems.length === 0 ? (
                        <div className="space-y-6 sm:col-span-2">
                          <div className="rounded-3xl border border-dashed border-[var(--divider)] bg-[var(--surface)] px-6 py-8 text-center">
                            <h4 className="font-bold text-[var(--text)]">{t("catering_search_no_results_title")}</h4>
                            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--text-muted)]">{t("catering_search_no_results_for_guests").replace("{guests}", String(selectionGuests))}</p>
                            <button type="button" onClick={() => setStage("journey")} className="mt-5 rounded-xl border border-[var(--catering-accent,var(--brand))] px-5 py-2.5 text-sm font-bold text-[var(--catering-accent,var(--brand))]">{t("catering_search_edit")}</button>
                          </div>
                          {suggestedItems.length > 0 && (
                            <section>
                              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--catering-accent,var(--brand))]">{t("catering_search_suggestions_eyebrow")}</p>
                              <h4 className="mt-1 text-xl font-bold text-[var(--text)]">{t("catering_search_suggestions_title")}</h4>
                              <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">{t("catering_search_suggestions_hint")}</p>
                              <div className="mt-4 grid items-stretch gap-4 sm:grid-cols-2">
                                {suggestedItems.map(({ item, minimumGuests }) => (
                                  <SuggestedItemRow
                                    key={item.id}
                                    item={item}
                                    minimumGuests={minimumGuests}
                                    pricingModel={service.pricingModel}
                                    onApply={applySuggestedMinimum}
                                    detailsHref={cateringItemPath(slug, service.slug, item.slug)}
                                    onDetails={openItemDetails}
                                    t={t}
                                    locale={locale}
                                  />
                                ))}
                              </div>
                            </section>
                          )}
                        </div>
                      ) : (
                        <div className="sm:col-span-2 rounded-3xl border border-dashed border-[var(--divider)] bg-[var(--surface)] px-6 py-10 text-center">
                          <h4 className="font-bold text-[var(--text)]">{t("catering_search_no_results_title")}</h4>
                          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--text-muted)]">{t("catering_search_no_results_hint")}</p>
                        </div>
                      ))}
                      {shown.map((item) => (
                        <ItemRow
                          key={item.id}
                          item={item}
                          qty={quantities[item.id] ?? 0}
                          guests={selectionGuests}
                          rateOverride={displayedCatalogRates[item.id]}
                          pricingModel={service.pricingModel}
                          onStep={stepQty}
                          onSelect={toggleItem}
                          onConfigure={setConfiguringItem}
                          detailsHref={cateringItemPath(slug, service.slug, item.slug)}
                          onDetails={openItemDetails}
                          t={t}
                          locale={locale}
                        />
                      ))}
                      {selectedId != null && matchingItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => { setQuantities({}); setFormulaChoices({}); setSelectedOptions({}); }}
                          className="mt-3 w-full rounded-xl border border-dashed border-[var(--divider)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold text-[var(--catering-accent,var(--brand))] transition hover:border-[var(--catering-accent,var(--brand))] hover:bg-[var(--surface-subtle)]"
                        >
                          {t("catering_choose_another")}
                        </button>
                      )}
                    </div>
                  );
                })()}
              </section>

              {selectedItems.some((item) => item.serviceModes.length > 1) && (
                <section className="border-t border-[var(--divider)] pt-6">
                  <div className="mb-4">
                      <h3 className="text-lg font-bold text-[var(--text)]">{t("catering_choose_service_mode_title")}</h3>
                      <p className="mt-0.5 text-sm text-[var(--text-muted)]">{t("catering_choose_service_mode_hint")}</p>
                  </div>
                  <div className="space-y-4">
                    {selectedItems.filter((item) => item.serviceModes.length > 1).map((item) => (
                      <fieldset key={item.id} className="rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-4">
                        <legend className="px-1 text-sm font-bold text-[var(--text)]">{itemField(item, "name", locale)}</legend>
                        <div className="mt-2 grid gap-3 sm:grid-cols-2">
                          {item.serviceModes.map((mode) => {
                            const active = selectedServiceModes[item.id] === mode.id;
                            const rate = effectiveServiceModeRate(item, mode.id, selectionGuests);
                            return (
                              <button key={mode.id} type="button" aria-pressed={active} onClick={() => setSelectedServiceModes((current) => ({ ...current, [item.id]: mode.id }))} className={`min-h-28 rounded-2xl border p-4 text-start transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--catering-accent,var(--brand))] ${active ? "border-[var(--catering-accent,var(--brand))] bg-[var(--catering-accent,var(--brand))]/10 shadow-sm" : "border-[var(--divider)] bg-[var(--surface-subtle)] hover:border-[var(--catering-accent,var(--brand))]"}`}>
                                <span className="flex items-start justify-between gap-3">
                                  <span>
                                    <span className="block font-bold text-[var(--text)]">{serviceModeField(mode, "name", locale)}</span>
                                    {serviceModeField(mode, "description", locale) && <span className="mt-1 block text-sm leading-5 text-[var(--text-muted)]">{serviceModeField(mode, "description", locale)}</span>}
                                    <span className="mt-2 block text-sm font-bold text-[var(--catering-accent,var(--brand))]">{CURRENCY}{fmtPrice(rate)} {service.pricingModel === "per_person" ? t("catering_per_person") : ""}</span>
                                  </span>
                                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs ${active ? "border-[var(--catering-accent,var(--brand))] bg-[var(--catering-accent,var(--brand))] text-[var(--catering-button-ink,var(--ink-on-accent))]" : "border-[var(--divider)]"}`}>{active ? "✓" : ""}</span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </fieldset>
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
                selectedOptions={availableOptions.filter((option) => (selectedOptions[option.id] ?? 0) > 0)}
                selectedOptionQuantities={selectedOptions}
                selectedServiceModes={selectedServiceModes}
                guests={selectionGuests}
                estimatedTotal={activeEstimatedTotal}
                choicesComplete={choicesComplete}
                serviceModesComplete={serviceModesComplete}
                guestMinimumMet={guestMinimumMet}
                minimumGuests={selectedGuestMinimum}
                previewMode={previewMode}
                onContinue={continueFromConfiguration}
                continueLabel={configurationContinueLabel}
                locale={locale}
                t={t}
              />
            </div>
          </section>

          {hasItems && <div
            className="sticky z-30 -mx-4 border-t border-[var(--divider)] bg-[var(--catering-bg,var(--bg))]/95 px-4 py-3 shadow-[0_-10px_30px_rgba(0,0,0,0.12)] backdrop-blur sm:-mx-6 sm:px-6 lg:hidden"
            style={{ bottom: shoppingSide.bottom_bar ? "var(--bottomnav-h)" : 0 }}
          >
            <div className="mx-auto flex max-w-3xl flex-col items-stretch gap-2 rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-2.5 shadow-lg sm:flex-row sm:items-center sm:gap-3 sm:ps-4">
              <div className="flex min-w-0 flex-1 items-end justify-between gap-3 px-1 sm:block sm:px-0">
                <p className="truncate text-xs text-[var(--text-muted)]">
                  {selectedItemCount === 1
                    ? t("catering_selected_one")
                    : t("catering_selected_many").replace("{n}", String(selectedItemCount))}
                </p>
                <p dir="ltr" className="text-lg font-bold tabular-nums text-[var(--text)]">{`${CURRENCY}${fmtPrice(estimatedTotal)}`}</p>
              </div>
              <button
                type="button"
                disabled={!hasItems || !choicesComplete || !serviceModesComplete || !guestMinimumMet || previewMode}
                onClick={continueFromConfiguration}
                className="w-full rounded-xl bg-[var(--catering-accent,var(--brand))] px-5 py-3 text-sm font-bold text-[var(--catering-button-ink,var(--ink-on-accent))] transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--catering-accent,var(--brand))] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto sm:shrink-0"
              >
                {configurationContinueLabel} <span aria-hidden>→</span>
              </button>
            </div>
          </div>}
        </div>
      )}

      {/* Options stage: optional extras are a deliberate decision instead of
          content hidden below the formula cards. */}
      {stage === "options" && service && catalog && hasOptionStep && (
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <QuoteProgress
            activeStep={1}
            steps={[t("catering_progress_formula"), t("catering_progress_options"), t("catering_progress_details")]}
            label={t("catering_quote_progress")}
          />

          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--catering-accent,var(--brand))]">
                {t("catering_step_options")}
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
                {t("catering_options_title")}
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">
                {t("catering_options_hint")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setError(null); setStage("configure"); requestAnimationFrame(scrollToTop); }}
              className="shrink-0 rounded-full border border-[var(--divider)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text-muted)] transition hover:border-[var(--catering-accent,var(--brand))] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--catering-accent,var(--brand))]"
            >
              <span aria-hidden>←</span> {t("catering_back")}
            </button>
          </div>

          {quoteSessions.length > 0 && (
            <section aria-label={t("catering_options_by_session")}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {t("catering_options_by_session")}
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {quoteSessions.map((session, index) => {
                  const active = session.id === currentSessionId;
                  const optionCount = Object.values((resolvedSessionDrafts[session.id] ?? emptySessionDraft()).selectedOptions)
                    .filter((quantity) => quantity > 0).length;
                  return (
                    <button
                      key={session.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => switchSession(session.id)}
                      className={`min-w-[11rem] rounded-2xl border px-4 py-3 text-start transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--catering-accent,var(--brand))] ${active ? "border-[var(--catering-accent,var(--brand))] bg-[var(--catering-accent,var(--brand))]/10 shadow-sm" : "border-[var(--divider)] bg-[var(--surface)] hover:border-[var(--catering-accent,var(--brand))]"}`}
                    >
                      <span className="block text-xs font-semibold text-[var(--text-muted)]">
                        {t("catering_session_number").replace("{number}", String(index + 1))}
                      </span>
                      <span className="mt-0.5 block font-bold text-[var(--text)]">{cateringSessionTitle(session, locale)}</span>
                      <span className="mt-1 block text-xs text-[var(--text-muted)]">
                        {optionCount > 0
                          ? t("catering_options_selected_count").replace("{count}", String(optionCount))
                          : t("catering_no_options_selected")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <section className="overflow-hidden rounded-3xl border border-[var(--divider)] bg-[var(--surface)] shadow-sm">
              <div className="border-b border-[var(--divider)] bg-[var(--surface-subtle)] px-5 py-4 sm:px-6">
                <p className="font-bold text-[var(--text)]">
                  {currentSessionId && activeSession ? cateringSessionTitle(activeSession, locale) : t("catering_options")}
                </p>
                <p className="mt-0.5 text-sm text-[var(--text-muted)]">{t("catering_options_optional_hint")}</p>
              </div>
              {availableOptions.length > 0 ? (
                <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6">
                  {availableOptions.map((option) => (
                    <OptionRow
                      key={option.id}
                      option={option}
                      quantity={selectedOptions[option.id] ?? 0}
                      onToggle={toggleOption}
                      onQuantity={setOptionQuantity}
                      locale={locale}
                      t={t}
                    />
                  ))}
                </div>
              ) : (
                <p className="p-6 text-sm text-[var(--text-muted)]">{t("catering_no_options_for_session")}</p>
              )}
            </section>

            <SelectionSummary
              service={service}
              selectedItems={selectedItems}
              quantities={quantities}
              selectedOptions={availableOptions.filter((option) => (selectedOptions[option.id] ?? 0) > 0)}
              selectedOptionQuantities={selectedOptions}
              selectedServiceModes={selectedServiceModes}
              guests={selectionGuests}
              estimatedTotal={activeEstimatedTotal}
              choicesComplete={choicesComplete}
              serviceModesComplete={serviceModesComplete}
              guestMinimumMet={guestMinimumMet}
              minimumGuests={selectedGuestMinimum}
              previewMode={previewMode}
              onContinue={continueFromOptions}
              continueLabel={optionsContinueLabel}
              showOptionsStatus
              locale={locale}
              t={t}
            />
          </div>
        </div>
      )}

      {/* Checkout stage */}
      {stage === "checkout" && service && catalog && (
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <QuoteProgress
            activeStep={hasOptionStep ? 2 : 1}
            steps={hasOptionStep
              ? [t("catering_progress_formula"), t("catering_progress_options"), t("catering_progress_details")]
              : [t("catering_progress_formula"), t("catering_progress_details")]}
            label={t("catering_quote_progress")}
          />

          <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <form
              onSubmit={(event) => { event.preventDefault(); handleSubmit(); }}
              className="order-last space-y-5 rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-5 shadow-sm sm:p-7 lg:order-none"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--catering-accent,var(--brand))]">
                  {t(hasOptionStep ? "catering_step_details_with_options" : "catering_step_details")}
                </p>
                <h2 className="mt-1 text-2xl font-bold text-[var(--text)]">{t("catering_event_details_title")}</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">{t("catering_event_details_hint")}</p>
              </div>

              <fieldset className="space-y-4">
                <legend className="mb-3 font-bold text-[var(--text)]">{t("catering_event_section")}</legend>
                {(journeyCollectsGuests || journeyCollectsSchedule) && (
                  <div className="rounded-xl border border-[var(--divider)] bg-[var(--surface-subtle)] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-[var(--text)]">{quoteSessions.length > 0 ? t("catering_flow_session_count").replace("{count}", String(quoteSessions.length)) : `${guests} ${t("catering_guests_word")}`}</p>
                        {quoteSessions.length > 0 && <p className="mt-1 text-sm text-[var(--text-muted)]">{quoteSessions.map((session) => `${cateringSessionSummary(session, locale)} · ${session.guests || guests} ${t("catering_guests_word")}`).join(" · ")}</p>}
                      </div>
                      {journeyHasSteps && <button type="button" onClick={() => setStage("journey")} className="shrink-0 text-sm font-semibold text-[var(--catering-accent,var(--brand))] hover:underline">{t("catering_flow_edit")}</button>}
                    </div>
                  </div>
                )}
                {(!journeyCollectsGuests || !journeyCollectsSchedule) && <div className="grid gap-4 sm:grid-cols-2">
                  {!journeyCollectsGuests && <div className="min-w-0">
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
                  </div>}
                  {!journeyCollectsSchedule && <div className="min-w-0">
                    <label htmlFor="catering-event-date" className="mb-1.5 block text-sm font-medium text-[var(--text-muted)]">{t("catering_event_date")}</label>
                    <CateringDateInput id="catering-event-date" value={eventDate} onChange={setEventDate} locale={locale} ariaLabel={t("catering_event_date")} />
                  </div>}
                </div>}
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
              {quoteSessions.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {quoteSessions.map((session) => {
                    const draft = resolvedSessionDrafts[session.id] ?? emptySessionDraft();
                    const sessionItems = catalog.items.filter((item) => (draft.quantities[item.id] ?? 0) > 0);
                    const sessionTitle = cateringSessionTitle(session, locale);
                    const sessionDate = cateringSessionDate(session, locale);
                    return <section key={session.id} className="rounded-2xl border border-[var(--divider)] bg-[var(--surface-subtle)] p-4">
                      <div className="flex items-start justify-between gap-3"><div><p className="font-bold text-[var(--text)]">{sessionTitle}</p><p className="mt-0.5 text-xs text-[var(--text-muted)]">{session.guests || guests} {t("catering_guests_word")}{sessionTitle !== sessionDate ? ` · ${sessionDate}` : ""}{session.startTime ? ` · ${session.startTime}` : ""}</p></div><span className="font-bold tabular-nums text-[var(--text)]">{CURRENCY}{fmtPrice(sessionTotals[session.id] ?? 0)}</span></div>
                      <ul className="mt-3 space-y-1.5 border-t border-[var(--divider)] pt-3 text-sm">
                        {visibleSessionFlowSteps(service.flowConfig ?? { version: 2, enabled: false, steps: [] }, flowAnswers, sessionAnswers[session.id] ?? {}).flatMap((step) => { const value = describeFlowAnswer(step, sessionAnswers[session.id] ?? {}); return value ? [<li key={`flow-${step.id}`} className="text-[var(--text-muted)]"><span className="font-semibold text-[var(--text)]">{step.title}:</span> {value}</li>] : []; })}
                        {sessionItems.map((item) => {
                          const mode = item.serviceModes.find((candidate) => candidate.id === draft.serviceModes[item.id]) ?? (item.serviceModes.length === 1 ? item.serviceModes[0] : undefined);
                          return <li key={item.id} className="flex justify-between gap-3"><span><span className="block text-[var(--text)]">{itemField(item, "name", locale)}</span>{mode && <span className="block text-xs text-[var(--text-muted)]">{serviceModeField(mode, "name", locale)}</span>}</span>{service.pricingModel !== "per_person" && <span className="text-[var(--text-muted)]">× {draft.quantities[item.id]}</span>}</li>;
                        })}
                        {catalog.options.filter((option) => (option.catalogItemId === null || (draft.quantities[option.catalogItemId] ?? 0) > 0) && (draft.selectedOptions[option.id] ?? 0) > 0).map((option) => <li key={`option-${option.id}`} className="text-[var(--text-muted)]">+ {(draft.selectedOptions[option.id] ?? 1) > 1 ? `${draft.selectedOptions[option.id]} × ` : ''}{optionField(option, "name", locale)}</li>)}
                      </ul>
                    </section>;
                  })}
                </div>
              ) : (
              <ul className="mt-4 divide-y divide-[var(--divider)]">
                {selectedItems.map((item) => {
                  const inclusionGroups = structuredInclusionGroups(item, locale);
                  const mode = item.serviceModes.find((candidate) => candidate.id === selectedServiceModes[item.id]) ?? (item.serviceModes.length === 1 ? item.serviceModes[0] : undefined);
                  return (
                  <li key={item.id} className="py-3 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="font-medium text-[var(--text)]">{itemField(item, "name", locale)}</span>
                      <span className="shrink-0 tabular-nums text-[var(--text-muted)]">× {quantities[item.id]}</span>
                    </div>
                    {mode && <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">{serviceModeField(mode, "name", locale)}</p>}
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
                        const quantity = selected[option.id] ?? 0;
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
                {availableOptions.filter((option) => (selectedOptions[option.id] ?? 0) > 0).map((option) => (
                  <li key={`option-${option.id}`} className="flex justify-between gap-4 py-3 text-sm">
                    <span className="text-[var(--text-muted)]">+ {(selectedOptions[option.id] ?? 1) > 1 ? `${selectedOptions[option.id]} × ` : ''}{optionField(option, "name", locale)}</span>
                  </li>
                ))}
              </ul>
              )}
              <div className="mt-3 flex items-end justify-between border-t border-[var(--divider)] pt-4">
                <span className="text-sm text-[var(--text-muted)]">{t("catering_estimated_total")}</span>
                <span className="text-2xl font-bold tabular-nums text-[var(--text)]">{`${CURRENCY}${fmtPrice(estimatedTotal)}`}</span>
              </div>
              {guests > 0 && <div className="mt-1.5 flex items-center justify-between gap-3 text-sm"><span className="text-[var(--text-muted)]">{t("catering_total_per_guest")}</span><span className="font-semibold tabular-nums text-[var(--text)]">{`${CURRENCY}${fmtPrice(estimatedTotal / guests)}`}</span></div>}
              {quoteSessions.length > 1 && quoteSessions.some((session) => (session.guests || guests) > 0) && <div className="mt-1.5 flex items-center justify-between gap-3 text-xs"><span className="text-[var(--text-muted)]">{t("catering_average_per_guest_session")}</span><span className="font-medium tabular-nums text-[var(--text-muted)]">{`${CURRENCY}${fmtPrice(estimatedTotal / quoteSessions.reduce((sum, session) => sum + (session.guests || guests), 0))}`}</span></div>}
              <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">{t("catering_total_updates_hint")}</p>
            </aside>
          </div>
        </div>
      )}

      {/* Result stage */}
      {stage === "result" && quoteResult && (
        <div className="px-4 py-10 text-center">
          <div className="mx-auto max-w-2xl rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-5 shadow-sm sm:p-7">
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
          guests={selectionGuests}
          onClose={() => setConfiguringItem(null)}
          onComplete={(choices) => configureFormula(configuringItem, choices)}
          t={t}
        />
      )}

      {detailsItem && service && (
        <ItemDetailsSheet
          item={detailsItem}
          qty={quantities[detailsItem.id] ?? 0}
          guests={offerMatchesCateringSearch(detailsItem, selectionGuests, searchDate, customerFlowConfig) ? selectionGuests : Math.max(selectionGuests, cateringOfferMinimumGuests(detailsItem, customerFlowConfig, searchDate))}
          minimumGuests={cateringOfferMinimumGuests(detailsItem, customerFlowConfig, searchDate)}
          rateOverride={offerMatchesCateringSearch(detailsItem, selectionGuests, searchDate, customerFlowConfig) ? displayedCatalogRates[detailsItem.id] : undefined}
          pricingModel={service.pricingModel}
          eligible={offerMatchesCateringSearch(detailsItem, selectionGuests, searchDate, customerFlowConfig)}
          onClose={closeItemDetails}
          onSelect={handleDetailsSelect}
          onConfigure={handleDetailsConfigure}
          onUseMinimum={() => { closeItemDetails(); applySuggestedMinimum(detailsItem); }}
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
        selected[option.id] = quantity;
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

  const setQuantity = (choiceItemId: number, quantity: number) => {
    setChoices((previous) => {
      const currentGroup = { ...(previous[group.id] ?? {}) };
      if (quantity <= 0) delete currentGroup[choiceItemId];
      else currentGroup[choiceItemId] = quantity;
      return { ...previous, [group.id]: currentGroup };
    });
  };

  const toggle = (option: CateringChoiceItemPublic) => {
    const current = selected[option.id] ?? 0;
    if (current > 0) {
      setQuantity(option.id, 0);
      return;
    }
    if (selectedCount < group.maxSelections) setQuantity(option.id, 1);
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
              const quantity = selected[option.id] ?? 0;
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
                        <button type="button" disabled={quantity === 0} onClick={() => setQuantity(option.id, quantity - 1)} className="grid h-8 w-8 place-items-center rounded-full border border-[var(--divider)] disabled:opacity-30">−</button>
                        <span className="min-w-6 text-center font-bold tabular-nums">{quantity}</span>
                        <button type="button" disabled={selectedCount >= group.maxSelections} onClick={() => setQuantity(option.id, quantity + 1)} className="grid h-8 w-8 place-items-center rounded-full bg-[var(--catering-accent,var(--brand))] font-bold text-[var(--catering-button-ink,var(--ink-on-accent))] disabled:opacity-30">+</button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          {selectedCount >= group.maxSelections && group.items.some((option) => !(selected[option.id] > 0)) && (
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

function SuggestedItemRow({
  item,
  minimumGuests,
  pricingModel,
  onApply,
  detailsHref,
  onDetails,
  t,
  locale,
}: {
  item: CateringCatalogItemPublic;
  minimumGuests: number;
  pricingModel: string;
  onApply: (item: CateringCatalogItemPublic) => void;
  detailsHref: string;
  onDetails: (item: CateringCatalogItemPublic) => void;
  t: (key: string) => string;
  locale: Locale;
}) {
  const minimum = Math.max(1, minimumGuests || 1);
  const rate = effectiveServiceModeRate(item, undefined, minimum);
  const showPrice = pricingModel !== "custom_quote" && rate > 0;
  const name = itemField(item, "name", locale);
  const overview = itemField(item, "overview", locale).trim();

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-[var(--divider)] bg-[var(--surface)] shadow-sm">
      <Link
        href={detailsHref}
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          onDetails(item);
        }}
        className="block flex-1 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--catering-accent,var(--brand))]"
      >
        {item.imageUrl ? (
          <div className="relative aspect-[16/7] overflow-hidden bg-[var(--surface-subtle)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.imageUrl} alt={name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02] motion-reduce:transform-none" />
          </div>
        ) : <div className="h-1.5 bg-[var(--catering-accent,var(--brand))]" aria-hidden />}
        <div className="p-4 sm:p-5">
          <span className="inline-flex rounded-full bg-[var(--catering-accent,var(--brand))]/10 px-3 py-1 text-xs font-bold text-[var(--catering-accent,var(--brand))]">
            {t("catering_from_guests").replace("{n}", String(minimum))}
          </span>
          <h5 className="mt-3 text-xl font-bold tracking-tight text-[var(--text)]">{name}</h5>
          {overview && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--text-muted)]">{overview}</p>}
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[var(--catering-accent,var(--brand))]">{t("catering_view_details")} <span aria-hidden>→</span></span>
        </div>
      </Link>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-[var(--divider)] bg-[var(--surface-subtle)] p-4 sm:px-5">
        <p className="font-bold tabular-nums text-[var(--text)]">
          {showPrice ? <>{CURRENCY}{fmtPrice(rate)} {pricingModel === "per_person" && <span className="text-sm font-normal text-[var(--text-muted)]">{t("catering_per_person")}</span>}</> : t("catering_price_on_request")}
        </p>
        <button type="button" onClick={() => onApply(item)} className="rounded-full bg-[var(--catering-accent,var(--brand))] px-4 py-2 text-sm font-bold text-[var(--catering-button-ink,var(--ink-on-accent))] transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--catering-accent,var(--brand))] focus-visible:ring-offset-2">
          {t("catering_search_apply_suggestion").replace("{n}", String(minimum))}
        </button>
      </div>
    </article>
  );
}

function ItemRow({
  item,
  qty,
  guests,
  rateOverride,
  pricingModel,
  onStep,
  onSelect,
  onConfigure,
  detailsHref,
  onDetails,
  t,
  locale,
}: {
  item: CateringCatalogItemPublic;
  qty: number;
  guests: number;
  rateOverride?: number;
  pricingModel: string;
  onStep: (item: CateringCatalogItemPublic, direction: 1 | -1) => void;
  onSelect: (item: CateringCatalogItemPublic) => void;
  onConfigure: (item: CateringCatalogItemPublic) => void;
  detailsHref: string;
  onDetails: (item: CateringCatalogItemPublic) => void;
  t: (key: string) => string;
  locale: Locale;
}) {
  const isPerPerson = pricingModel === "per_person";
  const rate = rateOverride ?? effectiveServiceModeRate(item, undefined, guests);
  const name = itemField(item, "name", locale);
  const overview = itemField(item, "overview", locale).trim();
  const isConfigurable = (item.choiceGroups?.length ?? 0) > 0;
  const structuredPreview = structuredInclusionGroups(item, locale).flatMap((group) => group.items);
  const inclusionPreview = (structuredPreview.length > 0
    ? structuredPreview
    : parseInclusions(itemField(item, "description", locale))).slice(0, 3);
  const displayOverview = isRawUppercaseCopy(overview) && inclusionPreview.length > 0 ? "" : overview;

  const selectFromCard = () => {
    if (isConfigurable) onConfigure(item);
    else if (isPerPerson) onSelect(item);
    else onStep(item, 1);
  };
  const selectFromCardLabel = isConfigurable
    ? t("catering_choose_and_customize")
    : isPerPerson
      ? t("catering_choose")
      : t("catering_add");

  const stepper = isConfigurable ? (
      <button
        type="button"
        aria-haspopup="dialog"
        aria-pressed={qty > 0}
        onClick={() => onConfigure(item)}
        className={`shrink-0 rounded-full px-5 py-2 text-sm font-bold transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--catering-accent,var(--brand))] focus-visible:ring-offset-2 ${
          qty > 0
            ? "border border-[var(--catering-accent,var(--brand))] bg-[var(--surface)] text-[var(--catering-accent,var(--brand))]"
            : "bg-[var(--catering-accent,var(--brand))] text-[var(--catering-button-ink,var(--ink-on-accent))] shadow-sm"
        }`}
      >
        {qty > 0 ? `✓ ${t("catering_modify_formula")}` : t("catering_choose_and_customize")}
      </button>
    ) : isPerPerson ? (
      // per_person: pick the formula (no counter — guests are the multiplier).
      <button
        type="button"
        aria-pressed={qty > 0}
        onClick={() => onSelect(item)}
        className={`shrink-0 rounded-full px-5 py-2 text-sm font-bold transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--catering-accent,var(--brand))] focus-visible:ring-offset-2 ${
          qty > 0
            ? "border border-[var(--catering-accent,var(--brand))] bg-[var(--surface)] text-[var(--catering-accent,var(--brand))]"
            : "bg-[var(--catering-accent,var(--brand))] text-[var(--catering-button-ink,var(--ink-on-accent))] shadow-sm"
        }`}
      >
        {qty > 0 ? `✓ ${t("catering_selected")}` : t("catering_choose")}
      </button>
    ) : qty === 0 ? (
      <button
        type="button"
        onClick={() => onStep(item, 1)}
        className="shrink-0 rounded-full bg-[var(--catering-accent,var(--brand))] px-5 py-2 text-sm font-bold text-[var(--catering-button-ink,var(--ink-on-accent))] shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--catering-accent,var(--brand))] focus-visible:ring-offset-2"
      >
        {t("catering_add")}
      </button>
    ) : (
      <div className="flex shrink-0 items-center gap-2 rounded-full border border-[var(--divider)] bg-[var(--surface-subtle)] p-1">
        <button
          type="button"
          aria-label={t("catering_quantity")}
          onClick={() => onStep(item, -1)}
          className="h-8 w-8 rounded-full bg-[var(--surface)] font-bold text-[var(--text)] transition hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--catering-accent,var(--brand))]"
        >
          −
        </button>
        <span className="min-w-[1.5rem] text-center font-semibold tabular-nums">{qty}</span>
        <button
          type="button"
          aria-label={t("catering_quantity")}
          onClick={() => onStep(item, 1)}
          className="h-8 w-8 rounded-full bg-[var(--surface)] font-bold text-[var(--text)] transition hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--catering-accent,var(--brand))]"
        >
          +
        </button>
      </div>
    );

  return (
    <article
      className={`group relative h-full overflow-hidden rounded-3xl border bg-[var(--surface)] shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg motion-reduce:transform-none ${
        qty > 0 ? "border-[var(--catering-accent,var(--brand))] bg-[var(--catering-accent,var(--brand))]/[0.04] ring-1 ring-[var(--catering-accent,var(--brand))]" : "border-[var(--divider)]"
      }`}
    >
      {qty === 0 && (
        <button
          type="button"
          onClick={selectFromCard}
          aria-label={`${selectFromCardLabel} — ${name}`}
          className="absolute inset-0 z-0 rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--catering-accent,var(--brand))]"
        >
          <span className="sr-only">{selectFromCardLabel}</span>
        </button>
      )}
      <div className="pointer-events-none relative z-[1] flex h-full flex-col">
        <div className="flex-1">
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
            {displayOverview && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--text)] opacity-75">{displayOverview}</p>}
            {inclusionPreview.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text)] opacity-65">
                  {t("catering_included_in_formula")}
                </p>
                <ul className="mt-1.5 grid gap-1 text-xs text-[var(--text)] opacity-75">
                  {inclusionPreview.map((included, index) => (
                    <li key={`${included}-${index}`} className="flex min-w-0 items-start gap-1.5">
                      <span aria-hidden className="text-[var(--catering-accent,var(--brand))]">•</span>
                      <span className="line-clamp-1">{included}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Link
              href={detailsHref}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                onDetails(item);
              }}
              aria-label={`${t("catering_view_details")} — ${name}`}
              className="pointer-events-auto mt-4 inline-flex items-center gap-1 text-sm font-bold text-[var(--catering-accent,var(--brand))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--catering-accent,var(--brand))]"
            >
              {t("catering_view_details")} <span aria-hidden>→</span>
            </Link>
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 border-t border-[var(--divider)] bg-[var(--surface-subtle)] p-4 sm:px-5">
          <div>
            <div className="flex items-baseline gap-1">
              <span dir="ltr" className="text-2xl font-bold tabular-nums text-[var(--text)]">{item.serviceModes.length > 1 && rateOverride === undefined ? `${t("catering_from")} ` : ""}{`${CURRENCY}${fmtPrice(rate)}`}</span>
              {isPerPerson && <span className="text-sm text-[var(--text)] opacity-70">{t("catering_per_person")}</span>}
            </div>
            {isPerPerson && item.minGuests > 1 && (
              <p className="mt-0.5 text-xs text-[var(--text)] opacity-70">{t("catering_min_guests").replace("{n}", String(item.minGuests))}</p>
            )}
            {!isPerPerson && item.minQuantity > 1 && (
              <p className="mt-0.5 text-xs text-[var(--text)] opacity-70">{t("catering_min_qty").replace("{n}", String(item.minQuantity))}</p>
            )}
          </div>
          <div className="pointer-events-auto">{stepper}</div>
        </div>
      </div>
    </article>
  );
}

function QuoteProgress({ activeStep, steps, label }: { activeStep: number; steps: string[]; label: string }) {
  return (
    <nav
      aria-label={label}
      className="sticky z-40 -mx-4 border-y border-[var(--divider)] bg-[var(--catering-bg,var(--bg))]/95 px-4 py-2 shadow-sm backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
      style={{ top: "var(--nav-sticky-h, 0px)" }}
    >
      <ol className="mx-auto flex max-w-2xl items-start">
        {steps.map((step, index) => {
          const complete = index < activeStep;
          const active = index === activeStep;
          return (
            <li key={step} className="flex min-w-0 flex-1 items-start last:flex-none">
              <div className="flex w-20 shrink-0 flex-col items-center text-center sm:w-28">
                <span
                  aria-current={active ? "step" : undefined}
                  className={`grid h-9 w-9 place-items-center rounded-full border text-sm font-bold transition-colors ${complete ? "border-emerald-500 bg-emerald-500 text-white" : active ? "border-[var(--catering-accent,var(--brand))] bg-[var(--catering-accent,var(--brand))] text-[var(--catering-button-ink,var(--ink-on-accent))] shadow-sm" : "border-[var(--divider)] bg-[var(--surface)] text-[var(--text)]"}`}
                >
                  {complete ? <span aria-label={step}>✓</span> : index + 1}
                </span>
                <span className={`mt-2 text-[11px] font-semibold leading-tight sm:text-xs ${active ? "text-[var(--text)]" : "text-[var(--text)] opacity-65"}`}>
                  {step}
                </span>
              </div>
              {index < steps.length - 1 && (
                <span
                  aria-hidden
                  className={`mt-4 h-0.5 min-w-4 flex-1 ${index < activeStep ? "bg-emerald-500" : "bg-[var(--divider)]"}`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function SelectionSummary({
  className,
  service,
  selectedItems,
  quantities,
  selectedOptions,
  selectedOptionQuantities,
  selectedServiceModes,
  guests,
  estimatedTotal,
  choicesComplete,
  serviceModesComplete,
  guestMinimumMet,
  minimumGuests,
  previewMode,
  onContinue,
  continueLabel,
  showOptionsStatus = false,
  locale,
  t,
}: {
  className?: string;
  service: CateringServicePublic;
  selectedItems: CateringCatalogItemPublic[];
  quantities: Record<number, number>;
  selectedOptions: CateringOptionPublic[];
  selectedOptionQuantities: OptionQuantities;
  selectedServiceModes: Record<number, string>;
  guests: number;
  estimatedTotal: number;
  choicesComplete: boolean;
  serviceModesComplete: boolean;
  guestMinimumMet: boolean;
  minimumGuests: number;
  previewMode: boolean;
  onContinue: () => void;
  continueLabel?: string;
  showOptionsStatus?: boolean;
  locale: Locale;
  t: (key: string) => string;
}) {
  const hasItems = selectedItems.length > 0;
  const canContinue = hasItems && choicesComplete && serviceModesComplete && guestMinimumMet && !previewMode;
  const buttonLabel = !hasItems
    ? t("catering_choose_formula_prompt")
    : !serviceModesComplete
      ? t("catering_choose_service_mode_to_continue")
    : !choicesComplete
      ? t("catering_complete_formula")
      : !guestMinimumMet
        ? t("catering_minimum_required").replace("{n}", String(minimumGuests))
        : continueLabel ?? t("catering_continue_details");

  return (
    <aside
      className={`${className ?? ""} sticky rounded-3xl border border-[var(--divider)] bg-[var(--surface)] p-5 shadow-lg`}
      style={{ top: "calc(var(--nav-sticky-h, 0px) + 5.25rem)" }}
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
              {selectedItems.map((item) => {
                const mode = item.serviceModes.find((candidate) => candidate.id === selectedServiceModes[item.id]) ?? (item.serviceModes.length === 1 ? item.serviceModes[0] : undefined);
                return (
                <li key={item.id} className="flex items-start justify-between gap-3 text-sm">
                  <span><span className="block font-bold leading-snug text-[var(--text)]">{itemField(item, "name", locale)}</span>{mode && <span className="mt-0.5 block text-xs text-[var(--text-muted)]">{serviceModeField(mode, "name", locale)}</span>}</span>
                  {service.pricingModel !== "per_person" && (
                    <span className="shrink-0 tabular-nums text-[var(--text-muted)]">× {quantities[item.id]}</span>
                  )}
                </li>
                );
              })}
            </ul>
          </div>

          {(selectedOptions.length > 0 || showOptionsStatus) && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t("catering_options")}</p>
              {selectedOptions.length > 0 ? (
                <ul className="mt-2 space-y-1.5 text-sm text-[var(--text-muted)]">
                  {selectedOptions.map((option) => (
                    <li key={option.id} className="flex gap-2"><span aria-hidden>+</span><span>{(selectedOptionQuantities[option.id] ?? 1) > 1 ? `${selectedOptionQuantities[option.id]} × ` : ''}{optionField(option, "name", locale)}</span></li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-[var(--text-muted)]">{t("catering_no_options_selected")}</p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-[var(--divider)] bg-[var(--surface-subtle)] p-4">
          <p className="text-sm leading-relaxed text-[var(--text)] opacity-75">{t("catering_summary_empty")}</p>
        </div>
      )}

      {hasItems && <div className="mt-5 border-t border-[var(--divider)] pt-4">
        <div className="flex items-end justify-between gap-3">
          <span className="text-sm text-[var(--text-muted)]">{t("catering_estimated_total")}</span>
          <span dir="ltr" className="text-3xl font-bold tracking-tight tabular-nums text-[var(--text)]">{`${CURRENCY}${fmtPrice(estimatedTotal)}`}</span>
        </div>
        {guests > 0 && <div className="mt-1.5 flex items-center justify-between gap-3 text-sm"><span className="text-[var(--text)] opacity-70">{t("catering_total_per_guest")}</span><span dir="ltr" className="font-semibold tabular-nums text-[var(--text)]">{`${CURRENCY}${fmtPrice(estimatedTotal / guests)}`}</span></div>}
        <p className="mt-2 text-xs leading-relaxed text-[var(--text)] opacity-70">{t("catering_total_updates_hint")}</p>
        <button
          type="button"
          disabled={!canContinue}
          onClick={onContinue}
          className={`mt-4 w-full rounded-xl px-4 py-3.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--catering-accent,var(--brand))] focus-visible:ring-offset-2 ${canContinue ? "bg-[var(--catering-accent,var(--brand))] text-[var(--catering-button-ink,var(--ink-on-accent))] shadow-sm hover:opacity-90" : "cursor-not-allowed border border-[var(--divider)] bg-[var(--surface-subtle)] text-[var(--text)] opacity-70"}`}
        >
          {buttonLabel} {canContinue && <span aria-hidden>→</span>}
        </button>
      </div>}
    </aside>
  );
}

function ItemDetailsSheet({
  item,
  qty,
  guests,
  minimumGuests,
  rateOverride,
  pricingModel,
  eligible,
  onClose,
  onSelect,
  onConfigure,
  onUseMinimum,
  locale,
  t,
}: {
  item: CateringCatalogItemPublic;
  qty: number;
  guests: number;
  minimumGuests: number;
  rateOverride?: number;
  pricingModel: string;
  eligible: boolean;
  onClose: () => void;
  onSelect: (item: CateringCatalogItemPublic) => void;
  onConfigure: (item: CateringCatalogItemPublic) => void;
  onUseMinimum: () => void;
  locale: Locale;
  t: (key: string) => string;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef(true);
  const isPerPerson = pricingModel === "per_person";
  const isConfigurable = item.choiceGroups.length > 0;
  const rate = rateOverride ?? effectiveServiceModeRate(item, undefined, guests);
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
    if (!eligible) {
      onUseMinimum();
      return;
    }
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
          {!eligible && <p className="mb-3 rounded-xl bg-[var(--catering-accent,var(--brand))]/10 px-3 py-2 text-sm font-semibold text-[var(--catering-accent,var(--brand))]">{t("catering_search_suggestion_unavailable").replace("{n}", String(minimumGuests))}</p>}
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
            {!eligible
              ? t("catering_search_apply_suggestion").replace("{n}", String(minimumGuests))
              : isConfigurable
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
  quantity,
  onToggle,
  onQuantity,
  locale,
  t,
}: {
  option: CateringOptionPublic;
  quantity: number;
  onToggle: (id: number) => void;
  onQuantity: (id: number, quantity: number) => void;
  locale: Locale;
  t: (key: string) => string;
}) {
  const desc = optionField(option, "description", locale);
  const checked = quantity > 0;
  return (
    <div className={`flex items-start gap-3 rounded-2xl border bg-[var(--surface)] p-4 transition ${checked ? "border-[var(--catering-accent,var(--brand))] ring-1 ring-[var(--catering-accent,var(--brand))]" : "border-[var(--divider)] hover:border-[var(--catering-accent,var(--brand))]"}`}>
      {option.priceMode === "per_unit" ? (
        <div className="flex shrink-0 items-center overflow-hidden rounded-xl border border-[var(--divider)] bg-[var(--surface-subtle)]" aria-label={optionField(option, "name", locale)}>
          <button type="button" onClick={() => onQuantity(option.id, Math.max(0, quantity - 1))} className="grid h-9 w-9 place-items-center font-bold text-[var(--text)]" aria-label="−">−</button>
          <span className="min-w-8 text-center text-sm font-bold tabular-nums text-[var(--text)]">{quantity}</span>
          <button type="button" onClick={() => onQuantity(option.id, quantity + 1)} className="grid h-9 w-9 place-items-center font-bold text-[var(--text)]" aria-label="+">+</button>
        </div>
      ) : (
        <input type="checkbox" checked={checked} onChange={() => onToggle(option.id)} className="mt-1 h-4 w-4 accent-[var(--catering-accent,var(--brand))]" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-[var(--text)]">{optionField(option, "name", locale)}</span>
        {desc && <span className="block text-xs text-[var(--text-muted)]">{desc}</span>}
      </span>
      <span className="whitespace-nowrap text-sm font-bold text-[var(--text)]">
        {`${CURRENCY}${fmtPrice(option.price)}`}{option.priceMode === "per_person" ? ` ${t("catering_per_person")}` : option.priceMode === "per_unit" ? ` ${t("catering_per_unit")}` : ""}
      </span>
    </div>
  );
}
