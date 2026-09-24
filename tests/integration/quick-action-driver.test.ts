// @vitest-environment jsdom
import "../setup-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
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
    router.route(message, { tabId: 3 }),
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

/** The split view: the list on the left, the conversation on the right. */
function openConversation(options: { list?: boolean } = {}) {
  window.history.replaceState(null, "", CONVERSATION_PATH);
  const list =
    options.list === false
      ? ""
      : `<div class="cm-conversation-list">${inboxRow("5550001")}${inboxRow(MEMBER)}${inboxRow("5550002")}</div>`;
  document.body.innerHTML = `${list}<div id="row" style="display: flex">${conversationHtml.split("<ul")[0]}</div><ul${conversationHtml.split("<ul")[1]}`;
  for (const row of Array.from(
    document.querySelectorAll(".cm-conversation-list-item"),
  ))
    control(
      row.querySelector('[data-e2e="button-delete-conversation"]')!,
      "row delete",
    );
  const own = document.querySelector(
    '#row > [data-e2e="button-delete-conversation"]',
  )!;
  // JoyClub moves the conversation to the trash at once: its row goes.
  control(own, "conversation delete", () =>
    setTimeout(() => rowsOf(MEMBER)[0]?.closest("j-list-item")?.remove(), 20),
  );
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
        client.handOff("account-a", operationId, next),
    });
    expect(first.status).toBe("handed-off");
    expect(pressed).toEqual(["conversation delete"]);
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
      "conversation delete",
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

  it("never presses an inbox row's Delete, and refuses an unclear control", () => {
    openConversation();
    const driver = new JoyClubQuickActionDriver(document, TIMING);
    expect(driver.hasControl("delete")).toBe(true);
    // A second control outside the rows: JoyFox cannot tell which is right.
    document
      .querySelector("#row")!
      .append(document.createElement("j-control-button"));
    document
      .querySelector("#row > j-control-button:last-child")!
      .setAttribute("data-e2e", "button-delete-conversation");
    expect(driver.hasControl("delete")).toBe(false);
    // None outside the rows: only the rows' own controls remain.
    for (const node of Array.from(
      document.querySelectorAll(
        '#row > [data-e2e="button-delete-conversation"]',
      ),
    ))
      node.remove();
    expect(driver.hasControl("delete")).toBe(false);
  });

  it("does not start Delete when the list that shows its result is missing", async () => {
    openConversation({ list: false });
    const result = await run();
    expect(result.report.failure).toBe("unverifiable");
    expect(result.report.lines).toContain("Nothing was changed on JoyClub.");
    expect(pressed).toEqual([]);
    expect(await steps()).toEqual(["Started", "Failed:unverifiable"]);
  });

  it("reports Delete as not confirmed when the row stays", async () => {
    openConversation();
    const own = document.querySelector(
      '#row > [data-e2e="button-delete-conversation"]',
    )!;
    own.replaceWith(own.cloneNode());
    control(
      document.querySelector('#row > [data-e2e="button-delete-conversation"]')!,
      "conversation delete",
    );
    const result = await run();
    expect(pressed).toEqual(["conversation delete"]);
    expect(result.report).toMatchObject({
      failure: "not-verified",
      delete: "unknown",
      ignore: "not-done",
    });
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
