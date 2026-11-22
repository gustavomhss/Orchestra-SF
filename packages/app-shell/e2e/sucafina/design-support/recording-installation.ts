import type { BrowserContext } from "@playwright/test"
import { lstat, realpath } from "node:fs/promises"
import path from "node:path"
import { authenticateDesignInstallation, type DesignInstallation } from "./installation"

type DiscoveryDiagnostic = {
  selector: "private-installation-root" | "runtime-workspace"
  status: number
  count: number
  expectedOrigin: string
  expectedMount: string
  descriptors: { authMode: string; originMatches: boolean; mountMatches: boolean }[]
}

/**
 * Recording-only adapter for the current original installation layout.
 * local/entry.ts calls prepareSfLocalWorkspace(loaded.directory), then binds
 * discovery to that exact physical workspace. The existing design fixture still
 * supplies the private parent directory to its discovery request.
 *
 * Verify the original workspace and the negative parent control, then reuse
 * the unchanged authentication routine and all its owner/session checks.
 */
export async function authenticateRecordingInstallation(
  context: BrowserContext,
  installed: DesignInstallation,
  record: (diagnostic: DiscoveryDiagnostic) => Promise<void>,
) {
  const origin = new URL(installed.origin)
  if (origin.protocol !== "http:" || origin.hostname !== "127.0.0.1" || installed.mount !== "/sucafina")
    throw new Error("Recording expects the original isolated native installation")
  const workspace = path.join(installed.root, "workspace")
  const physical = await Promise.all([
    lstat(installed.root), lstat(workspace), realpath(installed.root), realpath(workspace),
  ]).catch(() => { throw new Error("Original runtime workspace could not be verified") })
  const [rootStat, workspaceStat, rootPath, workspacePath] = physical
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink() || !workspaceStat.isDirectory() || workspaceStat.isSymbolicLink() ||
      (rootStat.mode & 0o077) !== 0 || (workspaceStat.mode & 0o077) !== 0 || rootStat.uid !== workspaceStat.uid ||
      rootPath !== installed.root || workspacePath !== path.join(rootPath, "workspace"))
    throw new Error("Original runtime workspace is not its private physical installation child")

  const [{ Schema }, { SfInstallationList }] = await Promise.all([
    import("effect"), import("@orchestra/schema/sucafina/context"),
  ])
  const discover = async (selector: DiscoveryDiagnostic["selector"], directory: string) => {
    const url = new URL("/api/sucafina/installations", origin)
    url.search = new URLSearchParams({ select: "location", "location[directory]": directory }).toString()
    const response = await context.request.get(url.href, { timeout: 20_000 })
    if (response.status() !== 200)
      throw new Error("Recording discovery failed for " + selector + " (HTTP " + response.status() + ")")
    const value = Schema.decodeUnknownSync(SfInstallationList, { onExcessProperty: "error" })(await response.json())
    const diagnostic: DiscoveryDiagnostic = {
      selector, status: response.status(), count: value.installations.length,
      expectedOrigin: installed.origin, expectedMount: installed.mount,
      descriptors: value.installations.slice(0, 8).map((descriptor) => ({
        authMode: descriptor.authMode,
        originMatches: descriptor.publicOrigin === installed.origin,
        mountMatches: descriptor.mount === installed.mount,
      })),
    }
    console.info("SF_RECORDING_DISCOVERY " + JSON.stringify(diagnostic))
    await record(diagnostic)
    return diagnostic.count
  }
  const [parentCount, workspaceCount] = await Promise.all([
    discover("private-installation-root", installed.root),
    discover("runtime-workspace", workspace),
  ])
  if (parentCount !== 0 || workspaceCount !== 1)
    throw new Error("Original discovery selection mismatch: parent=" + parentCount + ", workspace=" + workspaceCount + "; expected 0 and exactly 1")

  // This original function independently rediscovers exactly one descriptor,
  // verifies origin/mount, requires unauthorized 401, consumes the one-use
  // enrollment and checks the precise HttpOnly session and operator owner.
  return authenticateDesignInstallation(context, { ...installed, root: workspace })
}
