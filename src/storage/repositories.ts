import type { EntityMap, EntityName } from "../domain/types";
import {
  ENTITY_NAMES,
  openDatabase,
  requestResult,
  transactionDone,
} from "./database";
import { IndexedDbRepository } from "./repository";

export class ExtensionAccountRepository extends IndexedDbRepository<"extensionAccounts"> {
  constructor() {
    super("extensionAccounts");
  }
}
export class JoyClubMemberRepository extends IndexedDbRepository<"joyClubMembers"> {
  constructor() {
    super("joyClubMembers");
  }
}
export class ProfileSnapshotRepository extends IndexedDbRepository<"profileSnapshots"> {
  constructor() {
    super("profileSnapshots");
  }
}
export class UserNoteRepository extends IndexedDbRepository<"userNotes"> {
  constructor() {
    super("userNotes");
  }
}
export class UserTagRepository extends IndexedDbRepository<"userTags"> {
  constructor() {
    super("userTags");
  }
}
export class TrustSignalRepository extends IndexedDbRepository<"trustSignals"> {
  constructor() {
    super("trustSignals");
  }
}
export class ContactRuleRepository extends IndexedDbRepository<"contactRules"> {
  constructor() {
    super("contactRules");
  }
}
export class ConversationClassificationRepository extends IndexedDbRepository<"conversationClassifications"> {
  constructor() {
    super("conversationClassifications");
  }
}
export class SavedSearchRepository extends IndexedDbRepository<"savedSearches"> {
  constructor() {
    super("savedSearches");
  }
}
export class EventMetadataRepository extends IndexedDbRepository<"eventMetadata"> {
  constructor() {
    super("eventMetadata");
  }
}
export class SpendLogEntryRepository extends IndexedDbRepository<"spendLogEntries"> {
  constructor() {
    super("spendLogEntries");
  }
}
export class SyncConfigRepository extends IndexedDbRepository<"syncConfigs"> {
  constructor() {
    super("syncConfigs");
  }
}
export class ExtensionPreferenceRepository extends IndexedDbRepository<"extensionPreferences"> {
  constructor() {
    super("extensionPreferences");
  }
}
export class MessageTemplateRepository extends IndexedDbRepository<"messageTemplates"> {
  constructor() {
    super("messageTemplates");
  }
}
export class SpamPhraseRepository extends IndexedDbRepository<"spamPhrases"> {
  constructor() {
    super("spamPhrases");
  }
}
export class ActionLogRepository extends IndexedDbRepository<"actionLogs"> {
  constructor() {
    super("actionLogs");
  }
}

export const repositories = {
  extensionAccounts: new ExtensionAccountRepository(),
  joyClubMembers: new JoyClubMemberRepository(),
  profileSnapshots: new ProfileSnapshotRepository(),
  userNotes: new UserNoteRepository(),
  userTags: new UserTagRepository(),
  trustSignals: new TrustSignalRepository(),
  contactRules: new ContactRuleRepository(),
  conversationClassifications: new ConversationClassificationRepository(),
  savedSearches: new SavedSearchRepository(),
  eventMetadata: new EventMetadataRepository(),
  spendLogEntries: new SpendLogEntryRepository(),
  syncConfigs: new SyncConfigRepository(),
  extensionPreferences: new ExtensionPreferenceRepository(),
  messageTemplates: new MessageTemplateRepository(),
  spamPhrases: new SpamPhraseRepository(),
  actionLogs: new ActionLogRepository(),
};

export interface DataExport {
  schemaVersion: 1;
  exportedAt: string;
  accountId: string;
  entities: { [N in EntityName]: EntityMap[N][] };
}

export async function exportAccount(accountId: string): Promise<DataExport> {
  const entries = await Promise.all(
    ENTITY_NAMES.map(
      async (name) => [name, await repositories[name].list(accountId)] as const,
    ),
  );
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    accountId,
    entities: Object.fromEntries(entries) as DataExport["entities"],
  };
}

export async function deleteAccountData(accountId: string): Promise<void> {
  const db = await openDatabase();
  for (const name of ENTITY_NAMES) {
    const transaction = db.transaction(name, "readwrite");
    const index = transaction.objectStore(name).index("accountId");
    const keys = await requestResult(index.getAllKeys(accountId));
    for (const recordKey of keys)
      transaction.objectStore(name).delete(recordKey);
    await transactionDone(transaction);
  }
}
