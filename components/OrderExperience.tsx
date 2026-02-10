"use client";

import { CategoryTabs, POPULAR_CATEGORY_ID } from "@/components/CategoryTabs";
import { CartDrawer } from "@/components/CartDrawer";
import { ItemModal } from "@/components/ItemModal";
import { MenuItemCard } from "@/components/MenuItemCard";
import { PaymentSheet } from "@/components/PaymentSheet";
import { SplitPayment } from "@/components/SplitPayment";
import { RestaurantHero } from "@/components/RestaurantHero";
import { TopBar } from "@/components/TopBar";
import { useI18n } from "@/lib/i18n";
import { MenuItem, MenuResponse, OrderPayload, OrderType, Restaurant } from "@/lib/types";
import { useCartStore } from "@/store/useCartStore";
import { createOrder } from "@/services/api";
import { useMutation } from "@tanstack/react-query";
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
  const lines = useCartStore((s) => s.lines);
  const total = useCartStore((s) => s.total);

  const restaurantId = String(restaurant.id);

  // For dine-in, order type is fixed. For pickup/delivery, allow switching
  const [orderType, setOrderType] = useState<OrderType>(initialOrderType);

  // Check what order types are available
  const canPickup = restaurant.pickupEnabled;
  const canDelivery = restaurant.deliveryEnabled;
  const canSwitchOrderType = initialOrderType !== "dine_in" && canPickup && canDelivery;

  useEffect(() => {
    setContext(restaurantId, menu.currency);
  }, [restaurantId, menu.currency, setContext]);

  const [activeCategory, setActiveCategory] = useState(POPULAR_CATEGORY_ID);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);
  const [showSplit, setShowSplit] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isScrolling, setIsScrolling] = useState(false);

  // Refs for category sections
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Simulated popular items (in real app, this would come from API)
  const popularItemIds = useMemo(() => {
    return menu.items.slice(0, 6).map((item) => item.id);
  }, [menu.items]);

  const popularItems = useMemo(() => {
    return menu.items.filter((item) => popularItemIds.includes(item.id));
  }, [menu.items, popularItemIds]);

  const itemsByCategory = useMemo(
    () =>
      menu.items.reduce<Record<string, MenuItem[]>>((acc, item) => {
        acc[item.categoryId] = acc[item.categoryId] ? [...acc[item.categoryId], item] : [item];
        return acc;
      }, {}),
    [menu.items]
  );

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!searchQuery) return null;
    const query = searchQuery.toLowerCase();
    return menu.items.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query)
    );
  }, [menu.items, searchQuery]);

  // Set up section ref
  const setSectionRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) {
      sectionRefs.current.set(id, el);
    } else {
      sectionRefs.current.delete(id);
    }
  }, []);

  // Handle category click - scroll to section
  const handleCategoryClick = useCallback((categoryId: string) => {
    setIsScrolling(true);
    setActiveCategory(categoryId);
    setSearchQuery("");

    const section = sectionRefs.current.get(categoryId);
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

  // Categories with items (filter empty categories)
  const categoriesWithItems = useMemo(() => {
    return menu.categories.filter((cat) => (itemsByCategory[cat.id]?.length ?? 0) > 0);
  }, [menu.categories, itemsByCategory]);

  // Set up intersection observer for scroll-based category selection
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
          const id = entry.target.getAttribute("data-category-id");
          if (id) {
            setActiveCategory(id);
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
  }, [searchQuery, isScrolling, categoriesWithItems]);

  const mutation = useMutation({
    mutationFn: async ({
      splitByItemIds
    }: {
      splitByItemIds?: string[];
    }) => {
      const payload: OrderPayload = {
        restaurantId,
        tableId,
        sessionId,
        orderType,
        items: lines.map((line) => ({
          itemId: line.item.id,
          quantity: line.quantity,
          note: line.note,
          modifiers: line.modifiers?.map((modifier) => ({
            modifierId: modifier.id,
            applied: true
          }))
        })),
        paymentMethod: "pay_now",
        paymentRequired: true,
        splitByItemIds
      };
      return createOrder(payload);
    },
    onSuccess: (data) => {
      useCartStore.getState().clear();
      
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        const qs = `?restaurantId=${restaurantId}${tableId ? `&tableId=${tableId}` : ""}`;
        router.push(`/order/tracking/${data.orderId}${qs}`);
      }
    }
  });

  const handleAddToCart = (
    item: MenuItem,
    quantity: number,
    note?: string,
    modifiers?: MenuItem["modifiers"]
  ) => {
    addItem(item, quantity, note, modifiers);
    setCartOpen(true);
  };

  const startCheckout = () => {
    if (orderType !== "dine_in") {
      const checkoutParams = new URLSearchParams({
        restaurantId,
        orderType,
        ...(tableId && { tableId }),
        ...(sessionId && { sessionId }),
      });
      router.push(`/order/checkout?${checkoutParams.toString()}`);
      return;
    }
    setShowPaymentSheet(true);
  };

  const totalAmount = total();
  const totalItems = lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <main className="min-h-screen bg-[var(--bg-page)] pb-32" dir={direction}>
      {/* Top Bar - Sticky with transparent/solid transition */}
      <TopBar />

      {/* Restaurant Hero */}
      <RestaurantHero
        restaurant={restaurant}
        orderType={orderType}
        tableId={tableId}
        compact
        canSwitchOrderType={canSwitchOrderType}
        onOrderTypeChange={setOrderType}
      />

      {/* Category Navigation - Sticky */}
      <CategoryTabs
        categories={categoriesWithItems}
        activeId={activeCategory}
        onSelect={handleCategoryClick}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredItems.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    onSelect={setSelectedItem}
                    isPopular={popularItemIds.includes(item.id)}
                    isNew={item.tags?.includes("new")}
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
            {/* Popular Section */}
            {popularItems.length > 0 && (
              <div
                ref={(el) => setSectionRef(POPULAR_CATEGORY_ID, el)}
                data-category-id={POPULAR_CATEGORY_ID}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {popularItems.map((item) => (
                    <MenuItemCard
                      key={item.id}
                      item={item}
                      onSelect={setSelectedItem}
                      isPopular
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Category Sections */}
            {categoriesWithItems.map((category) => {
              const categoryItems = itemsByCategory[category.id] ?? [];
              
              return (
                <div
                  key={category.id}
                  ref={(el) => setSectionRef(category.id, el)}
                  data-category-id={category.id}
                  className="scroll-mt-36"
                >
                  <div className="section-header">
                    <h2 className="section-title">{category.name}</h2>
                    {category.description && (
                      <p className="section-subtitle">{category.description}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categoryItems.map((item) => (
                      <MenuItemCard
                        key={item.id}
                        item={item}
                        onSelect={setSelectedItem}
                        isPopular={popularItemIds.includes(item.id)}
                        isNew={item.tags?.includes("new")}
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

      {/* Cart Drawer */}
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        currency={menu.currency}
        onCheckout={startCheckout}
        onSplitPayment={orderType === "dine_in" ? () => setShowSplit(true) : undefined}
      />

      {/* Payment Sheet */}
      <PaymentSheet
        open={showPaymentSheet}
        onClose={() => setShowPaymentSheet(false)}
        amount={total()}
        currency={menu.currency}
        onConfirm={() => {
          setShowPaymentSheet(false);
          mutation.mutate({});
        }}
      />

      {/* Split Payment */}
      <SplitPayment
        open={showSplit}
        lines={lines}
        currency={menu.currency}
        onClose={() => setShowSplit(false)}
        onConfirm={(ids) => {
          setShowSplit(false);
          const itemIds = lines
            .filter((line) => ids.includes(line.id))
            .map((line) => line.item.id);
          mutation.mutate({ splitByItemIds: itemIds });
        }}
      />

      {/* Floating Cart Button - Orange primary */}
      {totalItems > 0 && !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="floating-cart"
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-white/20 text-white text-sm font-bold flex items-center justify-center">
                {totalItems}
              </span>
              <span className="font-bold">{t("showItems") || "Show items"}</span>
            </div>
            <span className="font-bold">{menu.currency}{totalAmount.toFixed(2)}</span>
          </div>
        </button>
      )}
    </main>
  );
}
