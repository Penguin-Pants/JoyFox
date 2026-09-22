import {
  IDENTITY_UNAVAILABLE_TEXT,
  type IdentityUnavailableReason,
} from "./member-identity";

/**
 * Anything keyed to a member is written only when that member's identity is
 * stable. A refusal is a value rather than an exception, because it is an
 * expected state the UI must show, not a defect.
 */
export type PersistenceOutcome<T> =
  | { status: "ok"; value: T }
  | { status: "disabled"; reason: IdentityUnavailableReason; message: string };

export function disabled<T>(
  reason: IdentityUnavailableReason,
): PersistenceOutcome<T> {
  return {
    status: "disabled",
    reason,
    message: IDENTITY_UNAVAILABLE_TEXT[reason],
  };
}

export const ok = <T>(value: T): PersistenceOutcome<T> => ({
  status: "ok",
  value,
});
