import {
  IDENTITY_UNAVAILABLE_TEXT,
  type IdentityUnavailableReason,
} from "./member-identity";

/**
 * Data about an identifiable third party is written only for a stable member
 * identity. A refusal is a value, not an exception: it is an expected state
 * that the UI must display, not a defect.
 */
export type PersistenceOutcome<T> =
  | { status: "ok"; value: T }
  | {
      status: "disabled";
      reason: IdentityUnavailableReason;
      message: string;
    };

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
