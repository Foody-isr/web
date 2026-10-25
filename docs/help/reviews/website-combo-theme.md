# Website combo appearance review — 25 October 2026

The combo entry sheet, fixed bundle action, variant picker, step panel and
read-only detail sheet now share the published item-detail color style, fonts,
width, corners and button shape. The website catalogue stays mounted during
composition, preserving its published menu layout and group navigation. Eligible
choices expose their pick count and a decrement action; step-specific sold-out
choices remain disabled. Bottom spacing follows the measured progress panel.

Reviewed help operations are `combos/website-composition`,
`guest-ordering/choose-menu-and-group` and `website-order-design/item-surface`.
Their French, English and Hebrew guides are prepared in the isolated Landing
worktree at `output/website-combo-theme/landing`. Publish them with the corrected
guest Web release, after checking development. No production state is changed.

The source inventory refresh covers Web, Landing and the API's synchronized
public help corpus. Admin, POS and Backoffice evidence remains exactly the
baseline in Landing commit `7d178190cc27e2e27b55c0b8d546148d6b00b1d0`;
unrelated working changes are excluded.
The exact scoped JSON review covers only unrelated site-editor features sharing
the catalogue component. Combo and ordering changes require the guide updates.

The release contract pins the immutable reviewed Landing commit before pushing
the Web and API branches. The API embeds the exact public corpus from that
revision; publish the coordinated documentation with the feature release.

Synthetic browser regression: `npx playwright test -c playwright.combo.config.ts`.
It covers inherited and explicit item styles, desktop/mobile, FR/EN/HE, preserved
catalogue identity, variants, step navigation, decrement, quick view, cancellation,
cart snapshots, mobile grids and fixed/custom combo batches in Chromium and WebKit. No real customer,
payment or restaurant mutation is used.

Validation passed: 8 browser scenarios, 40 targeted combo/appearance unit tests,
Web lint and TypeScript, Landing help checks and 44 help regression tests,
Landing lint, TypeScript and production build. Existing Web lint warnings remain
outside the changed components. Both local source/documentation contracts pass.
