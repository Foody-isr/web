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
      const greeting =
        (t("aiGreeting") || "Hi! I'm {name}'s ordering assistant. Want me to help you put together your order?").replace(
          "{name}",
          restaurantName,
        );
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
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
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
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div className="relative w-full sm:max-w-md h-[85vh] sm:h-[80vh] sm:max-h-[680px] bg-white sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-3 text-white shrink-0"
          style={{ background: "var(--brand)" }}
        >
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-lg">
            ✨
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold leading-tight truncate">
              {t("aiAssistantTitle") || "Order assistant"}
            </div>
            <div className="text-xs text-white/80 truncate">{restaurantName}</div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center"
            aria-label={t("close") || "Close"}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3 bg-gray-50">
          {messages.map((m) => (
            <div key={m.id}>
              <div
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                    m.role === "user"
                      ? "text-white rounded-br-sm"
                      : "bg-white text-gray-800 shadow-sm rounded-bl-sm"
                  }`}
                  style={m.role === "user" ? { background: "var(--brand)" } : undefined}
                >
                  {m.content}
                </div>
              </div>

              {/* Suggested item cards */}
              {m.items && m.items.length > 0 && (
                <div className="mt-2 space-y-2">
                  {m.items.map((it) => (
                    <ItemCard key={`${m.id}-${it.id}`} item={it} sym={sym} />
                  ))}
                </div>
              )}

              {/* Placed-order / payment card */}
              {m.order && (
                <OrderCard order={m.order} sym={sym} t={t} />
              )}

              {/* Quick replies (greeting) */}
              {m.quickReplies && !loading && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {m.quickReplies.map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="px-3 py-1.5 rounded-full border text-sm font-medium hover:bg-gray-100 transition-colors"
                      style={{ borderColor: "var(--brand)", color: "var(--brand)" }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white shadow-sm rounded-2xl rounded-bl-sm px-4 py-3">
                <TypingDots />
              </div>
            </div>
          )}

          {error && (
            <div className="text-center text-sm text-red-500 px-4">{error}</div>
          )}
        </div>

        {/* Composer */}
        <form
          className="shrink-0 flex items-center gap-2 px-3 py-2.5 border-t bg-white"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("aiInputPlaceholder") || "Type your message…"}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-full bg-gray-100 text-sm focus:outline-none focus:ring-2 disabled:opacity-60"
            style={{ "--tw-ring-color": "var(--brand)" } as React.CSSProperties}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="w-10 h-10 rounded-full text-white flex items-center justify-center disabled:opacity-40 transition-opacity"
            style={{ background: "var(--brand)" }}
            aria-label={t("aiSend") || "Send"}
          >
            <svg className="w-5 h-5 rtl:-scale-x-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}

function ItemCard({ item, sym }: { item: AISuggestedItem; sym: string }) {
  return (
    <div className="flex gap-3 bg-white rounded-xl shadow-sm overflow-hidden">
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl}
          alt={item.name}
          className="w-20 h-20 object-cover shrink-0"
        />
      ) : (
        <div className="w-20 h-20 shrink-0 bg-gray-100 flex items-center justify-center text-2xl">
          🍽️
        </div>
      )}
      <div className="flex-1 min-w-0 py-2 pe-3">
        <div className="flex items-start justify-between gap-2">
          <span className="font-semibold text-sm text-gray-900 truncate">{item.name}</span>
          <span className="font-bold text-sm shrink-0" style={{ color: "var(--brand)" }}>
            {sym}
            {item.price.toFixed(2)}
          </span>
        </div>
        {item.description && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.description}</p>
        )}
        {!item.available && (
          <span className="inline-block mt-1 text-[10px] font-medium text-red-500">
            Sold out
          </span>
        )}
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
    <div className="mt-2 rounded-xl border border-green-200 bg-green-50 p-3">
      <div className="flex items-center gap-2 text-green-700 font-semibold text-sm">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        {t("aiOrderPlaced") || "Order placed!"}
      </div>
      <div className="mt-1 text-sm text-gray-700">
        {(t("aiOrderNumber") || "Order #{id}").replace("{id}", String(order.orderId))} ·{" "}
        <span className="font-bold">
          {sym}
          {order.total.toFixed(2)}
        </span>
      </div>
      {order.paymentUrl && (
        <a
          href={order.paymentUrl}
          className="mt-2 block w-full text-center text-white font-bold py-2.5 rounded-lg"
          style={{ background: "var(--brand)" }}
        >
          {t("aiPayNow") || "Pay now"}
        </a>
      )}
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex gap-1">
      <span className="w-2 h-2 rounded-full bg-gray-300 animate-bounce [animation-delay:-0.3s]" />
      <span className="w-2 h-2 rounded-full bg-gray-300 animate-bounce [animation-delay:-0.15s]" />
      <span className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" />
    </div>
  );
}
