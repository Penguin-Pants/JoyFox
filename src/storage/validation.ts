import type { AccountScopedEntity, EntityName } from "../domain/types";

export class ValidationError extends Error {}

function requireString(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (typeof value !== "string" || value.length === 0)
    throw new ValidationError(`${field} must be a non-empty string`);
  return value;
}

function requireNumber(record: Record<string, unknown>, field: string): number {
  const value = record[field];
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new ValidationError(`${field} must be a finite number`);
  return value;
}

function requireBoolean(
  record: Record<string, unknown>,
  field: string,
): boolean {
  const value = record[field];
  if (typeof value !== "boolean")
    throw new ValidationError(`${field} must be a boolean`);
  return value;
}

function requireArray(
  record: Record<string, unknown>,
  field: string,
): unknown[] {
  const value = record[field];
  if (!Array.isArray(value))
    throw new ValidationError(`${field} must be an array`);
  return value;
}

function requireDate(record: Record<string, unknown>, field: string): void {
  const value = requireString(record, field);
  if (!Number.isFinite(Date.parse(value)))
    throw new ValidationError(`${field} must be an ISO-compatible date`);
}

function requireEnum(
  record: Record<string, unknown>,
  field: string,
  values: readonly string[],
): void {
  if (!values.includes(requireString(record, field)))
    throw new ValidationError(`${field} has an unsupported value`);
}

function requireStringArray(
  record: Record<string, unknown>,
  field: string,
): void {
  if (!requireArray(record, field).every((value) => typeof value === "string"))
    throw new ValidationError(`${field} must contain only strings`);
}

function optionalString(record: Record<string, unknown>, field: string): void {
  if (record[field] !== undefined) requireString(record, field);
}

function allowOnly(
  record: Record<string, unknown>,
  fields: readonly string[],
  entityName: string,
): void {
  const unexpected = Object.keys(record).find(
    (field) => !fields.includes(field),
  );
  if (unexpected)
    throw new ValidationError(
      `${entityName} contains unsupported field ${unexpected}`,
    );
}

function validateActionSteps(record: Record<string, unknown>): void {
  for (const value of requireArray(record, "steps")) {
    if (!value || typeof value !== "object")
      throw new ValidationError("steps must contain objects");
    const step = value as Record<string, unknown>;
    requireString(step, "name");
    requireBoolean(step, "ok");
    requireDate(step, "at");
    optionalString(step, "errorCode");
  }
}

function validateProfileSnapshot(record: Record<string, unknown>): void {
  requireString(record, "memberId");
  requireDate(record, "capturedAt");
  if (
    record.verification !== "unknown" &&
    typeof record.verification !== "boolean"
  )
    throw new ValidationError("verification must be boolean or unknown");
  for (const field of ["photoCount", "profileWordCount"] as const) {
    if (
      record[field] !== "unknown" &&
      (typeof record[field] !== "number" ||
        !Number.isInteger(record[field]) ||
        record[field] < 0)
    )
      throw new ValidationError(
        `${field} must be a non-negative integer or unknown`,
      );
  }
  if (record.joinedAt !== "unknown") requireDate(record, "joinedAt");
  const hasEarliest = record.joinedEarliest !== undefined;
  const hasLatest = record.joinedLatest !== undefined;
  if (hasEarliest !== hasLatest)
    throw new ValidationError(
      "joinedEarliest and joinedLatest must be present together",
    );
  if (hasEarliest) {
    requireDate(record, "joinedEarliest");
    requireDate(record, "joinedLatest");
    if (
      Date.parse(record.joinedEarliest as string) >
      Date.parse(record.joinedLatest as string)
    )
      throw new ValidationError(
        "joinedEarliest must not be after joinedLatest",
      );
  }
}

function validateSyncConfig(record: Record<string, unknown>): void {
  allowOnly(
    record,
    [
      "id",
      "accountId",
      "createdAt",
      "updatedAt",
      "endpoint",
      "lastSyncedAt",
      "keyDerivation",
    ],
    "SyncConfig",
  );
  requireString(record, "endpoint");
  const keyDerivation = record.keyDerivation;
  if (!keyDerivation || typeof keyDerivation !== "object")
    throw new ValidationError("keyDerivation is required");
  const parameters = keyDerivation as Record<string, unknown>;
  allowOnly(
    parameters,
    ["algorithm", "iterations", "hash", "salt"],
    "keyDerivation",
  );
  if (parameters.algorithm !== "PBKDF2" || parameters.hash !== "SHA-256")
    throw new ValidationError("Unsupported key derivation parameters");
  if (
    !Number.isInteger(requireNumber(parameters, "iterations")) ||
    requireNumber(parameters, "iterations") <= 0
  )
    throw new ValidationError("iterations must be a positive integer");
  requireString(parameters, "salt");
}

export function validateEntity(
  entityName: EntityName,
  entity: AccountScopedEntity,
): void {
  const record = entity as unknown as Record<string, unknown>;
  requireString(record, "id");
  requireString(record, "accountId");
  requireDate(record, "createdAt");
  requireDate(record, "updatedAt");

  switch (entityName) {
    case "extensionAccounts":
      requireString(record, "joyClubAccountId");
      optionalString(record, "label");
      break;
    case "joyClubMembers":
      requireString(record, "joyClubMemberId");
      break;
    case "profileSnapshots":
      validateProfileSnapshot(record);
      break;
    case "userNotes":
      requireString(record, "memberId");
      requireString(record, "body");
      break;
    case "userTags":
      requireString(record, "memberId");
      requireString(record, "label");
      break;
    case "trustSignals":
      requireString(record, "memberId");
      requireEnum(record, "kind", ["positive", "negative", "neutral"]);
      requireDate(record, "occurredAt");
      break;
    case "contactRules":
      requireString(record, "name");
      requireArray(record, "conditions");
      requireEnum(record, "defaultPlacement", [
        "qualified",
        "needs-review",
        "quarantined",
      ]);
      break;
    case "conversationClassifications":
      requireString(record, "memberId");
      requireString(record, "conversationId");
      requireEnum(record, "placement", [
        "qualified",
        "needs-review",
        "quarantined",
      ]);
      requireStringArray(record, "reasons");
      optionalString(record, "ruleId");
      break;
    case "savedSearches":
      requireString(record, "name");
      requireString(record, "url");
      break;
    case "eventMetadata":
      requireString(record, "eventId");
      optionalString(record, "note");
      requireStringArray(record, "tags");
      requireEnum(record, "attendance", [
        "interested",
        "attending",
        "not-attending",
        "unknown",
      ]);
      break;
    case "spendLogEntries":
      requireDate(record, "occurredAt");
      requireNumber(record, "amountMinor");
      requireString(record, "currency");
      requireEnum(record, "category", ["coins", "membership", "other"]);
      break;
    case "syncConfigs":
      validateSyncConfig(record);
      if (record.lastSyncedAt !== undefined)
        requireDate(record, "lastSyncedAt");
      break;
    case "extensionPreferences":
      requireString(record, "key");
      break;
    case "messageTemplates":
      requireString(record, "name");
      requireString(record, "body");
      break;
    case "spamPhrases":
      requireString(record, "phrase");
      requireBoolean(record, "enabled");
      break;
    case "messageObservations":
      // This is the one store holding message-derived content, so it is
      // closed: a field carrying the original text cannot be added to a
      // record by accident and slip past the normalization guarantee.
      allowOnly(
        record,
        [
          "id",
          "accountId",
          "createdAt",
          "updatedAt",
          "memberId",
          "conversationId",
          "observedAt",
          "normalizedText",
        ],
        "MessageObservation",
      );
      requireString(record, "memberId");
      requireDate(record, "observedAt");
      requireString(record, "normalizedText");
      optionalString(record, "conversationId");
      break;
    case "senderSpamOverrides":
      requireString(record, "memberId");
      requireEnum(record, "decision", ["not-spam"]);
      requireDate(record, "decidedAt");
      optionalString(record, "reason");
      break;
    case "actionLogs":
      requireString(record, "action");
      optionalString(record, "memberId");
      validateActionSteps(record);
      break;
  }
}
