"use client";

import type { FormEvent, InputHTMLAttributes } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { CustomerSocialSignIn } from "@/components/CustomerSocialSignIn";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import {
  ApiError,
  fetchCustomerSocialProviders,
  loginCustomerEmail,
  registerCustomerEmail,
  requestCustomerPasswordReset,
  resendCustomerVerificationCode,
  resetCustomerPassword,
  verifyCustomerEmail,
  requestCustomerEmailCode,
  verifyCustomerEmailCode,
} from "@/services/api";
import { useGuestAccount } from "@/store/useGuestAccount";

type Mode = "verify-email-start" | "verify-email-code" | "login" | "register" | "verify" | "forgot" | "reset";

/** Optional account access, with direct sign-in and registration at checkout. */
export function CustomerSignIn({
  onSignedIn,
  variant = "default",
  initialEmail = "",
  initialName = "",
}: {
  onSignedIn?: () => void;
  variant?: "default" | "checkout" | "entry" | "compact" | "verify";
  initialEmail?: string;
  initialName?: string;
}) {
  const { t } = useI18n();
  useQuery({ queryKey: ["customer-social-providers"], queryFn: fetchCustomerSocialProviders, staleTime: 5 * 60_000, retry: false, enabled: variant !== "verify" });
  const [mode, setMode] = useState<"verify-email-start" | "login" | "register" | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);

  function openDialog(next: "verify-email-start" | "login" | "register", opener: HTMLButtonElement) {
    openerRef.current = opener;
    setMode(next);
  }

  return (
    <div
      className={
        variant === "checkout"
          ? "space-y-5"
          : "flex flex-col items-center gap-3"
      }
    >
      {variant === "checkout" && (
        <div>
          <h2 className="commerce-section-title">{t("accountMenuTitle")}</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
            {t("accountSignInHint")}
          </p>
        </div>
      )}
      {variant === "entry" ? <button type="button" className="customer-entry-sign-in" onClick={event => openDialog("login", event.currentTarget)}>{t("entryAccountAction")}</button> : variant === "compact" || variant === "verify" ? <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-[var(--text-muted)]">
        {variant === "compact" && t("checkoutAccountExisting")} <button type="button" className="font-semibold text-[var(--text)] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)]" onClick={event => openDialog(variant === "verify" ? "verify-email-start" : "login", event.currentTarget)}>{t(variant === "verify" ? "accountVerifyEmail" : "accountSignIn")}</button>
      </p> : <div className="flex w-full flex-col items-center gap-3">
        <div className="w-full max-w-[280px]"><CustomerSocialSignIn onSignedIn={onSignedIn} /></div>
        <div className="flex w-full max-w-[320px] items-center gap-3 text-xs text-[var(--text-muted)]">
          <span className="h-px flex-1 bg-[var(--divider)]" />
          <span>{t("accountOr") || "or"}</span>
          <span className="h-px flex-1 bg-[var(--divider)]" />
        </div>
        {variant === "checkout" ? (
          <div className="grid w-full grid-cols-2 gap-3">
            <button
              type="button"
              onClick={event => openDialog("login", event.currentTarget)}
              className="commerce-secondary text-sm"
            >
              {t("accountSignIn")}
            </button>
            <button
              type="button"
              onClick={event => openDialog("register", event.currentTarget)}
              className="commerce-secondary text-sm"
            >
              {t("accountCreateLink")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={event => openDialog("login", event.currentTarget)}
            className="w-full max-w-[280px] rounded-full border border-[var(--divider)] bg-[var(--surface)] px-5 py-3 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--brand)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
          >
            {t("accountContinueEmail") || "Continue with email"}
          </button>
        )}
      </div>}
      {mode && (
        <CustomerAuthDialog
          initialMode={mode}
          initialEmail={initialEmail}
          initialName={initialName}
          returnFocusElement={openerRef.current}
          onClose={() => setMode(null)}
          onSignedIn={() => {
            setMode(null);
            onSignedIn?.();
          }}
        />
      )}
    </div>
  );
}

function CustomerAuthDialog({
  initialMode,
  onClose,
  onSignedIn,
  initialEmail,
  initialName,
  returnFocusElement,
}: {
  initialMode: "verify-email-start" | "login" | "register";
  initialEmail: string;
  initialName: string;
  returnFocusElement: HTMLButtonElement | null;
  onClose: () => void;
  onSignedIn: () => void;
}) {
  const { t, direction } = useI18n();
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const setSession = useGuestAccount((state) => state.setSession);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [resendAt, setResendAt] = useState(0);
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const update = () => setRemaining(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [resendAt]);

  function authError(caught: unknown) {
    if (caught instanceof ApiError) {
      if (caught.status === 429) return t("accountCodeRateLimited");
      if (caught.status === 503) return t("accountCodeUnavailable");
      if (caught.status === 401 && mode === "verify-email-code") return t("accountCodeInvalid");
    }
    return t("accountAuthFailed");
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    // Safari does not focus a clicked button, so retain the explicit opener.
    const previousFocus = returnFocusElement ?? document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    const previousScroll = { left: window.scrollX, top: window.scrollY };
    // Lock both scroll roots: wide RTL content otherwise enlarges the mobile
    // layout viewport and shifts a native dialog outside the visible screen.
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    dialog?.showModal();
    // Let desktop customers type immediately without opening a mobile keyboard
    // before they have chosen between Google and email.
    const initialFocus = window.matchMedia("(pointer: fine)").matches
      ? dialog?.querySelector<HTMLElement>('input[type="email"]')
      : dialog?.querySelector<HTMLElement>("h2");
    initialFocus?.focus({ preventScroll: true });
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
      window.scrollTo({ ...previousScroll, behavior: "instant" });
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [returnFocusElement]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const viewport = window.visualViewport;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!dialog || (viewport && viewport.scale !== 1)) return;
        dialog.style.height = `${viewport?.height ?? window.innerHeight}px`;
        dialog.style.top = `${viewport?.offsetTop ?? 0}px`;
        const sheet = dialog.querySelector("section");
        const active = document.activeElement;
        if (sheet && active instanceof HTMLInputElement && sheet.contains(active)) {
          const bounds = sheet.getBoundingClientRect();
          const field = active.getBoundingClientRect();
          if (field.bottom > bounds.bottom - 12) sheet.scrollTo({ top: sheet.scrollTop + field.bottom - bounds.bottom + 12, behavior: "instant" });
          else if (field.top < bounds.top + 12) sheet.scrollTo({ top: sheet.scrollTop - bounds.top + field.top - 12, behavior: "instant" });
        }
      });
    };
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    dialog?.addEventListener("focusin", update);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      dialog?.removeEventListener("focusin", update);
    };
  }, []);

  useEffect(() => {
    if (mode === "verify-email-code" || mode === "verify") {
      dialogRef.current?.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]')?.focus();
    }
  }, [mode]);

  function switchMode(next: Mode) {
    setMode(next);
    setPassword("");
    setCode("");
    setError("");
    setNotice("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "verify-email-start") {
        await requestCustomerEmailCode(email, name);
        setResendAt(Date.now() + 60_000);
        setMode("verify-email-code");
        setNotice(t("accountCodeSent"));
      } else if (mode === "verify-email-code") {
        const result = await verifyCustomerEmailCode(email, code);
        setSession(result.account);
        onSignedIn();
      } else if (mode === "login") {
        const result = await loginCustomerEmail(email, password);
        setSession(result.account);
        onSignedIn();
      } else if (mode === "register") {
        await registerCustomerEmail({ email, name, password });
        setPassword("");
        setMode("verify");
        setNotice(
          t("accountCodeSent") || "We sent a 6-digit code to your email.",
        );
      } else if (mode === "verify") {
        const result = await verifyCustomerEmail(email, code);
        setSession(result.account);
        onSignedIn();
      } else if (mode === "forgot") {
        await requestCustomerPasswordReset(email);
        setMode("reset");
        setNotice(
          t("accountResetCodeSent") ||
            "If an account exists for this email, a reset code has been sent.",
        );
      } else {
        await resetCustomerPassword({ email, code, newPassword: password });
        setMode("login");
        setCode("");
        setPassword("");
        setNotice(
          t("accountPasswordChanged") ||
            "Password updated. You can now sign in.",
        );
      }
    } catch (caught) {
      setError(authError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function resendCode() {
    setBusy(true);
    setError("");
    try {
      if (mode === "verify-email-code") {
        await requestCustomerEmailCode(email, name);
        setResendAt(Date.now() + 60_000);
      } else await resendCustomerVerificationCode(email);
      setCode("");
      setNotice(t("accountCodeResent") || "A new code has been sent.");
    } catch (caught) {
      setError(authError(caught));
    } finally {
      setBusy(false);
    }
  }

  const titles: Record<Mode, string> = {
    "verify-email-start": t("accountVerifyEmail"),
    "verify-email-code": t("accountVerifyEmail"),
    login: t("accountWelcomeBack") || "Welcome back",
    register: t("accountCreate") || "Create your Foody account",
    verify: t("accountVerifyEmail") || "Verify your email",
    forgot: t("accountForgotPassword") || "Forgot your password?",
    reset: t("accountChoosePassword") || "Choose a new password",
  };

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            "button:not([disabled]), input:not([disabled]), a[href]",
          ),
        );
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-y-0 start-0 m-0 h-[100dvh] max-h-none w-[100dvw] max-w-none bg-transparent p-0 text-[var(--text)] backdrop:bg-black/55 open:flex open:items-end open:justify-center sm:open:items-center"
      dir={direction}
    >
      <section className="relative max-h-[min(92dvh,100%)] w-full overflow-y-auto scroll-auto rounded-t-2xl border border-[var(--divider)] bg-[var(--surface)] px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-5 shadow-2xl sm:max-w-[460px] sm:rounded-2xl sm:p-8">
        <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-[var(--divider)] sm:hidden" />
        <button
          type="button"
          onClick={onClose}
          className="absolute end-3 top-3 grid h-11 w-11 place-items-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--surface-subtle)] hover:text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
          aria-label={t("close") || "Close"}
        >
          <span aria-hidden="true" className="text-xl">
            ×
          </span>
        </button>

        <div className="pe-10">
          <h2
            id={titleId}
            tabIndex={-1}
            className="text-2xl font-semibold leading-tight text-[var(--text)] outline-none"
          >
            {titles[mode]}
          </h2>
          <p id={descriptionId} className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
            {mode === "verify" || mode === "verify-email-code"
              ? (
                  t("accountVerifyHint") || "Enter the code sent to {email}."
                ).replace("{email}", email)
              : mode === "verify-email-start" ? t("accountVerifyOwnershipHint") : mode === "register"
                ? t("accountCreateHint") ||
                  "One account works across Foody restaurants."
                : mode === "reset"
                  ? t("accountResetHint") ||
                    "Enter the email code and your new password."
                  : mode === "login" ? t("accountSignInHint")
                  : t("accountEmailHint") ||
                    "Use your verified email to access orders and saved cards."}
          </p>
        </div>

        {(mode === "login" || mode === "register") && (
          <div className="mt-6 grid grid-cols-2 border-b border-[var(--divider)]">
            {(["login", "register"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={mode === option}
                onClick={() => switchMode(option)}
                className={`min-h-12 border-b-2 px-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] ${mode === option ? "border-current text-[var(--text)]" : "border-transparent text-[var(--text-muted)]"}`}
              >
                {t(option === "login" ? "accountSignIn" : "accountCreateLink")}
              </button>
            ))}
          </div>
        )}

        {(mode === "login" || mode === "register") && <div className="mt-6"><div inert={busy || undefined}><CustomerSocialSignIn onSignedIn={onSignedIn} /></div><div className="mt-5 flex items-center gap-3 text-xs text-[var(--text-muted)]"><span aria-hidden="true" className="h-px flex-1 bg-[var(--divider)]" /><span>{t("accountOr")}</span><span aria-hidden="true" className="h-px flex-1 bg-[var(--divider)]" /></div></div>}
        <form onSubmit={submit} className="mt-5 space-y-4">
          {mode === "register" && (
            <AuthField
              label={t("name") || "Name"}
              value={name}
              onChange={setName}
              autoComplete="name"
              required
            />
          )}
          {mode !== "verify" && mode !== "verify-email-code" && (
            <AuthField
              label={t("email") || "Email"}
              value={email}
              onChange={setEmail}
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={t("accountEmailPlaceholder")}
              disabled={busy}
              dir="ltr"
              required
            />
          )}
          {(mode === "verify" || mode === "verify-email-code" || mode === "reset") && (
            <AuthField
              label={t("accountVerificationCode") || "Verification code"}
              value={code}
              onChange={(value) =>
                setCode(value.replace(/\D/g, "").slice(0, 6))
              }
              inputMode="numeric"
              autoComplete="one-time-code"
              dir="ltr"
              className="text-center text-2xl font-black tracking-[0.42em]"
              minLength={6}
              disabled={busy}
              required
            />
          )}
          {(mode === "login" || mode === "register" || mode === "reset") && (
            <AuthField
              label={
                mode === "reset"
                  ? t("accountNewPassword") || "New password"
                  : t("accountPassword") || "Password"
              }
              value={password}
              onChange={setPassword}
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              minLength={mode === "login" ? undefined : 15}
              hint={
                mode === "login"
                  ? undefined
                  : t("accountPasswordHint") || "Use at least 15 characters."
              }
              dir="ltr"
              required
            />
          )}

          {notice && (
            <p
              role="status"
              className="rounded-xl bg-brand/10 px-3 py-2 text-sm text-[var(--text)]"
            >
              {notice}
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-600"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-brand px-5 py-3.5 text-sm font-semibold text-[var(--ink-on-accent,#fff)] transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand)] disabled:cursor-wait disabled:opacity-60"
          >
            {busy
              ? t("loading") || "Please wait…"
              : mode === "verify-email-start" ? t("accountSendCode") : mode === "verify-email-code" ? t("accountVerifyContinue") : mode === "login"
                ? t("accountSignIn") || "Sign in"
                : mode === "register"
                  ? t("accountSendCode") || "Send verification code"
                  : mode === "forgot"
                    ? t("accountSendResetCode") || "Send reset code"
                    : mode === "reset"
                      ? t("accountUpdatePassword") || "Update password"
                      : t("accountVerifyContinue") || "Verify and continue"}
          </button>
        </form>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-[var(--text-muted)] [&_button]:min-h-11 [&_button]:underline [&_button]:underline-offset-4 [&_button:hover]:text-[var(--text)] [&_button:disabled]:opacity-50">
          {mode === "login" && (
            <>
              <button type="button" onClick={() => switchMode("forgot")}>
                {t("accountForgotLink") || "Forgot password?"}
              </button>
            </>
          )}
          {(mode === "verify" || mode === "verify-email-code") && (
            <button
              type="button"
              disabled={busy || (mode === "verify-email-code" && remaining > 0)}
              onClick={() => void resendCode()}
            >
              {t("accountResendCode")}{mode === "verify-email-code" && remaining > 0 ? ` (${remaining}s)` : ""}
            </button>
          )}
          {mode === "verify-email-code" && <button type="button" disabled={busy} onClick={() => switchMode("verify-email-start")}>{t("accountChangeEmail")}</button>}
          {mode !== "login" && mode !== "verify-email-start" && mode !== "verify-email-code" && (
            <button type="button" onClick={() => switchMode("login")}>
              {t("accountBackToLogin") || "Back to sign in"}
            </button>
          )}
        </div>
      </section>
    </dialog>, document.body
  );
}

function AuthField({
  label,
  value,
  onChange,
  hint,
  className = "",
  ...inputProps
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const inputId = useId();
  return (
    <div className="text-sm font-medium text-[var(--text)]">
      <label htmlFor={inputId}>{label}</label>
      <input
        {...inputProps}
        id={inputId}
        aria-describedby={hint ? `${inputId}-hint` : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-1.5 w-full rounded-xl border border-[var(--divider)] bg-[var(--surface-subtle)] px-4 py-3 text-base font-normal text-[var(--text)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-brand focus:ring-2 focus:ring-brand/20 ${className}`}
      />
      {hint && (
        <span
          id={`${inputId}-hint`}
          className="mt-1.5 block text-xs font-normal text-[var(--text-muted)]"
        >
          {hint}
        </span>
      )}
    </div>
  );
}
