import type { TriagePlacement } from "../domain/types";
import type { PlainKey } from "../i18n/catalog/en";
import { message, type Message } from "../i18n/message";
import { formatDate, t } from "../i18n/translator";
import {
  CONDITION_TEXT,
  PLACEMENT_TEXT,
  type ConditionKind,
  type EvaluatedCondition,
} from "../rules/contact-rule";
import type { MemberTriage } from "../triage/triage-service";
import { TRUST_SCOPE_NOTE, type TrustScore } from "../trust/trust-score";
import type { TrustOutcomeKind } from "../trust/trust-service";

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

/** The text of a placement, in the current language. */
export const placementText = (placement: TriagePlacement): string =>
  t(PLACEMENT_TEXT[placement]);

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
 * JoyFox UI inside a row cannot also open the conversation.
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
    onClick();
  });
  return node;
}

export interface ExplanationActions {
  onOverride(placement: TriagePlacement | null): void;
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
    element(
      document,
      "summary",
      "",
      t("triage.conditions.summary", { count: conditions.length }),
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
      element(document, "summary", "", t("trust.details.summary")),
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
            : "triage.source.rule",
        ),
      }),
    ),
  );
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
  controls.setAttribute("aria-label", t("triage.move.group"));
  for (const placement of [
    "qualified",
    "needs-review",
    "quarantined",
  ] as const) {
    const control = button(
      document,
      "joyfox-button",
      t("triage.move.to", { placement: message(PLACEMENT_TEXT[placement]) }),
      () => actions.onOverride(placement),
    );
    // Disabled rather than hidden, so the control set stays predictable.
    control.disabled =
      result.source === "override" && result.placement === placement;
    controls.append(control);
  }
  if (result.source === "override")
    controls.append(
      button(document, "joyfox-button", t("triage.move.useRule"), () =>
        actions.onOverride(null),
      ),
    );
  root.append(controls);
  root.append(trustSection(document, result.trust, actions));
  return root;
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
  drawerOpen: boolean;
  onToggle(open: boolean): void;
}

/**
 * The compact member bar (owner decision, 2026-09-24, "Option A"): one row
 * with the placement, the local trust score and the outcome buttons, and a
 * drawer, closed by default, with the explanation and the move controls.
 * The row wraps on a narrow screen instead of turning into a column.
 */
export function memberBar(
  document: Document,
  input: MemberBarInput,
): HTMLElement[] {
  const { result, trust, actions } = input;
  const bar = element(document, "div", "joyfox-bar");
  bar.append(element(document, "strong", "joyfox-bar__brand", "JoyFox"));
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
    if (input.openProfile) {
      const group = element(document, "span", "joyfox-bar__group");
      const link = element(
        document,
        "a",
        "joyfox-button joyfox-bar__profile",
        t("bar.openProfile"),
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
        button(
          document,
          "joyfox-button",
          t("common.openOptions"),
          actions.onOpenOptions,
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
    const labelled = (text: string, name: string, onClick: () => void) => {
      const node = button(document, "joyfox-button", text, onClick);
      node.setAttribute("aria-label", name);
      return node;
    };
    const row = element(document, "span", "joyfox-bar__group");
    row.setAttribute("role", "group");
    row.setAttribute("aria-label", t("trust.log.group"));
    row.append(
      element(document, "span", "joyfox-note", t("bar.log")),
      labelled(t("bar.positive"), t("trust.log.positive"), () =>
        onTrust("positive"),
      ),
      labelled(t("bar.neutral"), t("trust.log.neutral"), () =>
        onTrust("neutral"),
      ),
      labelled(t("bar.negative"), t("trust.log.negative"), () =>
        onTrust("negative"),
      ),
    );
    if (actions.onUndoTrust && trust && trust !== "unknown" && trust.logged > 0)
      row.append(
        labelled(t("bar.undo"), t("trust.log.undo"), actions.onUndoTrust),
      );
    bar.append(row);
  }

  const drawer = element(document, "div", "joyfox-drawer");
  drawer.id = `joyfox-drawer-${(drawerIds += 1)}`;
  drawer.hidden = !input.drawerOpen;
  if (result && actions.onOverride) {
    // Without `onTrust` the explanation leaves out the outcome buttons,
    // which live in the bar. The drawer keeps the reasons, the conditions,
    // the move controls and the score breakdown.
    drawer.append(
      explanation(document, result, { onOverride: actions.onOverride }),
    );
  } else if (trust !== undefined) {
    drawer.append(trustSection(document, trust, {}));
  }
  // Nothing to show: no toggle that would open an empty region.
  if (!drawer.hasChildNodes()) return [bar];
  const toggle = button(
    document,
    "joyfox-button joyfox-bar__toggle",
    t(result ? "bar.whyAndMove" : "bar.scoreDetails"),
    () => {
      const open = drawer.hidden;
      drawer.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
      input.onToggle(open);
    },
  );
  toggle.setAttribute("aria-expanded", String(input.drawerOpen));
  toggle.setAttribute("aria-controls", drawer.id);
  bar.append(toggle);
  return [bar, drawer];
}
