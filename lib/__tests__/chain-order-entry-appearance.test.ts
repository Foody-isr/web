import assert from "node:assert/strict";
import test from "node:test";
import { resolveChainOrderEntryAppearance } from "../chainOrderEntryAppearance";

test("chain selector appearance keeps safe defaults for legacy pages", () => {
  assert.deepEqual(resolveChainOrderEntryAppearance({}), {
    logoUrl: undefined,
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
        logo_url: " https://cdn.example.com/selector-logo.png ",
        layout: "cards",
        show_search: false,
        show_near_me: false,
        show_branch_count: false,
        show_branch_numbers: false,
        surface_color: "#fffaf0",
        overlay_opacity: 140,
        translations: {
          fr: {
            brandName: " Moulin Dorée Paris ",
            title: "  Choisissez votre adresse  ",
            ignored: "x",
          },
        },
      },
    }),
    {
      logoUrl: "https://cdn.example.com/selector-logo.png",
      layout: "cards",
      showSearch: false,
      showNearMe: false,
      showBranchCount: false,
      showBranchNumbers: false,
      surfaceColor: "#fffaf0",
      overlayOpacity: 100,
      translations: {
        en: undefined,
        fr: {
          brandName: "Moulin Dorée Paris",
          title: "Choisissez votre adresse",
        },
        he: undefined,
      },
    },
  );
});
