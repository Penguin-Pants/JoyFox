import type { TriagePlacement } from "../domain/types";
import {
  CONDITION_TEXT,
  PLACEMENT_TEXT,
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

const OUTCOME_TEXT: Record<EvaluatedCondition["outcome"], string> = {
  met: "Met",
  "not-met": "Not met",
  "needs-review": "Needs review",
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
      `All conditions checked (${conditions.length})`,
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
        `${OUTCOME_TEXT[condition.outcome]}: ${CONDITION_TEXT[condition.kind]}. `,
      ),
      document.createTextNode(condition.reason),
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
    element(
      document,
      "p",
      "joyfox-trust__score",
      trust === "unknown"
        ? "Local trust score: no history yet."
        : `Local trust score: ${trust.score}.`,
    ),
  );
  if (trust !== "unknown") {
    const details = element(document, "details", "joyfox-trust__details");
    details.append(element(document, "summary", "", "How the score adds up"));
    const list = element(document, "ul", "joyfox-explain__list");
    for (const item of trust.contributions)
      list.append(
        element(
          document,
          "li",
          "",
          `${item.points > 0 ? "+" : ""}${item.points}: ${item.reason}`,
        ),
      );
    details.append(list);
    section.append(details);
  }
  section.append(element(document, "p", "joyfox-note", TRUST_SCOPE_NOTE));
  const { onTrust, onUndoTrust } = actions;
  if (onTrust) {
    const row = element(document, "div", "joyfox-actions");
    row.setAttribute("role", "group");
    row.setAttribute("aria-label", "Log an outcome with this member");
    row.append(
      button(document, "joyfox-button", "Log positive", () =>
        onTrust("positive"),
      ),
      button(document, "joyfox-button", "Log neutral", () =>
        onTrust("neutral"),
      ),
      button(document, "joyfox-button", "Log negative", () =>
        onTrust("negative"),
      ),
    );
    if (onUndoTrust && trust !== "unknown")
      row.append(
        button(document, "joyfox-button", "Undo last outcome", onUndoTrust),
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
      `Placement: ${PLACEMENT_TEXT[result.placement]} (${
        result.source === "override"
          ? "your manual choice"
          : "your contact rule"
      }).`,
    ),
  );
  if (result.override)
    root.append(
      element(
        document,
        "p",
        "",
        `You moved this sender on ${result.override.decidedAt.slice(0, 10)}. Your rule alone would place it in ${PLACEMENT_TEXT[result.automatic.placement]}.`,
      ),
    );
  const reasons = element(document, "ul", "joyfox-explain__list");
  for (const reason of result.automatic.reasons)
    reasons.append(element(document, "li", "", reason));
  root.append(reasons);
  if (result.automatic.evaluatedConditions.length > 0)
    root.append(conditionList(document, result.automatic.evaluatedConditions));

  const controls = element(document, "div", "joyfox-actions");
  controls.setAttribute("role", "group");
  controls.setAttribute("aria-label", "Move this sender");
  for (const placement of [
    "qualified",
    "needs-review",
    "quarantined",
  ] as const) {
    const control = button(
      document,
      "joyfox-button",
      `Move to ${PLACEMENT_TEXT[placement]}`,
      () => actions.onOverride(placement),
    );
    // Disabled rather than hidden, so the control set stays predictable.
    control.disabled =
      result.source === "override" && result.placement === placement;
    controls.append(control);
  }
  if (result.source === "override")
    controls.append(
      button(document, "joyfox-button", "Use my rule again", () =>
        actions.onOverride(null),
      ),
    );
  root.append(controls);
  root.append(trustSection(document, result.trust, actions));
  return root;
}
