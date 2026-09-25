// @vitest-environment jsdom
import "../setup-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { texts } from "../i18n-text";
import { ActionLogService } from "../../src/actions/action-log-service";
import { runQuickIgnoreDelete } from "../../src/actions/executor";
import { registerActionHandlers } from "../../src/background/action-handlers";
import { JoyClubQuickActionDriver } from "../../src/content/quick-action-driver";
import {
  messageQuickActionClient,
  type QuickActionClient,
} from "../../src/content/quick-action";
import { MessageRouter } from "../../src/messaging/router";
import { repositories } from "../../src/storage/repositories";
import { MemorySettingsArea } from "../memory-settings";
import { freshDatabase } from "../setup-indexeddb";
import conversationHtml from "../fixtures/joyclub/conversation.html?raw";
import profileHtml from "../fixtures/joyclub/profile.html?raw";

/**
 * A synthetic JoyClub, built from the owner's evidence (`02-conversation.md`,
 * `10-ignore.md`): each control's native button sits in an open shadow root,
 * Delete removes the conversation's row at once with no confirmation, and
 * Ignore opens a `j-modal` whose "Ignorieren" turns the menu item into
 * "Profil nicht mehr ignorieren". Invented values only.
 */
const MEMBER = "1234567";
const CONVERSATION = "personal-1234567-7654321";
const CONVERSATION_PATH = `/clubmail/conversation/conversation-wrapper-${CONVERSATION}`;
const PROFILE_PATH = `/profile/${MEMBER}.synthetic_one.html`;
const TIMING = { waitMs: 300, pollMs: 5 };

let client: QuickActionClient;
/** Every native button JoyClub received a click on, by its host's label. */
let pressed: string[];

beforeEach(async () => {
  await freshDatabase();
  const router = new MessageRouter();
  registerActionHandlers(router, {
    actions: new ActionLogService(),
    activeAccountId: () => Promise.resolve("account-a"),
    session: new MemorySettingsArea(),
  });
  client = messageQuickActionClient((message) =>
    router.route(message, { tabId: 3, url: window.location.href }),
  );
  pressed = [];
});

/** Give a JoyClub control its shadow button, with JoyClub's behavior. */
function control(host: Element, label: string, onClick?: () => void): void {
  const button = document.createElement("button");
  button.addEventListener("click", () => {
    pressed.push(label);
    onClick?.();
  });
  host.attachShadow({ mode: "open" }).append(button);
}

const inboxRow = (memberId: string) =>
  `<j-list-item class="cm-conversation-list cm-conversation-list-item">` +
  `<j-avatar-image class="cm-conversation-list-item__avatar" href="/profile/${memberId}.synthetic.html"></j-avatar-image>` +
  `<div class="cm-conversation-list-item__meta"><j-control-button data-e2e="button-delete-conversation"></j-control-button></div>` +
  `</j-list-item>`;

const rowsOf = (memberId: string) =>
  Array.from(
    document.querySelectorAll(
      `.cm-conversation-list-item__avatar[href^="/profile/${memberId}."]`,
    ),
  );

/** Invented labels for the other items of the conversation menu. */
const OTHER_ITEMS = ["Als ungelesen markieren", "Archivieren", "Melden"];

/** A JoyClub menu item: its text is only inside its open shadow root. */
function menuItem(menu: Element, text: string, onClick?: () => void): void {
  const item = document.createElement("j-context-menu-item");
  const button = document.createElement("button");
  button.setAttribute("role", "menuitem");
  const span = document.createElement("span");
  span.className = "j-context-menu-item__text";
  span.textContent = ` ${text} `;
  button.append(span);
  button.addEventListener("click", () => {
    pressed.push(text);
    menu.removeAttribute("open");
    for (const node of Array.from(menu.querySelectorAll("j-context-menu-item")))
      node.remove();
    onClick?.();
  });
  item.attachShadow({ mode: "open" }).append(button);
  menu.append(item);
}

/**
 * The split view: the list on the left, the conversation on the right. The
 * conversation's three-dot menu shares JoyClub's header with the
 * conversation header, and renders its items only while open (owner
 * evidence, 2026-09-24, eighth report).
 */
function openConversation(
  options: { list?: boolean; onDelete?: () => void } = {},
) {
  window.history.replaceState(null, "", CONVERSATION_PATH);
  const list =
    options.list === false
      ? ""
      : `<div class="cm-conversation-list">${inboxRow("5550001")}${inboxRow(MEMBER)}${inboxRow("5550002")}</div>`;
  const header = conversationHtml.slice(
    0,
    conversationHtml.indexOf("</a>") + 4,
  );
  document.body.innerHTML =
    `${list}<header class="cm-clubmail-header">${header}` +
    `<j-context-menu class="cm-conversation__context-menu" offset-x="true">` +
    `<j-control-button slot="activator" data-e2e="button-conversation-kebap" aria-label="Optionen"></j-control-button>` +
    `</j-context-menu></header><ul${conversationHtml.split("<ul")[1]}`;
  for (const row of Array.from(
    document.querySelectorAll(".cm-conversation-list-item"),
  ))
    control(
      row.querySelector('[data-e2e="button-delete-conversation"]')!,
      "row delete",
    );
  const menu = document.querySelector("j-context-menu")!;
  // JoyClub moves the conversation to the trash at once: its row goes.
  const onDelete =
    options.onDelete ??
    (() =>
      setTimeout(
        () => rowsOf(MEMBER)[0]?.closest("j-list-item")?.remove(),
        20,
      ));
  control(menu.querySelector('[slot="activator"]')!, "Optionen", () => {
    if (menu.getAttribute("open") === "true") {
      menu.removeAttribute("open");
      for (const node of Array.from(
        menu.querySelectorAll("j-context-menu-item"),
      ))
        node.remove();
      return;
    }
    menu.setAttribute("open", "true");
    menuItem(menu, OTHER_ITEMS[0]!);
    menuItem(menu, OTHER_ITEMS[1]!);
    menuItem(menu, "In den Papierkorb schieben", onDelete);
    menuItem(menu, OTHER_ITEMS[2]!);
  });
}

function openProfile(options: { itemOnlyWhenOpen?: boolean } = {}) {
  window.history.replaceState(null, "", PROFILE_PATH);
  document.body.innerHTML =
    profileHtml +
    `<div class="profile-container__context-menu-desktop">` +
    `<j-context-menu data-e2e="profile-context-menu" role="button" aria-haspopup="true">` +
    `<j-control-button slot="activator" aria-label="Profiloptionen"></j-control-button>` +
    `<j-context-menu-item title="Kontakt bearbeiten"></j-context-menu-item>` +
    `</j-context-menu></div>`;
  const menu = document.querySelector("j-context-menu")!;
  const addIgnoreItem = () => {
    if (menu.querySelector('[title^="Profil"]')) return;
    const item = document.createElement("j-context-menu-item");
    item.setAttribute("title", "Profil ignorieren");
    menu.append(item);
    control(item, "Profil ignorieren", () => {
      menu.removeAttribute("open");
      if (options.itemOnlyWhenOpen) item.remove();
      openIgnoreDialog(item);
    });
  };
  control(menu.querySelector('[slot="activator"]')!, "Profiloptionen", () => {
    if (menu.getAttribute("open") === "true") menu.removeAttribute("open");
    else {
      menu.setAttribute("open", "true");
      if (options.itemOnlyWhenOpen) addIgnoreItem();
    }
  });
  if (!options.itemOnlyWhenOpen) addIgnoreItem();
}

function openIgnoreDialog(item: Element) {
  const modal = document.createElement("j-modal");
  modal.innerHTML =
    `<div class="profile-ignore-modal__content"><p>NAME kann dann Folgendes nicht mehr:</p></div>` +
    `<j-button-group slot="actions"><j-button aria-label="Abbrechen" type="button"></j-button>` +
    `<j-button aria-label="Ignorieren" type="button"></j-button></j-button-group>`;
  document.body.append(modal);
  control(modal.querySelector('[aria-label="Abbrechen"]')!, "Abbrechen", () =>
    modal.remove(),
  );
  control(
    modal.querySelector('[aria-label="Ignorieren"]')!,
    "Ignorieren",
    () => {
      modal.remove();
      // JoyClub saves, then the menu offers to stop ignoring.
      setTimeout(
        () => item.setAttribute("title", "Profil nicht mehr ignorieren"),
        20,
      );
    },
  );
}

const run = (extra: Partial<Parameters<typeof runQuickIgnoreDelete>[0]> = {}) =>
  runQuickIgnoreDelete({
    target: { memberId: MEMBER, conversationId: CONVERSATION },
    driver: new JoyClubQuickActionDriver(document, TIMING),
    recorder: client.recorder("account-a"),
    timeoutMs: 2_000,
    ...extra,
  });

async function steps(): Promise<string[]> {
  const [log] = await repositories.actionLogs.list("account-a");
  return (log?.steps ?? []).map((step) =>
    step.errorCode ? `${step.name}:${step.errorCode}` : step.name,
  );
}

describe("M9 live driver on synthetic JoyClub pages (ADR 0011)", () => {
  it("deletes on the conversation page, hands off, and ignores on the profile", async () => {
    openConversation();
    const first = await run({
      handOff: (operationId, next) =>
        client.handOff("account-a", operationId, next, PROFILE_PATH),
    });
    expect(first.status).toBe("handed-off");
    // The menu, then its Delete item; never an inbox row's own button.
    expect(pressed).toEqual(["Optionen", "In den Papierkorb schieben"]);
    expect(rowsOf(MEMBER)).toHaveLength(0);
    expect(rowsOf("5550001")).toHaveLength(1);

    // The tab opens the sender's profile; its content script resumes.
    openProfile();
    const pending = await client.pending();
    if (pending.status !== "ok") throw new Error("no hand-off");
    const second = await run({
      resume: {
        operationId: pending.operationId,
        from: pending.next,
        steps: pending.steps,
      },
    });
    expect(second.report.status).toBe("completed");
    expect(pressed).toEqual([
      "Optionen",
      "In den Papierkorb schieben",
      "Profil ignorieren",
      "Ignorieren",
    ]);
    expect(
      document.querySelector('[title="Profil nicht mehr ignorieren"]'),
    ).not.toBeNull();
    expect(await steps()).toEqual([
      "Started",
      "DeleteRequested",
      "DeleteConfirmed",
      "IgnoreRequested",
      "IgnoreConfirmed",
      "Completed",
    ]);
  });

  it("opens the profile menu first when its items render only while open", async () => {
    openProfile({ itemOnlyWhenOpen: true });
    const driver = new JoyClubQuickActionDriver(document, TIMING);
    expect(driver.hasControl("ignore")).toBe(true);
    await driver.request("ignore");
    expect(pressed).toEqual(["Profiloptionen", "Profil ignorieren"]);
    expect(await driver.awaitConfirmation("ignore")).toBe("shown");
    await driver.confirm("ignore");
    expect(pressed.at(-1)).toBe("Ignorieren");
    expect(pressed).not.toContain("Abbrechen");
  });

  it("refuses an unclear conversation menu, or one without a Delete item", async () => {
    openConversation();
    const driver = new JoyClubQuickActionDriver(document, TIMING);
    expect(driver.hasControl("delete")).toBe(true);
    // A second such menu in the header: JoyFox cannot tell which is right.
    const header = document.querySelector("header.cm-clubmail-header")!;
    header.append(document.querySelector("j-context-menu")!.cloneNode(true));
    expect(driver.hasControl("delete")).toBe(false);
    // One menu again, open, with no item reading "In den Papierkorb schieben".
    header.lastElementChild!.remove();
    const menu = document.querySelector("j-context-menu")!;
    menu.setAttribute("open", "true");
    menuItem(menu, "In den Papierkorb");
    expect(driver.hasControl("delete")).toBe(false);
    expect(pressed).toEqual([]);
  });

  it("clicks nothing when the conversation changes while the menu opens", async () => {
    openConversation();
    const menu = document.querySelector("j-context-menu")!;
    // JoyClub routes to another conversation in place as the menu opens.
    menu
      .querySelector('[slot="activator"]')!
      .shadowRoot!.querySelector("button")!
      .addEventListener("click", () =>
        window.history.replaceState(
          null,
          "",
          "/clubmail/conversation/conversation-wrapper-personal-1234567-1111111",
        ),
      );
    const driver = new JoyClubQuickActionDriver(document, TIMING);
    await expect(driver.request("delete")).rejects.toThrow(/changed/);
    expect(pressed).toEqual(["Optionen"]);
    expect(rowsOf(MEMBER)).toHaveLength(1);
  });

  it("clicks nothing when the list loses the row while the menu opens", async () => {
    openConversation();
    const menu = document.querySelector("j-context-menu")!;
    // The list re-renders without this member's row as the menu opens.
    menu
      .querySelector('[slot="activator"]')!
      .shadowRoot!.querySelector("button")!
      .addEventListener("click", () =>
        rowsOf(MEMBER)[0]?.closest("j-list-item")?.remove(),
      );
    const driver = new JoyClubQuickActionDriver(document, TIMING);
    await expect(driver.request("delete")).rejects.toThrow(/no longer/);
    expect(pressed).toEqual(["Optionen"]);
  });

  it("never uses a menu outside the conversation's own header", () => {
    openConversation();
    // The same menu, but not in the header that holds the conversation.
    const other = document.createElement("div");
    other.append(document.querySelector("j-context-menu")!);
    document.body.append(other);
    expect(
      new JoyClubQuickActionDriver(document, TIMING).hasControl("delete"),
    ).toBe(false);
  });

  it("does not start Delete when the list that shows its result is missing", async () => {
    openConversation({ list: false });
    const result = await run();
    expect(result.report.failure).toBe("unverifiable");
    expect(texts(result.report.lines)).toContain(
      "Nothing was changed on JoyClub.",
    );
    expect(pressed).toEqual([]);
    expect(await steps()).toEqual(["Started", "Failed:unverifiable"]);
  });

  it("reports Delete as not confirmed when the row stays", async () => {
    openConversation({ onDelete: () => undefined });
    const result = await run();
    expect(pressed).toEqual(["Optionen", "In den Papierkorb schieben"]);
    expect(result.report).toMatchObject({
      failure: "not-verified",
      delete: "unknown",
      ignore: "not-done",
    });
  });

  it("never reads a vanished header or an emptied list as a done Delete", async () => {
    // JoyClub re-renders: the header goes, and the list empties for a moment,
    // but the member's row comes back. Nothing was deleted.
    openConversation({
      onDelete: () => {
        document.querySelector(".cm-conversation-header")?.remove();
        const list = document.querySelector("div.cm-conversation-list")!;
        const rows = Array.from(list.children);
        list.replaceChildren();
        setTimeout(() => list.append(...rows), 30);
      },
    });
    const driver = new JoyClubQuickActionDriver(document, TIMING);
    expect(driver.hasControl("delete")).toBe(true);
    expect(driver.canVerify("delete")).toBe(true);
    await driver.request("delete");
    expect(await driver.verify("delete")).toBe(false);
  });

  it("refuses a hand-off to another member's profile", async () => {
    openConversation();
    const first = await run({
      handOff: (operationId, next) =>
        client.handOff(
          "account-a",
          operationId,
          next,
          "/profile/5550001.x.html",
        ),
    });
    expect(first.report.failure).toBe("handoff-failed");
  });

  it("finds no Ignore to click for a member who is already ignored", () => {
    openProfile();
    document
      .querySelector('[title="Profil ignorieren"]')!
      .setAttribute("title", "Profil nicht mehr ignorieren");
    expect(
      new JoyClubQuickActionDriver(document, TIMING).hasControl("ignore"),
    ).toBe(false);
  });

  it("says the dialog is missing when JoyClub shows none", async () => {
    openProfile();
    const item = document.querySelector('[title="Profil ignorieren"]')!;
    item.replaceWith(item.cloneNode());
    control(
      document.querySelector('[title="Profil ignorieren"]')!,
      "Profil ignorieren",
    );
    const driver = new JoyClubQuickActionDriver(document, TIMING);
    await driver.request("ignore");
    expect(await driver.awaitConfirmation("ignore")).toBe("missing");
  });

  it("reads the page it is on, and nothing else", () => {
    openConversation();
    const driver = new JoyClubQuickActionDriver(document, TIMING);
    expect(driver.currentTarget()).toEqual({
      page: "conversation",
      memberId: MEMBER,
      conversationId: CONVERSATION,
    });
    openProfile();
    expect(driver.currentTarget()).toEqual({
      page: "profile",
      memberId: MEMBER,
    });
    window.history.replaceState(null, "", "/clubmail/");
    document.body.innerHTML = "";
    expect(driver.currentTarget()).toEqual({ page: "other" });
  });
});
