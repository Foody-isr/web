"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import {
  ApiError,
  enrollLoyaltyMembership,
  fetchLoyaltyMembership,
  fetchLoyaltyProgram,
} from "@/services/api";
import { useGuestAccount } from "@/store/useGuestAccount";
import { useI18n } from "@/lib/i18n";
import {
  clearLoyaltyEnrollment,
  readLoyaltyEnrollment,
  saveLoyaltyEnrollment,
  type LoyaltyEnrollmentIntent,
} from "@/lib/loyalty";
import type {
  LoyaltyMembership,
  LoyaltyMembershipSnapshot,
  LoyaltyProgram,
  Restaurant,
} from "@/lib/types";
import { CustomerSignIn } from "./CustomerSignIn";
import { LoyaltyWalletPanel, LoyaltyWalletNotice } from "./LoyaltyWalletPanel";
import { LoyaltyRewardsPanel } from "./LoyaltyRewardsPanel";
import { LanguageToggle } from "./LanguageToggle";

const replace = (copy: string, key: string, value: string | number) =>
  copy.replace(`{${key}}`, String(value));
const ownerChanged = (error: unknown) =>
  error instanceof ApiError &&
  (error.status === 401 || error.message === "loyalty_session_changed");
const knownRejection = (error: unknown) =>
  error instanceof ApiError &&
  !ownerChanged(error) &&
  error.status !== undefined &&
  [400, 409, 413, 415, 422].includes(error.status);
const enrollmentMatches = (
  snapshot: LoyaltyMembershipSnapshot | undefined,
  intent: LoyaltyEnrollmentIntent,
) =>
  snapshot?.membership?.status === "active" &&
  snapshot.program?.id === intent.input.program_id &&
  snapshot.membership.accepted_terms_version ===
    intent.input.accepted_terms_version;

function useLivePage() {
  const path = usePathname();
  const [ready, setReady] = useState(false),
    [browserPath, setBrowserPath] = useState("/r/");
  useEffect(() => {
    setBrowserPath(window.location.pathname);
    setReady(
      window.self === window.top &&
        !new URLSearchParams(window.location.search).has("preview"),
    );
  }, [path]);
  return { ready, browserPath };
}
function href(
  restaurant: Restaurant,
  path: "order" | "orders" | "account/loyalty",
  browserPath: string,
) {
  return browserPath.startsWith("/r/")
    ? `/r/${encodeURIComponent(restaurant.slug || String(restaurant.id))}/${path}`
    : `/${path}`;
}
function publicQuery(rid: number) {
  return ["loyalty-program", rid] as const;
}
function privateQuery(rid: number, account: number) {
  return ["loyalty-membership", rid, account] as const;
}

/** A local preview state performs no loyalty query. */
export function LoyaltyUnavailable() {
  const { t, direction } = useI18n();
  return (
    <main
      dir={direction}
      className="commerce-surface min-h-screen bg-[var(--bg-page)] px-5 py-16 text-[var(--text)]"
    >
      <div className="mx-auto max-w-lg space-y-4">
        <h1 className="text-2xl font-bold">{t("loyaltyTitle")}</h1>
        <p className="leading-7 text-[var(--text-muted)]">
          {t("loyaltyUnavailable")}
        </p>
      </div>
    </main>
  );
}

/** Render public terms, then an independently authenticated, account-scoped journey. */
export function LoyaltyCustomerContent({
  restaurant,
}: {
  restaurant: Restaurant;
}) {
  const { t, direction } = useI18n();
  const { ready, browserPath } = useLivePage();
  const status = useGuestAccount((s) => s.status),
    account = useGuestAccount((s) => s.account);
  const program = useQuery({
    queryKey: publicQuery(restaurant.id),
    queryFn: ({ signal }) => fetchLoyaltyProgram(restaurant.id, signal),
    enabled: ready,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
  });
  if (!ready)
    return (
      <p role="status" className="p-6">
        {t("loading")}
      </p>
    );
  return (
    <main
      dir={direction}
      className="commerce-surface min-h-screen bg-[var(--bg-page)] text-[var(--text)]"
    >
      <header className="border-b border-[var(--divider)] bg-[var(--surface)] px-5 py-4">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <Link
              className="inline-flex min-h-9 items-center text-sm underline underline-offset-4"
              href={href(restaurant, "order", browserPath)}
            >
              {replace(t("loyaltyBack"), "name", restaurant.name)}
            </Link>
            <h1 className="text-2xl font-bold">{t("loyaltyTitle")}</h1>
          </div>
          <LanguageToggle dropdownPlacement="below" />
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-5 py-8 sm:py-12">
        <LoyaltyWalletNotice />
        {status === "loading" ? (
          <p role="status">{t("loading")}</p>
        ) : status === "authenticated" && account ? (
          <MemberSession
            key={`${restaurant.id}:${account.id}`}
            restaurant={restaurant}
            account={account.id}
            publicProgram={program.data}
            publicError={program.isError}
            refreshProgram={() => program.refetch()}
          />
        ) : program.isPending ? (
          <p role="status">{t("loading")}</p>
        ) : program.data ? (
          <ProgramLayout
            restaurant={restaurant}
            program={program.data}
            action={
              <div className="space-y-4">
                <p className="text-sm leading-6">{t("loyaltySignInHint")}</p>
                <CustomerSignIn variant="entry" />
              </div>
            }
          />
        ) : (
          <div className="max-w-lg space-y-5">
            <p
              role={
                program.isError &&
                !(
                  program.error instanceof ApiError &&
                  program.error.status === 404
                )
                  ? "alert"
                  : undefined
              }
            >
              {t(
                program.error instanceof ApiError &&
                  program.error.status === 404
                  ? "loyaltyUnavailable"
                  : "loyaltyReadError",
              )}
            </p>
            <button
              className="commerce-secondary"
              onClick={() => void program.refetch()}
            >
              {t("loyaltyRefresh")}
            </button>
            <p className="text-sm text-[var(--text-muted)]">
              {t("loyaltyExistingMember")}
            </p>
            <CustomerSignIn variant="entry" />
          </div>
        )}
      </div>
    </main>
  );
}

function MemberSession(props: {
  restaurant: Restaurant;
  account: number;
  publicProgram?: LoyaltyProgram;
  publicError: boolean;
  refreshProgram: () => Promise<unknown>;
}) {
  const { t } = useI18n();
  const [verified, setVerified] = useState(true);
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      setVerified(false);
      await useGuestAccount.getState().hydrateSession();
      if (alive && useGuestAccount.getState().account?.id === props.account)
        setVerified(true);
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") setVerified(false);
      else void refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      alive = false;
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [props.account]);
  return verified ? (
    <MemberJourney {...props} />
  ) : (
    <p role="status">{t("loyaltyCheckingSession")}</p>
  );
}

function MemberJourney({
  restaurant,
  account,
  publicProgram,
  publicError,
  refreshProgram,
}: {
  restaurant: Restaurant;
  account: number;
  publicProgram?: LoyaltyProgram;
  publicError: boolean;
  refreshProgram: () => Promise<unknown>;
}) {
  const { t, locale } = useI18n(),
    client = useQueryClient(),
    rid = restaurant.id;
  const [original, setOriginalState] = useState<LoyaltyEnrollmentIntent | null>(
      null,
    ),
    [storageError, setStorageError] = useState(false),
    [journalReady, setJournalReady] = useState(false),
    [notice, setNotice] = useState("");
  const [review, setReview] = useState(0),
    [sessionError, setSessionError] = useState(false);
  const originalRef = useRef<LoyaltyEnrollmentIntent | null>(null),
    alive = useRef(true),
    locked = useRef(false);
  const setOriginal = useCallback((next: LoyaltyEnrollmentIntent | null) => {
    originalRef.current = next;
    setOriginalState(next);
  }, []);
  const own = useQuery({
    queryKey: privateQuery(rid, account),
    queryFn: ({ signal }) => fetchLoyaltyMembership(rid, account, signal),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
  const mutation = useMutation({
    mutationKey: ["loyalty-enroll", rid, account],
    mutationFn: (intent: LoyaltyEnrollmentIntent) =>
      enrollLoyaltyMembership(intent.restaurant, intent.account, intent.input),
    retry: false,
    gcTime: 0,
  });
  const current = () =>
    alive.current &&
    useGuestAccount.getState().status === "authenticated" &&
    useGuestAccount.getState().account?.id === account;
  const finish = useCallback(
    (saved: LoyaltyEnrollmentIntent) => {
      if (originalRef.current !== saved) return;
      clearLoyaltyEnrollment(sessionStorage, saved);
      setOriginal(null);
    },
    [setOriginal],
  );
  useEffect(() => {
    alive.current = true;
    try {
      setOriginal(readLoyaltyEnrollment(sessionStorage, rid, account));
    } catch {
      setStorageError(true);
    }
    setJournalReady(true);
    return () => {
      alive.current = false;
      client.removeQueries({
        queryKey: privateQuery(rid, account),
        exact: true,
      });
    };
  }, [rid, account, client, setOriginal]);
  useEffect(() => {
    if (own.isError && ownerChanged(own.error)) {
      setSessionError(true);
      void useGuestAccount.getState().hydrateSession();
    }
  }, [own.isError, own.error]);
  useEffect(() => {
    if (
      !own.isError &&
      own.data &&
      originalRef.current &&
      enrollmentMatches(own.data, originalRef.current)
    ) {
      try {
        finish(originalRef.current);
      } catch {
        setStorageError(true);
      }
    }
  }, [own.data, own.isError, finish]);
  const refresh = async () => {
    await Promise.all([own.refetch(), refreshProgram()]);
  };
  const send = async (program?: LoyaltyProgram) => {
    if (!current() || locked.current || storageError || !journalReady) return;
    const input =
      originalRef.current?.input ??
      (program
        ? {
            program_id: program.id,
            expected_revision: program.revision,
            accepted_terms_version: program.rules.terms_version,
            accept_terms: true as const,
          }
        : null);
    if (!input) return;
    locked.current = true;
    setNotice("");
    let saved: LoyaltyEnrollmentIntent;
    try {
      saved = saveLoyaltyEnrollment(
        sessionStorage,
        originalRef.current ?? { restaurant: rid, account, input },
      );
      setOriginal(saved);
    } catch {
      locked.current = false;
      setStorageError(true);
      return;
    }
    try {
      const result = await mutation.mutateAsync(saved);
      if (!current()) return;
      try {
        finish(saved);
      } catch {
        setStorageError(true);
      }
      client.setQueryData(privateQuery(rid, account), result);
      setNotice("loyaltyJoined");
    } catch (error) {
      if (!current()) return;
      if (ownerChanged(error)) {
        setSessionError(true);
        void useGuestAccount.getState().hydrateSession();
      } else if (knownRejection(error)) {
        // A definitive rejection can discard this intent only after a fresh,
        // identity-bound read proves that no membership was created.
        const latest = await own.refetch();
        if (!current()) return;
        if (latest.isSuccess && latest.data.membership === null) {
          try {
            finish(saved);
          } catch {
            setStorageError(true);
          }
          setReview((n) => n + 1);
          setNotice("loyaltyChanged");
          await refreshProgram();
        } else setNotice("loyaltyUncertain");
      } else setNotice("loyaltyUncertain");
    } finally {
      if (alive.current) locked.current = false;
    }
  };
  if (sessionError)
    return (
      <div className="max-w-lg space-y-4">
        <p role="alert">{t("loyaltySessionChanged")}</p>
        <CustomerSignIn variant="entry" />
      </div>
    );
  if (own.isPending || !journalReady)
    return <p role="status">{t("loading")}</p>;
  if (own.isError)
    return (
      <div className="max-w-lg space-y-4">
        <p role="alert">{t("loyaltyReadError")}</p>
        <button className="commerce-secondary" onClick={() => void refresh()}>
          {t("loyaltyRefresh")}
        </button>
      </div>
    );
  const p = own.data?.program ?? publicProgram,
    m = own.data?.membership;
  const feedback = (
    <>
      {notice && (
        <p
          role={notice === "loyaltyUncertain" ? "alert" : "status"}
          className="leading-7"
        >
          {t(notice)}
        </p>
      )}
      {storageError && (
        <p role="alert" className="leading-7">
          {t("loyaltyStorage")}
        </p>
      )}
    </>
  );
  const pending =
    original && !m ? (
      <div className="space-y-4">
        <p>{t("loyaltyPending")}</p>
        <button
          className="commerce-primary"
          disabled={mutation.isPending || storageError}
          onClick={() => void send()}
        >
          {t(mutation.isPending ? "loyaltyJoining" : "loyaltyResume")}
        </button>
      </div>
    ) : null;
  if (!p)
    return (
      <div className="max-w-lg space-y-5">
        {feedback}
        <p>{t(publicError ? "loyaltyUnavailable" : "loyaltyReadError")}</p>
        {pending}
        <button
          className="commerce-secondary"
          disabled={mutation.isPending}
          onClick={() => void refresh()}
        >
          {t("loyaltyRefresh")}
        </button>
      </div>
    );
  return (
    <div className="space-y-6">
      {feedback}
      <ProgramLayout
        restaurant={restaurant}
        program={p}
        membership={m ?? undefined}
        refresh={() => void refresh()}
        action={
          m
            ? null
            : (pending ?? (
                <JoinForm
                  key={`${account}:${p.id}:${p.revision}:${locale}:${review}`}
                  disabled={
                    storageError ||
                    mutation.isPending ||
                    !p.enabled ||
                    p.rules.currency !== restaurant.currency
                  }
                  busy={mutation.isPending}
                  onJoin={() => void send(p)}
                />
              ))
        }
      />
      {m && (
        <LoyaltyWalletPanel
          key={`${restaurant.id}:${account}:${m.id}:${m.program_id}`}
          restaurant={restaurant.id}
          account={account}
          membership={m}
          refreshMembership={refresh}
        />
      )}
      {m && (
        <LoyaltyRewardsPanel
          restaurant={restaurant}
          account={account}
          membership={m.id}
          program={m.program_id}
        />
      )}
    </div>
  );
}

function JoinForm({
  disabled,
  busy,
  onJoin,
}: {
  disabled: boolean;
  busy: boolean;
  onJoin: () => void;
}) {
  const { t } = useI18n();
  const [accepted, setAccepted] = useState(false);
  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3 leading-6">
        <input
          className="mt-1 h-5 w-5 shrink-0 accent-[var(--brand)]"
          type="checkbox"
          checked={accepted}
          disabled={disabled}
          onChange={(e) => setAccepted(e.target.checked)}
        />
        <span>{t("loyaltyAccept")}</span>
      </label>
      <p className="text-sm leading-6 text-[var(--text-muted)]">
        {t("loyaltyMarketing")}
      </p>
      <button
        className="commerce-primary"
        disabled={!accepted || disabled}
        onClick={onJoin}
      >
        {t(busy ? "loyaltyJoining" : "loyaltyJoin")}
      </button>
    </div>
  );
}

function ProgramLayout({
  restaurant,
  program: p,
  membership: m,
  action,
  refresh,
}: {
  restaurant: Restaurant;
  program: LoyaltyProgram;
  membership?: LoyaltyMembership;
  action: ReactNode;
  refresh?: () => void;
}) {
  const { t, locale, direction } = useI18n(),
    content = p.content[locale],
    r = p.rules;
  const money = (minor: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: r.currency,
    }).format(minor / 100);
  const units = (n: number) =>
    `${n.toLocaleString(locale)} ${t(r.mode === "visits" ? (n === 1 ? "loyaltyVisit" : "loyaltyVisits") : n === 1 ? "loyaltyPoint" : "loyaltyPoints")}`;
  const usable =
    p.enabled &&
    r.currency === restaurant.currency &&
    (!m ||
      (m.status === "active" && m.accepted_terms_version === r.terms_version));
  return (
    <div className="grid min-w-0 items-start gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <section
        className="min-w-0 space-y-7"
        aria-labelledby="loyalty-program-name"
      >
        <h2
          id="loyalty-program-name"
          className="break-words text-3xl font-bold leading-tight"
        >
          {content.name}
        </h2>
        {!usable && (
          <p className="border-s-2 border-[var(--brand)] ps-4 leading-7">
            {t(
              m?.status === "closed"
                ? "loyaltyClosed"
                : p.enabled
                  ? "loyaltyReview"
                  : "loyaltyPaused",
            )}
          </p>
        )}
        {m && (
          <section
            className="overflow-hidden rounded-2xl border border-[var(--divider)] bg-[var(--surface)]"
            aria-labelledby="loyalty-progress-title"
          >
            <div className="h-2 bg-[var(--brand)]" />
            <div className="space-y-5 p-6 sm:p-8">
              <h3 id="loyalty-progress-title" className="text-lg font-semibold">
                {t("loyaltyProgress")}
              </h3>
              <p
                className="break-words text-4xl font-bold tabular-nums"
                data-loyalty-balance
              >
                <bdi>{units(m.balance)}</bdi>
              </p>
              {m.balance < 0 ? (
                <p className="leading-7">{t("loyaltyDebt")}</p>
              ) : (
                <>
                  <p className="text-sm text-[var(--text-muted)]">
                    {replace(
                      t("loyaltyThreshold"),
                      "threshold",
                      units(r.reward_threshold),
                    )}
                  </p>
                  {r.mode === "visits" && r.reward_threshold <= 12 ? (
                    <div aria-hidden="true" className="grid grid-cols-6 gap-2">
                      {Array.from({ length: r.reward_threshold }, (_, i) => (
                        <span
                          key={i}
                          className={`flex aspect-square items-center justify-center rounded-full border-2 border-[var(--brand)] text-lg ${i < m.balance ? "bg-[var(--brand)] text-[var(--ink-on-accent,#fff)]" : "bg-[var(--surface)] text-[var(--brand)]"}`}
                        >
                          {i < m.balance ? "✓" : ""}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div
                      role="progressbar"
                      aria-label={t("loyaltyProgress")}
                      aria-valuemin={0}
                      aria-valuemax={r.reward_threshold}
                      aria-valuenow={Math.min(m.balance, r.reward_threshold)}
                      className="h-3 w-full overflow-hidden rounded-full bg-[var(--divider)]"
                    >
                      <div
                        className="h-full bg-[var(--brand)]"
                        style={{
                          width: `${Math.min(m.balance / r.reward_threshold, 1) * 100}%`,
                        }}
                      />
                    </div>
                  )}
                </>
              )}
              <p className="text-sm leading-6 text-[var(--text-muted)]">
                {t("loyaltyProgressHint")}
              </p>
              {refresh && (
                <button className="commerce-secondary" onClick={refresh}>
                  {t("loyaltyRefresh")}
                </button>
              )}
            </div>
          </section>
        )}
        {usable && (
          <div className="space-y-5">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">{t("loyaltyHow")}</h3>
              <p className="leading-7">
                {r.mode === "visits"
                  ? t("loyaltyVisitRule")
                  : replace(
                      replace(
                        t("loyaltyPointRule"),
                        "units",
                        units(r.units_per_step),
                      ),
                      "amount",
                      money(r.spend_step_minor),
                    )}
              </p>
              {r.minimum_purchase_minor > 0 && (
                <p className="text-sm leading-6 text-[var(--text-muted)]">
                  {replace(
                    t("loyaltyMinimum"),
                    "amount",
                    money(r.minimum_purchase_minor),
                  )}
                </p>
              )}
              <p className="text-sm leading-6 text-[var(--text-muted)]">
                {t("loyaltyPaidOnly")}
              </p>
            </div>
            <div className="space-y-2 border-t border-[var(--divider)] pt-5">
              <h3 className="text-lg font-semibold">
                {replace(
                  t("loyaltyRewardAt"),
                  "threshold",
                  units(r.reward_threshold),
                )}
              </h3>
              <p className="leading-7">
                {r.reward_type === "fixed"
                  ? replace(
                      t("loyaltyFixed"),
                      "amount",
                      money(r.reward_amount_minor),
                    )
                  : t("loyaltyItem")}
              </p>
              {r.reward_validity_days > 0 && (
                <p className="text-sm leading-6 text-[var(--text-muted)]">
                  {replace(
                    t("loyaltyValidity"),
                    "days",
                    r.reward_validity_days,
                  )}
                </p>
              )}
            </div>
          </div>
        )}
      </section>
      <section
        className="min-w-0 space-y-5 rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-5 sm:p-7"
        aria-labelledby="loyalty-terms-title"
      >
        <h3 id="loyalty-terms-title" className="text-lg font-semibold">
          {t("loyaltyTerms")}
        </h3>
        <div
          data-loyalty-terms
          tabIndex={0}
          role="region"
          aria-label={t("loyaltyTerms")}
          dir={direction}
          lang={locale}
          className="max-h-80 overflow-y-auto whitespace-pre-wrap break-words border-b border-[var(--divider)] pb-5 text-sm leading-7"
        >
          {content.terms}
        </div>
        {action}
        {m && (
          <p className="text-sm leading-6 text-[var(--text-muted)]">
            {t(m.status === "active" ? "loyaltyMember" : "loyaltyClosed")}
          </p>
        )}
      </section>
    </div>
  );
}

/** A contextual account entry preserves merchant-authored website navigation. */
export function LoyaltyHistoryLink({ restaurant }: { restaurant: Restaurant }) {
  const { t } = useI18n();
  const { ready, browserPath } = useLivePage();
  const account = useGuestAccount((s) => s.account),
    status = useGuestAccount((s) => s.status);
  const pub = useQuery({
    queryKey: publicQuery(restaurant.id),
    queryFn: ({ signal }) => fetchLoyaltyProgram(restaurant.id, signal),
    enabled: ready,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  const own = useQuery({
    queryKey: privateQuery(restaurant.id, account?.id ?? 0),
    queryFn: ({ signal }) =>
      fetchLoyaltyMembership(restaurant.id, account!.id, signal),
    enabled: ready && status === "authenticated" && !!account,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  if (!ready || (!pub.data && (own.isError || !own.data?.membership)))
    return null;
  return (
    <div className="mb-5">
      <Link
        className="inline-flex min-h-11 items-center rounded-full border border-[var(--divider)] px-4 text-sm font-semibold text-[var(--text)]"
        href={href(restaurant, "account/loyalty", browserPath)}
      >
        {t("loyaltyTitle")}
      </Link>
    </div>
  );
}
