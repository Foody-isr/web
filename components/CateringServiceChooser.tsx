"use client";

import type { Locale } from "@/lib/i18n";
import { cateringServicePath } from "@/lib/cateringRoutes";
import { tField, type TranslatableEntity } from "@/lib/translations";
import type { CateringServicePublic } from "@/services/api";

type Translate = (key: string) => string;

type Props = {
  restaurantName: string;
  restaurantSlug: string;
  services: CateringServicePublic[];
  locale: Locale;
  t: Translate;
  standalone: boolean;
  loadingServiceId: number | null;
  onSelect: (service: CateringServicePublic) => void;
};

function serviceField(
  service: CateringServicePublic,
  field: "name" | "description",
  locale: Locale,
): string {
  return tField(
    service as unknown as TranslatableEntity,
    field,
    locale,
    service[field],
  );
}

function serviceFallback(
  service: CateringServicePublic,
  t: Translate,
): string {
  if (service.pricingModel === "per_person") {
    return t("catering_service_per_person_hint");
  }
  if (service.pricingModel === "per_unit") {
    return t("catering_service_per_unit_hint");
  }
  return t("catering_service_custom_quote_hint");
}

function TableSettingMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 320 256"
      fill="none"
      className="pointer-events-none mx-auto h-auto w-56 max-w-full text-[var(--catering-accent,var(--brand))] sm:w-80 lg:mx-0"
    >
      <circle cx="160" cy="128" r="105" stroke="currentColor" opacity=".25" />
      <circle cx="160" cy="128" r="68" stroke="currentColor" opacity=".6" />
      <circle cx="160" cy="128" r="20" fill="currentColor" opacity=".9" />
      <path d="M20 38v180M32 38v180" stroke="currentColor" opacity=".45" />
      <path d="M299 69v149" stroke="currentColor" strokeWidth="2" opacity=".55" />
      <ellipse cx="299" cy="42" rx="12" ry="26" stroke="currentColor" opacity=".55" />
    </svg>
  );
}

function ServiceList({
  restaurantSlug,
  services,
  locale,
  t,
  loadingServiceId,
  onSelect,
}: Pick<
  Props,
  | "restaurantSlug"
  | "services"
  | "locale"
  | "t"
  | "loadingServiceId"
  | "onSelect"
>) {
  return (
    <div className="border-y border-[var(--divider)]">
      {services.map((service, index) => {
        const description =
          serviceField(service, "description", locale).trim() ||
          serviceFallback(service, t);
        const loading = loadingServiceId === service.id;
        const anotherServiceIsLoading =
          loadingServiceId !== null && !loading;

        return (
          <a
            key={service.id}
            href={cateringServicePath(restaurantSlug, service.slug)}
            data-catering-service={service.id}
            aria-disabled={loadingServiceId !== null}
            aria-busy={loading || undefined}
            onClick={(event) => {
              if (loadingServiceId !== null) {
                event.preventDefault();
                return;
              }
              if (
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              ) {
                return;
              }
              event.preventDefault();
              onSelect(service);
            }}
            className={`group relative grid min-h-32 grid-cols-[2.5rem_minmax(0,1fr)_3rem] items-center gap-3 border-b border-[var(--divider)] px-1 py-5 text-start transition-colors last:border-b-0 hover:bg-[var(--surface-subtle)] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--catering-accent,var(--brand))] sm:grid-cols-[3.5rem_minmax(0,1fr)_8.5rem] sm:gap-5 sm:px-4 ${anotherServiceIsLoading ? "pointer-events-none opacity-45" : ""}`}
          >
            <span className="self-start pt-1 text-xs font-semibold tabular-nums text-[var(--text-muted)]">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="min-w-0">
              <span
                className="block text-2xl font-semibold leading-tight tracking-[-0.025em] text-[var(--text)] sm:text-3xl"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {serviceField(service, "name", locale)}
              </span>
              <span className="mt-2 block max-w-2xl text-sm leading-6 text-[var(--text-muted)] sm:text-base">
                {description}
              </span>
            </span>
            <span className="flex items-center justify-end">
              <span className="hidden text-sm font-semibold text-[var(--catering-accent,var(--brand))] sm:block">
                {loading ? t("catering_service_loading") : t("catering_service_open")}
              </span>
              <span
                className={`ms-3 grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[var(--catering-accent,var(--brand))] text-[var(--catering-accent,var(--brand))] transition-[background-color,color,transform] group-hover:translate-x-0.5 group-hover:bg-[var(--catering-accent,var(--brand))] group-hover:text-[var(--catering-button-ink,var(--ink-on-accent))] motion-reduce:transition-none rtl:group-hover:-translate-x-0.5 ${loading ? "animate-pulse bg-[var(--catering-accent,var(--brand))] text-[var(--catering-button-ink,var(--ink-on-accent))] motion-reduce:animate-none" : ""}`}
              >
                {loading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-e-transparent motion-reduce:animate-none" />
                ) : (
                  <svg
                    viewBox="0 0 20 20"
                    className="h-5 w-5 rtl:rotate-180"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M4 10h11m-4-4 4 4-4 4"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
            </span>
          </a>
        );
      })}
    </div>
  );
}

function HowItWorks({ t }: { t: Translate }) {
  const steps = [
    ["catering_how_choose", "catering_how_choose_hint"],
    ["catering_how_customize", "catering_how_customize_hint"],
    ["catering_how_quote", "catering_how_quote_hint"],
  ];

  return (
    <ol className="mt-10 grid gap-px overflow-hidden border border-[var(--divider)] bg-[var(--divider)] sm:grid-cols-3 lg:mt-12 lg:grid-cols-1 xl:grid-cols-3">
      {steps.map(([titleKey, hintKey], index) => (
        <li
          key={titleKey}
          className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 bg-[var(--catering-bg,var(--bg-page))] p-4"
        >
          <span className="text-xs font-semibold tabular-nums text-[var(--catering-accent,var(--brand))]">
            {index + 1}
          </span>
          <span>
            <span className="block text-sm font-semibold text-[var(--text)]">
              {t(titleKey)}
            </span>
            <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">
              {t(hintKey)}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Presents the catering hub as a guided, branded entry to the quote flow. */
export function CateringServiceChooser({
  restaurantName,
  restaurantSlug,
  services,
  locale,
  t,
  standalone,
  loadingServiceId,
  onSelect,
}: Props) {
  if (!standalone) {
    return (
      <section
        aria-labelledby="catering-service-heading"
        className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8"
      >
        <div className="mb-8 max-w-2xl">
          <h2
            id="catering-service-heading"
            className="text-3xl font-semibold tracking-[-0.025em] text-[var(--text)] sm:text-4xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("catering_choose_service")}
          </h2>
          <p className="mt-3 text-base leading-7 text-[var(--text-muted)]">
            {t("catering_choose_service_hint")}
          </p>
        </div>
        <ServiceList
          restaurantSlug={restaurantSlug}
          services={services}
          locale={locale}
          t={t}
          loadingServiceId={loadingServiceId}
          onSelect={onSelect}
        />
      </section>
    );
  }

  return (
    <section
      aria-labelledby="catering-service-heading"
      className="relative flex flex-1 border-t border-[var(--divider)]"
    >
      <div className="mx-auto grid w-full max-w-[100rem] lg:min-h-[calc(100svh-var(--nav-sticky-h,0px)-5rem)] lg:grid-cols-[minmax(21rem,0.82fr)_minmax(35rem,1.18fr)]">
        <div
          className="relative isolate flex min-h-[30rem] flex-col justify-between overflow-hidden border-b border-[var(--divider)] px-5 py-8 sm:min-h-[34rem] sm:px-10 sm:py-14 lg:min-h-0 lg:border-b-0 lg:border-e"
          style={{
            background:
              "radial-gradient(circle at 82% 88%, color-mix(in srgb, var(--catering-accent,var(--brand)) 18%, transparent) 0, transparent 38%), linear-gradient(145deg, var(--surface-subtle), var(--catering-bg,var(--bg-page)))",
          }}
        >
          <div className="relative z-10 max-w-xl">
            <p className="text-sm font-semibold text-[var(--catering-accent,var(--brand))]">
              {restaurantName}
            </p>
            <h1
              className="mt-5 text-[clamp(2.8rem,13vw,5rem)] font-semibold leading-[0.92] tracking-[-0.055em] text-[var(--text)] sm:text-[clamp(3.25rem,7vw,6.75rem)] lg:text-[clamp(3.4rem,5.5vw,6.75rem)]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {t("catering_landing_headline")}
            </h1>
            <p className="mt-7 max-w-lg text-base leading-7 text-[var(--text-muted)] sm:text-lg sm:leading-8">
              {t("catering_landing_intro")}
            </p>
          </div>
          <div className="relative z-0 mt-8 flex justify-end sm:mt-10 lg:mt-16">
            <TableSettingMark />
          </div>
        </div>

        <div className="flex flex-col justify-center px-5 py-10 sm:px-10 sm:py-14 lg:px-12 xl:px-16">
          <div className="mb-7">
            <div className="max-w-2xl">
              <h2
                id="catering-service-heading"
                className="text-3xl font-semibold tracking-[-0.025em] text-[var(--text)] sm:text-4xl"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {t("catering_choose_service")}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[var(--text-muted)] sm:text-base">
                {t("catering_choose_service_hint")}
              </p>
            </div>
          </div>

          <ServiceList
            restaurantSlug={restaurantSlug}
            services={services}
            locale={locale}
            t={t}
            loadingServiceId={loadingServiceId}
            onSelect={onSelect}
          />
          <HowItWorks t={t} />
        </div>
      </div>
    </section>
  );
}
