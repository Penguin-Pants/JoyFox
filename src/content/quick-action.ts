import { QUICK_ACTION_KEY } from "../actions/quick-action-setting";
import {
  runQuickDelete,
  runQuickIgnoreDelete,
  type ActionRecorder,
  type QuickActionDriver,
} from "../actions/executor";
import {
  QUICK_DELETE,
  QUICK_IGNORE_DELETE,
  STEP_TIMEOUT_MS,
  type ActionFailure,
  type ActionState,
  type ActionStep,
  type ActionTarget,
  type OperationReport,
  type QuickAction,
} from "../actions/ignore-delete";
import { message, type Message } from "../i18n/message";
import { t } from "../i18n/translator";
import type {
  ExtensionMessage,
  ExtensionResponse,
  MessageContract,
} from "../messaging/protocol";
import { request, type MessageSender } from "../messaging/request";
import { selectorRegistry } from "../selectors/registry";
import { pageMember, type ConversationTrash } from "./member-panel";
import { JoyClubQuickActionDriver } from "./quick-action-driver";
import { isPlaced, placeInStrip, removeEmptyStrip } from "./member-strip";
import { button, element, UI_ATTRIBUTE } from "./triage-ui";

/** Re-exported for the content script's other parts. */
export { QUICK_ACTION_KEY };

/** Marks the M9 section: the Delete and Ignore and Delete buttons. */
export const QUICK_ACTION = "quick-action";

export type LatestAnswer =
  MessageContract["action.ignoreDelete.latest"]["response"];

export type PendingAnswer =
  MessageContract["action.ignoreDelete.pending"]["response"];

export type WithdrawAnswer =
  MessageContract["action.ignoreDelete.withdraw"]["response"];

export interface QuickActionClient {
  latest(memberId: string): Promise<LatestAnswer>;
  /** Stores transitions under the account the page's data came from. */
  recorder(accountId: string): ActionRecorder;
  /** Store this tab's hand-off marker; resolves only once it is stored. */
  handOff(
    accountId: string,
    operationId: string,
    next: ActionStep,
    profilePath: string,
  ): Promise<void>;
  /** This tab's hand-off marker, read once. */
  pending(): Promise<PendingAnswer>;
  /** Remove this tab's marker for the run, if it is still there. */
  withdraw(accountId: string, operationId: string): Promise<WithdrawAnswer>;
  /** This page loaded: drop a marker that waits for another page. */
  dropStale(): Promise<unknown>;
}

export function messageQuickActionClient(
  sender: MessageSender,
): QuickActionClient {
  return {
    latest: (memberId) =>
      request(sender, "action.ignoreDelete.latest", { memberId }),
    handOff: async (accountId, operationId, next, profilePath) => {
      const answer = await request(sender, "action.ignoreDelete.handOff", {
        accountId,
        operationId,
        next,
        profilePath,
      });
      if (answer.status !== "stored")
        throw new Error("The hand-off was refused");
    },
    pending: () => request(sender, "action.ignoreDelete.pending", {}),
    dropStale: () => request(sender, "action.ignoreDelete.dropStale", {}),
    withdraw: (accountId, operationId) =>
      request(sender, "action.ignoreDelete.withdraw", {
        accountId,
        operationId,
      }),
    recorder: (accountId) => ({
      begin: (target, deadline, action) =>
        request(sender, "action.ignoreDelete.start", {
          accountId,
          ...target,
          ...(deadline !== undefined ? { deadline } : {}),
          ...(action !== undefined ? { action } : {}),
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
 * The live JoyClub driver (ADR 0011), built from the F7 evidence. Delete
 * shows on every conversation page (ADR 0017); Ignore and Delete only while
 * its experimental flag is on.
 */
export function liveQuickActionDriver(): QuickActionDriver | undefined {
  return new JoyClubQuickActionDriver(document);
}

const PROGRESS_TEXT: Partial<Record<ActionState, Message>> = {
  Started: message("quick.progress.Started"),
  DeleteRequested: message("quick.progress.DeleteRequested"),
  DeleteConfirmed: message("quick.progress.DeleteConfirmed"),
  IgnoreRequested: message("quick.progress.IgnoreRequested"),
};

/** A Delete-only run's progress never names Ignore and Delete (A10). */
const DELETE_PROGRESS_TEXT: Partial<Record<ActionState, Message>> = {
  Started: message("quick.delete.progress.Started"),
  DeleteRequested: message("quick.progress.DeleteRequested"),
};

/** How long a resumed run waits for the profile menu before it tries. */
export const RESUME_WAIT_MS = 10_000;

/**
 * How long the conversation page waits to be replaced by the profile after
 * a hand-off. The move counts as one more step, so it has the step timeout.
 * A page still here after that was not left (the navigation was cancelled
 * or never finished), and it withdraws the hand-off.
 */
export const HANDOFF_WAIT_MS = STEP_TIMEOUT_MS;

/**
 * How long a finished run's notice shows before the page returns to the
 * ClubMail list (the profile page after Ignore and Delete, the conversation
 * page after Delete, D5), so the user can read it and the live region can
 * announce it.
 */
export const RETURN_WAIT_MS = 2_000;

/** The ClubMail list (`01-inbox.md`), where a finished run returns to. */
export const CLUBMAIL_PATH = "/clubmail/";

/** The notice's own lines, as catalog messages translated when shown. */
export const QUICK_ACTION_TEXT = {
  button: message("quick.button"),
  scope: message("quick.scope"),
  deleteButton: message("quick.delete.button"),
  deleteScope: message("quick.delete.scope"),
  needsList: message("quick.needsList"),
  handedOff: message("quick.progress.DeleteConfirmed"),
  noProfile: message("quick.noProfile"),
  resumed: message("quick.resumed"),
  waitingMenu: message("quick.waitingMenu"),
  previous: message("quick.previous"),
  previousOther: message("quick.previousOther"),
  otherResult: message("quick.otherResult"),
  otherRunning: message("quick.otherRunning"),
  busy: message("quick.busy"),
  unexpected: message("quick.unexpected"),
  deleteUnexpected: message("quick.delete.unexpected"),
  junkDone: message("quick.junk.done"),
  junkBusy: message("quick.junk.busy"),
  junkNotTrashed: message("quick.junk.notTrashed"),
} as const;

/** The labels of a stored run's notice, per action (A9). */
const PREVIOUS_TEXT: Record<
  QuickAction,
  { previous: Message; previousOther: Message; otherResult: Message }
> = {
  [QUICK_IGNORE_DELETE]: {
    previous: QUICK_ACTION_TEXT.previous,
    previousOther: QUICK_ACTION_TEXT.previousOther,
    otherResult: QUICK_ACTION_TEXT.otherResult,
  },
  [QUICK_DELETE]: {
    previous: message("quick.delete.previous"),
    previousOther: message("quick.delete.previousOther"),
    otherResult: message("quick.delete.otherResult"),
  },
};

/** The hand-off this profile page resumes, once read (one-shot). */
interface ResumeState {
  answer: PendingAnswer;
  since: number;
  started: boolean;
  /** Set once: page mutations call `updateProfile` often. */
  timer?: ReturnType<typeof setTimeout>;
}

interface Shown {
  key: string;
  target: ActionTarget;
  anchor: Element;
}

/** The section on screen, kept across updates so its live region stays. */
interface Drawn {
  key: string;
  /** Whether it holds "Ignore and Delete" (its flag was on when drawn). */
  withIgnore: boolean;
  section: HTMLElement;
  /** Delete first, then Ignore and Delete when its flag is on. */
  buttons: Array<{
    action: QuickAction;
    button: HTMLButtonElement;
    /** What the click does; the button's description. */
    scope: HTMLElement;
  }>;
  /** Shown while the page cannot show Delete's result. */
  hint: HTMLElement;
  status: HTMLElement;
  lines: string;
}

/** Makes each section's element IDs unique on the page. */
let sectionIds = 0;

/**
 * M9: the "Delete" and "Ignore and Delete" buttons and their notice on a
 * conversation page (PRD Section 6.1, ADR 0017). Delete shows on every
 * conversation page; Ignore and Delete only while its experimental flag is
 * on. The click is the confirmation (Mode A). The steps run through
 * `runQuickDelete` and `runQuickIgnoreDelete`, which record every
 * transition in the background's ActionLog before they move on. The notice
 * is built from those steps and names what was done, what was not and the
 * next manual action (PRD Section 21.2). A failed or interrupted earlier
 * run for the member is shown from the stored ActionLog. Only one run goes
 * at a time: while one runs, both buttons wait. "Mark as junk" runs the
 * same Delete flow through `junk` (C5).
 *
 * A run belongs to the conversation it started on. Its progress and result
 * stay tied to that conversation, and are still shown, labelled, on another
 * conversation page, so a partial result is never lost from view.
 */
export class QuickIgnoreDelete implements ConversationTrash {
  #shown?: Shown;
  #latest?: { key: string; answer: LatestAnswer };
  #inFlight?: string;
  #generation = 0;
  #drawn?: Drawn;
  #running?: {
    key: string;
    action: QuickAction;
    progress: Message;
    /** Lines shown above the progress: what "Mark as junk" did first. */
    lead?: readonly Message[];
  };
  #result?: { key: string; action: QuickAction; lines: readonly Message[] };
  /** Whether "Ignore and Delete" is on (its experimental flag). */
  #ignoreDeleteOn = true;
  /** Set when the run must stop before its next click. */
  #stop?: ActionFailure;
  #busy = false;
  #staleTimer?: ReturnType<typeof setTimeout>;
  /** The answer the stale timer was set for; a redraw keeps that timer. */
  #staleFor?: LatestAnswer;

  /** The hand-off this profile page resumes, once read (one-shot). */
  #resume?: ResumeState;
  #discarded = false;
  /** Set once this page has asked to drop a hand-off meant for another. */
  #pageSeen = false;
  /** Failed reads of the hand-off marker on this page; retried a few times. */
  #pendingFailures = 0;
  #profileDrawn?: { section: HTMLElement; status: HTMLElement; lines: string };
  #profileAnchor?: Element;
  /** Set while a finished run waits to return to the ClubMail list. */
  #returnTimer?: ReturnType<typeof setTimeout>;
  /** The same, for a finished Delete on the conversation page. */
  #deleteReturnTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly document: Document,
    private readonly client: QuickActionClient,
    private readonly driver: () => QuickActionDriver | undefined,
    private readonly navigate: (url: string) => void = (url) =>
      document.defaultView?.location.assign(url),
    private readonly clock: () => number = () => Date.now(),
    private readonly handOffWaitMs: number = HANDOFF_WAIT_MS,
    private readonly returnWaitMs: number = RETURN_WAIT_MS,
  ) {}

  /**
   * On a profile page: continue a run this tab handed off from a
   * conversation (Path B, ADR 0011). The marker is read once per page; the
   * run starts once JoyClub's profile menu is there, or after
   * `RESUME_WAIT_MS`, when it stops with a clear reason if it is not.
   */
  updateProfile(): void {
    // Arriving from a conversation in place: its button goes, once.
    if (this.#shown) this.leave();
    const member = pageMember(this.document, "profile");
    if (!member) {
      // The profile may still be loading; the read answer is kept.
      this.#removeProfileSection();
      return;
    }
    if (!this.#resume) {
      if (!this.driver()) return;
      // Read once per page load: the hand-off always loads a new page.
      const resume: ResumeState = {
        answer: { status: "none" },
        since: this.clock(),
        started: false,
      };
      this.#resume = resume;
      this.client
        .pending()
        .then((answer) => {
          resume.answer = answer;
          if (this.#resume === resume) this.updateProfile();
        })
        .catch(() => {
          // The background may be restarting: ask again on a later page
          // event, a few times, while the marker is still valid.
          if (this.#resume !== resume || this.#pendingFailures >= 3) return;
          this.#pendingFailures += 1;
          this.#resume = undefined;
          setTimeout(() => this.updateProfile(), 500);
        });
      return;
    }
    const resume = this.#resume;
    const answer = resume.answer;
    if (answer.status === "stopped" && !resume.started) {
      // Shown once, from the stored steps: Delete done, Ignore not.
      resume.started = true;
      this.#result = {
        key: "stopped",
        action: QUICK_IGNORE_DELETE,
        lines: answer.lines,
      };
    }
    if (answer.status !== "ok") {
      this.#renderProfile(member.anchor);
      return;
    }
    const driver = this.driver();
    if (!resume.started && driver && !this.#running) {
      const waited = this.clock() - resume.since;
      if (answer.memberId !== member.memberId) {
        // Another member's profile: this page never continues the run.
        resume.started = true;
      } else if (
        safely(() => driver.hasControl("ignore")) ||
        waited > RESUME_WAIT_MS
      ) {
        resume.started = true;
        this.#resumeRun(answer, driver);
      } else if (!resume.timer) {
        // Nothing may change on the page; check again once the wait is over.
        resume.timer = setTimeout(
          () => this.updateProfile(),
          RESUME_WAIT_MS - waited + 50,
        );
      }
    }
    this.#renderProfile(member.anchor);
  }

  #resumeRun(
    answer: Extract<PendingAnswer, { status: "ok" }>,
    driver: QuickActionDriver,
  ): void {
    const key = `${answer.memberId}|${answer.conversationId}`;
    // Shown under the "continued" line, until the first step moves.
    this.#running = {
      key,
      action: QUICK_IGNORE_DELETE,
      progress: PROGRESS_TEXT.Started!,
    };
    this.#stop = undefined;
    this.#result = undefined;
    void runQuickIgnoreDelete({
      target: {
        memberId: answer.memberId,
        conversationId: answer.conversationId,
      },
      driver,
      recorder: this.client.recorder(answer.accountId),
      stopReason: () => this.#stop,
      resume: {
        operationId: answer.operationId,
        from: answer.next,
        steps: answer.steps,
      },
      onState: (state) => {
        const text = PROGRESS_TEXT[state];
        if (!text || !this.#running) return;
        this.#running = { ...this.#running, progress: text };
        this.updateProfile();
      },
    })
      .then((result) => {
        this.#result = {
          key,
          action: QUICK_IGNORE_DELETE,
          lines: result.report.lines,
        };
        // Both steps are done: back to the ClubMail list. A run that stopped
        // stays on the profile, where its notice names the next manual step.
        // Not when the flag was turned off or the account changed while the
        // end was stored: `turnOff` had no timer to clear yet.
        if (result.report.status === "completed" && !this.#stop)
          this.#returnToClubMail(answer.memberId);
      })
      .catch(() => {
        this.#result = {
          key,
          action: QUICK_IGNORE_DELETE,
          lines: [QUICK_ACTION_TEXT.unexpected],
        };
      })
      .finally(() => {
        this.#running = undefined;
        if (this.#stop === "turned-off") this.#result = undefined;
        // Only while no conversation is shown: never tear down its button.
        if (!this.#shown) this.updateProfile();
      });
  }

  /**
   * After `returnWaitMs`, go to the ClubMail list, but only while the page
   * still shows the run's member's profile and the flag is on: a user who
   * moved on in the meantime is not taken back.
   */
  #returnToClubMail(memberId: string): void {
    clearTimeout(this.#returnTimer);
    this.#returnTimer = setTimeout(() => {
      this.#returnTimer = undefined;
      if (pageMember(this.document, "profile")?.memberId !== memberId) return;
      this.navigate(new URL(CLUBMAIL_PATH, this.document.URL).href);
    }, this.returnWaitMs);
  }

  /** A return still waiting is dropped: the flag is off or the account changed. */
  #cancelReturn(): void {
    clearTimeout(this.#returnTimer);
    this.#returnTimer = undefined;
  }

  /**
   * After a completed Delete, the conversation stays open on JoyClub
   * (`10-ignore.md`). After `returnWaitMs`, go to the ClubMail list (D5),
   * but only while the page still shows that conversation: a user who
   * moved on in the meantime is not taken back.
   */
  #returnFromConversation(target: ActionTarget): void {
    clearTimeout(this.#deleteReturnTimer);
    this.#deleteReturnTimer = setTimeout(() => {
      this.#deleteReturnTimer = undefined;
      const member = pageMember(this.document, "conversation");
      const conversation =
        member?.page === "conversation"
          ? member.extraction.conversationId
          : undefined;
      if (
        member?.memberId !== target.memberId ||
        conversation?.status !== "found" ||
        conversation.value !== target.conversationId
      )
        return;
      this.navigate(new URL(CLUBMAIL_PATH, this.document.URL).href);
    }, this.returnWaitMs);
  }

  /**
   * The language changed: the button, its note and the notice are drawn
   * again. A run in progress is not touched.
   */
  localeChanged(): void {
    if (this.#drawn) {
      const focused = this.#focusedAction(this.#drawn);
      this.teardown();
      if (this.#shown) this.update();
      if (focused) this.#focusButton(focused);
    }
    if (this.#profileDrawn) {
      this.#removeProfileSection();
      this.#renderProfile(this.#profileAnchor);
    }
  }

  /**
   * The profile page shows only a resumed run's progress and result, and
   * while the run waits for JoyClub's profile menu, that it waits.
   */
  #renderProfile(anchor: Element | undefined): void {
    this.#profileAnchor = anchor;
    const resume = this.#resume;
    const waiting =
      resume?.answer.status === "ok" && !resume.started && !this.#running;
    const lines = this.#running
      ? [QUICK_ACTION_TEXT.resumed, this.#running.progress]
      : this.#result
        ? [QUICK_ACTION_TEXT.resumed, ...this.#result.lines]
        : waiting
          ? [QUICK_ACTION_TEXT.resumed, QUICK_ACTION_TEXT.waitingMenu]
          : [];
    if (!anchor || lines.length === 0) {
      this.#removeProfileSection();
      return;
    }
    let drawn = this.#profileDrawn;
    if (
      !drawn ||
      !drawn.section.isConnected ||
      !isPlaced(drawn.section, anchor)
    ) {
      this.#removeProfileSection();
      const section = element(this.document, "section", "joyfox-panel");
      section.setAttribute(UI_ATTRIBUTE, QUICK_ACTION);
      // A group inside the strip's one "JoyFox" region, not a landmark.
      section.setAttribute("role", "group");
      section.setAttribute("aria-label", t("quick.region"));
      const status = element(
        this.document,
        "div",
        "joyfox-quick-action__status",
      );
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      section.append(status);
      placeInStrip(this.document, anchor, section);
      drawn = { section, status, lines: "" };
      this.#profileDrawn = drawn;
    }
    const text = JSON.stringify(lines);
    if (drawn.lines === text) return;
    drawn.lines = text;
    const list = element(this.document, "ul", "joyfox-explain__list");
    for (const line of lines)
      list.append(element(this.document, "li", "", t(line)));
    drawn.status.replaceChildren(list);
  }

  #removeProfileSection(): void {
    if (!this.#profileDrawn) return;
    this.#profileDrawn.section.remove();
    removeEmptyStrip(this.document);
    this.#profileDrawn = undefined;
  }

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
    this.#cancelReturn();
    clearTimeout(this.#deleteReturnTimer);
    this.#deleteReturnTimer = undefined;
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
    // A hand-off read on this page stays: the profile may briefly read as
    // another page type while it loads. Its section is drawn again later.
    this.#profileDrawn = undefined;
    this.teardown();
  }

  /**
   * Called on every page event while the flag is on; acts once per page
   * load. A hand-off waits in this tab only for the profile it names, and
   * the move there always loads a new page. So a page that loads anywhere
   * else in the tab shows the move did not happen, and the background
   * drops the marker (ADR 0011). The background compares the address the
   * browser reports, so a profile still loading keeps its own marker.
   */
  pageSeen(): void {
    if (this.#pageSeen || !this.driver()) return;
    this.#pageSeen = true;
    this.client.dropStale().catch(() => undefined);
  }

  /** The experimental flag is on: "Ignore and Delete" shows again. */
  turnOn(): void {
    this.#ignoreDeleteOn = true;
  }

  /**
   * The experimental flag is off (D2): "Ignore and Delete" goes, and a run
   * of it stops before its next click. Delete stays: it does not need the
   * flag. Called on every page event while the flag is off; the caller
   * then updates or leaves the page as usual.
   */
  turnOff(): void {
    this.#ignoreDeleteOn = false;
    if (this.#running?.action === QUICK_IGNORE_DELETE)
      this.#stop = "turned-off";
    if (this.#result?.action === QUICK_IGNORE_DELETE) this.#result = undefined;
    this.#cancelReturn();
    this.#discardHandOff();
    // A profile page shows only a resumed Ignore and Delete: it goes.
    this.#removeProfileSection();
  }

  /**
   * With the flag off, a hand-off waiting for this tab must never run later,
   * when the flag is turned on again: read it once (which removes it) and
   * close its run as turned off. Once per page load, as `turnOff` runs on
   * every page event while the flag is off.
   */
  #discardHandOff(): void {
    // Only a profile page can hold this tab's hand-off (the background
    // checks the page), so other pages never ask.
    if (this.#discarded || !pageMember(this.document, "profile")) return;
    this.#discarded = true;
    // A marker this page already read (the background removed it) and has
    // not run yet is closed from what was read.
    const read = this.#resume;
    if (read && !read.started) {
      read.started = true;
      clearTimeout(read.timer);
      const answer = read.answer;
      if (answer.status === "ok")
        void this.client
          .recorder(answer.accountId)
          .record(answer.operationId, "Failed", "turned-off")
          .catch(() => undefined);
    }
    this.client
      .pending()
      .then(async (answer) => {
        if (answer.status !== "ok") return;
        await this.client
          .recorder(answer.accountId)
          .record(answer.operationId, "Failed", "turned-off");
      })
      .catch(() => undefined);
  }

  teardown(): void {
    this.#clearStaleTimer();
    for (const node of Array.from(
      this.document.querySelectorAll(`[${UI_ATTRIBUTE}="${QUICK_ACTION}"]`),
    ))
      node.remove();
    removeEmptyStrip(this.document);
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

  #clearStaleTimer(): void {
    clearTimeout(this.#staleTimer);
    this.#staleTimer = undefined;
    this.#staleFor = undefined;
  }

  #lines(
    shown: Shown,
    previous?: { action: QuickAction; report: OperationReport },
    previousHere = true,
  ): readonly Message[] {
    const running = this.#running;
    if (running)
      return running.key === shown.key
        ? [...(running.lead ?? []), running.progress]
        : [QUICK_ACTION_TEXT.otherRunning];
    const result = this.#result;
    if (result)
      return result.key === shown.key
        ? result.lines
        : [PREVIOUS_TEXT[result.action].otherResult, ...result.lines];
    if (!previous) return [];
    // The stored run may be for another conversation with the same member;
    // its next steps then name that conversation, not this one.
    const labels = PREVIOUS_TEXT[previous.action];
    return [
      previousHere ? labels.previous : labels.previousOther,
      ...previous.report.lines,
    ];
  }

  #render(shown: Shown, latest: LatestAnswer): void {
    if (latest.status === "no-account") {
      this.teardown();
      return;
    }
    const previous =
      latest.status === "ok" && latest.report.status !== "completed"
        ? { action: latest.action, report: latest.report }
        : undefined;
    // Busy while any run in this tab, or another tab's run for the member,
    // is going: only one trash run at a time (A8).
    const otherTab = previous?.report.status === "running" && !this.#running;
    this.#busy = this.#running !== undefined || otherTab;
    let drawn = this.#drawn;
    if (
      !drawn ||
      drawn.key !== shown.key ||
      drawn.withIgnore !== this.#ignoreDeleteOn ||
      !drawn.section.isConnected ||
      !isPlaced(drawn.section, shown.anchor)
    ) {
      const focused = drawn ? this.#focusedAction(drawn) : undefined;
      this.teardown();
      drawn = this.#build(shown, latest.accountId);
      placeInStrip(this.document, shown.anchor, drawn.section);
      this.#drawn = drawn;
      if (focused) this.#focusButton(focused);
    }
    // Delete is checked in the ClubMail list beside the conversation. While
    // the page does not show the member's row there, both buttons are
    // unavailable (owner decision, 2026-09-29) and a line under them says
    // why. The line stays hidden while a run goes (its own Delete removes
    // the row), and once this conversation is in the trash.
    const deleted =
      latest.status === "ok" &&
      latest.conversationId === shown.target.conversationId &&
      latest.report.delete === "done";
    const unverifiable = !canVerifyDelete(this.driver());
    const needsList = !this.#busy && !deleted && unverifiable;
    // `aria-disabled` rather than `disabled`, so keyboard focus stays on the
    // button; the click is ignored while it is set.
    const unavailable = this.#busy || unverifiable;
    for (const item of drawn.buttons) {
      item.button.setAttribute("aria-disabled", String(unavailable));
      const describedBy = needsList
        ? `${drawn.hint.id} ${item.scope.id}`
        : item.scope.id;
      if (item.button.getAttribute("aria-describedby") !== describedBy)
        item.button.setAttribute("aria-describedby", describedBy);
    }
    if (drawn.hint.hidden === needsList) drawn.hint.hidden = !needsList;
    // Updated in place, so the live region announces each change.
    const lines = this.#lines(
      shown,
      previous,
      latest.status === "ok" &&
        latest.conversationId === shown.target.conversationId,
    );
    const text = JSON.stringify(lines);
    if (drawn.lines !== text) {
      drawn.lines = text;
      if (lines.length === 0) drawn.status.replaceChildren();
      else {
        const list = element(this.document, "ul", "joyfox-explain__list");
        for (const line of lines)
          list.append(element(this.document, "li", "", t(line)));
        drawn.status.replaceChildren(list);
      }
    }
    // Another tab's run that stops moving becomes interrupted with no event,
    // so read the log again once it would count as stale. The timer is set
    // once per answer, from when the run last moved: page mutations redraw
    // often and must not keep postponing it.
    if (!otherTab || latest.status !== "ok") this.#clearStaleTimer();
    else if (this.#staleFor !== latest) {
      this.#clearStaleTimer();
      const moved = Date.parse(latest.updatedAt);
      const limit = latest.staleAfterMs;
      const left = Number.isFinite(moved)
        ? limit - (Date.now() - moved)
        : limit;
      this.#staleFor = latest;
      this.#staleTimer = setTimeout(
        () => this.invalidate(),
        Math.max(left, 0) + 1000,
      );
    }
  }

  /** The action of the button that has keyboard focus, if any. */
  #focusedAction(drawn: Drawn): QuickAction | undefined {
    return drawn.buttons.find(
      (item) => item.button === this.document.activeElement,
    )?.action;
  }

  /** Focus the same button after a redraw, or Delete when it is gone. */
  #focusButton(action: QuickAction): void {
    const buttons = this.#drawn?.buttons ?? [];
    (
      buttons.find((item) => item.action === action) ?? buttons[0]
    )?.button.focus({ preventScroll: true });
  }

  #build(shown: Shown, accountId: string): Drawn {
    const document = this.document;
    const section = element(document, "section", "joyfox-panel");
    section.setAttribute(UI_ATTRIBUTE, QUICK_ACTION);
    section.setAttribute("data-member", shown.target.memberId);
    // A group inside the strip's one "JoyFox" region, not a landmark.
    section.setAttribute("role", "group");
    section.setAttribute("aria-label", t("quick.region"));
    const id = (sectionIds += 1);
    const row = element(document, "div", "joyfox-actions");
    const scopes: HTMLElement[] = [];
    const buttons: Drawn["buttons"] = [];
    const add = (
      action: QuickAction,
      label: Message,
      description: Message,
      onClick: () => void,
    ) => {
      const run = button(document, "joyfox-button", t(label), () => {
        if (!this.#busy) onClick();
      });
      run.dataset.action = action;
      const scope = element(document, "p", "joyfox-note", t(description));
      scope.id = `joyfox-quick-scope-${id}-${action}`;
      // The click is the confirmation, so the button carries what it does.
      run.setAttribute("aria-describedby", scope.id);
      row.append(run);
      scopes.push(scope);
      buttons.push({ action, button: run, scope });
    };
    add(
      QUICK_DELETE,
      QUICK_ACTION_TEXT.deleteButton,
      QUICK_ACTION_TEXT.deleteScope,
      () => void this.#runDelete(shown, accountId),
    );
    if (this.#ignoreDeleteOn)
      add(
        QUICK_IGNORE_DELETE,
        QUICK_ACTION_TEXT.button,
        QUICK_ACTION_TEXT.scope,
        () => this.#run(shown, accountId),
      );
    const hint = element(
      document,
      "p",
      "joyfox-note joyfox-quick-action__hint",
      t(QUICK_ACTION_TEXT.needsList),
    );
    hint.id = `joyfox-quick-hint-${id}`;
    hint.hidden = true;
    const status = element(document, "div", "joyfox-quick-action__status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    section.append(row, hint, ...scopes, status);
    return {
      key: shown.key,
      withIgnore: this.#ignoreDeleteOn,
      section,
      buttons,
      hint,
      status,
      lines: "",
    };
  }

  /**
   * The trash step of "Mark as junk" (C5): the Delete flow for `memberId`'s
   * conversation, shown on this page. The placement and the Negative
   * outcome are already stored, so every notice starts with that line, and
   * a trash step that cannot run says the conversation was not moved and
   * names the manual step (C7). `unavailable`: this page shows no Delete
   * for that member, so nothing was started or shown.
   */
  async junk(memberId: string): Promise<"shown" | "unavailable"> {
    const shown = this.#shown;
    const latest = this.#latest;
    if (
      !shown ||
      shown.target.memberId !== memberId ||
      this.#drawn?.key !== shown.key ||
      latest?.key !== shown.key ||
      latest.answer.status === "no-account"
    )
      return "unavailable";
    const lead = [QUICK_ACTION_TEXT.junkDone];
    const refused = (...lines: Message[]) => {
      this.#result = {
        key: shown.key,
        action: QUICK_DELETE,
        lines: [
          ...lead,
          ...lines,
          QUICK_ACTION_TEXT.junkNotTrashed,
          message("action.self.delete"),
        ],
      };
      this.update();
      return "shown" as const;
    };
    if (this.#busy) return refused(QUICK_ACTION_TEXT.junkBusy);
    if (!canVerifyDelete(this.driver()))
      return refused(QUICK_ACTION_TEXT.needsList);
    await this.#runDelete(shown, latest.answer.accountId, lead);
    return "shown";
  }

  /**
   * Delete alone (A1 to A8): one click moves the conversation to JoyClub's
   * trash, with the checks of Quick Ignore and Delete's Delete step. A
   * completed run returns to the ClubMail list after `returnWaitMs`; a
   * failed one stays, and its notice names the next manual step. `lead`
   * comes first in every notice of the run.
   */
  #runDelete(
    shown: Shown,
    accountId: string,
    lead: readonly Message[] = [],
  ): Promise<void> {
    const driver = this.driver();
    if (this.#running || !driver) return Promise.resolve();
    this.#stop = undefined;
    const busyLines = lead.length
      ? [
          QUICK_ACTION_TEXT.junkBusy,
          QUICK_ACTION_TEXT.junkNotTrashed,
          message("action.self.delete"),
        ]
      : [QUICK_ACTION_TEXT.busy];
    this.#running = {
      key: shown.key,
      action: QUICK_DELETE,
      progress: DELETE_PROGRESS_TEXT.Started!,
      lead,
    };
    this.#result = undefined;
    this.update();
    return runQuickDelete({
      target: shown.target,
      driver,
      recorder: this.client.recorder(accountId),
      // Delete does not need the experimental flag (D2), so turning it off
      // never stops this run.
      stopReason: () => (this.#stop === "turned-off" ? undefined : this.#stop),
      onState: (state) => {
        const text = DELETE_PROGRESS_TEXT[state];
        if (!text || this.#running?.action !== QUICK_DELETE) return;
        this.#running = { ...this.#running, progress: text };
        if (this.#shown) this.update();
      },
    })
      .then((result) => {
        this.#result = {
          key: shown.key,
          action: QUICK_DELETE,
          lines: [
            ...lead,
            ...(result.status === "busy" ? busyLines : result.report.lines),
          ],
        };
        // Not when the account changed while the end was stored.
        if (result.report.status === "completed" && !this.#stop)
          this.#returnFromConversation(shown.target);
      })
      .catch(() => {
        this.#result = {
          key: shown.key,
          action: QUICK_DELETE,
          lines: [...lead, QUICK_ACTION_TEXT.deleteUnexpected],
        };
      })
      .finally(() => {
        this.#running = undefined;
        // Read the ActionLog again, so the notice matches what is stored.
        if (this.#shown) this.invalidate();
      });
  }

  #run(shown: Shown, accountId: string): void {
    const driver = this.driver();
    if (this.#running || !driver) return;
    this.#stop = undefined;
    // Ignore needs the member's profile. Without its address, Delete would
    // be done and Ignore could not follow, so nothing is started.
    const profile = profileUrl(shown.anchor, shown.target.memberId);
    if (!profile) {
      this.#result = {
        key: shown.key,
        action: QUICK_IGNORE_DELETE,
        lines: [QUICK_ACTION_TEXT.noProfile],
      };
      this.update();
      return;
    }
    this.#running = {
      key: shown.key,
      action: QUICK_IGNORE_DELETE,
      progress: PROGRESS_TEXT.Started!,
    };
    this.#result = undefined;
    this.update();
    void runQuickIgnoreDelete({
      target: shown.target,
      driver,
      recorder: this.client.recorder(accountId),
      stopReason: () => this.#stop,
      // Ignore is on the profile page: store the marker; the page moves
      // only once the run returns "handed-off".
      handOff: (operationId, next) =>
        this.client.handOff(
          accountId,
          operationId,
          next,
          new URL(profile).pathname,
        ),
      onState: (state) => {
        const text = PROGRESS_TEXT[state];
        if (!text || this.#running?.action !== QUICK_IGNORE_DELETE) return;
        this.#running = { ...this.#running, progress: text };
        if (this.#shown) this.update();
      },
    })
      .then((result) => {
        if (result.status === "handed-off") {
          this.navigate(profile);
          this.#awaitDeparture(shown.key, accountId, result.operationId);
        }
        this.#result = {
          key: shown.key,
          action: QUICK_IGNORE_DELETE,
          lines:
            result.status === "busy"
              ? [QUICK_ACTION_TEXT.busy]
              : result.status === "handed-off"
                ? [QUICK_ACTION_TEXT.handedOff]
                : result.report.lines,
        };
      })
      .catch(() => {
        this.#result = {
          key: shown.key,
          action: QUICK_IGNORE_DELETE,
          lines: [QUICK_ACTION_TEXT.unexpected],
        };
      })
      .finally(() => {
        this.#running = undefined;
        // A flag turned off during the run keeps its notice away.
        if (this.#stop === "turned-off") this.#result = undefined;
        // Read the ActionLog again, so the notice matches what is stored.
        if (this.#shown) this.invalidate();
      });
  }

  /**
   * The hand-off loads a new page, so this page goes. If it is still here
   * after `handOffWaitMs`, the navigation was cancelled or never finished:
   * the marker is withdrawn, so a later visit to the profile in this tab
   * never continues the run, and the notice shows what the run did.
   */
  #awaitDeparture(
    key: string,
    accountId: string,
    operationId: string | undefined,
  ): void {
    const view = this.document.defaultView;
    if (!operationId || !view) return;
    const timer = setTimeout(() => {
      view.removeEventListener("pagehide", left);
      this.client
        .withdraw(accountId, operationId)
        .then((answer) => {
          if (answer.status === "withdrawn")
            this.#result = {
              key,
              action: QUICK_IGNORE_DELETE,
              lines: answer.lines,
            };
        })
        .catch(() => undefined)
        .finally(() => this.invalidate());
    }, this.handOffWaitMs);
    // Left for the profile (or put in the back-forward cache on the way):
    // the profile page owns the marker now.
    const left = () => clearTimeout(timer);
    view.addEventListener("pagehide", left, { once: true });
  }
}

function safely(check: () => boolean): boolean {
  try {
    return check();
  } catch {
    return false;
  }
}

/**
 * Whether the page can show Delete's result, as the run checks it before
 * Delete. A driver that cannot tell, or fails to, counts as able: the hint
 * is only shown when the check says no.
 */
function canVerifyDelete(driver: QuickActionDriver | undefined): boolean {
  try {
    return driver?.canVerify?.("delete") ?? true;
  } catch {
    return true;
  }
}

/**
 * The sender's profile address, from the conversation header's own link
 * (`02-conversation.md`), and only when it names the run's member on this
 * site. Anything else is refused, so the hand-off never goes elsewhere.
 */
export function profileUrl(
  header: Element,
  memberId: string,
): string | undefined {
  const href = header.getAttribute("href");
  const pattern = selectorRegistry.profile.path;
  if (!href || !pattern) return undefined;
  let url: URL;
  try {
    url = new URL(href, header.ownerDocument.URL);
  } catch {
    return undefined;
  }
  if (url.origin !== new URL(header.ownerDocument.URL).origin) return undefined;
  const match = new RegExp(pattern).exec(url.pathname);
  return match?.[1] === memberId ? url.href : undefined;
}
