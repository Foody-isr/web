"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { currencySymbol } from "@/lib/constants";
import { lineTotal } from "@/lib/cart";
import { useCartStore } from "@/store/useCartStore";
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
  /** active carte id — scopes AI suggestions to the menu the guest is viewing */
  menuId?: number;
  /** add a suggested dish to the cart. Returns true if added directly, false
   *  if it opened a config modal (variants/modifiers/combo). */
  onPickItem?: (itemId: number) => boolean;
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
  menuId,
  onPickItem,
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

    // Snapshot the live cart so the assistant knows what's selected and can
    // place exactly that. Shapes mirror the orders payload (see checkout).
    const lines = useCartStore.getState().lines;
    const cartTotal = useCartStore.getState().total();
    const cart = lines
      .filter((l) => !l.comboId)
      .map((line) => ({
        menu_item_id: Number(line.item.id),
        quantity: line.quantity,
        notes: line.note,
        selected_variant_id: line.selectedVariantId,
        modifiers: line.modifiers?.map((m) => ({
          modifier_id: Number(m.id),
          applied: true,
          operator: m.operator,
        })),
      }));
    const combos = lines
      .filter((l) => l.comboId && l.comboSelections)
      .map((line) => ({
        combo_item_id: line.comboId,
        notes: line.note,
        selections: line.comboSelections!.map((s) => ({
          step_id: s.stepId,
          menu_item_id: s.menuItemId,
          option_id: s.optionId || undefined,
          quantity: s.quantity,
          notes: s.notes,
        })),
      }));
    const cartSummary = lines.length
      ? lines
          .map(
            (l) =>
              `${l.quantity}× ${l.comboName || l.item.name}${
                l.selectedVariantName ? ` (${l.selectedVariantName})` : ""
              } — ${sym}${lineTotal(l).toFixed(2)}`
          )
          .join("\n") + `\nTotal: ${sym}${cartTotal.toFixed(2)}`
      : "";

    try {
      const resp = await sendAIOrderChat({
        restaurantId,
        message: trimmed,
        history,
        orderType,
        locale,
        menuId,
        cart,
        combos,
        cartSummary,
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
                    <ItemCard
                      key={`${m.id}-${it.id}`}
                      item={it}
                      sym={sym}
                      soldOut={t("soldOut") || "Sold out"}
                      addLabel={t("aiAdd") || "Add"}
                      onAdd={onPickItem}
                    />
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
  addLabel,
  onAdd,
}: {
  item: AISuggestedItem;
  sym: string;
  soldOut: string;
  addLabel: string;
  onAdd?: (itemId: number) => boolean;
}) {
  const [added, setAdded] = useState(false);
  const handleAdd = () => {
    if (!onAdd) return;
    const direct = onAdd(item.id);
    if (direct) {
      setAdded(true);
      window.setTimeout(() => setAdded(false), 1600);
    }
  };

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
      <div className="flex-1 min-w-0 py-2.5 pe-2 flex flex-col justify-center">
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
      {onAdd && item.available && (
        <button
          onClick={handleAdd}
          aria-label={addLabel}
          className={`my-auto me-2.5 shrink-0 w-9 h-9 rounded-full flex items-center justify-center shadow-sm active:scale-90 transition ${
            added ? "bg-emerald-500 text-white" : "ai-grad text-white"
          }`}
        >
          {added ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 5v14M5 12h14" />
            </svg>
          )}
        </button>
      )}
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

/**
 * AIProactivePrompt is the lightweight "Can I help you order?" nudge shown in
 * the middle of the screen (immediately or after a delay, per restaurant
 * settings). Accepting opens the full assistant; dismissing hides it.
 */
export function AIProactivePrompt({
  open,
  onAccept,
  onDismiss,
  restaurantName,
}: {
  open: boolean;
  onAccept: () => void;
  onDismiss: () => void;
  restaurantName: string;
}) {
  const { t, direction } = useI18n();
  if (!open) return null;

  const message = (
    t("aiGreeting") ||
    "Hi! I'm {name}'s ordering assistant. Want me to help you put together your order?"
  ).replace("{name}", restaurantName);

  return (
    <div
      className="fixed inset-0 z-[68] flex items-center justify-center p-4"
      dir={direction}
    >
      <div
        className="ai-nudge-fade absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onDismiss}
        aria-hidden
      />
      <div className="ai-nudge-in relative w-full max-w-[340px] bg-white rounded-[24px] shadow-2xl ring-1 ring-black/5 overflow-hidden">
        <button
          onClick={onDismiss}
          className="absolute top-3 end-3 w-8 h-8 rounded-full text-slate-400 hover:bg-slate-100 flex items-center justify-center transition"
          aria-label={t("close") || "Close"}
        >
          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="px-6 pt-7 pb-6 text-center">
          <div className="ai-nudge-grad ai-nudge-bob mx-auto w-16 h-16 rounded-full flex items-center justify-center text-3xl text-white shadow-lg">
            ✨
          </div>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-800 font-medium">
            {message}
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <button
              onClick={onAccept}
              className="ai-nudge-grad w-full py-3 rounded-xl text-white font-bold shadow-md active:scale-[0.98] transition"
            >
              {t("aiYesHelp") || "Yes, help me"}
            </button>
            <button
              onClick={onDismiss}
              className="w-full py-2.5 rounded-xl text-slate-500 font-semibold hover:bg-slate-100 transition"
            >
              {t("aiNoThanks") || "No thanks"}
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes aiNudgeIn {
          from { opacity: 0; transform: translateY(14px) scale(0.95); }
          to { opacity: 1; transform: none; }
        }
        @keyframes aiNudgeFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes aiNudgeBob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .ai-nudge-grad { background: linear-gradient(135deg, var(--brand), var(--brand-dark, var(--brand))); }
        .ai-nudge-in { animation: aiNudgeIn 0.32s cubic-bezier(0.2, 0.9, 0.25, 1) both; }
        .ai-nudge-fade { animation: aiNudgeFade 0.25s ease both; }
        .ai-nudge-bob { animation: aiNudgeBob 2.6s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
