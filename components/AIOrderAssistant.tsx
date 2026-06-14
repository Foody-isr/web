"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { currencySymbol } from "@/lib/constants";
import {
  AIChatMessage,
  AIPlacedOrder,
  AISuggestedItem,
  sendAIOrderChat,
} from "@/services/api";
import type { OrderType } from "@/lib/types";

interface ChatBubble {
  id: string;
  role: "user" | "assistant";
  content: string;
  items?: AISuggestedItem[];
  order?: AIPlacedOrder;
  /** quick-reply chips rendered under this bubble (greeting only) */
  quickReplies?: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  restaurantId: string;
  restaurantName: string;
  orderType: OrderType;
  currency: string;
}

let bubbleSeq = 0;
const nextId = () => `b${++bubbleSeq}`;

export function AIOrderAssistant({
  open,
  onClose,
  restaurantId,
  restaurantName,
  orderType,
  currency,
}: Props) {
  const { t, direction, locale } = useI18n();
  const sym = currencySymbol(currency);

  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Seed a local greeting the first time the assistant is opened.
  useEffect(() => {
    if (open && messages.length === 0) {
      const greeting = (
        t("aiGreeting") ||
        "Hi! I'm {name}'s ordering assistant. Want me to help you put together your order?"
      ).replace("{name}", restaurantName);
      setMessages([
        {
          id: nextId(),
          role: "assistant",
          content: greeting,
          quickReplies: [
            t("aiYesHelp") || "Yes, help me",
            t("aiNoThanks") || "No thanks",
          ],
        },
      ]);
    }
  }, [open, messages.length, restaurantName, t]);

  // Auto-scroll to the newest message.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, loading]);

  if (!open) return null;

  const toHistory = (bubbles: ChatBubble[]): AIChatMessage[] =>
    bubbles.map((b) => ({ role: b.role, content: b.content }));

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userBubble: ChatBubble = {
      id: nextId(),
      role: "user",
      content: trimmed,
    };
    // History is everything before this new turn (drop dangling quick replies).
    const history = toHistory(messages);
    setMessages((prev) => [...prev, userBubble]);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const resp = await sendAIOrderChat({
        restaurantId,
        message: trimmed,
        history,
        orderType,
        locale,
      });
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          content: resp.message,
          items: resp.suggestedItems.length ? resp.suggestedItems : undefined,
          order: resp.order,
          quickReplies: resp.quickReplies.length ? resp.quickReplies : undefined,
        },
      ]);
    } catch (e: any) {
      setError(e?.message || t("aiError") || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center"
      dir={direction}
    >
      {/* Backdrop */}
      <div
        className="ai-backdrop-in absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div className="ai-panel-in relative w-full sm:max-w-[420px] h-[88vh] sm:h-[82vh] sm:max-h-[700px] bg-white rounded-t-[28px] sm:rounded-[28px] shadow-2xl ring-1 ring-black/5 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="ai-grad relative shrink-0 px-4 py-3.5 text-white">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-white/20 ring-1 ring-white/40 backdrop-blur flex items-center justify-center text-xl shadow-inner">
                ✨
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-[15px] leading-tight truncate">
                {t("aiAssistantTitle") || "Order assistant"}
              </div>
              <div className="text-xs text-white/85 truncate">{restaurantName}</div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full hover:bg-white/20 active:scale-95 flex items-center justify-center transition"
              aria-label={t("close") || "Close"}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-3.5 py-4 space-y-3.5 bg-slate-50"
        >
          {messages.map((m, idx) => (
            <div key={m.id} className="ai-msg-in">
              {m.role === "user" ? (
                <div className="flex justify-end">
                  <div className="ai-grad max-w-[82%] px-4 py-2.5 rounded-[20px] rounded-br-md text-white text-[14px] leading-relaxed shadow-sm whitespace-pre-wrap break-words">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div className="flex items-end gap-2">
                  <div className="ai-grad w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-sm text-white shadow-sm">
                    ✨
                  </div>
                  <div className="max-w-[82%] px-4 py-2.5 rounded-[20px] rounded-bl-md bg-white text-slate-800 text-[14px] leading-relaxed shadow-sm ring-1 ring-slate-100 whitespace-pre-wrap break-words">
                    {m.content}
                  </div>
                </div>
              )}

              {/* Reason caption (shown once above the cards) */}
              {m.items && m.items[0]?.reason && (
                <p className="ps-9 mt-2 text-xs text-slate-500 italic leading-relaxed">
                  {m.items[0].reason}
                </p>
              )}

              {/* Suggested item cards */}
              {m.items && m.items.length > 0 && (
                <div className="mt-2 ps-9 space-y-2">
                  {m.items.map((it) => (
                    <ItemCard key={`${m.id}-${it.id}`} item={it} sym={sym} soldOut={t("soldOut") || "Sold out"} />
                  ))}
                </div>
              )}

              {/* Placed-order / payment card */}
              {m.order && (
                <div className="ps-9">
                  <OrderCard order={m.order} sym={sym} t={t} />
                </div>
              )}

              {/* Quick replies — only on the most recent message */}
              {m.quickReplies && idx === messages.length - 1 && !loading && (
                <div className="mt-2.5 ps-9 flex flex-wrap gap-2">
                  {m.quickReplies.map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="ai-chip px-4 py-2 rounded-full text-sm font-semibold"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="ai-msg-in flex items-end gap-2">
              <div className="ai-grad w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-sm text-white shadow-sm">
                ✨
              </div>
              <div className="bg-white shadow-sm ring-1 ring-slate-100 rounded-[20px] rounded-bl-md px-4 py-3">
                <TypingDots />
              </div>
            </div>
          )}

          {error && (
            <div className="mx-auto max-w-[90%] text-center text-sm text-rose-600 bg-rose-50 ring-1 ring-rose-100 rounded-xl px-3 py-2">
              {error}
            </div>
          )}
        </div>

        {/* Composer */}
        <form
          className="shrink-0 px-3.5 pt-2 pb-3 bg-white border-t border-slate-100"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <p className="text-[10px] leading-tight text-slate-400 text-center mb-2">
            {t("aiDisclaimer") || "AI can make mistakes — please review your order."}
          </p>
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("aiInputPlaceholder") || "Type your message…"}
              disabled={loading}
              className="flex-1 px-4 py-3 rounded-2xl bg-slate-100 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:bg-white transition disabled:opacity-60"
              style={{ "--tw-ring-color": "var(--brand)" } as React.CSSProperties}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="ai-grad w-11 h-11 rounded-2xl text-white flex items-center justify-center shadow-md active:scale-95 disabled:opacity-40 disabled:shadow-none transition"
              aria-label={t("aiSend") || "Send"}
            >
              <svg className="w-5 h-5 rtl:-scale-x-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </form>
      </div>

      <style jsx global>{`
        @keyframes aiPanelIn {
          from { opacity: 0; transform: translateY(24px) scale(0.985); }
          to { opacity: 1; transform: none; }
        }
        @keyframes aiMsgIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: none; }
        }
        @keyframes aiFade { from { opacity: 0; } to { opacity: 1; } }
        .ai-grad { background: linear-gradient(135deg, var(--brand), var(--brand-dark, var(--brand))); }
        .ai-panel-in { animation: aiPanelIn 0.34s cubic-bezier(0.2, 0.9, 0.25, 1) both; }
        .ai-backdrop-in { animation: aiFade 0.25s ease both; }
        .ai-msg-in { animation: aiMsgIn 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
        .ai-chip {
          background: #fff;
          border: 1.5px solid var(--brand);
          color: var(--brand);
          transition: background 0.15s ease, color 0.15s ease, transform 0.1s ease;
        }
        .ai-chip:hover { background: var(--brand); color: #fff; }
        .ai-chip:active { transform: scale(0.96); }
      `}</style>
    </div>
  );
}

function ItemCard({
  item,
  sym,
  soldOut,
}: {
  item: AISuggestedItem;
  sym: string;
  soldOut: string;
}) {
  return (
    <div className="flex gap-3 bg-white rounded-2xl shadow-sm ring-1 ring-slate-100 overflow-hidden">
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl}
          alt={item.name}
          className={`w-[88px] h-[88px] object-cover shrink-0 ${!item.available ? "grayscale opacity-70" : ""}`}
        />
      ) : (
        <div className="w-[88px] h-[88px] shrink-0 bg-slate-100 flex items-center justify-center text-2xl">
          🍽️
        </div>
      )}
      <div className="flex-1 min-w-0 py-2.5 pe-3 flex flex-col justify-center">
        <div className="font-semibold text-sm text-slate-900 leading-snug line-clamp-1">
          {item.name}
        </div>
        {item.description && (
          <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        )}
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="font-extrabold text-[15px]" style={{ color: "var(--brand)" }}>
            {sym}
            {item.price.toFixed(2)}
          </span>
          {!item.available && (
            <span className="text-[10px] font-bold uppercase tracking-wide text-rose-500">
              {soldOut}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function OrderCard({
  order,
  sym,
  t,
}: {
  order: AIPlacedOrder;
  sym: string;
  t: (k: string) => string;
}) {
  return (
    <div className="mt-2 rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white p-3.5 shadow-sm">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="min-w-0">
          <div className="font-bold text-sm text-emerald-800 leading-tight">
            {t("aiOrderPlaced") || "Order placed!"}
          </div>
          <div className="text-xs text-slate-500">
            {(t("aiOrderNumber") || "Order #{id}").replace("{id}", String(order.orderId))}
          </div>
        </div>
        <div className="ms-auto font-extrabold text-slate-900 text-[15px] shrink-0">
          {sym}
          {order.total.toFixed(2)}
        </div>
      </div>
      {order.paymentUrl && (
        <a
          href={order.paymentUrl}
          className="ai-grad mt-3 flex items-center justify-center gap-2 w-full text-center text-white font-bold py-3 rounded-xl shadow-md active:scale-[0.98] transition"
        >
          {t("aiPayNow") || "Pay now"}
          <svg className="w-4 h-4 rtl:-scale-x-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </a>
      )}
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex gap-1.5">
      <span className="w-2 h-2 rounded-full bg-slate-300 animate-bounce [animation-delay:-0.3s]" />
      <span className="w-2 h-2 rounded-full bg-slate-300 animate-bounce [animation-delay:-0.15s]" />
      <span className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" />
    </div>
  );
}
