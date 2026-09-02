export type CateringQuoteChoice = {
  menuItemId?: number;
  name: string;
  quantity: number;
  priceDelta?: number;
  lineTotal?: number;
};

export type CateringQuoteChoiceGroup = {
  choiceGroupId?: number;
  name: string;
  selections: CateringQuoteChoice[];
};

export type CateringQuoteIncludedItem = {
  menuItemId?: number;
  name: string;
  description?: string;
};

export type CateringQuoteItemLine = {
  catalogItemId?: number;
  name: string;
  unitPrice?: number;
  pricingRuleLabel?: string;
  quantity?: number;
  basis?: string;
  lineTotal?: number;
  choices: CateringQuoteChoiceGroup[];
  includedItems: CateringQuoteIncludedItem[];
};

export type CateringQuoteOptionLine = {
  optionId?: number;
  name: string;
  priceMode?: string;
  price?: number;
  lineTotal?: number;
};

export type CateringQuoteFlowSelection = {
  sessionId?: string;
  stepId?: string;
  stepTitle: string;
  optionId?: string;
  label: string;
  quantity: number;
  lineTotal?: number;
};

export type ParsedCateringQuoteConfig = {
  guests?: number;
  eventDate?: string | null;
  eventType?: string;
  items: CateringQuoteItemLine[];
  options: CateringQuoteOptionLine[];
  flowSelections: CateringQuoteFlowSelection[];
  sessions: Array<{
    id: string;
    label: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    guests: number;
    subtotal: number;
    items: CateringQuoteItemLine[];
    options: CateringQuoteOptionLine[];
    flowSelections: CateringQuoteFlowSelection[];
  }>;
};

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
    : [];
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseChoices(value: unknown): CateringQuoteChoiceGroup[] {
  return records(value).flatMap((group) => {
    const selections = records(group.selections).flatMap((selection) => {
      if (typeof selection.name !== "string") return [];
      return [{
        menuItemId: optionalNumber(selection.menu_item_id),
        name: selection.name,
        quantity: optionalNumber(selection.quantity) ?? 1,
        priceDelta: optionalNumber(selection.price_delta),
        lineTotal: optionalNumber(selection.line_total),
      }];
    });
    if (typeof group.name !== "string" || selections.length === 0) return [];
    return [{
      choiceGroupId: optionalNumber(group.choice_group_id),
      name: group.name,
      selections,
    }];
  });
}

function parseIncludedItems(value: unknown): CateringQuoteIncludedItem[] {
  return records(value).flatMap((item) => {
    if (typeof item.name !== "string") return [];
    return [{
      menuItemId: optionalNumber(item.menu_item_id),
      name: item.name,
      description: typeof item.description === "string" ? item.description : undefined,
    }];
  });
}

function parseItems(value: unknown): CateringQuoteItemLine[] {
  return records(value).flatMap((item) => {
    if (typeof item.name !== "string") return [];
    return [{
      catalogItemId: optionalNumber(item.catalog_item_id),
      name: item.name,
      unitPrice: optionalNumber(item.unit_price),
      pricingRuleLabel: typeof item.pricing_rule_label === "string" ? item.pricing_rule_label : undefined,
      quantity: optionalNumber(item.quantity),
      basis: typeof item.basis === "string" ? item.basis : undefined,
      lineTotal: optionalNumber(item.line_total),
      choices: parseChoices(item.choices),
      includedItems: parseIncludedItems(item.included_items),
    }];
  });
}

function parseOptions(value: unknown): CateringQuoteOptionLine[] {
  return records(value).flatMap((option) => {
    if (typeof option.name !== "string") return [];
    return [{
      optionId: optionalNumber(option.option_id),
      name: option.name,
      priceMode: typeof option.price_mode === "string" ? option.price_mode : undefined,
      price: optionalNumber(option.price),
      lineTotal: optionalNumber(option.line_total),
    }];
  });
}

function parseFlowSelections(value: unknown): CateringQuoteFlowSelection[] {
  return records(value).flatMap((selection) => {
    if (typeof selection.step_title !== "string" || typeof selection.label !== "string") return [];
    return [{
      sessionId: typeof selection.session_id === "string" ? selection.session_id : undefined,
      stepId: typeof selection.step_id === "string" ? selection.step_id : undefined,
      stepTitle: selection.step_title,
      optionId: typeof selection.option_id === "string" ? selection.option_id : undefined,
      label: selection.label,
      quantity: optionalNumber(selection.quantity) ?? 1,
      lineTotal: optionalNumber(selection.line_total),
    }];
  });
}

/** Parses the immutable server-side quote snapshot without trusting JSON input. */
export function parseCateringQuoteConfig(config: unknown): ParsedCateringQuoteConfig {
  const parsed: ParsedCateringQuoteConfig = {
    items: [],
    options: [],
    flowSelections: [],
    sessions: [],
  };
  if (!config || typeof config !== "object") return parsed;
  const value = config as Record<string, unknown>;

  const guests = optionalNumber(value.guests);
  if (guests !== undefined) parsed.guests = guests;
  if (typeof value.event_date === "string") parsed.eventDate = value.event_date;
  if (typeof value.event_type === "string") parsed.eventType = value.event_type;
  parsed.items = parseItems(value.items);
  parsed.options = parseOptions(value.options);
  parsed.flowSelections = parseFlowSelections(value.flow_prices);
  parsed.sessions = records(value.sessions).flatMap((session) => {
    if (typeof session.id !== "string" || optionalNumber(session.subtotal) === undefined) return [];
    return [{
      id: session.id,
      label: typeof session.label === "string" ? session.label : session.id,
      date: typeof session.date === "string" ? session.date : undefined,
      startTime: typeof session.start_time === "string" ? session.start_time : undefined,
      endTime: typeof session.end_time === "string" ? session.end_time : undefined,
      guests: optionalNumber(session.guests) ?? 0,
      subtotal: session.subtotal as number,
      items: parseItems(session.items),
      options: parseOptions(session.options),
      flowSelections: parseFlowSelections(session.flow_prices),
    }];
  });

  return parsed;
}
