/**
 * Typed error categories from the build plan, Section 21. Feature code raises
 * these instead of bare `Error` so a caller can distinguish an expected site
 * change from a genuine defect without parsing message text.
 */
export type ExtensionErrorCode =
  | "SelectorUnavailable"
  | "ExtractionInvalid"
  | "IdentityMismatch"
  | "StorageError"
  | "RuleEvaluationError"
  | "ActionStepFailed"
  | "NavigationTimeout"
  | "UnsupportedPage";

export class ExtensionError extends Error {
  constructor(
    readonly code: ExtensionErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "ExtensionError";
  }
}

export function isExtensionError(
  value: unknown,
  code?: ExtensionErrorCode,
): value is ExtensionError {
  return (
    value instanceof ExtensionError &&
    (code === undefined || value.code === code)
  );
}
