import type {
  AccountScopedEntity,
  EntityMap,
  EntityName,
} from "../domain/types";
import { openDatabase, requestResult, transactionDone } from "./database";
import { validateEntity, ValidationError } from "./validation";

export type Stored<T> = T & { storageKey: string };
/**
 * Percent-encode both components so the `:` separator is unambiguous. Without
 * encoding, `key("a:b", "c")` and `key("a", "b:c")` collide and one account can
 * overwrite another account's record.
 */
const keyPart = (value: string) => encodeURIComponent(value);
const key = (accountId: string, id: string) =>
  `${keyPart(accountId)}:${keyPart(id)}`;
/** The physical key of a record, for writers that bypass a repository class. */
export const storageKeyFor = key;
export function withoutStorageKey<T>(stored: Stored<T>): T {
  const copy: Partial<Stored<T>> = { ...stored };
  delete copy.storageKey;
  return copy as T;
}

export interface Repository<T extends AccountScopedEntity> {
  get(accountId: string, id: string): Promise<T | undefined>;
  list(accountId: string): Promise<T[]>;
  put(accountId: string, entity: T): Promise<void>;
  delete(accountId: string, id: string): Promise<void>;
}

export class IndexedDbRepository<N extends EntityName>
  implements Repository<EntityMap[N]>
{
  constructor(readonly entityName: N) {}
  async get(accountId: string, id: string): Promise<EntityMap[N] | undefined> {
    const db = await openDatabase();
    const stored = await requestResult(
      db
        .transaction(this.entityName)
        .objectStore(this.entityName)
        .get(key(accountId, id)) as IDBRequest<
        Stored<EntityMap[N]> | undefined
      >,
    );
    if (!stored) return undefined;
    return withoutStorageKey(stored);
  }
  async list(accountId: string): Promise<EntityMap[N][]> {
    const db = await openDatabase();
    const records = await requestResult(
      db
        .transaction(this.entityName)
        .objectStore(this.entityName)
        .index("accountId")
        .getAll(accountId) as IDBRequest<Array<Stored<EntityMap[N]>>>,
    );
    return records.map(withoutStorageKey);
  }
  async put(accountId: string, entity: EntityMap[N]): Promise<void> {
    if (entity.accountId !== accountId)
      throw new ValidationError(
        "Entity account does not match repository scope",
      );
    validateEntity(this.entityName, entity);
    const db = await openDatabase();
    const transaction = db.transaction(this.entityName, "readwrite");
    const store = transaction.objectStore(this.entityName);
    store.put({ ...entity, storageKey: key(accountId, entity.id) });
    await this.applyRetention?.(store, accountId, entity);
    await transactionDone(transaction);
  }
  async delete(accountId: string, id: string): Promise<void> {
    const db = await openDatabase();
    const transaction = db.transaction(this.entityName, "readwrite");
    transaction.objectStore(this.entityName).delete(key(accountId, id));
    await transactionDone(transaction);
  }
  /**
   * Purge records that a retention policy no longer keeps. Runs inside the same
   * readwrite transaction as the write, so a write and its purge commit or abort
   * together. Entities without a retention policy leave this unimplemented and
   * keep every record.
   */
  protected applyRetention?(
    store: IDBObjectStore,
    accountId: string,
    entity: EntityMap[N],
  ): Promise<void>;
}
