import type { Message } from "../src/i18n/message";
import { t } from "../src/i18n/translator";

/** The text of one message, in the current language (English by default). */
export const text = (message: Message | undefined): string =>
  message ? t(message) : "";

/** The text of each message, in order. */
export const texts = (messages: readonly Message[]): string[] =>
  messages.map((message) => t(message));
