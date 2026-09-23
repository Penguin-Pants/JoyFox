// @vitest-environment jsdom
import "../setup-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActionLogService } from "../../src/actions/action-log-service";
import { registerActionHandlers } from "../../src/background/action-handlers";
import { registerNotesHandlers } from "../../src/background/notes-handlers";
import { registerTemplateHandlers } from "../../src/background/template-handlers";
import { registerTriageHandlers } from "../../src/background/triage-handlers";
import { InboxTriage } from "../../src/content/inbox-triage";
import {
  MemberNotes,
  messageNotesClient,
} from "../../src/content/member-notes";
import { MemberPanel } from "../../src/content/member-panel";
import {
  messageTemplateClient,
  TemplatePicker,
} from "../../src/content/template-picker";
import { messageTriageClient } from "../../src/content/triage-client";
import type { ExtensionMessage } from "../../src/messaging/protocol";
import { MessageRouter } from "../../src/messaging/router";
import { NotesService } from "../../src/notes/notes-service";
import { RuleService } from "../../src/rules/rule-service";
import { repositories } from "../../src/storage/repositories";
import { TemplateService } from "../../src/templates/template-service";
import { TriageService } from "../../src/triage/triage-service";
import { TrustService } from "../../src/trust/trust-service";
import { MemorySettingsArea } from "../memory-settings";
import { freshDatabase } from "../setup-indexeddb";
import manifestText from "../../manifests/firefox.json?raw";
import conversationHtml from "../fixtures/joyclub/conversation.html?raw";
import inboxHtml from "../fixtures/joyclub/inbox.html?raw";
import profileHtml from "../fixtures/joyclub/profile.html?raw";

/**
 * Build plan Section 23: before sync exists, extension-originated remote
 * network requests = 0. Two checks: no source file uses a network API or
 * names a remote address, and running every page feature against the
 * synthetic fixtures, with the real background handlers, makes no request.
 */

/** Every source file, as text, keyed by its path. */
const SOURCES = import.meta.glob<string>("../../src/**/*", {
  query: "?raw",
  import: "default",
  eager: true,
});

/** Network APIs and remote loads. JoyClub's own traffic is not JoyFox's. */
const NETWORK_PATTERNS: readonly RegExp[] = [
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
  /\bEventSource\b/,
  /\bsendBeacon\b/,
  /\bimportScripts\b/,
  /\bRTCPeerConnection\b/,
  /https?:\/\//,
  /@import\s/,
];

describe("network isolation (build plan Section 23)", () => {
  it("no source file uses a network API or names a remote address", async () => {
    const files = Object.entries(SOURCES);
    // The glob must see the whole tree, or this check proves nothing.
    expect(files.length).toBeGreaterThan(50);
    expect(files.map(([path]) => path)).toContain(
      "../../src/content/content.css",
    );
    const found: string[] = [];
    for (const [path, text] of files)
      for (const pattern of NETWORK_PATTERNS)
        if (pattern.test(text)) found.push(`${path}: ${pattern}`);
    expect(found).toEqual([]);
  });

  it("the manifest loads no remote code and allows no remote origin", async () => {
    const manifest = JSON.parse(manifestText) as Record<string, unknown>;
    expect(manifest.content_security_policy).toBeUndefined();
    const origins = manifestText.match(/\*:\/\/[^"/]+/g) ?? [];
    expect(new Set(origins)).toEqual(
      new Set(["*://*.joyclub.de", "*://*.joyce.app"]),
    );
  });

  describe("at runtime", () => {
    const requests: string[] = [];
    let settings: MemorySettingsArea;
    let router: MessageRouter;
    const active = () => Promise.resolve("account-a");

    beforeEach(async () => {
      await freshDatabase();
      requests.length = 0;
      const record = (api: string) => () => {
        requests.push(api);
        throw new Error(`${api} is not allowed`);
      };
      vi.stubGlobal("fetch", vi.fn(record("fetch")));
      vi.stubGlobal("WebSocket", vi.fn(record("WebSocket")));
      vi.stubGlobal("EventSource", vi.fn(record("EventSource")));
      vi.spyOn(XMLHttpRequest.prototype, "open").mockImplementation(
        record("XMLHttpRequest"),
      );
      Object.defineProperty(navigator, "sendBeacon", {
        configurable: true,
        value: vi.fn(record("sendBeacon")),
      });
      settings = new MemorySettingsArea();
      router = new MessageRouter();
      registerTriageHandlers(router, {
        triage: new TriageService(
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          settings,
        ),
        trust: new TrustService(undefined, undefined, settings),
        activeAccountId: active,
        openOptions: () => Promise.resolve(),
      });
      registerNotesHandlers(router, {
        notes: new NotesService(),
        activeAccountId: active,
        settings,
      });
      registerTemplateHandlers(router, {
        templates: new TemplateService(),
        activeAccountId: active,
      });
      registerActionHandlers(router, {
        actions: new ActionLogService(),
        activeAccountId: active,
      });
      await repositories.extensionAccounts.put("account-a", {
        id: "account-a",
        accountId: "account-a",
        joyClubAccountId: "synthetic-account-a",
        createdAt: "2026-09-23T10:00:00.000Z",
        updatedAt: "2026-09-23T10:00:00.000Z",
      });
      await new RuleService(undefined, settings).saveGlobalRule("account-a", {
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
              kind: "verified",
              whenUnknown: "needs-review",
            },
          ],
        },
      });
      await new TemplateService().save("account-a", {
        name: "Invented",
        body: "Invented template text",
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
      document.body.innerHTML = "";
    });

    const sender = (message: ExtensionMessage) => router.route(message);
    const setPage = (path: string, html: string) => {
      window.history.replaceState(null, "", path);
      document.body.innerHTML = html;
    };
    /** Nothing JoyFox injects may load a resource. */
    const injectedLoaders = () =>
      document.querySelectorAll(
        "[data-joyfox-ui] :is(img, script, iframe, link, object, embed, video, audio, source)",
      ).length;

    it("triage, the panel, notes and templates make no request", async () => {
      setPage("/clubmail/", inboxHtml);
      new InboxTriage(document, messageTriageClient(sender)).update();
      await vi.waitFor(() =>
        expect(
          document.querySelector('[data-joyfox-ui="triage-bar"]'),
        ).not.toBeNull(),
      );

      setPage("/profile/1234567.synthetic_one.html", profileHtml);
      new MemberPanel(document, messageTriageClient(sender)).update("profile");
      const notes = new MemberNotes(document, messageNotesClient(sender));
      notes.update("profile");
      await vi.waitFor(() =>
        expect(
          document.querySelector('[data-joyfox-ui="member-notes"]'),
        ).not.toBeNull(),
      );
      const box = document.querySelector<HTMLTextAreaElement>(
        '[data-joyfox-ui="member-notes"] textarea',
      )!;
      box.value = "Invented note";
      box.dispatchEvent(new Event("input"));
      Array.from(
        document.querySelectorAll<HTMLButtonElement>(
          '[data-joyfox-ui="member-notes"] button',
        ),
      )
        .find((node) => node.textContent === "Save note")!
        .click();
      await vi.waitFor(async () =>
        expect(await repositories.userNotes.list("account-a")).toHaveLength(1),
      );

      setPage(
        "/clubmail/conversation/conversation-wrapper-personal-1234567-7654321/",
        conversationHtml,
      );
      new MemberPanel(document, messageTriageClient(sender)).update(
        "conversation",
      );
      const picker = new TemplatePicker(
        document,
        messageTemplateClient(sender),
      );
      picker.update();
      document
        .querySelector<HTMLButtonElement>(".joyfox-template-picker__toggle")!
        .click();
      await vi.waitFor(() =>
        expect(
          document.querySelector(".joyfox-template-picker__item"),
        ).not.toBeNull(),
      );
      document
        .querySelector<HTMLButtonElement>(".joyfox-template-picker__item")!
        .click();
      await vi.waitFor(() =>
        expect(
          document.querySelector<HTMLElement>(
            '[data-joyfox-ui="member-panel"]',
          ),
        ).not.toBeNull(),
      );

      expect(requests).toEqual([]);
      expect(injectedLoaders()).toBe(0);
    });
  });
});
