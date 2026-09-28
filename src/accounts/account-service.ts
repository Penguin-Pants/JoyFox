import type { ExtensionAccount } from "../domain/types";
import { ExtensionError } from "../errors";
import { message } from "../i18n/message";
import {
  runtimeSettingsArea,
  type SettingsArea,
} from "../storage/local-settings";
import { withAccountLock, withAccountLocks } from "../storage/account-lock";
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
        { display: message("error.account.emptyIdentifier") },
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
    // Under the new account's lock (and so the shared data lock), so
    // "delete all" cannot run between this write and the activation. The
    // duplicate check and the write are one transaction, so two creates at
    // once (two options tabs, a double click) cannot both register it.
    await withAccountLock(id, async () => {
      if (!(await this.accounts.addIfIdentifierFree(account)))
        throw new ExtensionError(
          "IdentityMismatch",
          "That account identifier is already registered",
          { display: message("error.account.duplicate") },
        );
      if ((await this.getActiveAccount()) === undefined)
        await this.settings.set({ [ACTIVE_ACCOUNT_SETTING_KEY]: id });
    });
    return account;
  }

  /**
   * Changes only the display label. The JoyClub identifier never changes: an
   * import matches accounts by it. The label is checked as on create: it is
   * trimmed, and an empty one is dropped so the identifier shows instead.
   */
  async renameAccount(
    accountId: string,
    label: string,
  ): Promise<ExtensionAccount> {
    const trimmed = label.trim();
    // Under the account's lock, so a removal cannot run between the read
    // and the write and a rename can never bring a removed account back.
    return withAccountLock(accountId, async () => {
      const account = await this.accounts.get(accountId, accountId);
      if (!account)
        throw new ExtensionError(
          "IdentityMismatch",
          "That account no longer exists",
          { display: message("error.account.gone") },
        );
      const renamed: ExtensionAccount = { ...account, updatedAt: this.now() };
      delete renamed.label;
      if (trimmed) renamed.label = trimmed;
      await this.accounts.put(accountId, renamed);
      return renamed;
    });
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

  /**
   * Holds the locks of the account being left and the account being
   * activated. A write that checked, under its account's lock, that its
   * account is active therefore finishes before the switch, or sees the
   * switch and refuses.
   */
  async setActiveAccount(accountId: string): Promise<void> {
    for (;;) {
      const current = await this.getActiveAccountId();
      const switched = await withAccountLocks(
        current ? [current, accountId] : [accountId],
        async () => {
          // Another tab switched meanwhile: the lock held is not the one
          // being left, so start again with the new pointer.
          if ((await this.getActiveAccountId()) !== current) return false;
          if ((await this.accounts.get(accountId, accountId)) === undefined)
            throw new ExtensionError(
              "IdentityMismatch",
              "Cannot activate an account that is not registered",
              { display: message("error.account.notRegistered") },
            );
          await this.settings.set({ [ACTIVE_ACCOUNT_SETTING_KEY]: accountId });
          return true;
        },
      );
      if (switched) return;
    }
  }

  async clearActiveAccount(): Promise<void> {
    await this.settings.remove([ACTIVE_ACCOUNT_SETTING_KEY]);
  }

  /**
   * Removes the account and every record scoped to it. The pointer is cleared
   * first so an interrupted delete can never leave the extension active on a
   * half-removed scope. No other account becomes active. Returns whether the
   * removed account was the active one, so the caller can say so.
   */
  async deleteAccount(accountId: string): Promise<boolean> {
    // Held with every write to this account, so no accepted write can land
    // after the sweep and recreate data for a removed account.
    return withAccountLock(accountId, async () => {
      const wasActive = (await this.getActiveAccountId()) === accountId;
      if (wasActive) await this.clearActiveAccount();
      await deleteAccountData(accountId);
      return wasActive;
    });
  }
}
