"use client";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { Restaurant } from "@/lib/types";
import type { WebsiteOrderDesign } from "@/lib/websiteOrder";
import { websiteOrderCopy } from "@/lib/websiteOrder";
import { checkDeliveryAddress } from "@/services/api";
import type { WebsiteOrderSelection } from "@/store/useWebsiteOrderStore";

/** The storefront entry dialog selects a real service and checks delivery before showing its menu. */
export function WebsiteFulfillmentDialog({
  open,
  restaurant,
  design,
  selection,
  onClose,
  onConfirm,
  onInfo,
}: {
  open: boolean;
  restaurant: Restaurant;
  design: WebsiteOrderDesign;
  selection: WebsiteOrderSelection;
  onClose: () => void;
  onConfirm: (selection: WebsiteOrderSelection) => void;
  onInfo: () => void;
}) {
  const { locale, direction } = useI18n();
  const copy = websiteOrderCopy(locale);
  const dialog = useRef<HTMLDialogElement>(null);
  const [type, setType] = useState(selection.orderType);
  const [address, setAddress] = useState(selection.address ?? "");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    const node = dialog.current;
    if (open) {
      setType(selection.orderType);
      setAddress(selection.address ?? "");
      setError("");
      setBusy(false);
      node?.showModal();
    } else node?.close();
    return () => {
      // This is a request counter, not a DOM ref: invalidate any pending address check.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
      node?.close();
    };
  }, [open, selection.orderType, selection.address]);
  const cover = restaurant.coverUrl;
  const locationMatches =
    !query.trim() ||
    `${restaurant.name} ${restaurant.address ?? ""}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase());
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      busy ||
      (type === "pickup"
        ? !restaurant.pickupEnabled || !locationMatches
        : !restaurant.deliveryEnabled || !address.trim())
    )
      return;
    const request = ++generation.current;
    if (type === "delivery") {
      setBusy(true);
      setError("");
      try {
        const result = await checkDeliveryAddress({
          restaurantId: String(restaurant.id),
          address: address.trim(),
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
        ...(type === "delivery" ? { address: address.trim() } : {}),
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
    >
      <form onSubmit={submit}>
        {design.modalCover && cover && (
          <div
            className="website-fulfillment-cover"
            style={{ backgroundImage: `url(${JSON.stringify(cover)})` }}
          >
            {design.modalLogo && restaurant.logoUrl && (
              <img src={restaurant.logoUrl} alt={restaurant.name} />
            )}
          </div>
        )}
        <button
          type="button"
          className="website-fulfillment-close"
          onClick={onClose}
          aria-label={copy.close}
        >
          ×
        </button>
        <div className="website-fulfillment-body">
          <div className="website-service-tabs" role="tablist">
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
                    setType(mode);
                    setError("");
                  }}
                >
                  {copy[mode]}
                </button>
              ))}
          </div>
          <h2 id="website-fulfillment-title">
            {type === "delivery" ? copy.address : copy.choose}
          </h2>
          {type === "delivery" ? (
            <input
              aria-label={copy.addressField}
              autoComplete="street-address"
              placeholder={copy.addressField}
              value={address}
              disabled={busy}
              required
              onChange={(event) => {
                setAddress(event.target.value);
                setError("");
              }}
            />
          ) : (
            <>
              <label className="website-store-search">
                {copy.nearest}
                <input
                  placeholder={copy.storeSearch}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              {locationMatches && (
                <div className="website-pickup-location">
                  <label>
                    <input type="radio" name="location" checked readOnly />
                    <span>
                      <strong>{restaurant.name}</strong>
                      <span>{restaurant.address}</span>
                    </span>
                  </label>
                  <button type="button" onClick={onInfo}>
                    {copy.info}
                  </button>
                </div>
              )}
              {restaurant.chainSlug &&
                (restaurant.chainBranchCount ?? 0) > 1 && (
                  <a
                    href={`/c/${encodeURIComponent(restaurant.chainSlug)}/order?type=pickup`}
                  >
                    {copy.changeBranch}
                  </a>
                )}
            </>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="website-view-menu"
            disabled={
              busy || (type === "pickup" ? !locationMatches : !address.trim())
            }
          >
            {busy ? copy.checking : copy.view}
          </button>
        </div>
      </form>
    </dialog>
  );
}
