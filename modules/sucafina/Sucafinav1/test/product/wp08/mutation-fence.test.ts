import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { createCollaborationMutationFence } from "../../../product/collaboration/mutation-fence.ts"

test("collaboration fence detects a source change during and after authorization", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-mutation-fence-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  try {
    const fence = createCollaborationMutationFence({ persistence: store })
    const checks = { count: 0 }
    const raced = await fence.prepare(async () => {
      checks.count++
      if (checks.count === 2) await store.transaction("procurement", async (snapshot) => { snapshot.data.marker = "changed"; return { commit: true, value: undefined } })
      return true
    })
    expect(raced).toBeUndefined()
    const expected = await fence.prepare(async () => true)
    if (!expected) throw new Error("source fence unavailable")
    expect(await store.transaction("dashboard", async () => ({ commit: false, value: fence.check(expected) }))).toBe(true)
    await store.transaction("planner", async (snapshot) => { snapshot.data.marker = "changed"; return { commit: true, value: undefined } })
    expect(await store.transaction("dashboard", async () => ({ commit: false, value: fence.check(expected) }))).toBe(false)
  } finally {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
