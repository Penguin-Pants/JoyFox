import {
  en,
  type ArgsOf,
  type MessageKey,
  type ParamKey,
  type Translated,
} from "./catalog/en";

/**
 * A serializable reference to catalog text. Reasons cross the
 * background-to-content message port and are stored in IndexedDB, so they
 * are plain JSON: a key, and for a key whose text takes values, its params.
 * The text is looked up only when shown (`t()` in `translator.ts`), so the
 * background never produces display text.
 */

/** On the wire, each Translated param is a nested Message. */
export type WireParams<A> = {
  [P in keyof A]: A[P] extends Translated ? Message : A[P];
};

/** One variant per key, so the key decides the required params. */
export type Message = {
  [K in MessageKey]: ArgsOf<K> extends undefined
    ? { key: K }
    : { key: K; params: WireParams<ArgsOf<K>> };
}[MessageKey];

export type ParamKind = "string" | "number" | "message";

type KindOf<V> = V extends Translated
  ? "message"
  : V extends number
    ? "number"
    : "string";

/**
 * The runtime spec for stored and imported records, which are not typed at
 * runtime: each key's param names and kinds. Typed against the catalog, so a
 * missing, extra or wrongly kinded param fails `npm run typecheck`. A key not
 * listed here is a plain string and takes no params.
 */
export const MESSAGE_PARAMS: {
  [K in ParamKey]: { [P in keyof ArgsOf<K>]-?: KindOf<ArgsOf<K>[P]> };
} = {
  "legacy.text": { text: "string" },
  "triage.reason.unknownValue": { field: "message" },
  "triage.reason.atOrAbove": {
    field: "message",
    value: "number",
    minimum: "number",
  },
  "triage.reason.belowMinimum": {
    field: "message",
    value: "number",
    minimum: "number",
  },
  "triage.reason.accountAgeRangeAbove": {
    min: "number",
    max: "number",
    minimum: "number",
  },
  "triage.reason.accountAgeRangeBelow": {
    min: "number",
    max: "number",
    minimum: "number",
  },
  "triage.reason.accountAgeRangeCoarse": {
    min: "number",
    max: "number",
    minimum: "number",
  },
  "triage.reason.phraseSeenNow": { text: "string" },
  "triage.reason.phraseSeenBefore": { text: "string" },
  "triage.reason.phraseNotInLatest": { text: "string" },
  "triage.reason.phraseNotSeen": { text: "string" },
  "triage.reason.trustAtOrAbove": { score: "number", minimum: "number" },
  "triage.reason.trustBelow": { score: "number", minimum: "number" },
  "triage.reason.negatedMet": { reason: "message", condition: "message" },
  "triage.reason.negatedNotMet": { reason: "message", condition: "message" },
  "triage.reason.unknownNeedsReview": { reason: "message" },
  "triage.reason.unknownMet": { reason: "message" },
  "triage.reason.unknownNotMet": { reason: "message" },
  "triage.reason.numbered": { number: "number", reason: "message" },
  "triage.reason.userMoved": { placement: "message" },
  "triage.headline.doesNotMeet": { placement: "message" },
  "trust.reason.positive": { count: "number" },
  "trust.reason.negative": { count: "number" },
  "trust.reason.neutral": { count: "number" },
  "spam.detail.belowMinimum": { words: "number", minimum: "number" },
  "spam.detail.duplicate": { percent: "number" },
  "spam.detail.phraseSimilar": { percent: "number" },
  "action.where.before": { step: "message" },
  "action.where.during": { step: "message" },
  "action.failure.control-missing": { step: "message" },
  "action.failure.confirmation-missing": { step: "message" },
  "action.failure.not-verified": { step: "message" },
  "action.failure.unverifiable": { step: "message", where: "message" },
  "action.failure.member-mismatch": { where: "message" },
  "action.failure.conversation-mismatch": { where: "message" },
  "action.failure.identity-unavailable": { where: "message" },
  "action.failure.account-changed": { where: "message" },
  "action.failure.turned-off": { where: "message" },
  "action.failure.superseded": { where: "message" },
  "action.failure.log-unavailable": { where: "message" },
  "action.failure.handoff-failed": { where: "message" },
  "action.failure.timeout": { step: "message" },
  "action.failure.step-error": { where: "message" },
  "triage.conditions.summary": { count: "number" },
  "triage.condition.line": { outcome: "message", condition: "message" },
  "triage.condition.lineNegated": { outcome: "message", condition: "message" },
  "triage.placementLine": { placement: "message", source: "message" },
  "triage.movedOn": { date: "string", placement: "message" },
  "triage.move.to": { placement: "message" },
  "triage.unknownFacts.one": { fact: "message" },
  "triage.unknownFacts.two": { first: "message", second: "message" },
  "triage.unknownFacts.three": {
    first: "message",
    second: "message",
    third: "message",
  },
  "trust.score.value": { score: "number" },
  "trust.contribution": { points: "number", reason: "message" },
  "inbox.viewCount": { view: "message", count: "number" },
  "inbox.badge": { text: "message" },
  "inbox.whyNamed": { name: "string" },
  "notes.removeTag": { label: "string" },
  "notes.summary.tags": { count: "number" },
  "notes.summary.noteAndTags": { count: "number" },
  "accounts.useLabel": { name: "string" },
  "accounts.nowActive": { name: "string" },
  "accounts.removeLabel": { name: "string" },
  "accounts.confirmRemoveLabel": { name: "string" },
  "accounts.removePrompt": { name: "string" },
  "accounts.removed": { name: "string" },
  "accounts.added": { name: "string" },
  "rule.unknownLabel": { condition: "message" },
  "rule.valueLabel": { condition: "message" },
  "rule.textLabel": { condition: "message" },
  "rule.textProblem": { maximum: "number", condition: "message" },
  "rule.numberProblem": {
    minimum: "number",
    maximum: "number",
    condition: "message",
  },
  "rule.removeConditionLabel": { condition: "message" },
  "rule.notLabel": { condition: "message" },
  "rule.ruleTitle": { number: "number" },
  "rule.ruleMatchLabel": { number: "number" },
  "rule.removeRuleLabel": { number: "number" },
  "rule.addConditionLabel": { number: "number" },
  "rule.ruleCount": { count: "number", maximum: "number" },
  "rule.notSaved": { problem: "message" },
  "templates.inFolder": { folder: "string" },
  "templates.editLabel": { name: "string" },
  "templates.editing": { name: "string" },
  "templates.deleteLabel": { name: "string" },
  "templates.confirmDeleteLabel": { name: "string" },
  "templates.deletePrompt": { name: "string" },
  "templates.deleted": { name: "string" },
  "templates.saved": { name: "string" },
  "templates.added": { name: "string" },
  "data.showLabel": { label: "message" },
  "data.hideLabel": { label: "message" },
  "data.deleteAllLabel": { label: "message" },
  "data.deleteAllPrompt": { count: "number", label: "message" },
  "data.deletedAll": { label: "message" },
  "data.recordsTitle": { label: "message", count: "number" },
  "data.recordSummary": { id: "string", updated: "string" },
  "data.deleteRecordLabel": { id: "string" },
  "data.deleteRecordPrompt": { id: "string" },
  "data.deletedRecord": { id: "string" },
  "data.showMore": { count: "number" },
  "data.moreValues": { count: "number" },
  "data.moreCharacters": { count: "number" },
  "data.confirmLabel": { label: "message" },
  "data.import.summary.all": {
    matched: "number",
    added: "number",
    total: "number",
  },
  "data.import.summary.account": {
    matched: "number",
    added: "number",
    total: "number",
  },
  "data.import.settingsSkipped": { keys: "string" },
  "data.import.settingsNotSaved": { keys: "string" },
  "data.import.settingsAdded": { keys: "string" },
  "data.import.complete": { added: "number", replaced: "number" },
  "data.import.completeSettingsFailed": { added: "number", replaced: "number" },
  "error.withSuffix.nothingChanged": { error: "message" },
  "error.withSuffix.nothingImported": { error: "message" },
  "error.withSuffix.nothingDeleted": { error: "message" },
  "error.template.nameTooLong": { maximum: "number" },
  "error.template.folderTooLong": { maximum: "number" },
  "error.template.tooLong": { maximum: "number" },
  "error.import.unknownType": { name: "string" },
  "error.import.notList": { entity: "message" },
  "error.import.notRecord": { index: "number", entity: "message" },
  "error.import.forbiddenKey": { index: "number", entity: "message" },
  "error.import.unknownField": {
    index: "number",
    entity: "message",
    field: "string",
  },
  "error.import.tooLong": {
    index: "number",
    entity: "message",
    field: "string",
    maximum: "number",
  },
  "error.import.invalid": { index: "number", entity: "message" },
  "error.import.future": { index: "number", entity: "message" },
  "error.import.otherAccount": { index: "number", entity: "message" },
  "error.import.notOwnScope": { index: "number" },
  "error.import.twice": { index: "number", entity: "message" },
  "error.import.unknownSetting": { key: "string" },
};

/** Whether a string names a catalog key. */
export function isMessageKey(value: unknown): value is MessageKey {
  return typeof value === "string" && Object.hasOwn(en, value);
}

/** The param spec of a key, or `null` for a plain string. */
export function paramsOf(
  key: MessageKey,
): Readonly<Record<string, ParamKind>> | null {
  return Object.hasOwn(MESSAGE_PARAMS, key)
    ? (MESSAGE_PARAMS as Record<string, Record<string, ParamKind>>)[key]!
    : null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Deep enough for every nested message the catalog builds. */
const MAX_DEPTH = 8;

/**
 * Whether a value is a valid `Message`: a known key, exactly the listed
 * param names, each of the listed kind, and nested messages checked the same
 * way. Stored and imported records are checked with it.
 */
export function isMessage(value: unknown, depth = 0): value is Message {
  if (depth > MAX_DEPTH || !isRecord(value)) return false;
  if (!isMessageKey(value.key)) return false;
  const spec = paramsOf(value.key);
  if (spec === null) return Object.keys(value).every((name) => name === "key");
  if (!Object.keys(value).every((name) => name === "key" || name === "params"))
    return false;
  const params = value.params;
  if (!isRecord(params)) return false;
  const names = Object.keys(spec);
  if (Object.keys(params).length !== names.length) return false;
  return names.every((name) => {
    if (!Object.hasOwn(params, name)) return false;
    const param = params[name];
    switch (spec[name]) {
      case "string":
        return typeof param === "string";
      case "number":
        return typeof param === "number" && Number.isFinite(param);
      case "message":
        return isMessage(param, depth + 1);
      default:
        return false;
    }
  });
}

/**
 * Build a message with the params its key requires. The same as writing the
 * object literal, but shorter at call sites.
 */
export function message<K extends MessageKey>(
  key: K,
  ...params: ArgsOf<K> extends undefined ? [] : [WireParams<ArgsOf<K>>]
): Message {
  return (params.length > 0 ? { key, params: params[0] } : { key }) as Message;
}
