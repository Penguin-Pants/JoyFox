import {
  CONTACT_RULE_SCHEMA_VERSION,
  NUMERIC_CONDITION_KINDS,
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
    if (node.type !== "condition" || entries[node.kind]) return undefined;
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

export function fromBuilderForm(form: BuilderForm): ContactRuleDefinition {
  return {
    schemaVersion: CONTACT_RULE_SCHEMA_VERSION,
    audience: "all",
    enabled: form.enabled,
    defaultPlacement: form.defaultPlacement,
    root: {
      type: "group",
      match: "any",
      children: [
        { type: "group", match: "all", children: conditions(form.all) },
        ...conditions(form.any),
      ],
    },
  };
}
