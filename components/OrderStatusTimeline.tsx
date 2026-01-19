import { OrderStatus } from "@/lib/types";
import clsx from "clsx";

const steps: { key: OrderStatus; label: string; description: string }[] = [
  { key: "pending_review", label: "Pending", description: "Awaiting approval" },
  { key: "accepted", label: "Accepted", description: "Confirmed by staff" },
  { key: "in_kitchen", label: "In kitchen", description: "Cooking started" },
  { key: "ready", label: "Ready", description: "Ready for pickup/serve" },
  { key: "served", label: "Served", description: "Delivered to customer" }
];

type Props = {
  status: OrderStatus;
};

export function OrderStatusTimeline({ status }: Props) {
  const activeIndex = steps.findIndex((s) => s.key === status);

  return (
    <div className="card p-4 space-y-4 border border-black/5">
      {steps.map((step, idx) => {
        const done = idx <= activeIndex && activeIndex !== -1;
        const cancelled = status === "cancelled";
        return (
          <div key={step.key} className="flex items-start gap-3">
            <div
              className={clsx(
                "w-10 h-10 rounded-full flex items-center justify-center border-2",
                cancelled
                  ? "border-red-300 text-red-400"
                  : done
                  ? "bg-brand text-white border-brand"
                  : "border-black/10 text-ink/40"
              )}
            >
              {cancelled ? "!" : idx + 1}
            </div>
            <div className="flex-1">
              <p className="font-semibold">
                {cancelled ? "Cancelled" : step.label}
              </p>
              <p className="text-sm text-ink/60">
                {cancelled ? "Order was cancelled" : step.description}
              </p>
              {idx < steps.length - 1 && (
                <div
                  className={clsx(
                    "h-8 w-px ml-5",
                    cancelled ? "bg-red-200" : done ? "bg-brand/60" : "bg-black/10"
                  )}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
