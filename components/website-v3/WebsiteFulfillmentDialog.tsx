"use client";
import { useDeliveryAvailability } from "@/hooks/useDeliveryAvailability";
import { DeliverySchedulePanel } from "@/components/DeliverySchedulePanel";
import { SchedulingFields } from "@/components/SchedulingFields";
import { useSchedulingConfig } from "@/hooks/useSchedulingConfig";
import { resolveSchedulingSelection, resolveDeliverySelection, deliveryModeForDate, type SchedulingSelection } from "@/lib/scheduling";
import { checkRestaurantAvailability } from "@/lib/availability";
import type { FulfillmentCartItem } from "@/lib/types";
import { FramedBackground } from "./FramedImage";
import { resolveWebsiteOrderType, websiteFulfillmentRules } from "@/lib/websiteFulfillment";
import { useEffect, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
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
import { roleTextStyle } from "@/lib/themes/typography";
import { orderFulfillmentColorVariables } from "@/lib/websiteOrderColors";
import type { CSSProperties } from "react";
import { WebsitePickupSummary } from "./WebsitePickupSummary";
import { WebsitePickupBranches } from "@/components/WebsitePickupBranches";
import { CustomerSignIn } from "@/components/CustomerSignIn";
import { useGuestAccount } from "@/store/useGuestAccount";
import { useCustomerCheckoutProfile } from "@/hooks/useCustomerCheckoutProfile";
import { useOrderingTestRestaurant } from "@/hooks/useOrderingTestRestaurant";
import { ArrowLeftIcon, MapPinIcon } from "@heroicons/react/24/outline";
import { isDesktopPanel, useWebsitePanelAnchor, useWebsitePanelDismiss } from "@/lib/useWebsitePanelAnchor";

/** The storefront entry dialog selects a real service and checks delivery before showing its menu. */
export function WebsiteFulfillmentDialog({
  open,
  restaurant: initialRestaurant,
  design,
  selection,
  cartItems = [],
  accountAccess = true,
  preview = false,
  onClose,
  onConfirm,
  onInfo,
  onUnavailable,
  fixedMode,
  anchor,
  editing = false,
  skipIntro = false,
  step = false,
}: {
  open: boolean;
  restaurant: Restaurant;
  design: WebsiteOrderDesign;
  selection: WebsiteOrderSelection;
  cartItems?: FulfillmentCartItem[];
  accountAccess?: boolean;
  preview?: boolean;
  onClose: () => void;
  onConfirm: (selection: WebsiteOrderSelection) => void;
  onInfo: () => void;
  onUnavailable?: (restaurant: Restaurant) => void;
  fixedMode?: WebsiteOrderSelection["orderType"];
  anchor?: HTMLElement | null;
  editing?: boolean;
  skipIntro?: boolean;
  step?: boolean;
}) {
  const { locale, direction, t } = useI18n();
  const restaurant = useOrderingTestRestaurant(initialRestaurant, !open || !accountAccess);
  const { config } = useResolvedTheme();
  const copy = websiteOrderCopy(locale);
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const accountBenefitId = useId();
  useWebsitePanelAnchor(dialog, anchor, open);
  useWebsitePanelDismiss(dialog, anchor, open, onClose);
  const rules = websiteFulfillmentRules(restaurant);
  const initialType = fixedMode ?? resolveWebsiteOrderType(restaurant, selection.orderType) as "pickup" | "delivery";
  const [type, setType] = useState(initialType);
  const [address, setAddress] = useState(selection.address ?? "");
  const autocomplete = useAddressAutocomplete(String(restaurant.id));
  const [addressSelection, setAddressSelection] = useState<DeliveryAddressSuggestion | undefined>(selection.addressSelection);
  const [error, setError] = useState("");
  const [checkingDelivery, setCheckingDelivery] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);
  const busy = checkingDelivery || signingOut;
  const generation = useRef(0);
  const customerStatus = useGuestAccount(state => state.status);
  const customer = useGuestAccount(state => state.account);
  const signOut = useGuestAccount(state => state.signOut);
  const customerId = customer?.id;
  const previousCustomerId = useRef(customerId);
  const accountLabel = customer?.name || customer?.email;
  const profile = useCustomerCheckoutProfile(String(restaurant.id), open && accountAccess);
  const [guestContinued, setGuestContinued] = useState(!!(selection.address?.trim() || selection.addressSelection || selection.schedulingIntent));
  const offerSignIn = restaurant.websiteConfig?.checkoutConfig?.offer_sign_in !== false;
  const direct = step || skipIntro || (design.chooseBeforeMenu && !!fixedMode);
  const entryAccount = !direct || step;
  const showSignedIn = entryAccount && accountAccess && !preview && customerStatus === "authenticated";
  const offerAccountAccess = entryAccount && (accountAccess || preview) && (preview || customerStatus !== "authenticated");
  const showAccountChoice = offerAccountAccess && offerSignIn && !guestContinued && !signingOut;
  const showOptionalSignIn = offerAccountAccess && (!offerSignIn || (step && guestContinued));
  const fulfillmentTitle = type === "delivery" ? copy.addressField : copy.pickupTitle;
  const addressEdited = useRef(false);
  const [editingSavedAddress, setEditingSavedAddress] = useState(false);
  const initialDate = selection.schedulingIntent?.scheduledFor;
  const initialStart = selection.schedulingIntent?.selectedSlot.start;
  const initialEnd = selection.schedulingIntent?.selectedSlot.end;
  const [requestedIntent, setRequestedIntent] = useState<SchedulingSelection | null>(selection.schedulingIntent ?? null);
  const [scheduleRequested, setScheduleRequested] = useState(!!selection.schedulingIntent);
  const schedule = useSchedulingConfig(restaurant, type, cartItems, open && rules.canChooseTime);
  const delivery = useDeliveryAvailability(String(restaurant.id), address, addressSelection, cartItems, open && !showAccountChoice && type === "delivery" && !autocomplete.isPending && (!autocomplete.data?.enabled || !!addressSelection));
  const routeCalendar = type === "delivery" ? delivery.data?.schedule : undefined;
  const routeIntent = routeCalendar ? resolveDeliverySelection(routeCalendar, requestedIntent) : null;
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
    if (open && node && !node.open) {
      addressEdited.current = false;
      setEditingSavedAddress(false);
      setType(initialType);
      setAddress(selection.address ?? "");
      setAddressSelection(selection.addressSelection);
      setError("");
      setCheckingDelivery(false);
      setSignOutFailed(false);
      setRequestedIntent(initialDate && initialStart && initialEnd ? {scheduledFor: initialDate, selectedSlot: {start: initialStart, end: initialEnd}} : null);
      setScheduleRequested(!!initialDate);
      if (isDesktopPanel(anchor)) node.show();
      else node.showModal();
    } else if (!open) {
      generation.current++;
      node?.close();
    }
  }, [open, anchor, initialType, selection.address, selection.addressSelection, initialDate, initialStart, initialEnd]);
  useEffect(() => {
    if (step && !preview) heading.current?.focus({ preventScroll: true });
  }, [step, preview, showAccountChoice]);
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
    if (!open || !node || isDesktopPanel(anchor)) return;
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
    };
  }, [open, anchor]);
  useEffect(() => {
    const previous = previousCustomerId.current;
    previousCustomerId.current = customerId;
    if (previous === undefined || previous === customerId) return;

    // Do not carry an address or its proof into a different customer session.
    generation.current++;
    addressEdited.current = false;
    setAddress("");
    setAddressSelection(undefined);
    setEditingSavedAddress(false);
    setCheckingDelivery(false);
    setError("");
  }, [customerId]);
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
  useEffect(() => {
    if (editingSavedAddress && type === "delivery") {
      const form = heading.current?.closest("form");
      form?.querySelector<HTMLInputElement>('[role="combobox"]')?.focus({ preventScroll: true });
    }
  }, [editingSavedAddress, type]);
  const showSavedAddress = type === "delivery" && accountAccess && customerStatus === "authenticated" && !editingSavedAddress && !addressEdited.current &&
    !!profile.data?.address_selection?.token && address === profile.data.profile.address && addressSelection?.token === profile.data.address_selection.token;
  const searchingAddress = !showAccountChoice && type === "delivery" && !!autocomplete.data?.enabled && !addressSelection;
  const cover = design.modalCoverUrl || restaurant.coverUrl;
  const handleGuestSignOut = async () => {
    if (busy) return;
    setSigningOut(true);
    setSignOutFailed(false);
    try {
      await signOut();
      setGuestContinued(true);
      if (step || dialog.current?.open) heading.current?.focus({ preventScroll: true });
    } catch {
      setSignOutFailed(true);
    } finally {
      setSigningOut(false);
    }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      showAccountChoice || busy || !timingReady || paused || (type === "delivery" && (delivery.isPending || delivery.isFetching || delivery.isError)) ||
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
      setCheckingDelivery(true);
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
        if (result.schedule && !resolveDeliverySelection(result.schedule, requestedIntent)) {setError(copy.noTimes);return;}
        if (!result.resolved || !result.deliverable) {
          setError(result.resolved ? copy.outside : copy.unresolved);
          return;
        }
      } catch {
        if (generation.current === request) setError(copy.failure);
        return;
      } finally {
        if (generation.current === request) setCheckingDelivery(false);
      }
    }
    if (generation.current === request) {
      onConfirm({
        orderType: type,
        schedulingIntent: routeCalendar ? routeIntent : rules.canChooseTime && scheduled ? intent : null,
        ...(type === "delivery" ? { address: address.trim(), addressSelection } : {}),
      });
      if (!step) onClose();
    }
  };
  const form = (
      <form onSubmit={submit}>
        <header className="website-entry-heading">
          {step ? <>
            <button type="button" className="website-order-step-back" onClick={onClose}>
              <ArrowLeftIcon aria-hidden="true" className="rtl:rotate-180" />{copy.backToService}
            </button>
            <h1 id={titleId} ref={heading} tabIndex={-1}
              style={roleTextStyle(type === "pickup" ? "orderPickupTitle" : "orderDeliveryTitle",
                "clamp(1.875rem, 4.4vw, 3.625rem)", "display", "var(--type-display-lg-weight, 700)", "none", "var(--site-title, var(--text))")}>
              {showAccountChoice ? copy[type] : fulfillmentTitle}
            </h1>
          </> : <>
            <h2 id={titleId} ref={heading} tabIndex={-1}>{showAccountChoice ? t("entryChoiceTitle") : fulfillmentTitle}</h2>
            <button type="button" className="website-fulfillment-close" onClick={onClose} aria-label={copy.close} autoFocus>×</button>
          </>}
        </header>
        {!direct && !showAccountChoice && !(design.fulfillmentPanels && anchor) && design.modalCover && cover && (
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
        {!fixedMode && rules.canChooseMode && <div className="website-service-tabs" role="tablist">
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
        {showSignedIn && <div className="website-entry-account">
          <p className="website-entry-profile">
            <span>{t("entrySignedIn")}</span>{accountLabel && <> <bdi>{accountLabel}</bdi></>}
          </p>
          <button type="button" className="website-entry-sign-out" aria-disabled={busy || undefined} onClick={handleGuestSignOut}>
            {t(signingOut ? "entrySigningOut" : "entrySignOutAsGuest")}
          </button>
        </div>}
        {!direct && offerSignIn && accountAccess && customerStatus === "anonymous" && guestContinued && <button type="button" className="website-entry-back" disabled={busy} aria-label={t("entryBackToChoice")} onClick={() => { generation.current++; setGuestContinued(false); }}>{t("entryBack")}</button>}
        {showOptionalSignIn && <div className="website-entry-back website-entry-sign-in-link" inert={!preview && customerStatus === "loading" || undefined}>
          {preview ? <button type="button" className="customer-entry-optional-sign-in" disabled>{t("accountSignIn")}</button> : <CustomerSignIn variant="link" />}
        </div>}
        <div className="website-fulfillment-body" data-service={type}>
          {showAccountChoice ? <section className="website-entry-choice">
            <div className="website-entry-login">
              <div className="website-entry-login-action" inert={!preview && customerStatus === "loading" || undefined}>
                {preview ? <button type="button" className="customer-entry-sign-in" disabled aria-describedby={accountBenefitId}>{t("entryAccountAction")}</button>
                  : <CustomerSignIn variant="entry" descriptionId={accountBenefitId} />}
              </div>
              <p id={accountBenefitId}>{t(type === "delivery" ? "entryChoiceDeliveryBenefit" : "entryChoicePickupBenefit")}</p>
            </div>
            <button type="button" className="website-entry-guest" disabled={busy} onClick={() => {
              flushSync(() => setGuestContinued(true));
              if (type === "delivery") {
                const form = heading.current?.closest("form");
                form?.querySelector<HTMLInputElement>('input:is([role="combobox"], [autocomplete="street-address"])')?.focus({ preventScroll: true });
              }
            }}>{t("entryGuestAction")}</button>
          </section> : <>
          {showSignedIn && signOutFailed && <p role="alert" className="mb-3 text-sm">{t("entrySignOutError")}</p>}
          {accountAccess && customerStatus === "authenticated" && (profile.isFetching || profile.isError) && <div className="mb-5 space-y-2">
            {profile.isFetching && <p role="status" className="text-xs">{t("checkoutProfileLoading")}</p>}
            {profile.isError && <p role="alert" className="text-sm">{t("checkoutProfileLoadError")} <button type="button" onClick={() => void profile.refetch()}>{t("retry")}</button></p>}
          </div>}
          {showSavedAddress ? (
            <section className="website-entry-saved-address" aria-label={t("entrySavedDeliveryTitle")}>
              <MapPinIcon aria-hidden="true" />
              <div><p>{t("entrySavedDeliveryTitle")}</p><strong dir="auto">{address}</strong>{addressSelection?.city && <span dir="auto">{addressSelection.city}</span>}</div>
              <button type="button" disabled={busy} onClick={() => setEditingSavedAddress(true)}>{t("edit")}</button>
            </section>
          ) : type === "delivery" ? (
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
                  (step || design.fulfillmentPanels && anchor) && open && !preview
                    ? <WebsitePickupBranches chainSlug={restaurant.chainSlug} restaurantId={restaurant.id} onNavigate={onClose} />
                    : <a
                    className="website-pickup-change-branch"
                    href={`/c/${encodeURIComponent(restaurant.chainSlug)}/order?type=pickup&lang=${locale}`}
                  >
                    {copy.changeBranch}
                  </a>
                )}
            </>
          )}
          {type === "delivery" && delivery.data && (routeCalendar || delivery.data.offer_pickup || delivery.data.deliverable) && <DeliverySchedulePanel currency={restaurant.currency ?? "ILS"} result={delivery.data} selection={routeIntent} disabled={busy || delivery.isFetching} onChange={setRequestedIntent} list={design.fulfillmentPanels} onPickup={!fixedMode && restaurant.pickupEnabled ? () => {generation.current++;setType("pickup");setRequestedIntent(null);setScheduleRequested(false);setError("");} : undefined} />}
          {type === "delivery" && delivery.isFetching && address.trim() && <p role="status">{copy.checking}</p>}
          {type === "delivery" && delivery.isError && <p role="alert">{copy.failure} <button type="button" onClick={() => void delivery.refetch()}>{copy.retry}</button></p>}
          {type === "delivery" && delivery.data && !delivery.data.deliverable && <p role="alert">{delivery.data.resolved ? copy.outside : copy.unresolved}</p>}
          {paused && <p role="status">{t("rushMessage").replace("{name}", restaurant.name)}</p>}
          {!paused && !searchingAddress && !routeCalendar && rules.canChooseTime && <section className="website-schedule-options" aria-label={t("chooseATime")}>
            {schedule.isError ? <p role="alert">{copy.scheduleError} <button type="button" onClick={() => void schedule.refetch()}>{copy.retry}</button></p> : schedule.isPending || schedule.isFetching ? <p role="status">{copy.loadingTimes}</p> : <>
              {!scheduleRequired && <label><input type="radio" name="entry-time" checked={!scheduled} disabled={busy} onChange={() => setScheduleRequested(false)} /><span>{copy.asap}</span></label>}
              {intent && <>
                {scheduleRequired ? <p className="website-schedule-title">{t("chooseATime")}</p> : <label><input type="radio" name="entry-time" checked={scheduled} disabled={busy} onChange={() => setScheduleRequested(true)} /><span>{t("chooseATime")}</span></label>}
                {scheduled && <SchedulingFields slotsByDate={schedule.data!.slotsByDate} selection={intent} disabled={busy} list={design.fulfillmentPanels} onChange={value => { generation.current++; setRequestedIntent(value); }} />}
              </>}
              {!intent && scheduled && <p role="status">{copy.noTimes}</p>}
            </>}
          </section>}
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          </>}
        </div>
        {!showAccountChoice && <div className="website-fulfillment-footer">
          <button
            type="submit"
            className="website-view-menu"
            disabled={
              busy || !timingReady || paused || (type === "delivery" && (delivery.isPending || delivery.isFetching || delivery.isError || !delivery.data?.deliverable)) || (type === "pickup" ? !restaurant.pickupEnabled : !address.trim())
            }
          >
            {checkingDelivery ? copy.checking : editing ? copy.update : type === "delivery" ? showSavedAddress ? t("entrySavedDeliveryUse") : copy.confirmDelivery : copy.confirmPickup}
          </button>
        </div>}
      </form>
  );

  if (step) return <section className="website-order-step" aria-labelledby={titleId}>{form}</section>;

  return (
    <dialog
      ref={dialog}
      dir={direction}
      onCancel={onClose}
      aria-labelledby={titleId}
      className="website-fulfillment-dialog website-entry-dialog"
      data-panel={design.fulfillmentPanels && !!anchor || undefined}
      data-address-autocomplete={!showAccountChoice && type === "delivery" && !!autocomplete.data?.enabled}
      data-address-searching={searchingAddress}
      data-account-row={showSignedIn}
      data-entry-choice={showAccountChoice}
      data-optional-sign-in={showOptionalSignIn}
      data-field-checkout-offer-sign-in={offerSignIn}
      aria-busy={accountAccess && customerStatus === "loading" || undefined}
      style={orderFulfillmentColorVariables(config?.customPalette, design) as CSSProperties}
    >
      {form}
    </dialog>
  );
}
