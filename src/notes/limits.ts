/**
 * Storage guards for notes and tags, chosen by this implementation rather
 * than observed from JoyClub (`docs/known-limitations.md`). In their own
 * module so the content script can use them without the storage code.
 */
export const MAX_NOTE_LENGTH = 4000;
export const MAX_TAG_LENGTH = 64;
