// PROPOSED SOURCE: destination packages/app-shell/e2e/sucafina/native/fixture/scratch.ts
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { prepareLocalConfiguration } from "../../../../../../modules/sucafina/Sucafinav1/runtime/local-configuration.ts"
import { prepareOperatorAccess } from "../../../../../../modules/sucafina/Sucafinav1/local/enroll.ts"
import { openLocalStore } from "../../../../../../modules/sucafina/Sucafinav1/runtime/local-store.ts"

/** Dedicated filesystem+SQLite installation; retain across an actual server restart
 * inside the same test, then always dispose and erase at the test's terminal step.
 * It does not issue fake roles or start an alternate backend.
 */
export async function createNativeScratch() {
  if (process.env.GITHUB_ACTIONS !== "true") throw new Error("F04_ACTIONS_ONLY")
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "sf-native-installed-"))
  await chmod(root, 0o700)
  try {
    const configuration = await prepareLocalConfiguration(root)
    await prepareOperatorAccess(configuration, true)
    const persistence = await openLocalStore(path.join(root, "business"))
    let closed = false
    return {
      root,
      configuration,
      persistence,
      async dispose() {
        if (closed) return
        closed = true
        try { await persistence.dispose() }
        finally { await rm(root, { force: true, recursive: true }) }
      },
    }
  } catch (error) {
    await rm(root, { force: true, recursive: true })
    throw error
  }
}
