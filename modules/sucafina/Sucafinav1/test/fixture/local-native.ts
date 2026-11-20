import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { createSfHostRuntime } from "../../../../../apps/cli/src/sucafina-product/host-context.ts"
import { createLocalInstallation } from "../../local/entry.ts"
import { prepareOperatorAccess } from "../../local/enroll.ts"
import { prepareLocalConfiguration } from "../../runtime/local-configuration.ts"
import { microsoftNativeHost } from "../microsoft-login/native-host.ts"

/** Real local enrollment, SQLite and the installed native host. No browser listener. */
export async function localNative() {
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "sf-local-native-"))
  const directory = path.join(root, "private")
  const origin = "http://localhost:4110"
  const environment = {
    ORCHESTRA_DB: path.join(directory, "host-data", "orchestra.db"), ORCHESTRA_INHERIT_CREDENTIALS: "0",
    ORCHESTRA_CONFIG_DIR: path.join(directory, "host-config"), ORCHESTRA_CREDENTIAL_KEY_FILE: path.join(directory, "host-credential.key"),
    TMPDIR: path.join(directory, "host-tmp"), XDG_DATA_HOME: path.join(directory, "host-data"), XDG_CONFIG_HOME: path.join(directory, "host-config"),
    XDG_CACHE_HOME: path.join(directory, "host-cache"), XDG_STATE_HOME: path.join(directory, "host-state"),
  }
  let installation: Awaited<ReturnType<typeof createLocalInstallation>> | undefined
  let host: Awaited<ReturnType<typeof microsoftNativeHost>> | undefined
  const dispose = async () => {
    try { await host?.dispose() } finally {
      try { await installation?.dispose() } finally { await rm(root, { recursive: true, force: true }) }
    }
  }
  try {
    const file = await prepareLocalConfiguration(directory)
    const access = await prepareOperatorAccess(file, true)
    installation = await createLocalInstallation({ origin, createHostRuntime: createSfHostRuntime }, file, environment)
    host = await microsoftNativeHost({ root, directory, environment }, installation)
    const handoff = (await Bun.file(access.artifact).text()).match(/location\.replace\(("[^"\r\n]*")\)/)?.[1]
    if (!handoff) throw new Error("LOCAL_NATIVE_ENROLLMENT_MISSING")
    const destination = new URL(JSON.parse(handoff))
    if (destination.origin !== origin || destination.pathname !== "/sucafina/auth/local") throw new Error("LOCAL_NATIVE_ENROLLMENT_DESTINATION")
    const enrollment = await installation.handler(new Request(destination))
    if (enrollment?.status !== 303) throw new Error("LOCAL_NATIVE_ENROLLMENT_FAILED")
    const cookie = enrollment.headers.getSetCookie().map((value) => value.split(";", 1)[0]).join("; ")
    if (!cookie) throw new Error("LOCAL_NATIVE_SESSION_MISSING")
    const installed = installation
    const read = (pathname: string) => installed.handler(new Request(origin + pathname, { headers: { Cookie: cookie, Origin: origin } }))
    const post = (pathname: string, body: Record<string, unknown>) => installed.handler(new Request(origin + pathname, {
      method: "POST", headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }))
    return { read, post, dispose }
  } catch (error) {
    await dispose()
    throw error
  }
}
