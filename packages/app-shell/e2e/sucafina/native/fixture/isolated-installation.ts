/** F04 genuine isolated local-domain installation builder.
 * This is reusable authored harness source, NOT a disposable agent log.
 * The local-operator profile is one UID, never a multi-principal auth proof.
 */
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import {
  prepareLocalConfiguration, requireLocalIsolation,
} from "../../../../../../modules/sucafina/Sucafinav1/runtime/local-configuration.ts"
import { prepareOperatorAccess } from "../../../../../../modules/sucafina/Sucafinav1/local/enroll.ts"
import { openLocalStore } from "../../../../../../modules/sucafina/Sucafinav1/runtime/local-store.ts"

/** Creates persistent private roots and exercises the real factory preflight.
 * Returns an environment DELTA for the existing authorized host launcher;
 * this helper deliberately spawns no process and never starts a second host.
 */
export async function createNativeScratch() {
  if (process.env.GITHUB_ACTIONS !== "true") throw new Error("F04_ACTIONS_ONLY")
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "sf-native-installed-"))
  await chmod(root, 0o700)
  try {
    const configuration = await prepareLocalConfiguration(root)
    // This enrolls the true CI runner UID as ONE local operator, not three
    // different users. Microsoft actors require separate legitimate sessions.
    await prepareOperatorAccess(configuration, true)
    const hostEnvironment: Readonly<Record<string, string>> = {
      ORCHESTRA_DB: path.join(root, "host-data", "orchestra.db"),
      ORCHESTRA_INHERIT_CREDENTIALS: "0",
      ORCHESTRA_CONFIG_DIR: path.join(root, "host-config"),
      ORCHESTRA_CREDENTIAL_KEY_FILE: path.join(root, "host-credential.key"),
      TMPDIR: path.join(root, "host-tmp"),
      XDG_DATA_HOME: path.join(root, "host-data"),
      XDG_CONFIG_HOME: path.join(root, "host-config"),
      XDG_CACHE_HOME: path.join(root, "host-cache"),
      XDG_STATE_HOME: path.join(root, "host-state"),
      SUCAFINA_LOCAL_CONFIG: configuration,
    }
    await requireLocalIsolation(root, hostEnvironment)
    const persistence = await openLocalStore(path.join(root, "business-local"))
    let disposed = false
    return {
      root, configuration, persistence, hostEnvironment,
      installedServer: "NOT_STARTED_BY_F04" as const,
      multiActorAuthentication: "NOT_PROVEN_LOCAL_OPERATOR_SINGLE_UID" as const,
      async dispose() {
        if (disposed) return
        disposed = true
        try { await persistence.dispose() }
        finally { await rm(root, { force: true, recursive: true }) }
      },
    }
  } catch (error) {
    await rm(root, { force: true, recursive: true })
    throw error
  }
}
