import type {
  AccountScopedEntity,
  EntityMap,
  EntityName,
} from "../domain/types";
import { openDatabase, requestResult, transactionDone } from "./database";
import { validateEntity, ValidationError } from "./validation";

type Stored<T> = T & { storageKey: string };
const key = (accountId: string, id: string) => `${accountId}:${id}`;
function withoutStorageKey<T>(stored: Stored<T>): T {
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
    validateEntity(entity);
    const db = await openDatabase();
    const transaction = db.transaction(this.entityName, "readwrite");
    transaction
      .objectStore(this.entityName)
      .put({ ...entity, storageKey: key(accountId, entity.id) });
    await transactionDone(transaction);
  }
  async delete(accountId: string, id: string): Promise<void> {
    const db = await openDatabase();
    const transaction = db.transaction(this.entityName, "readwrite");
    transaction.objectStore(this.entityName).delete(key(accountId, id));
    await transactionDone(transaction);
  }
}
