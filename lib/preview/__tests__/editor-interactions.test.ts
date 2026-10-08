import assert from "node:assert/strict";
import { test } from "node:test";
import { bindEditorInteractions } from "../editorInteractions";

test("a promotion that is its own section wrapper selects and highlights itself inside the order catalogue", () => {
  const messages: Array<Record<string, unknown>> = [];
  const handlers = new Map<string, (event: unknown) => void>();
  class CanvasElement {
    dataset: Record<string, string> = {};
    attributes = new Set<string>();
    matches(selector: string) { return selector === "[data-website-section]" && this === promotion; }
    closest(selector: string) {
      if (selector === "[data-commerce-cart]" && this === cartButton) return cartButton;
      if (selector === "[data-section-id]") return promotion;
      if (selector === "[data-editor-region]") return catalogue;
      return null;
    }
    querySelector() { return null; }
    querySelectorAll() { return []; }
    toggleAttribute(name: string, enabled: boolean) {
      if (enabled) this.attributes.add(name);
      else this.attributes.delete(name);
    }
    scrollIntoView() {}
  }
  const cartButton = new CanvasElement();
  const promotion = new CanvasElement();
  promotion.dataset = { sectionId: "42", websiteSection: "order_discovery", sectionType: "order_discovery" };
  const catalogue = new CanvasElement();
  catalogue.dataset = { editorRegion: "order-items" };
  const noop = () => {};
  const globals = {
    Element: CanvasElement,
    window: {
      parent: { postMessage: (message: Record<string, unknown>) => messages.push(message) },
      dispatchEvent: noop, addEventListener: noop, removeEventListener: noop,
    },
    document: {
      documentElement: { dataset: {}, addEventListener: noop, removeEventListener: noop },
      querySelectorAll: (selector: string) => selector === "[data-section-id]" ? [promotion] : [catalogue],
      addEventListener: (name: string, handler: (event: unknown) => void) => handlers.set(name, handler),
      removeEventListener: noop,
    },
  };
  const previous = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  try {
    for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true });
    const dispose = bindEditorInteractions({
      allowOrderJourney: true, origin: "https://admin.example.test", activePageKey: "order", sectionKeys: { "42": "42" },
      mode: { current: { previewOnly: false, sectionKey: null, field: null, region: null, hoveredSectionKey: null } },
    });
    handlers.get("pointerover")!({ target: promotion });
    assert.equal(messages.at(-1)?.sectionKey, "42");
    handlers.get("click")!({ target: promotion, preventDefault: noop, stopImmediatePropagation: noop });
    assert.equal(messages.at(-1)?.type, "foody.website-v3.select-section");
    assert.equal(messages.at(-1)?.sectionKey, "42");
    assert.equal(promotion.attributes.has("data-editor-selected"), true);
    assert.equal(catalogue.attributes.has("data-editor-selected"), false);
    handlers.get("click")!({ target: cartButton, preventDefault: noop, stopImmediatePropagation: noop });
    assert.equal(messages.at(-1)?.type, "foody.website-v3.open-order-journey");
    assert.equal(messages.at(-1)?.activePageKey, "order");
    dispose();
    const disposeOtherPage = bindEditorInteractions({
      origin: "https://admin.example.test", activePageKey: "home", sectionKeys: { "42": "42" },
      mode: { current: { previewOnly: false, sectionKey: null, field: null, region: null, hoveredSectionKey: null } },
    });
    handlers.get("click")!({ target: cartButton, preventDefault: noop, stopImmediatePropagation: noop });
    assert.notEqual(messages.at(-1)?.type, "foody.website-v3.open-order-journey");
    disposeOtherPage();
  } finally {
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
