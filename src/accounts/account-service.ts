import type { ExtensionAccount } from "../domain/types";
import { ExtensionError } from "../errors";
import {
  runtimeSettingsArea,
  type SettingsArea,
} from "../storage/local-settings";
import { withAccountLock } from "../storage/account-lock";
import {
  deleteAccountData,
  ExtensionAccountRepository,
} from "../storage/repositories";

/**
 * The active account is a pointer, not data, and must be readable before any
 * account scope exists. It therefore lives in `storage.local` and never in an
 * account-scoped store.
 */
export const ACTIVE_ACCOUNT_SETTING_KEY = "joyfox.activeAccountId";

/**
 * JoyClub's own account identity is not detectable yet: no selector is
 * verified. Until it is, the user declares which login a local account stands
 * for, and the extension never infers it from the page. See
 * `docs/known-limitations.md`.
 */
export type AccountIdentitySource = "user-declared";

export class AccountService {
  constructor(
    private readonly accounts = new ExtensionAccountRepository(),
    private readonly settings: SettingsArea = runtimeSettingsArea,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly newId: () => string = () => crypto.randomUUID(),
  ) {}

  async listAccounts(): Promise<ExtensionAccount[]> {
    const accounts = await this.accounts.listAllAccounts();
    return accounts.sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    );
  }

  async createAccount(input: {
    joyClubAccountId: string;
    label?: string;
  }): Promise<ExtensionAccount> {
    const joyClubAccountId = input.joyClubAccountId.trim();
    if (joyClubAccountId.length === 0)
      throw new ExtensionError(
        "IdentityMismatch",
        "An account needs a non-empty identifier",
      );
    const existing = await this.listAccounts();
    if (
      existing.some((account) => account.joyClubAccountId === joyClubAccountId)
    )
      throw new ExtensionError(
        "IdentityMismatch",
        "That account identifier is already registered",
      );
    const timestamp = this.now();
    const id = this.newId();
    const label = input.label?.trim();
    const account: ExtensionAccount = {
      id,
      // An extension account is its own scope. Keeping `accountId` equal to
      // `id` means the account directory obeys the same scoping rule as every
      // other store instead of needing an exception.
      accountId: id,
      joyClubAccountId,
      ...(label ? { label } : {}),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.accounts.put(id, account);
    if ((await this.getActiveAccount()) === undefined)
      await this.setActiveAccount(id);
    return account;
  }

  async getActiveAccountId(): Promise<string | undefined> {
    const stored = await this.settings.get([ACTIVE_ACCOUNT_SETTING_KEY]);
    const value = stored[ACTIVE_ACCOUNT_SETTING_KEY];
    return typeof value === "string" && value.length > 0 ? value : undefined;
  }

  /**
   * Returns the active account only when the pointer still resolves to a
   * stored account. A dangling pointer yields `undefined` so the caller shows
   * "no active account" rather than operating on an unknown scope.
   */
  async getActiveAccount(): Promise<ExtensionAccount | undefined> {
    const activeId = await this.getActiveAccountId();
    if (!activeId) return undefined;
    return this.accounts.get(activeId, activeId);
  }

  async setActiveAccount(accountId: string): Promise<void> {
    if ((await this.accounts.get(accountId, accountId)) === undefined)
      throw new ExtensionError(
        "IdentityMismatch",
        "Cannot activate an account that is not registered",
      );
    await this.settings.set({ [ACTIVE_ACCOUNT_SETTING_KEY]: accountId });
  }

  async clearActiveAccount(): Promise<void> {
    await this.settings.remove([ACTIVE_ACCOUNT_SETTING_KEY]);
  }

  /**
   * Removes the account and every record scoped to it. The pointer is cleared
   * first so an interrupted delete can never leave the extension active on a
   * half-removed scope.
   */
  async deleteAccount(accountId: string): Promise<void> {
    // Held with every write to this account, so no accepted write can land
    // after the sweep and recreate data for a removed account.
    await withAccountLock(accountId, async () => {
      if ((await this.getActiveAccountId()) === accountId)
        await this.clearActiveAccount();
      await deleteAccountData(accountId);
    });
  }
}
