"use client";

import { useI18n } from "@/lib/i18n";
import { formatLeadDuration } from "@/lib/fulfillment";
import {
  formatDateLabel,
  resolveSchedulingSelection,
  type SchedulingSelection,
} from "@/lib/scheduling";
import type { Restaurant, SchedulingConfigResponse } from "@/lib/types";

/** Explains the server's first compatible slot separately from the customer's choice. */
export function PreparationAvailability({
  config,
  restaurant,
  selection,
  loading,
  error,
  adjusted,
  onRetry,
  onChooseEarliest,
}: {
  config: SchedulingConfigResponse | null;
  restaurant: Restaurant;
  selection: SchedulingSelection | null;
  loading: boolean;
  error: boolean;
  adjusted?: boolean;
  onRetry: () => void;
  onChooseEarliest: (selection: SchedulingSelection) => void;
}) {
  const { t, locale } = useI18n();
  const earliest = config?.enabled
    ? resolveSchedulingSelection(config.slotsByDate)
    : null;
  const earlier =
    earliest &&
    (!selection ||
      `${earliest.scheduledFor} ${earliest.selectedSlot.start}` <
        `${selection.scheduledFor} ${selection.selectedSlot.start}`);
  return (
    <div
      className="mt-4 space-y-2 text-sm"
      data-preparation-availability
      aria-live="polite"
      aria-busy={loading}
    >
      {loading ? (
        <p>{t("loadingAvailableSlots")}</p>
      ) : error ? (
        <p role="alert">
          {t("preparationAvailabilityError")}{" "}
          <button type="button" className="underline" onClick={onRetry}>
            {t("preparationRetry")}
          </button>
        </p>
      ) : (
        <>
          {adjusted && <p>{t("fulfillmentSlotAdjusted")}</p>}
          {earliest ? (
            <>
              <p className="font-semibold">
                {t("preparationFirstSlot")}{" "}
                {formatDateLabel(earliest.scheduledFor, locale)} ·{" "}
                {earliest.selectedSlot.start} – {earliest.selectedSlot.end}
              </p>
              <p>
                {config?.constrainedBy
                  ? t("preparationCartConstraint")
                      .replace("{item}", config.constrainedBy.name)
                      .replace(
                        "{duration}",
                        formatLeadDuration(
                          config.constrainedBy.leadTimeMinutes,
                          t,
                        ),
                      )
                  : config?.leadTimeMinutes
                    ? t("preparationCartDefault").replace(
                        "{duration}",
                        formatLeadDuration(config.leadTimeMinutes, t),
                      )
                    : t("preparationCartZero")}
              </p>
              <p>{t("preparationWholeCart")}</p>
              {!!config?.leadTimeMinutes && (
                <p>
                  {t(
                    restaurant.schedulingPreparationTimeBasis ===
                      "opening_hours"
                      ? "preparationClockOpening"
                      : restaurant.schedulingPreparationTimeBasis ===
                          "custom_start"
                        ? "preparationClockCustom"
                        : "preparationClockElapsed",
                  ).replace(
                    "{time}",
                    restaurant.schedulingPreparationStartTime ?? "09:00",
                  )}
                  {restaurant.schedulingPreparationTimeBasis &&
                    restaurant.schedulingPreparationTimeBasis !== "elapsed" &&
                    ` ${t(restaurant.schedulingPreparationSplittable ? "preparationClockSplit" : "preparationClockSingle")}`}
                </p>
              )}
              {earlier && (
                <div className="space-y-2">
                  <p>
                    {t(
                      selection
                        ? "preparationEarlierAvailable"
                        : "selectDateAndSlot",
                    )}
                  </p>
                  <button
                    type="button"
                    className="commerce-secondary px-3 py-2"
                    onClick={() => onChooseEarliest(earliest)}
                  >
                    {t("preparationChooseFirst")}
                  </button>
                </div>
              )}
            </>
          ) : (
            <p>{t("preparationNoSlots")}</p>
          )}
        </>
      )}
    </div>
  );
}
