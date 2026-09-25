import {
  runQuickIgnoreDelete,
  type ActionRecorder,
  type QuickActionDriver,
} from "../actions/executor";
import {
  STALE_AFTER_MS,
  STEP_TIMEOUT_MS,
  type ActionFailure,
  type ActionState,
  type ActionStep,
  type ActionTarget,
  type OperationReport,
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
import { pageMember } from "./member-panel";
import { JoyClubQuickActionDriver } from "./quick-action-driver";
import { isPlaced, placeInStrip, removeEmptyStrip } from "./member-strip";
import { button, element, UI_ATTRIBUTE } from "./triage-ui";

/**
 * The `storage.local` key for the experimental M9 button. Off unless set to
 * `true` (build plan Section 27: keep M9 behind an experimental flag). When
 * on, the button appears on conversation pages, and a click runs the live
 * driver, which clicks JoyClub's Delete and Ignore (ADR 0011).
 */
export const QUICK_ACTION_KEY = "joyfox.quickIgnoreDelete";

/** Marks the M9 section. */
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
 * The live JoyClub driver (ADR 0011), built from the F7 evidence. The button
 * still appears only while the experimental flag is on.
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

/** How long a resumed run waits for the profile menu before it tries. */
export const RESUME_WAIT_MS = 10_000;

/**
 * How long the conversation page waits to be replaced by the profile after
 * a hand-off. The move counts as one more step, so it has the step timeout.
 * A page still here after that was not left (the navigation was cancelled
 * or never finished), and it withdraws the hand-off.
 */
export const HANDOFF_WAIT_MS = STEP_TIMEOUT_MS;

/** The notice's own lines, as catalog messages translated when shown. */
export const QUICK_ACTION_TEXT = {
  button: message("quick.button"),
  scope: message("quick.scope"),
  handedOff: message("quick.progress.DeleteConfirmed"),
  noProfile: message("quick.noProfile"),
  resumed: message("quick.resumed"),
  previous: message("quick.previous"),
  previousOther: message("quick.previousOther"),
  otherResult: message("quick.otherResult"),
  otherRunning: message("quick.otherRunning"),
  busy: message("quick.busy"),
  unexpected: message("quick.unexpected"),
} as const;

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
  #running?: { key: string; progress: Message };
  #result?: { key: string; lines: readonly Message[] };
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

  constructor(
    private readonly document: Document,
    private readonly client: QuickActionClient,
    private readonly driver: () => QuickActionDriver | undefined,
    private readonly navigate: (url: string) => void = (url) =>
      document.defaultView?.location.assign(url),
    private readonly clock: () => number = () => Date.now(),
    private readonly handOffWaitMs: number = HANDOFF_WAIT_MS,
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
      this.#result = { key: "stopped", lines: answer.lines };
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
    this.#running = { key, progress: QUICK_ACTION_TEXT.resumed };
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
        this.#running = { key, progress: text };
        this.updateProfile();
      },
    })
      .then((result) => {
        this.#result = { key, lines: result.report.lines };
      })
      .catch(() => {
        this.#result = { key, lines: [QUICK_ACTION_TEXT.unexpected] };
      })
      .finally(() => {
        this.#running = undefined;
        if (this.#stop === "turned-off") this.#result = undefined;
        // Only while no conversation is shown: never tear down its button.
        if (!this.#shown) this.updateProfile();
      });
  }

  /**
   * The language changed: the button, its note and the notice are drawn
   * again. A run in progress is not touched.
   */
  localeChanged(): void {
    if (this.#drawn) {
      const focused = this.#drawn.section.contains(this.document.activeElement);
      this.teardown();
      if (this.#shown) this.update();
      if (focused) this.#drawn?.button.focus({ preventScroll: true });
    }
    if (this.#profileDrawn) {
      this.#removeProfileSection();
      this.#renderProfile(this.#profileAnchor);
    }
  }

  /** The profile page shows only a resumed run's progress and result. */
  #renderProfile(anchor: Element | undefined): void {
    this.#profileAnchor = anchor;
    const lines = this.#running
      ? [QUICK_ACTION_TEXT.resumed, this.#running.progress]
      : this.#result
        ? [QUICK_ACTION_TEXT.resumed, ...this.#result.lines]
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

  /** The flag was turned off: stop a run before its next click, show nothing. */
  turnOff(): void {
    if (this.#running) this.#stop = "turned-off";
    this.#result = undefined;
    this.#discardHandOff();
    this.leave();
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
    previous?: OperationReport,
    previousHere = true,
  ): readonly Message[] {
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
    if (!previous) return [];
    // The stored run may be for another conversation with the same member;
    // its next steps then name that conversation, not this one.
    return [
      previousHere
        ? QUICK_ACTION_TEXT.previous
        : QUICK_ACTION_TEXT.previousOther,
      ...previous.lines,
    ];
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
      !isPlaced(drawn.section, shown.anchor)
    ) {
      const focused =
        drawn?.section.contains(this.document.activeElement) === true;
      this.teardown();
      drawn = this.#build(shown, latest.accountId);
      placeInStrip(this.document, shown.anchor, drawn.section);
      this.#drawn = drawn;
      if (focused) drawn.button.focus({ preventScroll: true });
    }
    // `aria-disabled` rather than `disabled`, so keyboard focus stays on the
    // button; the click is ignored while busy.
    drawn.button.setAttribute("aria-disabled", String(this.#busy));
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
      const left = Number.isFinite(moved)
        ? STALE_AFTER_MS - (Date.now() - moved)
        : STALE_AFTER_MS;
      this.#staleFor = latest;
      this.#staleTimer = setTimeout(
        () => this.invalidate(),
        Math.max(left, 0) + 1000,
      );
    }
  }

  #build(shown: Shown, accountId: string): Drawn {
    const document = this.document;
    const section = element(document, "section", "joyfox-panel");
    section.setAttribute(UI_ATTRIBUTE, QUICK_ACTION);
    section.setAttribute("data-member", shown.target.memberId);
    section.setAttribute("aria-label", t("quick.region"));
    const run = button(
      document,
      "joyfox-button",
      t(QUICK_ACTION_TEXT.button),
      () => {
        if (!this.#busy) this.#run(shown, accountId);
      },
    );
    const status = element(document, "div", "joyfox-quick-action__status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    section.append(
      run,
      element(document, "p", "joyfox-note", t(QUICK_ACTION_TEXT.scope)),
      status,
    );
    return { key: shown.key, section, button: run, status, lines: "" };
  }

  #run(shown: Shown, accountId: string): void {
    const driver = this.driver();
    if (this.#running || !driver) return;
    this.#stop = undefined;
    // Ignore needs the member's profile. Without its address, Delete would
    // be done and Ignore could not follow, so nothing is started.
    const profile = profileUrl(shown.anchor, shown.target.memberId);
    if (!profile) {
      this.#result = { key: shown.key, lines: [QUICK_ACTION_TEXT.noProfile] };
      this.update();
      return;
    }
    this.#running = { key: shown.key, progress: PROGRESS_TEXT.Started! };
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
        if (!text || !this.#running) return;
        this.#running = { key: shown.key, progress: text };
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
            this.#result = { key, lines: answer.lines };
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
