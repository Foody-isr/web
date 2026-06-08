// Conversational modifier verbs (Square-style). Mirrors the Go `ModifierOperator`
// enum and the POS `ModifierOperator`. The wire value is sent as `operator` on
// each applied modifier; an empty value lets the server derive it from `action`.

export const MODIFIER_OPERATORS = [
  "add",
  "extra",
  "side",
  "replace",
  "light",
  "no",
  "allergy",
] as const;

export type ModifierOperatorValue = (typeof MODIFIER_OPERATORS)[number];

export const OPERATOR_LABELS: Record<ModifierOperatorValue, string> = {
  add: "Ajouter",
  extra: "Suppléments",
  side: "Accompagnement",
  replace: "Remplacer",
  light: "Clair",
  no: "Sans",
  allergy: "Allergie",
};

export type OperatorColor = "green" | "orange" | "red";

export const OPERATOR_COLOR: Record<ModifierOperatorValue, OperatorColor> = {
  add: "green",
  extra: "green",
  side: "orange",
  replace: "orange",
  light: "orange",
  no: "red",
  allergy: "red",
};

/** Non-charging verbs: the option is removed, reduced, or flagged. */
export function isFreeOperator(op: ModifierOperatorValue): boolean {
  return op === "light" || op === "no" || op === "allergy";
}

/** Default verb derived from a modifier's static action (remove→no, else add). */
export function operatorFromAction(action?: string): ModifierOperatorValue {
  return action === "remove" ? "no" : "add";
}

/** The verbs a set offers; honors enabledVerbs, otherwise the full palette. */
export function enabledOperators(
  enabledVerbs?: string[] | null,
): ModifierOperatorValue[] {
  if (!enabledVerbs || enabledVerbs.length === 0) return [...MODIFIER_OPERATORS];
  const result = MODIFIER_OPERATORS.filter((op) => enabledVerbs.includes(op));
  return result.length > 0 ? result : [...MODIFIER_OPERATORS];
}

/** Prefixes a modifier name with its verb, e.g. "Sans Oeuf". */
export function operatorDisplayName(
  op: ModifierOperatorValue | undefined,
  name: string,
): string {
  if (!op) return name;
  return `${OPERATOR_LABELS[op]} ${name}`;
}

/** What an applied modifier charges given the chosen verb (display only; the
 *  server is authoritative on submit). */
export function operatorPriceDelta(
  mod: { priceDelta?: number; extraPrice?: number },
  op?: ModifierOperatorValue,
): number {
  const o = op ?? "add";
  if (isFreeOperator(o)) return 0;
  if (o === "extra" && (mod.extraPrice ?? 0) > 0) return mod.extraPrice!;
  return mod.priceDelta ?? 0;
}
