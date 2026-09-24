import type { QuickActionDriver } from "../actions/executor";
import type { ActionStep, CurrentTarget } from "../actions/ignore-delete";
import { extractInboxRows } from "../extraction/joyclub";
import { resolveMemberIdentity } from "../identity/member-identity";
import { QUICK_ACTION_SELECTORS as S } from "../selectors/quick-action";
import { verifiedSelector } from "../selectors/registry";
import { inboxListState } from "./inbox-triage";
import { pageMember } from "./member-panel";

export interface DriverTiming {
  /** How long to wait for JoyClub to react. Below the step timeout. */
  waitMs: number;
  pollMs: number;
}

const DEFAULT_TIMING: DriverTiming = { waitMs: 10_000, pollMs: 100 };

/**
 * Click a JoyClub control. Its native `<button>` sits in an open shadow root
 * (`10-ignore.md`); the click there reaches the host's listeners too. Where
 * the shadow root cannot be read, the host itself is clicked.
 */
function press(control: Element): void {
  const inner = control.shadowRoot?.querySelector<HTMLElement>("button");
  (inner ?? (control as HTMLElement)).click();
}

/**
 * M9's live driver for JoyClub (ADR 0011). It only reads the page and clicks
 * the controls the evidence names; the executor decides when, checks
 * identity before every click and records each step first.
 *
 * - Delete: the conversation page's own Delete control, outside the inbox
 *   rows and in the header's row. JoyClub asks for no confirmation. It is
 *   verified by the member's row leaving the conversation list, which the
 *   owner saw happen (`10-ignore.md`); without that list on screen it is
 *   not started.
 * - Ignore: on the profile page, the menu's "Profil ignorieren", then
 *   "Ignorieren" in JoyClub's dialog. Verified by the menu showing "Profil
 *   nicht mehr ignorieren" afterwards.
 */
export class JoyClubQuickActionDriver implements QuickActionDriver {
  #rowsBefore?: number;

  constructor(
    private readonly document: Document,
    private readonly timing: DriverTiming = DEFAULT_TIMING,
  ) {}

  currentTarget(): CurrentTarget {
    const conversation = pageMember(this.document, "conversation");
    if (conversation?.page === "conversation") {
      const id = conversation.extraction.conversationId;
      return {
        page: "conversation",
        memberId: conversation.memberId,
        ...(id.status === "found" ? { conversationId: id.value } : {}),
      };
    }
    const profile = pageMember(this.document, "profile");
    if (profile) return { page: "profile", memberId: profile.memberId };
    return { page: "other" };
  }

  hasControl(step: ActionStep): boolean {
    if (step === "delete") return this.#deleteControl() !== undefined;
    const menu = this.#menu();
    if (!menu?.querySelector(`:scope > ${S.menuActivator}`)) return false;
    // Already ignored: there is no Ignore to click.
    return menu.querySelector(S.ignoredItem) === null;
  }

  canVerify(step: ActionStep): boolean {
    if (step === "ignore") return true;
    return inboxListState(this.document) === "shown" && this.#rows() > 0;
  }

  async request(step: ActionStep): Promise<void> {
    if (step === "delete") {
      const control = this.#deleteControl();
      if (!control) throw new Error("Delete control gone");
      this.#rowsBefore = this.#rows();
      press(control);
      return;
    }
    const menu = this.#menu();
    if (!menu) throw new Error("Profile menu gone");
    const item =
      menu.querySelector(S.ignoreItem) ??
      (await this.#openMenu(menu, () => menu.querySelector(S.ignoreItem)));
    if (!item) throw new Error("Ignore item not found");
    press(item);
  }

  async awaitConfirmation(step: ActionStep) {
    if (step === "delete") return "none" as const;
    const content = await this.#waitFor(() =>
      this.document.querySelector(S.ignoreDialogContent),
    );
    return content ? ("shown" as const) : ("missing" as const);
  }

  async confirm(step: ActionStep): Promise<void> {
    if (step === "delete") return;
    const button = this.document
      .querySelector(S.ignoreDialogContent)
      ?.closest(S.dialogHost)
      ?.querySelector(S.ignoreConfirm);
    if (!button) throw new Error("Ignore confirmation button not found");
    press(button);
  }

  async verify(step: ActionStep): Promise<boolean> {
    if (step === "delete") {
      const before = this.#rowsBefore;
      if (before === undefined) return false;
      return (
        (await this.#waitFor(() => this.#rows() < before || null)) === true
      );
    }
    const menu = this.#menu();
    if (!menu) return false;
    const found = () => menu.querySelector(S.ignoredItem);
    // JoyClub saves first, then updates the menu: wait a little for it.
    if (await this.#waitFor(found, this.timing.waitMs / 2)) return true;
    // The item may render only while the menu is open.
    return (await this.#openMenu(menu, found, true)) !== null;
  }

  #deleteControl(): Element | undefined {
    const header = pageMember(this.document, "conversation")?.anchor;
    const row = header?.parentElement;
    const inboxRow = verifiedSelector("inbox", "row");
    if (!row || !inboxRow) return undefined;
    const controls = Array.from(
      this.document.querySelectorAll(S.deleteControl),
    ).filter((control) => !control.closest(inboxRow));
    // Exactly one, in the header's row: never a row's control, never a guess.
    return controls.length === 1 && row.contains(controls[0]!)
      ? controls[0]
      : undefined;
  }

  /** How many rows in the conversation list are the target member's. */
  #rows(): number {
    const member = this.currentTarget().memberId;
    if (!member) return 0;
    return extractInboxRows(this.document, this.document.URL).filter((row) => {
      const identity = resolveMemberIdentity({
        page: "inbox",
        field: "memberId",
        extraction: row.memberId,
      });
      return identity.status === "resolved" && identity.memberId === member;
    }).length;
  }

  #menu(): Element | null {
    return this.document.querySelector(S.profileMenu);
  }

  /**
   * Open the menu if it is closed and wait for `find`. A menu JoyFox opened
   * is closed again when nothing was found, or when `closeAfter` is set (a
   * read only); otherwise the caller clicks an item, which closes it.
   */
  async #openMenu<T>(
    menu: Element,
    find: () => T | null,
    closeAfter = false,
  ): Promise<T | null> {
    const activator = menu.querySelector(`:scope > ${S.menuActivator}`);
    if (!activator) return null;
    const wasOpen = menu.getAttribute("open") === "true";
    if (!wasOpen) press(activator);
    const result = await this.#waitFor(find);
    if (
      !wasOpen &&
      (result === null || closeAfter) &&
      menu.getAttribute("open") === "true"
    )
      press(activator);
    return result;
  }

  async #waitFor<T>(
    find: () => T | null,
    waitMs = this.timing.waitMs,
  ): Promise<T | null> {
    const deadline = Date.now() + waitMs;
    for (;;) {
      const value = find();
      if (value !== null && value !== undefined && value !== false)
        return value;
      if (Date.now() >= deadline) return null;
      await new Promise((resolve) => setTimeout(resolve, this.timing.pollMs));
    }
  }
}
