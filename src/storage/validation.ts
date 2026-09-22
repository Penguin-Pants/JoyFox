import type { AccountScopedEntity } from "../domain/types";

export class ValidationError extends Error {}

export function validateEntity(entity: AccountScopedEntity): void {
  for (const [name, value] of Object.entries({
    id: entity.id,
    accountId: entity.accountId,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  })) {
    if (typeof value !== "string" || value.length === 0)
      throw new ValidationError(`${name} must be a non-empty string`);
  }
  if (
    !Number.isFinite(Date.parse(entity.createdAt)) ||
    !Number.isFinite(Date.parse(entity.updatedAt))
  )
    throw new ValidationError("timestamps must be ISO-compatible dates");
}
