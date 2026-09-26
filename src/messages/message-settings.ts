import type { SettingsArea } from "../storage/local-settings";

/**
 * V1-4: message caching for Conversation History Search (ADR 0004, ADR 0015,
 * ADR 0016). On unless the user turns it off, as PRD 13.3 says: search
 * depends on it. With it off, nothing is stored.
 */
export const MESSAGE_CACHING_KEY = "joyfox.messageCaching";
/** How many months a cached message is kept (PRD 13.3: 12 by default). */
export const MESSAGE_RETENTION_KEY = "joyfox.messageRetentionMonths";
export const DEFAULT_MESSAGE_RETENTION_MONTHS = 12;
export const MIN_MESSAGE_RETENTION_MONTHS = 1;
export const MAX_MESSAGE_RETENTION_MONTHS = 120;

/** The longest message text stored; a storage guard. */
export const MAX_MESSAGE_TEXT_LENGTH = 10000;
/** JoyClub's message ID: `cm-message-` and a UUID (12-messages.md). */
export const MESSAGE_ID_PATTERN =
  /^cm-message-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
/** The conversation ID from the page address (02-conversation.md). */
export const CONVERSATION_ID_PATTERN = /^personal-\d+-\d+$/u;

export const isMessageCaching = (value: unknown) => value !== false;

export function isMessageRetention(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_MESSAGE_RETENTION_MONTHS &&
    value <= MAX_MESSAGE_RETENTION_MONTHS
  );
}

export interface MessageSettings {
  caching: boolean;
  retentionMonths: number;
}

/**
 * The stored settings, or the defaults when none are stored or storage
 * cannot be read. A failed read keeps caching on only if it was never
 * turned off; it cannot know, so it answers off: nothing is stored on a
 * guess.
 */
export async function readMessageSettings(
  settings: SettingsArea,
): Promise<MessageSettings> {
  try {
    const stored = await settings.get([
      MESSAGE_CACHING_KEY,
      MESSAGE_RETENTION_KEY,
    ]);
    const months = stored[MESSAGE_RETENTION_KEY];
    return {
      caching: isMessageCaching(stored[MESSAGE_CACHING_KEY]),
      retentionMonths: isMessageRetention(months)
        ? months
        : DEFAULT_MESSAGE_RETENTION_MONTHS,
    };
  } catch {
    return {
      caching: false,
      retentionMonths: DEFAULT_MESSAGE_RETENTION_MONTHS,
    };
  }
}

/** The oldest time a message may have and still be kept. */
export function retentionCutoff(now: Date, months: number): string {
  const cutoff = new Date(now.getTime());
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  return cutoff.toISOString();
}

/** The time a message's age is measured from: sent, else when stored. */
export const messageTime = (message: { sentAt?: string; createdAt: string }) =>
  message.sentAt ?? message.createdAt;
