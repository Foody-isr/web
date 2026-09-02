"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  describeFlowAnswer,
  flowStepComplete,
  visibleFlowSteps,
  visibleSessionFlowSteps,
  type CateringFlowAnswers,
} from "@/lib/cateringFlow";
import type {
  CateringFlowConfigPublic,
  CateringFlowStepPublic,
  CateringQuoteSessionPayload,
} from "@/services/api";
import type { Locale } from "@/lib/i18n";
import { cateringSessionSummary } from "@/lib/cateringSessionLabels";
import { CateringDateInput } from "@/components/CateringDateInput";

const FIELD = "block w-full min-w-0 max-w-full appearance-none rounded-xl border border-[var(--divider)] bg-[var(--surface)] px-4 py-3 text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--catering-accent,var(--brand))]";
const TIME_FIELD = `${FIELD} min-h-12 [&::-webkit-date-and-time-value]:min-w-0 [&::-webkit-date-and-time-value]:text-start`;

function nextCustomSessionID(sessions: CateringQuoteSessionPayload[]): string {
  let index = sessions.length + 1;
  while (sessions.some((session) => session.id === `custom_${index}`)) index += 1;
  return `custom_${index}`;
}

export function CateringFlowWizard({
  serviceName,
  config,
  answers,
  sessionAnswers,
  sessions,
  guests,
  onAnswers,
  onSessionAnswers,
  onSessions,
  onGuests,
  onExit,
  onComplete,
  locale,
  t,
}: {
  serviceName: string;
  config: CateringFlowConfigPublic;
  answers: CateringFlowAnswers;
  sessionAnswers: Record<string, CateringFlowAnswers>;
  sessions: CateringQuoteSessionPayload[];
  guests: number;
  onAnswers: (answers: CateringFlowAnswers) => void;
  onSessionAnswers: (answers: Record<string, CateringFlowAnswers>) => void;
  onSessions: (sessions: CateringQuoteSessionPayload[]) => void;
  onGuests: (guests: number) => void;
  onExit: () => void;
  onComplete: () => void;
  locale: Locale;
  t: (key: string) => string;
}) {
  const [index, setIndex] = useState(0);
  const [referenceDate, setReferenceDate] = useState("");
  const bookingSteps = useMemo(() => visibleFlowSteps(config, answers), [answers, config]);
  const entries = useMemo(() => [
    ...bookingSteps.map((step) => ({ key: `booking:${step.id}`, step, session: undefined as CateringQuoteSessionPayload | undefined })),
    ...sessions.flatMap((session) => visibleSessionFlowSteps(config, answers, sessionAnswers[session.id] ?? {}).map((step) => ({ key: `${session.id}:${step.id}`, step, session }))),
  ], [answers, bookingSteps, config, sessionAnswers, sessions]);
  const safeIndex = Math.min(index, Math.max(0, entries.length - 1));
  const entry = entries[safeIndex];
  const step = entry?.step;
  const activeSession = entry?.session;
  const activeAnswers = activeSession ? sessionAnswers[activeSession.id] ?? {} : answers;
  const activeGuests = activeSession?.guests || guests;

  useEffect(() => {
    if (!step || step.kind !== "schedule" || step.schedule?.mode !== "custom" || step.schedule.min_sessions === 0 || sessions.length > 0) return;
    onSessions([{ id: "custom_1", label: "", date: "", startTime: "", endTime: "" }]);
  }, [onSessions, sessions.length, step]);

  useEffect(() => {
    const hasSessionSteps = config.steps.some((candidate) => candidate.scope === "session");
    const schedule = config.steps.find((candidate) => candidate.kind === "schedule")?.schedule;
    if (!hasSessionSteps || sessions.length > 0 || (schedule && schedule.mode !== "single")) return;
    onSessions([{ id: "single", label: serviceName, date: "", guests }]);
  }, [config.steps, guests, onSessions, serviceName, sessions.length]);

  if (!step) return null;
  const complete = flowStepComplete(step, activeAnswers, sessions, activeGuests);
  const progress = ((safeIndex + 1) / entries.length) * 100;
  const previous = entries.slice(0, safeIndex);

  const next = () => {
    if (!complete) return;
    if (safeIndex >= entries.length - 1) onComplete();
    else setIndex(safeIndex + 1);
  };
  const back = () => {
    if (safeIndex === 0) onExit();
    else setIndex(safeIndex - 1);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <button type="button" onClick={back} className="rounded-full border border-[var(--divider)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text-muted)] transition hover:text-[var(--text)]">← {t("catering_flow_back")}</button>
        <div className="min-w-0 text-end"><p className="truncate text-sm font-bold text-[var(--text)]">{activeSession?.label || serviceName}</p><p className="text-xs text-[var(--text-muted)]">{t("catering_flow_step").replace("{current}", String(safeIndex + 1)).replace("{total}", String(entries.length))}</p></div>
      </div>

      <div className="mb-8 h-1.5 overflow-hidden rounded-full bg-[var(--surface-subtle)]"><div className="h-full rounded-full bg-[var(--catering-accent,var(--brand))] transition-[width] duration-300" style={{ width: `${progress}%` }} /></div>

      <div className="grid min-w-0 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <section className="min-w-0 overflow-hidden rounded-3xl border border-[var(--divider)] bg-[var(--surface)] shadow-sm">
          <div className="min-w-0 p-5 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--catering-accent,var(--brand))]">{activeSession ? activeSession.label : t("catering_flow_build_reception")}</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">{step.title}</h2>
            {step.description && <p className="mt-2 max-w-2xl leading-6 text-[var(--text-muted)]">{step.description}</p>}
            <div className="mt-7"><StepInput step={step} answers={activeAnswers} sessions={sessions} guests={activeGuests} referenceDate={referenceDate} onReferenceDate={setReferenceDate} onAnswers={(next) => activeSession ? onSessionAnswers({ ...sessionAnswers, [activeSession.id]: next }) : onAnswers(next)} onSessions={onSessions} onGuests={(next) => activeSession ? onSessions(sessions.map((session) => session.id === activeSession.id ? { ...session, guests: next } : session)) : onGuests(next)} locale={locale} t={t} /></div>
          </div>
          <div className="flex flex-col items-stretch gap-3 border-t border-[var(--divider)] bg-[var(--surface-subtle)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-8">
            <span className="text-xs text-[var(--text-muted)]">{step.required ? t("catering_flow_required") : t("catering_flow_optional")}</span>
            <button type="button" disabled={!complete} onClick={next} className="w-full rounded-xl bg-[var(--catering-accent,var(--brand))] px-5 py-3 font-bold text-[var(--catering-button-ink,var(--ink-on-accent))] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:px-6">{safeIndex === entries.length - 1 ? t("catering_flow_see_formulas") : t("catering_flow_continue")} →</button>
          </div>
        </section>

        <aside className="hidden rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-5 lg:block">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">{t("catering_flow_your_reception")}</p>
          {previous.length === 0 ? <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{t("catering_flow_summary_empty")}</p> : <ul className="mt-3 divide-y divide-[var(--divider)]">{previous.map((item) => { const itemAnswers = item.session ? sessionAnswers[item.session.id] ?? {} : answers; return <li key={item.key} className="py-3"><p className="text-xs text-[var(--text-muted)]">{item.session ? `${cateringSessionSummary(item.session, locale)} · ` : ""}{item.step.title}</p><p className="mt-0.5 text-sm font-semibold text-[var(--text)]">{summaryValue(item.step, itemAnswers, sessions, item.session?.guests || guests, locale, t)}</p></li>; })}</ul>}
        </aside>
      </div>
    </div>
  );
}

function summaryValue(step: CateringFlowStepPublic, answers: CateringFlowAnswers, sessions: CateringQuoteSessionPayload[], guests: number, locale: Locale, t: (key: string) => string): string {
  if (step.kind === "guest_count") return `${guests} ${t("catering_guests_word")}`;
  if (step.kind === "schedule" && step.schedule?.date_only) return sessions.map((session) => cateringSessionSummary(session, locale)).filter(Boolean).join(" · ") || "—";
  if (step.kind === "schedule") return t("catering_flow_session_count").replace("{count}", String(sessions.length));
  return describeFlowAnswer(step, answers) || "—";
}

function StepInput({ step, answers, sessions, guests, referenceDate, onReferenceDate, onAnswers, onSessions, onGuests, locale, t }: {
  step: CateringFlowStepPublic;
  answers: CateringFlowAnswers;
  sessions: CateringQuoteSessionPayload[];
  guests: number;
  referenceDate: string;
  onReferenceDate: (date: string) => void;
  onAnswers: (answers: CateringFlowAnswers) => void;
  onSessions: (sessions: CateringQuoteSessionPayload[]) => void;
  onGuests: (guests: number) => void;
  locale: Locale;
  t: (key: string) => string;
}) {
  if (step.kind === "guest_count") return <GuestInput guests={guests} onGuests={onGuests} t={t} />;
  if (step.kind === "schedule" && step.schedule) return <ScheduleInput step={step} sessions={sessions} referenceDate={referenceDate} onReferenceDate={onReferenceDate} onSessions={onSessions} locale={locale} t={t} />;
  if (step.kind === "quantity") {
    const quantities = (!Array.isArray(answers[step.id]) && typeof answers[step.id] === "object" ? answers[step.id] : {}) as Record<string, number>;
    return <div className="space-y-3">{step.options?.map((option) => { const quantity = quantities[option.id] ?? 0; return <div key={option.id} className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--divider)] bg-[var(--surface-subtle)] p-4"><div><p className="font-bold text-[var(--text)]">{option.label}</p>{option.description && <p className="mt-1 text-sm text-[var(--text-muted)]">{option.description}</p>}<PriceHint option={option} t={t} /></div><div className="flex items-center rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-1"><button type="button" className="grid h-9 w-9 place-items-center text-lg" onClick={() => onAnswers({ ...answers, [step.id]: { ...quantities, [option.id]: Math.max(0, quantity - 1) } })}>−</button><span className="w-9 text-center font-bold tabular-nums">{quantity}</span><button type="button" className="grid h-9 w-9 place-items-center text-lg" onClick={() => onAnswers({ ...answers, [step.id]: { ...quantities, [option.id]: quantity + 1 } })}>+</button></div></div>; })}</div>;
  }
  const selected = answers[step.id];
  const multiple = step.kind === "multi_choice";
  const selectedIDs = multiple && Array.isArray(selected) ? selected : typeof selected === "string" ? [selected] : [];
  return <div className="grid gap-3 sm:grid-cols-2">{step.options?.map((option) => { const active = selectedIDs.includes(option.id); return <button key={option.id} type="button" aria-pressed={active} onClick={() => { if (!multiple) onAnswers({ ...answers, [step.id]: option.id }); else onAnswers({ ...answers, [step.id]: active ? selectedIDs.filter((id) => id !== option.id) : [...selectedIDs, option.id] }); }} className={`min-h-28 rounded-2xl border p-4 text-start transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--catering-accent,var(--brand))] ${active ? "border-[var(--catering-accent,var(--brand))] bg-[var(--catering-accent,var(--brand))]/10 shadow-sm" : "border-[var(--divider)] bg-[var(--surface-subtle)] hover:border-[var(--catering-accent,var(--brand))]"}`}><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-[var(--text)]">{option.label}</p>{option.description && <p className="mt-1 text-sm leading-5 text-[var(--text-muted)]">{option.description}</p>}<PriceHint option={option} t={t} /></div><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs ${active ? "border-[var(--catering-accent,var(--brand))] bg-[var(--catering-accent,var(--brand))] text-[var(--catering-button-ink,var(--ink-on-accent))]" : "border-[var(--divider)]"}`}>{active ? "✓" : ""}</span></div></button>; })}</div>;
}

function GuestInput({ guests, onGuests, t }: { guests: number; onGuests: (guests: number) => void; t: (key: string) => string }) {
  return <div className="flex max-w-sm items-center rounded-2xl border border-[var(--divider)] bg-[var(--surface-subtle)] p-2"><button type="button" disabled={guests <= 1} onClick={() => onGuests(Math.max(1, guests - 1))} className="grid h-12 w-12 place-items-center rounded-xl text-xl font-bold hover:bg-[var(--surface)] disabled:opacity-30">−</button><label className="flex-1 text-center"><input className="w-full bg-transparent text-center text-3xl font-bold tabular-nums outline-none" type="number" min={1} value={guests} onChange={(event) => onGuests(Math.max(1, Math.floor(Number(event.target.value) || 1)))} /><span className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t("catering_guests_word")}</span></label><button type="button" onClick={() => onGuests(guests + 1)} className="grid h-12 w-12 place-items-center rounded-xl text-xl font-bold hover:bg-[var(--surface)]">+</button></div>;
}

function ScheduleInput({ step, sessions, referenceDate, onReferenceDate, onSessions, locale, t }: { step: CateringFlowStepPublic; sessions: CateringQuoteSessionPayload[]; referenceDate: string; onReferenceDate: (date: string) => void; onSessions: (sessions: CateringQuoteSessionPayload[]) => void; locale: Locale; t: (key: string) => string }) {
  const settings = step.schedule!;
  if (settings.mode === "custom" && settings.date_only) {
    const session = sessions[0];
    const updateDate = (date: string) => onSessions([{ ...(session ?? { id: "custom_1", label: "", date: "" }), date, label: date }]);
    return (
      <div className="min-w-0 overflow-hidden rounded-2xl border border-[var(--divider)] bg-[var(--surface-subtle)] p-4">
        <label className="block min-w-0 max-w-md">
          <span className="mb-1.5 block text-sm font-semibold text-[var(--text-muted)]">{t("catering_flow_date")}</span>
          <CateringDateInput value={session?.date ?? ""} onChange={updateDate} locale={locale} ariaLabel={t("catering_flow_date")} />
        </label>
      </div>
    );
  }
  if (settings.mode === "predefined") {
    const changeReference = (date: string) => {
      onReferenceDate(date);
      onSessions(sessions.map((session) => { const slot = settings.slots?.find((candidate) => candidate.id === session.id); return slot ? { ...session, date: addDays(date, slot.day_offset) } : session; }));
    };
    return <div className="min-w-0 space-y-4"><label className="block min-w-0 max-w-sm"><span className="mb-1.5 block text-sm font-semibold text-[var(--text-muted)]">{t("catering_flow_reference_date")}</span><CateringDateInput value={referenceDate} onChange={changeReference} locale={locale} ariaLabel={t("catering_flow_reference_date")} /></label><div className="grid min-w-0 gap-3 sm:grid-cols-2">{settings.slots?.map((slot) => { const active = sessions.some((session) => session.id === slot.id); const slotDate = referenceDate ? addDays(referenceDate, slot.day_offset) : ""; const disabled = !slotDate || (!active && sessions.length >= settings.max_sessions); return <button key={slot.id} type="button" disabled={disabled} onClick={() => { if (active) onSessions(sessions.filter((session) => session.id !== slot.id)); else onSessions([...sessions, { id: slot.id, label: slot.label, date: slotDate, startTime: slot.start_time, endTime: slot.end_time }]); }} className={`rounded-2xl border p-4 text-start transition disabled:opacity-40 ${active ? "border-[var(--catering-accent,var(--brand))] bg-[var(--catering-accent,var(--brand))]/10" : "border-[var(--divider)] bg-[var(--surface-subtle)]"}`}><div className="flex justify-between gap-3"><div><p className="font-bold text-[var(--text)]">{slot.label}</p>{slot.description && <p className="mt-1 text-sm text-[var(--text-muted)]">{slot.description}</p>}<p className="mt-2 text-xs font-semibold text-[var(--catering-accent,var(--brand))]">{slotDate ? cateringSessionSummary({ date: slotDate }, locale) : t("catering_flow_choose_date_first")} {slot.start_time ? `· ${slot.start_time}` : ""}</p></div><span>{active ? "✓" : ""}</span></div></button>; })}</div></div>;
  }
  const update = (index: number, patch: Partial<CateringQuoteSessionPayload>) => onSessions(sessions.map((session, i) => i === index ? { ...session, ...patch } : session));
  return <div className="min-w-0 space-y-3">{sessions.map((session, index) => <div key={session.id} className="grid min-w-0 gap-3 rounded-2xl border border-[var(--divider)] bg-[var(--surface-subtle)] p-4 sm:grid-cols-2"><label className="min-w-0"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">{t("catering_flow_session_name")}</span><input className={FIELD} value={session.label} placeholder={t("catering_flow_session_name_placeholder")} onChange={(event) => update(index, { label: event.target.value })} /></label><label className="min-w-0"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">{t("catering_flow_date")}</span><CateringDateInput value={session.date} onChange={(date) => update(index, { date })} locale={locale} ariaLabel={t("catering_flow_date")} /></label><label className="min-w-0"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">{t("catering_flow_start")}</span><input className={TIME_FIELD} type="time" value={session.startTime ?? ""} onChange={(event) => update(index, { startTime: event.target.value })} /></label><div className="flex min-w-0 items-end gap-2"><label className="min-w-0 flex-1"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">{t("catering_flow_end")}</span><input className={TIME_FIELD} type="time" value={session.endTime ?? ""} onChange={(event) => update(index, { endTime: event.target.value })} /></label>{sessions.length > settings.min_sessions && <button type="button" aria-label={t("catering_flow_remove_session")} onClick={() => onSessions(sessions.filter((_, i) => i !== index))} className="mb-1 grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[var(--divider)] text-[var(--text-muted)] hover:text-red-500">×</button>}</div></div>)}{sessions.length < settings.max_sessions && <button type="button" onClick={() => onSessions([...sessions, { id: nextCustomSessionID(sessions), label: "", date: "", startTime: "", endTime: "" }])} className="w-full rounded-xl border border-dashed border-[var(--divider)] px-4 py-3 text-sm font-bold text-[var(--catering-accent,var(--brand))] hover:border-[var(--catering-accent,var(--brand))]">+ {t("catering_flow_add_session")}</button>}</div>;
}

function PriceHint({ option, t }: { option: { price?: number; price_mode?: string; price_effect?: string }; t: (key: string) => string }) {
  if (!option.price) return null;
  if (option.price_effect === "replace_catalog_per_guest") {
    return <p className="mt-2 text-xs font-semibold text-[var(--catering-accent,var(--brand))]">₪{option.price} {t("catering_per_person")}</p>;
  }
  return <p className="mt-2 text-xs font-semibold text-[var(--catering-accent,var(--brand))]">+ ₪{option.price}</p>;
}
