import type { PlainKey } from "../i18n/catalog/en";
import { t } from "../i18n/translator";
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
 * The `storage.local` key that turns the composer template picker off. The
 * picker is on unless this is set to `false`. It became default-on after the
 * owner's live check showed JoyClub registers an insertion
 * (`docs/manual-acceptance.md`, item 33; ADR 0007).
 */
export const TEMPLATE_PICKER_KEY = "joyfox.templatePicker";

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

const RESULT_TEXT: Record<string, PlainKey> = {
  inserted: "picker.result.inserted",
  "not-editable": "picker.result.not-editable",
  "too-long": "picker.result.too-long",
  altered: "picker.result.altered",
};

function resultText(result: InsertionResult): PlainKey {
  return RESULT_TEXT[
    result.status === "refused" ? result.reason : result.status
  ]!;
}

/** The folder a template is listed under, in the language shown. */
const folderName = (template: TemplateSummary) =>
  template.folder || t("templates.folder.general");

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
  /** The notice shown, kept as a key so a language change can redraw it. */
  #statusKey?: PlainKey;
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

  /**
   * The language changed: relabel the button and the notice. An open list
   * is read again, so its folder names follow too.
   */
  localeChanged(): void {
    if (!this.#root) return;
    if (this.#toggle) this.#toggle.textContent = t("picker.toggle");
    this.#setStatus(this.#statusKey);
    if (this.#list) void this.#open();
  }

  #mount(composer: HTMLTextAreaElement): void {
    const document = this.document;
    const root = element(document, "div", "joyfox-template-picker");
    root.setAttribute(UI_ATTRIBUTE, "template-picker");
    const toggle = button(
      document,
      "joyfox-template-picker__toggle",
      t("picker.toggle"),
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
    this.#setStatus("picker.loading");
    let answer: Awaited<ReturnType<TemplateClient["listTemplates"]>>;
    try {
      answer = await this.client.listTemplates();
    } catch {
      if (generation === this.#generation) this.#setStatus("picker.readFailed");
      return;
    }
    if (generation !== this.#generation || !this.#root) return;
    this.#setStatus(undefined);
    const list = element(this.document, "div", "joyfox-template-picker__list");
    list.id = "joyfox-template-picker-list";
    this.#toggle?.setAttribute("aria-controls", list.id);
    if (!answer.accountId || answer.templates.length === 0) {
      list.append(
        element(
          this.document,
          "p",
          "joyfox-template-picker__empty",
          t(answer.accountId ? "picker.empty" : "picker.noAccount"),
        ),
        button(
          this.document,
          "joyfox-template-picker__options",
          t("common.openOptions"),
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

  #setStatus(key: PlainKey | undefined): void {
    this.#statusKey = key;
    if (this.#status) this.#status.textContent = key ? t(key) : "";
  }
}

/**
 * Grouped and sorted by the shown folder name, so "General" is one group
 * and sits where its name reads in the language shown. Within a group the
 * background's order (by name) stays.
 */
function groupByFolder(
  templates: readonly TemplateSummary[],
): Array<[string, TemplateSummary[]]> {
  const groups = new Map<string, TemplateSummary[]>();
  for (const template of templates) {
    const folder = folderName(template);
    const group = groups.get(folder) ?? [];
    group.push(template);
    groups.set(folder, group);
  }
  return Array.from(groups).sort(([a], [b]) => a.localeCompare(b));
}
