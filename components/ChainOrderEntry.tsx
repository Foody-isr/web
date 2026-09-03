"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowRightIcon,
  ClockIcon,
  GlobeAltIcon,
  MapPinIcon,
  MagnifyingGlassIcon,
  ShoppingBagIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";
import { useI18n } from "@/lib/i18n";
import {
  ChainOrderBranch,
  ChainOrderEntry,
  fetchChainOrderEntry,
  resolveChainOrderBranches,
  ResolvedChainOrderBranch,
  trackChainOrderEntryEvent,
} from "@/services/api";
import { useCartStore } from "@/store/useCartStore";
import { buildChainBranchOrderHref } from "@/lib/chainRouting";
import { chainOrderEntryBranchSource } from "@/lib/chainOrderEntryBranches";
import { resolveChainOrderEntryAppearance } from "@/lib/chainOrderEntryAppearance";
import {
  WEBSITE_V3_APPLIED,
  WEBSITE_V3_READY,
  acceptWebsiteV3StateMessage,
  resolveWebsiteV3AdminOrigin,
} from "@/lib/preview/websiteV3Protocol";

type Copy = {
  brandName?: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  pickup: string;
  delivery: string;
  search: string;
  nearMe: string;
  locating: string;
  locationDenied: string;
  recommended: string;
  branches: string;
  branchCountOne: string;
  branchCountMany: string;
  open: string;
  closed: string;
  paused: string;
  opens: string;
  orderHere: string;
  unavailable: string;
  noMatch: string;
  clearSearch: string;
  empty: string;
  cartTitle: string;
  cartBody: string;
  stay: string;
  clearAndChange: string;
  checkAddress: string;
  enterAddress: string;
  resolving: string;
  addressUnresolved: string;
  outsideZone: string;
};

const COPY: Record<"en" | "fr" | "he", Copy> = {
  en: {
    eyebrow: "Choose your bakery",
    title: "Where would you like to order?",
    subtitle: "Each branch prepares and receives its own orders.",
    pickup: "Pickup",
    delivery: "Delivery",
    search: "Search by city or address",
    nearMe: "Near me",
    locating: "Locating…",
    locationDenied:
      "Location is unavailable. Search by city or address instead.",
    recommended: "Recommended",
    branches: "All branches",
    branchCountOne: "branch",
    branchCountMany: "branches",
    open: "Open now",
    closed: "Closed",
    paused: "Orders paused",
    opens: "Opens",
    orderHere: "Order here",
    unavailable: "Unavailable for this service",
    noMatch: "No branch matches this search.",
    clearSearch: "Clear search",
    empty: "No branch is currently available for online ordering.",
    cartTitle: "Your cart belongs to another branch",
    cartBody: "Changing branch will empty the items already in your cart.",
    stay: "Stay here",
    clearAndChange: "Empty cart and change",
    checkAddress: "Check address",
    enterAddress: "Enter your full delivery address to see available branches.",
    resolving: "Checking address…",
    addressUnresolved:
      "We could not locate this address. Check it and try again.",
    outsideZone: "No branch currently delivers to this address.",
  },
  fr: {
    eyebrow: "Choisissez votre boulangerie",
    title: "Où souhaitez-vous commander ?",
    subtitle: "Chaque succursale prépare et reçoit ses propres commandes.",
    pickup: "À emporter",
    delivery: "Livraison",
    search: "Rechercher une ville ou une adresse",
    nearMe: "Autour de moi",
    locating: "Localisation…",
    locationDenied:
      "La localisation est indisponible. Recherchez plutôt une ville ou une adresse.",
    recommended: "Recommandée",
    branches: "Toutes les succursales",
    branchCountOne: "succursale",
    branchCountMany: "succursales",
    open: "Ouvert maintenant",
    closed: "Fermé",
    paused: "Commandes en pause",
    opens: "Ouvre",
    orderHere: "Commander ici",
    unavailable: "Indisponible pour ce service",
    noMatch: "Aucune succursale ne correspond à cette recherche.",
    clearSearch: "Effacer la recherche",
    empty: "Aucune succursale n’est disponible pour commander en ligne.",
    cartTitle: "Votre panier appartient à une autre succursale",
    cartBody:
      "Changer de succursale videra les articles déjà ajoutés au panier.",
    stay: "Rester ici",
    clearAndChange: "Vider et changer",
    checkAddress: "Vérifier l’adresse",
    enterAddress:
      "Saisissez votre adresse complète pour voir les succursales disponibles.",
    resolving: "Vérification de l’adresse…",
    addressUnresolved:
      "Nous n’avons pas pu localiser cette adresse. Vérifiez-la puis réessayez.",
    outsideZone: "Aucune succursale ne livre actuellement à cette adresse.",
  },
  he: {
    eyebrow: "בחרו את הסניף שלכם",
    title: "מאיזה סניף תרצו להזמין?",
    subtitle: "כל סניף מכין ומקבל את ההזמנות שלו.",
    pickup: "איסוף עצמי",
    delivery: "משלוח",
    search: "חיפוש לפי עיר או כתובת",
    nearMe: "קרוב אליי",
    locating: "מאתר…",
    locationDenied: "המיקום אינו זמין. אפשר לחפש לפי עיר או כתובת.",
    recommended: "מומלץ",
    branches: "כל הסניפים",
    branchCountOne: "סניף",
    branchCountMany: "סניפים",
    open: "פתוח עכשיו",
    closed: "סגור",
    paused: "ההזמנות מושהות",
    opens: "נפתח",
    orderHere: "הזמנה מהסניף",
    unavailable: "לא זמין לשירות זה",
    noMatch: "לא נמצא סניף מתאים לחיפוש.",
    clearSearch: "ניקוי החיפוש",
    empty: "אין כרגע סניף זמין להזמנה אונליין.",
    cartTitle: "העגלה שלכם שייכת לסניף אחר",
    cartBody: "מעבר לסניף אחר ירוקן את הפריטים שכבר נוספו לעגלה.",
    stay: "להישאר כאן",
    clearAndChange: "לרוקן ולעבור",
    checkAddress: "בדיקת כתובת",
    enterAddress: "הזינו כתובת משלוח מלאה כדי לראות סניפים זמינים.",
    resolving: "בודק את הכתובת…",
    addressUnresolved: "לא הצלחנו לאתר את הכתובת. בדקו אותה ונסו שוב.",
    outsideZone: "אין כרגע סניף שמבצע משלוח לכתובת הזו.",
  },
};

export function ChainOrderEntryView({
  initialEntry,
  initialOrderType,
  initialAppearance,
  previewRestaurantId,
}: {
  initialEntry: ChainOrderEntry;
  initialOrderType: "pickup" | "delivery";
  initialAppearance?: Record<string, unknown>;
  previewRestaurantId?: number;
}) {
  const router = useRouter();
  const { locale, setLocale } = useI18n();
  const [pageAppearance, setPageAppearance] = useState<Record<string, unknown>>(
    initialAppearance ?? {},
  );
  const [previewAcknowledgement, setPreviewAcknowledgement] = useState<{
    origin: string;
    revision: number;
    contentRevision: number;
    activePageKey: string;
    device: "desktop" | "mobile";
  } | null>(null);
  const selectorAppearance = resolveChainOrderEntryAppearance(pageAppearance);
  const copy = { ...COPY[locale], ...selectorAppearance.translations[locale] };
  const [entry, setEntry] = useState(initialEntry);
  const [orderType, setOrderType] = useState(initialOrderType);
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [locationError, setLocationError] = useState(false);
  const [locating, setLocating] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolvedBranches, setResolvedBranches] = useState<
    ResolvedChainOrderBranch[] | null
  >(null);
  const [resolutionReason, setResolutionReason] = useState<
    "address_unresolved" | "outside_zone" | null
  >(null);
  const [pendingBranch, setPendingBranch] = useState<ChainOrderBranch | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();
  const cartLines = useCartStore((state) => state.lines);
  const cartRestaurantId = useCartStore((state) => state.restaurantId);
  const clearCart = useCartStore((state) => state.clear);

  useEffect(() => {
    if (!previewRestaurantId || window.parent === window) return;
    const originPolicy = {
      configuredAdminOrigin: process.env.NEXT_PUBLIC_ADMIN_ORIGIN,
      currentOrigin: window.location.origin,
    };
    let lastRevision = -1;
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      const accepted = acceptWebsiteV3StateMessage({
        data: event.data,
        origin: event.origin,
        expectedRestaurantId: previewRestaurantId,
        lastAppliedRevision: lastRevision,
        originPolicy,
      });
      if (!accepted || accepted.page.type !== "order") return;
      lastRevision = accepted.message.revision;
      setPageAppearance(accepted.page.appearance_overrides ?? {});
      setPreviewAcknowledgement({
        origin: event.origin,
        revision: accepted.message.revision,
        contentRevision: accepted.message.contentRevision,
        activePageKey: accepted.message.activePageKey,
        device: accepted.message.device,
      });
    };
    window.addEventListener("message", handleMessage);
    const readyOrigin = resolveWebsiteV3AdminOrigin(originPolicy);
    if (readyOrigin)
      window.parent.postMessage({ type: WEBSITE_V3_READY }, readyOrigin);
    return () => window.removeEventListener("message", handleMessage);
  }, [previewRestaurantId]);

  useEffect(() => {
    if (!previewAcknowledgement) return;
    window.parent.postMessage(
      {
        type: WEBSITE_V3_APPLIED,
        revision: previewAcknowledgement.revision,
        contentRevision: previewAcknowledgement.contentRevision,
        activePageKey: previewAcknowledgement.activePageKey,
        device: previewAcknowledgement.device,
      },
      previewAcknowledgement.origin,
    );
  }, [previewAcknowledgement]);

  useEffect(() => {
    void trackChainOrderEntryEvent(entry.chain.slug, {
      event: "view",
      orderType,
      locale,
    }).catch(() => undefined);
  }, [entry.chain.slug, locale, orderType]);

  const branches = useMemo(() => {
    const needle =
      orderType === "pickup" ? search.trim().toLocaleLowerCase(locale) : "";
    const source = chainOrderEntryBranchSource(
      entry.branches,
      orderType,
      resolvedBranches,
    );
    return source
      .filter((branch) => {
        if (!needle) return true;
        return `${branch.name} ${branch.address ?? ""}`
          .toLocaleLowerCase(locale)
          .includes(needle);
      })
      .map((branch) => {
        const resolvedDistance = (branch as ResolvedChainOrderBranch)
          .distanceKm;
        const distance =
          typeof resolvedDistance === "number"
            ? resolvedDistance
            : location && branch.latitude != null && branch.longitude != null
              ? distanceKm(
                  location.lat,
                  location.lng,
                  branch.latitude,
                  branch.longitude,
                )
              : null;
        return { ...branch, distance };
      })
      .sort((a, b) => {
        if (a.distance == null && b.distance == null) return 0;
        if (a.distance == null) return 1;
        if (b.distance == null) return -1;
        return a.distance - b.distance;
      });
  }, [entry.branches, location, locale, orderType, resolvedBranches, search]);

  function selectOrderType(next: "pickup" | "delivery") {
    if (next === orderType) return;
    setOrderType(next);
    setResolvedBranches(null);
    setResolutionReason(null);
    setLocation(null);
    startTransition(async () => {
      try {
        const nextEntry = await fetchChainOrderEntry(entry.chain.slug, next);
        setEntry(nextEntry);
      } catch {
        // Keep the last usable list; individual service flags still prevent an
        // invalid navigation when the refresh is temporarily unavailable.
      }
    });
  }

  function useLocation() {
    setLocationError(false);
    if (!navigator.geolocation) {
      setLocationError(true);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        setLocation({ lat: coords.latitude, lng: coords.longitude });
        setLocating(false);
        if (orderType === "delivery") {
          await resolveDelivery({
            latitude: coords.latitude,
            longitude: coords.longitude,
          });
        }
      },
      () => {
        setLocationError(true);
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }

  async function resolveDelivery(point: {
    address?: string;
    latitude?: number;
    longitude?: number;
  }) {
    setResolving(true);
    setResolutionReason(null);
    try {
      const result = await resolveChainOrderBranches(entry.chain.slug, {
        orderType: "delivery",
        ...point,
      });
      setResolvedBranches(result.branches);
      setResolutionReason(result.reason ?? null);
    } catch {
      setResolvedBranches([]);
      setResolutionReason("address_unresolved");
    } finally {
      setResolving(false);
    }
  }

  function submitAddress(event: React.FormEvent) {
    event.preventDefault();
    const address = search.trim();
    if (orderType !== "delivery" || !address) return;
    void resolveDelivery({ address });
  }

  function branchSupports(branch: ChainOrderBranch) {
    return orderType === "delivery"
      ? branch.deliveryEnabled
      : branch.pickupEnabled;
  }

  function goToBranch(branch: ChainOrderBranch) {
    if (previewRestaurantId) return;
    if (orderType === "delivery" && resolvedBranches === null) return;
    if (!branchSupports(branch) || !branch.isOpen) return;
    if (
      cartLines.length > 0 &&
      cartRestaurantId &&
      cartRestaurantId !== String(branch.restaurantId)
    ) {
      setPendingBranch(branch);
      return;
    }
    navigate(branch);
  }

  function navigate(branch: ChainOrderBranch) {
    void trackChainOrderEntryEvent(entry.chain.slug, {
      event: "branch_selected",
      orderType,
      locale,
      restaurantId: branch.restaurantId,
    }).catch(() => undefined);
    router.push(
      buildChainBranchOrderHref({
        slug: branch.slug,
        restaurantId: branch.restaurantId,
        primaryRestaurantId: entry.chain.primaryRestaurantId,
        orderType,
        locale,
      }),
    );
  }

  const pageBackground = stringValue(pageAppearance.bg) ?? "#09090a";
  const pageInk = stringValue(pageAppearance.ink) ?? "#f6f2e9";
  const pageAccent = stringValue(pageAppearance.accent) ?? "#b88a32";
  const headingFont = stringValue(pageAppearance.headingFont) ?? "Eros";
  const bodyFont = stringValue(pageAppearance.bodyFont) ?? "Nunito Sans";
  const coverUrl =
    stringValue(pageAppearance.cover_url) ?? entry.chain.coverUrl;
  const headerLogoUrl = selectorAppearance.logoUrl ?? entry.chain.logoUrl;
  const headerName = copy.brandName?.trim() || entry.chain.name;
  const heroStyle = coverUrl
    ? {
        backgroundImage: `linear-gradient(90deg, color-mix(in srgb, ${pageBackground} ${Math.min(100, selectorAppearance.overlayOpacity + 16)}%, transparent) 0%, color-mix(in srgb, ${pageBackground} ${selectorAppearance.overlayOpacity}%, transparent) 48%, color-mix(in srgb, ${pageBackground} ${Math.max(20, selectorAppearance.overlayOpacity - 36)}%, transparent) 100%), url("${coverUrl.replace(/"/g, "%22")}")`,
      }
    : undefined;

  return (
    <main
      className="min-h-screen bg-[var(--chain-bg)] font-sans text-[var(--chain-ink)]"
      data-theme="dark"
      data-field-page-appearance-overrides-chain-order-entry-layout={
        selectorAppearance.layout
      }
      data-field-page-appearance-overrides-chain-order-entry-logo-url={
        selectorAppearance.logoUrl ?? ""
      }
      data-field-page-appearance-overrides-chain-order-entry-surface-color={
        selectorAppearance.surfaceColor
      }
      data-field-page-appearance-overrides-chain-order-entry-overlay-opacity={
        selectorAppearance.overlayOpacity
      }
      data-field-page-appearance-overrides-chain-order-entry-show-search={
        selectorAppearance.showSearch
      }
      data-field-page-appearance-overrides-chain-order-entry-show-near-me={
        selectorAppearance.showNearMe
      }
      data-field-page-appearance-overrides-chain-order-entry-show-branch-count={
        selectorAppearance.showBranchCount
      }
      data-field-page-appearance-overrides-chain-order-entry-show-branch-numbers={
        selectorAppearance.showBranchNumbers
      }
      style={
        {
          ["--font-body" as string]: `'${bodyFont}'`,
          ["--font-display" as string]: `'${headingFont}'`,
          ["--chain-bg" as string]: pageBackground,
          ["--chain-ink" as string]: pageInk,
          ["--chain-accent" as string]: pageAccent,
          ["--chain-surface" as string]: selectorAppearance.surfaceColor,
          ["--chain-muted" as string]: `color-mix(in srgb, ${pageInk} 58%, transparent)`,
          ["--chain-soft" as string]: `color-mix(in srgb, ${pageInk} 10%, transparent)`,
          ["--chain-line" as string]: `color-mix(in srgb, ${pageInk} 14%, transparent)`,
        } as React.CSSProperties
      }
    >
      <header
        className="relative min-h-[270px] overflow-hidden border-b border-[var(--chain-line)] bg-[var(--chain-surface)] bg-cover bg-center px-5 py-5 md:min-h-[330px] md:px-10"
        style={heroStyle}
      >
        <div className="relative z-10 mx-auto flex max-w-6xl items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {headerLogoUrl ? (
              <Image
                src={headerLogoUrl}
                alt=""
                width={56}
                height={56}
                unoptimized
                className="h-12 w-12 rounded-xl border border-white/15 bg-white object-contain p-1.5 md:h-14 md:w-14"
              />
            ) : (
              <div className="grid h-12 w-12 place-items-center rounded-xl border border-[var(--chain-accent)] bg-[var(--chain-soft)] text-lg font-black text-[var(--chain-accent)] md:h-14 md:w-14">
                {headerName.charAt(0)}
              </div>
            )}
            <span className="max-w-[190px] truncate text-lg font-extrabold tracking-tight md:max-w-none md:text-xl">
              {headerName}
            </span>
          </div>
          <label className="flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3 py-2 text-sm backdrop-blur">
            <GlobeAltIcon className="h-4 w-4" />
            <span className="sr-only">Language</span>
            <select
              value={locale}
              onChange={(event) =>
                setLocale(event.target.value as "en" | "fr" | "he")
              }
              className="bg-transparent font-semibold outline-none"
            >
              <option className="bg-[#18181a]" value="fr">
                FR
              </option>
              <option className="bg-[#18181a]" value="he">
                HE
              </option>
              <option className="bg-[#18181a]" value="en">
                EN
              </option>
            </select>
          </label>
        </div>

        <div className="relative z-10 mx-auto mt-12 max-w-6xl md:mt-16">
          <p className="mb-3 text-xs font-bold uppercase tracking-[.22em] text-[var(--chain-accent)]">
            {copy.eyebrow}
          </p>
          <h1 className="max-w-3xl font-display text-4xl leading-[.98] tracking-[-.025em] md:text-6xl">
            {copy.title}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-[var(--chain-muted)] md:text-base">
            {copy.subtitle}
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-16 md:px-10">
        <div className="relative z-20 -mt-7 rounded-2xl border border-[var(--chain-line)] bg-[var(--chain-surface)] p-3 shadow-2xl shadow-black/40 md:-mt-9 md:p-4">
          <form
            onSubmit={submitAddress}
            className="grid gap-3 md:grid-cols-[auto_1fr_auto] md:items-center"
          >
            <div className="grid grid-cols-2 rounded-xl bg-[var(--chain-soft)] p-1">
              <ModeButton
                active={orderType === "pickup"}
                onClick={() => selectOrderType("pickup")}
              >
                <ShoppingBagIcon className="h-4 w-4" /> {copy.pickup}
              </ModeButton>
              <ModeButton
                active={orderType === "delivery"}
                onClick={() => selectOrderType("delivery")}
              >
                <TruckIcon className="h-4 w-4" /> {copy.delivery}
              </ModeButton>
            </div>
            {(selectorAppearance.showSearch || orderType === "delivery") && (
              <label className="relative block">
                <MagnifyingGlassIcon className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/45" />
                <span className="sr-only">{copy.search}</span>
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    if (orderType === "delivery") {
                      setResolvedBranches(null);
                      setResolutionReason(null);
                    }
                  }}
                  placeholder={copy.search}
                  className="h-12 w-full rounded-xl border border-[var(--chain-line)] bg-[var(--chain-soft)] ps-12 pe-4 text-sm text-[var(--chain-ink)] outline-none transition placeholder:text-[var(--chain-muted)] focus:border-[var(--chain-accent)] focus:ring-2 focus:ring-[var(--chain-accent)]/25"
                />
              </label>
            )}
            <div className="grid grid-cols-2 gap-2 md:flex">
              {orderType === "delivery" && (
                <button
                  type="submit"
                  disabled={resolving || !search.trim()}
                  className="inline-flex h-12 items-center justify-center rounded-xl bg-[var(--chain-accent)] px-4 text-sm font-black text-[var(--chain-bg)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {resolving ? copy.resolving : copy.checkAddress}
                </button>
              )}
              {selectorAppearance.showNearMe && (
                <button
                  type="button"
                  onClick={useLocation}
                  disabled={locating || resolving}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[var(--chain-accent)] px-4 text-sm font-bold text-[var(--chain-accent)] transition hover:bg-[var(--chain-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--chain-accent)] disabled:opacity-60"
                >
                  <MapPinIcon className="h-5 w-5" />
                  {locating ? copy.locating : copy.nearMe}
                </button>
              )}
            </div>
          </form>
          {locationError && (
            <p className="px-1 pt-3 text-sm text-[#df8e87]">
              {copy.locationDenied}
            </p>
          )}
          {orderType === "delivery" &&
            resolvedBranches === null &&
            !resolutionReason && (
              <p className="px-1 pt-3 text-sm text-[var(--chain-muted)]">
                {copy.enterAddress}
              </p>
            )}
          {resolutionReason && (
            <p className="px-1 pt-3 text-sm text-[#df8e87]">
              {resolutionReason === "outside_zone"
                ? copy.outsideZone
                : copy.addressUnresolved}
            </p>
          )}
        </div>

        <div className="mt-10 flex items-end justify-between gap-4 border-b border-[var(--chain-line)] pb-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[var(--chain-accent)]">
              {location && branches[0]?.distance != null
                ? copy.recommended
                : copy.branches}
            </p>
            {selectorAppearance.showBranchCount && (
              <p className="mt-1 text-sm text-[var(--chain-muted)]">
                {branches.length}{" "}
                {branches.length === 1
                  ? copy.branchCountOne
                  : copy.branchCountMany}
              </p>
            )}
          </div>
          {isPending && <span className="text-xs text-white/45">…</span>}
        </div>

        {entry.branches.length === 0 ? (
          <EmptyState text={copy.empty} />
        ) : branches.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-white/65">{copy.noMatch}</p>
            <button
              onClick={() => setSearch("")}
              className="mt-4 text-sm font-bold text-[var(--chain-accent)] underline underline-offset-4"
            >
              {copy.clearSearch}
            </button>
          </div>
        ) : (
          <div
            className={
              selectorAppearance.layout === "cards"
                ? "grid gap-4 py-6 md:grid-cols-2"
                : "divide-y divide-[var(--chain-line)]"
            }
          >
            {branches.map((branch, index) => {
              const supported = branchSupports(branch);
              const awaitingDeliveryAddress =
                orderType === "delivery" && resolvedBranches === null;
              const available = supported && branch.isOpen;
              const selectable = available && !awaitingDeliveryAddress;
              return (
                <article
                  key={branch.restaurantId}
                  className={
                    selectorAppearance.layout === "cards"
                      ? "group flex min-h-[250px] flex-col gap-5 rounded-2xl border border-[var(--chain-line)] bg-[var(--chain-surface)] p-5"
                      : "group grid gap-5 py-6 md:grid-cols-[minmax(0,1.4fr)_minmax(220px,.8fr)_auto] md:items-center md:py-7"
                  }
                >
                  <div className="flex min-w-0 items-start gap-4">
                    {selectorAppearance.showBranchNumbers && (
                      <div className="mt-1 grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[var(--chain-accent)] bg-[var(--chain-soft)] font-mono text-xs font-bold text-[var(--chain-accent)]">
                        {String(index + 1).padStart(2, "0")}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h2 className="truncate text-xl font-black tracking-[-.025em] md:text-2xl">
                        {branch.name}
                      </h2>
                      {branch.address && (
                        <p className="mt-1 flex items-start gap-1.5 text-sm leading-5 text-[var(--chain-muted)]">
                          <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0" />{" "}
                          {branch.address}
                        </p>
                      )}
                      {branch.shortDescription && (
                        <p className="mt-2 text-sm text-[var(--chain-muted)]">
                          {branch.shortDescription}
                        </p>
                      )}
                    </div>
                  </div>

                  <div
                    className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-sm ${selectorAppearance.layout === "list" ? "md:block md:space-y-2" : "mt-auto"}`}
                  >
                    <p
                      className={`flex items-center gap-2 font-semibold ${available ? "text-[#77c69f]" : "text-[#df8e87]"}`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${available ? "bg-[#4ca679]" : "bg-[#b96862]"}`}
                      />
                      {branch.ordersPaused
                        ? copy.paused
                        : !supported
                          ? copy.unavailable
                          : branch.isOpen
                            ? copy.open
                            : copy.closed}
                    </p>
                    <p className="flex items-center gap-2 text-[var(--chain-muted)]">
                      <ClockIcon className="h-4 w-4" />
                      {formatOpening(branch, locale, copy)}
                    </p>
                    {branch.distance != null && (
                      <p className="font-mono text-xs text-[var(--chain-muted)]">
                        {branch.distance.toFixed(1)} km
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => goToBranch(branch)}
                    disabled={!selectable}
                    className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--chain-accent)] px-5 text-sm font-black text-[var(--chain-bg)] transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[var(--chain-accent)] focus:ring-offset-2 focus:ring-offset-[var(--chain-bg)] disabled:cursor-not-allowed disabled:bg-[var(--chain-soft)] disabled:text-[var(--chain-muted)] ${selectorAppearance.layout === "list" ? "md:w-auto" : "mt-auto"}`}
                  >
                    {awaitingDeliveryAddress && supported
                      ? copy.checkAddress
                      : selectable
                        ? copy.orderHere
                        : copy.unavailable}
                    {selectable && (
                      <ArrowRightIcon className="h-4 w-4 rtl:rotate-180" />
                    )}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {pendingBranch && (
        <div
          className="fixed inset-0 z-50 grid place-items-end bg-black/70 p-3 backdrop-blur-sm md:place-items-center"
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-branch-title"
            className="w-full max-w-md rounded-2xl border border-white/12 bg-[#202023] p-6 shadow-2xl"
          >
            <h2 id="cart-branch-title" className="text-xl font-black">
              {copy.cartTitle}
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/60">
              {copy.cartBody}
            </p>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <button
                onClick={() => setPendingBranch(null)}
                className="h-11 rounded-xl border border-white/15 font-bold hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/40"
              >
                {copy.stay}
              </button>
              <button
                onClick={() => {
                  const branch = pendingBranch;
                  clearCart();
                  setPendingBranch(null);
                  navigate(branch);
                }}
                className="h-11 rounded-xl bg-[var(--chain-accent)] font-black text-[var(--chain-bg)] hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[var(--chain-accent)]"
              >
                {copy.clearAndChange}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-[var(--chain-accent)] ${
        active
          ? "bg-[var(--chain-accent)] text-[var(--chain-bg)] shadow-lg"
          : "text-[var(--chain-muted)] hover:text-[var(--chain-ink)]"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-white/10 bg-white/5">
        <ShoppingBagIcon className="h-6 w-6 text-white/40" />
      </div>
      <p className="mt-5 leading-6 text-white/60">{text}</p>
    </div>
  );
}

function formatOpening(
  branch: ChainOrderBranch,
  locale: string,
  copy: Copy,
): string {
  if (branch.ordersPaused) return copy.paused;
  if (branch.isOpen) return branch.openingHours || copy.open;
  if (branch.nextOpening) {
    const date = new Date(branch.nextOpening);
    return `${copy.opens} ${new Intl.DateTimeFormat(locale, {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: branch.timezone,
    }).format(date)}`;
  }
  return branch.openingHours || copy.closed;
}

function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = radians(lat2 - lat1);
  const dLng = radians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
