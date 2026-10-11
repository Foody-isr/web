"use client";

import type { FormEvent, InputHTMLAttributes } from "react";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

import { GoogleSignIn } from "@/components/GoogleSignIn";
import { useI18n } from "@/lib/i18n";
import {
  ApiError,
  loginCustomerEmail,
  registerCustomerEmail,
  requestCustomerPasswordReset,
  resendCustomerVerificationCode,
  resetCustomerPassword,
  verifyCustomerEmail,
} from "@/services/api";
import { useGuestAccount } from "@/store/useGuestAccount";

type Mode = "login" | "register" | "verify" | "forgot" | "reset";

export function CustomerSignIn({ onSignedIn }: { onSignedIn?: () => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col items-center gap-3">
      <GoogleSignIn onSignedIn={onSignedIn} />
      <div className="flex w-full max-w-[280px] items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        <span className="h-px flex-1 bg-[var(--divider)]" />
        <span>{t("accountOr") || "or"}</span>
        <span className="h-px flex-1 bg-[var(--divider)]" />
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full max-w-[280px] rounded-full border border-[var(--divider)] bg-[var(--surface)] px-5 py-2.5 text-sm font-bold text-[var(--text)] shadow-sm transition hover:border-brand/50 hover:bg-brand/5 focus:outline-none focus:ring-2 focus:ring-brand/30"
      >
        {t("accountContinueEmail") || "Continue with email"}
      </button>
      {open && (
        <CustomerAuthDialog
          onClose={() => setOpen(false)}
          onSignedIn={() => {
            setOpen(false);
            onSignedIn?.();
          }}
        />
      )}
    </div>
  );
}

function CustomerAuthDialog({
  onClose,
  onSignedIn,
}: {
  onClose: () => void;
  onSignedIn: () => void;
}) {
  const { t, direction } = useI18n();
  const titleId = useId();
  const setSession = useGuestAccount((state) => state.setSession);
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  function switchMode(next: Mode) {
    setMode(next);
    setPassword("");
    setCode("");
    setError("");
    setNotice("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "login") {
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
      const message = caught instanceof ApiError ? caught.message : "";
      setError(
        message ||
          t("accountAuthFailed") ||
          "We could not complete that request.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function resendCode() {
    setBusy(true);
    setError("");
    try {
      await resendCustomerVerificationCode(email);
      setNotice(t("accountCodeResent") || "A new code has been sent.");
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Unable to resend the code.",
      );
    } finally {
      setBusy(false);
    }
  }

  const titles: Record<Mode, string> = {
    login: t("accountWelcomeBack") || "Welcome back",
    register: t("accountCreate") || "Create your Foody account",
    verify: t("accountVerifyEmail") || "Verify your email",
    forgot: t("accountForgotPassword") || "Forgot your password?",
    reset: t("accountChoosePassword") || "Choose a new password",
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center"
      dir={direction}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        aria-label={t("close") || "Close"}
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-[28px] border border-[var(--divider)] bg-[var(--surface)] px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-5 shadow-2xl sm:max-w-[430px] sm:rounded-[28px] sm:p-7"
      >
        <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-[var(--divider)] sm:hidden" />
        <button
          type="button"
          onClick={onClose}
          className="absolute end-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-[var(--surface-subtle)] text-[var(--text-muted)] transition hover:text-[var(--text)]"
          aria-label={t("close") || "Close"}
        >
          <span aria-hidden="true" className="text-xl">
            ×
          </span>
        </button>

        <div className="pe-10">
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-brand">
            Foody
          </p>
          <h2
            id={titleId}
            className="text-2xl font-black leading-tight text-[var(--text)]"
          >
            {titles[mode]}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
            {mode === "verify"
              ? (
                  t("accountVerifyHint") || "Enter the code sent to {email}."
                ).replace("{email}", email)
              : mode === "register"
                ? t("accountCreateHint") ||
                  "One account works across Foody restaurants."
                : mode === "reset"
                  ? t("accountResetHint") ||
                    "Enter the email code and your new password."
                  : t("accountEmailHint") ||
                    "Use your verified email to access orders and saved cards."}
          </p>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "register" && (
            <AuthField
              label={t("name") || "Name"}
              value={name}
              onChange={setName}
              autoComplete="name"
              required
            />
          )}
          {mode !== "verify" && (
            <AuthField
              label={t("email") || "Email"}
              value={email}
              onChange={setEmail}
              type="email"
              autoComplete="email"
              dir="ltr"
              required
            />
          )}
          {(mode === "verify" || mode === "reset") && (
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
            className="w-full rounded-full bg-brand px-5 py-3.5 text-sm font-black text-[var(--brand-ink,#fff)] shadow-lg shadow-brand/20 transition hover:brightness-105 disabled:cursor-wait disabled:opacity-60"
          >
            {busy
              ? t("loading") || "Please wait…"
              : mode === "login"
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

        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm font-bold text-brand">
          {mode === "login" && (
            <>
              <button type="button" onClick={() => switchMode("register")}>
                {t("accountCreateLink") || "Create an account"}
              </button>
              <button type="button" onClick={() => switchMode("forgot")}>
                {t("accountForgotLink") || "Forgot password?"}
              </button>
            </>
          )}
          {mode === "verify" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void resendCode()}
            >
              {t("accountResendCode") || "Send a new code"}
            </button>
          )}
          {mode !== "login" && (
            <button type="button" onClick={() => switchMode("login")}>
              {t("accountBackToLogin") || "Back to sign in"}
            </button>
          )}
        </div>
      </section>
    </div>,
    document.body,
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
  return (
    <label className="block text-sm font-bold text-[var(--text)]">
      <span>{label}</span>
      <input
        {...inputProps}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-1.5 w-full rounded-2xl border border-[var(--divider)] bg-[var(--surface-subtle)] px-4 py-3 text-base font-medium text-[var(--text)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-brand focus:ring-2 focus:ring-brand/20 ${className}`}
      />
      {hint && (
        <span className="mt-1.5 block text-xs font-normal text-[var(--text-muted)]">
          {hint}
        </span>
      )}
    </label>
  );
}
