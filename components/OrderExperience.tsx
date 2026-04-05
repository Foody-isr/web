"use client";

import { GroupTabs, POPULAR_GROUP_ID } from "@/components/CategoryTabs";
import { CartDrawer } from "@/components/CartDrawer";
import { ComboCard } from "@/components/ComboCard";
import { ComboProgressBar } from "@/components/ComboProgressBar";
import { GuestJoinModal } from "@/components/GuestJoinModal";
import { ItemModal } from "@/components/ItemModal";
import { MenuItemCard } from "@/components/MenuItemCard";
import { QRScanner } from "@/components/QRScanner";
import { RestaurantHero } from "@/components/RestaurantHero";
import { TableContextBar } from "@/components/TableContextBar";
import { TableDrawer } from "@/components/TableDrawer";
import { PaymentModeSheet } from "@/components/PaymentModeSheet";
import { DineInOrderReadyPopup } from "@/components/DineInOrderReadyPopup";
import { TopBar } from "@/components/TopBar";
import { NavigationDrawer } from "@/components/NavigationDrawer";
import { AvailabilityBanner } from "@/components/AvailabilityBanner";
import { OrderDetailsModal, SchedulingIntent } from "@/components/OrderDetailsModal";
import { formatDateLabel } from "@/lib/scheduling";
import { useI18n } from "@/lib/i18n";
import { useRestaurantTheme } from "@/lib/restaurant-theme";
import { currencySymbol } from "@/lib/constants";
import { checkAvailability } from "@/lib/availability";
import { MenuItem, MenuResponse, OrderType, Restaurant, ComboMenu, ComboCartSelection } from "@/lib/types";
import { useCartStore } from "@/store/useCartStore";
import { useTableSession } from "@/store/useTableSession";
import { createOrder, fetchCombos, initSessionPayment } from "@/services/api";
import { OrderPayload } from "@/lib/types";
import { SessionPaymentMode } from "@/services/api";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Props = {
  menu: MenuResponse;
  restaurant: Restaurant;
  initialOrderType: OrderType;
  tableId?: string;
  sessionId?: string;
};

export function OrderExperience({ menu, restaurant, initialOrderType, tableId, sessionId }: Props) {
  const router = useRouter();
  const { t, direction } = useI18n();
  const setContext = useCartStore((s) => s.setContext);
  const addItem = useCartStore((s) => s.addItem);
  const addCombo = useCartStore((s) => s.addCombo);
  const lines = useCartStore((s) => s.lines);
  const total = useCartStore((s) => s.total);

  const restaurantId = String(restaurant.id);

  // Menu layout & cart style from website config
  const { config: themeConfig } = useRestaurantTheme();
  const menuLayout = themeConfig?.menuLayout || "list";
  const cartStyle = themeConfig?.cartStyle || "bar-bottom";
  const gridClass = menuLayout === "grid"
    ? "grid grid-cols-2 lg:grid-cols-3 gap-3"
    : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4";

  // Theme is controlled by RestaurantThemeProvider via websiteConfig.themeMode

  // Table session state (for dine-in)
  const isDineIn = initialOrderType === "dine_in";
  const tableSession = useTableSession();
  const [showGuestJoin, setShowGuestJoin] = useState(false);
  const [tableDrawerOpen, setTableDrawerOpen] = useState(false);
  const [paymentModeOpen, setPaymentModeOpen] = useState(false);
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);

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

  // QR scanner state
  const [qrScannerOpen, setQrScannerOpen] = useState(false);

  // Order Details modal
  const [orderDetailsOpen, setOrderDetailsOpen] = useState(false);
  const [schedulingIntent, setSchedulingIntent] = useState<SchedulingIntent | null>(null);

  // Check what order types are enabled (not necessarily open)
  const pickupEnabled = restaurant.pickupEnabled;
  const deliveryEnabled = restaurant.deliveryEnabled;

  // Allow switching if not dine-in and both pickup and delivery are enabled
  // (User can switch to see that a service is closed)
  const canSwitchOrderType = initialOrderType !== "dine_in" && pickupEnabled && deliveryEnabled;

  // Check if restaurant is open for current order type
  const currentAvailability = checkAvailability(
    restaurant.openingHoursConfig,
    orderType,
    restaurant.timezone || "UTC"
  );
  const isRestaurantOpen = currentAvailability.isOpen && !restaurant.rushMode;

  useEffect(() => {
    setContext(restaurantId, menu.currency);
  }, [restaurantId, menu.currency, setContext]);

  // Stable ref for handleGroupClick — lets earlier-declared callbacks
  // (startCombo) call it without running into block-scope ordering issues.
  const groupClickRef = useRef<(id: string) => void>(() => {});

  // Combo state — browse-to-build mode
  const [combos, setCombos] = useState<ComboMenu[]>([]);
  const [activeCombo, setActiveCombo] = useState<ComboMenu | null>(null);
  const [comboStepIdx, setComboStepIdx] = useState(0);
  const [comboSelections, setComboSelections] = useState<ComboCartSelection[]>([]);
  // When true, the auto-advance effect skips one cycle (user manually tapped a step pill)
  const manualStepNav = useRef(false);

  useEffect(() => {
    fetchCombos(restaurantId).then(setCombos).catch(() => setCombos([]));
  }, [restaurantId]);

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

  const startCombo = useCallback((combo: ComboMenu) => {
    setActiveCombo(combo);
    setComboStepIdx(0);
    setComboSelections([]);

    // Scroll to the group of the first step's eligible items
    const firstStep = combo.steps[0];
    if (firstStep && firstStep.items.length > 0) {
      const eligibleIds = new Set(firstStep.items.map((si) => String(si.menuItemId)));
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
        // Delay so React renders the combo-mode UI (eligible highlights) first
        setTimeout(() => groupClickRef.current(bestCat), 100);
      }
    }
  }, [menu.items]);

  const cancelCombo = useCallback(() => {
    setActiveCombo(null);
    setComboStepIdx(0);
    setComboSelections([]);
  }, []);

  const handleComboItemTap = useCallback(
    (item: MenuItem) => {
      if (!activeCombo) return;
      const step = activeCombo.steps[comboStepIdx];
      if (!step) return;

      // Find the ComboStepItem to get priceDelta
      const stepItem = step.items.find((si) => String(si.menuItemId) === item.id);
      if (!stepItem) return;

      // Check if we're already at maxPicks
      const stepTotalPicks = comboSelections
        .filter((s) => s.stepId === step.id)
        .reduce((sum, s) => sum + s.quantity, 0);
      if (stepTotalPicks >= step.maxPicks) return; // full

      // Add or increment
      setComboSelections((prev) => {
        const existing = prev.find(
          (s) => s.stepId === step.id && s.menuItemId === stepItem.menuItemId
        );
        if (existing) {
          return prev.map((s) =>
            s.stepId === step.id && s.menuItemId === stepItem.menuItemId
              ? { ...s, quantity: s.quantity + 1 }
              : s
          );
        }
        return [
          ...prev,
          {
            stepId: step.id,
            stepName: step.name,
            menuItemId: stepItem.menuItemId,
            menuItemName: item.name,
            quantity: 1,
            priceDelta: stepItem.priceDelta,
          },
        ];
      });

    },
    [activeCombo, comboStepIdx, comboSelections]
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
    [activeCombo, comboStepIdx]
  );

  const completeCombo = useCallback(() => {
    if (!activeCombo) return;
    addCombo(activeCombo.id, activeCombo.name, activeCombo.price, comboSelections);
    cancelCombo();
  }, [activeCombo, comboSelections, addCombo, cancelCombo]);

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

      // Combo-type items → enter combo mode (reuse existing step-by-step UX)
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
        };
        startCombo(asComboMenu);
        return;
      }

      // No customization → add directly to cart without opening modal
      const hasCustomization =
        (item.modifiers && item.modifiers.length > 0) ||
        (item.modifierSets && item.modifierSets.length > 0) ||
        (item.optionSets && item.optionSets.length > 0);
      if (!hasCustomization) {
        addItem(item, 1);
        setJustAddedId(item.id);
        return;
      }

      setSelectedItem(item);
    },
    [isComboMode, comboEligibleIds, handleComboItemTap, addItem, startCombo]
  );

  // Multi-menu support: track which menu is active (null = all menus merged)
  const [activeMenuId, setActiveMenuId] = useState<number | null>(
    menu.menus?.length > 0 ? menu.menus[0].id : null
  );

  // Derive groups + items for the currently selected menu (groups replace legacy categories)
  const activeMenuGroups = useMemo(() => {
    if (!menu.menus?.length || activeMenuId === null) return menu.categories;
    const found = menu.menus.find((m) => m.id === activeMenuId);
    return found?.groups ?? found?.categories ?? menu.categories;
  }, [menu.menus, menu.categories, activeMenuId]);

  const activeMenuItems = useMemo(() => {
    if (!menu.menus?.length || activeMenuId === null) return menu.items;
    return menu.menus.find((m) => m.id === activeMenuId)?.items ?? menu.items;
  }, [menu.menus, menu.items, activeMenuId]);

  const [activeGroup, setActiveGroup] = useState(POPULAR_GROUP_ID);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isScrolling, setIsScrolling] = useState(false);
  const [justAddedId, setJustAddedId] = useState<string | number | null>(null);

  // Auto-clear the "just added" flash after animation completes
  useEffect(() => {
    if (justAddedId == null) return;
    const t = setTimeout(() => setJustAddedId(null), 1200);
    return () => clearTimeout(t);
  }, [justAddedId]);

  // Refs for group sections
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Simulated popular items (in real app, this would come from API)
  const popularItemIds = useMemo(() => {
    return activeMenuItems.slice(0, 6).map((item) => item.id);
  }, [activeMenuItems]);

  const popularItems = useMemo(() => {
    return activeMenuItems.filter((item) => popularItemIds.includes(item.id));
  }, [activeMenuItems, popularItemIds]);

  const itemsByGroup = useMemo(
    () =>
      activeMenuItems.reduce<Record<string, MenuItem[]>>((acc, item) => {
        acc[item.groupId] = acc[item.groupId] ? [...acc[item.groupId], item] : [item];
        return acc;
      }, {}),
    [activeMenuItems]
  );

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!searchQuery) return null;
    const query = searchQuery.toLowerCase();
    return activeMenuItems.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query)
    );
  }, [activeMenuItems, searchQuery]);

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

    if (picks >= step.maxPicks) {
      const nextIdx = comboStepIdx + 1;
      if (nextIdx < activeCombo.steps.length) {
        const timer = setTimeout(() => {
          setComboStepIdx(nextIdx);
          scrollToStepGroup(nextIdx);
        }, 350);
        return () => clearTimeout(timer);
      }
    }
  }, [activeCombo, comboStepIdx, comboSelections, scrollToStepGroup]);

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
    addItem(item, quantity, note, modifiers, selectedVariantId, selectedVariantName, selectedVariantPrice);
  };

  // Direct dine-in order (no prepayment) — skip checkout entirely
  const isDineInNoPrepay = isDineIn && !restaurant.requireDineInPrepayment;
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  const placeOrderDirect = async () => {
    if (isPlacingOrder || lines.length === 0) return;
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
          comboMenuId: line.comboId!,
          selections: line.comboSelections!.map((sel) => ({
            stepId: sel.stepId,
            menuItemId: sel.menuItemId,
            quantity: sel.quantity,
          })),
        })),
        paymentMethod: "pay_later",
        paymentRequired: false,
      };

      await createOrder(payload);
      useCartStore.getState().clear();
      setCartOpen(false);

      // Refresh table session so other guests see the new order
      if (sessionId) {
        await useTableSession.getState().refreshOrders();
      }

      // Open table drawer so the customer sees their order
      setTableDrawerOpen(true);
    } catch (err: any) {
      alert(err?.message || "Failed to place order");
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const startCheckout = () => {
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
    router.push(`/order/checkout?${checkoutParams.toString()}`);
  };

  const totalAmount = total();
  const totalItems = lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <main className="min-h-screen bg-[var(--bg-page)] pb-32" dir={direction}>
      {/* Top Bar - Sticky with transparent/solid transition */}
      <TopBar restaurant={restaurant} onMenuToggle={() => setNavDrawerOpen(true)} />

      {/* Restaurant Hero */}
      <RestaurantHero
        restaurant={restaurant}
        orderType={orderType}
        compact
        canSwitchOrderType={canSwitchOrderType}
        onOrderTypeChange={setOrderType}
        onOpenOrderDetails={isDineIn ? undefined : () => setOrderDetailsOpen(true)}
        schedulingLabel={
          schedulingIntent
            ? `${formatDateLabel(schedulingIntent.scheduledFor)} · ${schedulingIntent.selectedSlot.start}`
            : undefined
        }
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
        onScanQR={!isDineIn ? () => setQrScannerOpen(true) : undefined}
      />

      {/* Availability Banner - shows when restaurant is closed */}
      {!isRestaurantOpen && (
        <AvailabilityBanner restaurant={restaurant} serviceType={orderType} />
      )}

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
            className="mt-3 px-5 py-2 text-sm font-semibold rounded-full bg-brand text-white hover:opacity-90 transition-opacity"
          >
            {t("backToMenu") || "Back to menu"}
          </button>
        </div>
      )}

      {/* Table Context Bar - shows for dine-in when session is active */}
      {isDineIn && tableSession.status === "active" && (
        <TableContextBar onOpenDrawer={() => setTableDrawerOpen(true)} />
      )}

      {/* Menu tab selector — only shown when restaurant has multiple menus */}
      {menu.menus?.length > 1 && (
        <div className="sticky top-12 z-30 overflow-x-auto bg-[var(--surface)] border-b border-[var(--divider)]">
          <div className="flex gap-0 min-w-max">
            {menu.menus.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setActiveMenuId(m.id);
                  setActiveGroup(POPULAR_GROUP_ID);
                  setSearchQuery("");
                }}
                className={`px-5 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${
                  activeMenuId === m.id
                    ? "border-[var(--brand)] text-[var(--brand)]"
                    : "border-transparent text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]"
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
        showPopular
        onSearch={setSearchQuery}
        restaurantName={restaurant.name}
      />

      {/* Menu Content */}
      <section className="px-4 sm:px-6 py-6">
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
                    isPopular={popularItemIds.includes(item.id)}
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
                  className="mt-4 text-brand font-medium hover:underline"
                >
                  {t("clearSearch") || "Clear search"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* All Menu Sections - Scrollable */}
        {!searchQuery && (
          <div className="space-y-12">
            {/* Combo / Set Menu Section */}
            {combos.length > 0 && (
              <div className="scroll-mt-36">
                <div className="section-header">
                  <h2 className="section-title flex items-center gap-2">
                    <span>🍽️</span>
                    <span>{t("comboDeals") || "Combo Deals"}</span>
                  </h2>
                  <p className="section-subtitle">
                    {t("comboDealsSubtitle") || "Great value set menus"}
                  </p>
                </div>
                <div className={gridClass}>
                  {combos.map((combo) => (
                    <ComboCard
                      key={combo.id}
                      combo={combo}
                      currency={menu.currency}
                      onSelect={startCombo}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Popular Section */}
            {popularItems.length > 0 && (
              <div
                ref={(el) => setSectionRef(POPULAR_GROUP_ID, el)}
                data-group-id={POPULAR_GROUP_ID}
                className="scroll-mt-36"
              >
                <div className="section-header">
                  <h2 className="section-title flex items-center gap-2">
                    <span>⭐</span>
                    <span>{t("popular") || "Most ordered"}</span>
                  </h2>
                  <p className="section-subtitle">
                    {t("popularSubtitle") || "Our most loved dishes"}
                  </p>
                </div>
                <div className={gridClass}>
                  {popularItems.map((item) => (
                    <MenuItemCard
                      key={item.id}
                      item={item}
                      layout={menuLayout}
                      onSelect={handleItemClick}
                      isPopular
                      comboEligible={isComboMode && comboEligibleIds.has(item.id)}
                      comboPickCount={comboPicksByItem.get(item.id) || 0}
                      comboInactive={isComboMode && !comboEligibleIds.has(item.id)}
                      onComboRemove={isComboMode ? handleComboItemRemove : undefined}
                      justAdded={justAddedId === item.id}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Group Sections */}
            {groupsWithItems.map((group) => {
              const groupItems = itemsByGroup[group.id] ?? [];

              return (
                <div
                  key={group.id}
                  ref={(el) => setSectionRef(group.id, el)}
                  data-group-id={group.id}
                  className="scroll-mt-36"
                >
                  <div className="section-header">
                    <h2 className="section-title">{group.name}</h2>
                    {group.description && (
                      <p className="section-subtitle">{group.description}</p>
                    )}
                  </div>
                  <div className={gridClass}>
                    {groupItems.map((item) => (
                      <MenuItemCard
                        key={item.id}
                        item={item}
                        layout={menuLayout}
                        onSelect={handleItemClick}
                        isPopular={popularItemIds.includes(item.id)}
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

      {/* Item Modal */}
      <ItemModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onAdd={handleAddToCart}
      />


      {/* Combo Progress Bar — floating above menu during combo mode */}
      {activeCombo && (
        <ComboProgressBar
          combo={activeCombo}
          currentStepIdx={comboStepIdx}
          selections={comboSelections}
          currency={menu.currency}
          onCancel={cancelCombo}
          onComplete={completeCombo}
          onStepTap={handleComboStepTap}
        />
      )}

      {/* Cart Drawer */}
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        currency={menu.currency}
        onCheckout={startCheckout}
        minimumOrderDelivery={restaurant.minimumOrderDelivery ?? 0}
        orderType={orderType}
        {...(isDineInNoPrepay ? {
          confirmLabel: t("confirmAndOrder") || "Confirm Order",
          onConfirmOrder: placeOrderDirect,
          isSubmitting: isPlacingOrder,
        } : {})}
      />

      {/* Floating Cart Button (hidden when item modal, order‑details modal, or combo mode is active) */}
      {totalItems > 0 && !cartOpen && !selectedItem && !isComboMode && !orderDetailsOpen && (
        cartStyle === "fab-right" ? (
          <button
            onClick={() => isRestaurantOpen && setCartOpen(true)}
            disabled={!isRestaurantOpen}
            className={`fixed bottom-6 right-6 rtl:right-auto rtl:left-6 z-50 w-14 h-14 rounded-full bg-brand text-white shadow-lg flex items-center justify-center ${!isRestaurantOpen ? "opacity-50 cursor-not-allowed" : "hover:scale-105 active:scale-95"} transition-transform`}
            title={!isRestaurantOpen ? "Restaurant is currently closed" : ""}
          >
            <div className="relative">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
              </svg>
              <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white text-brand text-xs font-bold flex items-center justify-center">
                {totalItems}
              </span>
            </div>
          </button>
        ) : cartStyle === "tab-right" ? (
          <button
            onClick={() => isRestaurantOpen && setCartOpen(true)}
            disabled={!isRestaurantOpen}
            className={`fixed top-1/2 -translate-y-1/2 right-0 rtl:right-auto rtl:left-0 z-50 bg-brand text-white py-4 px-2 rounded-l-xl rtl:rounded-l-none rtl:rounded-r-xl shadow-lg flex flex-col items-center gap-1 ${!isRestaurantOpen ? "opacity-50 cursor-not-allowed" : "hover:px-3"} transition-all`}
            title={!isRestaurantOpen ? "Restaurant is currently closed" : ""}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
            </svg>
            <span className="text-xs font-bold">{totalItems}</span>
            <span className="text-[10px] font-medium">{currencySymbol(menu.currency)}{totalAmount.toFixed(2)}</span>
          </button>
        ) : (
          /* Default: bar-bottom */
          <button
            onClick={() => isRestaurantOpen && setCartOpen(true)}
            disabled={!isRestaurantOpen}
            className={`floating-cart ${!isRestaurantOpen ? "opacity-50 cursor-not-allowed" : ""}`}
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
        )
      )}

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
      />

      {/* QR Scanner overlay */}
      <QRScanner
        open={qrScannerOpen}
        onClose={() => setQrScannerOpen(false)}
        restaurantId={restaurantId}
      />
    </main>
  );
}
