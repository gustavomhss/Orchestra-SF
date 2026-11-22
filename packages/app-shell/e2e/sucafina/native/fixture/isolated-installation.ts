/** Private artifact root only. Never an installation, identity, actor or data-seeding substitute. */
import { chmod, lstat, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

/** The real installed host and original reserved datasets must already exist. */
export async function createNativeScratch() {
  if (process.env.GITHUB_ACTIONS !== "true") throw new Error("F04_ACTIONS_ONLY")
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "sf-native-private-"))
  await chmod(root, 0o700)
  let closed = false
  return { root, installed: false as const, authenticationCreated: false as const,
    async dispose() {
      if (closed) throw new Error("F04_PRIVATE_ROOT_ALREADY_DISPOSED")
      await rm(root, { recursive: true })
      try { await lstat(root) } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
          closed = true
          return { removed: true as const }
        }
        throw error
      }
      throw new Error("F04_PRIVATE_ROOT_STILL_PRESENT")
    },
  }
}
