import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { customerNoteValid, cartCustomerNotes } from "../customer-note";
import { CustomerNoteField } from "../../components/CustomerNoteField";
import { LocaleProvider } from "../i18n";
import { createOrder, fetchMenu } from "../../services/api";
import type { CustomerNoteConfig } from "../types";

Object.assign(globalThis, { React });
const config: CustomerNoteConfig = {
  enabled: true,
  required: true,
  label: "Message sur le gâteau",
  placeholder: "Indiquez le prénom ou le message",
};

test("required and optional notes are bounded only when enabled", () => {
  assert.equal(customerNoteValid(config, "   "), false);
  assert.equal(customerNoteValid(config, "Léa שלום"), true);
  assert.equal(customerNoteValid({ ...config, required: false }, ""), true);
  assert.equal(customerNoteValid(config, "א".repeat(500)), true);
  assert.equal(customerNoteValid(config, "א".repeat(501)), false);
  assert.equal(customerNoteValid(undefined, ""), true);
});

test("note fields expose their label, example, requirement and error accessibly", () => {
  const render = (noteConfig: CustomerNoteConfig | undefined, value = "") =>
    renderToStaticMarkup(
      React.createElement(
        LocaleProvider,
        null,
        React.createElement(CustomerNoteField, {
          config: noteConfig,
          value,
          onChange: () => {},
        }),
      ),
    );
  assert.match(render(config), /Message sur le gâteau/);
  assert.match(
    render(config),
    /placeholder="Indiquez le prénom ou le message"/,
  );
  assert.match(render(config), /required=""/);
  assert.match(render(config), /aria-invalid="true"/);
  assert.doesNotMatch(render(config, "Léa"), /aria-invalid/);
  assert.equal(render(undefined), "");
});

test("catalog config and submitted notes survive the public API contract", async () => {
  const originalFetch = globalThis.fetch;
  let submitted: Record<string, unknown> | undefined;
  globalThis.fetch = async (_input, init) => {
    if (init?.method === "POST") {
      submitted = JSON.parse(String(init.body));
      return Response.json({ order: { id: 1, items: [] } });
    }
    return Response.json({
      menus: [
        {
          id: 1,
          name: "Menu",
          groups: [
            {
              id: 1,
              name: "Gâteaux",
              items: [
                {
                  id: 1,
                  name: "Gâteau",
                  price: 20,
                  modifiers: [
                    {
                      id: 2,
                      name: "Personnalisation",
                      is_active: true,
                      customer_note: config,
                    },
                  ],
                  modifier_sets: [
                    {
                      id: 3,
                      modifiers: [
                        {
                          id: 4,
                          name: "Texte",
                          is_active: true,
                          customer_note: config,
                        },
                      ],
                    },
                  ],
                  option_sets: [
                    {
                      id: 5,
                      options: [
                        {
                          id: 6,
                          name: "Personnalisé",
                          price: 25,
                          is_active: true,
                          customer_note: config,
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
  };
  try {
    const menu = await fetchMenu("1");
    assert.deepEqual(menu.items[0].modifiers?.[0].customerNote, config);
    assert.deepEqual(
      menu.items[0].modifierSets?.[0].modifiers[0].customerNote,
      config,
    );
    assert.deepEqual(
      menu.items[0].optionSets?.[0].options[0].customerNote,
      config,
    );
    await createOrder({
      restaurantId: "1",
      orderType: "pickup",
      paymentMethod: "pay_later",
      items: [
        {
          itemId: "1",
          quantity: 1,
          note: "Sans noix",
          selectedVariantId: 6,
          selectedVariantNote: "Léa",
          modifiers: [
            {
              modifierId: "2",
              applied: true,
              note: "Joyeux anniversaire",
              },
          ],
        },
      ],
    });
    assert.deepEqual(submitted?.items, [
      {
        menu_item_id: 1,
        quantity: 1,
        notes: "Sans noix",
        selected_variant_id: 6,
        selected_variant_note: "Léa",
        modifiers: [
          {
            modifier_id: 2,
            applied: true,
            note: "Joyeux anniversaire",
          },
        ],
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("different messages stay on separate persisted cart lines and survive editing", async () => {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    },
  });
  const { useCartStore } = await import("../../store/useCartStore");
  const store = useCartStore.getState();
  store.clear();
  store.setContext("1", "EUR");
  const item = { id: "1", name: "Gâteau", price: 20, groupId: "1" };
  const modifier = {
    id: "2",
    name: "Personnalisation",
    action: "add" as const,
    priceDelta: 3,
    customerNote: config,
  };
  store.addItem(
    item,
    1,
    "Sans noix",
    [{ ...modifier, note: "Léa" }],
    6,
    "Personnalisé",
    25,
    "Rose",
  );
  store.addItem(item, 1, undefined, [{ ...modifier, note: "David" }]);
  const [first, second] = useCartStore.getState().lines;
  assert.equal(useCartStore.getState().lines.length, 2);
  assert.deepEqual(cartCustomerNotes(first), [
    "Personnalisation: Léa",
    "Personnalisé: Rose",
  ]);
  assert.deepEqual(cartCustomerNotes(second), ["Personnalisation: David"]);
  store.replaceItem(first.id, {
    ...first,
    modifiers: [{ ...modifier, note: "Noa" }],
  });
  const persisted = JSON.parse(data.get("foody-cart")!);
  assert.equal(persisted.state.lines[0].id, first.id);
  assert.equal(persisted.state.lines[0].modifiers[0].note, "Noa");
  assert.equal(persisted.state.lines[0].selectedVariantNote, "Rose");
  assert.equal(persisted.state.lines[1].modifiers[0].note, "David");
});
