"use client";

import { CategoryBanner } from "@/components/themed/CategoryBanner/CategoryBanner";
import { GroupTabs } from "@/components/CategoryTabs";
import { CartDrawer } from "@/components/CartDrawer";
import { BottomNav } from "@/components/BottomNav";
import { AIOrderAssistant, AIProactivePrompt } from "@/components/AIOrderAssistant";
import { ComboDetailsModal } from "@/components/ComboDetailsModal";
import { ComboProgressBar } from "@/components/ComboProgressBar";
import { AnimatePresence, motion } from "framer-motion";
import { GuestJoinModal } from "@/components/GuestJoinModal";
import { ItemModal } from "@/components/ItemModal";
import { MenuItemCard } from "@/components/MenuItemCard";
import { RestaurantHero } from "@/components/RestaurantHero";
import { ModeChip, formatBatchStatusInline } from "@/components/ModeChip";
import { InfoScreen } from "@/components/InfoScreen";
import { SessionBar } from "@/components/SessionBar";
import { SessionToast } from "@/components/SessionToast";
import { TableDrawer } from "@/components/TableDrawer";
import { PaymentModeSheet } from "@/components/PaymentModeSheet";
import { DineInOrderReadyPopup } from "@/components/DineInOrderReadyPopup";
import { SiteNavbar, useNavLayoutSide } from "@/components/SiteNavbar";
import { OrderToolbar } from "@/components/OrderToolbar";
import { NavigationDrawer } from "@/components/NavigationDrawer";
import { SiteFooter } from "@/components/SiteFooter";
import { SectionRenderer } from "@/components/sections/SectionRenderer";
import { AvailabilityBanner } from "@/components/AvailabilityBanner";
import { OrderDetailsModal, SchedulingIntent } from "@/components/OrderDetailsModal";
import { formatDateLabel } from "@/lib/scheduling";
import { useI18n } from "@/lib/i18n";
import { useMenuLanguage } from "@/lib/menu-language";
import { MenuTranslateBanner } from "@/components/MenuTranslateBanner";
import { tField } from "@/lib/translations";
import { useRestaurantTheme } from "@/lib/restaurant-theme";
import { useResolvedTheme } from "@/lib/themes/useResolvedTheme";
import { useIsMobileViewport, useViewMode } from "@/lib/themes/useViewMode";
import { currencySymbol } from "@/lib/constants";
import { checkAvailability } from "@/lib/availability";
import { mapAdminSection, postEditorReady, usePreviewMode } from "@/lib/preview-mode";
import { MenuItem, MenuResponse, OrderType, Restaurant, ComboMenu, ComboCartSelection, WebsiteSection } from "@/lib/types";
import {
  clampComboQuantity,
  firstChoiceStepIdx,
  initialBatchSelections,
  splitComboBatch,
  batchStepSizePicks,
  normSizeLabel,
} from "@/lib/combo/batch";
import { effectivePerItemCap } from "@/lib/combo/shape";
import { useCartStore } from "@/store/useCartStore";
import { useTableSession } from "@/store/useTableSession";
import { createOrder, initSessionPayment, fetchBatchFulfillmentConfig, GuestOrder } from "@/services/api";
import { BatchFulfillmentConfigResponse, OrderPayload } from "@/lib/types";
import { SessionPaymentMode } from "@/services/api";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Props = {
  menu: MenuResponse;
  restaurant: Restaurant;
  initialOrderType: OrderType;
  tableId?: string;
  sessionId?: string;
  /** When set (YYYY-MM-DD), the operator is previewing the carte for a future
   *  date. View-only: a banner is shown and checkout/order placement is blocked
   *  so a preview can never turn into a real order. */
  previewDate?: string;
};

export function OrderExperience({ menu, restaurant, initialOrderType, tableId, sessionId, previewDate }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, direction, locale } = useI18n();
  // Menu CONTENT resolves against the menu language (original by default,
  // guest-translatable via the Wolt-style banner); UI chrome keeps `locale`.
  const { menuLocale, configure: configureMenuLanguage } = useMenuLanguage();
  useEffect(() => {
    configureMenuLanguage(restaurant.id, restaurant.defaultLocale);
  }, [configureMenuLanguage, restaurant.id, restaurant.defaultLocale]);
  const setContext = useCartStore((s) => s.setContext);
  const addItem = useCartStore((s) => s.addItem);
  const addCombo = useCartStore((s) => s.addCombo);
  const lines = useCartStore((s) => s.lines);
  const total = useCartStore((s) => s.total);

  const restaurantId = String(restaurant.id);
  const isDatePreview = !!previewDate;

  /**
   * A guest seated at a table (QR scan). A tour is a DELIVERY round: a one-off
   * trip to another city, on its own day, at its own fee. It means nothing to
   * someone sitting in the dining room, and the dine-in path is not equipped to
   * carry it — `placeOrderDirect` sends the cart straight to the kitchen with no
   * tour, no day and no zone, and the server accepts it because the items exist
   * in the global catalogue. So the table sees NO tour at all: no tab, no
   * banner, no deep link. Nothing to select means nothing to leak.
   */
  const isTableOrder = initialOrderType === "dine_in" || !!tableId || !!sessionId;

  /**
   * The entries the guest may browse. Everything the page shows or selects reads
   * from this list, never from `menu.menus` directly — that is the one place the
   * table's exclusion of tours is enforced.
   */
  const entries = useMemo(
    () => (isTableOrder ? (menu.menus ?? []).filter((m) => !m.tour) : menu.menus ?? []),
    [menu.menus, isTableOrder]
  );

  // Multi-menu support: track which ENTRY (carte) is active. Keyed on entryKey
  // rather than menu id so the mechanism stays stable across carte shapes; the
  // dedicated tour page hands a single entry, so its tab bar never appears.
  const [activeEntryKey, setActiveEntryKey] = useState<string | null>(
    entries.length > 0 ? entries[0].entryKey : null
  );

  // `?? entries[0]`: activeEntryKey can go stale (a carte drops out on a
  // re-render), so always resolve to a real entry. activeEntry is null only when
  // there is nothing to browse at all.
  const activeEntry = useMemo(
    () => entries.find((m) => m.entryKey === activeEntryKey) ?? entries[0] ?? null,
    [entries, activeEntryKey]
  );
  const activeTour = activeEntry?.tour;

  // Keep the selected key in step with the entry actually on screen, so the tab
  // highlight follows the fallback above instead of pointing at a dead tour.
  useEffect(() => {
    if (activeEntry && activeEntry.entryKey !== activeEntryKey) {
      setActiveEntryKey(activeEntry.entryKey);
    }
  }, [activeEntry, activeEntryKey]);
  // The real carte id behind the active entry, for the consumers that address
  // the menu itself (the AI assistant). Never a substitute for `activeEntryKey`.
  const activeMenuId = activeEntry?.id ?? null;

  // A tour carte reaches this component ONLY through its dedicated page
  // (/r/<rid>/tournee/<slug>), which hands a one-carte menu whose single entry
  // carries the tour. The normal site never carries a tour, so `activeTour` is
  // set only on that dedicated page — everything below keys off it.
  const cartTourId = useCartStore((s) => s.tourId);

  // On arrival at a tour carte, bind the cart to the tour so the page reads as a
  // tour cart from the first paint: delivery forced, the tour's own window in
  // force (a round is often open outside the restaurant's hours), its fee and
  // minimum quoted. Non-destructive: gated on `canAdd`, so a cart already
  // holding another tour or ordinary lines is left untouched for the add-time
  // mixing guard to resolve. Never runs on the normal site (no `activeTour`).
  useEffect(() => {
    if (!activeTour) return;
    const cart = useCartStore.getState();
    if (cart.canAdd(activeTour.id)) cart.setTour(activeTour.id, activeTour.slug);
  }, [activeTour]);

  // The mirror of the bind above. That bind fires on mere ARRIVAL at a tour link
  // — before the guest adds anything — and it is persisted to localStorage. So a
  // guest who opened a round and left with an empty cart still carries its id.
  // That stale binding must not follow them off the tour page: at a table it
  // trips the "tour cart here" refusal, at checkout it forces delivery, and on
  // the normal site it froze the order type (mode chip read-only, no pickup —
  // the "stuck on Livraison" bug). An empty cart has no lines to protect, so
  // drop the binding once we are off the tour page (no `activeTour`) with an
  // empty cart. Never runs on the tour page, which keeps its binding.
  useEffect(() => {
    if (activeTour) return;
    if (cartTourId && lines.length === 0) {
      useCartStore.getState().setTour(undefined, undefined);
    }
  }, [activeTour, cartTourId, lines.length]);

  // An add parked on the guest's answer to "empty your cart?".
  const [pendingTourAdd, setPendingTourAdd] = useState<{
    tourId: number | undefined;
    tourSlug: string | undefined;
    add: () => void;
  } | null>(null);

  /**
   * Bind the cart to `tourId`, then run the add — asking first when binding
   * would mean dropping what the cart already holds.
   *
   * A tour order ships on another day, to another zone, at another fee, against
   * another minimum. Mixing it with an ordinary one is not a merge, it is a
   * wrong order, and the server rejects it (`tour_item_mismatch`). So the add is
   * parked until the guest agrees to lose the current cart.
   *
   * Called ONLY from the add paths. Switching tabs is browsing, and `setTour` is
   * destructive: a guest who merely looks at another carte keeps their cart.
   */
  const runWithCartTour = useCallback((tourId: number | undefined, add: () => void) => {
    const cart = useCartStore.getState();
    // The dedicated tour endpoint keys on the slug, so the cart must carry it,
    // not just the id (the checkout re-resolves the tour by slug). Resolve it
    // from the same entry list `activeTour` is read from.
    const tourSlug = tourId ? entries.find((m) => m.tour?.id === tourId)?.tour?.slug : undefined;
    if (!cart.canAdd(tourId)) {
      setPendingTourAdd({ tourId, tourSlug, add });
      return;
    }
    cart.setTour(tourId, tourSlug); // no-op when the cart already carries this tour
    add();
  }, [entries]);

  // The tour the CART belongs to (not the tab on screen). Its fee, its day and
  // its minimum are the ones this order will be judged against.
  const cartTour = useMemo(
    () => (cartTourId ? menu.menus?.find((m) => m.tour?.id === cartTourId)?.tour : undefined),
    [menu.menus, cartTourId]
  );

  // A tour cart is a delivery round, and the checkout already forces it to
  // `delivery`. The menu page must say the same thing: no pickup/delivery
  // switch, no order-details modal, no scheduling — the tour fixed all three.
  // A binding only means "tour cart" once there are lines to protect, or while
  // the guest is actually on the tour page (`activeTour`), where delivery is the
  // whole point. Off the tour page with an empty cart the binding is stale (the
  // shed effect above clears it), NOT a tour cart — keying on `!!cartTourId`
  // alone is what let a leftover round freeze the normal site in delivery.
  const isTourCart = !isTableOrder && !!cartTourId && (lines.length > 0 || !!activeTour);

  /**
   * A tour cart at a table: only reachable with a cart built on the delivery site
   * and then carried into a QR scan on the same device (localStorage survives the
   * hop). It cannot be sent to the kitchen and it cannot be checked out as a
   * dine-in order, so both paths refuse it and a banner offers the way out. The
   * cart is NOT cleared behind the guest's back — it is still a perfectly good
   * delivery order, just not from this table.
   */
  const tourCartAtTable = isTableOrder && !!cartTourId;

  // Menu layout: starts at the theme's default density, customer can toggle.
  // Toggle is rendered when the active theme allows it (theme.layout.itemDensityToggle).
  const { config: themeConfig } = useRestaurantTheme();
  const { resolved } = useResolvedTheme();
  // The admin configures the landing layout per device; mobile falls back to
  // the desktop choice when unset. The customer toggle still wins afterwards.
  const isMobileViewport = useIsMobileViewport();
  // `||` (not `??`): the admin preview posts '' for "no mobile override".
  const layoutDefault: "compact" | "magazine" =
    (isMobileViewport ? themeConfig?.layoutDefaultMobile : null) ||
    themeConfig?.layoutDefault ||
    "magazine";
  const [viewMode, setViewMode] = useViewMode(restaurantId, layoutDefault);
  // The order page is a shopping page; the resolved shopping side decides whether
  // the mobile bottom bar shows (else the top bar handles mobile via its modes).
  const shoppingSide = useNavLayoutSide("shopping");
  // Re-sync when the resolved default changes (admin live-preview, or the
  // viewport class resolving after mount).
  useEffect(() => {
    setViewMode(layoutDefault);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutDefault]);
  const menuLayout: "list" | "grid" = viewMode === "magazine" ? "grid" : "list";
  const showViewToggle = resolved?.layout.itemDensityToggle ?? true;
  const cartStyle = "bar-bottom" as "bar-bottom" | "fab-right" | "tab-right";
  const gridClass = menuLayout === "grid"
    ? "grid grid-cols-2 lg:grid-cols-3 gap-3"
    : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4";

  // Theme is controlled by RestaurantThemeProvider via the new theme system

  // Table session state (for dine-in)
  const isDineIn = initialOrderType === "dine_in";
  const tableSession = useTableSession();
  const [showGuestJoin, setShowGuestJoin] = useState(false);
  const [tableDrawerOpen, setTableDrawerOpen] = useState(false);
  const [paymentModeOpen, setPaymentModeOpen] = useState(false);
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  // Batch fulfillment config — fetched once on mount when batch mode is on.
  // Drives the batch pill in the hero + the summary at checkout. Null when
  // batch is disabled.
  const [batchConfig, setBatchConfig] = useState<BatchFulfillmentConfigResponse | null>(null);
  useEffect(() => {
    if (!restaurant.batchFulfillmentEnabled) {
      setBatchConfig(null);
      return;
    }
    fetchBatchFulfillmentConfig(restaurant.id).then(setBatchConfig).catch(() => setBatchConfig(null));
  }, [restaurant.id, restaurant.batchFulfillmentEnabled]);

  // Initialize table session for dine-in orders
  useEffect(() => {
    if (isDineIn && sessionId) {
      tableSession.initialize(sessionId).then(() => {
        // Show join modal if guest hasn't registered yet
        const state = useTableSession.getState();
        if (!state.guestId) {
          setShowGuestJoin(true);
        }
      });
    }
    return () => {
      if (isDineIn) tableSession.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDineIn, sessionId]);

  // For dine-in, order type is fixed. For pickup/delivery, allow switching
  const [orderType, setOrderType] = useState<OrderType>(initialOrderType);

  // Navigation drawer state
  const [navDrawerOpen, setNavDrawerOpen] = useState(false);

  // About / Info screen (slide-in from the right) — triggered by the
  // "Plus →" pill on the hero.
  const [infoScreenOpen, setInfoScreenOpen] = useState(false);

  // Order Details modal
  const [orderDetailsOpen, setOrderDetailsOpen] = useState(false);
  const [schedulingIntent, setSchedulingIntent] = useState<SchedulingIntent | null>(null);

  // The moment the cart becomes a tour cart, the fulfilment terms stop being the
  // guest's to choose: the tour ships on its day, to its cities, as a delivery.
  // The checkout enforces exactly that, so the menu page must not go on showing a
  // pickup option or a scheduling slot it will silently drop.
  useEffect(() => {
    if (!isTourCart) return;
    setOrderType("delivery");
    setSchedulingIntent(null);
    setOrderDetailsOpen(false);
  }, [isTourCart]);

  // Check what order types are enabled (not necessarily open)
  const pickupEnabled = restaurant.pickupEnabled;
  const deliveryEnabled = restaurant.deliveryEnabled;

  // Allow switching if not dine-in and both pickup and delivery are enabled
  // (User can switch to see that a service is closed). Never on a tour cart: the
  // tour is a delivery, full stop.
  const canSwitchOrderType =
    initialOrderType !== "dine_in" && !isTourCart && pickupEnabled && deliveryEnabled;

  // When the owner enables "choose order type at checkout" (Website builder →
  // Commande), the order page's fulfilment chip becomes read-only: no Modifier
  // button, no arrow, not tappable. The customer picks pickup/delivery on the
  // checkout page instead (which already exposes an order-type switcher).
  const orderTypeLocked = !!restaurant.websiteConfig?.checkoutConfig?.lock_order_type;

  // In the foodyadmin builder's footer tab, the order page is loaded in an
  // iframe (?preview=1) to preview the site-wide footer. Accept draft sections
  // from the editor parent and feed them to <SiteFooter> so footer edits show
  // live, mirroring RestaurantLanding's preview wiring.
  const footerPreviewActive = usePreviewMode();
  const [footerOverride, setFooterOverride] = useState<WebsiteSection[] | null>(null);
  useEffect(() => {
    if (footerPreviewActive) postEditorReady();
  }, [footerPreviewActive]);
  useEffect(() => {
    function onDraft(e: MessageEvent) {
      if (e.data?.type === "foody-draft-state" && e.data.state?.sections) {
        setFooterOverride(e.data.state.sections.map(mapAdminSection));
      }
    }
    window.addEventListener("message", onDraft);
    return () => window.removeEventListener("message", onDraft);
  }, []);

  // Builder-authored marketing sections for the order page (page slug "order"),
  // rendered above the menu. Reuses the footer preview override so draft edits
  // live-preview without a second message listener.
  const orderPageSections = (footerOverride ?? restaurant.websiteSections ?? []).filter(
    (s) => s.page === "order",
  );

  // Check if restaurant is open for current order type. Batch (scheduled bulk
  // order) mode bypasses regular hours for pickup/delivery — orders flow into
  // the next fulfillment batch and the cutoff is enforced at checkout.
  const currentAvailability = checkAvailability(
    restaurant.openingHoursConfig,
    orderType,
    restaurant.timezone || "UTC",
    restaurant.batchFulfillmentEnabled
  );
  /**
   * A tour cart answers to the TOUR's window, not the restaurant's hours.
   *
   * A tour is a one-off round to a city outside the usual zones, on its own
   * `[opens_at, cutoff_at]` window — announced at 11am for that evening, often
   * outside any ordinary delivery slot. Judging it against the restaurant's
   * delivery hours locks out every customer of the round at precisely the hours
   * the round exists to serve.
   *
   * The server returns a tour entry only while its window is open, so a tour the
   * cart still resolves against (`cartTour`) is an open tour, full stop. When it
   * closes it drops out of the payload, the effect above empties the cart, and
   * this stops applying. `rushMode` / `ordersPaused` still hold: those are the
   * restaurant saying "stop", not a timetable.
   */
  const isRestaurantOpen =
    (isTourCart ? !!cartTour : currentAvailability.isOpen) &&
    !restaurant.rushMode &&
    !restaurant.ordersPaused;

  useEffect(() => {
    setContext(restaurantId, menu.currency);
  }, [restaurantId, menu.currency, setContext]);

  // Stable ref for handleGroupClick — lets earlier-declared callbacks
  // (startCombo) call it without running into block-scope ordering issues.
  const groupClickRef = useRef<(id: string) => void>(() => {});

  // Combo state — browse-to-build mode
  const [activeCombo, setActiveCombo] = useState<ComboMenu | null>(null);
  // Entry-modal state — every combo tap opens the unified details modal first
  // (hero image + description). Fixed combos add straight to cart from there;
  // custom combos launch the menu-walking step drawer via startCombo.
  const [detailsCombo, setDetailsCombo] = useState<ComboMenu | null>(null);
  const [comboStepIdx, setComboStepIdx] = useState(0);
  // Aggregated combo builder: ONE selections array for the whole batch, and a
  // multiplier N that scales every step's required pick count. The guest fills
  // one pass ("Salads 0/9" for a 3-pick step at N=3); at finalize the picks are
  // split into N per-combo arrays (splitComboBatch) and stored on one cart line.
  const [comboSelections, setComboSelections] = useState<ComboCartSelection[]>([]);
  // How many of this combo the guest is building in one aggregated batch.
  const [comboMultiplier, setComboMultiplier] = useState(1);
  // When true, the auto-advance effect skips one cycle (user manually tapped a step pill)
  const manualStepNav = useRef(false);

  // -- Combo mode helpers --
  const isComboMode = activeCombo !== null;

  /** Set of MenuItem.id strings eligible for the CURRENT combo step */
  const comboEligibleIds = useMemo<Set<string>>(() => {
    if (!activeCombo) return new Set();
    const step = activeCombo.steps[comboStepIdx];
    if (!step) return new Set();
    return new Set(step.items.map((si) => String(si.menuItemId)));
  }, [activeCombo, comboStepIdx]);

  /** Map of MenuItem.id → pick count for the CURRENT step */
  const comboPicksByItem = useMemo<Map<string, number>>(() => {
    const m = new Map<string, number>();
    if (!activeCombo) return m;
    const step = activeCombo.steps[comboStepIdx];
    if (!step) return m;
    comboSelections
      .filter((s) => s.stepId === step.id)
      .forEach((s) => m.set(String(s.menuItemId), (m.get(String(s.menuItemId)) || 0) + s.quantity));
    return m;
  }, [activeCombo, comboStepIdx, comboSelections]);

  /** Set of MenuItem.id strings reachable through the regular browse-to-build
   *  flow. Items in this set render as cards in the menu grid; items outside
   *  it are 'off-carte' for the combo wizard and need their own selection
   *  surface (the "Also in this step" row on the progress bar). */

  /** Step items for the CURRENT step that aren't reachable through the menu
   *  grid. Currently empty: the admin UI flags items off-carte with the explicit
   *  warning "N'apparaîtront à aucun client", which is a customer-facing
   *  contract — surfacing those items here would contradict it. Re-enable per
   *  item once the server distinguishes "off-carte by exclusion" from
   *  "intentionally combo-include-anyway" with a positive flag. */
  const offCarteStepItems = useMemo(() => [] as never[], []);

  const startCombo = useCallback((combo: ComboMenu, quantity: number) => {
    const n = clampComboQuantity(quantity);
    const startIdx = firstChoiceStepIdx(combo);

    setActiveCombo(combo);
    setComboMultiplier(n);
    setComboStepIdx(startIdx);
    setComboSelections(initialBatchSelections(combo, n));

    // Scroll to the group of the start step's eligible items.
    const startStep = combo.steps[startIdx];
    if (startStep && startStep.items.length > 0) {
      const eligibleIds = new Set(startStep.items.map((si) => String(si.menuItemId)));
      const catCounts = new Map<string, number>();
      for (const item of menu.items) {
        if (eligibleIds.has(item.id)) {
          catCounts.set(item.groupId, (catCounts.get(item.groupId) || 0) + 1);
        }
      }
      let bestCat = "";
      let bestCount = 0;
      for (const [catId, count] of catCounts) {
        if (count > bestCount) { bestCat = catId; bestCount = count; }
      }
      if (bestCat) {
        setTimeout(() => groupClickRef.current(bestCat), 100);
      }
    }
  }, [menu.items]);

  const cancelCombo = useCallback(() => {
    setActiveCombo(null);
    setComboStepIdx(0);
    setComboSelections([]);
    setComboMultiplier(1);
  }, []);

  // Item-fly animation: a ghost of the tapped item streaks into the live count
  // badge in the progress drawer, so the customer sees the pick register.
  const [flyGhosts, setFlyGhosts] = useState<
    Array<{ key: number; src: string; left: number; top: number; width: number; height: number; dx: number; dy: number }>
  >([]);
  const ghostKey = useRef(0);
  const flyItemToBadge = useCallback((menuItemId: number) => {
    if (typeof window === "undefined") return;
    const srcEl = document.querySelector(
      `[data-combo-item-id="${menuItemId}"] img`
    ) as HTMLImageElement | null;
    const target = document.getElementById("combo-count-target");
    if (!srcEl || !target) return;
    const s = srcEl.getBoundingClientRect();
    const tg = target.getBoundingClientRect();
    if (s.width === 0 || tg.width === 0) return;
    const key = ++ghostKey.current;
    setFlyGhosts((g) => [
      ...g,
      {
        key,
        src: srcEl.currentSrc || srcEl.src,
        left: s.left,
        top: s.top,
        width: s.width,
        height: s.height,
        dx: tg.left + tg.width / 2 - (s.left + s.width / 2),
        dy: tg.top + tg.height / 2 - (s.top + s.height / 2),
      },
    ]);
  }, []);

  // Variant picker for combo mode: when an item has options, show a quick picker
  const [comboVariantPicker, setComboVariantPicker] = useState<{
    item: MenuItem;
    stepItem: { menuItemId: number; optionId?: number | null; priceDelta: number };
    stepItems: Array<{ menuItemId: number; optionId?: number | null; priceDelta: number }>;
    stepId: number;
    stepName: string;
  } | null>(null);

  const addComboSelectionWithVariant = useCallback(
    (stepId: number, stepName: string, menuItemId: number, priceDelta: number,
     displayName: string, optionId: number | null) => {
      const stepTotalPicks = comboSelections
        .filter((s) => s.stepId === stepId)
        .reduce((sum, s) => sum + s.quantity, 0);
      const step = activeCombo?.steps.find((s) => s.id === stepId);
      if (step && stepTotalPicks >= step.maxPicks * comboMultiplier) return;

      // Per-size caps: this pick's size must be allowed by the step's rules and
      // must not exceed its max. Size label = the option name after " - ".
      if (step?.variantRules?.length && optionId != null) {
        const sizeLabel = displayName.split(" - ").slice(1).join(" - ");
        const rule = step.variantRules.find(
          (r) => normSizeLabel(r.variantLabel) === normSizeLabel(sizeLabel),
        );
        if (!rule) return; // size not offered by this step
        if (rule.maxPicks > 0) {
          const usedAtSize = batchStepSizePicks(comboSelections, stepId, sizeLabel);
          if (usedAtSize >= rule.maxPicks * comboMultiplier) return;
        }
      }

      // Per-item cap: an item may be picked at most N times in the step
      // (across sizes) — an itemLimits override wins over the step default.
      if (step) {
        const perItemCap = effectivePerItemCap(step, menuItemId);
        if (perItemCap > 0) {
          const usedForItem = comboSelections
            .filter((s) => s.stepId === stepId && s.menuItemId === menuItemId)
            .reduce((sum, s) => sum + s.quantity, 0);
          if (usedForItem >= perItemCap * comboMultiplier) return;
        }
      }

      // Fly a ghost of the tapped item into the count badge.
      flyItemToBadge(menuItemId);

      setComboSelections((prev) => {
        const matchKey = (s: typeof prev[0]) =>
          s.stepId === stepId && s.menuItemId === menuItemId && (s.optionId ?? null) === optionId;
        const existing = prev.find(matchKey);
        if (existing) {
          return prev.map((s) => matchKey(s) ? { ...s, quantity: s.quantity + 1 } : s);
        }
        return [
          ...prev,
          {
            stepId,
            stepName,
            menuItemId,
            menuItemName: displayName,
            optionId,
            optionName: optionId ? displayName.split(' - ').slice(1).join(' - ') : undefined,
            quantity: 1,
            priceDelta,
          },
        ];
      });
    },
    [activeCombo, comboMultiplier, comboSelections, flyItemToBadge, setComboSelections]
  );

  const handleComboItemTap = useCallback(
    (item: MenuItem) => {
      if (!activeCombo) return;
      const step = activeCombo.steps[comboStepIdx];
      if (!step) return;

      // Find ALL step items for this menu item (there may be multiple with different optionIds)
      const matchingStepItems = step.items.filter((si) => String(si.menuItemId) === item.id);
      if (matchingStepItems.length === 0) return;

      // Gather all item options for name resolution
      const allItemOpts = (item.optionSets ?? []).flatMap((os) => os.options ?? []).filter((o) => o.isActive);

      // If only one step item and it has a specific optionId → add directly (no picker needed)
      if (matchingStepItems.length === 1 && matchingStepItems[0].optionId) {
        const si = matchingStepItems[0];
        const opt = allItemOpts.find((o) => o.id === si.optionId);
        const displayName = opt ? `${item.name} - ${opt.name}` : item.name;
        addComboSelectionWithVariant(step.id, step.name, si.menuItemId, si.priceDelta, displayName, si.optionId!);
        return;
      }

      // If only one step item with no optionId and item has no options → add directly
      if (matchingStepItems.length === 1 && !matchingStepItems[0].optionId && allItemOpts.length === 0) {
        const si = matchingStepItems[0];
        addComboSelectionWithVariant(step.id, step.name, si.menuItemId, si.priceDelta, item.name, null);
        return;
      }

      // Multiple options configured in combo step, or item has options → show picker
      setComboVariantPicker({
        item,
        stepItem: matchingStepItems[0],
        stepItems: matchingStepItems,
        stepId: step.id,
        stepName: step.name,
      });
    },
    [activeCombo, comboStepIdx, addComboSelectionWithVariant]
  );

  /** Remove one pick of an item from the current combo step */
  const handleComboItemRemove = useCallback(
    (item: MenuItem) => {
      if (!activeCombo) return;
      const step = activeCombo.steps[comboStepIdx];
      if (!step) return;

      const menuItemId = Number(item.id);
      setComboSelections((prev) => {
        const existing = prev.find(
          (s) => s.stepId === step.id && s.menuItemId === menuItemId
        );
        if (!existing) return prev;
        if (existing.quantity <= 1) {
          // Remove entirely
          return prev.filter(
            (s) => !(s.stepId === step.id && s.menuItemId === menuItemId)
          );
        }
        // Decrement
        return prev.map((s) =>
          s.stepId === step.id && s.menuItemId === menuItemId
            ? { ...s, quantity: s.quantity - 1 }
            : s
        );
      });
    },
    [activeCombo, comboStepIdx, setComboSelections]
  );

  /** Finalize the aggregated batch: split the picks into N per-combo arrays and
   *  add ONE "Combo ×N" cart line carrying the split as its order batch. */
  const completeCombo = useCallback(() => {
    if (!activeCombo) return;
    const n = comboMultiplier;
    const orderBatch = splitComboBatch(activeCombo, comboSelections, n);
    runWithCartTour(activeTour?.id, () => {
      addCombo(activeCombo.id, activeCombo.name, activeCombo.price, comboSelections, n, orderBatch);
    });
    cancelCombo();
  }, [activeCombo, activeTour, comboMultiplier, comboSelections, addCombo, cancelCombo, runWithCartTour]);

  /** Fixed combos: build the bundle once, multiply, add ONE "Combo ×N" line. */
  const addFixedCombos = useCallback(
    (comboId: number, comboName: string, comboPrice: number, selections: ComboCartSelection[], quantity: number) => {
      const n = clampComboQuantity(quantity);
      // Aggregate the fixed bundle (each selection ×n) and split it back into n copies.
      const aggregated = selections.map((s) => ({ ...s, quantity: s.quantity * n }));
      // activeCombo is null on the fixed-combo entry path (fixed combos add
      // straight from the modal, never starting the builder), so the else
      // branch (n identical copies) always runs here; the splitComboBatch
      // branch is defensive only.
      const combo: ComboMenu | null = activeCombo;
      const orderBatch = combo
        ? splitComboBatch(combo, aggregated, n)
        : Array.from({ length: n }, () => selections.map((s) => ({ ...s })));
      runWithCartTour(activeTour?.id, () => {
        addCombo(comboId, comboName, comboPrice, aggregated, n, orderBatch);
      });
    },
    [activeCombo, activeTour, addCombo, runWithCartTour],
  );

  /** Central click handler — routes to combo or item detail */
  const handleItemClick = useCallback(
    (item: MenuItem) => {
      if (isComboMode) {
        // In combo mode, only eligible items respond
        if (comboEligibleIds.has(item.id)) {
          handleComboItemTap(item);
        }
        return;
      }
      // combo_only items shouldn't open detail outside combo mode
      if (item.comboOnly) return;

      // Combo-type items → open the unified details modal first (hero image +
      // description). The modal decides fixed (add to cart) vs custom (start the
      // step drawer) internally, so every combo gets the same product-style entry.
      if (item.itemType === 'combo' && item.comboSteps && item.comboSteps.length > 0) {
        const asComboMenu: ComboMenu = {
          id: Number(item.id),
          name: item.name,
          description: item.description,
          price: item.price,
          imageUrl: item.imageUrl,
          isActive: true,
          sortOrder: 0,
          steps: item.comboSteps,
          allowQuantity: item.comboAllowQuantity,
        };
        setDetailsCombo(asComboMenu);
        return;
      }

      // Every item tap opens the detail modal — even when there are no
      // modifiers or variants. The customer sees the big image and full
      // description, then commits via the modal's "Add to cart" button.
      setSelectedItem(item);
    },
    [isComboMode, comboEligibleIds, handleComboItemTap]
  );

  // One-line transient notice at the top of the page: a reorder that skipped
  // items, an action the page had to refuse. Shared by every caller so the page
  // never grows a second toast for the same job.
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<number | null>(null);
  const flashNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 6000);
  }, []);

  // Reorder a past order into the cart (from account order history). Adds items
  // that are on this week's menu (with their variant); routes combos through the
  // builder; skips and reports anything no longer available.
  const replayOrderIntoCart = useCallback(
    (order: GuestOrder) => {
      const unavailable: string[] = [];
      let added = 0;
      for (const it of order.items) {
        const item = menu.items.find((m) => Number(m.id) === it.menu_item_id);
        if (!item || item.available === false) {
          unavailable.push(it.combo_name || it.name);
          continue;
        }
        if (it.combo_item_id || item.itemType === "combo") {
          handleItemClick(item); // open the combo builder
          added++;
          continue;
        }
        // Resolve the previously chosen variant for correct price/label.
        let variantId = it.selected_variant_id;
        let variantName: string | undefined;
        let variantPrice: number | undefined;
        if (variantId) {
          for (const os of item.optionSets ?? []) {
            const opt = os.options.find((o) => o.id === variantId);
            if (opt) {
              variantName = opt.name;
              variantPrice = opt.onlinePrice ?? opt.price;
              break;
            }
          }
        } else {
          // Legacy line with no stored size on an item that has size options:
          // default to the first option — the same one the item modal
          // auto-selects — so the reordered line carries a real size instead
          // of re-propagating the size-less shape.
          const first = (item.optionSets ?? [])
            .map((os) => (os.options ?? []).filter((o) => o.isActive)[0])
            .find(Boolean);
          if (first) {
            variantId = first.id;
            variantName = first.name;
            variantPrice = first.onlinePrice ?? first.price;
          }
        }
        addItem(item, it.quantity || 1, undefined, undefined, variantId, variantName, variantPrice);
        added++;
      }
      if (added > 0) setCartOpen(true);
      if (unavailable.length) {
        flashNotice(
          (t("reorderUnavailable") || "Not on this week's menu, so skipped: {list}").replace(
            "{list}",
            unavailable.join(", ")
          )
        );
      }
    },
    [menu.items, addItem, handleItemClick, t, flashNotice]
  );

  // Derive groups + items for the currently selected entry (groups replace legacy
  // categories).
  //
  // The flat `menu.categories` / `menu.items` lists double as a global
  // lookup-by-id table, so they KEEP the tours' groups and items. They are
  // therefore NOT a safe fallback whenever entries exist: rendering them would
  // put a tour's carte on screen while `activeTour` — read from `activeEntry` —
  // is undefined, and every add would bind the cart to no tour. Wrong day, no
  // delivery fee, no zone check, and the server takes it, because the items are
  // global to the restaurant.
  //
  // With entries present there is always one to show (activeEntry falls back to
  // entries[0]), so the only way here is entries being empty: a table whose
  // payload carried nothing but tours. Nothing to browse is the correct answer.
  const activeMenuGroups = useMemo(() => {
    if (!menu.menus?.length) return menu.categories;
    if (!activeEntry) return [];
    return activeEntry.groups;
  }, [menu.categories, menu.menus, activeEntry]);

  const activeMenuItems = useMemo(() => {
    if (!menu.menus?.length) return menu.items;
    if (!activeEntry) return [];
    return activeEntry.items;
  }, [menu.items, menu.menus, activeEntry]);

  // The exact ids the guest can see right now — sent to the AI assistant as a
  // hard allowlist so it can only ever suggest/order from the active carte.
  const visibleItemIds = useMemo(
    () => activeMenuItems.map((i) => Number(i.id)).filter((n) => Number.isFinite(n)),
    [activeMenuItems]
  );

  // Combos on the active carte, keyed by numeric id — lets the AI assistant
  // drive a deterministic step-picker from real menu data instead of relying on
  // the model to list the options.
  const aiCombos = useMemo(() => {
    const map: Record<number, MenuItem> = {};
    for (const it of activeMenuItems) {
      const id = Number(it.id);
      if (
        Number.isFinite(id) &&
        it.itemType === "combo" &&
        it.comboSteps &&
        it.comboSteps.length > 0
      ) {
        map[id] = it;
      }
    }
    return map;
  }, [activeMenuItems]);

  const [activeGroup, setActiveGroup] = useState<string>("");
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  // Deep link from a shared item URL (?item=<id>): open that item's modal once
  // on mount. The ?lang param is intentionally NOT applied here; it only drives
  // the server-rendered link preview (Open Graph). The recipient keeps their own
  // language. Silent if the id is not in the menu (stale link / rotating carte).
  //
  // The item is resolved against the ENTRY THAT CARRIES IT, and that entry is
  // selected before the modal opens. Resolving against the flat `menu.items`
  // instead — a global lookup table that deliberately keeps the tours' items —
  // opened a tour item's modal on top of the ordinary carte, where `activeTour`
  // is undefined: the add bound the cart to no tour, and the guest checked out a
  // tour item as an ordinary delivery (today, no fee, no zone check). The share
  // button on ItemModal produces exactly this link, so it is a link customers
  // actually pass around.
  //
  // Not found in any VISIBLE entry means: not orderable from where we stand. A
  // tour item at a table is the case that matters (a table shows no tour at all,
  // so nothing can carry it), and there the modal must not open — the dine-in
  // path cannot honour a tour. Stale ids on a rotated carte land here too.
  // Deps intentionally empty: one-shot bootstrap; menu is a stable server prop.
  useEffect(() => {
    const itemId = searchParams.get("item");
    if (!itemId) return;
    // Legacy single-carte payload: no entries, no tours, flat lists are all
    // there is.
    if (!menu.menus?.length) {
      const found = menu.items.find((i) => i.id === itemId);
      if (found) setSelectedItem(found);
      return;
    }
    const entry = entries.find((m) => m.items.some((i) => i.id === itemId));
    if (!entry) return;
    selectEntry(entry.entryKey);
    setSelectedItem(entry.items.find((i) => i.id === itemId) ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [cartOpen, setCartOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiNudgeOpen, setAiNudgeOpen] = useState(false);
  const aiNudgedRef = useRef(false);
  const aiOpenRef = useRef(false);
  useEffect(() => {
    aiOpenRef.current = aiOpen;
  }, [aiOpen]);

  /**
   * The assistant is a SECOND ordering path: its `place_order` tool creates a
   * real order server-side, and that tool knows nothing about tours — there is no
   * tour_id anywhere in `internal/aiorder`. Handed the tour's carte through
   * `visibleItemIds`, it would cheerfully build an ORDINARY order out of it:
   * wrong day, no tour fee, no zone check. Teaching it tours is a server job of
   * its own, so until then it is simply closed on a tour carte, and says why
   * rather than vanishing.
   */
  const aiBlockedByTour = !!activeTour;
  useEffect(() => {
    if (!aiBlockedByTour) return;
    setAiOpen(false);
    setAiNudgeOpen(false);
  }, [aiBlockedByTour]);

  // Proactive AI prompt: show a centered "can I help you?" nudge immediately or
  // after a delay (only if the cart is still empty), per restaurant settings.
  useEffect(() => {
    if (!restaurant.aiAssistantEnabled || aiBlockedByTour) return;
    const trigger = restaurant.aiAssistantTrigger ?? "manual";
    if (trigger === "manual") return;

    const key = `foody-ai-nudged-${restaurantId}`;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      // sessionStorage unavailable — fall through, the ref still guards re-fires
    }

    const fire = () => {
      if (aiNudgedRef.current || aiOpenRef.current) return;
      if (useCartStore.getState().lines.length > 0) return; // guest already started
      aiNudgedRef.current = true;
      try {
        sessionStorage.setItem(key, "1");
      } catch {
        /* ignore */
      }
      setAiNudgeOpen(true);
    };

    const delayMs =
      trigger === "delay" ? Math.max(0, restaurant.aiAssistantTriggerDelay ?? 45) * 1000 : 600;
    const id = window.setTimeout(fire, delayMs);
    return () => window.clearTimeout(id);
  }, [
    restaurant.aiAssistantEnabled,
    restaurant.aiAssistantTrigger,
    restaurant.aiAssistantTriggerDelay,
    restaurantId,
    aiBlockedByTour,
  ]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isScrolling, setIsScrolling] = useState(false);
  const [justAddedId, setJustAddedId] = useState<string | number | null>(null);

  /**
   * Show an entry's carte (tab click, tour banner CTA, deep link).
   *
   * Browsing only: the cart is deliberately left alone. Binding it here would
   * mean calling the destructive `setTour` on a mere tab click, and a guest who
   * glances at another carte would watch their cart vanish. The cart binds to a
   * tour at ADD time, in `runWithCartTour`, and nowhere else.
   */
  const selectEntry = useCallback((entryKey: string) => {
    setActiveEntryKey(entryKey);
    setActiveGroup("");
    setSearchQuery("");
  }, []);

  /**
   * Replay a past order into the cart ("order again", from the account history).
   *
   * An ordinary order rebuilds an ordinary cart, and must not be poured into a
   * cart that carries a tour — that is the silent mix the server rejects, so it
   * goes through the same guard as any other add.
   *
   * A TOUR order can only be replayed onto its own tour: its lines come from the
   * tour's carte and the server checks every one of them against it
   * (`tour_item_mismatch`). If that tour is still open we restore the tour context
   * along with the items and show its carte. If it has closed — or we are at a
   * table, where a tour does not exist — we build nothing: a cart that can only
   * ever be refused is worse than a plain "that round is over".
   */
  const handleReorderToCart = useCallback(
    (order: GuestOrder) => {
      const orderTourId = order.tour_id;
      if (!orderTourId) {
        runWithCartTour(undefined, () => replayOrderIntoCart(order));
        return;
      }
      const entry = entries.find((m) => m.tour?.id === orderTourId);
      if (!entry) {
        flashNotice(t("tourReorderClosed"));
        return;
      }
      selectEntry(entry.entryKey);
      runWithCartTour(orderTourId, () => replayOrderIntoCart(order));
    },
    [entries, replayOrderIntoCart, runWithCartTour, selectEntry, flashNotice, t]
  );

  // Auto-clear the "just added" flash after animation completes
  useEffect(() => {
    if (justAddedId == null) return;
    const t = setTimeout(() => setJustAddedId(null), 1200);
    return () => clearTimeout(t);
  }, [justAddedId]);

  // Refs for group sections
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);

  const itemsByGroup = useMemo(
    () =>
      activeMenuItems.reduce<Record<string, MenuItem[]>>((acc, item) => {
        acc[item.groupId] = acc[item.groupId] ? [...acc[item.groupId], item] : [item];
        return acc;
      }, {}),
    [activeMenuItems]
  );

  // Filter items based on search. Match against both the source name/description
  // and the localized values, so a Hebrew-speaking guest typing in Hebrew finds
  // items even when the source language is English (and vice versa).
  const filteredItems = useMemo(() => {
    if (!searchQuery) return null;
    const query = searchQuery.toLowerCase();
    return activeMenuItems.filter((item) => {
      const localizedName = tField(item, "name", locale).toLowerCase();
      const localizedDesc = tField(item, "description", locale).toLowerCase();
      return (
        item.name.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        localizedName.includes(query) ||
        localizedDesc.includes(query)
      );
    });
  }, [activeMenuItems, searchQuery, locale]);

  // Set up section ref
  const setSectionRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) {
      sectionRefs.current.set(id, el);
    } else {
      sectionRefs.current.delete(id);
    }
  }, []);

  // Handle group click - scroll to section
  const handleGroupClick = useCallback((groupId: string) => {
    setIsScrolling(true);
    setActiveGroup(groupId);
    setSearchQuery("");

    const section = sectionRefs.current.get(groupId);
    if (section) {
      const headerOffset = 140; // Height of sticky header + tabs
      const elementPosition = section.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });

      // Reset scrolling flag after animation
      setTimeout(() => setIsScrolling(false), 800);
    }
  }, []);
  groupClickRef.current = handleGroupClick;

  /**
   * Given a combo step index, find the group with the most eligible items
   * and scroll to it. Used by both manual step-tap and auto-advance.
   */
  const scrollToStepGroup = useCallback(
    (idx: number) => {
      if (!activeCombo) return;
      const step = activeCombo.steps[idx];
      if (!step || step.items.length === 0) return;

      const eligibleIds = new Set(step.items.map((si) => String(si.menuItemId)));
      const catCounts = new Map<string, number>();
      for (const item of menu.items) {
        if (eligibleIds.has(item.id)) {
          catCounts.set(item.groupId, (catCounts.get(item.groupId) || 0) + 1);
        }
      }
      if (catCounts.size === 0) return;
      let bestCat = "";
      let bestCount = 0;
      for (const [catId, count] of catCounts) {
        if (count > bestCount) {
          bestCat = catId;
          bestCount = count;
        }
      }
      if (bestCat) {
        setTimeout(() => handleGroupClick(bestCat), 50);
      }
    },
    [activeCombo, menu.items, handleGroupClick]
  );

  /** Switch to a combo step and scroll to its group */
  const handleComboStepTap = useCallback(
    (idx: number) => {
      manualStepNav.current = true;
      setComboStepIdx(idx);
      scrollToStepGroup(idx);
    },
    [scrollToStepGroup]
  );

  /**
   * Auto-advance: when the current combo step is full, move to the next step
   * after a short delay. Uses useEffect so it always sees fresh state
   * (avoids stale-closure bugs with setTimeout inside callbacks).
   */
  useEffect(() => {
    // Skip auto-advance when the user manually navigated to a completed step
    // (e.g. tapping step 1 pill to edit picks). Reset the flag for next cycle.
    if (manualStepNav.current) {
      manualStepNav.current = false;
      return;
    }
    if (!activeCombo) return;
    const step = activeCombo.steps[comboStepIdx];
    if (!step) return;

    const picks = comboSelections
      .filter((s) => s.stepId === step.id)
      .reduce((sum, s) => sum + s.quantity, 0);

    if (picks >= step.maxPicks * comboMultiplier) {
      const nextIdx = comboStepIdx + 1;
      if (nextIdx < activeCombo.steps.length) {
        const timer = setTimeout(() => {
          setComboStepIdx(nextIdx);
          scrollToStepGroup(nextIdx);
        }, 350);
        return () => clearTimeout(timer);
      }
    }
  }, [activeCombo, comboStepIdx, comboSelections, comboMultiplier, scrollToStepGroup]);

  // Categories with items (filter empty categories)
  const groupsWithItems = useMemo(() => {
    return activeMenuGroups.filter((g) => (itemsByGroup[g.id]?.length ?? 0) > 0);
  }, [activeMenuGroups, itemsByGroup]);

  // Set up intersection observer for scroll-based group selection
  useEffect(() => {
    if (searchQuery) return; // Don't observe when searching

    const options = {
      root: null,
      rootMargin: "-140px 0px -60% 0px", // Account for sticky header
      threshold: 0
    };

    observerRef.current = new IntersectionObserver((entries) => {
      if (isScrolling) return; // Don't update during programmatic scroll

      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute("data-group-id");
          if (id) {
            setActiveGroup(id);
          }
        }
      });
    }, options);

    // Observe all sections
    sectionRefs.current.forEach((el) => {
      observerRef.current?.observe(el);
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, [searchQuery, isScrolling, groupsWithItems]);

  const handleAddToCart = (
    item: MenuItem,
    quantity: number,
    note?: string,
    modifiers?: MenuItem["modifiers"],
    selectedVariantId?: number,
    selectedVariantName?: string,
    selectedVariantPrice?: number,
  ) => {
    // The item belongs to the carte on screen — so the cart must belong to that
    // carte's tour (or to no tour at all). runWithCartTour asks before it drops
    // a cart built on another one.
    runWithCartTour(activeTour?.id, () => {
      addItem(item, quantity, note, modifiers, selectedVariantId, selectedVariantName, selectedVariantPrice);
      setJustAddedId(item.id);
    });
  };

  // Direct dine-in order (no prepayment) — skip checkout entirely
  const isDineInNoPrepay = isDineIn && !restaurant.requireDineInPrepayment;
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  // Confirm just succeeded — drives the cart-to-table fly animation and the
  // brief in-drawer success state. Increments per confirm so the SessionBar
  // replays the motion each time.
  const [confirmedTick, setConfirmedTick] = useState(0);
  const [cartSuccess, setCartSuccess] = useState(false);

  const placeOrderDirect = async () => {
    if (isDatePreview) return; // view-only preview: never place a real order
    if (isPlacingOrder || lines.length === 0) return;
    // Belt and braces. The table shows no tour at all, so this cart should never
    // carry one — but this payload has no `tourId` field to put it in, and the
    // server would take it as a plain dine-in order: the tour's day, fee and zone
    // silently dropped. It cannot be sent, so it is not sent.
    if (useCartStore.getState().tourId) {
      alert(t("tourNotAtTable"));
      return;
    }
    setIsPlacingOrder(true);
    try {
      const { guestId, guestName } = useTableSession.getState();
      const payload: OrderPayload = {
        restaurantId,
        tableId,
        sessionId,
        guestId: guestId || undefined,
        guestName: guestName || undefined,
        orderType: "dine_in",
        customerName: guestName || undefined,
        items: lines.filter((l) => !l.comboId).map((line) => ({
          itemId: line.item.id,
          quantity: line.quantity,
          note: line.note,
          modifiers: line.modifiers?.map((m) => ({ modifierId: m.id, applied: true })),
        })),
        combos: lines.filter((l) => l.comboId && l.comboSelections).map((line) => ({
          comboItemId: line.comboId!,
          selections: line.comboSelections!.map((sel) => ({
            stepId: sel.stepId,
            menuItemId: sel.menuItemId,
            optionId: sel.optionId,
            quantity: sel.quantity,
            notes: sel.notes,
          })),
        })),
        paymentMethod: "pay_later",
        paymentRequired: false,
      };

      await createOrder(payload);

      // Refresh table session so other guests see the new order
      if (sessionId) {
        await useTableSession.getState().refreshOrders();
      }

      // Choreographed handoff:
      //  0ms    — show "Sent to kitchen" in the drawer (success state)
      //  1100ms — start closing the drawer AND trigger the fly animation on
      //           the SessionBar (drawer slides down, revealing the bar; the
      //           cart side is still visible since we haven't cleared yet)
      //  2000ms — fly is done, clear the cart so the cart side collapses and
      //           the table pill takes full width with the new order count.
      setCartSuccess(true);
      setTimeout(() => {
        setCartOpen(false);
        setCartSuccess(false);
        setConfirmedTick((n) => n + 1);
        setTimeout(() => {
          useCartStore.getState().clear();
        }, 900);
      }, 1100);
    } catch (err: any) {
      alert(err?.message || "Failed to place order");
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const startCheckout = () => {
    if (isDatePreview) return; // view-only preview: checkout is disabled
    // Same refusal as `placeOrderDirect`, for the dine-in-with-prepayment path:
    // the checkout forces a tour cart to `delivery` and drops the tableId, which
    // would quietly turn "the table over there" into a delivery on the tour's day.
    if (tourCartAtTable) {
      alert(t("tourNotAtTable"));
      return;
    }
    const checkoutParams = new URLSearchParams({
      restaurantId,
      orderType,
      ...(tableId && { tableId }),
      ...(sessionId && { sessionId }),
      ...(schedulingIntent && {
        isScheduled: "true",
        scheduledFor: schedulingIntent.scheduledFor,
        scheduledPickupWindowStart: schedulingIntent.selectedSlot.start,
        scheduledPickupWindowEnd: schedulingIntent.selectedSlot.end,
      }),
    });
    // The tour travels with the CART, not with the tab on screen: a guest can
    // fill a tour cart and then wander back to the ordinary carte without adding
    // anything. What is being checked out is the cart, so its tour is the one
    // the server must price, schedule and geofence against.
    if (cartTourId) checkoutParams.set("tourId", String(cartTourId));
    router.push(`/order/checkout?${checkoutParams.toString()}`);
  };

  const totalAmount = total();
  const totalItems = lines.reduce((sum, line) => sum + line.quantity, 0);

  // In dine-in mode, the SessionBar renders the Smart Dock — a stacked
  // surface card with up to three rows (ready banner, table strip, cart CTA).
  // Worst-case height ~190px, so we reserve generously to avoid hiding the
  // last menu item.
  const isDineInSessionActive = isDineIn && tableSession.status === "active";
  const dockBottomPadding = "pb-48";
  const barBottomPadding = "pb-32";
  const bottomPaddingClass = isDineInSessionActive
    ? dockBottomPadding
    : totalItems > 0 && cartStyle === "bar-bottom"
      ? barBottomPadding
      : "";

  // Batch (bulk) restaurants split the old combined chip in two, Wolt-style:
  // the fulfilment week reads as plain text in the hero info line ("Ouvre
  // Mercredi 22:00 …"), and the order type gets its own button. That button is
  // a normal clickable order-type selector when the type is chosen on the menu
  // (lock_order_type = false) and a non-clickable display when it's chosen at
  // checkout (lock_order_type = true). Non-batch restaurants are unaffected.
  const batchEnabled =
    !!restaurant.batchFulfillmentEnabled &&
    !!batchConfig?.enabled &&
    !!batchConfig.fulfillmentDays?.[0];
  const batchInlineMode = batchEnabled;
  // Prefix the week with "Pré-commande" so customers read this as preorder-only,
  // not "closed" (batch mode replaces normal opening hours).
  const batchInlineStatus =
    batchInlineMode && batchConfig
      ? `${t("preOrder") || "Pre-order"} · ${formatBatchStatusInline(batchConfig, locale, t("opensAt") || "Opens")}`
      : undefined;

  // The order-type selector shows only when the customer can pick the type on
  // the menu page. When it's locked to checkout we hide it entirely (the week
  // still shows in the info line). When shown it's always clickable — except
  // dine-in, whose chip is fixed table identity (you can't switch mode from a
  // QR scan).
  const showOrderChip = isDineIn || !orderTypeLocked;
  const modeChipTableLabel =
    isDineIn && tableSession.status === "active"
      ? tableSession.tableName ||
        (tableSession.tableCode ? `${t("table") || "Table"} ${tableSession.tableCode}` : undefined)
      : undefined;
  // A tour cart's chip is read-only for the same reason the dine-in one is: the
  // mode is not a choice. Tapping it would open a modal offering pickup and a
  // scheduling picker that the tour, and the checkout, both override.
  const modeChipOnTap =
    isDineIn || isTourCart ? undefined : () => setOrderDetailsOpen(true);

  // On a tour page the mode is not a choice, so the ModeChip is replaced by a
  // read-only chip that names the destination (🚚 Raanana) — the run itself is
  // the ordering context. It matches the ModeChip's shape/classes: `inline` for
  // the auto-width pill inside the hero info row (sm+), full-width below the
  // band on mobile. The 🚚 stands in for the ModeChip's line icon.
  const tourChip = (inline: boolean) =>
    activeTour ? (
      <div className={inline ? "contents" : "relative z-[3] px-4 pb-5"}>
        <div
          className={`${
            inline ? "inline-flex" : "flex w-full"
          } items-center gap-2.5 h-12 px-4 rounded-xl bg-[var(--surface-subtle)] text-[var(--brand)] text-[15px] font-bold`}
        >
          <span aria-hidden="true" className="text-[17px] leading-none shrink-0">
            🚚
          </span>
          <span className="truncate">{activeTour.name}</span>
        </div>
      </div>
    ) : undefined;

  return (
    <main className={`min-h-screen bg-[var(--bg-page)] ${bottomPaddingClass}`} dir={direction}>
      {/* Future-week preview banner (view-only). Sticky above everything so the
          operator always knows they're looking at a future date, not live. */}
      {isDatePreview && previewDate && (
        <div className="sticky top-0 z-[60] bg-amber-500 text-black px-4 py-2 text-center text-sm font-semibold shadow-md">
          {(t("previewBannerForDate") || "Preview — menu for {date}").replace(
            "{date}",
            formatDateLabel(previewDate, locale)
          )}
          <span className="font-normal opacity-80">
            {" "}· {t("previewOrderingDisabled") || "Ordering is disabled"}
          </span>
        </div>
      )}
      {/* Unified top bar (shopping page): compact on desktop, hidden on mobile
          where the bottom bar takes over. The hamburger opens the order-owned
          cart-aware drawer; the density toggle + account ride in the right slot. */}
      <SiteNavbar
        restaurant={restaurant}
        pageType="shopping"
        overHero
        hideCta
        onHamburgerClick={() => setNavDrawerOpen(true)}
        rightSlot={({ textColor }) => (
          <OrderToolbar
            viewMode={viewMode}
            onToggleViewMode={() => setViewMode(viewMode === "compact" ? "magazine" : "compact")}
            showViewToggle={showViewToggle}
            restaurantId={restaurantId}
            currency={menu.currency}
            onReorder={handleReorderToCart}
            textColor={textColor}
          />
        )}
      />

      {/* Builder-authored marketing sections above the menu (hero, cards, text). */}
      {orderPageSections.length > 0 && (
        <SectionRenderer sections={orderPageSections} restaurant={restaurant} />
      )}

      {/* Transient notice: a reorder that skipped items, a tour action refused. */}
      {notice && (
        <div className="fixed top-16 inset-x-0 z-[75] flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto max-w-[92%] rounded-xl bg-slate-900/90 text-white text-xs leading-relaxed px-4 py-2.5 shadow-lg backdrop-blur-sm">
            {notice}
          </div>
        </div>
      )}

      {/* Restaurant Hero */}
      <RestaurantHero
        restaurant={restaurant}
        orderType={orderType}
        compact
        canSwitchOrderType={canSwitchOrderType}
        onOrderTypeChange={setOrderType}
        onOpenInfo={() => setInfoScreenOpen(true)}
        batchConfig={batchConfig}
        schedulingLabel={
          schedulingIntent
            ? `${formatDateLabel(schedulingIntent.scheduledFor)} · ${schedulingIntent.selectedSlot.start}`
            : undefined
        }
        batchInlineStatus={batchInlineStatus}
        tour={activeTour}
        webOrderChip={
          activeTour
            ? tourChip(true)
            : showOrderChip ? (
                <ModeChip
                  inline
                  orderType={orderType}
                  tableLabel={modeChipTableLabel}
                  onTap={modeChipOnTap}
                />
              ) : undefined
        }
      />

      {/* Order-type chip — a Wolt-style selector showing the service mode (and,
          for dine-in, the table). Clickable to switch via the OrderDetailsModal;
          hidden entirely when the mode is locked to checkout. For batch
          restaurants the fulfilment week lives in the hero info line instead.
          Mobile only: on web the same chip renders inline in the hero's info
          row (passed above as webOrderChip). On a tour page the read-only tour
          chip takes its place on both breakpoints. */}
      {activeTour ? (
        <div className="sm:hidden">{tourChip(false)}</div>
      ) : showOrderChip ? (
        <div className="sm:hidden">
          <ModeChip
            orderType={orderType}
            tableLabel={modeChipTableLabel}
            onTap={modeChipOnTap}
          />
        </div>
      ) : null}

      {/* About / Info screen — slide-in panel triggered by hero "Plus →" */}
      <InfoScreen
        open={infoScreenOpen}
        onClose={() => setInfoScreenOpen(false)}
        restaurant={restaurant}
      />

      {/* Order Details Modal (Wolt-style) */}
      <OrderDetailsModal
        open={orderDetailsOpen}
        onClose={() => setOrderDetailsOpen(false)}
        restaurant={restaurant}
        currency={menu.currency}
        orderType={orderType}
        initialSchedulingIntent={schedulingIntent}
        onConfirm={(newOrderType, intent) => {
          setOrderType(newOrderType);
          setSchedulingIntent(intent);
        }}
      />

      {/* Availability Banner - shows when restaurant is closed */}
      {!isRestaurantOpen && (
        <AvailabilityBanner restaurant={restaurant} serviceType={orderType} />
      )}
      {/* Batch-mode info now lives in the hero pill (RestaurantHero) — keeps
          the page from stacking yet another horizontal band before the menu. */}

      {/* Expired session banner */}
      {isDineIn && tableSession.status === "expired" && (
        <div className="mx-4 mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
          <div className="text-3xl mb-2">⏰</div>
          <h3 className="font-bold text-amber-800">
            {t("sessionEnded") || "This table session has ended"}
          </h3>
          <p className="text-sm text-amber-600 mt-1">
            {t("sessionEndedDesc") || "The table has been closed. You can still browse the menu."}
          </p>
          <button
            onClick={() => router.push(`/r/${restaurant.slug}`)}
            className="mt-3 px-5 py-2 text-sm font-semibold rounded-full text-white hover:opacity-90 transition-opacity"
            style={{ background: "var(--brand)" }}
          >
            {t("backToMenu") || "Back to menu"}
          </button>
        </div>
      )}

      {/* A tour cart carried into a table by localStorage. Neither ordering path
          here can honour it, so both refuse; this is the way out. The cart is
          left intact — it is still a valid delivery order, just not from a table. */}
      {tourCartAtTable && (
        <div className="mx-4 mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
          <p className="flex-1 text-sm text-amber-800 text-start">{t("tourNotAtTable")}</p>
          <button
            onClick={() => useCartStore.getState().clear()}
            className="text-sm font-semibold text-amber-800 hover:opacity-80 whitespace-nowrap"
          >
            {t("tourEmptyCart")}
          </button>
        </div>
      )}

      {/* Entry tab selector — only shown when the restaurant has several cartes.
          Keyed on entryKey. A tour carte is always alone on its dedicated page,
          so tabs never surface a tour. */}
      {entries.length > 1 && (
        <div className="sticky top-12 z-30 overflow-x-auto bg-[var(--surface)] border-b border-[var(--divider)]">
          <div className="flex gap-0 min-w-max">
            {entries.map((m) => (
              <button
                key={m.entryKey}
                onClick={() => selectEntry(m.entryKey)}
                className={`px-5 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${
                  activeEntryKey === m.entryKey
                    ? "border-[var(--brand)] text-[var(--brand)]"
                    : "border-transparent text-[var(--text)] opacity-70 hover:opacity-100"
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Group Navigation - Sticky */}
      <GroupTabs
        groups={groupsWithItems}
        activeId={activeGroup}
        onSelect={handleGroupClick}
        onSearch={setSearchQuery}
        restaurantName={restaurant.name}
      />

      {/* Wolt-style menu translation offer / toggle — rounded card right below
          the categories bar, aligned on the order-type chip rail. Shows only
          when the UI language differs from the menu's source language. */}
      <MenuTranslateBanner />

      {/* Menu Content */}
      <section className="px-4 sm:px-6 lg:px-12 py-6">
        {/* Search Results */}
        {searchQuery && filteredItems && (
          <div className="mb-8">
            <div className="section-header">
              <h2 className="section-title">
                {t("searchResults") || "Search Results"}
              </h2>
              <p className="section-subtitle">
                {filteredItems.length} {t("itemsFound") || "items found"} &quot;{searchQuery}&quot;
              </p>
            </div>
            
            {filteredItems.length > 0 ? (
              <div className={gridClass}>
                {filteredItems.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    layout={menuLayout}
                    onSelect={handleItemClick}
                    isNew={item.tags?.includes("new")}
                    comboEligible={isComboMode && comboEligibleIds.has(item.id)}
                    comboPickCount={comboPicksByItem.get(item.id) || 0}
                    comboInactive={isComboMode && !comboEligibleIds.has(item.id)}
                    onComboRemove={isComboMode ? handleComboItemRemove : undefined}
                    justAdded={justAddedId === item.id}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="w-20 h-20 mx-auto rounded-full bg-[var(--surface-subtle)] flex items-center justify-center mb-4">
                  <svg className="w-10 h-10 text-[var(--text-soft)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="text-[var(--text-muted)] text-lg">
                  {t("noItemsFound") || "No items found"}
                </p>
                <button
                  onClick={() => setSearchQuery("")}
                  className="mt-4 font-medium hover:underline"
                  style={{ color: "var(--brand)" }}
                >
                  {t("clearSearch") || "Clear search"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* All Menu Sections - Scrollable */}
        {!searchQuery && (
          <div>
            {/* Group Sections — banner's own my-6 controls vertical spacing so
                it stays symmetric above and below. */}
            {groupsWithItems.map((group) => {
              const groupItems = itemsByGroup[group.id] ?? [];

              return (
                <div
                  key={group.id}
                  ref={(el) => setSectionRef(group.id, el)}
                  data-group-id={group.id}
                  className="scroll-mt-36"
                >
                  <CategoryBanner
                    name={tField(group, "name", menuLocale)}
                    description={group.description}
                    imageUrl={group.imageUrl}
                    focalX={group.focalX}
                    focalY={group.focalY}
                    design={group.bannerDesign}
                    groupId={group.id}
                  />
                  <div className={gridClass}>
                    {groupItems.map((item) => (
                      <MenuItemCard
                        key={item.id}
                        item={item}
                        layout={menuLayout}
                        onSelect={handleItemClick}
                        isNew={item.tags?.includes("new")}
                        comboEligible={isComboMode && comboEligibleIds.has(item.id)}
                        comboPickCount={comboPicksByItem.get(item.id) || 0}
                        comboInactive={isComboMode && !comboEligibleIds.has(item.id)}
                        onComboRemove={isComboMode ? handleComboItemRemove : undefined}
                        justAdded={justAddedId === item.id}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Site-wide footer — hidden on the order page for customers (it clutters
          the ordering flow and collides with the cart bar; restaurant info lives
          in the hero metadata bar + "Plus" modal instead). Still rendered when
          the builder previews the footer by loading this page in an iframe. */}
      {footerPreviewActive && (
        <SiteFooter restaurant={restaurant} sectionsOverride={footerOverride ?? undefined} />
      )}

      {/* Item Modal */}
      <ItemModal
        item={selectedItem}
        restaurantName={restaurant.name}
        onClose={() => {
          setSelectedItem(null);
          if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            if (url.searchParams.has("item") || url.searchParams.has("lang")) {
              url.searchParams.delete("item");
              url.searchParams.delete("lang");
              window.history.replaceState(null, "", url.pathname + url.search + url.hash);
            }
          }
        }}
        onAdd={handleAddToCart}
      />

      {/* Mixing guard. A tour order and an ordinary one ship on different days, to
          different zones, at different fees: they cannot share a cart, and the
          server rejects the mix. The add waits here until the guest agrees to
          lose what is in the cart. */}
      {pendingTourAdd && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setPendingTourAdd(null)} />
          <div className="relative w-full sm:max-w-sm bg-[var(--surface-elevated)] rounded-t-3xl sm:rounded-2xl shadow-xl p-5 text-start">
            <h3 className="text-lg font-bold text-[var(--text)]">{t("tourSwitchCartTitle")}</h3>
            <p className="text-sm text-[var(--text)] opacity-70 mt-2">{t("tourSwitchCartBody")}</p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setPendingTourAdd(null)}
                className="flex-1 py-3 rounded-full text-sm font-semibold border border-[var(--divider)] text-[var(--text)]"
              >
                {t("cancel")}
              </button>
              <button
                onClick={() => {
                  const { tourId, tourSlug, add } = pendingTourAdd;
                  // Destructive by design, and only ever here: the guest just said yes.
                  useCartStore.getState().setTour(tourId, tourSlug);
                  add();
                  setPendingTourAdd(null);
                  setCartOpen(true);
                }}
                className="flex-1 py-3 rounded-full text-sm font-semibold text-white"
                style={{ background: "var(--brand)" }}
              >
                {t("tourSwitchCartConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Combo Variant Picker — quick bottom sheet to pick a variant when tapping an item with options in combo mode */}
      {comboVariantPicker && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setComboVariantPicker(null)} />
          <div className="relative w-full sm:max-w-sm bg-[var(--surface-elevated)] rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-xl">
            <div className="px-5 pt-5 pb-3">
              <h3 className="text-lg font-bold text-[var(--text)]">
                {comboVariantPicker.item.name}
              </h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                {t("chooseVariant") || "Choose an option"}
              </p>
            </div>
            <div className="px-3 pb-3">
              {(() => {
                const { item, stepItems, stepId, stepName } = comboVariantPicker;
                const allItemOpts = (item.optionSets ?? []).flatMap((os) => os.options ?? []).filter((o) => o.isActive);
                // If step items have specific optionIds, only show those; otherwise show all item options
                const configuredOptionIds = stepItems.filter((si) => si.optionId).map((si) => si.optionId!);
                let visibleOpts = configuredOptionIds.length > 0
                  ? allItemOpts.filter((o) => configuredOptionIds.includes(o.id))
                  : allItemOpts;

                // Per-size caps: only sizes covered by a rule are selectable, and
                // each shows its remaining quota / disables once its max is hit.
                const step = activeCombo?.steps.find((s) => s.id === stepId);
                const rules = step?.variantRules ?? [];
                const ruleFor = (name: string) =>
                  rules.find((r) => normSizeLabel(r.variantLabel) === normSizeLabel(name));
                if (rules.length > 0) {
                  visibleOpts = visibleOpts.filter((o) => !!ruleFor(o.name));
                }

                return visibleOpts.map((opt) => {
                  const si = stepItems.find((s) => s.optionId === opt.id) || stepItems[0];
                  const rule = ruleFor(opt.name);
                  const remaining = rule && rule.maxPicks > 0
                    ? rule.maxPicks * comboMultiplier - batchStepSizePicks(comboSelections, stepId, opt.name)
                    : null;
                  const disabled = remaining != null && remaining <= 0;
                  return (
                    <button
                      key={opt.id}
                      disabled={disabled}
                      onClick={() => {
                        const displayName = `${item.name} - ${opt.name}`;
                        addComboSelectionWithVariant(stepId, stepName, si.menuItemId, si.priceDelta, displayName, opt.id);
                        setComboVariantPicker(null);
                      }}
                      className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl hover:bg-[var(--surface-subtle)] transition-colors text-start disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[var(--text)]">{opt.name}</span>
                        {remaining != null && (
                          <span className="text-xs text-[var(--text-secondary)]">
                            {disabled
                              ? (t("comboSizeFull") || "Limit reached")
                              : (t("comboSizeRemaining") || "{n} left").replace("{n}", String(remaining))}
                          </span>
                        )}
                      </span>
                      <span className="text-sm text-[var(--text-secondary)]">
                        {currencySymbol(menu.currency)}{(opt.onlinePrice ?? opt.price).toFixed(2)}
                      </span>
                    </button>
                  );
                });
              })()}
            </div>
            <div className="px-5 pb-5">
              <button
                onClick={() => setComboVariantPicker(null)}
                className="w-full text-center text-sm font-medium text-[var(--text-secondary)] py-2.5 rounded-xl hover:bg-[var(--surface-subtle)] transition-colors"
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Combo Progress Bar — floating above menu during combo mode */}
      {activeCombo && (
        <ComboProgressBar
          combo={activeCombo}
          currentStepIdx={comboStepIdx}
          selections={comboSelections}
          currency={menu.currency}
          multiplier={comboMultiplier}
          onCancel={cancelCombo}
          onComplete={completeCombo}
          onStepTap={handleComboStepTap}
          offCarteStepItems={offCarteStepItems}
          picksByItem={comboPicksByItem}
          onPickStepItem={(si) =>
            addComboSelectionWithVariant(
              activeCombo.steps[comboStepIdx].id,
              activeCombo.steps[comboStepIdx].name,
              si.menuItemId,
              si.priceDelta,
              si.menuItem?.name ?? '',
              si.optionId ?? null
            )
          }
          onRemoveStepItem={(si) => {
            const step = activeCombo.steps[comboStepIdx];
            if (!step) return;
            setComboSelections((prev) => {
              const existing = prev.find(
                (s) => s.stepId === step.id && s.menuItemId === si.menuItemId
              );
              if (!existing) return prev;
              if (existing.quantity <= 1) {
                return prev.filter(
                  (s) => !(s.stepId === step.id && s.menuItemId === si.menuItemId)
                );
              }
              return prev.map((s) =>
                s.stepId === step.id && s.menuItemId === si.menuItemId
                  ? { ...s, quantity: s.quantity - 1 }
                  : s
              );
            });
          }}
        />
      )}

      {/* Unified combo entry modal — hero image + description, then a body that
          differs by combo shape: fixed combos show "What's included" + Add to
          cart; custom combos show a step preview + "Build your combo" which
          launches the step drawer. Front door for every combo tap. */}
      <ComboDetailsModal
        combo={detailsCombo}
        currency={menu.currency}
        onClose={() => setDetailsCombo(null)}
        onStartCustom={startCombo}
        onAddFixed={addFixedCombos}
      />

      {/* Flying item ghosts — animate from the tapped card into the count badge. */}
      <AnimatePresence>
        {flyGhosts.map((g) => (
          <motion.img
            key={g.key}
            src={g.src}
            alt=""
            aria-hidden
            initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
            animate={{ x: g.dx, y: g.dy, scale: 0.18, opacity: 0 }}
            transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
            onAnimationComplete={() =>
              setFlyGhosts((arr) => arr.filter((x) => x.key !== g.key))
            }
            style={{
              position: "fixed",
              left: g.left,
              top: g.top,
              width: g.width,
              height: g.height,
              borderRadius: 12,
              objectFit: "cover",
              zIndex: 75,
              pointerEvents: "none",
            }}
          />
        ))}
      </AnimatePresence>

      {/* Cart Drawer */}
      {/* A tour sets its own minimum, and the checkout already judges the cart
          against it. The drawer must quote the same number, or it green-lights a
          cart the next screen turns away. */}
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        currency={menu.currency}
        onCheckout={startCheckout}
        minimumOrderDelivery={cartTour?.minOrder ?? restaurant.minimumOrderDelivery ?? 0}
        orderType={orderType}
        previewMode={isDatePreview}
        {...(isDineInNoPrepay ? {
          confirmLabel: t("sendToKitchen") || "Send to kitchen",
          onConfirmOrder: placeOrderDirect,
          isSubmitting: isPlacingOrder,
          successState: cartSuccess,
        } : {})}
      />

      {/* Session bar (dine-in only). Two parts with very different jobs:
            • Presence strip (always while session is active) — table identity,
              who's at the table, what's been sent. Small, neutral, secondary.
            • Cart bar (when items in cart) — big brand-color CTA. The single
              primary action whenever the cart has anything.
          The visual weight contrast ("small gray = context, big colored =
          action") is what removes the "what's the cart, what's the table"
          confusion. Replaces the legacy top TableContextBar and bar-bottom
          floating cart. */}
      {isDineInSessionActive && (
        <SessionBar
          currency={menu.currency}
          onOpenTable={() => setTableDrawerOpen(true)}
          onOpenCart={() => isRestaurantOpen && setCartOpen(true)}
          flyTrigger={confirmedTick}
          disabled={!isRestaurantOpen}
        />
      )}

      {/* Status-change toast — fires for own-order intermediate transitions
          (accepted, in_kitchen). The "ready" transition keeps the existing
          full-screen DineInOrderReadyPopup, which is a heavier signal. */}
      {isDineIn && <SessionToast />}

      {/* Floating Cart Button (hidden when item modal, order‑details modal,
          combo mode, or the dine-in SessionBar is active) */}
      {totalItems > 0 && !cartOpen && !selectedItem && !isComboMode && !orderDetailsOpen && !isDineInSessionActive && (
        cartStyle === "fab-right" ? (
          <button
            onClick={() => isRestaurantOpen && setCartOpen(true)}
            disabled={!isRestaurantOpen}
            className={`fixed bottom-[calc(1.5rem+var(--bottomnav-h))] right-6 rtl:right-auto rtl:left-6 z-50 w-14 h-14 rounded-full text-white shadow-lg flex items-center justify-center ${!isRestaurantOpen ? "opacity-50 cursor-not-allowed" : "hover:scale-105 active:scale-95"} transition-transform`}
            style={{ background: "var(--brand)" }}
            title={!isRestaurantOpen ? "Restaurant is currently closed" : ""}
          >
            <div className="relative">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
              </svg>
              <span
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white text-xs font-bold flex items-center justify-center"
                style={{ color: "var(--brand)" }}
              >
                {totalItems}
              </span>
            </div>
          </button>
        ) : cartStyle === "tab-right" ? (
          <button
            onClick={() => isRestaurantOpen && setCartOpen(true)}
            disabled={!isRestaurantOpen}
            className={`fixed top-1/2 -translate-y-1/2 right-0 rtl:right-auto rtl:left-0 z-50 text-white py-4 px-2 rounded-l-xl rtl:rounded-l-none rtl:rounded-r-xl shadow-lg flex flex-col items-center gap-1 ${!isRestaurantOpen ? "opacity-50 cursor-not-allowed" : "hover:px-3"} transition-all`}
            style={{ background: "var(--brand)" }}
            title={!isRestaurantOpen ? "Restaurant is currently closed" : ""}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
            </svg>
            <span className="text-xs font-bold">{totalItems}</span>
            <span className="text-[10px] font-medium">{currencySymbol(menu.currency)}{totalAmount.toFixed(2)}</span>
          </button>
        ) : (
          /* Default: bar-bottom — docked, opaque footer (Wolt-style) that
             stays flush to the bottom edge so menu content scrolls underneath
             and never overlaps it. */
          <div className="cart-dock">
            <button
              onClick={() => isRestaurantOpen && setCartOpen(true)}
              disabled={!isRestaurantOpen}
              className={`cart-dock-button ${!isRestaurantOpen ? "opacity-50 cursor-not-allowed" : ""}`}
              title={!isRestaurantOpen ? "Restaurant is currently closed" : ""}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-white/20 text-white text-sm font-bold flex items-center justify-center">
                    {totalItems}
                  </span>
                  <span className="font-bold">{t("showItems") || "Show items"}</span>
                </div>
                <span className="font-bold">{currencySymbol(menu.currency)}{totalAmount.toFixed(2)}</span>
              </div>
            </button>
          </div>
        )
      )}

      {/* AI ordering assistant launcher — placed opposite the cart, lifted
          above the bottom cart dock when it's showing so they never overlap. */}
      {/* The launcher stays put on a tour carte, muted: a button that simply
          vanished would read as a bug. It is NOT aria-disabled — it still does
          something, namely say why the assistant cannot take this order. Marking
          it disabled would promise silence to a screen reader and then talk. */}
      {restaurant.aiAssistantEnabled && !selectedItem && !isComboMode && !orderDetailsOpen && !aiOpen && (
        <button
          onClick={() => (aiBlockedByTour ? flashNotice(t("tourAiUnavailable")) : setAiOpen(true))}
          className={`fixed left-6 rtl:left-auto rtl:right-6 z-50 w-14 h-14 rounded-full text-white shadow-lg flex items-center justify-center transition-transform ${
            aiBlockedByTour ? "opacity-40" : "hover:scale-105 active:scale-95"
          } ${
            (totalItems > 0 && cartStyle === "bar-bottom") || isDineInSessionActive
              ? "bottom-[calc(6rem+var(--bottomnav-h))]"
              : "bottom-[calc(1.5rem+var(--bottomnav-h))]"
          }`}
          style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-dark, var(--brand)))" }}
          aria-label={
            aiBlockedByTour ? t("tourAiUnavailable") : t("aiAssistant") || "AI ordering assistant"
          }
        >
          <span className="text-2xl leading-none">✨</span>
        </button>
      )}

      {restaurant.aiAssistantEnabled && !aiBlockedByTour && (
        <AIProactivePrompt
          open={aiNudgeOpen && !aiOpen && !selectedItem && !isComboMode && !orderDetailsOpen}
          restaurantName={restaurant.name}
          onAccept={() => {
            setAiNudgeOpen(false);
            setAiOpen(true);
          }}
          onDismiss={() => setAiNudgeOpen(false)}
        />
      )}

      <AIOrderAssistant
        open={aiOpen && !aiBlockedByTour}
        onClose={() => setAiOpen(false)}
        restaurantId={restaurantId}
        restaurantName={restaurant.name}
        orderType={orderType}
        currency={menu.currency}
        menuId={activeMenuId ?? undefined}
        visibleItemIds={visibleItemIds}
        combos={aiCombos}
      />

      {/* Table Session - Guest Join Modal */}
      {isDineIn && (
        <GuestJoinModal
          open={showGuestJoin}
          onJoin={async (name, emoji) => {
            await tableSession.joinSession(name, emoji);
            setShowGuestJoin(false);
          }}
        />
      )}

      {/* Table Session - Drawer */}
      {isDineIn && (
        <TableDrawer
          open={tableDrawerOpen}
          onClose={() => setTableDrawerOpen(false)}
          showPayButton={!restaurant.requireDineInPrepayment}
          onPayNow={() => {
            setTableDrawerOpen(false);
            setPaymentModeOpen(true);
          }}
          menuItems={menu.items}
          serviceMode={restaurant.serviceMode}
        />
      )}

      {/* Payment Mode Selection Sheet */}
      {isDineIn && (
        <PaymentModeSheet
          open={paymentModeOpen}
          onClose={() => setPaymentModeOpen(false)}
          isLoading={isPaymentLoading}
          tipsEnabled={restaurant.tipsEnabled ?? true}
          myUnpaidTotal={
            tableSession.orders
              .filter((o) => o.guest_id === tableSession.guestId && o.payment_status !== "paid" && !["served", "cancelled", "rejected"].includes(o.status))
              .reduce((sum, o) => sum + (o.total_amount || 0), 0)
          }
          tableTotal={
            tableSession.orders
              .filter((o) => o.payment_status !== "paid" && !["served", "cancelled", "rejected"].includes(o.status))
              .reduce((sum, o) => sum + (o.total_amount || 0), 0)
          }
          guestCount={tableSession.guests.length}
          onConfirm={async (mode: SessionPaymentMode, splitCount?: number, tipAmount?: number) => {
            if (!sessionId) return;
            setIsPaymentLoading(true);
            try {
              const result = await initSessionPayment(sessionId, restaurantId, {
                mode,
                guestId: tableSession.guestId || undefined,
                splitCount,
                tipAmount,
              });
              if (result.paymentUrl) {
                window.location.href = result.paymentUrl;
              } else if (result.error) {
                console.error("Payment error:", result.error);
              }
            } catch (e) {
              console.error("Failed to initiate session payment:", e);
            } finally {
              setIsPaymentLoading(false);
            }
          }}
        />
      )}

      {/* Order-ready popup for dine-in (fires via WebSocket even when drawer is closed) */}
      {isDineIn && <DineInOrderReadyPopup />}

      {/* Navigation Drawer */}
      <NavigationDrawer
        open={navDrawerOpen}
        onClose={() => setNavDrawerOpen(false)}
        restaurant={restaurant}
        currency={menu.currency}
        onReorder={handleReorderToCart}
      />

      {/* Mobile bottom navigation (Menu · Stories · Cart · Orders). Hidden during
          an active dine-in session so it never collides with the SessionBar. */}
      {shoppingSide.bottom_bar && !isDineInSessionActive && (
        <BottomNav slug={restaurant.slug || String(restaurant.id)} active="menu" />
      )}
      {/* Spacer so the last menu items can scroll clear of the fixed bottom nav. */}
      {shoppingSide.bottom_bar && (
        <div className="md:hidden" style={{ height: "var(--bottomnav-h)" }} aria-hidden />
      )}
    </main>
  );
}
