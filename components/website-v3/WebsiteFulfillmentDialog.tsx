"use client";
import { useDeliveryAvailability } from "@/hooks/useDeliveryAvailability";
import { DeliverySchedulePanel } from "@/components/DeliverySchedulePanel";
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
import { CustomerSignIn } from "@/components/CustomerSignIn";
import { useGuestAccount } from "@/store/useGuestAccount";
import { useCustomerCheckoutProfile } from "@/hooks/useCustomerCheckoutProfile";
import { useOrderingTestRestaurant } from "@/hooks/useOrderingTestRestaurant";

/** The storefront entry dialog selects a real service and checks delivery before showing its menu. */
export function WebsiteFulfillmentDialog({
  open,
  restaurant: initialRestaurant,
  design,
  selection,
  cartItems = [],
  accountAccess = true,
  onClose,
  onConfirm,
  onInfo,
  onUnavailable,
}: {
  open: boolean;
  restaurant: Restaurant;
  design: WebsiteOrderDesign;
  selection: WebsiteOrderSelection;
  cartItems?: FulfillmentCartItem[];
  accountAccess?: boolean;
  onClose: () => void;
  onConfirm: (selection: WebsiteOrderSelection) => void;
  onInfo: () => void;
  onUnavailable?: (restaurant: Restaurant) => void;
}) {
  const { locale, direction, t } = useI18n();
  const restaurant = useOrderingTestRestaurant(initialRestaurant, !open || !accountAccess);
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
  const customerStatus = useGuestAccount(state => state.status);
  const customer = useGuestAccount(state => state.account);
  const profile = useCustomerCheckoutProfile(String(restaurant.id), open && accountAccess);
  const addressEdited = useRef(false);
  const initialDate = selection.schedulingIntent?.scheduledFor;
  const initialStart = selection.schedulingIntent?.selectedSlot.start;
  const initialEnd = selection.schedulingIntent?.selectedSlot.end;
  const [requestedIntent, setRequestedIntent] = useState<SchedulingSelection | null>(selection.schedulingIntent ?? null);
  const [scheduleRequested, setScheduleRequested] = useState(!!selection.schedulingIntent);
  const schedule = useSchedulingConfig(restaurant, type, cartItems, open && rules.canChooseTime);
  const delivery = useDeliveryAvailability(String(restaurant.id), address, addressSelection, cartItems, open && type === "delivery" && !autocomplete.isPending && (!autocomplete.data?.enabled || !!addressSelection));
  const routeCalendar = type === "delivery" ? delivery.data?.schedule : undefined;
  const routeIntent = routeCalendar ? resolveSchedulingSelection(routeCalendar.slots_by_date, routeCalendar.delivery_mode === "customer" ? requestedIntent : null) : null;
  const immediateOpen = checkRestaurantAvailability(restaurant, type).isOpen;
  const scheduleRequired = !!restaurant.preordersOnly || !immediateOpen || schedule.data?.immediateAvailable === false;
  const scheduled = scheduleRequired || scheduleRequested;
  const intent = schedule.data ? resolveSchedulingSelection(schedule.data.slotsByDate, requestedIntent) : null;
  const timingReady = routeCalendar ? !!routeIntent : !rules.canChooseTime || (!schedule.isPending && !schedule.isFetching && !schedule.isError && schedule.data?.enabled && (scheduled ? !!intent : immediateOpen));
  const paused = !!restaurant.rushMode || !!restaurant.ordersPaused;
  const orderingWasAvailable = useRef(false);
  useEffect(() => {
    if (!open) { orderingWasAvailable.current = false; return; }
    if (!paused) orderingWasAvailable.current = true;
    else if (orderingWasAvailable.current) { onUnavailable?.(restaurant); onClose(); }
  }, [open, paused, restaurant, onUnavailable, onClose]);
  useEffect(() => {
    const node = dialog.current;
    // A refreshed parent calendar must not reset an address already being typed.
    if (open && !node?.open) {
      addressEdited.current = false;
      setType(initialType);
      setAddress(selection.address ?? "");
      setAddressSelection(selection.addressSelection);
      setError("");
      setBusy(false);
      setRequestedIntent(initialDate && initialStart && initialEnd ? {scheduledFor: initialDate, selectedSlot: {start: initialStart, end: initialEnd}} : null);
      setScheduleRequested(!!initialDate);
      node?.showModal();
    } else if (!open) {
      generation.current++;
      node?.close();
    }
  }, [open, initialType, selection.address, selection.addressSelection, initialDate, initialStart, initialEnd]);
  useEffect(() => {
    const node = dialog.current;
    return () => {
      // This is a request counter, not a DOM ref: invalidate any pending address check.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
      node?.close();
    };
  }, []);
  useEffect(() => {
    const node = dialog.current;
    if (!open || !node) return;
    const viewport = window.visualViewport;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // Leave pinch zoom to the browser; the keyboard changes height at scale 1.
        if (viewport && viewport.scale !== 1) return;
        const height = viewport?.height ?? window.innerHeight;
        node.style.setProperty("--entry-viewport-height", `${height}px`);
        node.style.setProperty("--entry-viewport-top", `${viewport?.offsetTop ?? 0}px`);
        node.dataset.keyboardOpen = String(window.innerHeight - height > 120);
        const field = document.activeElement;
        const body = node.querySelector(".website-fulfillment-body");
        if (field instanceof HTMLInputElement && body?.contains(field)) {
          const bounds = body.getBoundingClientRect();
          const inputBounds = field.getBoundingClientRect();
          if (inputBounds.bottom > bounds.bottom) body.scrollTop += inputBounds.bottom - bounds.bottom + 12;
          else if (inputBounds.top < bounds.top) body.scrollTop -= bounds.top - inputBounds.top + 12;
        }
      });
    };
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    node.addEventListener("focusin", update);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      node.removeEventListener("focusin", update);
      document.body.style.overflow = previousOverflow;
      node.style.removeProperty("--entry-viewport-height");
      node.style.removeProperty("--entry-viewport-top");
      delete node.dataset.keyboardOpen;
    };
  }, [open]);
  useEffect(() => {
    if (!open || !accountAccess || customerStatus !== "authenticated" || !profile.data || addressEdited.current) return;
    const saved = profile.data;
    if (!address.trim() && saved.profile.address) {
      setAddress(saved.profile.address);
      setAddressSelection(saved.address_selection ?? undefined);
    } else if (address === saved.profile.address && !addressSelection && saved.address_selection) {
      setAddressSelection(saved.address_selection);
    }
  }, [open, accountAccess, customerStatus, profile.data, address, addressSelection]);
  const cover = design.modalCoverUrl || restaurant.coverUrl;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      busy || !timingReady || paused || (type === "delivery" && (delivery.isPending || delivery.isFetching || delivery.isError)) ||
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
          items: cartItems,
        });
        if (generation.current !== request) return;
        if (result.schedule && !resolveSchedulingSelection(result.schedule.slots_by_date, result.schedule.delivery_mode === "customer" ? requestedIntent : null)) {setError(copy.noTimes);return;}
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
        schedulingIntent: routeCalendar ? routeIntent : rules.canChooseTime && scheduled ? intent : null,
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
      className="website-fulfillment-dialog website-entry-dialog"
      data-address-searching={type === "delivery" && !!autocomplete.data?.enabled && !addressSelection}
      style={orderFulfillmentColorVariables(config?.customPalette, design) as CSSProperties}
    >
      <form onSubmit={submit}>
        <header className="website-entry-heading">
          <h2 id="website-fulfillment-title">
            {type === "delivery" ? copy.addressField : copy.pickupTitle}
          </h2>
          <button type="button" className="website-fulfillment-close" onClick={onClose} aria-label={copy.close} autoFocus>×</button>
        </header>
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
          {accountAccess && customerStatus === "authenticated" && <div className="mb-5 space-y-2">
            <p className="text-sm font-semibold">{t("accountSignedInAs")} {customer?.name || customer?.email}</p>
            {profile.isFetching && <p role="status" className="text-xs">{t("checkoutProfileLoading")}</p>}
            {profile.isError && <p role="alert" className="text-sm">{t("checkoutProfileLoadError")} <button type="button" onClick={() => void profile.refetch()}>{t("retry")}</button></p>}
          </div>}
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
          {type === "delivery" ? (
            <DeliveryAddressAutocomplete
              restaurantId={String(restaurant.id)} enabled={!!autocomplete.data?.enabled}
              label={copy.addressField} placeholder={copy.addressField} value={address}
              disabled={busy || autocomplete.isPending} required selectionToken={addressSelection?.token}
              selectionCity={addressSelection?.city} inlineSuggestions blurOnSelect
              onChange={value => { addressEdited.current = true; generation.current++; setAddress(value); setAddressSelection(undefined); setError(""); }}
              onSelect={suggestion => { addressEdited.current = true; generation.current++; setAddress(suggestion.address); setAddressSelection(suggestion); setError(""); }}
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
          {type === "delivery" && delivery.data && (routeCalendar || delivery.data.offer_pickup) && <DeliverySchedulePanel result={delivery.data} selection={routeIntent} disabled={busy || delivery.isFetching} onChange={setRequestedIntent} onPickup={restaurant.pickupEnabled ? () => {generation.current++;setType("pickup");setRequestedIntent(null);setScheduleRequested(false);setError("");} : undefined} />}
          {type === "delivery" && delivery.isFetching && address.trim() && <p role="status">{copy.checking}</p>}
          {type === "delivery" && delivery.isError && <p role="alert">{copy.failure} <button type="button" onClick={() => void delivery.refetch()}>{copy.retry}</button></p>}
          {type === "delivery" && delivery.data && !delivery.data.deliverable && <p role="alert">{delivery.data.resolved ? copy.outside : copy.unresolved}</p>}
          {paused && <p role="status">{t("rushMessage").replace("{name}", restaurant.name)}</p>}
          {!paused && !routeCalendar && rules.canChooseTime && <section className="website-schedule-options" aria-label={t("chooseATime")}>
            {schedule.isError ? <p role="alert">{copy.scheduleError} <button type="button" onClick={() => void schedule.refetch()}>{copy.retry}</button></p> : schedule.isPending || schedule.isFetching ? <p role="status">{copy.loadingTimes}</p> : <>
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
          {accountAccess && customerStatus === "anonymous" && <div className="website-entry-account">
            <CustomerSignIn variant="entry" />
          </div>}
        </div>
        <div className="website-fulfillment-footer">
          <button
            type="submit"
            className="website-view-menu"
            disabled={
              busy || !timingReady || paused || (type === "delivery" && (delivery.isPending || delivery.isFetching || delivery.isError || !delivery.data?.deliverable)) || (type === "pickup" ? !restaurant.pickupEnabled : !address.trim())
            }
          >
            {busy ? copy.checking : type === "delivery" ? copy.confirmDelivery : copy.confirmPickup}
          </button>
        </div>
      </form>
    </dialog>
  );
}
