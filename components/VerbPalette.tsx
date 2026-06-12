"use client";

import {
  ModifierOperatorValue,
  OPERATOR_COLOR,
  operatorLabel,
} from "@/lib/modifierOperator";
import { useI18n } from "@/lib/i18n";

const COLOR_CLASSES: Record<string, { active: string; idle: string }> = {
  green: {
    active: "bg-emerald-500 text-white border-emerald-500",
    idle: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  orange: {
    active: "bg-orange-500 text-white border-orange-500",
    idle: "bg-orange-50 text-orange-700 border-orange-200",
  },
  red: {
    active: "bg-red-500 text-white border-red-500",
    idle: "bg-red-50 text-red-700 border-red-200",
  },
};

/**
 * The conversational verb selector (Ajouter / Suppléments / Accompagnement /
 * Remplacer / Clair / Sans / Allergie). The guest "arms" a verb, then taps an
 * ingredient row to apply it (Square POS interaction, mobile-friendly chips).
 */
export function VerbPalette({
  operators,
  armed,
  onArm,
}: {
  operators: ModifierOperatorValue[];
  armed: ModifierOperatorValue;
  onArm: (op: ModifierOperatorValue) => void;
}) {
  const { locale } = useI18n();
  return (
    <div className="flex flex-wrap gap-2">
      {operators.map((op) => {
        const c = COLOR_CLASSES[OPERATOR_COLOR[op]];
        const isArmed = op === armed;
        return (
          <button
            key={op}
            type="button"
            onClick={() => onArm(op)}
            className={`px-3 py-1.5 rounded-full text-[13px] font-bold border transition active:scale-95 ${
              isArmed ? c.active : c.idle
            }`}
          >
            {operatorLabel(op, locale)}
          </button>
        );
      })}
    </div>
  );
}
