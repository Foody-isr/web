import type {
  CateringFlowAnswerValue,
  CateringFlowConfigPublic,
  CateringFlowStepPublic,
  CateringQuoteSessionPayload,
} from "@/services/api";

export type CateringFlowAnswers = Record<string, CateringFlowAnswerValue>;

export function flowStepIsVisible(step: CateringFlowStepPublic, answers: CateringFlowAnswers): boolean {
  if (!step.condition) return true;
  const answer = answers[step.condition.step_id];
  if (typeof answer === "string") return answer === step.condition.option_id;
  if (Array.isArray(answer)) return answer.includes(step.condition.option_id);
  return Boolean(answer && answer[step.condition.option_id] > 0);
}

export function visibleFlowSteps(config: CateringFlowConfigPublic, answers: CateringFlowAnswers): CateringFlowStepPublic[] {
  return config.steps.filter((step) => flowStepIsVisible(step, answers));
}

export function flowStepComplete(
  step: CateringFlowStepPublic,
  answers: CateringFlowAnswers,
  sessions: CateringQuoteSessionPayload[],
  guests: number,
): boolean {
  if (!step.required) return true;
  if (step.kind === "guest_count") return guests > 0;
  if (step.kind === "schedule") {
    const settings = step.schedule;
    if (!settings || sessions.length < settings.min_sessions || sessions.length > settings.max_sessions) return false;
    if (!sessions.every((session) => Boolean(session.id && session.date))) return false;
    if (!settings.allow_same_day && new Set(sessions.map((session) => session.date)).size !== sessions.length) return false;
    return true;
  }
  const answer = answers[step.id];
  if (typeof answer === "string") return answer.length > 0;
  if (Array.isArray(answer)) return answer.length > 0;
  return Boolean(answer && Object.values(answer).some((quantity) => quantity > 0));
}

export function addDays(date: string, days: number): string {
  if (!date) return "";
  const value = new Date(`${date}T12:00:00`);
  if (Number.isNaN(value.getTime())) return "";
  value.setDate(value.getDate() + days);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function estimateFlowAdjustment(
  config: CateringFlowConfigPublic | undefined,
  answers: CateringFlowAnswers,
  sessions: CateringQuoteSessionPayload[],
  guests: number,
): number {
  if (!config?.enabled) return 0;
  const sessionCount = Math.max(1, sessions.length);
  let total = 0;
  for (const step of visibleFlowSteps(config, answers)) {
    if (!step.options?.length) continue;
    const answer = answers[step.id];
    const quantities: Record<string, number> = typeof answer === "string"
      ? { [answer]: 1 }
      : Array.isArray(answer)
        ? Object.fromEntries(answer.map((id) => [id, 1]))
        : answer ?? {};
    for (const option of step.options) {
      const quantity = quantities[option.id] ?? 0;
      if (quantity <= 0) continue;
      let multiplier = 1;
      if (option.price_mode === "per_guest") multiplier = guests;
      else if (option.price_mode === "per_session") multiplier = sessionCount;
      else if (option.price_mode === "per_guest_session") multiplier = guests * sessionCount;
      else if (option.price_mode === "per_unit") multiplier = quantity;
      total += (option.price ?? 0) * multiplier;
    }
  }
  return total;
}

export function describeFlowAnswer(step: CateringFlowStepPublic, answers: CateringFlowAnswers): string {
  const answer = answers[step.id];
  if (!answer || !step.options) return "";
  const labels = step.options.flatMap((option) => {
    const quantity = typeof answer === "string"
      ? Number(answer === option.id)
      : Array.isArray(answer)
        ? Number(answer.includes(option.id))
        : answer[option.id] ?? 0;
    if (quantity <= 0) return [];
    return [quantity > 1 ? `${quantity} × ${option.label}` : option.label];
  });
  return labels.join(", ");
}
