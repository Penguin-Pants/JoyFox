import type { ExtensionPreference } from "../domain/types";
import { ExtensionPreferenceRepository } from "../storage/repositories";

const repo = new ExtensionPreferenceRepository();
export async function incrementPersistentWakeCounter(
  accountId: string,
): Promise<number> {
  const current = await repo.get(accountId, "background-wake-count");
  const value = typeof current?.value === "number" ? current.value + 1 : 1;
  const now = new Date().toISOString();
  const record: ExtensionPreference = {
    id: "background-wake-count",
    accountId,
    key: "diagnostic.backgroundWakeCount",
    value,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  };
  await repo.put(accountId, record);
  return value;
}
