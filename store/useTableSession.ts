"use client";

import { create } from "zustand";
import { SessionGuest, TableOrder } from "@/lib/types";
import {
  fetchTableSession,
  joinTableSession,
  leaveTableSession,
  fetchSessionOrders,
  tableSessionWsUrl,
} from "@/services/api";

const AVATAR_EMOJIS = ["😎", "🤩", "😊", "🥳", "😺", "🦊", "🐻", "🐼", "🦁", "🐸", "🐵", "🦄", "🐲", "👻", "🤖", "👽", "🧑‍🍳", "🧙"];

function randomEmoji() {
  return AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)];
}

/** localStorage key for persisting guest identity per session */
function guestStorageKey(sessionId: string) {
  return `foody-guest-${sessionId}`;
}

type StoredGuest = {
  id: string;
  displayName: string;
  avatarEmoji: string;
};

type TableSessionState = {
  // Session state
  sessionId: string | null;
  tableCode: string | null;
  restaurantId: number | null;
  status: "idle" | "loading" | "active" | "expired" | "error";

  // Guest identity
  guestId: string | null;
  guestName: string | null;
  guestEmoji: string | null;

  // Table data
  guests: SessionGuest[];
  orders: TableOrder[];

  // WebSocket
  _ws: WebSocket | null;

  // Actions
  initialize: (sessionId: string) => Promise<void>;
  joinSession: (displayName: string, avatarEmoji?: string) => Promise<void>;
  leaveTable: () => Promise<void>;
  refreshOrders: () => Promise<void>;
  disconnect: () => void;

  // Computed
  totalTableAmount: () => number;
  myOrders: () => TableOrder[];
};

export const useTableSession = create<TableSessionState>()((set, get) => ({
  sessionId: null,
  tableCode: null,
  restaurantId: null,
  status: "idle",
  guestId: null,
  guestName: null,
  guestEmoji: null,
  guests: [],
  orders: [],
  _ws: null,

  initialize: async (sessionId: string) => {
    const current = get();
    if (current.sessionId === sessionId && current.status === "active") return;

    set({ status: "loading", sessionId });

    try {
      // 1. Fetch session details (with guests)
      const session = await fetchTableSession(sessionId);
      if (session.status !== "active") {
        set({ status: "expired" });
        return;
      }

      // 2. Fetch orders for this session
      const orders = await fetchSessionOrders(sessionId);

      // 3. Check if we already have a guest identity for this session
      let storedGuest: StoredGuest | null = null;
      try {
        const raw = localStorage.getItem(guestStorageKey(sessionId));
        if (raw) storedGuest = JSON.parse(raw);
      } catch {}

      // 4. Verify stored guest is still in the guest list
      const isValidGuest = storedGuest && session.guests.some((g) => g.id === storedGuest!.id);

      set({
        tableCode: session.table_code,
        restaurantId: session.restaurant_id,
        status: "active",
        guests: session.guests ?? [],
        orders,
        guestId: isValidGuest ? storedGuest!.id : null,
        guestName: isValidGuest ? storedGuest!.displayName : null,
        guestEmoji: isValidGuest ? storedGuest!.avatarEmoji : null,
      });

      // 5. Connect WebSocket for real-time updates
      get().disconnect(); // close any existing
      const wsUrl = tableSessionWsUrl(sessionId);
      const ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const state = get();

          switch (msg.type) {
            case "guest.joined": {
              const guest = msg.payload as SessionGuest;
              const exists = state.guests.some((g) => g.id === guest.id);
              if (!exists) {
                set({ guests: [...state.guests, guest] });
              }
              break;
            }
            case "guest.left": {
              const leftGuestId = (msg.payload as { guest_id: string }).guest_id;
              set({ guests: state.guests.filter((g) => g.id !== leftGuestId) });
              break;
            }
            case "table.order.created":
            case "table.order.updated": {
              // Refresh orders from server for accuracy
              get().refreshOrders();
              break;
            }
          }
        } catch {}
      };

      ws.onerror = () => {};
      ws.onclose = () => {
        // Auto-reconnect after 3s if still active
        setTimeout(() => {
          const s = get();
          if (s.sessionId === sessionId && s.status === "active") {
            s.initialize(sessionId);
          }
        }, 3000);
      };

      set({ _ws: ws });
    } catch {
      set({ status: "error" });
    }
  },

  joinSession: async (displayName: string, avatarEmoji?: string) => {
    const { sessionId } = get();
    if (!sessionId) return;

    const emoji = avatarEmoji || randomEmoji();
    const guest = await joinTableSession(sessionId, displayName, emoji);

    // Store in localStorage
    const storedGuest: StoredGuest = {
      id: guest.id,
      displayName: guest.display_name,
      avatarEmoji: guest.avatar_emoji,
    };
    localStorage.setItem(guestStorageKey(sessionId), JSON.stringify(storedGuest));

    set({
      guestId: guest.id,
      guestName: guest.display_name,
      guestEmoji: guest.avatar_emoji,
      guests: [...get().guests.filter((g) => g.id !== guest.id), guest],
    });
  },

  leaveTable: async () => {
    const { sessionId, guestId } = get();
    if (sessionId && guestId) {
      // Remove from server so other guests stop seeing this person
      try {
        await leaveTableSession(sessionId, guestId);
      } catch {}
      localStorage.removeItem(guestStorageKey(sessionId));
    }
    set({
      guestId: null,
      guestName: null,
      guestEmoji: null,
      guests: get().guests.filter((g) => g.id !== guestId),
    });
  },

  refreshOrders: async () => {
    const { sessionId } = get();
    if (!sessionId) return;
    try {
      const orders = await fetchSessionOrders(sessionId);
      set({ orders });
    } catch {}
  },

  disconnect: () => {
    const ws = get()._ws;
    if (ws) {
      ws.onclose = null; // prevent auto-reconnect
      ws.close();
      set({ _ws: null });
    }
  },

  totalTableAmount: () => {
    return get().orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  },

  myOrders: () => {
    const { guestId, orders } = get();
    if (!guestId) return orders;
    return orders.filter((o) => o.guest_id === guestId);
  },
}));
