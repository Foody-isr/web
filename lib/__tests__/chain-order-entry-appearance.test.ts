import assert from "node:assert/strict";
import test from "node:test";
import { resolveChainOrderEntryAppearance } from "../chainOrderEntryAppearance";

test("chain selector appearance keeps safe defaults for legacy pages", () => {
  assert.deepEqual(resolveChainOrderEntryAppearance({}), {
    layout: "list",
    showSearch: true,
    showNearMe: true,
    showBranchCount: true,
    showBranchNumbers: true,
    surfaceColor: "#18181a",
    overlayOpacity: 78,
    translations: { en: undefined, fr: undefined, he: undefined },
  });
});

test("chain selector appearance normalizes presentation and localized copy", () => {
  assert.deepEqual(
    resolveChainOrderEntryAppearance({
      chain_order_entry: {
        layout: "cards",
        show_search: false,
        show_near_me: false,
        show_branch_count: false,
        show_branch_numbers: false,
        surface_color: "#fffaf0",
        overlay_opacity: 140,
        translations: {
          fr: { title: "  Choisissez votre adresse  ", ignored: "x" },
        },
      },
    }),
    {
      layout: "cards",
      showSearch: false,
      showNearMe: false,
      showBranchCount: false,
      showBranchNumbers: false,
      surfaceColor: "#fffaf0",
      overlayOpacity: 100,
      translations: {
        en: undefined,
        fr: { title: "Choisissez votre adresse" },
        he: undefined,
      },
    },
  );
});
