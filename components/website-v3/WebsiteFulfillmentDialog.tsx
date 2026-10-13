"use client";
import { SchedulingFields } from "@/components/SchedulingFields";
import { useSchedulingConfig } from "@/hooks/useSchedulingConfig";
import { resolveSchedulingSelection, type SchedulingSelection } from "@/lib/scheduling";
import { checkRestaurantAvailability } from "@/lib/availability";
import type { FulfillmentCartItem } from "@/lib/types";
import { FramedBackground } from "./FramedImage";
import { resolveWebsiteOrderType, websiteFulfillmentRules } from "@/lib/websiteFulfillment";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { Restaurant } from "@/lib/types";
import type { WebsiteOrderDesign } from "@/lib/websiteOrder";
import { websiteOrderCopy } from "@/lib/websiteOrder";
import { DeliveryAddressAutocomplete } from "@/components/DeliveryAddressAutocomplete";
import { useAddressAutocomplete } from "@/hooks/useAddressAutocomplete";
import type { DeliveryAddressSuggestion } from "@/services/api";
import { checkDeliveryAddress } from "@/services/api";
import type { WebsiteOrderSelection } from "@/store/useWebsiteOrderStore";
import { useResolvedTheme } from "@/lib/themes/useResolvedTheme";
import { orderFulfillmentColorVariables } from "@/lib/websiteOrderColors";
import type { CSSProperties } from "react";
import { WebsitePickupSummary } from "./WebsitePickupSummary";

/** The storefront entry dialog selects a real service and checks delivery before showing its menu. */
export function WebsiteFulfillmentDialog({
  open,
  restaurant,
  design,
  selection,
  cartItems = [],
  onClose,
  onConfirm,
  onInfo,
}: {
  open: boolean;
  restaurant: Restaurant;
  design: WebsiteOrderDesign;
  selection: WebsiteOrderSelection;
  cartItems?: FulfillmentCartItem[];
  onClose: () => void;
  onConfirm: (selection: WebsiteOrderSelection) => void;
  onInfo: () => void;
}) {
  const { locale, direction, t } = useI18n();
  const { config } = useResolvedTheme();
  const copy = websiteOrderCopy(locale);
  const dialog = useRef<HTMLDialogElement>(null);
  const rules = websiteFulfillmentRules(restaurant);
  const initialType = resolveWebsiteOrderType(restaurant, selection.orderType) as "pickup" | "delivery";
  const [type, setType] = useState(initialType);
  const [address, setAddress] = useState(selection.address ?? "");
  const autocomplete = useAddressAutocomplete(String(restaurant.id));
  const [addressSelection, setAddressSelection] = useState<DeliveryAddressSuggestion | undefined>(selection.addressSelection);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const initialDate = selection.schedulingIntent?.scheduledFor;
  const initialStart = selection.schedulingIntent?.selectedSlot.start;
  const initialEnd = selection.schedulingIntent?.selectedSlot.end;
  const [requestedIntent, setRequestedIntent] = useState<SchedulingSelection | null>(selection.schedulingIntent ?? null);
  const [scheduleRequested, setScheduleRequested] = useState(!!selection.schedulingIntent);
  const schedule = useSchedulingConfig(restaurant, type, cartItems, open && rules.canChooseTime);
  const immediateOpen = checkRestaurantAvailability(restaurant, type).isOpen;
  const scheduleRequired = !!restaurant.preordersOnly || !immediateOpen || schedule.data?.immediateAvailable === false;
  const scheduled = scheduleRequired || scheduleRequested;
  const intent = schedule.data ? resolveSchedulingSelection(schedule.data.slotsByDate, requestedIntent) : null;
  const timingReady = !rules.canChooseTime || (!schedule.isPending && !schedule.isFetching && !schedule.isError && schedule.data?.enabled && (scheduled ? !!intent : immediateOpen));
  const paused = !!restaurant.rushMode || !!restaurant.ordersPaused;
  useEffect(() => {
    const node = dialog.current;
    if (open) {
      setType(initialType);
      setAddress(selection.address ?? "");
      setAddressSelection(selection.addressSelection);
      setError("");
      setBusy(false);
      setRequestedIntent(initialDate && initialStart && initialEnd ? {scheduledFor: initialDate, selectedSlot: {start: initialStart, end: initialEnd}} : null);
      setScheduleRequested(!!initialDate);
      node?.showModal();
    } else node?.close();
    return () => {
      // This is a request counter, not a DOM ref: invalidate any pending address check.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
      node?.close();
    };
  }, [open, initialType, selection.address, selection.addressSelection, initialDate, initialStart, initialEnd]);
  const cover = design.modalCoverUrl || restaurant.coverUrl;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      busy || !timingReady || paused ||
      (type === "pickup"
        ? !restaurant.pickupEnabled
        : !restaurant.deliveryEnabled || !address.trim())
    )
      return;
    if (type === 'delivery' && (autocomplete.isPending || autocomplete.isError || (autocomplete.data?.enabled && !addressSelection))) {
      setError(autocomplete.isError ? copy.failure : copy.unresolved);
      return;
    }
    const request = ++generation.current;
    if (type === "delivery") {
      setBusy(true);
      setError("");
      try {
        const result = await checkDeliveryAddress({
          restaurantId: String(restaurant.id),
          address: address.trim(),
          city: addressSelection?.city,
          lat: addressSelection?.lat,
          lng: addressSelection?.lng,
        });
        if (generation.current !== request) return;
        if (!result.resolved || !result.deliverable) {
          setError(result.resolved ? copy.outside : copy.unresolved);
          return;
        }
      } catch {
        if (generation.current === request) setError(copy.failure);
        return;
      } finally {
        if (generation.current === request) setBusy(false);
      }
    }
    if (generation.current === request) {
      onConfirm({
        orderType: type,
        schedulingIntent: rules.canChooseTime && scheduled ? intent : null,
        ...(type === "delivery" ? { address: address.trim(), addressSelection } : {}),
      });
      onClose();
    }
  };
  return (
    <dialog
      ref={dialog}
      dir={direction}
      onCancel={onClose}
      aria-labelledby="website-fulfillment-title"
      className="website-fulfillment-dialog"
      style={orderFulfillmentColorVariables(config?.customPalette, design) as CSSProperties}
    >
      <form onSubmit={submit}>
        {design.modalCover && cover && (
          <div
            className="website-fulfillment-cover"
            style={{ position: "relative", isolation: "isolate", backgroundImage: design.modalCoverFraming ? undefined : `url(${JSON.stringify(cover)})` }}
          >
            <FramedBackground src={cover} framing={design.modalCoverFraming} />
            {design.modalLogo && restaurant.logoUrl && (
              <img src={restaurant.logoUrl} alt={restaurant.name} />
            )}
          </div>
        )}
        <div className="website-fulfillment-body" data-service={type}>
          {rules.canChooseMode && <div className="website-service-tabs" role="tablist">
            {(["pickup", "delivery"] as const)
              .filter((mode) =>
                mode === "pickup"
                  ? restaurant.pickupEnabled
                  : restaurant.deliveryEnabled,
              )
              .map((mode) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === type}
                  key={mode}
                  disabled={busy}
                  onClick={() => {
                    generation.current++;
                    setType(mode);
                    setRequestedIntent(mode === selection.orderType ? selection.schedulingIntent ?? null : null);
                    setScheduleRequested(mode === selection.orderType && !!selection.schedulingIntent);
                    setError("");
                  }}
                >
                  {copy[mode]}
                </button>
              ))}
          </div>
          }
          <h2 id="website-fulfillment-title">
            {type === "delivery" ? copy.address : copy.pickupTitle}
          </h2>
          {type === "delivery" ? (
            <DeliveryAddressAutocomplete
              restaurantId={String(restaurant.id)} enabled={!!autocomplete.data?.enabled}
              label={copy.addressField} placeholder={copy.addressField} value={address}
              disabled={busy || autocomplete.isPending} required selectionToken={addressSelection?.token}
              selectionCity={addressSelection?.city} inlineSuggestions
              onChange={value => { generation.current++; setAddress(value); setAddressSelection(undefined); setError(""); }}
              onSelect={suggestion => { generation.current++; setAddress(suggestion.address); setAddressSelection(suggestion); setError(""); }}
            />
          ) : (
            <>
              <WebsitePickupSummary restaurant={restaurant} open={open} onInfo={onInfo} showTiming={!rules.canChooseTime} />
              {restaurant.chainSlug &&
                (restaurant.chainBranchCount ?? 0) > 1 && (
                  <a
                    className="website-pickup-change-branch"
                    href={`/c/${encodeURIComponent(restaurant.chainSlug)}/order?type=pickup&lang=${locale}`}
                  >
                    {copy.changeBranch}
                  </a>
                )}
            </>
          )}
          {rules.canChooseTime && <section className="website-schedule-options" aria-label={t("chooseATime")}>
            {paused ? <p role="status">{t("rushTitle")}</p> : schedule.isError ? <p role="alert">{copy.scheduleError} <button type="button" onClick={() => void schedule.refetch()}>{copy.retry}</button></p> : schedule.isPending || schedule.isFetching ? <p role="status">{copy.loadingTimes}</p> : <>
              {!scheduleRequired && <label><input type="radio" name="entry-time" checked={!scheduled} disabled={busy} onChange={() => setScheduleRequested(false)} /><span>{copy.asap}</span></label>}
              {intent && <>
                <label><input type="radio" name="entry-time" checked={scheduled} disabled={busy} onChange={() => setScheduleRequested(true)} /><span>{t("chooseATime")}</span></label>
                {scheduled && <SchedulingFields slotsByDate={schedule.data!.slotsByDate} selection={intent} disabled={busy} onChange={value => { generation.current++; setRequestedIntent(value); }} />}
              </>}
              {!intent && scheduled && <p role="status">{copy.noTimes}</p>}
            </>}
          </section>}
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
        </div>
        <div className="website-fulfillment-footer">
          <button
            type="button"
            className="website-fulfillment-close"
            onClick={onClose}
            aria-label={copy.close}
          >
            ×
          </button>
          <button
            type="submit"
            className="website-view-menu"
            disabled={
              busy || !timingReady || paused || (type === "pickup" ? !restaurant.pickupEnabled : !address.trim())
            }
          >
            {busy ? copy.checking : type === "delivery" ? copy.update : copy.confirmPickup}
          </button>
        </div>
      </form>
    </dialog>
  );
}
