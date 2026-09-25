// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InboxTriage } from "../../src/content/inbox-triage";
import type { TriageClient } from "../../src/content/triage-client";
import {
  TemplatePicker,
  type TemplateClient,
} from "../../src/content/template-picker";
import type { TemplateSummary } from "../../src/messaging/protocol";
import { insertAtCursor } from "../../src/templates/insertion";
import conversationHtml from "../fixtures/joyclub/conversation.html?raw";

const CONVERSATION =
  "/clubmail/conversation/conversation-wrapper-personal-1234567-7654321/";

function setPage(path: string, html: string) {
  window.history.replaceState(null, "", path);
  document.body.innerHTML = html;
}

const composer = () =>
  document.querySelector<HTMLTextAreaElement>(
    "textarea.joy-input-wonder__input",
  )!;
const send = () =>
  document.querySelector<HTMLButtonElement>(
    'button.joy-input-wonder__button[data-e2e="button-submit"]',
  )!;
const picker = () => document.querySelector(".joyfox-template-picker");
const toggle = () =>
  document.querySelector<HTMLButtonElement>(".joyfox-template-picker__toggle")!;
const items = () =>
  Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      ".joyfox-template-picker__item",
    ),
  );
const status = () =>
  document.querySelector(".joyfox-template-picker__status")?.textContent ?? "";

async function settle(until: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 200 && !until(); attempt += 1)
    await new Promise((resolve) => setTimeout(resolve, 0));
  if (!until()) throw new Error("The picker never reached the expected state");
}

const TEMPLATES: TemplateSummary[] = [
  {
    id: "template:1",
    name: "Confirm",
    folder: "Event confirmation",
    body: "Du bist dabei!\nBis Samstag.",
  },
  { id: "template:2", name: "Hello", folder: "General", body: "Hallo 😀 ß" },
];

function client(
  answer: Awaited<ReturnType<TemplateClient["listTemplates"]>> = {
    accountId: "account-a",
    templates: TEMPLATES,
  },
): TemplateClient & { opened: number } {
  const result = {
    opened: 0,
    listTemplates: vi.fn(() => Promise.resolve(answer)),
    openOptions: () => {
      result.opened += 1;
      return Promise.resolve();
    },
  };
  return result;
}

describe("M10 insertion into a compose field", () => {
  beforeEach(() => setPage(CONVERSATION, conversationHtml));

  it("inserts the exact text at the cursor and replaces the selection", () => {
    const field = composer();
    field.value = "Hi there, friend";
    field.setSelectionRange(3, 8);
    const events: string[] = [];
    field.addEventListener("input", (event) =>
      events.push(`${event.type}:${(event as InputEvent).inputType}`),
    );
    field.addEventListener("change", (event) => events.push(event.type));
    const body = "Zeile 1\nZeile 2 😀";
    expect(insertAtCursor(field, body)).toEqual({ status: "inserted" });
    expect(field.value).toBe(`Hi ${body}, friend`);
    expect(field.selectionStart).toBe(3 + body.length);
    expect(events).toEqual(["input:insertText", "change"]);
  });

  it("refuses rather than truncates when the field's maxlength would be passed", () => {
    const field = composer();
    field.maxLength = 10;
    field.value = "12345";
    field.setSelectionRange(5, 5);
    const onInput = vi.fn();
    field.addEventListener("input", onInput);
    expect(insertAtCursor(field, "678901")).toEqual({
      status: "refused",
      reason: "too-long",
    });
    expect(field.value).toBe("12345");
    expect(onInput).not.toHaveBeenCalled();
    expect(insertAtCursor(field, "67890")).toEqual({ status: "inserted" });
    expect(field.value).toBe("1234567890");
  });

  it("refuses a disabled, read-only or detached field", () => {
    const field = composer();
    field.disabled = true;
    expect(insertAtCursor(field, "x")).toMatchObject({
      reason: "not-editable",
    });
    field.disabled = false;
    field.readOnly = true;
    expect(insertAtCursor(field, "x")).toMatchObject({
      reason: "not-editable",
    });
    field.readOnly = false;
    field.remove();
    expect(insertAtCursor(field, "x")).toMatchObject({
      reason: "not-editable",
    });
    expect(field.value).toBe("");
  });

  it("reports when the page rewrites the inserted text", () => {
    const field = composer();
    field.addEventListener("input", () => {
      field.value = field.value.slice(0, 3);
    });
    expect(insertAtCursor(field, "abcdef")).toEqual({ status: "altered" });
  });

  it("never submits the form or clicks Send", () => {
    const onSubmit = vi.fn((event: Event) => event.preventDefault());
    const onSend = vi.fn();
    composer().form!.addEventListener("submit", onSubmit);
    send().addEventListener("click", onSend);
    insertAtCursor(composer(), "Hallo");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onSend).not.toHaveBeenCalled();
  });
});

describe("M10 composer template picker", () => {
  beforeEach(() => setPage(CONVERSATION, conversationHtml));

  it("mounts once, after JoyClub's form, never inside it", () => {
    const view = new TemplatePicker(document, client());
    view.update();
    view.update();
    expect(document.querySelectorAll(".joyfox-template-picker")).toHaveLength(
      1,
    );
    expect(composer().form!.contains(picker())).toBe(false);
    expect(composer().form!.nextElementSibling).toBe(picker());
    expect(picker()!.getAttribute("data-joyfox-ui")).toBe("template-picker");
  });

  it("lists templates by folder and inserts the chosen one exactly", async () => {
    const api = client();
    const view = new TemplatePicker(document, api);
    view.update();
    const field = composer();
    field.value = "Hallo, ";
    field.setSelectionRange(7, 7);
    toggle().click();
    await settle(() => items().length === 2);
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    const groups = Array.from(
      document.querySelectorAll(".joyfox-template-picker__group"),
    ).map((group) => group.getAttribute("aria-label"));
    expect(groups).toEqual(["Event confirmation", "General"]);
    const onSend = vi.fn();
    send().addEventListener("click", onSend);
    items()[0]!.click();
    expect(field.value).toBe("Hallo, Du bist dabei!\nBis Samstag.");
    expect(status()).toContain("click JoyClub's Send button yourself");
    expect(onSend).not.toHaveBeenCalled();
    expect(items()).toHaveLength(0);
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
  });

  it("merges a folder named General with templates without one, in name order", async () => {
    const view = new TemplatePicker(
      document,
      client({
        accountId: "account-a",
        // The background's order: no folder ("") first, then by folder.
        templates: [
          { id: "template:3", name: "Zebra", folder: "", body: "Z" },
          { id: "template:4", name: "Apfel", folder: "General", body: "A" },
          { id: "template:5", name: "Mitte", folder: "Event", body: "M" },
        ],
      }),
    );
    view.update();
    toggle().click();
    await settle(() => items().length === 3);
    const groups = Array.from(
      document.querySelectorAll(".joyfox-template-picker__group"),
      (group) => [
        group.getAttribute("aria-label"),
        Array.from(
          group.querySelectorAll(".joyfox-template-picker__item"),
          (item) => item.textContent,
        ),
      ],
    );
    expect(groups).toEqual([
      ["Event", ["Mitte"]],
      ["General", ["Apfel", "Zebra"]],
    ]);
  });

  it("reads the list fresh on every opening", async () => {
    const api = client();
    const view = new TemplatePicker(document, api);
    view.update();
    toggle().click();
    await settle(() => items().length === 2);
    toggle().click();
    toggle().click();
    await settle(() => items().length === 2);
    expect(api.listTemplates).toHaveBeenCalledTimes(2);
  });

  it("says what to do when there is no account or no template", async () => {
    const api = client({ templates: [] });
    const view = new TemplatePicker(document, api);
    view.update();
    toggle().click();
    await settle(() =>
      (picker()?.textContent ?? "").includes("No JoyFox account"),
    );
    document
      .querySelector<HTMLButtonElement>(".joyfox-template-picker__options")!
      .click();
    await settle(() => api.opened === 1);
  });

  it("drops a late answer after an account switch", async () => {
    let resolve!: (value: {
      accountId: string;
      templates: TemplateSummary[];
    }) => void;
    const api: TemplateClient = {
      listTemplates: () => new Promise((r) => (resolve = r)),
      openOptions: () => Promise.resolve(),
    };
    const view = new TemplatePicker(document, api);
    view.update();
    toggle().click();
    view.accountChanged();
    resolve({ accountId: "account-a", templates: TEMPLATES });
    await new Promise((r) => setTimeout(r, 0));
    expect(items()).toHaveLength(0);
  });

  it("closes an open list when the account changes", async () => {
    const view = new TemplatePicker(document, client());
    view.update();
    toggle().click();
    await settle(() => items().length === 2);
    view.accountChanged();
    expect(items()).toHaveLength(0);
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
  });

  it("reports a failed read without touching the composer", async () => {
    const api: TemplateClient = {
      listTemplates: () => Promise.reject(new Error("offline")),
      openOptions: () => Promise.resolve(),
    };
    const view = new TemplatePicker(document, api);
    view.update();
    composer().value = "Draft";
    toggle().click();
    await settle(() => status().includes("could not read"));
    expect(composer().value).toBe("Draft");
  });

  it("survives inbox teardown, so it is not remounted in a loop", () => {
    const view = new TemplatePicker(document, client());
    view.update();
    const mounted = picker();
    new InboxTriage(document, {} as TriageClient).teardown();
    expect(picker()).toBe(mounted);
    expect(mounted!.isConnected).toBe(true);
  });

  it("follows a replaced composer and leaves when it goes", () => {
    const view = new TemplatePicker(document, client());
    view.update();
    const first = picker();
    const form = composer().form!;
    form.replaceWith(form.cloneNode(true));
    view.update();
    expect(picker()).not.toBe(first);
    expect(first!.isConnected).toBe(false);
    expect(document.querySelectorAll(".joyfox-template-picker")).toHaveLength(
      1,
    );
    composer().form!.remove();
    view.update();
    expect(picker()).toBeNull();
  });
});
