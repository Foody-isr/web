"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Restaurant } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { useGuestAuth } from "@/store/useGuestAuth";
import { LanguageToggle } from "@/components/LanguageToggle";
import { sendOTP, verifyOTP } from "@/services/api";

type Props = {
  open: boolean;
  onClose: () => void;
  restaurant: Restaurant;
};

type DrawerView = "nav" | "signin";

export function NavigationDrawer({ open, onClose, restaurant }: Props) {
  const { direction } = useI18n();
  const pathname = usePathname();
  const slug = restaurant.slug || String(restaurant.id);
  const restaurantId = String(restaurant.id);

  const isVerified = useGuestAuth((s) => s.isVerified(restaurantId));
  const phone = useGuestAuth((s) => s.getPhone(restaurantId));
  const setVerified = useGuestAuth((s) => s.setVerified);
  const clearSession = useGuestAuth((s) => s.clearSession);

  const [view, setView] = useState<DrawerView>("nav");

  // Sign-in form state
  const [phoneInput, setPhoneInput] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [normalizedPhone, setNormalizedPhone] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpStep, setOtpStep] = useState<"phone" | "code">("phone");
  const [countdown, setCountdown] = useState(0);

  // Reset state when drawer opens/closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setView("nav");
        setPhoneInput("");
        setOtpCode("");
        setOtpError("");
        setOtpStep("phone");
      }, 300);
    }
  }, [open]);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const isRTL = direction === "rtl";
  const slideFrom = isRTL ? "100%" : "-100%";

  // OTP mutations
  const sendOtpMutation = useMutation({
    mutationFn: async () => {
      const normalized = phoneInput.startsWith("+")
        ? phoneInput
        : `+972${phoneInput.replace(/^0/, "")}`;
      setNormalizedPhone(normalized);
      return sendOTP(normalized);
    },
    onSuccess: () => {
      setCountdown(60);
      setOtpStep("code");
      setOtpError("");
    },
    onError: (error: Error) => {
      setOtpError(error.message || "Failed to send code");
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: () => verifyOTP(normalizedPhone, otpCode),
    onSuccess: (data) => {
      if (data.verified) {
        setVerified(restaurantId, normalizedPhone);
        setView("nav");
        setOtpError("");
      } else {
        setOtpError("Invalid code. Please try again.");
      }
    },
    onError: (error: Error) => {
      setOtpError(error.message || "Invalid code");
    },
  });

  const navLinks = [
    {
      label: "Home",
      href: `/r/${slug}`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      label: "Menu",
      href: `/r/${slug}/order`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
    {
      label: "My Orders",
      href: `/r/${slug}/orders`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      ),
    },
  ];

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="nav-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Drawer panel */}
          <motion.div
            key="nav-drawer"
            initial={{ x: slideFrom }}
            animate={{ x: 0 }}
            exit={{ x: slideFrom }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className={`fixed top-0 ${isRTL ? "right-0" : "left-0"} bottom-0 z-[60] w-[80vw] max-w-[320px] bg-[var(--surface)] flex flex-col shadow-2xl`}
            onClick={(e) => e.stopPropagation()}
          >
            <AnimatePresence mode="wait">
              {view === "nav" ? (
                <motion.div
                  key="nav-view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col h-full"
                >
                  {/* Header */}
                  <div className="flex items-center gap-3 px-5 pt-6 pb-4">
                    {restaurant.logoUrl ? (
                      <Image
                        src={restaurant.logoUrl}
                        alt={restaurant.name}
                        width={44}
                        height={44}
                        className="w-11 h-11 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-brand flex items-center justify-center text-white font-bold text-lg">
                        {restaurant.name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h2 className="font-bold text-[var(--text)] truncate">{restaurant.name}</h2>
                      {isVerified && phone && (
                        <p className="text-xs text-[var(--text-muted)] truncate">{phone}</p>
                      )}
                    </div>
                    <button
                      onClick={onClose}
                      className="w-8 h-8 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-subtle)] transition"
                      aria-label="Close"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="h-px bg-[var(--divider)] mx-5" />

                  {/* Auth section */}
                  <div className="px-5 py-4">
                    {isVerified ? (
                      <button
                        onClick={() => {
                          clearSession(restaurantId);
                        }}
                        className="flex items-center gap-3 w-full text-sm text-[var(--text-muted)] hover:text-red-500 transition"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Sign Out
                      </button>
                    ) : (
                      <button
                        onClick={() => setView("signin")}
                        className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-brand text-white font-semibold text-sm hover:opacity-90 transition"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Sign In
                      </button>
                    )}
                  </div>

                  <div className="h-px bg-[var(--divider)] mx-5" />

                  {/* Nav links */}
                  <nav className="flex-1 px-3 py-3">
                    {navLinks.map((link) => {
                      const isActive = pathname === link.href;
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={onClose}
                          className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition ${
                            isActive
                              ? "bg-brand/10 text-brand"
                              : "text-[var(--text)] hover:bg-[var(--surface-subtle)]"
                          }`}
                        >
                          {link.icon}
                          {link.label}
                        </Link>
                      );
                    })}
                  </nav>

                  {/* Language toggle at bottom */}
                  <div className="px-5 py-4 border-t border-[var(--divider)]">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[var(--text-muted)]">Language</span>
                      <LanguageToggle />
                    </div>
                  </div>
                </motion.div>
              ) : (
                /* Sign-in view */
                <motion.div
                  key="signin-view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col h-full"
                >
                  {/* Header */}
                  <div className="flex items-center gap-3 px-5 pt-6 pb-4">
                    <button
                      onClick={() => {
                        setView("nav");
                        setOtpError("");
                        setOtpStep("phone");
                        setOtpCode("");
                      }}
                      className="w-8 h-8 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-subtle)] transition"
                      aria-label="Back"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isRTL ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"} />
                      </svg>
                    </button>
                    <h2 className="font-bold text-lg text-[var(--text)]">Sign In</h2>
                  </div>

                  <div className="px-5 flex-1">
                    {otpStep === "phone" ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          sendOtpMutation.mutate();
                        }}
                        className="space-y-4"
                      >
                        <p className="text-sm text-[var(--text-muted)]">
                          Enter your phone number to sign in and access your order history.
                        </p>
                        <input
                          type="tel"
                          value={phoneInput}
                          onChange={(e) => setPhoneInput(e.target.value)}
                          required
                          className="w-full px-4 py-3 border border-[var(--divider)] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand bg-[var(--surface)] text-[var(--text)]"
                          placeholder="050-123-4567"
                          dir="ltr"
                        />
                        {otpError && (
                          <p className="text-sm text-red-500">{otpError}</p>
                        )}
                        <button
                          type="submit"
                          disabled={sendOtpMutation.isPending || !phoneInput}
                          className="w-full py-3 rounded-xl bg-brand text-white font-bold hover:opacity-90 transition disabled:opacity-50"
                        >
                          {sendOtpMutation.isPending ? "Sending..." : "Send Code"}
                        </button>
                      </form>
                    ) : (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          verifyOtpMutation.mutate();
                        }}
                        className="space-y-4"
                      >
                        <p className="text-sm text-[var(--text-muted)]">
                          Enter the 6-digit code sent to{" "}
                          <span className="font-mono font-bold">{phoneInput}</span>
                        </p>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={6}
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                          className="w-full px-4 py-4 text-center text-2xl font-mono tracking-[0.5em] border border-[var(--divider)] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand bg-[var(--surface)] text-[var(--text)]"
                          placeholder="• • • • • •"
                          autoFocus
                          dir="ltr"
                        />
                        {otpError && (
                          <p className="text-sm text-red-500">{otpError}</p>
                        )}
                        <button
                          type="submit"
                          disabled={otpCode.length !== 6 || verifyOtpMutation.isPending}
                          className="w-full py-3 rounded-xl bg-brand text-white font-bold hover:opacity-90 transition disabled:opacity-50"
                        >
                          {verifyOtpMutation.isPending ? "Verifying..." : "Verify"}
                        </button>
                        <div className="flex items-center justify-between text-sm">
                          <button
                            type="button"
                            onClick={() => {
                              setOtpStep("phone");
                              setOtpCode("");
                              setOtpError("");
                            }}
                            className="text-[var(--text-muted)] hover:text-[var(--text)]"
                          >
                            Change number
                          </button>
                          <button
                            type="button"
                            onClick={() => sendOtpMutation.mutate()}
                            disabled={countdown > 0 || sendOtpMutation.isPending}
                            className="text-brand hover:underline disabled:opacity-50 disabled:no-underline"
                          >
                            {countdown > 0 ? `Resend (${countdown}s)` : "Resend"}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
