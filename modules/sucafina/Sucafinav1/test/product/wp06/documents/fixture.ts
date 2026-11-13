import { testPersistence } from "../../../fixture/persistence.ts"

/** In-memory adapter for document unit tests; production uses the SQLite transactionAll implementation. */
export function documentTestPersistence() {
  const storage = testPersistence()
  return { ...storage, persistence: { ...storage.persistence, transactionAll: async <T>(work: (snapshots: typeof storage.state) => Promise<{ commit: boolean; value: T }>) => {
    const snapshots = structuredClone(storage.state)
    const result = await work(snapshots)
    if (result.commit) Object.assign(storage.state, snapshots)
    return result.value
  } } }
}
