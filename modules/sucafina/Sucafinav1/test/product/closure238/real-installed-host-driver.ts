/**
 * Host-real driver for the authorized successor CI dispatcher. NOT_RUN.
 * It requires the actual selected SDK connection + Electron preload capability,
 * never supplies a synthetic principal, bearer token or successful fixture.
 */
import { createSfContextClient } from "@orchestra/client/sucafina/context"
import type { SfDesktopCapability } from "@orchestra/client/sucafina/transport"
import type { SfOwnerSelection } from "@orchestra/schema/sucafina/context"
import { ServerConnection } from "../../../../../../packages/app-shell/src/context/server"
import { createSfDesktopOriginBridge238 } from "../../../../../../packages/app-shell/src/orchestra/chapters/sucafina/host/desktop-origin-bridge238"

export async function runSfInstalledHostDriver238(deps: Readonly<{
  server: ServerConnection.Any
  ownerSelection: SfOwnerSelection
  directory: string
  desktop: SfDesktopCapability
  fetch: typeof globalThis.fetch
  signal: AbortSignal
}>) {
  const invalidations: string[] = []
  const bridge = createSfDesktopOriginBridge238({
    server: deps.server, desktop: deps.desktop, fetch: deps.fetch,
    directory: deps.directory, onInvalidated: (reason) => { invalidations.push(reason) },
  })
  try {
    if (deps.signal.aborted) return { status: "NOT_RUN", reason: "aborted" } as const
    // If the authentic main-owned location producer exists, it may return zero
    // or multiple admitted installations. Neither is silently selected.
    const located = await bridge.listByLocation(deps.directory, deps.signal)
    if (located && located.installations.length !== 1)
      return { status: "BLOCKED", reason: "ambiguous-or-empty-location" } as const
    const found = await bridge.listByIds(deps.ownerSelection, deps.signal)
    if (deps.signal.aborted || found?.installations.length !== 1)
      return { status: "BLOCKED", reason: "not-approved-or-not-bound" } as const
    const descriptor = found.installations[0]!
    if (descriptor.publicOrigin !== deps.server.http.url ||
      descriptor.projectId !== deps.ownerSelection.projectId ||
      descriptor.installationId !== deps.ownerSelection.installationId)
      return { status: "BLOCKED", reason: "descriptor-mismatch" } as const
    const transport = bridge.createTransport(descriptor, 1, () => 1)
    const result = await createSfContextClient(transport)["ctx.context"]({
      installationId: descriptor.installationId, projectId: descriptor.projectId,
      hostId: descriptor.hostId,
    }, { signal: deps.signal })
    if (deps.signal.aborted || invalidations.length)
      return { status: "BLOCKED", reason: "revoked-or-aborted" } as const
    if (result.kind !== "response" || result.body.status !== "ok")
      return { status: "BLOCKED", reason: "original-context-not-admitted" } as const
    if (result.body.value.stamp.installationId !== descriptor.installationId ||
      result.body.value.stamp.projectId !== descriptor.projectId ||
      result.body.value.stamp.hostId !== descriptor.hostId)
      return { status: "BLOCKED", reason: "context-owner-mismatch" } as const
    // OBSERVED only when this function is actually called in the installed
    // runtime and the original producer authenticated this exact binding.
    return { status: "OBSERVED", mode: "main-owned-electron", installedOrigin: descriptor.publicOrigin,
      contractRevision: descriptor.contractRevision, ownerConfirmed: true } as const
  } catch {
    return { status: "BLOCKED", reason: "native-runtime-or-network" } as const
  } finally { bridge.dispose() }
}
