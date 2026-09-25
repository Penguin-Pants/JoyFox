import {
  CONDITION_KINDS,
  NUMERIC_CONDITION_KINDS,
  schemaVersionFor,
  type ConditionGroup,
  type ConditionKind,
  type ContactRuleDefinition,
  type FailPlacement,
  type RuleCondition,
  type RuleNode,
  type UnknownHandling,
} from "./contact-rule";

/**
 * The shape the MVP rule builder edits: PRD Section 11.5's two boxes. The
 * "All" box lists what a sender must meet; the "Any" box lists exceptions,
 * each of which qualifies a sender on its own. At most one condition of each
 * kind per box.
 */
export interface BoxEntry {
  value?: number;
  whenUnknown: UnknownHandling;
}

export interface BuilderForm {
  enabled: boolean;
  defaultPlacement: FailPlacement;
  all: Partial<Record<ConditionKind, BoxEntry>>;
  any: Partial<Record<ConditionKind, BoxEntry>>;
}

function box(
  nodes: readonly RuleNode[],
): Partial<Record<ConditionKind, BoxEntry>> | undefined {
  const entries: Partial<Record<ConditionKind, BoxEntry>> = {};
  for (const node of nodes) {
    if (node.type !== "condition" || entries[node.kind] || node.negate)
      return undefined;
    entries[node.kind] = {
      ...(node.value !== undefined ? { value: node.value } : {}),
      whenUnknown: node.whenUnknown,
    };
  }
  return entries;
}

/**
 * Read a stored rule into the two-box form, or `undefined` when the rule has
 * a shape the MVP builder cannot show (for example a rule written by a later
 * version with nested groups). The builder then must not overwrite it.
 */
export function toBuilderForm(
  rule: ContactRuleDefinition,
): BuilderForm | undefined {
  if (rule.audience !== "all") return undefined;
  const base = {
    enabled: rule.enabled,
    defaultPlacement: rule.defaultPlacement,
  };
  const { root } = rule;
  if (root.match === "all") {
    const all = box(root.children);
    return all ? { ...base, all, any: {} } : undefined;
  }
  const [first, ...rest] = root.children;
  if (!first || first.type !== "group" || first.match !== "all")
    return undefined;
  const all = box(first.children);
  const any = box(rest);
  return all && any ? { ...base, all, any } : undefined;
}

function conditions(
  entries: Partial<Record<ConditionKind, BoxEntry>>,
): RuleCondition[] {
  return (Object.entries(entries) as Array<[ConditionKind, BoxEntry]>).map(
    ([kind, entry]) => ({
      type: "condition",
      kind,
      ...(NUMERIC_CONDITION_KINDS.has(kind) ? { value: entry.value ?? 0 } : {}),
      whenUnknown: entry.whenUnknown,
    }),
  );
}

function definition(
  form: { enabled: boolean; defaultPlacement: FailPlacement },
  root: ConditionGroup,
): ContactRuleDefinition {
  return {
    schemaVersion: schemaVersionFor(root),
    audience: "all",
    enabled: form.enabled,
    defaultPlacement: form.defaultPlacement,
    root,
  };
}

export function fromBuilderForm(form: BuilderForm): ContactRuleDefinition {
  return definition(form, {
    type: "group",
    match: "any",
    children: [
      { type: "group", match: "all", children: conditions(form.all) },
      ...conditions(form.any),
    ],
  });
}

/**
 * The advanced editor's shape (ADR 0012): "A sender is qualified if ANY/ALL
 * of these rules match", and each rule is met if ALL/ANY of its conditions
 * are met. A condition can be turned around with "not". At most one
 * condition of each kind per rule.
 */
export interface AdvancedEntry extends BoxEntry {
  negate?: boolean;
}

export interface AdvancedRule {
  match: "all" | "any";
  conditions: Partial<Record<ConditionKind, AdvancedEntry>>;
}

export interface AdvancedForm {
  enabled: boolean;
  defaultPlacement: FailPlacement;
  match: "all" | "any";
  rules: AdvancedRule[];
}

/** The most rules the advanced editor offers to add. */
export const MAX_ADVANCED_RULES = 10;

function advancedEntry(node: RuleCondition): AdvancedEntry {
  return {
    ...(node.value !== undefined ? { value: node.value } : {}),
    whenUnknown: node.whenUnknown,
    ...(node.negate ? { negate: true } : {}),
  };
}

/**
 * Read a stored rule into the advanced form, or `undefined` when it is
 * nested deeper than rules of conditions. A condition directly in the root
 * becomes a rule of its own.
 */
export function toAdvancedForm(
  rule: ContactRuleDefinition,
): AdvancedForm | undefined {
  if (rule.audience !== "all") return undefined;
  const rules: AdvancedRule[] = [];
  for (const child of rule.root.children) {
    if (child.type === "condition") {
      rules.push({
        match: "all",
        conditions: { [child.kind]: advancedEntry(child) },
      });
      continue;
    }
    const conditions: AdvancedRule["conditions"] = {};
    for (const node of child.children) {
      if (node.type !== "condition" || conditions[node.kind]) return undefined;
      conditions[node.kind] = advancedEntry(node);
    }
    rules.push({ match: child.match, conditions });
  }
  return {
    enabled: rule.enabled,
    defaultPlacement: rule.defaultPlacement,
    match: rule.root.match,
    rules,
  };
}

function advancedConditions(rule: AdvancedRule): RuleCondition[] {
  return CONDITION_KINDS.flatMap((kind): RuleCondition[] => {
    const entry = rule.conditions[kind];
    if (!entry) return [];
    return [
      {
        type: "condition",
        kind,
        ...(NUMERIC_CONDITION_KINDS.has(kind)
          ? { value: entry.value ?? 0 }
          : {}),
        whenUnknown: entry.whenUnknown,
        ...(entry.negate ? { negate: true } : {}),
      },
    ];
  });
}

/**
 * Store the advanced form. A rule without conditions is left out: stored,
 * it would be met by everyone.
 */
export function fromAdvancedForm(form: AdvancedForm): ContactRuleDefinition {
  return definition(form, {
    type: "group",
    match: form.match,
    children: form.rules
      .map((rule) => ({
        type: "group" as const,
        match: rule.match,
        children: advancedConditions(rule),
      }))
      .filter((group) => group.children.length > 0),
  });
}

/** The two-box form a stored rule shows in the advanced editor. */
export function builderToAdvanced(form: BuilderForm): AdvancedForm {
  const advanced = toAdvancedForm(fromBuilderForm(form));
  if (!advanced) throw new Error("A two-box rule always fits");
  // An empty ALL box stays as an empty rule only while it is edited.
  return {
    ...advanced,
    rules: advanced.rules.filter(
      (rule) => Object.keys(rule.conditions).length > 0,
    ),
  };
}

/**
 * The advanced form as the two boxes, or why it cannot be shown there. The
 * boxes mean "ALL of the first box, or ANY of the second", so they fit when
 * the rules combine with ANY, nothing uses "not", and at most one rule needs
 * ALL of several conditions. Rules with one condition, and rules met by ANY
 * condition, become entries in the ANY box. Both forms mean the same thing.
 */
export function advancedToBuilder(form: AdvancedForm): BuilderForm | string {
  const rules = form.rules.filter(
    (rule) => Object.keys(rule.conditions).length > 0,
  );
  if (rules.length > 1 && form.match === "all")
    return "Simple view is not available: the rules combine with ALL.";
  if (
    rules.some((rule) =>
      Object.values(rule.conditions).some((entry) => entry?.negate),
    )
  )
    return 'Simple view is not available: the rule uses "not".';
  const several = (rule: AdvancedRule) =>
    Object.keys(rule.conditions).length > 1;
  const allRules = rules.filter(
    (rule) => rule.match === "all" && several(rule),
  );
  if (allRules.length > 1)
    return "Simple view is not available: more than one rule needs ALL of several conditions.";
  const plain = (entry: AdvancedEntry): BoxEntry => ({
    ...(entry.value !== undefined ? { value: entry.value } : {}),
    whenUnknown: entry.whenUnknown,
  });
  const boxOf = (list: AdvancedRule[]) => {
    const entries: Partial<Record<ConditionKind, BoxEntry>> = {};
    for (const rule of list)
      for (const kind of CONDITION_KINDS) {
        const entry = rule.conditions[kind];
        if (!entry) continue;
        if (entries[kind]) return undefined;
        entries[kind] = plain(entry);
      }
    return entries;
  };
  // With one rule and ALL at the top, the rule itself is the ALL box.
  const [allRule] =
    rules.length === 1 && rules[0]?.match === "all" ? rules : allRules;
  const others = rules.filter((rule) => rule !== allRule);
  // An empty ALL box is met by everyone. Without an ALL rule, every rule is
  // "A or B", so the first condition moves to the ALL box: "A, or B, or C"
  // means the same either way.
  const conditions = others.flatMap((rule) =>
    CONDITION_KINDS.flatMap((kind) => {
      const entry = rule.conditions[kind];
      return entry ? [{ kind, entry }] : [];
    }),
  );
  const first = allRule ? undefined : conditions.shift();
  const all = allRule
    ? boxOf([allRule])
    : first
      ? { [first.kind]: plain(first.entry) }
      : {};
  const any = boxOf(
    conditions.map(({ kind, entry }) => ({
      match: "any" as const,
      conditions: { [kind]: entry },
    })),
  );
  if (!all || !any)
    return "Simple view is not available: a condition appears in more than one rule.";
  return {
    enabled: form.enabled,
    defaultPlacement: form.defaultPlacement,
    all,
    any,
  };
}
