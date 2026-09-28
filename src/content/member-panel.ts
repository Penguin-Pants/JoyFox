import { extractConversation, extractProfile } from "../extraction/joyclub";
import type { PlainKey } from "../i18n/catalog/en";
import { message } from "../i18n/message";
import { t } from "../i18n/translator";
import { isOwnProfile, readPreferences } from "../extraction/preferences";
import { resolveMemberIdentity } from "../identity/member-identity";
import type { ProfileFacts } from "../qualification/facts";
import { selectorRegistry } from "../selectors/registry";
import type {
  MemberTriage,
  ProfileCaptureExtras,
  TriageResponse,
  TrustResponse,
} from "../triage/triage-service";
import { rememberFocus, restoreFocus } from "../ui/focus";
import {
  factsKey,
  observedFromConversation,
  observedFromProfile,
} from "./observed-facts";
import type { TriageClient } from "./triage-client";
import {
  isPlaced,
  placeInStrip,
  removeEmptyStrip,
  shownElement,
} from "./member-strip";
import {
  element,
  focusFallbacks,
  memberBar,
  openSections,
  reopenSections,
  UI_ATTRIBUTE,
  unknownProfileFactsText,
} from "./triage-ui";

export type MemberPage = "conversation" | "profile";

/** Marks the member panel, which the note editor is placed after. */
export const MEMBER_PANEL = "member-panel";

export type PageMember = { anchor: Element; memberId: string } & (
  | { page: "conversation"; extraction: ReturnType<typeof extractConversation> }
  | { page: "profile"; extraction: ReturnType<typeof extractProfile> }
);

/**
 * The member a conversation or profile page shows, and the JoyClub element
 * JoyFox UI is placed after. `undefined` unless the member ID resolves
 * through a verified selector: without a stable member ID nothing is shown
 * or stored (build plan Section 12).
 */
export function pageMember(
  document: Document,
  page: MemberPage,
): PageMember | undefined {
  const root = selectorRegistry[page].root;
  const anchor = root ? shownElement(document, root) : null;
  if (!anchor) return undefined;
  const url = document.URL;
  const member =
    page === "conversation"
      ? { page, extraction: extractConversation(document, url) }
      : { page, extraction: extractProfile(document, url) };
  const identity = resolveMemberIdentity({
    page,
    field: "memberId",
    extraction: member.extraction.memberId,
  });
  if (identity.status !== "resolved") return undefined;
  return { ...member, anchor, memberId: identity.memberId } as PageMember;
}

/**
 * `accountId` is the account the answer was computed for; captures and
 * writes name it, so none of them can land in another account.
 */
type PanelData =
  | { kind: "triage"; accountId: string; result: MemberTriage }
  | {
      kind: "trust-only";
      accountId?: string;
      trust: TrustResponse;
      rule: TriageResponse["status"];
    };

interface Target {
  page: MemberPage;
  memberId: string;
  observed: Partial<ProfileFacts>;
  /** V1-2: what a profile page shows beyond the rule facts. */
  extras: ProfileCaptureExtras;
  anchor: Element;
  key: string;
  /** The member's profile page, on a conversation page only. */
  profileUrl?: string;
}

const RULE_OFF_TEXT: Partial<Record<TriageResponse["status"], PlainKey>> = {
  "no-account": "panel.ruleOff.no-account",
  "no-rule": "panel.ruleOff.no-rule",
  "rule-disabled": "panel.ruleOff.rule-disabled",
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
  #writeQueue: Promise<void> = Promise.resolve();
  /**
   * The member whose last write failed. The notice shows only on that
   * member's panel, drawn in the language shown, until the next write, the
   * page is left or the account changes.
   */
  #errorFor?: string;
  /**
   * The member an outcome is being logged for. Until it is stored, further
   * Log clicks are ignored, so a double click logs one outcome.
   */
  #trustPending?: string;
  /** The member whose Undo is being stored; a second click waits for it. */
  #undoPending?: string;
  #page?: MemberPage;
  /** Whether "Why and move" is open; kept across redraws of the bar. */
  #drawerOpen = false;
  /** The member the drawer state belongs to. */
  #drawerMember?: string;

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
    // A client-side route can switch to another member while JoyClub keeps
    // the header element. The old panel's buttons act on the old member, so
    // they go at once rather than when the new answer arrives.
    const shown = this.document.querySelector(
      `[${UI_ATTRIBUTE}="${MEMBER_PANEL}"]`,
    );
    if (shown && shown.getAttribute("data-member") !== target.memberId) {
      this.teardown();
      this.#drawerOpen = false;
    }
    const data = this.#data.get(target.key);
    if (!data) {
      this.#load(target);
      return;
    }
    // Captured only once the account is known from an answer, so a capture
    // is always tied to the account it was read for.
    if (page === "profile" && data.accountId)
      this.#capture(target, data.accountId);
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
    this.#drawerOpen = false;
    this.#captured = "";
    this.#errorFor = undefined;
    this.invalidate();
  }

  /** Called when the page is no longer a conversation or profile. */
  leave(): void {
    this.#page = undefined;
    // A load still pending for the page just left must not bring its panel
    // back when it completes.
    this.#generation += 1;
    this.#inFlight = undefined;
    this.teardown();
    this.#drawerOpen = false;
    this.#errorFor = undefined;
  }

  teardown(): void {
    for (const node of Array.from(
      this.document.querySelectorAll(`[${UI_ATTRIBUTE}="${MEMBER_PANEL}"]`),
    ))
      node.remove();
    removeEmptyStrip(this.document);
    this.#rendered = "";
  }

  #target(page: MemberPage): Target | undefined {
    const member = pageMember(this.document, page);
    if (!member) return undefined;
    const observed =
      member.page === "conversation"
        ? observedFromConversation(member.extraction)
        : observedFromProfile(member.extraction);
    // V1-2: the checklist is read only when every label could be read; a
    // partial reading is not stored.
    const extras: ProfileCaptureExtras = {};
    if (member.page === "profile") {
      const preferences = readPreferences(this.document);
      if (preferences.status === "found")
        extras.preferences = preferences.positive;
      if (isOwnProfile(this.document)) extras.ownProfile = true;
    }
    const profileUrl =
      member.page === "conversation" &&
      member.extraction.profileUrl.status === "found"
        ? member.extraction.profileUrl.value
        : undefined;
    return {
      page,
      memberId: member.memberId,
      observed,
      extras,
      anchor: member.anchor,
      key: `${page}|${member.memberId}|${factsKey(observed)}|${JSON.stringify(extras)}`,
      ...(profileUrl ? { profileUrl } : {}),
    };
  }

  /** Once per distinct set of facts, so a re-render does not re-store. */
  #capture(target: Target, accountId: string): void {
    const key = `${accountId}|${target.key}`;
    if (this.#captured === key) return;
    this.#captured = key;
    const { memberId, observed, extras } = target;
    this.#captureQueue = this.#captureQueue.then(() =>
      this.client
        .captureSnapshot(accountId, memberId, observed, extras)
        .catch(() => {
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
      // A newer load (another member after a client-side route) keeps its
      // in-flight guard.
      if (this.#inFlight === target.key) this.#inFlight = undefined;
      this.#data.set(target.key, data);
      this.update(target.page);
    };
    this.client
      .evaluate([{ memberId: target.memberId, observed: target.observed }])
      .then(async (response) => {
        const result =
          response.status === "ok" ? response.results[0] : undefined;
        if (response.status === "ok" && result)
          return done({
            kind: "triage",
            accountId: response.accountId,
            result,
          });
        const trust = await this.client.getTrust(
          target.memberId,
          target.observed,
        );
        done({
          kind: "trust-only",
          ...(trust.status === "ok" ? { accountId: trust.accountId } : {}),
          rule: response.status,
          trust,
        });
      })
      .catch(() => {
        // A failure of a superseded load (the page moved to another member)
        // must not remove the current member's panel.
        if (generation !== this.#generation || this.#inFlight !== target.key)
          return;
        // Fail closed for the panel: without an answer, show nothing.
        this.#inFlight = undefined;
        this.teardown();
      });
  }

  /** The language changed: draw the panel again, in place. */
  localeChanged(): void {
    this.#rendered = "";
    if (this.#page) this.update(this.#page);
  }

  #render(target: Target, data: PanelData): void {
    // The viewer's own profile: JoyFox places, scores and logs other members
    // only. The profile is still captured (`update`), for compatibility.
    if (target.extras.ownProfile) {
      this.teardown();
      return;
    }
    const failed = this.#errorFor === target.memberId;
    const busy = this.#trustPending === target.memberId;
    const undoBusy = this.#undoPending === target.memberId;
    const key = JSON.stringify([target.key, data, failed, busy, undoBusy]);
    const existing = this.document.querySelector(
      `[${UI_ATTRIBUTE}="${MEMBER_PANEL}"]`,
    );
    if (existing && key === this.#rendered && isPlaced(existing, target.anchor))
      return;
    // A redraw for the same member keeps its open sections and the control
    // that has keyboard focus.
    const same = existing?.getAttribute("data-member") === target.memberId;
    const open = same ? openSections(existing) : new Set<string>();
    const focus = same ? rememberFocus(existing) : undefined;
    existing?.remove();
    this.#rendered = key;
    // Any path to another member (a route, a failed load, the inbox between
    // them) starts with the drawer closed.
    if (this.#drawerMember !== target.memberId) {
      this.#drawerMember = target.memberId;
      this.#drawerOpen = false;
    }
    const panel = element(
      this.document,
      "section",
      "joyfox-panel joyfox-member",
    );
    panel.setAttribute(UI_ATTRIBUTE, MEMBER_PANEL);
    panel.setAttribute("data-member", target.memberId);
    // A group, not a landmark: the strip is the one "JoyFox" region. A brand
    // name: the same in every language.
    panel.setAttribute("role", "group");
    panel.setAttribute("aria-label", "JoyFox");
    const memberId = target.memberId;
    const accountId = data.accountId;
    const trustActions = accountId
      ? {
          onTrust: (kind: "positive" | "negative" | "neutral") => {
            if (this.#trustPending === memberId) return;
            this.#trustPending = memberId;
            this.#write(
              memberId,
              () => this.client.logTrust(accountId, memberId, kind),
              () => {
                if (this.#trustPending === memberId)
                  this.#trustPending = undefined;
              },
            );
            // Drawn again at once, so the Log buttons show they wait.
            if (this.#page) this.update(this.#page);
          },
          // A double click on Undo removes one outcome. An Undo right after
          // a Log still runs, after it, and removes that outcome.
          onUndoTrust: () => {
            if (this.#undoPending === memberId) return;
            this.#undoPending = memberId;
            this.#write(
              memberId,
              () => this.client.undoTrust(accountId, memberId),
              () => {
                if (this.#undoPending === memberId)
                  this.#undoPending = undefined;
              },
            );
            if (this.#page) this.update(this.#page);
          },
        }
      : {};
    const onToggle = (open: boolean) => {
      this.#drawerOpen = open;
    };
    // On a conversation, a rule that needs profile-only facts JoyFox does
    // not know gets a link to the profile. The user opens it; the facts are
    // captured there and used here on the way back.
    const unknownText =
      data.kind === "triage" && target.profileUrl
        ? unknownProfileFactsText(data.result.automatic.evaluatedConditions)
        : undefined;
    if (data.kind === "triage")
      panel.append(
        ...memberBar(this.document, {
          result: data.result,
          trust: data.result.trust,
          ...(unknownText && target.profileUrl
            ? { openProfile: { href: target.profileUrl, text: unknownText } }
            : {}),
          actions: {
            onOverride: (placement) =>
              this.#write(memberId, () =>
                this.client.setOverride(data.accountId, memberId, placement),
              ),
            onSharedEventOptOut: () =>
              this.#write(memberId, () =>
                this.client.optOutSharedEvent(data.accountId, memberId),
              ),
            ...trustActions,
          },
          trustBusy: busy,
          undoBusy,
          drawerOpen: this.#drawerOpen,
          onToggle,
        }),
      );
    else
      panel.append(
        ...memberBar(this.document, {
          ruleOff: message(RULE_OFF_TEXT[data.rule] ?? "panel.ruleOff.other"),
          ...(data.trust.status === "ok" ? { trust: data.trust.trust } : {}),
          actions: {
            ...trustActions,
            onOpenOptions: () => {
              void this.client.openOptions().catch(() => undefined);
            },
          },
          trustBusy: busy,
          undoBusy,
          drawerOpen: this.#drawerOpen,
          onToggle,
        }),
      );
    if (failed)
      panel.append(
        element(this.document, "p", "joyfox-error", t("common.saveFailed")),
      );
    reopenSections(panel, open);
    placeInStrip(this.document, target.anchor, panel);
    restoreFocus(panel, focus, focusFallbacks(focus?.key));
  }

  /**
   * Run a write for `memberId`, then reload at once. The background also
   * bumps the triage revision, which other tabs hear through
   * `storage.onChanged`. `settled` runs once the write has ended, either
   * way, before the reload.
   *
   * Writes run one after another, in click order. Otherwise "Log" then a
   * quick "Undo" could reach the background in the other order, and undo
   * would remove the earlier outcome instead of the one just logged.
   */
  #write(
    memberId: string,
    action: () => Promise<void>,
    settled?: () => void,
  ): void {
    this.#errorFor = undefined;
    this.#writeQueue = this.#writeQueue.then(() =>
      action()
        .then(() => {
          settled?.();
          this.invalidate();
        })
        .catch(() => {
          settled?.();
          this.#errorFor = memberId;
          this.#rendered = "";
          if (this.#page) this.update(this.#page);
        }),
    );
  }
}
