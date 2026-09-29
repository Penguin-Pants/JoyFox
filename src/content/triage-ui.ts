import type { TriagePlacement } from "../domain/types";
import type { PlainKey } from "../i18n/catalog/en";
import { message, type Message } from "../i18n/message";
import { formatDate, formatWallTime, t } from "../i18n/translator";
import {
  CONDITION_TEXT,
  PLACEMENT_TEXT,
  type ConditionKind,
  type EvaluatedCondition,
} from "../rules/contact-rule";
import type { MemberTriage } from "../triage/triage-service";
import { TRUST_SCOPE_NOTE, type TrustScore } from "../trust/trust-score";
import type { TrustOutcomeKind } from "../trust/trust-service";
import { FOCUS_KEY } from "../ui/focus";

/**
 * Shared DOM builders for the injected triage UI. Every class name is
 * JoyFox's own (`joyfox-…`), every string is set as text, never parsed as
 * markup, and no state relies on color alone: each placement and condition
 * state is also written out in words (build plan Section 18).
 */

/** Marks every element JoyFox injects, so cleanup can find them all. */
export const UI_ATTRIBUTE = "data-joyfox-ui";

const OUTCOME_TEXT: Record<EvaluatedCondition["outcome"], PlainKey> = {
  met: "triage.outcome.met",
  "not-met": "triage.outcome.not-met",
  "needs-review": "triage.outcome.needs-review",
};

/**
 * The placements a user can mark a sender with (change request 2026-09-29,
 * US2 and US3). A user who reads a message has reviewed it, so Needs Review
 * is only ever a rule result.
 */
export type MarkPlacement = "qualified" | "quarantined";

export const MARK_PLACEMENTS: readonly MarkPlacement[] = [
  "qualified",
  "quarantined",
];

const MARK_TEXT: Record<MarkPlacement, PlainKey> = {
  qualified: "mark.qualified",
  quarantined: "mark.junk",
};

/** The text of a placement, in the current language. */
export const placementText = (placement: TriagePlacement): string =>
  t(PLACEMENT_TEXT[placement]);

/**
 * The `FOCUS_KEY` of each control a redraw rebuilds, so a panel can put
 * keyboard focus back on the same control (`src/ui/focus.ts`).
 */
export const FOCUS = {
  toggle: "why",
  conditions: "conditions",
  trustDetails: "trust-details",
  openOptions: "open-options",
  openProfile: "open-profile",
  sharedEventOptOut: "shared-event-opt-out",
  useRule: "use-rule",
  mark: (placement: MarkPlacement) => `mark:${placement}`,
  trust: (kind: TrustOutcomeKind | "undo") => `trust:${kind}`,
} as const;

/** Where focus goes when its control is gone or disabled after a redraw. */
export function focusFallbacks(key: string | undefined): string[] {
  if (key?.startsWith("trust:")) return [FOCUS.trust("positive"), FOCUS.toggle];
  if (
    key?.startsWith("mark:") ||
    key === FOCUS.useRule ||
    key === FOCUS.sharedEventOptOut
  )
    return [
      FOCUS.mark("qualified"),
      FOCUS.mark("quarantined"),
      FOCUS.useRule,
      FOCUS.toggle,
    ];
  return [FOCUS.toggle];
}

/** `node`, marked with a `FOCUS_KEY` that stays the same across redraws. */
export const keyed = <E extends Element>(node: E, key: string): E => {
  node.setAttribute(FOCUS_KEY, key);
  return node;
};

export function element<K extends keyof HTMLElementTagNameMap>(
  document: Document,
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * A button whose click never reaches JoyClub's own handlers, so a click on
 * JoyFox UI inside a row cannot also open the conversation. A button marked
 * unavailable (`aria-disabled`) does nothing: it keeps keyboard focus, as
 * `disabled` would not, while a write or the redraw after it is on its way,
 * so a click then can never act on data the redraw is about to replace.
 */
export function button(
  document: Document,
  className: string,
  text: string,
  onClick: () => void,
): HTMLButtonElement {
  const node = element(document, "button", className, text);
  node.type = "button";
  node.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (node.getAttribute("aria-disabled") === "true") return;
    onClick();
  });
  return node;
}

/**
 * The classes of the `<details>` sections open under `root`, so a redraw
 * (for example after a language change) can open the same sections again.
 */
export function openSections(root: Element | null | undefined): Set<string> {
  return new Set(
    Array.from(root?.querySelectorAll<HTMLDetailsElement>("details") ?? [])
      .filter((node) => node.open && node.className)
      .map((node) => node.className),
  );
}

/** Open the sections under `root` that `openSections` found open before. */
export function reopenSections(root: Element, open: Set<string>): void {
  for (const node of Array.from(
    root.querySelectorAll<HTMLDetailsElement>("details"),
  ))
    if (open.has(node.className)) node.open = true;
}

export interface ExplanationActions {
  /** "Use my rule again": clear the user's own choice. */
  onUseRule(): void;
  /**
   * "Mark qualified" or "Mark as junk". Present where the Mark buttons are
   * part of the explanation (the inbox panel); the member bar shows them in
   * its row instead.
   */
  onMark?(placement: MarkPlacement): void;
  /** A Mark sequence or a trust write is on its way: Mark waits for it. */
  markBusy?: boolean;
  /** V1-13: turn the shared-event exception off for this sender. */
  onSharedEventOptOut?(): void;
  /** Present where the user can log outcomes (conversation, profile). */
  onTrust?(kind: TrustOutcomeKind): void;
  onUndoTrust?(): void;
}

function conditionList(
  document: Document,
  conditions: readonly EvaluatedCondition[],
): HTMLElement {
  const details = element(document, "details", "joyfox-explain__conditions");
  details.append(
    keyed(
      element(
        document,
        "summary",
        "",
        t("triage.conditions.summary", { count: conditions.length }),
      ),
      FOCUS.conditions,
    ),
  );
  const list = element(document, "ul", "joyfox-explain__list");
  for (const condition of conditions) {
    const item = element(document, "li", "joyfox-explain__condition");
    item.dataset.outcome = condition.outcome;
    item.append(
      element(
        document,
        "strong",
        "",
        t(
          condition.negate
            ? "triage.condition.lineNegated"
            : "triage.condition.line",
          {
            outcome: message(OUTCOME_TEXT[condition.outcome]),
            condition: message(CONDITION_TEXT[condition.kind]),
          },
        ),
      ),
      document.createTextNode(t(condition.reason)),
    );
    list.append(item);
  }
  details.append(list);
  return details;
}

export function trustSection(
  document: Document,
  trust: TrustScore | "unknown",
  actions: Pick<ExplanationActions, "onTrust" | "onUndoTrust">,
): HTMLElement {
  const section = element(document, "div", "joyfox-trust");
  section.append(
    element(document, "p", "joyfox-trust__score", trustScoreText(trust)),
  );
  if (trust !== "unknown") {
    const details = element(document, "details", "joyfox-trust__details");
    details.append(
      keyed(
        element(document, "summary", "", t("trust.details.summary")),
        FOCUS.trustDetails,
      ),
    );
    const list = element(document, "ul", "joyfox-explain__list");
    for (const item of trust.contributions)
      list.append(
        element(
          document,
          "li",
          "",
          t("trust.contribution", {
            points: item.points,
            reason: item.reason,
          }),
        ),
      );
    details.append(list);
    section.append(details);
  }
  section.append(element(document, "p", "joyfox-note", t(TRUST_SCOPE_NOTE)));
  const { onTrust, onUndoTrust } = actions;
  if (onTrust) {
    const row = element(document, "div", "joyfox-actions");
    row.setAttribute("role", "group");
    row.setAttribute("aria-label", t("trust.log.group"));
    row.append(
      button(document, "joyfox-button", t("trust.log.positive"), () =>
        onTrust("positive"),
      ),
      button(document, "joyfox-button", t("trust.log.neutral"), () =>
        onTrust("neutral"),
      ),
      button(document, "joyfox-button", t("trust.log.negative"), () =>
        onTrust("negative"),
      ),
    );
    if (onUndoTrust && trust !== "unknown" && trust.logged > 0)
      row.append(
        button(document, "joyfox-button", t("trust.log.undo"), onUndoTrust),
      );
    section.append(row);
  }
  return section;
}

/** The full explanation for one sender: placement, reasons, controls, trust. */
export function explanation(
  document: Document,
  result: MemberTriage,
  actions: ExplanationActions,
): HTMLElement {
  const root = element(document, "div", "joyfox-explain");
  root.append(
    element(
      document,
      "p",
      "joyfox-explain__placement",
      t("triage.placementLine", {
        placement: message(PLACEMENT_TEXT[result.placement]),
        source: message(
          result.source === "override"
            ? "triage.source.override"
            : result.source === "shared-event"
              ? "triage.source.sharedEvent"
              : "triage.source.rule",
        ),
      }),
    ),
  );
  if (result.sharedEvent) {
    const event = result.sharedEvent;
    root.append(
      element(
        document,
        "p",
        "joyfox-explain__shared-event",
        t(
          message(
            event.attendance === "attended"
              ? "triage.sharedEvent.attended"
              : "triage.sharedEvent.attending",
            {
              event:
                event.title ??
                t(message("events.untitled", { id: event.eventId })),
              when: event.startLocal ? formatWallTime(event.startLocal) : "",
            },
          ),
        ),
      ),
    );
    if (actions.onSharedEventOptOut)
      root.append(
        keyed(
          button(
            document,
            "joyfox-button",
            t("triage.sharedEvent.optOut"),
            actions.onSharedEventOptOut,
          ),
          FOCUS.sharedEventOptOut,
        ),
      );
  }
  if (result.override)
    root.append(
      element(
        document,
        "p",
        "",
        t("triage.movedOn", {
          date: formatDate(result.override.decidedAt),
          placement: message(PLACEMENT_TEXT[result.automatic.placement]),
        }),
      ),
    );
  const reasons = element(document, "ul", "joyfox-explain__list");
  for (const reason of result.automatic.reasons)
    reasons.append(element(document, "li", "", t(reason)));
  root.append(reasons);
  if (result.automatic.evaluatedConditions.length > 0)
    root.append(conditionList(document, result.automatic.evaluatedConditions));

  const controls = element(document, "div", "joyfox-actions");
  controls.setAttribute("role", "group");
  controls.setAttribute("aria-label", t("triage.place.group"));
  if (actions.onMark)
    controls.append(
      ...markButtons(document, result, actions.onMark, actions.markBusy),
    );
  // The manual move to a placement is gone (D11): only the way back to the
  // rule stays. It clears the choice, never a logged trust outcome (D13).
  if (result.source === "override")
    controls.append(
      keyed(
        button(
          document,
          "joyfox-button",
          t("triage.useRule"),
          actions.onUseRule,
        ),
        FOCUS.useRule,
      ),
    );
  if (controls.hasChildNodes()) root.append(controls);
  root.append(trustSection(document, result.trust, actions));
  return root;
}

/**
 * "Mark qualified" and "Mark as junk" for one sender. A button whose
 * placement is already the user's own choice is disabled (D12); one the
 * rule or the shared-event exception chose stays enabled, so a click makes
 * it the user's choice. While `busy`, both are marked unavailable
 * (`aria-disabled`, so focus stays), so a double click runs one sequence.
 */
export function markButtons(
  document: Document,
  result: MemberTriage,
  onMark: (placement: MarkPlacement) => void,
  busy = false,
): HTMLButtonElement[] {
  return MARK_PLACEMENTS.map((placement) => {
    const control = keyed(
      button(document, "joyfox-button", t(MARK_TEXT[placement]), () =>
        onMark(placement),
      ),
      FOCUS.mark(placement),
    );
    control.dataset.mark = placement;
    control.disabled =
      result.source === "override" && result.placement === placement;
    if (busy) control.setAttribute("aria-disabled", "true");
    return control;
  });
}

/** Rule conditions whose facts only the profile page shows. */
const PROFILE_FACT_TEXT: Partial<Record<ConditionKind, PlainKey>> = {
  minimumPhotos: "triage.profileFact.minimumPhotos",
  minimumProfileWords: "triage.profileFact.minimumProfileWords",
  minimumAccountAgeDays: "triage.profileFact.minimumAccountAgeDays",
};

/**
 * Which profile facts the rule needed but does not know, as a message, or
 * `undefined` when none is unknown. Only the profile page shows these facts,
 * and JoyFox never opens it by itself (build plan Section 12), so the user
 * opens it and JoyFox reads them then.
 */
export function unknownProfileFactsText(
  conditions: readonly EvaluatedCondition[],
): Message | undefined {
  const [first, second, third] = [
    ...new Set(
      conditions
        .filter((condition) => condition.state === "unknown")
        .map((condition) => PROFILE_FACT_TEXT[condition.kind])
        .filter((name): name is PlainKey => name !== undefined),
    ),
  ].map((key) => message(key));
  if (!first) return undefined;
  if (!second) return message("triage.unknownFacts.one", { fact: first });
  if (!third) return message("triage.unknownFacts.two", { first, second });
  return message("triage.unknownFacts.three", { first, second, third });
}

function trustScoreText(trust: TrustScore | "unknown"): string {
  return trust === "unknown"
    ? t("trust.score.none")
    : t("trust.score.value", { score: trust.score });
}

let drawerIds = 0;

export interface MemberBarInput {
  /** The placement, when a contact rule placed this member. */
  result?: MemberTriage;
  /** Why no placement is shown, when there is none. */
  ruleOff?: Message;
  trust?: TrustScore | "unknown";
  /**
   * A link to the member's profile, shown when the rule needs facts only
   * the profile shows. A plain link the user clicks; JoyFox never follows it.
   */
  openProfile?: { href: string; text: Message };
  actions: Partial<ExplanationActions> & { onOpenOptions?(): void };
  /**
   * An outcome is being logged: the Log buttons are marked unavailable
   * (`aria-disabled`, so focus stays on them) until it is stored.
   */
  trustBusy?: boolean;
  /** An Undo is being stored: Undo waits for it. */
  undoBusy?: boolean;
  /** A Mark sequence runs: both Mark buttons wait for it (C9). */
  markBusy?: boolean;
  drawerOpen: boolean;
  onToggle(open: boolean): void;
}

/**
 * The compact member bar (owner decision, 2026-09-24, "Option A"): one row
 * with the placement, the Mark buttons, the local trust score and the
 * outcome buttons, and a drawer, closed by default, with the explanation.
 * The row wraps on a narrow screen instead of turning into a column.
 */
export function memberBar(
  document: Document,
  input: MemberBarInput,
): HTMLElement[] {
  const { result, trust, actions } = input;
  const bar = element(document, "div", "joyfox-bar");
  // The wordmark: "Joy" in the text color, "Fox" in the brand color. A brand
  // name: the same in every language.
  const brand = element(document, "strong", "joyfox-bar__brand", "Joy");
  brand.append(element(document, "span", "joyfox-bar__brand-accent", "Fox"));
  bar.append(brand);
  if (result) {
    const pill = element(document, "span", "joyfox-pill");
    pill.dataset.placement = result.placement;
    pill.append(
      element(
        document,
        "span",
        "joyfox-visually-hidden",
        t("bar.placementPrefix"),
      ),
      document.createTextNode(placementText(result.placement)),
    );
    bar.append(pill);
    if (result.source === "override")
      bar.append(element(document, "span", "joyfox-note", t("bar.yourChoice")));
    if (result.source === "shared-event")
      bar.append(
        element(document, "span", "joyfox-note", t("bar.sharedEvent")),
      );
    if (actions.onMark) {
      const group = element(document, "span", "joyfox-bar__group");
      group.setAttribute("role", "group");
      group.setAttribute("aria-label", t("mark.group"));
      group.append(
        ...markButtons(
          document,
          result,
          actions.onMark,
          // A trust write from the bar also holds Mark, so one click never
          // adds a second outcome while the first is being stored.
          Boolean(input.markBusy || input.trustBusy || input.undoBusy),
        ),
      );
      bar.append(group);
    }
    if (input.openProfile) {
      const group = element(document, "span", "joyfox-bar__group");
      const link = keyed(
        element(
          document,
          "a",
          "joyfox-button joyfox-bar__profile",
          t("bar.openProfile"),
        ),
        FOCUS.openProfile,
      );
      link.href = input.openProfile.href;
      group.append(
        element(document, "span", "joyfox-note", t(input.openProfile.text)),
        link,
      );
      bar.append(group);
    }
  } else if (input.ruleOff) {
    bar.append(element(document, "span", "joyfox-note", t(input.ruleOff)));
    if (actions.onOpenOptions)
      bar.append(
        keyed(
          button(
            document,
            "joyfox-button",
            t("common.openOptions"),
            actions.onOpenOptions,
          ),
          FOCUS.openOptions,
        ),
      );
  }
  if (trust !== undefined)
    bar.append(
      element(document, "span", "joyfox-bar__trust", trustScoreText(trust)),
    );
  if (actions.onTrust) {
    const onTrust = actions.onTrust;
    // Short visible labels keep the bar on one line; each button's
    // accessible name stays complete.
    const labelled = (
      text: string,
      name: string,
      key: TrustOutcomeKind | "undo",
      onClick: () => void,
    ) => {
      const node = keyed(
        button(document, "joyfox-button", text, onClick),
        FOCUS.trust(key),
      );
      node.setAttribute("aria-label", name);
      return node;
    };
    const log = (text: string, name: string, kind: TrustOutcomeKind) => {
      const node = labelled(text, name, kind, () => onTrust(kind));
      if (input.trustBusy) node.setAttribute("aria-disabled", "true");
      return node;
    };
    const row = element(document, "span", "joyfox-bar__group");
    row.setAttribute("role", "group");
    row.setAttribute("aria-label", t("trust.log.group"));
    row.append(
      element(document, "span", "joyfox-note", t("bar.log")),
      log(t("bar.positive"), t("trust.log.positive"), "positive"),
      log(t("bar.neutral"), t("trust.log.neutral"), "neutral"),
      log(t("bar.negative"), t("trust.log.negative"), "negative"),
    );
    if (
      actions.onUndoTrust &&
      trust &&
      trust !== "unknown" &&
      trust.logged > 0
    ) {
      const undo = labelled(
        t("bar.undo"),
        t("trust.log.undo"),
        "undo",
        actions.onUndoTrust,
      );
      if (input.undoBusy) undo.setAttribute("aria-disabled", "true");
      row.append(undo);
    }
    bar.append(row);
  }

  const drawer = element(document, "div", "joyfox-drawer");
  drawer.id = `joyfox-drawer-${(drawerIds += 1)}`;
  drawer.hidden = !input.drawerOpen;
  if (result && actions.onUseRule) {
    // Without `onTrust` and `onMark` the explanation leaves out the outcome
    // and Mark buttons, which live in the bar. The drawer keeps the reasons,
    // the conditions, "Use my rule again" and the score breakdown.
    drawer.append(
      explanation(document, result, {
        onUseRule: actions.onUseRule,
        ...(actions.onSharedEventOptOut
          ? { onSharedEventOptOut: actions.onSharedEventOptOut }
          : {}),
      }),
    );
  } else if (trust !== undefined) {
    drawer.append(trustSection(document, trust, {}));
  }
  // Nothing to show: no toggle that would open an empty region.
  if (!drawer.hasChildNodes()) return [bar];
  const toggle = keyed(
    button(
      document,
      "joyfox-button joyfox-bar__toggle",
      t(result ? "bar.details" : "bar.scoreDetails"),
      () => {
        const open = drawer.hidden;
        drawer.hidden = !open;
        toggle.setAttribute("aria-expanded", String(open));
        input.onToggle(open);
      },
    ),
    FOCUS.toggle,
  );
  toggle.setAttribute("aria-expanded", String(input.drawerOpen));
  toggle.setAttribute("aria-controls", drawer.id);
  bar.append(toggle);
  return [bar, drawer];
}
