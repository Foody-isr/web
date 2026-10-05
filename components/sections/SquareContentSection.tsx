"use client";
import { useEffect, useState, type ReactNode } from "react";
import type { SectionProps } from "./SectionRenderer";
import { getSectionBg } from "./sectionBg";
import { getFieldStyle } from "./typography";
import {
  websiteContentUrl,
  websiteMediaUrl,
  websiteVideoEmbed,
} from "@/lib/websiteComponents";
import { resolveRestaurantWebsiteHref } from "@/lib/restaurantWebsiteLink";
import { submitWebsiteForm, fetchWebsiteFeed } from "@/services/api";
import { usePreviewMode } from "@/lib/preview-mode";
import { useI18n } from "@/lib/i18n";

/** Renders the content primitives offered by the Square-style catalogue. */
export function SquareContentSection({ section, restaurant }: SectionProps) {
  const { t } = useI18n();
  const preview = usePreviewMode();
  const c = section.content,
    s = section.settings,
    type = section.sectionType;
  const bg = getSectionBg(s, "site");
  const link = websiteContentUrl(c.cta_link);
  const href = link
    ? resolveRestaurantWebsiteHref(
        link,
        restaurant.slug || String(restaurant.id),
      )
    : null;
  const title =
    c.title && s.show_title !== false ? (
      <h2
        data-editor-field="title"
        className="text-3xl md:text-4xl leading-tight"
        style={getFieldStyle(s, "title")}
      >
        {String(c.title)}
      </h2>
    ) : null;
  const body =
    c.body && s.show_body !== false ? (
      <p
        data-editor-field="body"
        className="text-base leading-relaxed whitespace-pre-line"
        style={getFieldStyle(s, "body")}
      >
        {String(c.body)}
      </p>
    ) : null;
  const button =
    c.cta_text && s.show_cta_text !== false ? (
      <a
        data-editor-field="cta_text"
        href={href ?? undefined}
        aria-disabled={!href}
        className="inline-flex items-center justify-center px-7 py-3.5 bg-[var(--brand)] text-[var(--on-brand,white)] rounded-[var(--site-button-radius,999px)]"
        style={getFieldStyle(s, "cta_text")}
      >
        {String(c.cta_text)}
      </a>
    ) : null;
  let content: ReactNode;
  if (type === "location_hours")
    content = (
      <div
        className={`grid gap-12 items-start ${section.layout === "text_only" ? "" : "md:grid-cols-2"}`}
      >
        <div
          className={
            section.layout === "map_left" ? "md:order-2 space-y-5" : "space-y-5"
          }
        >
          {title}
          <h3>{restaurant.name}</h3>
          {c.show_address !== false && (
            <p className="whitespace-pre-line">{restaurant.address}</p>
          )}
          {c.show_phone !== false && restaurant.phone && (
            <a className="block underline" href={`tel:${restaurant.phone}`}>
              {restaurant.phone}
            </a>
          )}
          {c.show_hours !== false && (
            <p className="whitespace-pre-line">{restaurant.openingHours}</p>
          )}
        </div>
        {section.layout !== "text_only" &&
          c.show_map !== false &&
          restaurant.address && (
            <iframe
              title={String(c.title || restaurant.name)}
              className="w-full min-h-[360px] border-0"
              loading="lazy"
              referrerPolicy="no-referrer"
              src={`https://maps.google.com/maps?q=${encodeURIComponent(restaurant.address)}&output=embed`}
            />
          )}
      </div>
    );
  else if (type === "forms" || type === "newsletter")
    content = (
      <div
        className={`grid gap-8 ${section.layout === "split" ? "md:grid-cols-2" : "max-w-2xl mx-auto"}`}
      >
        <div className="space-y-4">
          {title}
          {body}
        </div>
        <WebsiteForm section={section} restaurant={restaurant} />
      </div>
    );
  else if (type === "video") {
    const embed = websiteVideoEmbed(c.video_url),
      url = websiteMediaUrl(c.video_url);
    content = (
      <div className="space-y-8">
        {title}
        {embed ? (
          <iframe
            title={String(c.title || "Video")}
            src={embed}
            className="w-full aspect-video"
            allow="fullscreen; picture-in-picture"
            allowFullScreen
          />
        ) : url ? (
          <video
            controls
            preload="metadata"
            poster={websiteMediaUrl(c.poster_url) ?? undefined}
            className="w-full"
            src={url}
          />
        ) : preview ? (
          <div className="aspect-video bg-black/5 grid place-items-center">
            {t("websiteMediaEmpty")}
          </div>
        ) : null}
      </div>
    );
  } else if (type === "pdf") {
    const url = websiteMediaUrl(c.file_url);
    content = (
      <div className="space-y-8">
        {title}
        {url ? (
          <div className="space-y-4">
            <iframe
              src={url}
              title={String(c.title || "PDF")}
              className="w-full h-[720px] border-0"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            <a href={url} className="underline">
              {String(c.title || "PDF")}
            </a>
          </div>
        ) : preview ? (
          <div className="h-80 bg-black/5 grid place-items-center">
            {t("websiteMediaEmpty")}
          </div>
        ) : null}
      </div>
    );
  } else if (type === "embed")
    content = c.code ? (
      <iframe
        title={String(c.title || "Embedded content")}
        sandbox="allow-scripts allow-forms allow-popups"
        referrerPolicy="no-referrer"
        srcDoc={String(c.code)}
        className="w-full border-0"
        style={{
          height: Math.max(80, Math.min(1600, Number(s.height_px) || 400)),
        }}
      />
    ) : preview ? (
      <div className="h-40 bg-black/5 grid place-items-center">
        {t("websiteMediaEmpty")}
      </div>
    ) : null;
  else if (type === "rss_feed")
    content = (
      <div className="space-y-8">
        {title}
        <WebsiteFeed
          url={String(c.feed_url || "")}
          grid={section.layout === "grid"}
        />
      </div>
    );
  else if (type === "featured_categories" || type === "events")
    content = (
      <div className="space-y-8">
        {title}
        <div
          className={
            section.layout === "list"
              ? "divide-y divide-current/15"
              : section.layout === "carousel"
                ? "flex gap-6 overflow-x-auto snap-x"
                : "grid sm:grid-cols-2 lg:grid-cols-4 gap-6"
          }
        >
          {(Array.isArray(c.cards) ? c.cards : []).map(
            (card: Record<string, string>, i: number) => {
              const target = websiteContentUrl(card.link);
              return (
                <a
                  key={i}
                  href={
                    target
                      ? (resolveRestaurantWebsiteHref(
                          target,
                          restaurant.slug || String(restaurant.id),
                        ) ?? undefined)
                      : undefined
                  }
                  className="block min-w-0 py-4 space-y-4 snap-start"
                >
                  {websiteMediaUrl(card.image_url) && (
                    <div
                      className="aspect-square bg-center bg-cover"
                      style={{
                        backgroundImage: `url(${JSON.stringify(card.image_url)})`,
                      }}
                    />
                  )}
                  <h3 className="text-xl">{card.title}</h3>
                  {card.date && <p>{card.date}</p>}
                  {card.body && <p>{card.body}</p>}
                </a>
              );
            },
          )}
        </div>
      </div>
    );
  else
    content = (
      <div
        className={`grid gap-6 ${section.layout === "split" ? "md:grid-cols-2 text-start" : "max-w-3xl mx-auto"}`}
      >
        <div className="space-y-4">
          {type === "donation" && websiteMediaUrl(c.image_url) && (
            <div
              data-editor-field="image_url"
              role="img"
              aria-label={String(c.title || "")}
              className="aspect-[4/3] bg-cover bg-center"
              style={{ backgroundImage: `url(${JSON.stringify(c.image_url)})` }}
            />
          )}
          {title}
          {c.subtitle && (
            <h3 data-editor-field="subtitle" className="text-xl">
              {String(c.subtitle)}
            </h3>
          )}
        </div>
        <div className="space-y-6">
          {body}
          {button}
        </div>
      </div>
    );
  return (
    <section
      className={`${bg.className} ${s.padding === "compact" ? "py-8" : s.padding === "spacious" ? "py-24" : "py-16"} px-6 md:px-12`}
      style={{
        ...bg.style,
        textAlign:
          s.text_alignment === "left"
            ? "start"
            : s.text_alignment === "right"
              ? "end"
              : "center",
      }}
    >
      <div
        className={
          section.layout === "full_width" ? "" : "max-w-[1200px] mx-auto"
        }
      >
        {content}
      </div>
    </section>
  );
}

function WebsiteForm({ section, restaurant }: SectionProps) {
  const { t } = useI18n();
  const preview = usePreviewMode();
  const [status, setStatus] = useState<"idle" | "sending" | "saved" | "failed">(
    "idle",
  );
  const fields: Array<{
    id: string;
    label: string;
    type: string;
    required?: boolean;
  }> = Array.isArray(section.content.fields) ? section.content.fields : [];
  if (status === "saved") return <p role="status">{t("websiteFormSaved")}</p>;
  return (
    <form
      className="space-y-5 text-start"
      onSubmit={async (event) => {
        event.preventDefault();
        if (preview || status === "sending") return;
        const data = new FormData(event.currentTarget),
          values = Object.fromEntries(
            fields.map((field) => [field.id, String(data.get(field.id) ?? "")]),
          );
        setStatus("sending");
        try {
          await submitWebsiteForm(
            restaurant.slug || String(restaurant.id),
            section.id,
            values,
            String(data.get("_website") ?? ""),
          );
          setStatus("saved");
        } catch {
          setStatus("failed");
        }
      }}
    >
      <input
        type="text"
        name="_website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />
      {fields.map((field) => (
        <label key={field.id} className="block text-sm font-medium">
          {field.label}
          {field.required ? " *" : ""}
          {field.type === "textarea" ? (
            <textarea
              name={field.id}
              required={field.required}
              maxLength={10000}
              rows={4}
              className="block w-full mt-2 border border-current/30 rounded-md bg-transparent p-4"
            />
          ) : (
            <input
              name={field.id}
              type={
                ["email", "tel", "date", "number"].includes(field.type)
                  ? field.type
                  : "text"
              }
              required={field.required}
              maxLength={10000}
              className="block w-full mt-2 border border-current/30 rounded-md bg-transparent p-4"
            />
          )}
        </label>
      ))}
      <button
        disabled={status === "sending" || preview}
        className="px-8 py-3.5 rounded-[var(--site-button-radius,999px)] bg-[var(--brand)] text-[var(--on-brand,white)] disabled:opacity-60"
        type="submit"
      >
        {status === "sending"
          ? t("websiteFormSending")
          : String(section.content.cta_text || "Send")}
      </button>
      {preview && (
        <p className="text-sm opacity-70">{t("websiteFormPreview")}</p>
      )}
      {status === "failed" && <p role="alert">{t("websiteFormFailed")}</p>}
    </form>
  );
}
function WebsiteFeed({ url, grid }: { url: string; grid: boolean }) {
  const { t } = useI18n();
  const [items, setItems] = useState<
    Array<{ title: string; link: string; body: string }>
  >([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    setItems([]);
    setError(false);
    if (!url) return;
    const controller = new AbortController();
    fetchWebsiteFeed(url, controller.signal)
      .then((xml) => {
        const doc = new DOMParser().parseFromString(xml, "application/xml");
        if (doc.querySelector("parsererror")) throw new Error("invalid_feed");
        setItems(
          Array.from(doc.querySelectorAll("item,entry"))
            .slice(0, 12)
            .map((node) => ({
              title: node.querySelector("title")?.textContent || "",
              link:
                node.querySelector("link")?.getAttribute("href") ||
                node.querySelector("link")?.textContent ||
                "",
              body:
                new DOMParser().parseFromString(
                  node.querySelector("description,summary")?.textContent || "",
                  "text/html",
                ).body.textContent || "",
            })),
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [url]);
  return error ? (
    <p role="alert">{t("websiteFeedError")}</p>
  ) : (
    <div className={grid ? "grid md:grid-cols-3 gap-8" : "space-y-8"}>
      {items.map((item, i) => (
        <article key={i}>
          <h3 className="text-xl mb-3">
            <a href={websiteContentUrl(item.link) ?? undefined}>{item.title}</a>
          </h3>
          <p>{item.body}</p>
        </article>
      ))}
    </div>
  );
}
