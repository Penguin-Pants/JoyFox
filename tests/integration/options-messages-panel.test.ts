// @vitest-environment jsdom
import "../setup-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AccountService } from "../../src/accounts/account-service";
import { setLocale } from "../../src/i18n/translator";
import { MessageCacheService } from "../../src/messages/message-cache-service";
import {
  MESSAGE_CACHING_KEY,
  MESSAGE_RETENTION_KEY,
} from "../../src/messages/message-settings";
import { confirmTiming } from "../../src/options/confirm";
import { MessagesPanel } from "../../src/options/messages-panel";
import { rememberNicknames } from "../../src/storage/member-directory";
import { repositories } from "../../src/storage/repositories";
import { messageId } from "../fixtures/messages";
import { MemorySettingsArea } from "../memory-settings";
import { freshDatabase } from "../setup-indexeddb";

const now = "2026-09-26T10:00:00.000Z";
let settings: MemorySettingsArea;
let accounts: AccountService;
let service: MessageCacheService;
let root: HTMLElement;
let panel: MessagesPanel;

beforeEach(async () => {
  await freshDatabase();
  settings = new MemorySettingsArea();
  accounts = new AccountService(repositories.extensionAccounts, settings);
  service = new MessageCacheService(settings, undefined, () => new Date(now));
  document.body.replaceChildren();
  root = document.createElement("section");
  document.body.append(root);
  panel = new MessagesPanel(root, settings, service, accounts);
  confirmTiming.graceMs = 0;
});

afterEach(() => {
  setLocale("en");
  confirmTiming.graceMs = 500;
});

const flush = async () => {
  for (let round = 0; round < 10; round += 1)
    await new Promise((resolve) => setTimeout(resolve, 0));
};
const search = () =>
  root.querySelector<HTMLInputElement>("#joyfox-messages-search")!;
const caching = () =>
  root.querySelector<HTMLInputElement>("#joyfox-messages-caching")!;
const months = () =>
  root.querySelector<HTMLInputElement>("#joyfox-messages-retention")!;
const save = () =>
  root.querySelector<HTMLButtonElement>(".joyfox-messages__save")!;
const statusNode = () =>
  root.querySelector<HTMLElement>(".joyfox-panel__status")!;
const status = () => statusNode().textContent ?? "";
const typeSearch = async (text: string) => {
  search().value = text;
  search().dispatchEvent(new Event("input"));
  await flush();
};

async function storeMessages(accountId: string) {
  await service.store(accountId, "personal-1111111-1234567", "1234567", [
    {
      messageId: messageId(1),
      direction: "received",
      sentAt: "2026-09-25T10:00:00.000Z",
      text: "Invented Blue heron\nat the lake",
    },
    {
      messageId: messageId(2),
      direction: "sent",
      text: "Invented red kite",
    },
  ]);
}

describe("V1-4 message search on the options page", () => {
  it("asks for an account first, and shows the switch on by default", async () => {
    await panel.render();
    expect(root.textContent).toContain("Select or add an account first.");
    expect(caching().checked).toBe(true);
    expect(months().value).toBe("12");
  });

  it("finds messages by text, marks each match and says how many", async () => {
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await storeMessages(account.id);
    await panel.render();
    search().value = "BLUE  heron";
    search().dispatchEvent(new Event("input"));
    await flush();
    expect(root.textContent).toContain("1 message found.");
    const item = root.querySelector(".joyfox-messages__item")!;
    expect(item.querySelector("mark")?.textContent).toBe("Blue heron");
    expect(item.textContent).toContain("Member 1234567 to you");
    expect(item.querySelector(".joyfox-messages__text")?.textContent).toBe(
      "Invented Blue heron\nat the lake",
    );
    search().value = "kite";
    search().dispatchEvent(new Event("input"));
    await flush();
    // A member whose nickname JoyFox never saw is named by number.
    expect(root.textContent).toContain("You to Member 1234567");
    search().value = "owl";
    search().dispatchEvent(new Event("input"));
    await flush();
    expect(root.textContent).toContain("No stored message contains this.");
    expect(root.querySelector(".joyfox-messages__item")).toBeNull();
  });

  it("names the other member by the nickname a card showed", async () => {
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await storeMessages(account.id);
    await rememberNicknames(
      repositories.joyClubMembers,
      account.id,
      [{ memberId: "1234567", nickname: "Synthetic_Kite" }],
      now,
    );
    await panel.render();
    search().value = "kite";
    search().dispatchEvent(new Event("input"));
    await flush();
    expect(root.textContent).toContain("You to Synthetic_Kite");
    expect(root.textContent).not.toContain("1234567");
    setLocale("de");
    await panel.render();
    expect(root.textContent).toContain("Du an Synthetic_Kite");
  });

  it("turns storing off and on, and saves how long messages are kept", async () => {
    await accounts.createAccount({ joyClubAccountId: "a" });
    await panel.render();
    caching().checked = false;
    caching().dispatchEvent(new Event("change"));
    await flush();
    expect(settings.items.get(MESSAGE_CACHING_KEY)).toBe(false);
    expect(status()).toContain("Message storing is off.");
    // The field is above this status: the text names no direction.
    expect(status()).toContain("older than the time set here");
    expect(caching().checked).toBe(false);
    months().value = "0";
    save().click();
    await flush();
    expect(status()).toContain("Enter a whole number from 1 to 120.");
    expect(statusNode().dataset.kind).toBe("error");
    months().value = "6";
    // A lower number deletes at once, so Save asks first.
    save().click();
    await flush();
    expect(settings.items.has(MESSAGE_RETENTION_KEY)).toBe(false);
    save().click();
    await flush();
    expect(settings.items.get(MESSAGE_RETENTION_KEY)).toBe(6);
    expect(status()).toBe("Saved. No older message needed deleting.");
    expect(statusNode().dataset.kind).toBe("info");
  });

  it("shows only the active account's messages, in the language shown", async () => {
    const a = await accounts.createAccount({ joyClubAccountId: "a" });
    const b = await accounts.createAccount({ joyClubAccountId: "b" });
    await storeMessages(a.id);
    await accounts.setActiveAccount(b.id);
    await panel.render();
    search().value = "heron";
    search().dispatchEvent(new Event("input"));
    await flush();
    expect(root.textContent).toContain("No stored message contains this.");
    setLocale("de");
    await panel.render();
    expect(root.textContent).toContain("Nachrichtensuche");
    expect(root.textContent).toContain(
      "Keine gespeicherte Nachricht enthält das.",
    );
  });
});

describe("keeping messages for fewer months (U20, U43)", () => {
  /** One message about seven months old, one from yesterday. */
  async function storeOldAndNew(accountId: string) {
    await service.store(accountId, "personal-1111111-1234567", "1234567", [
      {
        messageId: messageId(1),
        direction: "received",
        sentAt: "2026-02-20T10:00:00.000Z",
        text: "Invented old heron",
      },
      {
        messageId: messageId(2),
        direction: "received",
        sentAt: "2026-09-25T10:00:00.000Z",
        text: "Invented new heron",
      },
    ]);
  }
  const stored = async (accountId: string) =>
    (await service.search(accountId, "heron")).messages.length;

  it("says that a lower number deletes at once, and that Save applies it", async () => {
    await panel.render();
    const hint = root.querySelector(
      `#${months().getAttribute("aria-describedby")}`,
    );
    expect(hint?.textContent).toBe(
      'Messages older than this are deleted automatically. Lowering the number deletes older messages at once. The default is 12. Click "Save" to apply.',
    );
    expect(root.textContent).toContain(
      "If you allow JoyFox in private windows, it stores the messages you open there in the same way.",
    );
    // Shown with storing off too: the window still applies.
    caching().checked = false;
    caching().dispatchEvent(new Event("change"));
    await flush();
    expect(
      root.querySelector(`#${months().getAttribute("aria-describedby")}`)
        ?.textContent,
    ).toContain("Lowering the number deletes older messages at once.");
    setLocale("de");
    await panel.render();
    expect(
      root.querySelector(`#${months().getAttribute("aria-describedby")}`)
        ?.textContent,
    ).toBe(
      "Ältere Nachrichten werden automatisch gelöscht. Eine kleinere Zahl löscht ältere Nachrichten sofort. Standard ist 12. Klicke zum Übernehmen auf „Speichern“.",
    );
  });

  it("arms on the first click and deletes only on the second", async () => {
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await storeOldAndNew(account.id);
    await panel.render();
    months().value = "3";
    save().click();
    await flush();
    // Nothing is saved or deleted yet; the prompt says what the next click does.
    expect(settings.items.has(MESSAGE_RETENTION_KEY)).toBe(false);
    expect(await stored(account.id)).toBe(2);
    expect(status()).toBe(
      'Lowering the number deletes the stored messages older than 3 months at once. Click "Save and delete" to confirm.',
    );
    expect(save().textContent).toBe("Save and delete");
    // The typed number stays, and so does the keyboard.
    expect(months().value).toBe("3");

    save().click();
    await flush();
    expect(settings.items.get(MESSAGE_RETENTION_KEY)).toBe(3);
    expect(await stored(account.id)).toBe(1);
    expect(status()).toBe("Saved. 1 older message was deleted.");
    expect(save().textContent).toBe("Save");
    expect(months().value).toBe("3");
  });

  it("keeps the keyboard on Save when it arms", async () => {
    await panel.render();
    months().value = "3";
    save().focus();
    save().click();
    await flush();
    expect(document.activeElement).toBe(save());
    expect(save().textContent).toBe("Save and delete");
  });

  it("ignores a double-click and a confirm within the grace period", async () => {
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await storeOldAndNew(account.id);
    await panel.render();
    confirmTiming.graceMs = 500;
    months().value = "3";
    save().dispatchEvent(new MouseEvent("click", { detail: 1 }));
    await flush();
    save().dispatchEvent(new MouseEvent("click", { detail: 2 }));
    save().dispatchEvent(new MouseEvent("click", { detail: 1 }));
    await flush();
    expect(settings.items.has(MESSAGE_RETENTION_KEY)).toBe(false);
    expect(await stored(account.id)).toBe(2);
    confirmTiming.graceMs = 0;
    save().dispatchEvent(new MouseEvent("click", { detail: 1 }));
    await flush();
    expect(await stored(account.id)).toBe(1);
  });

  it("disarms on any other action, and deletes nothing", async () => {
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await storeOldAndNew(account.id);
    await panel.render();
    const arm = async () => {
      months().value = "3";
      save().click();
      await flush();
      expect(save().textContent).toBe("Save and delete");
    };

    // Another number.
    await arm();
    months().value = "4";
    months().dispatchEvent(new Event("input"));
    expect(save().textContent).toBe("Save");
    expect(status()).toBe("");

    // A search.
    await arm();
    await typeSearch("heron");
    expect(save().textContent).toBe("Save");
    expect(status()).toBe("");

    // The storing switch.
    await arm();
    caching().checked = false;
    caching().dispatchEvent(new Event("change"));
    await flush();
    expect(save().textContent).toBe("Save");

    expect(settings.items.has(MESSAGE_RETENTION_KEY)).toBe(false);
    expect(await stored(account.id)).toBe(2);
    // A click after the disarm asks again, for the number now in the field.
    months().value = "2";
    save().click();
    await flush();
    expect(status()).toContain("older than 2 months at once.");
    expect(settings.items.has(MESSAGE_RETENTION_KEY)).toBe(false);
  });

  it("saves a higher or the same number at once", async () => {
    const account = await accounts.createAccount({ joyClubAccountId: "a" });
    await storeOldAndNew(account.id);
    await panel.render();
    months().value = "24";
    save().click();
    await flush();
    expect(settings.items.get(MESSAGE_RETENTION_KEY)).toBe(24);
    expect(status()).toBe("Saved. No older message needed deleting.");
    expect(save().textContent).toBe("Save");
    await settings.remove([MESSAGE_RETENTION_KEY]);
    await panel.render();
    expect(months().value).toBe("12");
    save().click();
    await flush();
    expect(settings.items.get(MESSAGE_RETENTION_KEY)).toBe(12);
    expect(await stored(account.id)).toBe(2);
  });

  it("keeps a typed number across a redraw, and shows a stored change", async () => {
    await panel.render();
    months().value = "30";
    setLocale("de");
    await panel.render();
    expect(months().value).toBe("30");
    // Not typed: another tab's saved number is shown.
    await settings.set({ [MESSAGE_RETENTION_KEY]: 18 });
    months().value = "12";
    await panel.render();
    expect(months().value).toBe("18");
  });
});

describe("the Messages status line (U29)", () => {
  it("keeps one node across redraws and clears it when a new search starts", async () => {
    await accounts.createAccount({ joyClubAccountId: "a" });
    await panel.render();
    caching().checked = false;
    caching().dispatchEvent(new Event("change"));
    await flush();
    const node = statusNode();
    expect(status()).toContain("Message storing is off.");
    // storage.onChanged and a language change draw the panel again.
    await panel.render();
    expect(statusNode()).toBe(node);
    expect(root.querySelectorAll(".joyfox-panel__status")).toHaveLength(1);
    setLocale("de");
    await panel.render();
    expect(statusNode()).toBe(node);
    expect(status()).toContain("Das Speichern von Nachrichten ist aus.");
    expect(status()).toContain("die hier eingestellte Zeit");
    setLocale("en");
    await typeSearch("h");
    expect(statusNode()).toBe(node);
    expect(status()).toBe("");
    await typeSearch("he");
    expect(status()).toBe("");
  });

  it("reports a failed save as an error", async () => {
    await panel.render();
    settings.set = () => Promise.reject(new Error("unavailable"));
    caching().checked = false;
    caching().dispatchEvent(new Event("change"));
    await flush();
    expect(status()).toBe(
      "JoyFox could not save that change. Nothing was changed.",
    );
    expect(statusNode().dataset.kind).toBe("error");
    expect(statusNode().getAttribute("role")).toBe("alert");
    // Redrawn from storage: still on.
    expect(caching().checked).toBe(true);
    months().value = "24";
    save().click();
    await flush();
    expect(statusNode().dataset.kind).toBe("error");
    expect(settings.items.has(MESSAGE_RETENTION_KEY)).toBe(false);
  });
});
