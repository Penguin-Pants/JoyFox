import { extractConversation, extractProfile } from "../extraction/joyclub";
import { resolveMemberIdentity } from "../identity/member-identity";
import type { ProfileFacts } from "../qualification/facts";
import { selectorRegistry } from "../selectors/registry";
import type {
  MemberTriage,
  TriageResponse,
  TrustResponse,
} from "../triage/triage-service";
import {
  factsKey,
  observedFromConversation,
  observedFromProfile,
} from "./observed-facts";
import type { TriageClient } from "./triage-client";
import {
  button,
  element,
  explanation,
  trustSection,
  UI_ATTRIBUTE,
} from "./triage-ui";

export type MemberPage = "conversation" | "profile";

type PanelData =
  | { kind: "triage"; result: MemberTriage }
  | {
      kind: "trust-only";
      trust: TrustResponse;
      rule: TriageResponse["status"];
    };

interface Target {
  page: MemberPage;
  memberId: string;
  observed: Partial<ProfileFacts>;
  anchor: Element;
  key: string;
}

const RULE_OFF_TEXT: Record<string, string> = {
  "no-rule": "No contact rule is set, so JoyFox does not place this sender.",
  "rule-disabled":
    "Your contact rule is turned off, so JoyFox does not place this sender.",
};

/**
 * The JoyFox panel under the conversation header and the profile header
 * (PRD Section 10.1): the sender's placement with its explanation and manual
 * controls, and the local trust score with outcome logging (M6). On a profile
 * page it also caches the facts the page shows, so the inbox can use them
 * without opening the profile again.
 *
 * The panel is inserted after JoyClub's element, never inside it: the
 * conversation header is itself a link.
 */
export class MemberPanel {
  #data = new Map<string, PanelData>();
  #inFlight?: string;
  #generation = 0;
  #rendered = "";
  #captured = "";
  /**
   * Captures run one after another. The background stamps a snapshot when it
   * writes, so two captures in flight at once could finish out of order and
   * leave an older, partial reading as the newest snapshot.
   */
  #captureQueue: Promise<void> = Promise.resolve();
  #error?: string;
  #page?: MemberPage;

  constructor(
    private readonly document: Document,
    private readonly client: TriageClient,
  ) {}

  update(page: MemberPage): void {
    this.#page = page;
    const target = this.#target(page);
    if (!target) {
      this.teardown();
      return;
    }
    if (page === "profile") this.#capture(target);
    const data = this.#data.get(target.key);
    if (!data) {
      this.#load(target);
      return;
    }
    this.#render(target, data);
  }

  /** Forget every answer and reload the current page's panel. */
  invalidate(): void {
    this.#generation += 1;
    this.#data.clear();
    this.#inFlight = undefined;
    this.#rendered = "";
    if (this.#page) this.update(this.#page);
  }

  /**
   * The active account changed. The panel shows the previous account's data,
   * so it goes at once, and the profile is captured again for the new
   * account on the next update.
   */
  accountChanged(): void {
    this.teardown();
    this.#captured = "";
    this.invalidate();
  }

  /** Called when the page is no longer a conversation or profile. */
  leave(): void {
    this.#page = undefined;
    this.teardown();
  }

  teardown(): void {
    for (const node of Array.from(
      this.document.querySelectorAll(`[${UI_ATTRIBUTE}="member-panel"]`),
    ))
      node.remove();
    this.#rendered = "";
  }

  #target(page: MemberPage): Target | undefined {
    const root = selectorRegistry[page].root;
    const anchor = root ? this.document.querySelector(root) : null;
    if (!anchor) return undefined;
    const url = this.document.URL;
    const extraction =
      page === "conversation"
        ? extractConversation(this.document, url)
        : extractProfile(this.document, url);
    const identity = resolveMemberIdentity({
      page,
      field: "memberId",
      extraction: extraction.memberId,
    });
    // Without a stable member ID nothing is shown or stored (build plan 12).
    if (identity.status !== "resolved") return undefined;
    const observed =
      page === "conversation"
        ? observedFromConversation(
            extraction as ReturnType<typeof extractConversation>,
          )
        : observedFromProfile(extraction as ReturnType<typeof extractProfile>);
    return {
      page,
      memberId: identity.memberId,
      observed,
      anchor,
      key: `${page}|${identity.memberId}|${factsKey(observed)}`,
    };
  }

  /** Once per distinct set of facts, so a re-render does not re-store. */
  #capture(target: Target): void {
    if (this.#captured === target.key) return;
    this.#captured = target.key;
    const { key, memberId, observed } = target;
    this.#captureQueue = this.#captureQueue.then(() =>
      this.client.captureSnapshot(memberId, observed).catch(() => {
        // A failed cache write loses nothing the page still shows. Retry
        // only if no newer reading has been queued since.
        if (this.#captured === key) this.#captured = "";
      }),
    );
  }

  #load(target: Target): void {
    if (this.#inFlight === target.key) return;
    this.#inFlight = target.key;
    const generation = this.#generation;
    const done = (data: PanelData) => {
      if (generation !== this.#generation) return;
      this.#inFlight = undefined;
      this.#data.set(target.key, data);
      this.update(target.page);
    };
    this.client
      .evaluate([{ memberId: target.memberId, observed: target.observed }])
      .then(async (response) => {
        const result =
          response.status === "ok" ? response.results[0] : undefined;
        if (result) return done({ kind: "triage", result });
        done({
          kind: "trust-only",
          rule: response.status,
          trust: await this.client.getTrust(target.memberId, target.observed),
        });
      })
      .catch(() => {
        if (generation !== this.#generation) return;
        // Fail closed for the panel: without an answer, show nothing.
        this.#inFlight = undefined;
        this.teardown();
      });
  }

  #render(target: Target, data: PanelData): void {
    const key = JSON.stringify([target.key, data, this.#error]);
    const existing = this.document.querySelector(
      `[${UI_ATTRIBUTE}="member-panel"]`,
    );
    if (
      existing &&
      key === this.#rendered &&
      existing.previousElementSibling === target.anchor
    )
      return;
    if (data.kind === "trust-only" && data.trust.status === "no-account") {
      this.teardown();
      return;
    }
    existing?.remove();
    this.#rendered = key;
    const panel = element(this.document, "section", "joyfox-panel");
    panel.setAttribute(UI_ATTRIBUTE, "member-panel");
    panel.setAttribute("aria-label", "JoyFox");
    panel.append(
      element(this.document, "h2", "joyfox-panel__heading", "JoyFox"),
    );
    const memberId = target.memberId;
    const trustActions = {
      onTrust: (kind: "positive" | "negative" | "neutral") =>
        this.#write(() => this.client.logTrust(memberId, kind)),
      onUndoTrust: () => this.#write(() => this.client.undoTrust(memberId)),
    };
    if (data.kind === "triage")
      panel.append(
        explanation(this.document, data.result, {
          onOverride: (placement) =>
            this.#write(() => this.client.setOverride(memberId, placement)),
          ...trustActions,
        }),
      );
    else {
      const off = element(
        this.document,
        "p",
        "",
        RULE_OFF_TEXT[data.rule] ?? "JoyFox does not place this sender.",
      );
      panel.append(
        off,
        button(this.document, "joyfox-button", "Open JoyFox options", () => {
          void this.client.openOptions().catch(() => undefined);
        }),
      );
      if (data.trust.status === "ok")
        panel.append(
          trustSection(this.document, data.trust.trust, trustActions),
        );
    }
    if (this.#error)
      panel.append(element(this.document, "p", "joyfox-error", this.#error));
    target.anchor.after(panel);
  }

  /**
   * Run a write, then reload at once. The background also bumps the triage
   * revision, which other tabs hear through `storage.onChanged`.
   */
  #write(action: () => Promise<void>): void {
    this.#error = undefined;
    void action()
      .then(() => this.invalidate())
      .catch(() => {
        this.#error = "JoyFox could not save that change. Nothing was changed.";
        this.#rendered = "";
        if (this.#page) this.update(this.#page);
      });
  }
}
