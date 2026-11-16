import { createHash, randomUUID } from "node:crypto"
import type { BrowserWindow, IpcMainInvokeEvent, Session, WebContents } from "electron"
import type { SfInstallationDescriptor, SfContext, SfResolvedRoute } from "@orchestra/schema/sucafina/context"
import type { SfOperationBindings, SfOperationId } from "@orchestra/schema/sucafina/common"
import { sfAllowedByteMime, sfIsByteOperation, SF_FILE_BYTE_LIMIT } from "@orchestra/client/sucafina/transport"
import type {
  SfConnectionCandidate, SfDesktopInvocation, SfDesktopInvocationResult,
  SfDesktopInvalidation, SfDesktopLoginResult, SfDesktopOwnerRequest,
} from "@orchestra/client/sucafina/transport"
import { createSfConnectionRegistry, type SfApprovedConnection, type SfDesktopOwner } from "./connections"
import { loginSfLocal, loginSfMicrosoft, loadSfDesktopContext, requestSfReturnIntent } from "./auth"
import { decodeSfWireBody, planSfOperation } from "./protocol"
import { requestSfHttp, type SfByteSource } from "./network"
import type { SfNativeEnrollmentReply } from "./enrollment"

export type SfDesktopBrokerDependencies = Readonly<{
  electron: Pick<typeof import("electron"), "app" | "BrowserWindow" | "ipcMain" | "session" | "net" | "dialog">
  operations: SfOperationBindings
  isRendererUrl: (url: string) => boolean
  isMainWindow: (window: BrowserWindow) => boolean
  ownedConnection: () => Pick<SfConnectionCandidate, "serverKey" | "baseUrl" | "credentials"> | undefined
  requestLocalEnrollment: (request: Readonly<{
    serverKey: string; projectId: string; installationId: string; requestId: string
  }>) => Promise<SfNativeEnrollmentReply>
}>

type Pending = {
  requestId: string
  controller: AbortController
  effect: "read" | "preview" | "prepare" | "mutation" | "authentication"
  source?: SfByteSource
  responseHandle?: string
  sequence: number
  pulling: boolean
  fileOperation?: SfOperationId
  byteCount?: number
}
type Binding = {
  active: boolean
  handle: string
  generation: number
  owner: SfDesktopOwner
  connection: SfApprovedConnection
  descriptor: SfInstallationDescriptor
  partition: string
  session: Session
  controller: AbortController
  context?: SfContext
  requests: Map<string, Pending>
  loginWindow?: BrowserWindow
  loginPending: boolean
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value)
const closed = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).every((key) => keys.includes(key))
const nonempty = (value: unknown, max = 2048): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= max && !/[\x00-\x1f\x7f]/.test(value)
const failure = (reason: "aborted" | "network" | "invalid-response" | "contract-mismatch" | "contract-unavailable" | "outcome-unknown") =>
  ({ kind: "transport-error" as const, reason })

function validDescriptor(value: unknown, candidate: SfApprovedConnection, projectId: string, installationId: string):
  value is SfInstallationDescriptor {
  if (!isRecord(value) || !closed(value, [
    "installationId", "projectId", "hostId", "publicOrigin", "mount", "contractRevision", "authMode",
  ])) return false
  if (
    value.installationId !== installationId || value.projectId !== projectId
    || !nonempty(value.hostId) || value.publicOrigin !== candidate.origin
    || value.contractRevision !== "sf-native-ui/1"
    || !nonempty(value.mount, 128)
    || !/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(value.mount)
    || !["microsoft", "local-operator"].includes(String(value.authMode))
  ) return false
  if (value.authMode === "microsoft" && new URL(candidate.origin).protocol !== "https:") return false
  if (value.authMode === "local-operator") {
    const url = new URL(candidate.origin)
    if (url.protocol !== "http:" || !["127.0.0.1", "[::1]"].includes(url.hostname)) return false
  }
  return true
}

/** Owned by main only; direct renderer fetch, arbitrary endpoints and defaultSession are not capabilities. */
export function createSfDesktopBroker(deps: SfDesktopBrokerDependencies): Readonly<{
  invalidateServer(serverKey: string): Promise<void>
  dispose(): Promise<void>
}> {
  const bindings = new Map<string, Binding>()
  const watching = new Map<number, { sender: WebContents; dispose(): void }>()
  const purges = new Map<string, Promise<void>>()
  const channels = [
    "sf-native-register-connection", "sf-native-bind", "sf-native-invoke",
    "sf-native-abort", "sf-native-login", "sf-native-logout", "sf-native-release",
  ] as const
  let disposed = false

  const validOwner = (owner: SfDesktopOwner) =>
    !disposed && !owner.window.isDestroyed() && !owner.sender.isDestroyed()
    && owner.window.webContents === owner.sender
    && owner.frame === owner.sender.mainFrame
    && deps.electron.BrowserWindow.fromWebContents(owner.sender) === owner.window
    && deps.isMainWindow(owner.window) && deps.isRendererUrl(owner.frame.url)

  const owner = (event: IpcMainInvokeEvent): SfDesktopOwner | undefined => {
    if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame) return
    const window = deps.electron.BrowserWindow.fromWebContents(event.sender)
    if (!window) return
    const current = { window, sender: event.sender, frame: event.senderFrame }
    if (validOwner(current)) return current
  }

  async function purge(binding: Binding) {
    const previous = purges.get(binding.partition)
    if (previous) await previous.catch(() => undefined)
    const task = binding.session.clearStorageData().then(() => binding.session.clearCache()).then(() => undefined)
    purges.set(binding.partition, task)
    try { await task } finally { if (purges.get(binding.partition) === task) purges.delete(binding.partition) }
  }

  async function retire(binding: Binding, reason: SfDesktopInvalidation["reason"], skipPurge = false) {
    if (!binding.active) return
    binding.active = false
    bindings.delete(binding.handle)
    binding.controller.abort()
    for (const pending of binding.requests.values()) {
      pending.controller.abort()
      pending.source?.cancel()
    }
    binding.requests.clear()
    if (binding.loginWindow && !binding.loginWindow.isDestroyed()) binding.loginWindow.close()
    if (validOwner(binding.owner)) binding.owner.sender.send("sf-native-invalidated", {
      bindingHandle: binding.handle, generation: binding.generation, reason,
    } satisfies SfDesktopInvalidation)
    if (!skipPurge && ![...bindings.values()].some((item) => item.active && item.partition === binding.partition))
      await purge(binding)
  }

  /**
   * The existing authenticated ctx.context producer is the only trusted
   * source of principal, policy, accessRevision and operation availability.
   * This is not a grant manufactured from a renderer operation ID.
   */
  async function freshFileAuthority(binding: Binding, signal: AbortSignal,
    operation: SfOperationId): Promise<boolean> {
    if (!binding.active || signal.aborted || !validOwner(binding.owner) || !binding.context)
      return false
    const expected = binding.context.stamp
    const current = await loadSfDesktopContext({
      net: deps.electron.net, session: binding.session, descriptor: binding.descriptor,
      operations: deps.operations, signal,
    })
    if (current.status === "unauthenticated" || current.status === "denied") {
      await retire(binding, current.status === "unauthenticated" ? "session-expired" : "access-revoked")
      return false
    }
    if (current.status !== "ok") return false
    const stamp = current.context.stamp
    if (stamp.installationId !== expected.installationId ||
        stamp.hostId !== expected.hostId || stamp.projectId !== expected.projectId ||
        stamp.principalRef !== expected.principalRef ||
        stamp.policyVersion !== expected.policyVersion ||
        stamp.accessRevision !== expected.accessRevision) {
      await retire(binding, "access-revoked")
      return false
    }
    return binding.active && !signal.aborted && validOwner(binding.owner) &&
      current.context.availability.some((resource) =>
        resource.operations.some((entry) =>
          entry.operationId === operation && entry.state === "ready" && entry.operational === true))
  }

  const registry = createSfConnectionRegistry({
    app: deps.electron.app, dialog: deps.electron.dialog,
    ownedConnection: deps.ownedConnection, validOwner,
    onReplaced: async (connection, reason) => {
      await Promise.all([...bindings.values()].filter((item) => item.connection === connection)
        .map((item) => retire(item, reason)))
    },
  })

  const watch = (current: SfDesktopOwner) => {
    if (watching.has(current.sender.id)) return
    const gone = () => { void registry.invalidateOwner(current) }
    const navigated = (details: { isMainFrame: boolean; isSameDocument: boolean }) => {
      if (details.isMainFrame && !details.isSameDocument) gone()
    }
    current.sender.once("destroyed", gone)
    current.sender.once("render-process-gone", gone)
    current.sender.on("did-start-navigation", navigated)
    watching.set(current.sender.id, {
      sender: current.sender,
      dispose() {
        current.sender.removeListener("destroyed", gone)
        current.sender.removeListener("render-process-gone", gone)
        current.sender.removeListener("did-start-navigation", navigated)
      },
    })
  }

  const use = (event: IpcMainInvokeEvent, value: unknown): Binding | undefined => {
    const current = owner(event)
    if (!current || !isRecord(value) || !nonempty(value.bindingHandle, 128)
      || !Number.isSafeInteger(value.generation)) return
    const binding = bindings.get(value.bindingHandle)
    if (!binding || !binding.active || binding.generation !== value.generation
      || binding.owner.sender !== current.sender || binding.owner.frame !== current.frame
      || binding.connection !== registry.get(current, binding.connection.candidate.serverKey, binding.connection.candidate.projectId))
      return
    return binding
  }

  async function register(event: IpcMainInvokeEvent, candidate: unknown) {
    const current = owner(event)
    if (!current) return { status: "unavailable", reason: "owner-rejected" } as const
    watch(current)
    return registry.register(candidate, current)
  }

  async function bind(event: IpcMainInvokeEvent, selection: unknown) {
    const current = owner(event)
    if (!current || !isRecord(selection) || !closed(selection, ["serverKey", "projectId", "installationId"])
      || !nonempty(selection.serverKey) || !nonempty(selection.projectId) || !nonempty(selection.installationId))
      return { status: "denied" } as const
    const connection = registry.get(current, selection.serverKey, selection.projectId)
    if (!connection) return { status: "unavailable", reason: "connection-unapproved" } as const
    const codec = deps.operations["ctx.installations"]
    if (!codec) return { status: "unavailable", reason: "contract-mismatch" } as const
    const encoded = { select: "ids", projectId: selection.projectId, installationId: selection.installationId }
    try {
      if (codec.decodeInput(encoded).status !== "ok") return { status: "unavailable", reason: "contract-mismatch" } as const
    } catch { return { status: "unavailable", reason: "contract-mismatch" } as const }
    // Fresh, approved global connection only. OAuth browser cookies are never imported here.
    const discoverySession = deps.electron.session.fromPartition("sf-native-discovery-" + randomUUID())
    try {
      const headers: Record<string, string> = { Accept: "application/json" }
      if (connection.candidate.credentials.kind === "basic") {
        const credentials = connection.candidate.credentials
        headers.Authorization = "Basic " + Buffer.from(credentials.username + ":" + credentials.password, "utf8").toString("base64")
      }
      const query = new URLSearchParams(encoded)
      const reply = await requestSfHttp({
        net: deps.electron.net, session: discoverySession, origin: connection.origin,
        url: connection.origin + "/api/sucafina/installations?" + query,
        method: "GET", mode: "json", headers, maxResponseBytes: 32 * 1024,
      })
      if (!validOwner(current) || connection !== registry.get(current, selection.serverKey, selection.projectId))
        return { status: "denied" } as const
      if (reply.kind !== "buffer" || reply.status !== 200) return { status: "unavailable", reason: "network" } as const
      if (!/^application\/json(?:\s*;[^\r\n]*)?$/i.test(reply.headers["content-type"] ?? ""))
        return { status: "unavailable", reason: "contract-mismatch" } as const
      let parsed: unknown
      try { parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(reply.bytes)) } catch {
        return { status: "unavailable", reason: "contract-mismatch" } as const
      }
      let decoded
      try { decoded = codec.decodeOutput(parsed) } catch { return { status: "unavailable", reason: "contract-mismatch" } as const }
      if (decoded.status !== "ok" || !isRecord(decoded.value) || !Array.isArray(decoded.value.installations))
        return { status: "unavailable", reason: "contract-mismatch" } as const
      const matches = decoded.value.installations
        .filter((item: unknown) => validDescriptor(item, connection, selection.projectId as string, selection.installationId as string))
      if (matches.length !== 1 || decoded.value.installations.length !== 1)
        return { status: "unavailable", reason: "installation-unavailable" } as const
      const descriptor = matches[0] as SfInstallationDescriptor
      const partition = "sf-native-" + createHash("sha256").update(JSON.stringify([
        connection.candidate.serverKey, connection.transportIdentity, descriptor.publicOrigin, descriptor.installationId,
      ])).digest("hex")
      await purges.get(partition)?.catch(() => undefined)
      if (!validOwner(current) || connection !== registry.get(current, selection.serverKey, selection.projectId))
        return { status: "denied" } as const
      const binding: Binding = {
        active: true, handle: randomUUID(), generation: connection.generation, owner: current,
        descriptor, connection, partition, session: deps.electron.session.fromPartition(partition),
        controller: new AbortController(), requests: new Map(), loginPending: false,
      }
      bindings.set(binding.handle, binding)
      return { status: "ok", bindingHandle: binding.handle, generation: binding.generation, descriptor } as const
    } catch {
      return { status: "unavailable", reason: "network" } as const
    } finally {
      await discoverySession.clearStorageData().catch(() => undefined)
    }
  }

  async function invoke(event: IpcMainInvokeEvent, raw: unknown): Promise<SfDesktopInvocationResult> {
    const binding = use(event, raw)
    if (!binding || !isRecord(raw)) return failure("contract-unavailable")
    if (raw.kind === "response-chunk") {
      if (!closed(raw, ["kind", "bindingHandle", "generation", "requestId", "responseHandle", "sequence"])
        || !nonempty(raw.requestId, 64) || !nonempty(raw.responseHandle, 128) || !Number.isSafeInteger(raw.sequence))
        return failure("invalid-response")
      const pending = binding.requests.get(raw.requestId)
      if (!pending || pending.responseHandle !== raw.responseHandle || !pending.source ||
        !pending.fileOperation || !sfIsByteOperation(pending.fileOperation) ||
        pending.sequence !== raw.sequence || pending.pulling) return failure("invalid-response")
      pending.pulling = true
      try {
        if (!await freshFileAuthority(binding, pending.controller.signal, pending.fileOperation))
          return failure("contract-unavailable")
        const chunk = await pending.source.next()
        if (!binding.active || !validOwner(binding.owner) || pending.controller.signal.aborted ||
          binding.requests.get(pending.requestId) !== pending) return failure("aborted")
        // Revalidation after the read prevents a revocation racing the next IPC reply.
        if (!await freshFileAuthority(binding, pending.controller.signal, pending.fileOperation))
          return failure("contract-unavailable")
        if (chunk === undefined) {
          pending.source.cancel()
          binding.requests.delete(pending.requestId)
          return { kind: "byte-chunk", sequence: pending.sequence++, bytes: new Uint8Array(), done: true }
        }
        if (!(chunk instanceof Uint8Array) || chunk.byteLength === 0 ||
            chunk.byteLength > 64 * 1024 ||
            (pending.byteCount ?? 0) + chunk.byteLength > SF_FILE_BYTE_LIMIT)
          return failure("invalid-response")
        pending.byteCount = (pending.byteCount ?? 0) + chunk.byteLength
        return { kind: "byte-chunk", sequence: pending.sequence++, bytes: chunk, done: false }
      } catch { return failure("network") }
      finally {
        if (!binding.active || pending.controller.signal.aborted ||
            binding.requests.get(pending.requestId) !== pending || pending.sequence === raw.sequence ||
            (pending.byteCount ?? 0) > SF_FILE_BYTE_LIMIT) {
          pending.source?.cancel()
          binding.requests.delete(pending.requestId)
        }
        pending.pulling = false
      }
    }
    if (raw.kind !== "request" || !closed(raw, [
      "kind", "bindingHandle", "generation", "requestId", "operationId", "input", "upload", "idempotencyKey",
    ]) || !nonempty(raw.requestId, 64) || !UUID.test(raw.requestId)
      || !nonempty(raw.operationId) || binding.requests.has(raw.requestId) || binding.requests.size >= 32)
      return failure("invalid-response")
    const request = raw as Extract<SfDesktopInvocation, { kind: "request" }>
    const plan = planSfOperation({ request, descriptor: binding.descriptor,
      operations: deps.operations, principalRef: binding.context?.stamp.principalRef })
    if (plan.status !== "ok") return failure(plan.status === "contract-unavailable" ? "contract-unavailable" : "invalid-response")
    const pending: Pending = { requestId: request.requestId, controller: new AbortController(), effect: plan.value.effect,
      sequence: 0, pulling: false }
    const onRetired = () => pending.controller.abort()
    binding.controller.signal.addEventListener("abort", onRetired, { once: true })
    binding.requests.set(request.requestId, pending)
    try {
      if (request.operationId.startsWith("files.") &&
          !await freshFileAuthority(binding, pending.controller.signal, request.operationId))
        return failure("contract-unavailable")
      const reply = await requestSfHttp({
        net: deps.electron.net, session: binding.session, origin: binding.descriptor.publicOrigin,
        url: plan.value.url, method: plan.value.method, mode: plan.value.mode, body: plan.value.body,
        headers: plan.value.headers, signal: pending.controller.signal, maxResponseBytes: 32 * 1024 * 1024,
      })
      if (!binding.active || !validOwner(binding.owner) || pending.controller.signal.aborted
        || binding.requests.get(request.requestId) !== pending) return failure("aborted")
      if (reply.status === 401 || reply.status === 403) {
        await retire(binding, reply.status === 401 ? "session-expired" : "access-revoked")
        return failure("contract-unavailable")
      }
      if (reply.kind === "stream") {
        if (!sfIsByteOperation(request.operationId) || plan.value.mode !== "bytes" ||
            reply.status !== 200 || !sfAllowedByteMime(request.operationId, reply.headers["content-type"]) ||
            !await freshFileAuthority(binding, pending.controller.signal, request.operationId)) {
          reply.source.cancel()
          return failure("invalid-response")
        }
        pending.source = reply.source
        pending.fileOperation = request.operationId
        pending.byteCount = 0
        pending.responseHandle = randomUUID()
        return { kind: "byte-response", status: reply.status, headers: reply.headers, responseHandle: pending.responseHandle }
      }
      if (sfIsByteOperation(request.operationId) || plan.value.mode === "bytes")
        return failure("invalid-response")
      const decoded = decodeSfWireBody(plan.value, reply.bytes, reply.headers["content-type"])
      if (decoded.status !== "ok") return failure(plan.value.mutating ? "outcome-unknown" : "invalid-response")
      if (request.operationId.startsWith("files.") &&
          !await freshFileAuthority(binding, pending.controller.signal, request.operationId))
        return failure(plan.value.mutating ? "outcome-unknown" : "contract-unavailable")
      if (request.operationId === "ctx.context" && isRecord(decoded.value) && decoded.value.status === "ok"
        && isRecord(decoded.value.value) && isRecord(decoded.value.value.stamp)) {
        const stamp = decoded.value.value.stamp
        if (stamp.installationId === binding.descriptor.installationId && stamp.projectId === binding.descriptor.projectId
          && stamp.hostId === binding.descriptor.hostId && nonempty(stamp.principalRef))
          binding.context = decoded.value.value as SfContext
      }
      if (plan.value.mode === "empty") return { kind: "empty-response", status: reply.status, headers: reply.headers }
      return { kind: "json-response", status: reply.status, headers: reply.headers, body: decoded.value ?? null }
    } catch {
      if (plan.value.mutating) return failure("outcome-unknown")
      return failure(pending.controller.signal.aborted ? "aborted" : "network")
    } finally {
      binding.controller.signal.removeEventListener("abort", onRetired)
      if (!pending.source || !binding.active) {
        pending.source?.cancel()
        binding.requests.delete(request.requestId)
      }
    }
  }

  async function abort(event: IpcMainInvokeEvent, raw: unknown) {
    const binding = use(event, raw)
    if (!binding || !isRecord(raw) || !closed(raw, ["bindingHandle", "generation", "requestId"])
      || !nonempty(raw.requestId, 64)) return
    const pending = binding.requests.get(raw.requestId)
    if (!pending) return
    pending.controller.abort()
    pending.source?.cancel()
    binding.requests.delete(pending.requestId)
  }

  async function login(event: IpcMainInvokeEvent, raw: unknown): Promise<SfDesktopLoginResult> {
    const binding = use(event, raw)
    if (!binding || !isRecord(raw) || !closed(raw, ["bindingHandle", "generation", "returnRoute"])
      || !isRecord(raw.returnRoute) || !isRecord(raw.returnRoute.ownerSelection) || binding.loginPending) return { status: "denied" }
    const route = raw.returnRoute as SfResolvedRoute
    if (route.ownerSelection?.serverKey !== binding.connection.candidate.serverKey
      || route.ownerSelection.projectId !== binding.descriptor.projectId
      || route.ownerSelection.installationId !== undefined
         && route.ownerSelection.installationId !== binding.descriptor.installationId)
      return { status: "denied" }
    binding.loginPending = true
    try {
      const common = { net: deps.electron.net, session: binding.session,
        descriptor: binding.descriptor, operations: deps.operations, signal: binding.controller.signal }
      const result = binding.descriptor.authMode === "local-operator"
        ? await loginSfLocal({ ...common, dialog: deps.electron.dialog, parent: binding.owner.window,
            serverKey: binding.connection.candidate.serverKey, requestLocalEnrollment: deps.requestLocalEnrollment,
            owned: (() => {
              const owned = deps.ownedConnection()
              return !!owned && owned.serverKey === binding.connection.candidate.serverKey
                && owned.baseUrl === binding.connection.candidate.baseUrl
            })(),
          })
        : await (async () => {
            const loginUrl = await requestSfReturnIntent({
              ...common, route, serverKey: binding.connection.candidate.serverKey,
            }).catch(() => undefined)
            if (!loginUrl) return { status: "unavailable", reason: "contract-mismatch" } as const
            return loginSfMicrosoft({ ...common, BrowserWindow: deps.electron.BrowserWindow,
              parent: binding.owner.window, loginUrl,
              onWindow: (window) => { binding.loginWindow = window },
            })
          })()
      if (!binding.active || !validOwner(binding.owner)) return { status: "unavailable", reason: "auth-unavailable" }
      if (result.status === "authenticated") {
        if (result.context.stamp.installationId !== binding.descriptor.installationId
          || result.context.stamp.projectId !== binding.descriptor.projectId
          || result.context.stamp.hostId !== binding.descriptor.hostId) return { status: "unavailable", reason: "contract-mismatch" }
        binding.context = result.context
      }
      return result
    } finally { binding.loginPending = false }
  }

  async function logout(event: IpcMainInvokeEvent, raw: unknown) {
    const binding = use(event, raw)
    if (!binding || !isRecord(raw) || !closed(raw, ["bindingHandle", "generation"]))
      return { status: "cleared", remote: "unavailable" } as const
    // Invalidate every binding sharing this ephemeral jar. Old handles cannot
    // race a fresh login or get a response while logout is in flight.
    const peers = [...bindings.values()].filter((item) => item.partition === binding.partition)
    await Promise.all(peers.map((item) => retire(item, "logout", true)))
    await purges.get(binding.partition)?.catch(() => undefined)
    let unlock: () => void = () => undefined
    const barrier = new Promise<void>((resolve) => { unlock = resolve })
    purges.set(binding.partition, barrier)
    let remote: "confirmed" | "unavailable" = "unavailable"
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    try {
      const reply = await requestSfHttp({
        net: deps.electron.net, session: binding.session, origin: binding.descriptor.publicOrigin,
        url: binding.descriptor.publicOrigin + binding.descriptor.mount + "/auth/logout",
        method: "POST", mode: "empty", maxResponseBytes: 1024, signal: controller.signal,
        headers: { Origin: binding.descriptor.publicOrigin, "Idempotency-Key": randomUUID(), Accept: "application/json" },
      })
      if (reply.status === 204) remote = "confirmed"
    } catch { /* remote status does not restore the locally revoked session */ }
    finally {
      clearTimeout(timeout)
      await binding.session.clearStorageData().catch(() => undefined)
      await binding.session.clearCache().catch(() => undefined)
      unlock()
      if (purges.get(binding.partition) === barrier) purges.delete(binding.partition)
    }
    return { status: "cleared", remote }
  }

  async function release(event: IpcMainInvokeEvent, raw: unknown) {
    const current = owner(event)
    if (!current || !isRecord(raw)) return
    if (raw.kind === "binding" && closed(raw, ["kind", "bindingHandle", "generation"])) {
      const binding = use(event, raw)
      if (binding) await retire(binding, "owner-changed")
    }
    if (raw.kind === "connection" && closed(raw, ["kind", "serverKey", "projectId", "generation", "reason"])
      && raw.reason === "server-removed" && nonempty(raw.serverKey) && nonempty(raw.projectId)
      && Number.isSafeInteger(raw.generation))
      await registry.remove(current, raw.serverKey, raw.projectId, raw.generation as number)
  }

  for (const channel of channels) {
    if (channel === "sf-native-register-connection") deps.electron.ipcMain.handle(channel, register)
    if (channel === "sf-native-bind") deps.electron.ipcMain.handle(channel, bind)
    if (channel === "sf-native-invoke") deps.electron.ipcMain.handle(channel, invoke)
    if (channel === "sf-native-abort") deps.electron.ipcMain.handle(channel, abort)
    if (channel === "sf-native-login") deps.electron.ipcMain.handle(channel, login)
    if (channel === "sf-native-logout") deps.electron.ipcMain.handle(channel, logout)
    if (channel === "sf-native-release") deps.electron.ipcMain.handle(channel, release)
  }
  const quit = () => { void dispose() }
  deps.electron.app.once("before-quit", quit)
  async function dispose() {
    if (disposed) return
    disposed = true
    for (const channel of channels) deps.electron.ipcMain.removeHandler(channel)
    deps.electron.app.removeListener("before-quit", quit)
    await registry.dispose()
    await Promise.allSettled([...bindings.values()].map((binding) => retire(binding, "owner-changed")))
    watching.forEach((watcher) => watcher.dispose())
    watching.clear()
  }
  return Object.freeze({
    invalidateServer: (serverKey: string) => registry.invalidateServer(serverKey),
    dispose,
  })
}
