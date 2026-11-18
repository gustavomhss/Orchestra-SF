/**
 * F02: browser/desktop Sucafina native transport. The catalogued route and
 * admitted codec are separate mandatory inputs: an ID alone never grants IO.
 * Shared operation metadata/exports are installed by the sole integrator I00.
 */
import { Option, Schema } from "effect"
import type {
  SfJson, SfOperation, SfOperationBindings, SfOperationId, SfPublicHeaders,
  SfTransportFailure, SfTransportResult,
} from "@orchestra/schema/sucafina/common"
import { SfOperationRegistry, type SfNativeOperationRoute } from "@orchestra/schema/sucafina/operation-registry"
import { SfContextStamp, type SfContext, type SfInstallationDescriptor, type SfResolvedRoute } from "@orchestra/schema/sucafina/context"

// Keep the Client public type identical to the canonical, browser-safe wire union.
export type { SfTransportResult } from "@orchestra/schema/sucafina/common"

export type SfCallOptions = Readonly<{ signal: AbortSignal; idempotencyKey?: string }>
export type SfTransport = Readonly<{
  execute<Input, Output>(
    operation: SfOperation<Input, Output>,
    input: Input,
    options: SfCallOptions,
  ): Promise<SfTransportResult<Output>>
}>

export type SfDesktopBinding = Readonly<{
  bindingHandle: string
  generation: number
  descriptor: SfInstallationDescriptor
}>
export type SfConnectionCandidate = Readonly<{
  serverKey: string
  projectId: string
  baseUrl: string
  location?: Readonly<{ directory: string; workspace?: string }>
  credentials: Readonly<{ kind: "none" }> | Readonly<{ kind: "basic"; username: string; password: string }>
}>
export type SfRegisterConnectionResult =
  | Readonly<{ status: "approved"; serverKey: string; projectId: string; transportIdentity: string; generation: number }>
  | Readonly<{ status: "cancelled" }>
  | Readonly<{ status: "unavailable"; reason: "connection-auth-unavailable" | "invalid-connection" | "owner-rejected" }>
export type SfDesktopInvalidation = Readonly<{
  bindingHandle: string
  generation: number
  reason: "logout" | "owner-changed" | "server-removed" | "host-changed" | "session-expired" | "access-revoked"
}>
export type SfDesktopBindResult =
  | (Readonly<{ status: "ok" }> & SfDesktopBinding)
  | Readonly<{ status: "denied" | "context-mismatch" }>
  | Readonly<{ status: "unavailable"; reason: "connection-unapproved" | "connection-auth-unavailable" | "installation-unavailable" | "network" | "contract-mismatch" }>
export type SfDesktopOwnerRequest = Readonly<{ bindingHandle: string; generation: number }>
export type SfDesktopInvocation = SfDesktopOwnerRequest & (
  | Readonly<{
    kind: "request"
    requestId: string
    operationId: SfOperationId
    input: SfJson | undefined
    upload?: Readonly<{ fileName: string; mediaType: string; bytes: Uint8Array }>
    idempotencyKey?: string
  }>
  | Readonly<{ kind: "response-chunk"; requestId: string; responseHandle: string; sequence: number }>
)
export type SfDesktopInvocationResult =
  | Readonly<{ kind: "json-response"; status: number; headers: SfPublicHeaders; body: SfJson | null }>
  | Readonly<{ kind: "byte-response"; status: number; headers: SfPublicHeaders; responseHandle: string }>
  | Readonly<{ kind: "byte-chunk"; sequence: number; bytes: Uint8Array; done: boolean }>
  | Readonly<{ kind: "empty-response"; status: number; headers: SfPublicHeaders }>
  | SfTransportFailure
export type SfDesktopLoginResult =
  | Readonly<{ status: "authenticated"; context: SfContext }>
  | Readonly<{ status: "cancelled" }>
  | Readonly<{ status: "denied" }>
  | Readonly<{ status: "unavailable"; reason: "auth-unavailable" | "identity-unavailable" | "enrollment-unavailable" | "network" | "contract-mismatch" }>
export type SfDesktopCapability = Readonly<{
  registerConnection(candidate: SfConnectionCandidate): Promise<SfRegisterConnectionResult>
  bind(selection: Readonly<{ serverKey: string; projectId: string; installationId: string }>, onInvalidated: (event: SfDesktopInvalidation) => void): Promise<SfDesktopBindResult>
  invoke(request: SfDesktopInvocation): Promise<SfDesktopInvocationResult>
  abort(request: SfDesktopOwnerRequest & Readonly<{ requestId: string }>): Promise<void>
  login(request: SfDesktopOwnerRequest & Readonly<{ returnRoute: SfResolvedRoute }>): Promise<SfDesktopLoginResult>
  logout(request: SfDesktopOwnerRequest): Promise<Readonly<{ status: "cleared"; remote: "confirmed" | "unavailable" }>>
  release(request: (SfDesktopOwnerRequest & Readonly<{ kind: "binding" }>) | Readonly<{ kind: "connection"; serverKey: string; projectId: string; generation: number; reason: "server-removed" }>): Promise<void>
}>

// Browser-safe, per-transport ephemeral authority; never placed in URL/storage.
type SfInternal = Readonly<{
  binding: SfInstallationDescriptor
  fetch: typeof globalThis.fetch
  current: () => boolean
  clear: () => void
}>
const internals = new WeakMap<SfTransport, SfInternal>()
const KEY = /^[A-Za-z0-9._:-]{8,128}$/
const MOUNT = /^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/
const SURFACES = new Set(["dashboard", "planner", "procurement"])
const MUTATION_LIMIT = 256
type ErrorReason = SfTransportFailure["reason"]
const failure = (reason: ErrorReason): SfTransportFailure => ({ kind: "transport-error", reason })

// Preserve the full route contract: the catalog literals happen to omit
// response modes owned by dedicated consumers, but that does not narrow F02.
function cataloguedRoute(operationId: SfOperationId): SfNativeOperationRoute | undefined {
  return SfOperationRegistry[operationId]
}

export function createSfTransport(options: Readonly<{
  binding: SfInstallationDescriptor
  generation: number
  currentGeneration: () => number
  fetch: typeof globalThis.fetch
  operations: SfOperationBindings
  desktop?: SfDesktopCapability
  desktopBinding?: SfDesktopBinding
}>): SfTransport {
  const isCurrent = () => options.generation === options.currentGeneration()
  const validBinding = validInstallation(options.binding)
  const owned = options.desktop && options.desktopBinding
    ? options.desktopBinding.generation === options.generation
      && sameInstallation(options.desktopBinding.descriptor, options.binding)
      && Boolean(options.desktopBinding.bindingHandle)
    : !options.desktop && !options.desktopBinding
  const webOrigin = () => typeof window !== "undefined" && window.location.origin === options.binding.publicOrigin
  let stamp: SfContextStamp | undefined
  const pending = new Map<string, string>()

  const clear = () => { stamp = undefined; pending.clear() }
  const transport: SfTransport = {
    async execute<Input, Output>(
      operation: SfOperation<Input, Output>,
      input: Input,
      call: SfCallOptions,
    ): Promise<SfTransportResult<Output>> {
      if (!validBinding || !owned || !isCurrent()) return failure("contract-mismatch")
      if (call.signal.aborted) return failure("aborted")
      if (!options.desktop && !webOrigin()) return failure("contract-mismatch")
      const metadata = cataloguedRoute(operation.operationId)
      if (!metadata || metadata.effect === "authentication" || operation.operationId === "ctx.installations") {
        // Auth and global discovery have their own canonical SDK/navigation.
        return failure("contract-unavailable")
      }
      // A stale GET registry must never serialize private search text as URL q,
      // even when a caller bypasses createSfWorkClient.
      if (operation.operationId === "projection.search" &&
          (metadata.method !== "POST" || metadata.effect !== "read" ||
           metadata.responseMode !== "json" ||
           metadata.pathTemplate !== "{mount}/api/ui/projections/search" ||
           !("maxRequestBytes" in metadata) || metadata.maxRequestBytes !== 4096 ||
           "fixedQuery" in metadata || "fixedBodyDiscriminator" in metadata)) {
        return failure("contract-unavailable")
      }
      const codec = options.operations[operation.operationId]
      if (!codec) return failure("contract-unavailable")
      const parsedInput = Schema.decodeUnknownOption(Schema.toType(operation.input), { onExcessProperty: "error" })(input)
      if (Option.isNone(parsedInput)) return failure("contract-mismatch")
      const decoded = (() => {
        try { return codec.decodeInput(parsedInput.value) }
        catch { return { status: "invalid" } as const }
      })()
      if (decoded.status !== "ok") return failure("contract-mismatch")
      if (metadata.responseMode !== "json" && metadata.responseMode !== "empty") {
        // Bytes require the installed download-handle/chunk consumer, not buffering
        // unbounded exports into memory. Navigation is never data transport.
        return failure("contract-unavailable")
      }
      // ctx.context expectations are ALWAYS taken from the approved descriptor.
      // The frozen F01 signatures allow an undefined public argument, while the
      // catalog requires exactly this private three-field query; never trust an
      // alternative tuple supplied by a screen or persisted selection.
      if (operation.operationId === "ctx.context" && decoded.value !== undefined) {
        const expectation = asJsonObject(decoded.value)
        if (!expectation || Object.keys(expectation).length !== 3 ||
            expectation.installationId !== options.binding.installationId ||
            expectation.projectId !== options.binding.projectId ||
            expectation.hostId !== options.binding.hostId) return failure("contract-mismatch")
      }
      const wireInput = operation.operationId === "ctx.context" ? {
        installationId: options.binding.installationId,
        projectId: options.binding.projectId,
        hostId: options.binding.hostId,
      } : decoded.value
      const route = operationUrl(options.binding, metadata, wireInput, operation.operationId)
      if (!route) return failure("contract-mismatch")
      const postRead = metadata.method === "POST" && (metadata.effect === "read" || metadata.effect === "preview")
      const mutating = metadata.method === "POST" && !postRead
      if (postRead && call.idempotencyKey !== undefined) return failure("contract-mismatch")
      const key = metadata.method === "POST"
        ? postRead
          ? typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : undefined
          : call.idempotencyKey
        : undefined
      if (metadata.method === "POST" && (!key || !KEY.test(key))) return failure("contract-mismatch")
      if (metadata.method === "GET" && call.idempotencyKey !== undefined) return failure("contract-mismatch")
      const bodyValue = metadata.method === "POST" ? operationBody(metadata, wireInput) : undefined
      if (metadata.method === "POST" && bodyValue === undefined) return failure("contract-mismatch")
      const body = bodyValue === undefined ? undefined : JSON.stringify(bodyValue)
      if (body !== undefined && metadata.maxRequestBytes !== undefined &&
          (!Number.isSafeInteger(metadata.maxRequestBytes) || metadata.maxRequestBytes < 0 ||
            new TextEncoder().encode(body).byteLength > metadata.maxRequestBytes)) {
        return failure("contract-mismatch")
      }
      const legacyMutation = mutating && /\{surface\}|\/dashboard$|\/planner$|\/procurement$/.test(metadata.pathTemplate)
      if (legacyMutation && !stamp) return failure("contract-unavailable")
      if (stamp && !sameStampInstallation(stamp, options.binding)) return failure("contract-mismatch")
      if (mutating && pending.size >= MUTATION_LIMIT && !pending.has(key!)) return failure("contract-unavailable")
      const digest = mutating ? await digestPayload(operation.operationId, route, body ?? "") : undefined
      if (mutating && digest === undefined) return failure("contract-unavailable")
      const ownerHeader = legacyMutation ? nativeOwnerHeader(stamp!) : undefined
      if (legacyMutation && !ownerHeader) return failure("contract-mismatch")
      if (mutating) {
        const previous = pending.get(key!)
        if (previous !== undefined) {
          // A lost response leaves an unresolved intent. Neither concurrent
          // dispatch nor a second execute is proof of source-side deduplication.
          return failure(previous === digest ? "outcome-unknown" : "contract-mismatch")
        }
        pending.set(key!, digest!)
      }
      if (!isCurrent() || call.signal.aborted) {
        if (mutating) pending.delete(key!)
        return failure("aborted")
      }

      const headers: Record<string, string> = { Accept: "application/json" }
      if (body !== undefined) headers["Content-Type"] = "application/json"
      if (key) headers["Idempotency-Key"] = key
      if (ownerHeader) headers["X-SF-Native-Owner"] = ownerHeader
      let dispatched = false
      let response: Readonly<{ status: number; headers: SfPublicHeaders; body: unknown }> | SfTransportFailure
      if (options.desktop && options.desktopBinding) {
        const owner = { bindingHandle: options.desktopBinding.bindingHandle, generation: options.generation }
        const requestId = crypto.randomUUID()
        const cancel = () => { void options.desktop?.abort({ ...owner, requestId }).catch(() => undefined) }
        call.signal.addEventListener("abort", cancel, { once: true })
        try {
          dispatched = true
          const result = await options.desktop.invoke({
            kind: "request", ...owner, requestId, operationId: operation.operationId,
            input: wireInput, ...(key ? { idempotencyKey: key } : {}),
          })
          if ("status" in result && (result.status === 401 || result.status === 403)) stamp = undefined
          if (result.kind === "transport-error") response = result
          else if (result.kind === "json-response" && metadata.responseMode === "json" &&
                   isJsonContentType(result.headers["content-type"])) {
            response = { status: result.status, headers: publicHeaders(result.headers), body: result.body }
          } else if (result.kind === "empty-response" && metadata.responseMode === "empty" &&
                     result.status === 204 && !result.headers["content-type"]) {
            response = { status: result.status, headers: publicHeaders(result.headers), body: undefined }
          }
          else response = failure("invalid-response")
        } catch {
          response = failure("network")
        } finally { call.signal.removeEventListener("abort", cancel) }
      } else {
        try {
          dispatched = true
          const result = await options.fetch(route, {
            method: metadata.method,
            credentials: "same-origin",
            cache: "no-store",
            redirect: "error",
            signal: call.signal,
            headers,
            ...(body !== undefined ? { body } : {}),
          })
          const extracted = publicHeaders(result.headers)
          if (result.status === 401 || result.status === 403) stamp = undefined
          if (metadata.responseMode === "empty") {
            response = result.status === 204 && !result.headers.get("content-type")
              ? { status: result.status, headers: extracted, body: undefined }
              : failure("invalid-response")
          } else if (!isJsonContentType(result.headers.get("content-type"))) {
            response = failure("invalid-response")
          } else {
            const wire = await readJsonBounded(result)
            response = wire === undefined ? failure("invalid-response") : { status: result.status, headers: extracted, body: wire }
          }
        } catch { response = failure("network") }
      }
      if (!isCurrent() || call.signal.aborted) {
        if (mutating && dispatched) return failure("outcome-unknown")
        return failure("aborted")
      }
      if ("kind" in response) {
        // Once invoked, only a confirmed producer response can settle a write.
        if (mutating && dispatched) return failure("outcome-unknown")
        if (mutating) pending.delete(key!)
        return response
      }
      if (!Number.isInteger(response.status) || response.status < 200 || response.status >= 600) return failure(mutating ? "outcome-unknown" : "invalid-response")
      if (response.status === 401 || response.status === 403) clear()
      // A 5xx after submission is not a durable negative mutation receipt.
      if (mutating && response.status >= 500) return failure("outcome-unknown")
      const uncertain = mutating && response.status !== 401 && response.status !== 403
      const wireDecoded = (() => {
        try { return codec.decodeOutput(response.body) }
        catch { return { status: "invalid" } as const }
      })()
      if (wireDecoded.status !== "ok") return failure(uncertain ? "outcome-unknown" : "invalid-response")
      const parsedOutput = Schema.decodeUnknownOption(Schema.toType(operation.output), { onExcessProperty: "error" })(wireDecoded.value)
      if (Option.isNone(parsedOutput)) return failure(uncertain ? "outcome-unknown" : "invalid-response")
      if (operation.operationId === "ctx.context") {
        if (!validContextOutcome(parsedOutput.value, options.binding, response.status)) {
          stamp = undefined
          return failure("invalid-response")
        }
        const result = parsedOutput.value
        if (typeof result === "object" && result !== null && "status" in result && result.status === "ok" && "value" in result && typeof result.value === "object" && result.value !== null && "stamp" in result.value && validContextStamp(result.value.stamp)) {
          stamp = result.value.stamp
        } else stamp = undefined
      }
      if (mutating) pending.delete(key!)
      return { kind: "response", status: response.status, headers: response.headers, body: parsedOutput.value }
    },
  }
  internals.set(transport, { binding: options.binding, fetch: options.fetch, current: isCurrent, clear })
  return transport
}

export function createSfAuthActions(options: Readonly<{
  binding: SfInstallationDescriptor
  desktop?: SfDesktopCapability
  desktopBinding?: SfDesktopBinding
  navigate: (validatedSameOriginUrl: string) => void
  transport: SfTransport
}>): Readonly<{ login(returnRoute: SfResolvedRoute): Promise<void>; logout(): Promise<void> }> {
  const internal = internals.get(options.transport)
  const owner = options.desktopBinding && { bindingHandle: options.desktopBinding.bindingHandle, generation: options.desktopBinding.generation }
  return {
    async login(returnRoute) {
      if (!internal || !internal.current() || !sameInstallation(options.binding, internal.binding)) throw new Error("SF_NATIVE_AUTH_CONTEXT_MISMATCH")
      if (String(returnRoute.ownerSelection.projectId) !== options.binding.projectId ||
          returnRoute.ownerSelection.installationId !== undefined && String(returnRoute.ownerSelection.installationId) !== options.binding.installationId) {
        throw new Error("SF_NATIVE_AUTH_CONTEXT_MISMATCH")
      }
      if (options.desktop && owner) {
        const result = await options.desktop.login({ ...owner, returnRoute })
        if (result.status !== "authenticated" || !sameStampInstallation(result.context.stamp, options.binding)) {
          throw new Error("SF_NATIVE_AUTH_NOT_CONFIRMED")
        }
        return
      }
      // An exact return-intents response codec is an I00 producer dependency.
      // Do not guess a JSON loginUrl or expand the original safeReturn policy.
      throw new Error("SF_NATIVE_RETURN_INTENT_CONTRACT_UNAVAILABLE")
    },
    async logout() {
      if (!internal || !sameInstallation(options.binding, internal.binding)) throw new Error("SF_NATIVE_AUTH_CONTEXT_MISMATCH")
      internal.clear()
      if (options.desktop && owner) {
        const result = await options.desktop.logout(owner)
        if (result.status !== "cleared") throw new Error("SF_NATIVE_LOCAL_LOGOUT_UNCONFIRMED")
        return
      }
      if (!internal.current() || typeof window === "undefined" || window.location.origin !== options.binding.publicOrigin) {
        throw new Error("SF_NATIVE_REMOTE_LOGOUT_UNAVAILABLE")
      }
      // Logout is the real identity handler, not a generic JSON RPC.
      try {
        const response = await internal.fetch(options.binding.publicOrigin + options.binding.mount + "/auth/logout", {
          method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error",
          headers: { "Idempotency-Key": crypto.randomUUID() },
        })
        if (response.status !== 204) throw new Error("SF_NATIVE_REMOTE_LOGOUT_UNCONFIRMED")
      } finally { internal.clear() }
    },
  }
}

function operationUrl(
  binding: SfInstallationDescriptor,
  meta: Readonly<{ method: "GET" | "POST"; pathTemplate: string; fixedQuery?: Readonly<Record<string, string>> }>,
  input: SfJson | undefined,
  operationId: SfOperationId,
): string | undefined {
  if (!meta.pathTemplate.startsWith("/") && !meta.pathTemplate.startsWith("{mount}/")) return undefined
  const source = asJsonObject(input)
  const surface = source?.surface
  const path = meta.pathTemplate
    .replaceAll("{mount}", binding.mount)
    .replaceAll("{surface}", typeof surface === "string" && SURFACES.has(surface) ? surface : "__unbound__")
  if (path.includes("{") || path.includes("}") || path.includes("__unbound__") || path.includes("//") || path.includes("..")) return undefined
  if (!path.startsWith(binding.mount + "/") && operationId !== "ctx.installations") return undefined
  try {
    const url = new URL(path, binding.publicOrigin)
    if (url.origin !== binding.publicOrigin || url.search || url.hash || url.pathname !== path) return undefined
    for (const [key, value] of Object.entries(meta.fixedQuery ?? {})) {
      if (!/^[a-zA-Z][a-zA-Z0-9._\[\]-]*$/.test(key) || value.includes("\n") || value.includes("\r")) return undefined
      url.searchParams.set(key, value)
    }
    if (meta.method === "GET" && input !== undefined) {
      if (!source) return undefined
      for (const [key, value] of Object.entries(source)) {
        if (key === "surface" && meta.pathTemplate.includes("{surface}")) continue
        if (!/^[a-zA-Z][a-zA-Z0-9._\[\]-]*$/.test(key) || url.searchParams.has(key)) return undefined
        if (typeof value === "string" || typeof value === "number" && Number.isFinite(value) || typeof value === "boolean") url.searchParams.set(key, String(value))
        else return undefined
      }
    }
    if (operationId === "ctx.context" &&
      (url.searchParams.size !== 3 ||
       url.searchParams.get("installationId") !== binding.installationId ||
       url.searchParams.get("projectId") !== binding.projectId ||
       url.searchParams.get("hostId") !== binding.hostId)) return undefined
    return url.href
  } catch { return undefined }
}

function operationBody(
  meta: Readonly<{ pathTemplate: string; fixedBodyDiscriminator?: Readonly<Record<string, string>> }>,
  input: SfJson | undefined,
): SfJson | undefined {
  const fixed = meta.fixedBodyDiscriminator ?? {}
  const source = asJsonObject(input)
  // A route selector is not a legacy producer body field.
  const value = source && meta.pathTemplate.includes("{surface}")
    ? Object.fromEntries(Object.entries(source).filter(([key]) => key !== "surface"))
    : source
  if (!Object.keys(fixed).length) return value ?? input ?? {}
  if (!value) return undefined
  if (Object.entries(fixed).some(([key, expected]) => key in value && value[key] !== expected)) return undefined
  return { ...value, ...fixed }
}

function asJsonObject(value: SfJson | undefined): Readonly<Record<string, SfJson>> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Readonly<Record<string, SfJson>> : undefined
}

function validInstallation(value: SfInstallationDescriptor): boolean {
  if (!MOUNT.test(value.mount) || value.contractRevision !== "sf-native-ui/1") return false
  if (![value.hostId, value.projectId, value.installationId].every((id) => typeof id === "string" && id.trim().length > 0)) return false
  try {
    const url = new URL(value.publicOrigin)
    if (url.origin !== value.publicOrigin || url.username || url.password) return false
    return value.authMode === "microsoft" && url.protocol === "https:" ||
      value.authMode === "local-operator" && url.protocol === "http:" &&
      (url.hostname === "127.0.0.1" || url.hostname === "[::1]")
  } catch { return false }
}

function sameInstallation(a: SfInstallationDescriptor, b: SfInstallationDescriptor): boolean {
  return a.installationId === b.installationId && a.projectId === b.projectId &&
    a.hostId === b.hostId && a.publicOrigin === b.publicOrigin && a.mount === b.mount &&
    a.contractRevision === b.contractRevision && a.authMode === b.authMode
}

function sameStampInstallation(stamp: SfContextStamp, binding: SfInstallationDescriptor): boolean {
  return stamp.installationId === binding.installationId &&
    stamp.projectId === binding.projectId && stamp.hostId === binding.hostId &&
    stamp.principalRef.trim().length > 0 && stamp.policyVersion.trim().length > 0 &&
    stamp.accessRevision.trim().length > 0
}

function validContextOutcome(value: unknown, binding: SfInstallationDescriptor, httpStatus: number): boolean {
  if (!value || typeof value !== "object" || !("status" in value)) return false
  if (value.status === "denied") return httpStatus === 403
  if (value.status === "unauthenticated") return httpStatus === 401
  if (value.status === "unavailable") return "reason" in value &&
    (value.reason === "contract-mismatch" ? httpStatus === 409 :
      (value.reason === "identity-unavailable" || value.reason === "host-unavailable") && httpStatus === 503)
  if (httpStatus !== 200 || value.status !== "ok" || !("value" in value) || !value.value || typeof value.value !== "object") return false
  const context = value.value
  return "stamp" in context && context.stamp !== null && typeof context.stamp === "object" &&
    validContextStamp(context.stamp) && sameStampInstallation(context.stamp, binding) &&
    "contractRevision" in context && context.contractRevision === "sf-native-ui/1" &&
    "authMode" in context && context.authMode === binding.authMode
}

function validContextStamp(value: unknown): value is SfContextStamp {
  if (!Schema.is(SfContextStamp)(value)) return false
  return [
    value.installationId, value.projectId, value.hostId,
    value.principalRef, value.policyVersion, value.accessRevision,
  ].every((field) => field.trim().length > 0)
}

function nativeOwnerHeader(stamp: SfContextStamp): string | undefined {
  const bytes = new TextEncoder().encode(JSON.stringify({
    installationId: stamp.installationId, hostId: stamp.hostId,
    projectId: stamp.projectId, principalRef: stamp.principalRef,
  }))
  if (bytes.byteLength > 2048) return undefined
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("")
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")
}

async function digestPayload(operationId: SfOperationId, route: string, body: string): Promise<string | undefined> {
  if (typeof crypto === "undefined" || !crypto.subtle) return undefined
  const bytes = new TextEncoder().encode(operationId + "\u0000" + route + "\u0000" + body)
  const digest = await crypto.subtle.digest("SHA-256", bytes).catch(() => undefined)
  return digest ? Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("") : undefined
}

function isJsonContentType(value: string | null | undefined): boolean {
  return typeof value === "string" && /^application\/json(?:\s*;[^\r\n]*)?$/i.test(value)
}

function publicHeaders(source: Headers | SfPublicHeaders): SfPublicHeaders {
  const header = (name: keyof SfPublicHeaders) => source instanceof Headers ? source.get(name) : source[name]
  const contentType = header("content-type")
  const disposition = header("content-disposition")
  const accessRevision = header("x-sf-access-revision")
  const reviewBinding = header("x-sf-review-binding")
  const contractRevision = header("x-sf-contract-revision")
  const safeDisposition = disposition && /^attachment;\s*filename="[^\/\\\r\n"]{1,160}"$/i.test(disposition) ? disposition : undefined
  return {
    ...(contentType && /^[^\r\n]{1,256}$/.test(contentType) ? { "content-type": contentType } : {}),
    ...(safeDisposition ? { "content-disposition": safeDisposition } : {}),
    ...(accessRevision && /^[^\r\n]{1,256}$/.test(accessRevision) ? { "x-sf-access-revision": accessRevision } : {}),
    ...(reviewBinding && /^[^\r\n]{1,256}$/.test(reviewBinding) ? { "x-sf-review-binding": reviewBinding } : {}),
    ...(contractRevision && /^[^\r\n]{1,256}$/.test(contractRevision) ? { "x-sf-contract-revision": contractRevision } : {}),
  }
}

/**
 * Bounded JSON ingestion: content-length is only a hint, so enforce the limit
 * on actual streamed bytes. Never render or log invalid producer JSON/HTML.
 */
async function readJsonBounded(response: Response): Promise<unknown | undefined> {
  const MAX_JSON_BYTES = 32 * 1024 * 1024
  const declared = response.headers.get("content-length")
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_JSON_BYTES)) return undefined
  const reader = response.body?.getReader()
  if (!reader) return undefined
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > MAX_JSON_BYTES) {
        await reader.cancel().catch(() => undefined)
        return undefined
      }
      chunks.push(chunk.value)
    }
    if (!size) return undefined
    const all = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.byteLength }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(all))
  } catch { return undefined }
  finally { reader.releaseLock() }
}
