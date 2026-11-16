/**
 * 238: desktop origin bridge. Calls the installed Electron main broker with
 * opaque handles; no cross-origin renderer fetch, CORS, bearer tokens or
 * invented identity. Explicit remote selections require existing consent.
 */
import { ServerConnection } from "@/context/server"
import { SfNativeOperationBindings } from "@orchestra/client/sucafina/bindings"
import {
  createSfTransport, type SfConnectionCandidate, type SfDesktopBinding,
  type SfDesktopCapability, type SfDesktopInvalidation, type SfDesktopLocationProbe,
  type SfTransport,
} from "@orchestra/client/sucafina/transport"
import type {
  SfInstallationDescriptor, SfInstallationList, SfOwnerSelection, SfResolvedRoute,
} from "@orchestra/schema/sucafina/context"

type Bound = Readonly<{
  key: string
  selection: SfOwnerSelection
  binding: SfDesktopBinding
  transportIdentity: string
  connectionGeneration: number
}>
const sameDescriptor = (a: SfInstallationDescriptor, b: SfInstallationDescriptor) =>
  a.installationId === b.installationId && a.projectId === b.projectId &&
  a.hostId === b.hostId && a.publicOrigin === b.publicOrigin &&
  a.mount === b.mount && a.contractRevision === b.contractRevision && a.authMode === b.authMode
const sameSelection = (a: SfOwnerSelection, b: SfOwnerSelection) =>
  a.serverKey === b.serverKey && a.projectId === b.projectId &&
  a.installationId === b.installationId

export function createSfDesktopOriginBridge238(deps: Readonly<{
  desktop: SfDesktopCapability
  server: ServerConnection.Any
  directory: string
  fetch: typeof globalThis.fetch
  onInvalidated: (reason: SfDesktopInvalidation["reason"]) => void
}>) {
  const serverKey = ServerConnection.key(deps.server)
  const origin = deps.server.http.url
  const validEndpoint = (() => {
    try {
      const url = new URL(origin)
      return url.origin === origin && !url.username && !url.password &&
        url.pathname === "/" && !url.search && !url.hash &&
        (url.protocol === "https:" || (url.protocol === "http:" &&
          ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)))
    } catch { return false }
  })()
  const validCredentials = !deps.server.http.password || !!deps.server.http.username
  const credentials: SfConnectionCandidate["credentials"] =
    deps.server.http.password && deps.server.http.username
      ? { kind: "basic", username: deps.server.http.username, password: deps.server.http.password }
      : { kind: "none" }
  const usable = validEndpoint && validCredentials
  let current: Bound | undefined
  let pending: Readonly<{ key: string; epoch: number; task: Promise<Bound | undefined> }> | undefined
  let epoch = 0
  let disposed = false
  const keyOf = (selected: SfOwnerSelection) =>
    JSON.stringify([selected.serverKey, selected.projectId, selected.installationId])
  const releaseBinding = (entry: Bound) => {
    // Local revocation precedes asynchronous best-effort main cleanup.
    void deps.desktop.release({
      kind: "binding", bindingHandle: entry.binding.bindingHandle,
      generation: entry.binding.generation,
    }).catch(() => undefined)
  }
  const retire = () => {
    epoch += 1
    const previous = current
    current = undefined
    if (previous) releaseBinding(previous)
  }
  const allowedSelection = (selected: SfOwnerSelection) =>
    usable && !disposed && selected.serverKey === serverKey &&
    !!selected.projectId && !!selected.installationId
  const validBound = (binding: SfDesktopBinding, selected: SfOwnerSelection,
    generation: number) =>
    !!binding.bindingHandle && binding.generation === generation &&
    binding.descriptor.projectId === selected.projectId &&
    binding.descriptor.installationId === selected.installationId &&
    binding.descriptor.publicOrigin === origin &&
    binding.descriptor.contractRevision === "sf-native-ui/1" &&
    !!binding.descriptor.hostId

  const ensure = async (selected: SfOwnerSelection, signal: AbortSignal): Promise<Bound | undefined> => {
    if (signal.aborted || !allowedSelection(selected)) return
    const key = keyOf(selected)
    if (current?.key === key) return current
    if (current && current.key !== key) retire()
    // A pending bind belongs to exactly one selection. Another selection
    // increments the local epoch before its response can publish authority.
    if (pending && pending.key !== key) { epoch += 1; pending = undefined }
    if (pending && pending.key === key && pending.epoch === epoch) {
      const reused = await pending.task
      return !signal.aborted && current === reused ? reused : undefined
    }
    const attempt = epoch
    const task = (async (): Promise<Bound | undefined> => {
      const candidate: SfConnectionCandidate = {
        serverKey, projectId: selected.projectId, baseUrl: origin, credentials,
        ...(deps.directory ? { location: { directory: deps.directory } } : {}),
      }
      let consent
      try { consent = await deps.desktop.registerConnection(candidate) } catch { return }
      if (consent.status !== "approved" || consent.serverKey !== serverKey ||
        consent.projectId !== selected.projectId || !consent.transportIdentity ||
        !Number.isSafeInteger(consent.generation) || signal.aborted ||
        disposed || epoch !== attempt) return
      let invalidatedBeforeSet = false
      let established: Bound | undefined
      let answer
      try {
        answer = await deps.desktop.bind({
          serverKey, projectId: selected.projectId, installationId: selected.installationId!,
        }, (event) => {
          if (!established) { invalidatedBeforeSet = true; return }
          if (current !== established || event.bindingHandle !== established.binding.bindingHandle ||
            event.generation !== established.binding.generation) return
          current = undefined
          epoch += 1
          deps.onInvalidated(event.reason)
        })
      } catch { return }
      if (answer.status !== "ok") return
      if (invalidatedBeforeSet || !validBound(answer, selected, consent.generation) ||
          signal.aborted || disposed || epoch !== attempt) {
        void deps.desktop.release({
          kind: "binding", bindingHandle: answer.bindingHandle,
          generation: answer.generation,
        }).catch(() => undefined)
        return
      }
      established = {
        key, selection: selected, binding: answer,
        transportIdentity: consent.transportIdentity,
        connectionGeneration: consent.generation,
      }
      current = established
      return established
    })()
    pending = { key, epoch: attempt, task }
    try {
      const result = await task
      return !signal.aborted && current === result && !disposed ? result : undefined
    } finally {
      if (pending?.task === task) pending = undefined
    }
  }

  const listByIds = async (selected: SfOwnerSelection, signal: AbortSignal):
    Promise<SfInstallationList | undefined> => {
    const accepted = await ensure(selected, signal)
    return accepted && current === accepted && !signal.aborted
      ? { installations: [accepted.binding.descriptor] } : undefined
  }
  const listByLocation = async (directory: string, signal: AbortSignal):
    Promise<SfInstallationList | undefined> => {
    if (!usable || disposed || signal.aborted || !directory ||
      directory !== deps.directory || !deps.desktop.discoverLocation) return
    const probe: SfDesktopLocationProbe = {
      serverKey, baseUrl: origin, credentials, location: { directory },
    }
    let result
    try { result = await deps.desktop.discoverLocation(probe) } catch { return }
    if (disposed || signal.aborted || result.status !== "ok" ||
      !Array.isArray(result.installations) || result.installations.some((item) =>
        item.publicOrigin !== origin || item.contractRevision !== "sf-native-ui/1" ||
        !item.installationId || !item.projectId || !item.hostId)) return
    return { installations: [...result.installations] }
  }
  const createTransport = (binding: SfInstallationDescriptor,
    generation: number, currentGeneration: () => number): SfTransport => {
    const bound = current
    if (!bound || !usable || disposed ||
        !sameDescriptor(bound.binding.descriptor, binding)) {
      // Native capability without an approved binding is always unusable.
      return createSfTransport({
        binding, generation, currentGeneration: () => -1,
        fetch: deps.fetch, operations: SfNativeOperationBindings, desktop: deps.desktop,
      })
    }
    return createSfTransport({
      binding, generation: bound.binding.generation,
      currentGeneration: () => !disposed && current === bound &&
        currentGeneration() === generation ? bound.binding.generation : -1,
      fetch: deps.fetch, operations: SfNativeOperationBindings,
      desktop: deps.desktop, desktopBinding: bound.binding,
    })
  }
  const login = async (returnRoute: SfResolvedRoute) => {
    const bound = current
    if (!bound || disposed || !sameSelection(bound.selection, returnRoute.ownerSelection))
      return { status: "denied" as const }
    const result = await deps.desktop.login({
      bindingHandle: bound.binding.bindingHandle,
      generation: bound.binding.generation,
      returnRoute,
    })
    if (disposed || current !== bound) return { status: "denied" as const }
    if (result.status === "authenticated" && (
      result.context.stamp.installationId !== bound.binding.descriptor.installationId ||
      result.context.stamp.projectId !== bound.binding.descriptor.projectId ||
      result.context.stamp.hostId !== bound.binding.descriptor.hostId
    )) return { status: "denied" as const }
    return result
  }
  const dispose = () => {
    if (disposed) return
    disposed = true
    const bound = current
    retire()
    if (bound) {
      void deps.desktop.release({
        kind: "connection", serverKey, projectId: bound.selection.projectId,
        generation: bound.connectionGeneration, reason: "server-removed",
      }).catch(() => undefined)
    }
  }
  return Object.freeze({
    listByIds, listByLocation, createTransport, login, dispose,
    transportIdentity: (selection: SfOwnerSelection) =>
      current && sameSelection(current.selection, selection) ? current.transportIdentity : "",
  })
}
