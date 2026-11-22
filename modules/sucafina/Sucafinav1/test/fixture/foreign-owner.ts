import { lchown, lstat, realpath } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, dirname, join } from "node:path"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { AppProcess } from "@orchestra/core/process"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { Effect } from "effect"
import { ChildProcess } from "effect/unstable/process"

const useHostedChown = process.platform === "linux" && process.env.SF_CI_FOREIGN_OWNER_FIXTURE === "1"

export function canSetForeignFixtureOwner() {
  return process.getuid?.() === 0 || useHostedChown
}

/** Exercise the real UID guard without running the installation or suite as root. */
export async function withForeignFixtureOwner(root: string, target: string, source: string, verify: () => Promise<void>) {
  const uid = process.getuid?.()
  const directory = await lstat(root)
  const entry = await lstat(target)
  const allowed = basename(root).startsWith("sucafina-store-test-")
    ? [join(root, "private"), join(root, "private", "installation.sqlite")]
    : basename(root).startsWith("sucafina-backups-test-") ? [join(root, "foreign")] : []
  if (uid === undefined || !directory.isDirectory() || directory.uid !== uid || (directory.mode & 0o777) !== 0o700 ||
      dirname(root) !== await realpath(tmpdir()) || !allowed.includes(target) || await realpath(target) !== target ||
      entry.uid !== uid || (!entry.isFile() && !entry.isDirectory()) || (entry.isFile() && entry.nlink !== 1)) {
    throw new Error("Foreign-owner proof requires a fresh, owned fixture path")
  }
  const setOwner = (owner: number, group: number) => {
    if (uid === 0) return lchown(target, owner, group)
    if (!useHostedChown) throw new Error("Foreign-owner fixture privilege is unavailable")
    expectSpawn(source)
    return Effect.runPromise(Effect.gen(function* () {
      const service = yield* AppProcess.Service
      const result = yield* service.run(ChildProcess.make("/usr/bin/sudo", [
        "-n", "--", "/usr/bin/chown", "--no-dereference", `${owner}:${group}`, target,
      ]), { timeout: "5 seconds", maxErrorBytes: 1024, maxOutputBytes: 1024 })
      yield* AppProcess.requireSuccess(result)
    }).pipe(Effect.provide(LayerNode.compile(AppProcess.node))))
  }
  const foreignUid = uid === 65534 ? 65533 : 65534
  try {
    await setOwner(foreignUid, foreignUid)
    const foreign = await lstat(target)
    if (foreign.uid !== foreignUid || foreign.gid !== foreignUid) throw new Error("Foreign-owner fixture did not change ownership")
    await verify()
  } finally {
    await setOwner(uid, entry.gid)
    const restored = await lstat(target)
    if (restored.uid !== uid || restored.gid !== entry.gid) throw new Error("Foreign-owner fixture did not restore ownership")
  }
}
