"use client";

import { OrderStatus, OrderType } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import clsx from "clsx";
import type { OrderLifecycleRead } from "@/lib/order-lifecycle";
import { orderTimeline } from "@/lib/order-timeline";

type Props = {
  status: OrderStatus;
  orderType?: OrderType;
  serviceMode?: string;
  scheduledFor?: string;
  lifecycle?: OrderLifecycleRead;
};

export function OrderStatusTimeline({ status, orderType, serviceMode, scheduledFor, lifecycle }: Props) {
  const { t } = useI18n();
  const { steps, done: doneSteps, current, cancelled: isCancelled, unknown, message } = orderTimeline({ status, orderType, serviceMode, scheduledFor, lifecycle });

  return (
    <div data-order-timeline className="card p-5 space-y-0">
      {(isCancelled || unknown) && (
        <p role="status" className="text-sm text-ink-muted mb-4">
          {isCancelled ? t("descOrderCancelled") : lifecycle?.kind === "unavailable" ? t("orderProgressUnknown") : t("orderPreparationUnknown")}
        </p>
      )}
      {message && <p className="text-sm text-ink-muted mb-4">{t(message)}</p>}
      {steps.map((step, idx) => {
        const done = doneSteps.has(step.key);
        const isCurrent = current.has(step.key) && !isCancelled;
        const isLast = idx === steps.length - 1;

        return (
          <div key={step.key} data-step={step.key} data-current={isCurrent} data-done={done} className="flex items-start gap-4">
            {/* Indicator column */}
            <div className="flex flex-col items-center">
              <div
                className={clsx(
                  "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 transition-all duration-300",
                  isCurrent
                    ? "bg-brand text-white shadow-md shadow-brand/30 ring-4 ring-brand/20"
                    : done
                    ? "bg-brand text-white"
                    : "border-2 border-light-divider text-ink-muted bg-light-surface"
                )}
              >
                {done && !isCurrent ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  idx + 1
                )}
              </div>
              {/* Connector line */}
              {!isLast && (
                <div
                  className={clsx(
                    "w-0.5 h-10 transition-colors duration-300",
                    done
                      ? "bg-brand/40"
                      : "bg-light-divider"
                  )}
                />
              )}
            </div>
            {/* Text content */}
            <div className={clsx("pt-2 pb-2", !isLast && "pb-0")}>
              <p
                className={clsx(
                  "font-semibold text-[15px] leading-tight",
                  isCurrent
                    ? "text-ink"
                    : done
                    ? "text-ink"
                    : "text-ink-muted"
                )}
              >
                {t(step.labelKey)}
              </p>
              <p
                className={clsx(
                  "text-sm mt-0.5",
                  isCurrent ? "text-ink-muted" : "text-ink-muted/70"
                )}
              >
                {t(step.descKey)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
