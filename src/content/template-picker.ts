import type {
  ExtensionMessage,
  ExtensionResponse,
  TemplateSummary,
} from "../messaging/protocol";
import { request, type MessageSender } from "../messaging/request";
import { verifiedSelector } from "../selectors/registry";
import { insertAtCursor, type InsertionResult } from "../templates/insertion";
import { button, element, UI_ATTRIBUTE } from "./triage-ui";

/**
 * The `storage.local` key that turns on the composer template picker. Off
 * unless set to `true`. It stays opt-in until the composer's input events
 * are verified live (`docs/manual-verification-needed.md`, item 6); the
 * picker is the tool for that check (`docs/manual-acceptance.md`).
 */
export const TEMPLATE_TRIAL_KEY = "joyfox.templateInsertionTrial";

export interface TemplateClient {
  listTemplates(): Promise<{
    accountId?: string;
    templates: TemplateSummary[];
  }>;
  openOptions(): Promise<void>;
}

export function messageTemplateClient(sender: MessageSender): TemplateClient {
  return {
    listTemplates: () => request(sender, "template.list", {}),
    async openOptions() {
      await request(sender, "options.open", {});
    },
  };
}

export function runtimeTemplateClient(): TemplateClient {
  return messageTemplateClient(
    (message: ExtensionMessage) =>
      browser.runtime.sendMessage(message) as Promise<ExtensionResponse>,
  );
}

const RESULT_TEXT: Record<string, string> = {
  inserted:
    "Template inserted. Check the text, then click JoyClub's Send button yourself.",
  "not-editable":
    "The message field cannot be edited right now. Nothing was inserted.",
  "too-long":
    "The template does not fit in the message field. Nothing was inserted; the template was not shortened.",
  altered:
    "JoyClub changed the text after insertion. Check the message field before you send.",
};

function resultText(result: InsertionResult): string {
  return RESULT_TEXT[
    result.status === "refused" ? result.reason : result.status
  ]!;
}

/**
 * M10: a template picker beside JoyClub's composer on a conversation page.
 * It fills the text field only. It never clicks, submits or reads Send, and
 * it never reads the message the user typed: insertion keeps whatever is
 * there and adds the template at the cursor.
 *
 * The picker is placed after the composer's form, never inside it, so
 * JoyClub's own form keeps its markup. It reads the template list fresh on
 * every opening, so an edit on the options page shows at once.
 */
export class TemplatePicker {
  #root?: HTMLElement;
  #composer?: HTMLTextAreaElement;
  #list?: HTMLElement;
  #toggle?: HTMLButtonElement;
  #status?: HTMLElement;
  /** Bumped on every open and teardown, so a late answer is dropped. */
  #generation = 0;

  constructor(
    private readonly document: Document,
    private readonly client: TemplateClient,
  ) {}

  /** Mount beside the composer, or move with it when JoyClub replaces it. */
  update(): void {
    const selector = verifiedSelector("conversation", "composer");
    const found = selector ? this.document.querySelector(selector) : null;
    const composer =
      found instanceof
      (this.document.defaultView?.HTMLTextAreaElement ?? HTMLTextAreaElement)
        ? (found as HTMLTextAreaElement)
        : undefined;
    if (!composer) return this.leave();
    if (composer === this.#composer && this.#root?.isConnected) return;
    this.leave();
    this.#composer = composer;
    this.#mount(composer);
  }

  leave(): void {
    this.#generation += 1;
    this.#root?.remove();
    this.#root = undefined;
    this.#composer = undefined;
    this.#list = undefined;
    this.#toggle = undefined;
    this.#status = undefined;
  }

  /** Another account's templates must never stay on screen after a switch. */
  accountChanged(): void {
    this.#close();
  }

  #mount(composer: HTMLTextAreaElement): void {
    const document = this.document;
    const root = element(document, "div", "joyfox-template-picker");
    root.setAttribute(UI_ATTRIBUTE, "template-picker");
    const toggle = button(
      document,
      "joyfox-template-picker__toggle",
      "JoyFox templates",
      () => (this.#list ? this.#close() : void this.#open()),
    );
    toggle.setAttribute("aria-expanded", "false");
    const status = element(document, "p", "joyfox-template-picker__status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    root.append(toggle, status);
    (composer.form ?? composer).after(root);
    this.#root = root;
    this.#toggle = toggle;
    this.#status = status;
  }

  #close(): void {
    this.#generation += 1;
    this.#list?.remove();
    this.#list = undefined;
    this.#toggle?.setAttribute("aria-expanded", "false");
  }

  async #open(): Promise<void> {
    this.#close();
    const generation = this.#generation;
    this.#setStatus("Loading templates…");
    let answer: Awaited<ReturnType<TemplateClient["listTemplates"]>>;
    try {
      answer = await this.client.listTemplates();
    } catch {
      if (generation === this.#generation)
        this.#setStatus(
          "JoyFox could not read your templates. Nothing was inserted.",
        );
      return;
    }
    if (generation !== this.#generation || !this.#root) return;
    this.#setStatus("");
    const list = element(this.document, "div", "joyfox-template-picker__list");
    list.id = "joyfox-template-picker-list";
    this.#toggle?.setAttribute("aria-controls", list.id);
    if (!answer.accountId || answer.templates.length === 0) {
      list.append(
        element(
          this.document,
          "p",
          "joyfox-template-picker__empty",
          answer.accountId
            ? "No templates yet. Add them on the JoyFox options page."
            : "No JoyFox account is active. Choose one on the JoyFox options page.",
        ),
        button(
          this.document,
          "joyfox-template-picker__options",
          "Open JoyFox options",
          () => void this.client.openOptions().catch(() => undefined),
        ),
      );
    } else {
      for (const [folder, templates] of groupByFolder(answer.templates)) {
        const group = element(
          this.document,
          "div",
          "joyfox-template-picker__group",
        );
        group.setAttribute("role", "group");
        group.setAttribute("aria-label", folder);
        group.append(
          element(this.document, "p", "joyfox-template-picker__folder", folder),
        );
        for (const template of templates)
          group.append(
            button(
              this.document,
              "joyfox-template-picker__item",
              template.name,
              () => this.#insert(template),
            ),
          );
        list.append(group);
      }
    }
    this.#root.append(list);
    this.#list = list;
    this.#toggle?.setAttribute("aria-expanded", "true");
  }

  #insert(template: TemplateSummary): void {
    const composer = this.#composer;
    this.#close();
    if (!composer) return;
    this.#setStatus(resultText(insertAtCursor(composer, template.body)));
  }

  #setStatus(text: string): void {
    if (this.#status) this.#status.textContent = text;
  }
}

function groupByFolder(
  templates: readonly TemplateSummary[],
): Map<string, TemplateSummary[]> {
  const groups = new Map<string, TemplateSummary[]>();
  for (const template of templates) {
    const group = groups.get(template.folder) ?? [];
    group.push(template);
    groups.set(template.folder, group);
  }
  return groups;
}
