import type { MessageTemplate } from "../domain/types";
import { ExtensionError } from "../errors";
import { withAccountLock } from "../storage/account-lock";
import {
  ExtensionAccountRepository,
  MessageTemplateRepository,
} from "../storage/repositories";

/**
 * Storage guards chosen by this implementation, like the note limit. They are
 * not values observed from JoyClub; the composer's own `maxlength` is checked
 * again at insertion time.
 */
export const MAX_TEMPLATE_NAME_LENGTH = 80;
export const MAX_TEMPLATE_FOLDER_LENGTH = 40;
export const MAX_TEMPLATE_BODY_LENGTH = 4000;

/** Shown for a template saved without a folder (PRD Section 6.1). */
export const DEFAULT_FOLDER = "General";
/** Offered as suggestions only; any folder name is accepted. */
export const SUGGESTED_FOLDERS: readonly string[] = [
  DEFAULT_FOLDER,
  "Event confirmation",
  "Event cancellation",
];

export interface TemplateInput {
  /** Present when editing an existing template. */
  id?: string;
  name: string;
  body: string;
  folder?: string;
}

/**
 * For a write made from a form drawn for the active account: the write goes
 * ahead only if that account is still active, checked inside the account
 * lock. An account switch holds the same lock, so the check and the write
 * cannot straddle a switch.
 */
export interface WriteGuard {
  activeAccountId: () => Promise<string | undefined>;
}

const collapse = (value: string) => value.trim().replace(/\s+/gu, " ");

/**
 * A textarea reports every line break as `\n`, whatever was typed or pasted.
 * Storing the same form means the text inserted later is exactly the text
 * stored, character for character.
 */
export function normalizeTemplateBody(body: string): string {
  return body.replace(/\r\n?/gu, "\n");
}

export function folderOf(template: Pick<MessageTemplate, "folder">): string {
  return template.folder ?? DEFAULT_FOLDER;
}

/** Folder, then name, then ID: a stable order for the list and the picker. */
export function compareTemplates(
  a: MessageTemplate,
  b: MessageTemplate,
): number {
  return (
    folderOf(a).localeCompare(folderOf(b)) ||
    a.name.localeCompare(b.name) ||
    a.id.localeCompare(b.id)
  );
}

function invalid(message: string): ExtensionError {
  return new ExtensionError("ExtractionInvalid", message);
}

/**
 * M10: the user's own message templates. Every write runs under the
 * account's lock and first checks that the account still exists, so a save
 * that races an account removal cannot recreate data for it.
 */
export class TemplateService {
  constructor(
    private readonly templates = new MessageTemplateRepository(),
    private readonly accounts = new ExtensionAccountRepository(),
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly newId: () => string = () =>
      `template:${crypto.randomUUID()}`,
  ) {}

  async list(accountId: string): Promise<MessageTemplate[]> {
    const templates = await this.templates.list(accountId);
    return templates.sort(compareTemplates);
  }

  async save(
    accountId: string,
    input: TemplateInput,
    guard?: WriteGuard,
  ): Promise<MessageTemplate> {
    const name = collapse(input.name);
    const folder = collapse(input.folder ?? "");
    const body = normalizeTemplateBody(input.body);
    if (name.length === 0) throw invalid("A template needs a name");
    if (name.length > MAX_TEMPLATE_NAME_LENGTH)
      throw invalid(
        `A template name can have at most ${MAX_TEMPLATE_NAME_LENGTH} characters`,
      );
    if (folder.length > MAX_TEMPLATE_FOLDER_LENGTH)
      throw invalid(
        `A folder name can have at most ${MAX_TEMPLATE_FOLDER_LENGTH} characters`,
      );
    if (body.trim().length === 0) throw invalid("A template needs some text");
    if (body.length > MAX_TEMPLATE_BODY_LENGTH)
      throw invalid(
        `A template can have at most ${MAX_TEMPLATE_BODY_LENGTH} characters`,
      );
    return withAccountLock(accountId, async () => {
      await this.#requireAccount(accountId, guard);
      const existing = input.id
        ? await this.templates.get(accountId, input.id)
        : undefined;
      // Editing a template another tab deleted must not bring it back.
      if (input.id && !existing)
        throw new ExtensionError(
          "StorageError",
          "That template was deleted meanwhile",
        );
      const timestamp = this.now();
      const template: MessageTemplate = {
        id: existing?.id ?? this.newId(),
        accountId,
        name,
        body,
        ...(folder ? { folder } : {}),
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
      };
      await this.templates.put(accountId, template);
      return template;
    });
  }

  async delete(
    accountId: string,
    id: string,
    guard?: WriteGuard,
  ): Promise<void> {
    await withAccountLock(accountId, async () => {
      await this.#requireAccount(accountId, guard);
      await this.templates.delete(accountId, id);
    });
  }

  async #requireAccount(accountId: string, guard?: WriteGuard): Promise<void> {
    if (!(await this.accounts.get(accountId, accountId)))
      throw new ExtensionError(
        "IdentityMismatch",
        "That account no longer exists",
      );
    if (guard && (await guard.activeAccountId()) !== accountId)
      throw new ExtensionError(
        "IdentityMismatch",
        "The active account changed",
      );
  }
}
