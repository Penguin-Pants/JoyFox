import type { Message } from "./i18n/message";

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
  /**
   * What the UI shows, in the user's language. The English `message` stays
   * for logs; a panel never shows it (docs/i18n-spec.md, Section 3.10).
   */
  readonly display?: Message;

  constructor(
    readonly code: ExtensionErrorCode,
    message: string,
    options?: { cause?: unknown; display?: Message },
  ) {
    super(message, options);
    this.name = "ExtensionError";
    if (options?.display) this.display = options.display;
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
