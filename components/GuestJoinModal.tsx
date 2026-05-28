"use client";

import { useI18n } from "@/lib/i18n";
import { useState } from "react";
import { SessionExpiredError } from "@/services/api";

const EMOJI_OPTIONS = ["😎", "🤩", "😊", "🥳", "😺", "🦊", "🐻", "🐼", "🦁", "🐸", "🐵", "🦄", "🐲", "👻", "🤖", "👽", "🧑‍🍳", "🧙"];

type Props = {
  open: boolean;
  /** May reject — callers (notably the API client) surface SessionExpiredError
   *  when the table session has ended. This modal catches that case and
   *  shows a dedicated "session ended — scan QR again" view. */
  onJoin: (name: string, emoji: string) => Promise<void> | void;
};

export function GuestJoinModal({ open, onJoin }: Props) {
  const { t, direction } = useI18n();
  const [name, setName] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState(
    EMOJI_OPTIONS[Math.floor(Math.random() * EMOJI_OPTIONS.length)]
  );
  const [loading, setLoading] = useState(false);
  // Two terminal error states the modal handles inline:
  //   • sessionEnded — server returned 410, customer must re-scan.
  //   • genericError — any other failure (network, unexpected 5xx, etc.).
  const [sessionEnded, setSessionEnded] = useState(false);
  const [genericError, setGenericError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setGenericError(null);
    try {
      await onJoin(name.trim(), selectedEmoji);
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        setSessionEnded(true);
      } else {
        setGenericError(
          err instanceof Error
            ? err.message
            : t("joinFailed") || "Couldn't join the table. Please try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // Terminal "session ended" state — the table has been closed (or aged out
  // past the absolute 12h cap). Re-scanning the QR is the only path forward.
  if (sessionEnded) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" dir={direction}>
        <div className="bg-[var(--surface)] rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="p-7 text-center">
            <div className="text-5xl mb-3">⏰</div>
            <h2 className="text-xl font-extrabold text-[var(--text-primary)] tracking-tight">
              {t("sessionEnded") || "This table session has ended"}
            </h2>
            <p className="text-sm text-[var(--text-soft)] mt-2 leading-relaxed">
              {t("sessionEndedRescan") ||
                "Scan the QR code on your table again to start a new session."}
            </p>
            <button
              onClick={() => {
                if (typeof window !== "undefined") window.location.reload();
              }}
              className="mt-5 w-full py-3 rounded-xl bg-brand text-white font-bold text-base hover:bg-brand-dark transition"
            >
              {t("reload") || "Reload"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" dir={direction}>
      <div className="bg-[var(--surface)] rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="bg-gradient-to-br from-brand to-brand-dark p-6 text-center text-white">
          <div className="text-5xl mb-3">{selectedEmoji}</div>
          <h2 className="text-xl font-bold">{t("joinTable") || "Join the table"}</h2>
          <p className="text-white/70 text-sm mt-1">
            {t("joinTableDesc") || "Enter your name so others can see what you ordered"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name input */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-soft)] mb-2">
              {t("yourName") || "Your name"}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("enterName") || "Enter your name"}
              className="w-full px-4 py-3 rounded-xl border border-[var(--divider)] bg-[var(--bg-page)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-all text-base"
              autoFocus
              maxLength={30}
            />
          </div>

          {/* Emoji picker */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-soft)] mb-2">
              {t("chooseAvatar") || "Choose your avatar"}
            </label>
            <div className="grid grid-cols-9 gap-1.5">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  type="button"
                  key={emoji}
                  onClick={() => setSelectedEmoji(emoji)}
                  className={`w-9 h-9 rounded-lg text-xl flex items-center justify-center transition-all ${
                    selectedEmoji === emoji
                      ? "bg-brand/15 ring-2 ring-brand scale-110"
                      : "bg-[var(--surface-subtle)] hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Inline generic error (network/5xx) — the session-ended case
              gets its own terminal screen handled above. */}
          {genericError && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-[12.5px] text-red-700 leading-relaxed">
              {genericError}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!name.trim() || loading}
            className="w-full py-3.5 rounded-xl bg-brand text-white font-bold text-base transition-all hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {t("joining") || "Joining..."}
              </span>
            ) : (
              `${selectedEmoji} ${t("joinNow") || "Join table"}`
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
