import "../setup-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import {
  AccountService,
  ACTIVE_ACCOUNT_SETTING_KEY,
} from "../../src/accounts/account-service";
import { ExtensionError } from "../../src/errors";
import { repositories } from "../../src/storage/repositories";
import { freshDatabase } from "../setup-indexeddb";
import { MemorySettingsArea } from "../memory-settings";

let settings: MemorySettingsArea;
let service: AccountService;

beforeEach(async () => {
  await freshDatabase();
  settings = new MemorySettingsArea();
  service = new AccountService(repositories.extensionAccounts, settings);
});

describe("M7 explicit active account", () => {
  it("activates the first account and keeps later ones inactive", async () => {
    const first = await service.createAccount({
      joyClubAccountId: "synthetic-a",
      label: "Account A",
    });
    const second = await service.createAccount({
      joyClubAccountId: "synthetic-b",
    });
    expect((await service.getActiveAccount())?.id).toBe(first.id);
    expect(settings.items.get(ACTIVE_ACCOUNT_SETTING_KEY)).toBe(first.id);
    await service.setActiveAccount(second.id);
    expect((await service.getActiveAccount())?.id).toBe(second.id);
  });

  it("stores an account as its own scope", async () => {
    const account = await service.createAccount({
      joyClubAccountId: "synthetic-a",
    });
    expect(account.accountId).toBe(account.id);
    expect(
      await repositories.extensionAccounts.get(account.id, account.id),
    ).toEqual(account);
  });

  it("drops an empty optional label rather than storing an empty string", async () => {
    const account = await service.createAccount({
      joyClubAccountId: "synthetic-a",
      label: "   ",
    });
    expect("label" in account).toBe(false);
  });

  it("rejects an empty or duplicate account identifier", async () => {
    await expect(
      service.createAccount({ joyClubAccountId: "  " }),
    ).rejects.toThrow(ExtensionError);
    await service.createAccount({ joyClubAccountId: "synthetic-a" });
    await expect(
      service.createAccount({ joyClubAccountId: " synthetic-a " }),
    ).rejects.toThrow(/already registered/);
  });

  it("refuses to activate an unregistered account", async () => {
    await expect(
      service.setActiveAccount("not-a-real-account"),
    ).rejects.toThrow(/not registered/);
    expect(settings.items.has(ACTIVE_ACCOUNT_SETTING_KEY)).toBe(false);
  });

  it("reports no active account when the pointer dangles", async () => {
    await settings.set({ [ACTIVE_ACCOUNT_SETTING_KEY]: "removed-account" });
    expect(await service.getActiveAccount()).toBeUndefined();
  });

  it("clears the pointer and the data when an account is removed", async () => {
    const account = await service.createAccount({
      joyClubAccountId: "synthetic-a",
    });
    await repositories.userNotes.put(account.id, {
      id: "note:member-1",
      accountId: account.id,
      memberId: "member-1",
      body: "Synthetic note",
      createdAt: "2026-09-22T00:00:00.000Z",
      updatedAt: "2026-09-22T00:00:00.000Z",
    });
    await service.deleteAccount(account.id);
    expect(settings.items.has(ACTIVE_ACCOUNT_SETTING_KEY)).toBe(false);
    expect(await service.listAccounts()).toEqual([]);
    expect(await repositories.userNotes.list(account.id)).toEqual([]);
  });

  it("keeps the pointer when a different account is removed", async () => {
    const active = await service.createAccount({
      joyClubAccountId: "synthetic-a",
    });
    const other = await service.createAccount({
      joyClubAccountId: "synthetic-b",
    });
    await service.deleteAccount(other.id);
    expect((await service.getActiveAccount())?.id).toBe(active.id);
  });

  it("lists accounts oldest first", async () => {
    let tick = 0;
    const ordered = new AccountService(
      repositories.extensionAccounts,
      settings,
      () => new Date(Date.UTC(2026, 8, 22, 0, 0, ++tick)).toISOString(),
    );
    await ordered.createAccount({ joyClubAccountId: "synthetic-a" });
    await ordered.createAccount({ joyClubAccountId: "synthetic-b" });
    expect(
      (await ordered.listAccounts()).map((a) => a.joyClubAccountId),
    ).toEqual(["synthetic-a", "synthetic-b"]);
  });
});
