"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Restaurant, OrderType, SchedulingConfigResponse, SchedulingTimeSlot } from "@/lib/types";
import { fetchSchedulingConfig } from "@/services/api";
import { addDays, formatDateLabel } from "@/lib/scheduling";
import { useI18n } from "@/lib/i18n";

export type SchedulingIntent = {
  scheduledFor: string;        // "YYYY-MM-DD"
  selectedSlot: SchedulingTimeSlot; // { start, end }
};

type ModalView = "main" | "schedule";

type Props = {
  open: boolean;
  onClose: () => void;
  restaurant: Restaurant;
  currency: string;
  /** Currently active order type shown in the info bar. */
  orderType: OrderType;
  /** Pre-existing scheduling selection (e.g. carried over from a previous open). */
  initialSchedulingIntent?: SchedulingIntent | null;
  /** Called when the user taps Done/Confirm. */
  onConfirm: (orderType: OrderType, intent: SchedulingIntent | null) => void;
  /** Called when the user taps the Scan QR tab. */
  onScanQR?: () => void;
};

export function OrderDetailsModal({
  open,
  onClose,
  restaurant,
  currency,
  orderType: initialOrderType,
  initialSchedulingIntent,
  onConfirm,
  onScanQR,
}: Props) {
  const { t } = useI18n();
  const [view, setView] = useState<ModalView>("main");
  const [localOrderType, setLocalOrderType] = useState<OrderType>(initialOrderType);
  const [when, setWhen] = useState<"now" | "schedule">(
    initialSchedulingIntent ? "schedule" : "now"
  );

  // Schedule sub-view state
  const [schedulingConfig, setSchedulingConfig] = useState<SchedulingConfigResponse | null>(null);
  const [schedulingLoading, setSchedulingLoading] = useState(false);
  const [scheduledFor, setScheduledFor] = useState<string | null>(
    initialSchedulingIntent?.scheduledFor ?? null
  );
  const [selectedSlot, setSelectedSlot] = useState<SchedulingTimeSlot | null>(
    initialSchedulingIntent?.selectedSlot ?? null
  );

  // Reset to a clean state every time the modal is opened
  useEffect(() => {
    if (!open) return;
    setView("main");
    setLocalOrderType(initialOrderType);
    setWhen(initialSchedulingIntent ? "schedule" : "now");
    setScheduledFor(initialSchedulingIntent?.scheduledFor ?? null);
    setSelectedSlot(initialSchedulingIntent?.selectedSlot ?? null);
    setSchedulingConfig(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Fetch scheduling config when the schedule sub-view is shown
  useEffect(() => {
    if (!open || view !== "schedule") return;
    if (schedulingConfig || schedulingLoading) return;
    if (localOrderType !== "pickup" || !restaurant.schedulingEnabled) return;

    const minDays = restaurant.schedulingMinDaysAhead ?? 1;
    const maxDays = restaurant.schedulingMaxDaysAhead ?? 7;
    const today = new Date();
    setSchedulingLoading(true);
    fetchSchedulingConfig(String(restaurant.id), addDays(today, minDays), addDays(today, maxDays))
      .then((cfg) => {
        setSchedulingConfig(cfg);
        // Auto-select first available date + slot
        const dates = Object.keys(cfg.slotsByDate).sort();
        if (dates.length > 0 && !scheduledFor) {
          const firstDate = dates[0];
          setScheduledFor(firstDate);
          const slots = cfg.slotsByDate[firstDate];
          if (slots?.length) setSelectedSlot(slots[0]);
        }
      })
      .catch(console.error)
      .finally(() => setSchedulingLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, view]);

  const showSchedulingOption = localOrderType === "pickup" && !!restaurant.schedulingEnabled;

  const handleOrderTypeChange = (type: OrderType) => {
    setLocalOrderType(type);
    // Reset scheduling when switching type (delivery can't be scheduled in this version)
    setWhen("now");
    setScheduledFor(null);
    setSelectedSlot(null);
    setSchedulingConfig(null);
  };

  const availableDates = schedulingConfig
    ? Object.keys(schedulingConfig.slotsByDate).sort()
    : [];

  const availableSlots =
    scheduledFor && schedulingConfig
      ? (schedulingConfig.slotsByDate[scheduledFor] ?? [])
      : [];

  const handleDateChange = (date: string) => {
    setScheduledFor(date);
    const slots = schedulingConfig?.slotsByDate[date] ?? [];
    setSelectedSlot(slots.length ? slots[0] : null);
  };

  const canConfirmSchedule = scheduledFor !== null && selectedSlot !== null;

  const handleDone = () => {
    if (when === "schedule" && showSchedulingOption && canConfirmSchedule) {
      onConfirm(localOrderType, { scheduledFor: scheduledFor!, selectedSlot: selectedSlot! });
    } else {
      onConfirm(localOrderType, null);
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Bottom sheet */}
          <motion.div
            key="sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--surface)] rounded-t-3xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            {view === "main" ? (
              /* ── MAIN VIEW ── */
              <>
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-4">
                  <h2 className="text-xl font-bold text-[var(--text)]">Order details</h2>
                  <button
                    onClick={onClose}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--surface-subtle)] text-[var(--text-muted)] hover:bg-[var(--divider)] transition"
                    aria-label="Close"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Order type tab toggle — always shown for non-dine-in */}
                {(restaurant.deliveryEnabled || restaurant.pickupEnabled) && (
                  <div className="px-6 pb-4">
                    <div className="flex rounded-2xl bg-[var(--surface-subtle)] p-1 gap-1">
                      {restaurant.deliveryEnabled && (
                        <button
                          onClick={() => handleOrderTypeChange("delivery")}
                          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition ${
                            localOrderType === "delivery"
                              ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
                              : "text-[var(--text-muted)]"
                          }`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                          </svg>
                          Delivery
                        </button>
                      )}
                      {restaurant.pickupEnabled && (
                        <button
                          onClick={() => handleOrderTypeChange("pickup")}
                          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition ${
                            localOrderType === "pickup"
                              ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
                              : "text-[var(--text-muted)]"
                          }`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                          </svg>
                          Pickup
                        </button>
                      )}
                      {onScanQR && (
                        <button
                          onClick={() => {
                            onClose();
                            onScanQR();
                          }}
                          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition text-[var(--text-muted)]"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                          </svg>
                          Scan QR
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Minimum order info for delivery */}
                {localOrderType === "delivery" && (restaurant.minimumOrderDelivery ?? 0) > 0 && (
                  <div className="mx-6 mb-4 flex items-center gap-2 rounded-xl bg-amber-500/10 px-4 py-3 text-sm">
                    <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-amber-200 font-medium">
                      {t("minimumOrderInfo")} {currency}{restaurant.minimumOrderDelivery}
                    </span>
                  </div>
                )}

                <div className="h-px bg-[var(--divider)] mx-6" />

                {/* When? */}
                <div className="px-6 pt-5 pb-2">
                  <p className="text-base font-bold text-[var(--text)] mb-3">When?</p>

                  {/* Standard */}
                  <button
                    onClick={() => setWhen("now")}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition mb-3 ${
                      when === "now"
                        ? "border-blue-500 bg-blue-500/5"
                        : "border-[var(--divider)] bg-[var(--surface)]"
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        when === "now" ? "border-blue-500" : "border-[var(--text-muted)]"
                      }`}
                    >
                      {when === "now" && <span className="w-3 h-3 rounded-full bg-blue-500 block" />}
                    </span>
                    <div className="text-left">
                      <p className="font-semibold text-[var(--text)]">Standard</p>
                      <p className="text-sm text-[var(--text-muted)]">
                        {localOrderType === "delivery" ? "25-35 min" : "10-15 min"}
                      </p>
                    </div>
                  </button>

                  {/* Schedule (pickup + scheduling enabled only) */}
                  {showSchedulingOption && (
                    <button
                      onClick={() => {
                        setWhen("schedule");
                        setView("schedule");
                      }}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition ${
                        when === "schedule"
                          ? "border-amber-500 bg-amber-500/5"
                          : "border-[var(--divider)] bg-[var(--surface)]"
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          when === "schedule" ? "border-amber-500" : "border-[var(--text-muted)]"
                        }`}
                      >
                        {when === "schedule" && (
                          <span className="w-3 h-3 rounded-full bg-amber-500 block" />
                        )}
                      </span>
                      <div className="text-left flex-1">
                        <p className="font-semibold text-[var(--text)]">Schedule</p>
                        <p className="text-sm text-[var(--text-muted)]">
                          {when === "schedule" && scheduledFor && selectedSlot
                            ? `${formatDateLabel(scheduledFor)} · ${selectedSlot.start} – ${selectedSlot.end}`
                            : "Choose a pickup time"}
                        </p>
                      </div>
                      <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Done */}
                <div className="px-6 pt-4 pb-8">
                  <button
                    onClick={handleDone}
                    className="w-full py-4 rounded-2xl bg-brand text-white font-bold text-base shadow-lg shadow-brand/25 hover:bg-brand-dark transition"
                  >
                    Done
                  </button>
                </div>
              </>
            ) : (
              /* ── SCHEDULE VIEW ── */
              <>
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-2">
                  <button
                    onClick={() => setView("main")}
                    className="w-10 h-10 flex items-center justify-center rounded-full border-2 border-amber-500 text-amber-500 hover:bg-amber-500/10 transition"
                    aria-label="Back"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={onClose}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--surface-subtle)] text-[var(--text-muted)] hover:bg-[var(--divider)] transition"
                    aria-label="Close"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="px-6 pb-4">
                  <h2 className="text-xl font-bold text-[var(--text)]">Schedule</h2>
                </div>

                {schedulingLoading ? (
                  <div className="px-6 py-10 text-center text-[var(--text-muted)] animate-pulse">
                    Loading available slots…
                  </div>
                ) : availableDates.length === 0 && !schedulingLoading ? (
                  <div className="px-6 py-10 text-center text-[var(--text-muted)]">
                    No available time slots. Try ordering for now.
                  </div>
                ) : (
                  <div className="px-6 py-2 flex gap-4">
                    {/* Day dropdown */}
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-[var(--text-muted)] mb-2 uppercase tracking-wide">
                        Day
                      </label>
                      <div className="relative">
                        <select
                          value={scheduledFor ?? ""}
                          onChange={(e) => handleDateChange(e.target.value)}
                          className="w-full px-4 py-4 border-2 border-[var(--divider)] rounded-2xl bg-[var(--surface)] text-[var(--text)] font-semibold text-sm appearance-none focus:outline-none focus:border-brand"
                        >
                          {availableDates.map((date) => (
                            <option key={date} value={date}>
                              {formatDateLabel(date)}
                            </option>
                          ))}
                        </select>
                        <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {/* Time dropdown */}
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-[var(--text-muted)] mb-2 uppercase tracking-wide">
                        Time
                      </label>
                      <div className="relative">
                        <select
                          value={selectedSlot?.start ?? ""}
                          onChange={(e) => {
                            const slot = availableSlots.find((s) => s.start === e.target.value);
                            if (slot) setSelectedSlot(slot);
                          }}
                          disabled={availableSlots.length === 0}
                          className="w-full px-4 py-4 border-2 border-[var(--divider)] rounded-2xl bg-[var(--surface)] text-[var(--text)] font-semibold text-sm appearance-none focus:outline-none focus:border-brand disabled:opacity-50"
                        >
                          {availableSlots.map((slot) => (
                            <option key={slot.start} value={slot.start}>
                              {slot.start}
                            </option>
                          ))}
                        </select>
                        <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                )}

                {/* Confirm */}
                <div className="px-6 pt-4 pb-8">
                  <button
                    onClick={() => { if (canConfirmSchedule) setView("main"); }}
                    disabled={!canConfirmSchedule}
                    className="w-full py-4 rounded-2xl bg-brand text-white font-bold text-base shadow-lg shadow-brand/25 hover:bg-brand-dark transition disabled:opacity-50"
                  >
                    Confirm
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
