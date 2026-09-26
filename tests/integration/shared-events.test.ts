// @vitest-environment jsdom
import "../setup-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerListingHandlers } from "../../src/background/listing-handlers";
import { registerTriageHandlers } from "../../src/background/triage-handlers";
import {
  messageSharedEventsClient,
  SharedEvents,
  type SharedEventsClient,
} from "../../src/content/shared-events";
import { explanation } from "../../src/content/triage-ui";
import { EventTrackerService } from "../../src/events/event-service";
import { MessageRouter } from "../../src/messaging/router";
import { EventsPanel } from "../../src/options/events-panel";
import type { ContactRuleDefinition } from "../../src/rules/contact-rule";
import { RuleService } from "../../src/rules/rule-service";
import { repositories } from "../../src/storage/repositories";
import { SHARED_EVENT_EXCEPTION_KEY } from "../../src/triage/shared-event";
import {
  TriageService,
  type TriageResponse,
} from "../../src/triage/triage-service";
import { TrustService } from "../../src/trust/trust-service";
import { AccountService } from "../../src/accounts/account-service";
import { MemorySettingsArea } from "../memory-settings";
import { freshDatabase } from "../setup-indexeddb";

// Shapes from docs/live-evidence/14-events.md; every value is invented.
const A = "account-a";
const EVENT = "7777777";
const GUEST = "2222222";
const STRANGER = "3333333";
const NOW = new Date("2026-09-26T10:00:00.000Z");
let active: string | undefined;
let settings: MemorySettingsArea;
let listings: EventTrackerService;
let triage: TriageService;
let router: MessageRouter;

beforeEach(async () => {
  await freshDatabase();
  for (const id of [A, "account-b"])
    await repositories.extensionAccounts.put(id, {
      id,
      accountId: id,
      joyClubAccountId: `synthetic-${id}`,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });
  active = A;
  settings = new MemorySettingsArea();
  let clock = 0;
  listings = new EventTrackerService(
    undefined,
    () => `2026-09-26T10:00:0${(clock += 1)}.000Z`,
  );
  triage = new TriageService(
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    settings,
    () => NOW,
  );
  router = new MessageRouter();
  registerListingHandlers(router, {
    listings,
    activeAccountId: () => Promise.resolve(active),
    settings,
  });
  registerTriageHandlers(router, {
    triage,
    trust: new TrustService(),
    activeAccountId: () => Promise.resolve(active),
    openOptions: () => Promise.resolve(),
  });
});

afterEach(() => {
  document.body.replaceChildren();
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

const track = (
  attendance: "attending" | "attended" | "interested",
  expected: string | null = null,
) =>
  listings.save(
    A,
    "event",
    EVENT,
    { note: "", tags: ["Party"], attendance },
    { title: "Synthetic party", startLocal: "2026-10-03T21:00" },
    expected,
  );

const record = async () =>
  (await repositories.eventMetadata.list(A)).find(
    (item) => item.eventId === EVENT,
  );

describe("V1-13 guest lists of tracked events", () => {
  it("stores the guest list only for a tracked event, adds to it, and keeps the notes' version", async () => {
    expect(
      await send("listing.attendees", {
        accountId: A,
        eventId: EVENT,
        memberIds: [GUEST],
      }),
    ).toEqual({ status: "untracked" });
    const saved = await track("attending");
    if (saved.status !== "saved") throw new Error(saved.status);
    expect(
      await send("listing.attendees", {
        accountId: A,
        eventId: EVENT,
        memberIds: [STRANGER, GUEST],
      }),
    ).toEqual({ status: "stored" });
    expect(
      await send("listing.attendees", {
        accountId: A,
        eventId: EVENT,
        memberIds: [GUEST],
      }),
    ).toEqual({ status: "unchanged" });
    const stored = await record();
    expect(stored?.attendees).toEqual([GUEST, STRANGER]);
    // An open notes editor still saves: its version did not change.
    expect(stored?.updatedAt).toBe(saved.record.updatedAt);
    const again = await track("attended", saved.record.updatedAt);
    expect(again.status).toBe("saved");
    expect((await record())?.attendees).toEqual([GUEST, STRANGER]);
    expect(await send("listing.forMember", { memberId: GUEST })).toMatchObject({
      status: "ok",
      listings: [{ eventId: EVENT, title: "Synthetic party" }],
    });
  });

  it("deletes the guest list with the tracking", async () => {
    const saved = await track("attending");
    if (saved.status !== "saved") throw new Error(saved.status);
    await listings.recordAttendees(A, EVENT, [GUEST]);
    const cleared = await listings.save(
      A,
      "event",
      EVENT,
      { note: "", tags: [], attendance: "unknown" },
      {},
      saved.record.updatedAt,
    );
    expect(cleared.status).toBe("removed");
    expect(await record()).toBeUndefined();
    expect(await listings.forMember(A, GUEST)).toEqual([]);
  });

  it("refuses a guest list for an account no longer active, and malformed input", async () => {
    await track("attending");
    active = "account-b";
    expect(
      await send("listing.attendees", {
        accountId: A,
        eventId: EVENT,
        memberIds: [GUEST],
      }),
    ).toEqual({ status: "refused" });
    active = A;
    for (const payload of [
      { memberIds: ["x"] },
      { memberIds: GUEST },
      { memberIds: Array(2001).fill(GUEST) },
      { eventId: "party" },
    ])
      await expect(
        send("listing.attendees", {
          accountId: A,
          eventId: EVENT,
          memberIds: [GUEST],
          ...payload,
        }),
        JSON.stringify(payload).slice(0, 40),
      ).rejects.toThrow("HANDLER_FAILED");
  });
});

const needsReviewRule: ContactRuleDefinition = {
  schemaVersion: 1,
  audience: "all",
  enabled: true,
  defaultPlacement: "quarantined",
  root: {
    type: "group",
    match: "all",
    children: [
      {
        type: "condition",
        kind: "minimumPhotos",
        value: 3,
        whenUnknown: "needs-review",
      },
    ],
  },
};

function ok(response: TriageResponse) {
  if (response.status !== "ok") throw new Error(`got ${response.status}`);
  return response.results;
}
const placementOf = async (memberId = GUEST) =>
  ok(await triage.evaluate(A, [{ memberId, observed: {} }]))[0]!;

describe("V1-13 shared-event exception", () => {
  beforeEach(async () => {
    await new RuleService(undefined, settings, () =>
      NOW.toISOString(),
    ).saveGlobalRule(A, needsReviewRule);
    await track("attending");
    await listings.recordAttendees(A, EVENT, [GUEST]);
  });

  it("is off by default", async () => {
    expect(await placementOf()).toMatchObject({
      placement: "needs-review",
      source: "rule",
    });
  });

  it("places a guest of an event marked Attending or Attended in Qualified, and names the event", async () => {
    await settings.set({ [SHARED_EVENT_EXCEPTION_KEY]: true });
    expect(await placementOf()).toMatchObject({
      placement: "qualified",
      source: "shared-event",
      sharedEvent: {
        eventId: EVENT,
        title: "Synthetic party",
        attendance: "attending",
      },
      automatic: { placement: "needs-review" },
    });
    expect((await placementOf(STRANGER)).source).toBe("rule");
    const stored = await record();
    await track("attended", stored!.updatedAt);
    expect((await placementOf()).sharedEvent?.attendance).toBe("attended");
    await track("interested", (await record())!.updatedAt);
    expect((await placementOf()).source).toBe("rule");
  });

  it("keeps the user's own move, and can be turned off for one sender", async () => {
    await settings.set({ [SHARED_EVENT_EXCEPTION_KEY]: true });
    await triage.setOverride(A, GUEST, "quarantined");
    expect((await placementOf()).source).toBe("override");
    await triage.setOverride(A, GUEST, null);
    expect((await placementOf()).source).toBe("shared-event");
    expect(
      await send("triage.sharedEventOptOut", { accountId: A, memberId: GUEST }),
    ).toEqual({ done: true });
    expect(await placementOf()).toMatchObject({
      placement: "needs-review",
      source: "rule",
    });
  });

  it("names the event in the Why panel, with a button that turns it off", async () => {
    await settings.set({ [SHARED_EVENT_EXCEPTION_KEY]: true });
    const result = await placementOf();
    const onSharedEventOptOut = vi.fn();
    const panel = explanation(document, result, {
      onOverride: () => undefined,
      onSharedEventOptOut,
    });
    expect(panel.textContent).toContain("(the shared-event exception)");
    expect(panel.textContent).toContain(
      'On the guest list of "Synthetic party"',
    );
    expect(panel.textContent).toContain("which you marked Attending.");
    Array.from(panel.querySelectorAll("button"))
      .find((node) =>
        node.textContent?.startsWith("Don't use the shared event"),
      )!
      .click();
    expect(onSharedEventOptOut).toHaveBeenCalledOnce();
  });
});

describe("V1-13 on JoyClub pages and the options page", () => {
  function guestPage(members: string[]) {
    window.history.replaceState(null, "", `/event/${EVENT}.synthetic.html`);
    document.body.innerHTML = `<h1 class="event_name">Synthetic party</h1><div class="tab-pane" id="guest_alle">${members
      .map(
        (member) =>
          `<div class="ha_2"><a class="card normal" href="/profile/${member}.synthetic.html"><div class="date_moreinfo"><strong>NAME</strong></div></a></div>`,
      )
      .join("")}</div>`;
  }

  it("sends the guest list a tracked event page shows, once", async () => {
    await track("attending");
    const client = messageSharedEventsClient((message) =>
      router.route(message),
    );
    const spy = vi.spyOn(client, "recordAttendees");
    const shared = new SharedEvents(document, client, () => active);
    guestPage([STRANGER, GUEST]);
    shared.update("event");
    await flush();
    shared.update("event");
    await flush();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(A, EVENT, [GUEST, STRANGER]);
    expect((await record())?.attendees).toEqual([GUEST, STRANGER]);
  });

  it("lists the shared events on the member's profile page", async () => {
    await track("attending");
    await listings.recordAttendees(A, EVENT, [GUEST]);
    const shared = new SharedEvents(
      document,
      messageSharedEventsClient((message) => router.route(message)),
      () => active,
    );
    window.history.replaceState(null, "", `/profile/${GUEST}.synthetic.html`);
    document.body.innerHTML = `<div data-e2e="profile-header-base-info">NAME</div>`;
    shared.update("profile");
    await flush();
    const section = document.querySelector('[data-joyfox-ui="shared-events"]');
    expect(section?.textContent).toContain("Shared events");
    expect(section?.querySelector("li")?.textContent).toContain(
      "Synthetic party",
    );
    expect(section?.querySelector("li")?.textContent).toContain("Attending");
    // A member on no stored guest list gets no section.
    const client: SharedEventsClient = {
      recordAttendees: () => Promise.resolve({ status: "untracked" }),
      forMember: () =>
        Promise.resolve({ status: "ok", accountId: A, listings: [] }),
    };
    const none = new SharedEvents(document, client, () => active);
    document.body.innerHTML = `<div data-e2e="profile-header-base-info">NAME</div>`;
    none.update("profile");
    await flush();
    expect(
      document.querySelector('[data-joyfox-ui="shared-events"]'),
    ).toBeNull();
  });

  it("switches the exception on the Events tab, off by default, and counts stored guests", async () => {
    const accounts = new AccountService(
      repositories.extensionAccounts,
      settings,
    );
    await accounts.setActiveAccount(A);
    await track("attending");
    await listings.recordAttendees(A, EVENT, [GUEST, STRANGER]);
    const root = document.createElement("section");
    document.body.append(root);
    const panel = new EventsPanel(
      root,
      listings,
      accounts,
      () => new Date(2026, 8, 26, 12),
      settings,
    );
    await panel.render();
    const toggle = root.querySelector<HTMLInputElement>(
      "#joyfox-shared-event-exception",
    )!;
    expect(toggle.checked).toBe(false);
    expect(root.textContent).toContain("2 guests stored");
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change"));
    await flush();
    expect(settings.items.get(SHARED_EVENT_EXCEPTION_KEY)).toBe(true);
    expect(
      root.querySelector<HTMLInputElement>("#joyfox-shared-event-exception")!
        .checked,
    ).toBe(true);
    expect(root.textContent).toContain("Saved.");
  });
});
