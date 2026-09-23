import {
  runQuickIgnoreDelete,
  type ActionRecorder,
  type QuickActionDriver,
} from "../actions/executor";
import {
  STALE_AFTER_MS,
  type ActionFailure,
  type ActionState,
  type ActionTarget,
  type OperationReport,
} from "../actions/ignore-delete";
import type {
  ExtensionMessage,
  ExtensionResponse,
  MessageContract,
} from "../messaging/protocol";
import { request, type MessageSender } from "../messaging/request";
import { MEMBER_NOTES } from "./member-notes";
import { MEMBER_PANEL, pageMember } from "./member-panel";
import { button, element, UI_ATTRIBUTE } from "./triage-ui";

/**
 * The `storage.local` key for the experimental M9 button. Off unless set to
 * `true` (build plan Section 27: keep M9 behind an experimental flag). Even
 * when on, the button appears only with a live driver, and none exists yet.
 */
export const QUICK_ACTION_KEY = "joyfox.quickIgnoreDelete";

/** Marks the M9 section. */
export const QUICK_ACTION = "quick-action";

export type LatestAnswer =
  MessageContract["action.ignoreDelete.latest"]["response"];

export interface QuickActionClient {
  latest(memberId: string): Promise<LatestAnswer>;
  /** Stores transitions under the account the page's data came from. */
  recorder(accountId: string): ActionRecorder;
}

export function messageQuickActionClient(
  sender: MessageSender,
): QuickActionClient {
  return {
    latest: (memberId) =>
      request(sender, "action.ignoreDelete.latest", { memberId }),
    recorder: (accountId) => ({
      begin: (target) =>
        request(sender, "action.ignoreDelete.start", {
          accountId,
          ...target,
        }),
      record: async (operationId, state, failure) =>
        (
          await request(sender, "action.ignoreDelete.record", {
            accountId,
            operationId,
            state,
            ...(failure ? { failure } : {}),
          })
        ).status,
    }),
  };
}

export function runtimeQuickActionClient(): QuickActionClient {
  return messageQuickActionClient(
    (message: ExtensionMessage) =>
      browser.runtime.sendMessage(message) as Promise<ExtensionResponse>,
  );
}

/**
 * The live JoyClub driver. None exists: F7 has not verified where Ignore is,
 * which confirmations JoyClub shows, or how success is visible
 * (`manual-verification-needed.md`, item 7), and the build plan forbids
 * guessing that path. Until the evidence exists this returns `undefined`, so
 * the button never appears, whatever the flag says.
 */
export function liveQuickActionDriver(): QuickActionDriver | undefined {
  return undefined;
}

const PROGRESS_TEXT: Partial<Record<ActionState, string>> = {
  Started: "Ignore and Delete is running. Checking the page.",
  IgnoreRequested: "Ignoring the member on JoyClub.",
  IgnoreConfirmed: "Ignore done. Moving the conversation to the trash.",
  DeleteRequested: "Moving the conversation to the trash.",
};

export const QUICK_ACTION_TEXT = {
  button: "Ignore and Delete",
  scope:
    "Experimental. One click ignores this member on JoyClub and moves this conversation to JoyClub's trash. JoyFox stops at the first problem and tells you what was done. It never sends a message.",
  previous: "Your last Ignore and Delete for this member:",
  otherResult: "Your last Ignore and Delete, for another conversation:",
  otherRunning:
    "Ignore and Delete is still running for another conversation. Wait until it ends.",
  busy: "Another Ignore and Delete for this member is still running, for example in another tab. Nothing was done here.",
  unexpected:
    "Ignore and Delete stopped because of an unexpected error. JoyFox may have completed a step: check the member's profile and the conversation yourself.",
} as const;

const JOYFOX_SECTIONS: readonly string[] = [MEMBER_PANEL, MEMBER_NOTES];

interface Shown {
  key: string;
  target: ActionTarget;
  anchor: Element;
}

/** The section on screen, kept across updates so its live region stays. */
interface Drawn {
  key: string;
  section: HTMLElement;
  button: HTMLButtonElement;
  status: HTMLElement;
  lines: string;
}

/**
 * M9: the "Ignore and Delete" button and its notice on a conversation page
 * (PRD Section 6.1). The click is the confirmation (Mode A). The steps run
 * through `runQuickIgnoreDelete`, which records every transition in the
 * background's ActionLog before it moves on. The notice is built from those
 * steps and names what was done, what was not and the next manual action
 * (PRD Section 21.2). A failed or interrupted earlier run for the member is
 * shown from the stored ActionLog.
 *
 * A run belongs to the conversation it started on. Its progress and result
 * stay tied to that conversation, and are still shown, labelled, on another
 * conversation page, so a partial result is never lost from view.
 */
export class QuickIgnoreDelete {
  #shown?: Shown;
  #latest?: { key: string; answer: LatestAnswer };
  #inFlight?: string;
  #generation = 0;
  #drawn?: Drawn;
  #running?: { key: string; progress: string };
  #result?: { key: string; lines: readonly string[] };
  /** Set when the run must stop before its next click. */
  #stop?: ActionFailure;
  #busy = false;
  #staleTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly document: Document,
    private readonly client: QuickActionClient,
    private readonly driver: () => QuickActionDriver | undefined,
  ) {}

  update(): void {
    const member = this.driver()
      ? pageMember(this.document, "conversation")
      : undefined;
    const conversation =
      member?.page === "conversation"
        ? member.extraction.conversationId
        : undefined;
    if (!member || conversation?.status !== "found") {
      this.teardown();
      return;
    }
    const target = {
      memberId: member.memberId,
      conversationId: conversation.value,
    };
    const key = `${target.memberId}|${target.conversationId}`;
    if (this.#shown?.key !== key) this.teardown();
    this.#shown = { key, target, anchor: member.anchor };
    const latest = this.#latest?.key === key ? this.#latest.answer : undefined;
    if (!latest) {
      this.#load(key, target.memberId);
      return;
    }
    this.#render(this.#shown, latest);
  }

  /** Read the ActionLog again: another tab's run moved, or data changed. */
  invalidate(): void {
    this.#generation += 1;
    this.#latest = undefined;
    this.#inFlight = undefined;
    if (this.#shown) this.update();
  }

  /** The active account changed: a run stops before its next click. */
  accountChanged(): void {
    // A finished run's notice belongs to the previous account's view. A run
    // still going reports what it did on this page when it stops.
    if (this.#running) this.#stop = "account-changed";
    else this.#result = undefined;
    this.teardown();
    this.invalidate();
  }

  /**
   * Called when the page is no longer a conversation. A running operation
   * is not cancelled here: it checks the page's identity before every
   * click, so a route to another page stops it there.
   */
  leave(): void {
    this.#generation += 1;
    this.#inFlight = undefined;
    this.#latest = undefined;
    this.#shown = undefined;
    this.teardown();
  }

  /** The flag was turned off: stop a run before its next click, show nothing. */
  turnOff(): void {
    if (this.#running) this.#stop = "turned-off";
    this.#result = undefined;
    this.leave();
  }

  teardown(): void {
    clearTimeout(this.#staleTimer);
    this.#staleTimer = undefined;
    for (const node of Array.from(
      this.document.querySelectorAll(`[${UI_ATTRIBUTE}="${QUICK_ACTION}"]`),
    ))
      node.remove();
    this.#drawn = undefined;
  }

  #load(key: string, memberId: string): void {
    if (this.#inFlight === key) return;
    this.#inFlight = key;
    const generation = this.#generation;
    this.client
      .latest(memberId)
      .then((answer) => {
        if (generation !== this.#generation) return;
        this.#inFlight = undefined;
        this.#latest = { key, answer };
        this.update();
      })
      .catch(() => {
        if (generation !== this.#generation || this.#inFlight !== key) return;
        // Fail closed: without the ActionLog, offer nothing.
        this.#inFlight = undefined;
        this.teardown();
      });
  }

  /** After the JoyFox sections that follow JoyClub's header, in any order. */
  #insertionPoint(anchor: Element): Element {
    let point = anchor;
    let next = anchor.nextElementSibling;
    while (
      next &&
      JOYFOX_SECTIONS.includes(next.getAttribute(UI_ATTRIBUTE) ?? "")
    ) {
      point = next;
      next = next.nextElementSibling;
    }
    return point;
  }

  #placed(node: Element, anchor: Element): boolean {
    let previous = node.previousElementSibling;
    while (
      previous &&
      previous !== anchor &&
      JOYFOX_SECTIONS.includes(previous.getAttribute(UI_ATTRIBUTE) ?? "")
    )
      previous = previous.previousElementSibling;
    return previous === anchor;
  }

  #lines(shown: Shown, previous?: OperationReport): readonly string[] {
    const running = this.#running;
    if (running)
      return running.key === shown.key
        ? [running.progress]
        : [QUICK_ACTION_TEXT.otherRunning];
    const result = this.#result;
    if (result)
      return result.key === shown.key
        ? result.lines
        : [QUICK_ACTION_TEXT.otherResult, ...result.lines];
    return previous ? [QUICK_ACTION_TEXT.previous, ...previous.lines] : [];
  }

  #render(shown: Shown, latest: LatestAnswer): void {
    if (latest.status === "no-account") {
      this.teardown();
      return;
    }
    const previous =
      latest.status === "ok" && latest.report.status !== "completed"
        ? latest.report
        : undefined;
    // Busy while any run in this tab, or another tab's run for the member,
    // is going.
    const otherTab = previous?.status === "running" && !this.#running;
    this.#busy = this.#running !== undefined || otherTab;
    let drawn = this.#drawn;
    if (
      !drawn ||
      drawn.key !== shown.key ||
      !drawn.section.isConnected ||
      !this.#placed(drawn.section, shown.anchor)
    ) {
      const focused =
        drawn?.section.contains(this.document.activeElement) === true;
      this.teardown();
      drawn = this.#build(shown, latest.accountId);
      this.#insertionPoint(shown.anchor).after(drawn.section);
      this.#drawn = drawn;
      if (focused) drawn.button.focus({ preventScroll: true });
    }
    // `aria-disabled` rather than `disabled`, so keyboard focus stays on the
    // button; the click is ignored while busy.
    drawn.button.setAttribute("aria-disabled", String(this.#busy));
    // Updated in place, so the live region announces each change.
    const lines = this.#lines(shown, previous);
    const text = JSON.stringify(lines);
    if (drawn.lines !== text) {
      drawn.lines = text;
      if (lines.length === 0) drawn.status.replaceChildren();
      else {
        const list = element(this.document, "ul", "joyfox-explain__list");
        for (const line of lines)
          list.append(element(this.document, "li", "", line));
        drawn.status.replaceChildren(list);
      }
    }
    // Another tab's run that stops moving becomes interrupted with no event,
    // so read the log again once it would count as stale.
    clearTimeout(this.#staleTimer);
    this.#staleTimer = otherTab
      ? setTimeout(() => this.invalidate(), STALE_AFTER_MS + 1000)
      : undefined;
  }

  #build(shown: Shown, accountId: string): Drawn {
    const document = this.document;
    const section = element(document, "section", "joyfox-panel");
    section.setAttribute(UI_ATTRIBUTE, QUICK_ACTION);
    section.setAttribute("data-member", shown.target.memberId);
    section.setAttribute("aria-label", "JoyFox Ignore and Delete");
    const run = button(
      document,
      "joyfox-button",
      QUICK_ACTION_TEXT.button,
      () => {
        if (!this.#busy) this.#run(shown, accountId);
      },
    );
    const status = element(document, "div", "joyfox-quick-action__status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    section.append(
      run,
      element(document, "p", "joyfox-note", QUICK_ACTION_TEXT.scope),
      status,
    );
    return { key: shown.key, section, button: run, status, lines: "" };
  }

  #run(shown: Shown, accountId: string): void {
    const driver = this.driver();
    if (this.#running || !driver) return;
    this.#running = { key: shown.key, progress: PROGRESS_TEXT.Started! };
    this.#stop = undefined;
    this.#result = undefined;
    this.update();
    void runQuickIgnoreDelete({
      target: shown.target,
      driver,
      recorder: this.client.recorder(accountId),
      stopReason: () => this.#stop,
      onState: (state) => {
        const text = PROGRESS_TEXT[state];
        if (!text || !this.#running) return;
        this.#running = { key: shown.key, progress: text };
        if (this.#shown) this.update();
      },
    })
      .then((result) => {
        this.#result = {
          key: shown.key,
          lines:
            result.status === "busy"
              ? [QUICK_ACTION_TEXT.busy]
              : result.report.lines,
        };
      })
      .catch(() => {
        this.#result = {
          key: shown.key,
          lines: [QUICK_ACTION_TEXT.unexpected],
        };
      })
      .finally(() => {
        this.#running = undefined;
        // A flag turned off during the run keeps the button away.
        if (this.#stop === "turned-off") this.#result = undefined;
        // Read the ActionLog again, so the notice matches what is stored.
        if (this.#shown) this.invalidate();
      });
  }
}
