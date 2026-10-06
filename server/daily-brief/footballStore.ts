import { createFirestoreLeagueCommandStore } from "../league-commands/store";
import { databaseBriefStore, type BriefDatabase } from "./databaseStore";
export function footballBriefStore(oidcToken?: string) {
  const store = createFirestoreLeagueCommandStore(oidcToken);
  const database: BriefDatabase = {
    async get(path) { const row = await store.get(path); return row ? { data: row.data, updateTime: row.updateTime! } : null; },
    async commit(writes) {
      await store.commit(writes.map(write => ({
        ...(write.data === null ? { delete: store.document(write.path, {}).name } : { update: store.document(write.path, write.data) }),
        currentDocument: write.expected === null ? { exists: false } : { updateTime: write.expected },
      })));
    },
  };
  return databaseBriefStore(database, "footballDailyBriefs");
}
