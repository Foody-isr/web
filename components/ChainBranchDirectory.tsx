"use client";

import Link from "next/link";
import { ArrowRightIcon, ClockIcon, MapPinIcon, PhoneIcon, ShoppingBagIcon } from "@heroicons/react/24/outline";
import { useI18n } from "@/lib/i18n";
import type { ChainOrderEntry } from "@/services/api";
import { buildChainBranchOrderHref } from "@/lib/chainRouting";

const COPY = {
  fr: { eyebrow: "Nos adresses", title: "Trouvez votre boutique", subtitle: "Chaque boutique prépare ses commandes sur place. Choisissez celle qui vous convient avant de consulter sa carte.", open: "Ouvert", closed: "Fermé", paused: "Commandes en pause", order: "Commander", call: "Appeler", primary: "Boutique principale" },
  en: { eyebrow: "Our locations", title: "Find your shop", subtitle: "Every shop prepares orders on site. Choose your location before viewing its menu.", open: "Open", closed: "Closed", paused: "Orders paused", order: "Order", call: "Call", primary: "Main shop" },
  he: { eyebrow: "הסניפים שלנו", title: "מצאו את הסניף שלכם", subtitle: "כל סניף מכין את ההזמנות במקום. בחרו סניף לפני הצגת התפריט.", open: "פתוח", closed: "סגור", paused: "ההזמנות מושהות", order: "להזמנה", call: "טלפון", primary: "סניף ראשי" },
} as const;

export function ChainBranchDirectory({ entry }: { entry: ChainOrderEntry }) {
  const { locale } = useI18n();
  const copy = COPY[locale];
  return (
    <section className="border-y border-[var(--divider)] bg-[var(--surface)] px-4 py-14 sm:px-6 md:py-20" aria-labelledby="branch-directory-title">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <p className="text-xs font-extrabold uppercase tracking-[.22em] text-[var(--brand)]">{copy.eyebrow}</p>
          <h1 id="branch-directory-title" className="mt-3 text-4xl font-black tracking-[-.04em] text-[var(--text)] md:text-6xl">{copy.title}</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-[var(--text-muted)]">{copy.subtitle}</p>
        </div>
        <div className="mt-10 grid gap-px overflow-hidden rounded-3xl border border-[var(--divider)] bg-[var(--divider)] md:grid-cols-2">
          {entry.branches.map((branch, index) => {
            const orderHref = buildChainBranchOrderHref({ slug: branch.slug, restaurantId: branch.restaurantId, primaryRestaurantId: entry.chain.primaryRestaurantId, orderType: "pickup", locale });
            const status = branch.ordersPaused ? copy.paused : branch.isOpen ? copy.open : copy.closed;
            return (
              <article key={branch.restaurantId} className="group relative flex min-h-72 flex-col bg-[var(--surface)] p-6 transition-colors hover:bg-[var(--surface-elevated)] md:p-8">
                <div className="flex items-start justify-between gap-4">
                  <span className="font-mono text-xs font-bold tracking-[.18em] text-[var(--text-soft)]">{String(index + 1).padStart(2, "0")}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${branch.isOpen && !branch.ordersPaused ? "bg-emerald-500/12 text-emerald-600" : "bg-[var(--surface-subtle)] text-[var(--text-muted)]"}`}>{status}</span>
                </div>
                <div className="mt-8 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-extrabold tracking-[-.025em] text-[var(--text)]">{branch.name}</h2>
                    {entry.chain.primaryRestaurantId === branch.restaurantId && <span className="rounded-md bg-[var(--brand)]/10 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[var(--brand)]">{copy.primary}</span>}
                  </div>
                  {branch.shortDescription && <p className="mt-3 leading-6 text-[var(--text-muted)]">{branch.shortDescription}</p>}
                  <div className="mt-5 space-y-2 text-sm text-[var(--text-muted)]">
                    {branch.address && <p className="flex items-start gap-2"><MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand)]" />{branch.address}</p>}
                    {(branch.openingHours || branch.nextOpening) && <p className="flex items-start gap-2"><ClockIcon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand)]" />{branch.isOpen ? branch.openingHours : branch.nextOpening}</p>}
                  </div>
                </div>
                <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-[var(--divider)] pt-5">
                  <Link href={orderHref} className="inline-flex items-center gap-2 rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-extrabold text-white transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] motion-reduce:transform-none"><ShoppingBagIcon className="h-4 w-4" />{copy.order}<ArrowRightIcon className="h-4 w-4 rtl:rotate-180" /></Link>
                  {branch.phone && <a href={`tel:${branch.phone}`} className="inline-flex items-center gap-2 rounded-full border border-[var(--divider)] px-4 py-2.5 text-sm font-bold text-[var(--text)] hover:border-[var(--brand)]"><PhoneIcon className="h-4 w-4" />{copy.call}</a>}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
