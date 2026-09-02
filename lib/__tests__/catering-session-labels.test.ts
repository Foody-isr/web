import assert from "node:assert/strict";
import test from "node:test";

import {
  cateringSessionDate,
  cateringSessionSummary,
  cateringSessionTitle,
} from "@/lib/cateringSessionLabels";

test("catering session dates use a complete French calendar label", () => {
  const session = { label: "2026-09-04", date: "2026-09-04" };

  assert.equal(cateringSessionDate(session, "fr"), "Vendredi 4 Septembre 2026");
  assert.equal(
    cateringSessionTitle(session, "fr"),
    "Vendredi 4 Septembre 2026",
  );
  assert.equal(
    cateringSessionSummary(session, "fr"),
    "Vendredi 4 Septembre 2026",
  );
});

test("catering session summaries preserve an authored label and append the date", () => {
  const session = { label: "Samedi midi", date: "2026-09-05" };

  assert.equal(cateringSessionTitle(session, "fr"), "Samedi midi");
  assert.equal(
    cateringSessionSummary(session, "fr"),
    "Samedi midi · Samedi 5 Septembre 2026",
  );
});
