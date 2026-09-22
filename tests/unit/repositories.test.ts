import "../setup-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import type { AccountScopedEntity } from "../../src/domain/types";
import { ENTITY_NAMES } from "../../src/storage/database";
import {
  deleteAccountData,
  exportAccount,
  repositories,
} from "../../src/storage/repositories";
import { freshDatabase } from "../setup-indexeddb";

const now = "2026-09-22T00:00:00.000Z";
const entity = (accountId: string, id: string): AccountScopedEntity => ({
  id,
  accountId,
  createdAt: now,
  updatedAt: now,
});

describe("F6 repositories", () => {
  beforeEach(freshDatabase);
  for (const name of ENTITY_NAMES)
    it(`${name} supports scoped get, list, put and delete`, async () => {
      const repo = repositories[name] as {
        put(a: string, e: AccountScopedEntity): Promise<void>;
        get(a: string, id: string): Promise<AccountScopedEntity | undefined>;
        list(a: string): Promise<AccountScopedEntity[]>;
        delete(a: string, id: string): Promise<void>;
      };
      await repo.put("account-a", entity("account-a", `${name}-1`));
      await repo.put("account-b", entity("account-b", `${name}-1`));
      expect((await repo.get("account-a", `${name}-1`))?.accountId).toBe(
        "account-a",
      );
      expect(await repo.list("account-a")).toHaveLength(1);
      await repo.delete("account-a", `${name}-1`);
      expect(await repo.get("account-a", `${name}-1`)).toBeUndefined();
      expect(await repo.list("account-b")).toHaveLength(1);
    });

  it("rejects cross-account writes", async () => {
    await expect(
      repositories.userNotes.put(
        "account-a",
        entity("account-b", "note") as never,
      ),
    ).rejects.toThrow("account");
  });
  it("exports every entity and deletes an account only", async () => {
    for (const name of ENTITY_NAMES)
      await (
        repositories[name] as never as {
          put(a: string, e: AccountScopedEntity): Promise<void>;
        }
      ).put("account-a", entity("account-a", name));
    const exported = await exportAccount("account-a");
    expect(Object.keys(exported.entities).sort()).toEqual(
      [...ENTITY_NAMES].sort(),
    );
    await deleteAccountData("account-a");
    for (const name of ENTITY_NAMES)
      expect(
        (await repositories[name].list("account-a")) as unknown[],
      ).toHaveLength(0);
  });
});
