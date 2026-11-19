import { randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { HotTopicHost } from "../../../product/dashboard/hot-topics.ts"
import type { Actor, Environment, Snapshot } from "../../../runtime/contract.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { bindCreatedSourceIdentity, createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"

type Correlations = Parameters<Parameters<HotTopicHost["transact"]>[2]>[3]

/** Component-test actors stay explicit; the creation identity and transaction
 * are issued by the real SQLite-backed source producer, never a fake binder.
 */
export async function hotTopicHostFixture(input: {
  state: Snapshot
  correlations: Correlations
  actor: Actor
  environment: Environment
  authorize?: (refs: Parameters<HotTopicHost["transact"]>[1]) => Promise<boolean>
}) {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-hot-topic-component-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const persistence = createSfSourcePersistence({ persistence: store, enumerate: enumerateSfSources, createId: randomUUID })
  try {
    await persistence.initializeSources("dashboard")
    await persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data = structuredClone(input.state.data)
      snapshot.versions = structuredClone(input.state.versions)
      snapshot.sequences = structuredClone(input.state.sequences)
      snapshot.audit = structuredClone(input.state.audit)
      snapshot.notices = structuredClone(input.state.notices)
      return { commit: true, value: undefined }
    })
  } catch (error) {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
    throw error
  }
  const transact: HotTopicHost["transact"] = async (_binding, refs, work) => {
    if (!refs.length || input.authorize && !await input.authorize(refs))
      return { status: "denied", reason: "source-denied" }
    const result = await persistence.transaction("dashboard", async (snapshot) => {
      const pending = structuredClone(input.correlations)
      const outcome = work(snapshot, input.actor, input.environment, pending)
      return { commit: outcome.commit, value: { ...outcome, pending } }
    })
    if (result.commit) {
      Object.assign(input.correlations, result.pending)
      Object.assign(input.state, await persistence.transaction("dashboard", async (snapshot) => ({
        commit: false, value: structuredClone(snapshot),
      })))
    }
    return result.value
  }
  const host: HotTopicHost = {
    transact,
    bindCreatedIdentity: (snapshot, recordId) => bindCreatedSourceIdentity(snapshot, "hotTopics", recordId),
  }
  return { host, close: async () => { await store.dispose(); await rm(directory, { recursive: true, force: true }) } }
}
