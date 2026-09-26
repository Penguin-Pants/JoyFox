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
import { MessagesPanel } from "../../src/options/messages-panel";
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
});

afterEach(() => {
  setLocale("en");
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
const status = () => root.querySelector('[role="status"]')?.textContent ?? "";

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
    expect(root.textContent).toContain("You to member 1234567");
    search().value = "owl";
    search().dispatchEvent(new Event("input"));
    await flush();
    expect(root.textContent).toContain("No stored message contains this.");
    expect(root.querySelector(".joyfox-messages__item")).toBeNull();
  });

  it("turns storing off and on, and saves how long messages are kept", async () => {
    await accounts.createAccount({ joyClubAccountId: "a" });
    await panel.render();
    caching().checked = false;
    caching().dispatchEvent(new Event("change"));
    await flush();
    expect(settings.items.get(MESSAGE_CACHING_KEY)).toBe(false);
    expect(status()).toContain("Message storing is off.");
    expect(caching().checked).toBe(false);
    months().value = "0";
    root.querySelector<HTMLButtonElement>(".joyfox-messages__save")!.click();
    await flush();
    expect(status()).toContain("Enter a whole number from 1 to 120.");
    months().value = "6";
    root.querySelector<HTMLButtonElement>(".joyfox-messages__save")!.click();
    await flush();
    expect(settings.items.get(MESSAGE_RETENTION_KEY)).toBe(6);
    expect(status()).toBe("Saved. No older message needed deleting.");
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
