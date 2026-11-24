"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type {
  LoyaltyMembership,
  LoyaltyMembershipSnapshot,
  LoyaltyProgram,
} from "@/lib/types";
import { submitLoyaltyActivity } from "@/services/api";

const control =
  "rounded-lg border border-[var(--divider)] bg-[var(--surface)] px-3 py-2";
const section =
  "grid content-start gap-3 border-t border-[var(--divider)] py-5";

/** Explain each earning rule using the restaurant's public catalogue names. */
export function EarningDescription({ program }: { program: LoyaltyProgram }) {
  const { t, locale } = useI18n(),
    e = program.rules.earning;
  if (!e) return null;
  const date = (n: number) =>
    new Intl.DateTimeFormat(locale, {
      weekday: "long",
      timeZone: "UTC",
    }).format(Date.UTC(2026, 0, 4 + n));
  const days = Array.from({ length: 7 }, (_, n) => n)
    .filter((n) => (e.double_days ?? 0) & (1 << n))
    .map(date);
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(value + "T00:00:00Z"));
  return (
    <ul className="space-y-1 text-sm leading-6">
      {e.purchase_bonus && (
        <li>
          {t(
            program.rules.mode === "visits"
              ? "earnExtraSpend"
              : "earnExtraVisit",
          )
            .replace("{n}", String(e.purchase_bonus.units))
            .replace(
              "{amount}",
              new Intl.NumberFormat(locale, {
                style: "currency",
                currency: program.rules.currency,
              }).format(e.purchase_bonus.spend_minor / 100),
            )}
        </li>
      )}
      {e.products?.map((rule, i) => (
        <li key={i}>
          {t("earnItemRule")
            .replace(
              "{name}",
              program.earning_names?.[i]?.[locale] ?? t("earnSelected"),
            )
            .replace("{n}", String(rule.units))}
        </li>
      ))}
      {days.length > 0 && (
        <li>
          {t("earnDouble").replace(
            "{days}",
            new Intl.ListFormat(locale).format(days),
          )}
          {e.double_from &&
            " " + t("earnFrom").replace("{date}", formatDate(e.double_from))}
          {e.double_until &&
            " " + t("earnUntil").replace("{date}", formatDate(e.double_until))}
        </li>
      )}
      {e.welcome_gift && <li>{t('firstVisitCouponHelp')}</li>}
      {!!e.welcome && (
        <li>{t("earnWelcome").replace("{n}", String(e.welcome))}</li>
      )}
      {!!e.referral && (
        <li>{t("earnReferHelp").replace("{n}", String(e.referral))}</li>
      )}
      {!!e.survey && (
        <li>{t("earnSurveyHelp").replace("{n}", String(e.survey))}</li>
      )}
      {(!!e.birthday || e.birthday_gift) && (
        <li>
          {t(e.birthday_gift ? "earnBirthdayGift" : "earnBirthdayPts").replace(
            "{n}",
            String(e.birthday),
          )}
        </li>
      )}
    </ul>
  );
}

/** Collect an optional date or answer for the signed-in member and share their invitation. */
export function EarningActivities({
  restaurant,
  account,
  member,
  program,
  onSaved,
}: {
  restaurant: number;
  account: number;
  member: LoyaltyMembership;
  program: LoyaltyProgram;
  onSaved: (v: LoyaltyMembershipSnapshot) => Promise<void>;
}) {
  const { t, locale } = useI18n(),
    e = program.rules.earning!;
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [failure, setFailure] = useState(false);
  const [month, setMonth] = useState(0),
    [day, setDay] = useState(0),
    [score, setScore] = useState(0),
    [link, setLink] = useState("");
  const alive = useRef(false),
    sending = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!e.referral || !member.referral_code) {
      setLink("");
      return;
    }
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("ref", member.referral_code);
    setLink(url.toString());
  }, [member.referral_code, e.referral]);
  const send = async (action: { birthday: string } | { rating: number }) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setNotice("");
    setFailure(false);
    try {
      const result = await submitLoyaltyActivity(restaurant, account, {
        ...action,
        program_id: program.id,
        expected_revision: program.revision,
      });
      if (!alive.current) return;
      if (
        result.membership?.id !== member.id ||
        result.program?.id !== program.id
      )
        throw Error();
      await onSaved(result);
      if (alive.current) setNotice("earnSaved");
    } catch {
      if (alive.current) setFailure(true);
    } finally {
      sending.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const monthName = (m: number) =>
    new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(
      Date.UTC(2000, m - 1, 1),
    );
  if (!e.survey && !e.referral && !e.birthday && !e.birthday_gift) return null;
  return (
    <section
      className="rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-5 sm:p-7"
      aria-label={t("earnActions")}
    >
      <h2 className="pb-4 text-xl font-semibold">{t("earnActions")}</h2>
      {!!e.survey && (
        <div className={section}>
          <h3 className="font-semibold">{t("earnSurvey")}</h3>
          {member.survey_rating ? (
            <p>
              {t("earnSurveyDone").replace("{n}", String(member.survey_rating))}
            </p>
          ) : (
            <>
              <p>{t("earnSurveyHelp").replace("{n}", String(e.survey))}</p>
              <fieldset>
                <legend className="sr-only">{t("earnScore")}</legend>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <label
                      key={n}
                      className={control + " flex items-center gap-2"}
                    >
                      <input
                        disabled={busy}
                        type="radio"
                        name="loyalty-survey"
                        checked={score === n}
                        onChange={() => setScore(n)}
                      />
                      {n}
                    </label>
                  ))}
                </div>
              </fieldset>
              <button
                type="button"
                className="commerce-secondary justify-self-start"
                disabled={busy || !score}
                onClick={() => void send({ rating: score })}
              >
                {t("earnSend")}
              </button>
            </>
          )}
        </div>
      )}
      {(!!e.birthday || !!e.birthday_gift) && (
        <div className={section}>
          <h3 className="font-semibold">{t("earnBirthday")}</h3>
          <p>
            {t(
              e.birthday_gift ? "earnBirthdayGift" : "earnBirthdayPts",
            ).replace("{n}", String(e.birthday))}
          </p>
          {member.birthday ? (
            <p>
              {new Intl.DateTimeFormat(locale, {
                month: "long",
                day: "numeric",
                timeZone: "UTC",
              }).format(new Date("2000-" + member.birthday + "T00:00:00Z"))}
            </p>
          ) : (
            <>
              <p className="text-sm">{t("earnBirthdayHint")}</p>
              <div className="flex flex-wrap gap-2">
                <select
                  className={control}
                  aria-label={t("earnMonth")}
                  value={month}
                  onChange={(ev) => {
                    setMonth(Number(ev.target.value));
                    setDay(0);
                  }}
                >
                  <option value={0}>{t("earnMonth")}</option>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {monthName(i + 1)}
                    </option>
                  ))}
                </select>
                <select
                  className={control}
                  aria-label={t("earnDay")}
                  disabled={!month}
                  value={day}
                  onChange={(ev) => setDay(Number(ev.target.value))}
                >
                  <option value={0}>{t("earnDay")}</option>
                  {Array.from(
                    { length: new Date(Date.UTC(2000, month, 0)).getUTCDate() },
                    (_, i) => (
                      <option key={i + 1}>{i + 1}</option>
                    ),
                  )}
                </select>
              </div>
              <button
                type="button"
                className="commerce-secondary justify-self-start"
                disabled={busy || !month || !day}
                onClick={() =>
                  void send({
                    birthday: [month, day]
                      .map((n) => String(n).padStart(2, "0"))
                      .join("-"),
                  })
                }
              >
                {t("earnSaveBirthday")}
              </button>
            </>
          )}
        </div>
      )}
      {!!e.referral && link && (
        <div className={section}>
          <h3 className="font-semibold">{t("earnInvite")}</h3>
          <p>{t("earnReferHelp").replace("{n}", String(e.referral))}</p>
          <label className="grid gap-1 text-sm">
            {t("earnLink")}
            <input
              readOnly
              dir="ltr"
              className={control + " min-w-0 w-full"}
              value={link}
              onFocus={(ev) => ev.currentTarget.select()}
            />
          </label>
          {typeof navigator !== "undefined" && navigator.clipboard && (
            <button
              type="button"
              className="commerce-secondary justify-self-start"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  setNotice("earnCopied");
                } catch {
                  setFailure(true);
                }
              }}
            >
              {t("earnCopy")}
            </button>
          )}
        </div>
      )}
      {failure && <p role="alert">{t("earnActivityError")}</p>}
      {notice && <p role="status">{t(notice)}</p>}
    </section>
  );
}
