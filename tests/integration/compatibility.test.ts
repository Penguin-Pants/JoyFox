// @vitest-environment jsdom
import "../setup-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { registerCompatibilityHandlers } from "../../src/background/compatibility-handlers";
import { registerTriageHandlers } from "../../src/background/triage-handlers";
import { CompatibilityService } from "../../src/compatibility/compatibility-service";
import {
  CompatibilityOverlay,
  COMPAT_SECTION,
  messageCompatibilityClient,
  RANK_ATTRIBUTE,
  SHARED_ATTRIBUTE,
} from "../../src/content/compatibility";
import { MemberPanel } from "../../src/content/member-panel";
import {
  messageTriageClient,
  type TriageClient,
} from "../../src/content/triage-client";
import { setLocale } from "../../src/i18n/translator";
import { MessageRouter } from "../../src/messaging/router";
import { newestSnapshot } from "../../src/qualification/facts";
import { repositories } from "../../src/storage/repositories";
import { TriageService } from "../../src/triage/triage-service";
import { TrustService } from "../../src/trust/trust-service";
import { checklist } from "../fixtures/preferences";
import { freshDatabase } from "../setup-indexeddb";

// Shapes from docs/live-evidence (03-profile.md, 13-preferences.md,
// 11-search.md, 01-inbox.md, 14-events.md); every value is invented.
const OWN = "1111111";
const now = "2026-09-26T10:00:00.000Z";
let active: string | undefined;
let router: MessageRouter;
let triage: TriageClient;
let overlay: CompatibilityOverlay;

beforeEach(async () => {
  await freshDatabase();
  for (const id of ["account-a", "account-b"])
    await repositories.extensionAccounts.put(id, {
      id,
      accountId: id,
      joyClubAccountId: `synthetic-${id}`,
      createdAt: now,
      updatedAt: now,
    });
  active = "account-a";
  router = new MessageRouter();
  registerTriageHandlers(router, {
    triage: new TriageService(),
    trust: new TrustService(),
    activeAccountId: () => Promise.resolve(active),
    openOptions: () => Promise.resolve(),
  });
  registerCompatibilityHandlers(router, {
    compatibility: new CompatibilityService(),
    activeAccountId: () => Promise.resolve(active),
  });
  triage = messageTriageClient((message) => router.route(message));
  overlay = new CompatibilityOverlay(
    document,
    messageCompatibilityClient((message) => router.route(message)),
  );
});

afterEach(() => {
  document.body.replaceChildren();
  setLocale("en");
});

const flush = async () => {
  for (let round = 0; round < 10; round += 1)
    await new Promise((resolve) => setTimeout(resolve, 0));
};

async function send(type: string, payload: unknown) {
  const response = await router.route({
    type,
    requestId: `r${Math.random()}`,
    payload,
  } as never);
  if (!response.ok) throw new Error(response.error.code);
  return response.payload as never as Record<string, unknown>;
}

/** Cache what a profile page showed, as the member panel does. */
const capture = (memberId: string, preferences: string[], own = false) =>
  triage.captureSnapshot(
    "account-a",
    memberId,
    {},
    { preferences, ...(own ? { ownProfile: true } : {}) },
  );

function profilePage(
  memberId: string,
  people: Array<Record<string, string[]>>,
  own = false,
) {
  window.history.replaceState(null, "", `/profile/${memberId}.synthetic.html`);
  const header = document.createElement("div");
  header.setAttribute("data-e2e", "profile-header-base-info");
  header.textContent = "NAME";
  document.body.replaceChildren(header, checklist(people));
  if (own) {
    const headline = document.createElement("h2");
    headline.className = "profile-headline";
    headline.textContent = "Account";
    document.body.append(headline);
  }
}

const section = () =>
  document.querySelector<HTMLElement>(`[data-joyfox-ui="${COMPAT_SECTION}"]`);
const badges = () =>
  Array.from(document.querySelectorAll('[data-joyfox-ui="compat-badge"]'));
const badgeFor = (href: string) =>
  document.querySelector(`[href*="${href}"] [data-joyfox-ui="compat-badge"]`)
    ?.textContent ?? null;

describe("V1-2 compatibility in the background", () => {
  it("stores the positive preferences with the snapshot and counts the shared ones", async () => {
    await capture(OWN, ["A", "B", "C"], true);
    await capture("2222222", ["B", "C", "D"]);
    await capture("3333333", ["D"]);
    expect(
      await send("compat.lookup", {
        memberIds: ["2222222", "3333333", "4444444", OWN],
      }),
    ).toEqual({
      status: "ok",
      accountId: "account-a",
      own: ["A", "B", "C"],
      ownMemberId: OWN,
      // The viewer's own profile has no count; a member never opened has none.
      shared: { "2222222": 2, "3333333": 0, "4444444": null, [OWN]: null },
    });
  });

  it("keeps a member's preferences when a later visit could not read them", async () => {
    await capture("2222222", [" B ", "A", "A"]);
    await triage.captureSnapshot("account-a", "2222222", { photoCount: 4 });
    const newest = newestSnapshot(
      await repositories.profileSnapshots.list("account-a"),
    );
    expect(newest).toMatchObject({
      photoCount: 4,
      positivePreferences: ["A", "B"],
    });
  });

  it("gives no count before the viewer's own profile was read, and none without an account", async () => {
    await capture("2222222", ["B"]);
    expect(
      await send("compat.lookup", { memberIds: ["2222222"] }),
    ).toMatchObject({
      own: null,
      ownMemberId: null,
      shared: { "2222222": null },
    });
    active = undefined;
    expect(await send("compat.lookup", { memberIds: [] })).toEqual({
      status: "no-account",
    });
  });

  it("rejects malformed input", async () => {
    for (const payload of [
      { preferences: "A" },
      { preferences: [" "] },
      { preferences: ["x".repeat(101)] },
      { preferences: Array.from({ length: 501 }, (_, i) => `t${i}`) },
      { ownProfile: "yes" },
    ])
      await expect(
        send("snapshot.capture", {
          accountId: "account-a",
          memberId: "2222222",
          observed: {},
          ...payload,
        }),
        JSON.stringify(payload).slice(0, 40),
      ).rejects.toThrow("HANDLER_FAILED");
    for (const memberIds of ["2222222", ["x"], Array(501).fill("2222222")])
      await expect(send("compat.lookup", { memberIds })).rejects.toThrow(
        "HANDLER_FAILED",
      );
  });
});

describe("V1-2 compatibility on the profile page", () => {
  it("reads the viewer's own preferences from their own profile", async () => {
    profilePage(
      OWN,
      [{ Unbedingt: ["A", "B"], "Geht gar nicht": ["X"] }],
      true,
    );
    const panel = new MemberPanel(document, triage);
    panel.update("profile");
    await flush();
    const [stored] = await repositories.profileSnapshots.list("account-a");
    expect(stored).toMatchObject({
      memberId: OWN,
      ownProfile: true,
      positivePreferences: ["A", "B"],
    });
    overlay.update("profile");
    await flush();
    expect(section()?.textContent).toContain(
      "This is your profile. JoyFox compares other profiles with its 2 positive preferences.",
    );
    expect(document.querySelector(`[${SHARED_ATTRIBUTE}]`)).toBeNull();
  });

  it("asks for the viewer's own profile first", async () => {
    profilePage("2222222", [{ Unbedingt: ["A"] }]);
    overlay.update("profile");
    await flush();
    expect(section()?.textContent).toContain(
      "Open your own JoyClub profile once, so JoyFox knows your preferences.",
    );
  });

  it("highlights every shared tag and no other, and lists them in words", async () => {
    await capture(OWN, ["A", "B", "C"], true);
    // A couple: "B" is positive for one partner and rejected by the other.
    profilePage("2222222", [
      { "Steh ich drauf": ["B"], Situationsabhängig: ["A", "D"] },
      { "Geht gar nicht": ["B", "C"] },
    ]);
    overlay.update("profile");
    await flush();
    expect(section()?.textContent).toContain(
      "You share 2 preferences with this member:",
    );
    expect(
      Array.from(section()!.querySelectorAll("li"), (item) => item.textContent),
    ).toEqual(["A", "B"]);
    const marked = Array.from(
      document.querySelectorAll(`[${SHARED_ATTRIBUTE}="yes"]`),
      (tag) => [
        tag.shadowRoot?.textContent,
        tag.closest(".profile-erotic-prefs__category")?.querySelector("h4")
          ?.textContent,
      ],
    );
    // Two copies each of A and of the partner's positive B; never the
    // rejected B or C, and never D.
    expect(marked).toHaveLength(4);
    expect(marked.map(([label]) => label).sort()).toEqual(["A", "A", "B", "B"]);
    expect(
      marked.every(([, level]) => !level?.includes("Geht gar nicht")),
    ).toBe(true);
  });

  it("shows on a search card the count the member's profile page showed", async () => {
    await capture(OWN, ["A", "B", "C"], true);
    profilePage("2222222", [{ Unbedingt: ["A", "C", "E"] }]);
    const panel = new MemberPanel(document, triage);
    panel.update("profile");
    overlay.update("profile");
    await flush();
    expect(section()?.textContent).toContain("You share 2 preferences");
    panel.leave();
    searchPage(["2222222"]);
    overlay.invalidate();
    overlay.update("search");
    await flush();
    expect(badgeFor("2222222")).toBe("2 shared");
  });
});

function searchPage(members: string[], display = "grid") {
  window.history.replaceState(null, "", "/member/");
  const list = document.createElement("div");
  list.className = "member_search_list";
  const grid = document.createElement("div");
  grid.style.display = display;
  for (const member of members) {
    const item = document.createElement("div");
    const link = document.createElement("a");
    link.setAttribute("data-e2e", "result-item");
    link.href = `/profile/${member}.synthetic.html`;
    link.append(document.createElement("j-member-card"));
    item.append(link);
    grid.append(item);
  }
  list.append(grid);
  document.body.replaceChildren(list);
}

const button = () =>
  document.querySelector<HTMLButtonElement>(".joyfox-compat-sort__button")!;
const order = () =>
  Array.from(
    document.querySelectorAll<HTMLElement>(`[${RANK_ATTRIBUTE}]`),
    (item) => [
      item.querySelector("a")?.getAttribute("href")?.slice(9, 16),
      item.style.order,
    ],
  );

describe("V1-2 compatibility on cards", () => {
  beforeEach(async () => {
    await capture(OWN, ["A", "B", "C"], true);
    await capture("2222222", ["A", "B"]);
    await capture("3333333", ["D"]);
    await capture("6666666", ["A", "B", "C"]);
  });

  it("badges search results and sorts the loaded ones by the shared count", async () => {
    searchPage(["2222222", "3333333", "5555555", "6666666"]);
    overlay.update("search");
    await flush();
    expect(badgeFor("2222222")).toBe("2 shared");
    expect(badgeFor("3333333")).toBe("0 shared");
    expect(badgeFor("5555555")).toBeNull();
    const badge = document.querySelector('[data-joyfox-ui="compat-badge"]')!;
    expect(badge.getAttribute("slot")).toBe("badge-top-right");
    expect(badge.parentElement?.tagName).toBe("J-MEMBER-CARD");
    expect(badge.getAttribute("aria-label")).toBe(
      "JoyFox: 2 shared preferences",
    );
    expect(button().getAttribute("aria-pressed")).toBe("false");
    button().click();
    expect(order()).toEqual([
      ["2222222", "1"],
      ["3333333", "2"],
      ["5555555", "3"],
      ["6666666", "0"],
    ]);
    expect(
      document.querySelector(".joyfox-compat-sort")?.textContent,
    ).toContain("Sorted by shared preferences.");
    button().click();
    expect(order()).toEqual([]);
  });

  it("writes nothing when the page did not change, so no redraw loop starts", async () => {
    searchPage(["2222222", "6666666"]);
    overlay.update("search");
    await flush();
    button().click();
    const before = badges();
    const bar = document.querySelector(".joyfox-compat-sort");
    const observer = new MutationObserver(() => undefined);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
    });
    overlay.update("search");
    await flush();
    expect(observer.takeRecords()).toEqual([]);
    observer.disconnect();
    expect(badges()).toEqual(before);
    expect(document.querySelector(".joyfox-compat-sort")).toBe(bar);
  });

  it("says so when JoyClub's list layout cannot be sorted", async () => {
    searchPage(["2222222", "6666666"], "block");
    overlay.update("search");
    await flush();
    button().click();
    expect(order()).toEqual([]);
    expect(
      document.querySelector(".joyfox-compat-sort")?.textContent,
    ).toContain("JoyFox cannot sort this list");
  });

  it("badges inbox rows and event guest list entries", async () => {
    window.history.replaceState(null, "", "/clubmail/");
    document.body.innerHTML = `
      <div class="cm-conversation-list">
        <j-list-item class="cm-conversation-list-item">
          <j-avatar-image class="cm-conversation-list-item__avatar" href="/profile/2222222.synthetic.html"></j-avatar-image>
          <div class="cm-conversation-list-item__name" data-e2e="conversation-list-item-name">NAME</div>
        </j-list-item>
        <j-list-item class="cm-conversation-list-item">
          <j-avatar-image class="cm-conversation-list-item__avatar" href="/profile/5555555.synthetic.html"></j-avatar-image>
        </j-list-item>
      </div>`;
    overlay.update("inbox");
    await flush();
    const rowBadges = badges();
    expect(rowBadges.map((node) => node.textContent)).toEqual(["2 shared"]);
    expect(rowBadges[0]?.previousElementSibling?.textContent).toBe("NAME");

    window.history.replaceState(null, "", "/event/7777777.synthetic.html");
    document.body.innerHTML = `
      <h1 class="event_name">Synthetic party</h1>
      <div class="tab-pane" id="guest_alle"><div class="ha_2">
        <a class="card normal" href="/profile/6666666.synthetic.html">
          <div class="date_avatar rel"></div>
          <div class="date_info"><div class="date_moreinfo"><strong>NAME</strong></div></div>
        </a>
      </div></div>`;
    overlay.update("event");
    await flush();
    expect(
      document.querySelector(".date_moreinfo [data-joyfox-ui='compat-badge']")
        ?.textContent,
    ).toBe("3 shared");
  });

  it("draws in the language shown, and clears at once on an account switch", async () => {
    searchPage(["2222222"]);
    overlay.update("search");
    await flush();
    setLocale("de");
    overlay.localeChanged();
    expect(badgeFor("2222222")).toBe("2 gemeinsam");
    active = "account-b";
    overlay.accountChanged();
    expect(badges()).toHaveLength(0);
    await flush();
    // Account B has no preferences stored.
    expect(badges()).toHaveLength(0);
  });

  it("says so when the lookup fails, and does not ask again on every page change", async () => {
    let calls = 0;
    const failing = new CompatibilityOverlay(document, {
      lookup: () => {
        calls += 1;
        return Promise.reject(new Error("offline"));
      },
    });
    profilePage("2222222", [{ Unbedingt: ["A"] }]);
    failing.update("profile");
    await flush();
    failing.update("profile");
    failing.update("profile");
    await flush();
    expect(calls).toBe(1);
    expect(section()?.textContent).toContain(
      "JoyFox could not load your preferences.",
    );
    failing.invalidate();
    await flush();
    expect(calls).toBe(2);
  });

  it("removes its marks when the page is left", async () => {
    searchPage(["2222222", "6666666"]);
    overlay.update("search");
    await flush();
    button().click();
    overlay.leave();
    expect(badges()).toHaveLength(0);
    expect(order()).toEqual([]);
    expect(document.querySelector(".joyfox-compat-sort")).toBeNull();
  });
});
