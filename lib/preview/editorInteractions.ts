import { isEditorElement, isInlineTextElement } from "./editorElements";

type EditorMode = {
  previewOnly: boolean;
  sectionKey: string | null;
  field: string | null;
  region: "header" | "footer" | "footer-branding" | "order-banner" | "order-items" | "order-fulfillment" | null;
  hoveredSectionKey: string | null;
  orderDialog?: "fulfillment" | "item" | null;
};

/** Binds editor-only canvas interactions after a trusted draft has been received. */
export function bindEditorInteractions({
  origin,
  activePageKey,
  sectionKeys,
  allowOrderJourney = false,
  mode,
}: {
  origin: string;
  activePageKey: string;
  sectionKeys: Record<string, string>;
  allowOrderJourney?: boolean;
  mode: { current: EditorMode };
}): () => void {
  let editing: {
    element: HTMLElement;
    key: string;
    field: string;
    previousValue: string;
  } | null = null;
  let hovered: string | null = null;
  const post = (type: string, data: Record<string, unknown>) =>
    window.parent.postMessage(
      { type: `foody.website-v3.${type}`, activePageKey, ...data },
      origin,
    );
  const sectionFor = (target: Element) => {
    const wrapper = target.closest<HTMLElement>("[data-section-id]");
    const key = wrapper && sectionKeys[wrapper.dataset.sectionId ?? ""];
    const element = wrapper?.matches("[data-website-section]")
      ? wrapper
      : wrapper?.querySelector<HTMLElement>("[data-website-section]");
    return key && element
      ? { key, element, type: element.dataset.sectionType ?? "" }
      : null;
  };
  const finish = (cancel = false) => {
    const current = editing;
    if (!current) return;
    editing = null;
    current.element.removeAttribute("contenteditable");
    // innerText preserves line breaks but also applies CSS text-transform.
    // Read the user's text without persisting the visual all-caps treatment.
    const transform = current.element.style.textTransform;
    current.element.style.textTransform = "none";
    const value = current.element.innerText.replace(/\r\n/g, "\n");
    current.element.style.textTransform = transform;
    if (cancel) current.element.textContent = current.previousValue;
    else if (value !== current.previousValue)
      post("edit-element", {
        sectionKey: current.key,
        field: current.field,
        value,
        previousValue: current.previousValue,
      });
  };
  const mark = (scroll: boolean) => {
    const editorMode = mode.current.previewOnly ? "preview" : "edit";
    const modeChanged = document.documentElement.dataset.websiteEditor !== editorMode;
    document.documentElement.dataset.websiteEditor = editorMode;
    const orderDialog = mode.current.previewOnly ? "" : mode.current.orderDialog ?? "";
    if (modeChanged || document.documentElement.dataset.websiteOrderDialog !== orderDialog) {
      document.documentElement.dataset.websiteOrderDialog = orderDialog;
      window.dispatchEvent(new Event("foody:website-order-preview"));
    }
    document
      .querySelectorAll<HTMLElement>("[data-editor-region]")
      .forEach((element) => {
        const selected = element.dataset.editorRegion === mode.current.region;
        element.toggleAttribute("data-editor-selected", selected);
        element.toggleAttribute(
          "data-editor-hovered",
          `site:${element.dataset.editorRegion}` ===
            mode.current.hoveredSectionKey,
        );
        if (selected && scroll)
          element.scrollIntoView({ block: "nearest", behavior: "instant" });
      });
    document
      .querySelectorAll<HTMLElement>("[data-section-id]")
      .forEach((wrapper) => {
        const key = sectionKeys[wrapper.dataset.sectionId ?? ""];
        const section = wrapper.querySelector<HTMLElement>(
          "[data-website-section]",
        ) ?? (wrapper.matches("[data-website-section]") ? wrapper : null);
        const selected = key === mode.current.sectionKey;
        section?.toggleAttribute("data-editor-selected", selected);
        section?.toggleAttribute(
          "data-editor-hovered",
          key === mode.current.hoveredSectionKey,
        );
        wrapper
          .querySelectorAll<HTMLElement>("[data-editor-field]")
          .forEach((field) => {
            field.toggleAttribute(
              "data-editor-element-selected",
              selected && field.dataset.editorField === mode.current.field,
            );
            if (mode.current.previewOnly) field.removeAttribute("tabindex");
            else field.tabIndex = 0;
          });
        if (selected && scroll)
          wrapper.scrollIntoView({ block: "start", behavior: "instant" });
      });
  };
  const onMode = (event: MessageEvent) => {
    if (event.source !== window.parent || event.origin !== origin) return;
    const data = event.data;
    if (
      data?.type !== "foody.website-v3.editor-mode" ||
      typeof data.previewOnly !== "boolean"
    )
      return;
    if (data.sectionKey !== null && typeof data.sectionKey !== "string") return;
    const changed =
      data.sectionKey !== mode.current.sectionKey ||
      data.region !== mode.current.region;
    if (
      changed ||
      data.previewOnly ||
      (editing && data.field !== editing.field)
    )
      finish();
    mode.current = {
      previewOnly: data.previewOnly,
      sectionKey: data.sectionKey,
      field: typeof data.field === "string" ? data.field : null,
      orderDialog: data.orderDialog === "fulfillment" || data.orderDialog === "item" ? data.orderDialog : null,
      region:
        data.region === "header" || data.region === "footer" || data.region === "footer-branding" || data.region === "order-banner" || data.region === "order-items" || data.region === "order-fulfillment"
          ? data.region
          : null,
      hoveredSectionKey:
        typeof data.hoveredSectionKey === "string"
          ? data.hoveredSectionKey
          : null,
    };
    mark(changed);
  };
  const onClick = (event: MouseEvent | KeyboardEvent) => {
    if (mode.current.previewOnly || !(event.target instanceof Element)) return;
    if (allowOrderJourney && event.target.closest("[data-commerce-cart]")) {
      finish();
      event.preventDefault();
      event.stopImmediatePropagation();
      post("open-order-journey", {});
      return;
    }
    const section = sectionFor(event.target);
    const region = event.target.closest<HTMLElement>("[data-editor-region]")
      ?.dataset.editorRegion;
    // Shared regions belong to the site. Editable promotions inside the order
    // catalogue keep their own section inspector instead of selecting the list.
    if (region === "header" || region === "footer" || region === "footer-branding" || region === "order-banner" || (region === "order-items" && !section) || region === "order-fulfillment") {
      finish();
      event.preventDefault();
      event.stopImmediatePropagation();
      mode.current = {
        ...mode.current,
        region,
        sectionKey: null,
        field: null,
      };
      mark(false);
      post("select-region", { region, ...(region === "header" ? { element: event.target.closest<HTMLElement>("[data-header-element]")?.dataset.headerElement } : {}) });
      return;
    }
    if (!section) return;
    const target = event.target.closest<HTMLElement>("[data-editor-field]");
    const field = target?.dataset.editorField;
    if (editing?.element === target) {
      if (target?.closest("a")) event.preventDefault();
      event.stopPropagation();
      return;
    }
    finish();
    event.preventDefault();
    event.stopImmediatePropagation();
    const validField = isEditorElement(section.type, field) ? field : null;
    mode.current = {
      ...mode.current,
      sectionKey: section.key,
      field: validField,
      region: null,
    };
    mark(false);
    post("select-section", { sectionKey: section.key, field: validField });
    if (target && isInlineTextElement(section.type, field)) {
      editing = {
        element: target,
        key: section.key,
        field,
        previousValue: target.textContent ?? "",
      };
      target.contentEditable = "plaintext-only";
      target.focus({ preventScroll: true });
      const range = document.createRange();
      range.selectNodeContents(target);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  };
  const onPointer = (event: PointerEvent) => {
    if (mode.current.previewOnly) return;
    const region =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-editor-region]")?.dataset
            .editorRegion
        : null;
    const key =
      event.target instanceof Element
        ? region
          ? (region === "order-items" ? sectionFor(event.target)?.key : null) ?? `site:${region}`
          : (sectionFor(event.target)?.key ?? null)
        : null;
    if (key === hovered) return;
    hovered = key;
    post("hover-section", { sectionKey: key });
  };
  const onLeave = () => {
    if (hovered) {
      hovered = null;
      post("hover-section", { sectionKey: null });
    }
  };
  const onBlur = (event: FocusEvent) => {
    if (event.target === editing?.element) finish();
  };
  const onKey = (event: KeyboardEvent) => {
    if (
      event.key === "Enter" &&
      !editing &&
      event.target instanceof Element &&
      event.target.matches("[data-editor-field]")
    ) {
      onClick(event);
      return;
    }
    if (event.key === "Escape" && !mode.current.previewOnly) {
      event.preventDefault();
      if (editing) {
        const element = editing.element;
        finish(true);
        element.blur();
      } else post("select-section", { sectionKey: null, field: null });
    }
  };
  // The selected preview section may not have existed when its mode message arrived.
  // Reapply scrolling after the newly materialized DOM has been bound.
  mark(Boolean(mode.current.sectionKey || mode.current.region));
  window.addEventListener("message", onMode);
  document.addEventListener("click", onClick, true);
  document.addEventListener("pointerover", onPointer);
  document.documentElement.addEventListener("pointerleave", onLeave);
  document.addEventListener("blur", onBlur, true);
  document.addEventListener("keydown", onKey);
  return () => {
    // A newer snapshot is authoritative (undo, page switch, save ID reconciliation).
    if (editing) editing.element.removeAttribute("contenteditable");
    window.removeEventListener("message", onMode);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("pointerover", onPointer);
    document.documentElement.removeEventListener("pointerleave", onLeave);
    document.removeEventListener("blur", onBlur, true);
    document.removeEventListener("keydown", onKey);
    delete document.documentElement.dataset.websiteEditor;
    delete document.documentElement.dataset.websiteOrderDialog;
  };
}
