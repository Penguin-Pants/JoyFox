import type { ContactRule } from "../domain/types";
import { ExtensionError } from "../errors";
import type { SettingsArea } from "../storage/local-settings";
import { runtimeSettingsArea } from "../storage/local-settings";
import { ContactRuleRepository } from "../storage/repositories";
import { bumpTriageRevision } from "../storage/triage-revision";
import {
  contactRuleProblem,
  type ConditionGroup,
  type ContactRuleDefinition,
  type RuleNode,
} from "./contact-rule";

/** The MVP keeps exactly one rule per account (build plan Section 11). */
export const GLOBAL_RULE_ID = "rule:global";
export const GLOBAL_RULE_NAME = "Global contact rule";

function requireAccountId(accountId: string): void {
  if (accountId.trim().length === 0)
    throw new ExtensionError(
      "IdentityMismatch",
      "A contact rule needs an explicit active account",
    );
}

export class RuleService {
  constructor(
    private readonly rules = new ContactRuleRepository(),
    private readonly settings: SettingsArea = runtimeSettingsArea,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async getGlobalRule(accountId: string): Promise<ContactRule | undefined> {
    requireAccountId(accountId);
    return this.rules.get(accountId, GLOBAL_RULE_ID);
  }

  async saveGlobalRule(
    accountId: string,
    definition: ContactRuleDefinition,
  ): Promise<ContactRule> {
    requireAccountId(accountId);
    const problem = contactRuleProblem(definition);
    if (problem) throw new ExtensionError("RuleEvaluationError", problem);
    const existing = await this.rules.get(accountId, GLOBAL_RULE_ID);
    const timestamp = this.now();
    // Copy only the definition's own fields, so nothing else rides along.
    const rule: ContactRule = {
      id: GLOBAL_RULE_ID,
      accountId,
      name: GLOBAL_RULE_NAME,
      schemaVersion: definition.schemaVersion,
      audience: definition.audience,
      enabled: definition.enabled,
      defaultPlacement: definition.defaultPlacement,
      root: copyGroup(definition.root),
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    await this.rules.put(accountId, rule);
    await bumpTriageRevision(this.settings);
    return rule;
  }

  async deleteGlobalRule(accountId: string): Promise<void> {
    requireAccountId(accountId);
    await this.rules.delete(accountId, GLOBAL_RULE_ID);
    await bumpTriageRevision(this.settings);
  }
}

/** Copy only the fields each node defines, so nothing else is stored. */
function copyNode(node: RuleNode): RuleNode {
  if (node.type === "group") return copyGroup(node);
  return {
    type: "condition",
    kind: node.kind,
    ...(node.value !== undefined ? { value: node.value } : {}),
    ...(node.text !== undefined ? { text: node.text } : {}),
    whenUnknown: node.whenUnknown,
    ...(node.negate ? { negate: true } : {}),
  };
}

function copyGroup(group: ConditionGroup): ConditionGroup {
  return {
    type: "group",
    match: group.match,
    children: group.children.map(copyNode),
  };
}
