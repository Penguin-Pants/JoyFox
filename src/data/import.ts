import { ACTIVE_ACCOUNT_SETTING_KEY } from "../accounts/account-service";
import {
  isSnapshotRetention,
  SNAPSHOT_RETENTION_KEY,
} from "../storage/snapshot-retention";
import type {
  AccountScopedEntity,
  EntityMap,
  EntityName,
  ExtensionAccount,
  MessageTemplate,
} from "../domain/types";
import { ExtensionError } from "../errors";
import { isLocale, LOCALE_KEY } from "../i18n/locale";
import { message, type Message } from "../i18n/message";
import { MAX_EVENT_TAGS, MAX_LISTING_TEXT_LENGTH } from "../events/listing";
import {
  MAX_PREFERENCE_LABEL_LENGTH,
  MAX_PREFERENCE_TAGS,
} from "../extraction/preferences";
import {
  isMessageRetention,
  MAX_MESSAGE_TEXT_LENGTH,
  MESSAGE_CACHING_KEY,
  MESSAGE_RETENTION_KEY,
} from "../messages/message-settings";
import { MAX_NOTE_LENGTH, MAX_TAG_LENGTH } from "../notes/limits";
import {
  MAX_NORMALIZED_PHRASE_LENGTH,
  normalizePhrase,
} from "../rules/message-phrase";
import { normalizeMessage } from "../spam/normalize";
import {
  MAX_TEMPLATE_BODY_LENGTH,
  MAX_TEMPLATE_FOLDER_LENGTH,
  MAX_TEMPLATE_NAME_LENGTH,
} from "../templates/template-service";
import { DATABASE_VERSION, ENTITY_NAMES } from "../storage/database";
import { migrateReasons } from "../storage/reason-migration";
import type { RecordWrite } from "../storage/repositories";
import { EVENT_REVISION_KEY } from "../storage/event-revision";
import { MESSAGE_REVISION_KEY } from "../storage/message-revision";
import { SAVED_SEARCH_REVISION_KEY } from "../storage/saved-search-revision";
import { TRIAGE_REVISION_KEY } from "../storage/triage-revision";
import { validateEntity, ValidationError } from "../storage/validation";

/**
 * Import of a JoyFox export file, merged into what is stored (owner
 * decision, 2026-09-24; ADR 0009). This module is pure: it checks a file and
 * plans the merge against a snapshot of stored data. `DataService` applies
 * the plan.
 */

/** A file larger than this is refused before it is parsed. */
export const MAX_IMPORT_BYTES = 50 * 1024 * 1024;

type AnyEntity = EntityMap[EntityName];
type Entities = { [N in EntityName]: EntityMap[N][] };

export interface ImportFile {
  scope: "all" | "account";
  schemaVersion: number;
  /** Only for a single-account export. */
  accountId?: string;
  entities: Entities;
  /** `storage.local` settings; only a full export carries them. */
  settings: Record<string, unknown>;
}

export interface StoredSnapshot {
  entities: Entities;
  settings: Record<string, unknown>;
}

export interface EntityImportCounts {
  added: number;
  replaced: number;
  kept: number;
  duplicates: number;
}

export interface ImportPlan {
  scope: ImportFile["scope"];
  accounts: { matched: number; added: number };
  counts: { [N in EntityName]: EntityImportCounts };
  settingsAdded: string[];
  /** Settings in the file that are never imported (features, diagnostics). */
  settingsSkipped: string[];
  writes: RecordWrite[];
  settings: Record<string, unknown>;
  /** Changes when the plan would change, so a stale preview is detected. */
  signature: string;
}

/**
 * Records whose ID names one fact (a tag, a not-spam correction, a member
 * entry) or that never change once written (trust outcomes, snapshots,
 * cached messages, phrase matches, the action log, templates). On an ID
 * clash the stored one is kept. Every other entity keeps the newer version
 * by `updatedAt`.
 */
const KEEP_EXISTING: ReadonlySet<EntityName> = new Set<EntityName>([
  "extensionAccounts",
  "joyClubMembers",
  "userTags",
  "senderSpamOverrides",
  "trustSignals",
  "profileSnapshots",
  "messageObservations",
  "messagePhraseMatches",
  "cachedMessages",
  "actionLogs",
  "messageTemplates",
  // A file must never redirect an existing sync endpoint.
  "syncConfigs",
]);

/**
 * The only settings taken from a file, each with the type it must have. The
 * active account is handled on its own. Diagnostics, experimental actions
 * (Quick Ignore and Delete) and change markers are never imported: a file
 * must not switch on a feature, least of all a destructive one.
 */
/** Change markers carry no data; they are dropped without mention. */
const CHANGE_MARKERS: ReadonlySet<string> = new Set([
  TRIAGE_REVISION_KEY,
  "joyfox.actionRevision",
  "joyfox.notesRevision",
  SAVED_SEARCH_REVISION_KEY,
  EVENT_REVISION_KEY,
  MESSAGE_REVISION_KEY,
]);

const IMPORTED_SETTINGS: Readonly<Record<string, (value: unknown) => boolean>> =
  {
    "joyfox.templatePicker": (value) => typeof value === "boolean",
    // The UI language. Imported only when valid and none is stored, like
    // every setting here.
    [LOCALE_KEY]: isLocale,
    // How many profile snapshots are kept per member (V1-12).
    [SNAPSHOT_RETENTION_KEY]: isSnapshotRetention,
    // Message caching (V1-4): the switch and how long messages are kept.
    [MESSAGE_CACHING_KEY]: (value) => typeof value === "boolean",
    [MESSAGE_RETENTION_KEY]: isMessageRetention,
  };

/** Every field each entity may have. Anything else refuses the file. */
const BASE_FIELDS = ["id", "accountId", "createdAt", "updatedAt"] as const;
const ENTITY_FIELDS: Readonly<Record<EntityName, readonly string[]>> = {
  extensionAccounts: ["joyClubAccountId", "label"],
  joyClubMembers: ["joyClubMemberId"],
  profileSnapshots: [
    "memberId",
    "capturedAt",
    "verification",
    "photoCount",
    "profileWordCount",
    "joinedAt",
    "joinedEarliest",
    "joinedLatest",
    "positivePreferences",
    "ownProfile",
  ],
  userNotes: ["memberId", "body"],
  userTags: ["memberId", "label"],
  trustSignals: ["memberId", "kind", "occurredAt"],
  contactRules: [
    "name",
    "schemaVersion",
    "audience",
    "enabled",
    "defaultPlacement",
    "root",
  ],
  conversationClassifications: [
    "memberId",
    "conversationId",
    "placement",
    "source",
    "decidedAt",
    "ruleId",
    "reasons",
  ],
  savedSearches: ["name", "url", "filters"],
  eventMetadata: [
    "eventId",
    "kind",
    "title",
    "startLocal",
    "path",
    "venueId",
    "venueName",
    "note",
    "tags",
    "attendance",
  ],
  spendLogEntries: ["occurredAt", "amountMinor", "currency", "category"],
  syncConfigs: ["endpoint", "lastSyncedAt", "keyDerivation"],
  extensionPreferences: ["key", "value"],
  messageTemplates: ["name", "body", "folder"],
  spamPhrases: ["phrase", "enabled"],
  messageObservations: [
    "memberId",
    "conversationId",
    "observedAt",
    "normalizedText",
  ],
  senderSpamOverrides: ["memberId", "decision", "decidedAt", "reason"],
  actionLogs: ["memberId", "conversationId", "action", "steps"],
  messagePhraseMatches: ["memberId", "phrase", "matchedAt"],
  cachedMessages: [
    "messageId",
    "conversationId",
    "memberId",
    "direction",
    "sentAt",
    "text",
  ],
};

/** Keys that could reach an object's prototype if a value were ever merged. */
const FORBIDDEN_KEYS: ReadonlySet<string> = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

function hasForbiddenKey(value: unknown, depth = 0): boolean {
  if (depth > 64) return true;
  if (Array.isArray(value))
    return value.some((item) => hasForbiddenKey(item, depth + 1));
  if (typeof value !== "object" || value === null) return false;
  return Object.keys(value).some(
    (key) =>
      FORBIDDEN_KEYS.has(key) ||
      hasForbiddenKey((value as Record<string, unknown>)[key], depth + 1),
  );
}

const STEP_FIELDS = ["name", "ok", "at", "errorCode"];
const GROUP_FIELDS = ["type", "match", "children"];
const CONDITION_FIELDS = [
  "type",
  "kind",
  "value",
  "text",
  "whenUnknown",
  "negate",
];

const extraKey = (value: Record<string, unknown>, allowed: string[]) =>
  Object.keys(value).find((key) => !allowed.includes(key));

/** The first field in a contact-rule tree that the rule schema does not have. */
function ruleNodeExtra(node: unknown, depth = 0): string | undefined {
  if (!isObject(node) || depth > 16) return undefined;
  if (node.type === "group") {
    const extra = extraKey(node, GROUP_FIELDS);
    if (extra) return extra;
    for (const child of Array.isArray(node.children) ? node.children : []) {
      const nested = ruleNodeExtra(child, depth + 1);
      if (nested) return nested;
    }
    return undefined;
  }
  return extraKey(node, CONDITION_FIELDS);
}

/**
 * What is wrong with a record: the English text for the refusal's message,
 * and what the UI shows about it.
 */
type DomainProblem =
  | { text: string; field: string; maximum?: number }
  | { text: string; field?: undefined };

/**
 * Checks ordinary saves make and the storage validation does not: closed
 * nested shapes, the size limits of notes, tags and templates, and that
 * cached message text really is in normalized form (the privacy guarantee
 * of ADR 0004, and what the spam detector compares).
 */
function domainProblem(
  name: EntityName,
  record: Record<string, unknown>,
): DomainProblem | undefined {
  const tooLong = (field: string, limit: number) =>
    typeof record[field] === "string" &&
    (record[field] as string).length > limit
      ? {
          text: `${field} is longer than ${limit} characters`,
          field,
          maximum: limit,
        }
      : undefined;
  switch (name) {
    case "actionLogs":
      for (const step of Array.isArray(record.steps) ? record.steps : []) {
        const extra = isObject(step) ? extraKey(step, STEP_FIELDS) : undefined;
        if (extra)
          return {
            text: `an action step holds an unknown field (${extra})`,
            field: extra,
          };
      }
      return undefined;
    case "contactRules": {
      const extra = ruleNodeExtra(record.root);
      return extra
        ? {
            text: `a rule condition holds an unknown field (${extra})`,
            field: extra,
          }
        : undefined;
    }
    case "profileSnapshots": {
      // The limits a capture keeps to, so an import cannot store more.
      const labels = Array.isArray(record.positivePreferences)
        ? record.positivePreferences
        : [];
      if (labels.length > MAX_PREFERENCE_TAGS)
        return { text: `more than ${MAX_PREFERENCE_TAGS} preferences` };
      return labels.some(
        (label) =>
          typeof label === "string" &&
          label.length > MAX_PREFERENCE_LABEL_LENGTH,
      )
        ? {
            text: `a preference is longer than ${MAX_PREFERENCE_LABEL_LENGTH} characters`,
            field: "positivePreferences",
            maximum: MAX_PREFERENCE_LABEL_LENGTH,
          }
        : undefined;
    }
    case "cachedMessages":
      return tooLong("text", MAX_MESSAGE_TEXT_LENGTH);
    case "userNotes":
      return tooLong("body", MAX_NOTE_LENGTH);
    case "userTags":
      return tooLong("label", MAX_TAG_LENGTH);
    case "messageTemplates":
      return (
        tooLong("name", MAX_TEMPLATE_NAME_LENGTH) ??
        tooLong("folder", MAX_TEMPLATE_FOLDER_LENGTH) ??
        tooLong("body", MAX_TEMPLATE_BODY_LENGTH)
      );
    case "messageObservations":
      return typeof record.normalizedText === "string" &&
        normalizeMessage(record.normalizedText) !== record.normalizedText
        ? { text: "normalizedText is not in normalized form" }
        : undefined;
    case "messagePhraseMatches":
      return typeof record.phrase === "string" &&
        normalizePhrase(record.phrase) !== record.phrase
        ? { text: "phrase is not in normalized form" }
        : tooLong("phrase", MAX_NORMALIZED_PHRASE_LENGTH);
    case "eventMetadata": {
      // The tracker's own limits, on the values as stored, so the editor
      // can save the record again and no padded text gets in. A save stores
      // clean values, so an exported record always passes.
      const tags = Array.isArray(record.tags) ? record.tags : [];
      if (tags.length > MAX_EVENT_TAGS)
        return { text: `more than ${MAX_EVENT_TAGS} tags` };
      if (
        tags.some(
          (tag) => typeof tag === "string" && tag.length > MAX_TAG_LENGTH,
        )
      )
        return {
          text: `a tag is longer than ${MAX_TAG_LENGTH} characters`,
          field: "tags",
          maximum: MAX_TAG_LENGTH,
        };
      return (
        tooLong("note", MAX_NOTE_LENGTH) ??
        tooLong("title", MAX_LISTING_TEXT_LENGTH) ??
        tooLong("venueName", MAX_LISTING_TEXT_LENGTH)
      );
    }
    default:
      return undefined;
  }
}

/** A record dated more than a day ahead would win every later merge. */
const FUTURE_TOLERANCE_MS = 24 * 60 * 60 * 1000;

/**
 * Every field that holds a date. Besides `updatedAt`, which decides merges,
 * these order snapshots, messages, outcomes and action steps at run time,
 * so a future date in any of them would stay "newest" for good.
 */
const DATE_FIELDS: readonly string[] = [
  "createdAt",
  "updatedAt",
  "capturedAt",
  "occurredAt",
  "decidedAt",
  "observedAt",
  "matchedAt",
  "sentAt",
  "lastSyncedAt",
  "joinedAt",
  "joinedEarliest",
  "joinedLatest",
];

function datedInFuture(record: Record<string, unknown>, now: number): boolean {
  const late = (value: unknown) =>
    typeof value === "string" && Date.parse(value) > now + FUTURE_TOLERANCE_MS;
  if (DATE_FIELDS.some((field) => late(record[field]))) return true;
  // Action-log steps carry their own time.
  return (
    Array.isArray(record.steps) &&
    record.steps.some((step: unknown) => isObject(step) && late(step.at))
  );
}

/**
 * A refusal: the English text for logs, and the message the UI shows. The
 * panel adds "Nothing was imported." to either.
 */
function refuse(text: string, display: Message): ExtensionError {
  return new ExtensionError("ExtractionInvalid", text, { display });
}

/** The inspector's name of a data type, for a refusal the UI shows. */
const entityLabel = (name: EntityName): Message => message(`entity.${name}`);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const emptyEntities = (): Entities =>
  Object.fromEntries(
    ENTITY_NAMES.map((name) => [name, []]),
  ) as unknown as Entities;

/**
 * Parse and check a whole file before anything is planned. Any problem
 * refuses the whole file, so an import never stores part of a bad file.
 */
export function parseImportFile(
  text: string,
  now: number = Date.now(),
): ImportFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw refuse(
      "The file is not a JoyFox export (not valid JSON)",
      message("error.import.notJson"),
    );
  }
  if (!isObject(data) || !isObject(data.entities))
    throw refuse(
      "The file is not a JoyFox export",
      message("error.import.notExport"),
    );
  const version = data.schemaVersion;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1)
    throw refuse(
      "The file has no valid schema version",
      message("error.import.noVersion"),
    );
  if (version > DATABASE_VERSION)
    throw refuse(
      "The file comes from a newer JoyFox version. Update JoyFox first",
      message("error.import.newerVersion"),
    );
  const scope = data.scope;
  if (scope !== "all" && scope !== "account")
    throw refuse(
      "The file has no valid export scope",
      message("error.import.noScope"),
    );
  const rawAccountId = scope === "account" ? data.accountId : undefined;
  if (
    scope === "account" &&
    (typeof rawAccountId !== "string" || rawAccountId.length === 0)
  )
    throw refuse(
      "The account export names no account",
      message("error.import.noAccountNamed"),
    );
  const accountId = rawAccountId as string | undefined;

  const entities = emptyEntities();
  for (const [name, records] of Object.entries(data.entities)) {
    if (!(ENTITY_NAMES as readonly string[]).includes(name))
      throw refuse(
        `The file holds an unknown data type (${name})`,
        message("error.import.unknownType", { name }),
      );
    const entity = entityLabel(name as EntityName);
    if (!Array.isArray(records))
      throw refuse(
        `The file's ${name} list is not a list`,
        message("error.import.notList", { entity }),
      );
    const seen = new Set<string>();
    records.forEach((raw: unknown, position) => {
      const index = position + 1;
      const at = { index, entity };
      if (!isObject(raw))
        throw refuse(
          `Record ${index} of ${name} is not a record`,
          message("error.import.notRecord", at),
        );
      if (hasForbiddenKey(raw))
        throw refuse(
          `Record ${index} of ${name} holds a forbidden key`,
          message("error.import.forbiddenKey", at),
        );
      const record = { ...raw };
      delete record.storageKey;
      const allowed = [...BASE_FIELDS, ...ENTITY_FIELDS[name as EntityName]];
      const extra = Object.keys(record).find((key) => !allowed.includes(key));
      if (extra)
        throw refuse(
          `Record ${index} of ${name} holds an unknown field (${extra})`,
          message("error.import.unknownField", { ...at, field: extra }),
        );
      // Files from schema versions 1 to 3 hold English reason text. It is
      // converted as the database upgrade converts it, then validated.
      if (name === "conversationClassifications" && version < 4)
        record.reasons = migrateReasons(record.reasons, record.placement);
      const problem = domainProblem(name as EntityName, record);
      if (problem)
        throw refuse(
          `Record ${index} of ${name} is invalid: ${problem.text}`,
          problem.field === undefined
            ? message("error.import.invalid", at)
            : problem.maximum === undefined
              ? message("error.import.unknownField", {
                  ...at,
                  field: problem.field,
                })
              : message("error.import.tooLong", {
                  ...at,
                  field: problem.field,
                  maximum: problem.maximum,
                }),
        );
      if (datedInFuture(record, now))
        throw refuse(
          `Record ${index} of ${name} is dated in the future`,
          message("error.import.future", at),
        );
      try {
        validateEntity(
          name as EntityName,
          record as unknown as AccountScopedEntity,
        );
      } catch (error) {
        const reason =
          error instanceof ValidationError ? error.message : "it is invalid";
        throw refuse(
          `Record ${index} of ${name} is invalid: ${reason}`,
          message("error.import.invalid", at),
        );
      }
      const stored = record as unknown as AnyEntity;
      if (scope === "account" && stored.accountId !== accountId)
        throw refuse(
          `Record ${index} of ${name} belongs to another account`,
          message("error.import.otherAccount", at),
        );
      if (name === "extensionAccounts" && stored.id !== stored.accountId)
        throw refuse(
          `Account record ${index} is not its own scope`,
          message("error.import.notOwnScope", { index }),
        );
      const key = `${stored.accountId}\u0000${stored.id}`;
      if (seen.has(key))
        throw refuse(
          `Record ${index} of ${name} appears twice`,
          message("error.import.twice", at),
        );
      seen.add(key);
      (entities[name as EntityName] as AnyEntity[]).push(stored);
    });
  }

  const identifiers = new Set<string>();
  for (const account of entities.extensionAccounts) {
    if (identifiers.has(account.joyClubAccountId))
      throw refuse(
        "Two accounts in the file have the same identifier",
        message("error.import.sameIdentifier"),
      );
    identifiers.add(account.joyClubAccountId);
  }
  if (
    scope === "account" &&
    !entities.extensionAccounts.some((account) => account.id === accountId)
  )
    throw refuse(
      "The account export holds no account record",
      message("error.import.noAccountRecord"),
    );

  const settings: Record<string, unknown> = {};
  if (scope === "all" && data.settings !== undefined) {
    if (!isObject(data.settings))
      throw refuse(
        "The file's settings are invalid",
        message("error.import.settingsInvalid"),
      );
    if (hasForbiddenKey(data.settings))
      throw refuse(
        "The file's settings hold a forbidden key",
        message("error.import.settingsForbidden"),
      );
    for (const [key, value] of Object.entries(data.settings)) {
      if (!key.startsWith("joyfox."))
        throw refuse(
          `The file holds a setting JoyFox does not use (${key})`,
          message("error.import.unknownSetting", { key }),
        );
      settings[key] = value;
    }
  }
  return {
    scope,
    schemaVersion: version,
    ...(accountId ? { accountId } : {}),
    entities,
    settings,
  };
}

const templateKey = (template: MessageTemplate) =>
  JSON.stringify([template.name, template.folder ?? "", template.body]);

/**
 * Plan the merge. Pure: the same file and snapshot give the same plan, and
 * `newId` is called only for an imported account whose ID is taken by a
 * different stored account.
 */
export function planImport(
  file: ImportFile,
  stored: StoredSnapshot,
  newId: () => string = () => crypto.randomUUID(),
): ImportPlan {
  const counts = Object.fromEntries(
    ENTITY_NAMES.map((name) => [
      name,
      { added: 0, replaced: 0, kept: 0, duplicates: 0 },
    ]),
  ) as ImportPlan["counts"];
  const writes: RecordWrite[] = [];
  /**
   * What each write came from in the file. The signature uses these, not the
   * written IDs, because a moved account gets a new random ID on each plan.
   */
  const sources: string[] = [];

  // Accounts: one with the same JoyClub identifier is the same account.
  const storedAccounts = stored.entities.extensionAccounts;
  const scopeMap = new Map<string, string>();
  const accounts = { matched: 0, added: 0 };
  for (const account of file.entities.extensionAccounts) {
    const same = storedAccounts.find(
      (existing) => existing.joyClubAccountId === account.joyClubAccountId,
    );
    if (same) {
      scopeMap.set(account.id, same.id);
      accounts.matched += 1;
      counts.extensionAccounts.kept += 1;
      continue;
    }
    const taken = storedAccounts.some((existing) => existing.id === account.id);
    const id = taken ? newId() : account.id;
    scopeMap.set(account.id, id);
    accounts.added += 1;
    counts.extensionAccounts.added += 1;
    const added: ExtensionAccount = { ...account, id, accountId: id };
    writes.push({ name: "extensionAccounts", entity: added });
    sources.push(`extensionAccounts:${account.id}`);
  }
  // A scope that is not an account in the file (the wake counter) keeps its
  // name. It must not name a stored account or an account this import writes
  // to: its records would then land in an account the file does not hold.
  const accountTargets = new Set([
    ...storedAccounts.map((account) => account.id),
    ...scopeMap.values(),
  ]);
  const target = (scope: string) => {
    const mapped = scopeMap.get(scope);
    if (mapped) return mapped;
    if (accountTargets.has(scope))
      throw refuse(
        "Some records in the file belong to an account the file does not hold",
        message("error.import.orphans"),
      );
    return scope;
  };
  const written = new Set<string>();

  /** One write per stored key, however the file's scopes map. */
  const record = (name: EntityName, entity: AnyEntity) => {
    const key = `${name}\u0000${entity.accountId}\u0000${entity.id}`;
    if (written.has(key))
      throw refuse(
        "The file holds the same record twice after merging accounts",
        message("error.import.sameRecordTwice"),
      );
    written.add(key);
    writes.push({ name, entity } as RecordWrite);
  };

  for (const name of ENTITY_NAMES) {
    if (name === "extensionAccounts") continue;
    const existing = new Map<string, AnyEntity>();
    for (const record of stored.entities[name] as AnyEntity[])
      existing.set(`${record.accountId}\u0000${record.id}`, record);
    const templates = new Set<string>();
    if (name === "messageTemplates")
      for (const record of stored.entities.messageTemplates)
        templates.add(`${record.accountId}\u0000${templateKey(record)}`);

    for (const source of file.entities[name] as AnyEntity[]) {
      const entity = { ...source, accountId: target(source.accountId) };
      const current = existing.get(`${entity.accountId}\u0000${entity.id}`);
      if (!current) {
        if (name === "messageTemplates") {
          const key = `${entity.accountId}\u0000${templateKey(entity as MessageTemplate)}`;
          if (templates.has(key)) {
            counts[name].duplicates += 1;
            continue;
          }
          templates.add(key);
        }
        counts[name].added += 1;
        record(name, entity);
        sources.push(`${name}:${source.accountId}:${source.id}`);
        continue;
      }
      if (
        !KEEP_EXISTING.has(name) &&
        Date.parse(entity.updatedAt) > Date.parse(current.updatedAt)
      ) {
        counts[name].replaced += 1;
        record(name, entity);
        sources.push(`${name}:${source.accountId}:${source.id}`);
      } else counts[name].kept += 1;
    }
  }

  // Settings: only allowlisted keys, with the right type, not stored yet.
  // The active account is taken from the file (mapped), or else the first
  // imported account, only if none is set.
  const settings: Record<string, unknown> = {};
  const settingsSkipped: string[] = [];
  for (const [key, value] of Object.entries(file.settings)) {
    if (key === ACTIVE_ACCOUNT_SETTING_KEY) continue;
    const valid = IMPORTED_SETTINGS[key];
    if (!valid?.(value)) {
      if (!CHANGE_MARKERS.has(key)) settingsSkipped.push(key);
      continue;
    }
    if (!(key in stored.settings)) settings[key] = value;
  }
  const storedActive = stored.settings[ACTIVE_ACCOUNT_SETTING_KEY];
  const activeExists =
    typeof storedActive === "string" &&
    storedAccounts.some((account) => account.id === storedActive);
  /** The file's account the active pointer comes from, for the signature. */
  let activeSource: string | undefined;
  if (!activeExists) {
    const fileActive = file.settings[ACTIVE_ACCOUNT_SETTING_KEY];
    activeSource =
      typeof fileActive === "string" && scopeMap.has(fileActive)
        ? fileActive
        : file.entities.extensionAccounts[0]?.id;
    const candidate = activeSource && scopeMap.get(activeSource);
    if (candidate) settings[ACTIVE_ACCOUNT_SETTING_KEY] = candidate;
  }

  const settingsAdded = Object.keys(settings).sort();
  return {
    scope: file.scope,
    accounts,
    counts,
    settingsAdded,
    settingsSkipped: settingsSkipped.sort(),
    writes,
    settings,
    // Signed by what the settings come from, not a moved account's new
    // random ID, so the preview and the apply agree.
    signature: JSON.stringify([
      accounts,
      counts,
      {
        ...settings,
        ...(activeSource ? { [ACTIVE_ACCOUNT_SETTING_KEY]: activeSource } : {}),
      },
      sources,
    ]),
  };
}
