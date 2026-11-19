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
import { SfContextStamp, SfContextResult, SfExpectedContextBinding,
  type SfContext, type SfInstallationDescriptor, type SfResolvedRoute,
} from "@orchestra/schema/sucafina/context"
import { SfSupplierCsvExportRequest, type SfSupplierCsvExportResult } from "@orchestra/schema/sucafina/procurement"
import {
  SF_FILE_BYTE_LIMIT, SF_FILE_MULTIPART_LIMIT, sfAllowedByteMime, sfFilesSourceQuery,
  sfIsByteOperation, sfIsUploadOperation, sfUploadSlot,
} from "./transport/files"

// Keep the Client public type identical to the canonical, browser-safe wire union.
export type { SfTransportResult } from "@orchestra/schema/sucafina/common"

export type SfCallOptions = Readonly<{
  signal: AbortSignal
  idempotencyKey?: string
  /** Only an explicit human retry of the last retained intent on this transport. */
  retry?: "same-intent"
}>
/** Browser fetch the transport actually invokes. Callers must not substitute a CORS workaround. */
export type SfTransportFetch = (...args: Parameters<typeof globalThis.fetch>) => ReturnType<typeof globalThis.fetch>
export type SfTransport = Readonly<{
  execute<Input, Output>(
    operation: SfOperation<Input, Output>,
    input: Input,
    options: SfCallOptions,
  ): Promise<SfTransportResult<Output>>
  /**
   * Exact admitted A06 supplier CSV byte source, NOT a generic byte dispatcher.
   * Optional until the I00-installed F02/D01 source adapter is composed.
   */
  downloadSupplierCsv?: (
    input: typeof SfSupplierCsvExportRequest.Type, options: SfCallOptions,
  ) => Promise<SfSupplierCsvExportResult>
}>

/** Main-only, owner-verified location lookup; not arbitrary renderer networking. */
export type SfDesktopLocationProbe = Readonly<{
  serverKey: string
  baseUrl: string
  credentials: SfConnectionCandidate["credentials"]
  location: Readonly<{ directory: string; workspace?: string }>
}>
export type SfDesktopLocationResult =
  | Readonly<{ status: "ok"; installations: readonly SfInstallationDescriptor[] }>
  | Readonly<{ status: "denied" }>
  | Readonly<{ status: "unavailable"; reason: "connection-unapproved" | "network" | "contract-mismatch" }>

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
  /** Optional until the original, main-owned location producer is composed. */
  discoverLocation?: (probe: SfDesktopLocationProbe) => Promise<SfDesktopLocationResult>
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
  fetch: SfTransportFetch
  current: () => boolean
  clear: () => void
}>
const internals = new WeakMap<SfTransport, SfInternal>()
const KEY = /^[A-Za-z0-9._:-]{8,128}$/
const MOUNT = /^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/
const SURFACES = new Set(["dashboard", "planner", "procurement"])
const MUTATION_LIMIT = 256
// These original producers reauthorize and replay their retained C08 receipt
// before CAS or side effects. This does not authorize automatic retry.
const HUMAN_RETRY_OPERATIONS: ReadonlySet<SfOperationId> = new Set([
  "decisions.decision-promote", "decisions.decision-choose",
  "collaboration.thread-create", "collaboration.thread-reply",
  "collaboration.thread-edit", "collaboration.answer-confirm",
])
type PendingMutation = Readonly<{ digest: string; owner?: SfContextStamp }>
type RetainedMutation = PendingMutation & Readonly<{ key: string; confirmed: boolean }>
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
  fetch: SfTransportFetch
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
  const pending = new Map<string, PendingMutation>()
  const retained = new Map<SfOperationId, RetainedMutation>()
  const mutationInFlight = new Set<string>()

  const clearIntents = () => { pending.clear(); retained.clear() }
  const clear = () => { stamp = undefined; clearIntents() }
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
      const upload = sfIsUploadOperation(operation.operationId)
        ? sfUploadSlot(operation.operationId, parsedInput.value) : undefined
      if (sfIsUploadOperation(operation.operationId) && !upload) return failure("contract-mismatch")
      const codecInput = upload && typeof parsedInput.value === "object" && parsedInput.value !== null
        ? Object.fromEntries(Object.entries(parsedInput.value).filter(([key]) => key !== "bytes"))
        : parsedInput.value
      const decoded = (() => {
        try { return codec.decodeInput(codecInput) }
        catch { return { status: "invalid" } as const }
      })()
      if (decoded.status !== "ok") return failure("contract-mismatch")
      const isBytes = metadata.responseMode === "bytes"
      if (isBytes !== sfIsByteOperation(operation.operationId) &&
          (isBytes || operation.operationId.startsWith("files.export.") ||
           operation.operationId === "files.asset.download")) return failure("contract-unavailable")
      if (metadata.responseMode !== "json" && metadata.responseMode !== "empty" && !isBytes)
        return failure("contract-unavailable")
      if (operation.operationId.startsWith("files.") && !stamp)
        return failure("contract-unavailable")
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
      const humanRetry = call.retry === "same-intent"
      if (call.retry !== undefined &&
          (call.retry !== "same-intent" || !mutating || !HUMAN_RETRY_OPERATIONS.has(operation.operationId)))
        return failure("contract-mismatch")
      if (postRead && call.idempotencyKey !== undefined) return failure("contract-mismatch")
      const key = metadata.method === "POST"
        ? postRead
          ? typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : undefined
          : call.idempotencyKey
        : undefined
      if (metadata.method === "POST" && (!key || !KEY.test(key))) return failure("contract-mismatch")
      if (metadata.method === "GET" && call.idempotencyKey !== undefined) return failure("contract-mismatch")
      const bodyValue = metadata.method === "POST"
        ? operation.operationId === "files.document-confirm" && asJsonObject(wireInput)
          ? asJsonObject(wireInput)?.evidence
          : operationBody(metadata, wireInput)
        : undefined
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
      // Bind each mutation intent to the actual bytes as well as its metadata,
      // without serializing a Uint8Array or creating an optimistic retry.
      const mutationOwner = mutating && stamp ? { ...stamp } : undefined
      const uploadDigest = upload ? await sha256Bytes(upload.bytes) : undefined
      if (upload && !uploadDigest) return failure("contract-unavailable")
      const digest = mutating ? await digestPayload(operation.operationId, route,
        (body ?? "") + (uploadDigest ? "\\u0000" + uploadDigest : "")) : undefined
      if (mutating && digest === undefined) return failure("contract-unavailable")
      const ownerHeader = legacyMutation && mutationOwner ? nativeOwnerHeader(mutationOwner) : undefined
      if (legacyMutation && !ownerHeader) return failure("contract-mismatch")
      const previous = mutating ? pending.get(key!) : undefined
      const last = retained.get(operation.operationId)
      const reportRetry = operation.operationId === "reviews.report.prepare"
      if (mutating) {
        if (mutationOwner && (!stamp || !equalContextStamp(mutationOwner, stamp)))
          return failure("contract-mismatch")
        if (humanRetry && (!last || last.key !== key || last.digest !== digest ||
            !last.owner || !stamp || !equalContextStamp(last.owner, stamp) ||
            !previous && !last.confirmed))
          return failure("contract-mismatch")
        if (!humanRetry && last && last.key === key) {
          if (last.digest !== digest || !last.owner || !stamp || !equalContextStamp(last.owner, stamp))
            return failure("contract-mismatch")
          return failure("outcome-unknown")
        }
        if (previous !== undefined) {
          if (previous.digest !== digest ||
              previous.owner && (!stamp || !equalContextStamp(previous.owner, stamp)))
            return failure("contract-mismatch")
          if (!reportRetry && !humanRetry) return failure("outcome-unknown")
        }
        if (mutationInFlight.has(key!)) return failure("outcome-unknown")
        // A retry keeps the original intent record, including a valid receipt
        // whose following read was lost. It may not adopt new owner/body/CAS.
        if (!previous) pending.set(key!, {
          digest: digest!, ...(mutationOwner ? { owner: mutationOwner } : {}),
        })
        mutationInFlight.add(key!)
      }
      try {
      if (!isCurrent() || call.signal.aborted) {
        if (mutating && previous === undefined) pending.delete(key!)
        return failure("aborted")
      }
      if (operation.operationId.startsWith("files.") && stamp &&
          !options.desktop &&
          !await refreshSfFileAuthority(options, stamp, operation.operationId)) {
        if (mutating) pending.delete(key!)
        return failure("contract-unavailable")
      }

      const headers: Record<string, string> = {
        Accept: operation.operationId === "files.export.xlsx" || operation.operationId === "files.export.members"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : operation.operationId === "files.export.json" ? "application/json"
          : operation.operationId === "files.export.suppliers" || operation.operationId === "files.export.register"
            ? "text/csv" : isBytes ? "application/octet-stream" : "application/json",
      }
      let requestBody: BodyInit | undefined = body
      if (upload && operation.operationId === "files.import-admit") {
        const fields = asJsonObject(wireInput)
        if (!fields || typeof fields.surface !== "string" ||
            typeof fields.selectionRef !== "string" || !fields.options) return failure("contract-mismatch")
        const form = new FormData()
        form.set("surface", fields.surface)
        form.set("selectionRef", fields.selectionRef)
        form.set("options", JSON.stringify(fields.options))
        form.set("file", new Blob([new Uint8Array(upload.bytes)], { type: upload.mediaType }), upload.fileName)
        requestBody = form
        if (upload.bytes.byteLength + 65_536 > SF_FILE_MULTIPART_LIMIT + 65_536) return failure("contract-mismatch")
      } else if (upload) {
        requestBody = new Uint8Array(upload.bytes)
        headers["Content-Type"] = upload.mediaType
      } else if (body !== undefined) headers["Content-Type"] = "application/json"
      if (key) headers["Idempotency-Key"] = key
      if (ownerHeader) headers["X-SF-Native-Owner"] = ownerHeader
      let dispatched = false
      const rememberIntent = () => {
        if (mutating && !humanRetry && mutationOwner && HUMAN_RETRY_OPERATIONS.has(operation.operationId))
          retained.set(operation.operationId, {
            key: key!, digest: digest!, owner: mutationOwner, confirmed: false,
          })
      }
      let response: Readonly<{ status: number; headers: SfPublicHeaders; body: unknown }> | SfTransportFailure
      if (options.desktop && options.desktopBinding) {
        const owner = { bindingHandle: options.desktopBinding.bindingHandle, generation: options.generation }
        const requestId = crypto.randomUUID()
        const cancel = () => { void options.desktop?.abort({ ...owner, requestId }).catch(() => undefined) }
        call.signal.addEventListener("abort", cancel, { once: true })
        try {
          dispatched = true
          rememberIntent()
          const result = await options.desktop.invoke({
            kind: "request", ...owner, requestId, operationId: operation.operationId,
            input: wireInput, ...(key ? { idempotencyKey: key } : {}),
            ...(upload ? { upload } : {}),
          })
          if ("status" in result && (result.status === 401 || result.status === 403)) clear()
          if (result.kind === "transport-error") response = result
          else if (result.kind === "byte-response" && isBytes && result.status === 200 &&
                   sfAllowedByteMime(operation.operationId, result.headers["content-type"])) {
            const parts: Uint8Array[] = []
            let size = 0
            let sequence = 0
            let completed = false
            while (size <= SF_FILE_BYTE_LIMIT && !completed && isCurrent() && !call.signal.aborted) {
              const part = await options.desktop.invoke({
                kind: "response-chunk", ...owner, requestId,
                responseHandle: result.responseHandle, sequence,
              })
              if (part.kind !== "byte-chunk" || part.sequence !== sequence ||
                  !(part.bytes instanceof Uint8Array) || part.bytes.byteLength > 64 * 1024 ||
                  part.done && part.bytes.byteLength !== 0) break
              sequence++
              if (part.done) { completed = true; break }
              if (part.bytes.byteLength === 0 || size + part.bytes.byteLength > SF_FILE_BYTE_LIMIT) break
              size += part.bytes.byteLength
              parts.push(new Uint8Array(part.bytes))
            }
            if (completed && isCurrent() && !call.signal.aborted) {
              const bytes = new Uint8Array(size)
              let at = 0
              for (const part of parts) { bytes.set(part, at); at += part.byteLength }
              response = { status: result.status, headers: publicHeaders(result.headers), body: bytes }
            } else response = failure("invalid-response")
            // Completion is followed by unconditional finally cleanup below.
          } else if (result.kind === "json-response" && metadata.responseMode === "json" &&
                   isJsonContentType(result.headers["content-type"])) {
            response = { status: result.status, headers: publicHeaders(result.headers), body: result.body }
          } else if (result.kind === "empty-response" && metadata.responseMode === "empty" &&
                     result.status === 204 && !result.headers["content-type"]) {
            response = { status: result.status, headers: publicHeaders(result.headers), body: undefined }
          }
          else response = failure("invalid-response")
        } catch {
          response = failure("network")
        } finally {
          // A failed or aborted chunk pull must not leave an owner-bound handle
          // or net stream alive. Main owns revocation, AbortController and cleanup.
          if (isBytes) await options.desktop.abort({ ...owner, requestId }).catch(() => undefined)
          call.signal.removeEventListener("abort", cancel)
        }
      } else {
        try {
          dispatched = true
          rememberIntent()
          const result = await options.fetch(route, {
            method: metadata.method,
            credentials: "same-origin",
            cache: "no-store",
            redirect: "error",
            signal: call.signal,
            headers,
            ...(requestBody !== undefined ? { body: requestBody } : {}),
          })
          const extracted = publicHeaders(result.headers)
          if (result.status === 401 || result.status === 403) clear()
          if (isBytes && (result.status === 401 || result.status === 403)) {
            clear()
            await result.body?.cancel().catch(() => undefined)
            response = failure("contract-unavailable")
          } else if (isBytes && result.status === 200) {
            const bytes = sfAllowedByteMime(operation.operationId, result.headers.get("content-type")) && stamp
              ? await readSfBytesBounded(result, call.signal, async () =>
                  isCurrent() && webOrigin() && !!stamp &&
                  await refreshSfFileAuthority(options, stamp, operation.operationId)) : undefined
            response = bytes
              ? { status: result.status, headers: extracted, body: bytes }
              : failure("invalid-response")
          } else if (metadata.responseMode === "empty") {
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
      if (isBytes) {
        if (response.status !== 200 || !(response.body instanceof Uint8Array))
          return failure("invalid-response")
        const parsedBytes = Schema.decodeUnknownOption(Schema.toType(operation.output))(response.body)
        if (Option.isNone(parsedBytes)) return failure("invalid-response")
        return { kind: "response", status: response.status, headers: response.headers, body: parsedBytes.value }
      }
      const wireDecoded = (() => {
        try { return codec.decodeOutput(response.body) }
        catch { return { status: "invalid" } as const }
      })()
      if (wireDecoded.status !== "ok") return failure(uncertain ? "outcome-unknown" : "invalid-response")
      const parsedOutput = Schema.decodeUnknownOption(Schema.toType(operation.output), { onExcessProperty: "error" })(wireDecoded.value)
      if (Option.isNone(parsedOutput)) return failure(uncertain ? "outcome-unknown" : "invalid-response")
      if (operation.operationId.startsWith("files.") && stamp && !options.desktop &&
          !await refreshSfFileAuthority(options, stamp, operation.operationId))
        return failure(mutating ? "outcome-unknown" : "contract-unavailable")
      if (operation.operationId === "ctx.context") {
        if (!validContextOutcome(parsedOutput.value, options.binding, response.status)) {
          clear()
          return failure("invalid-response")
        }
        const result = parsedOutput.value
        if (typeof result === "object" && result !== null && "status" in result && result.status === "ok" && "value" in result && typeof result.value === "object" && result.value !== null && "stamp" in result.value && validContextStamp(result.value.stamp)) {
          if (stamp && !equalContextStamp(stamp, result.value.stamp)) clearIntents()
          stamp = result.value.stamp
        } else clear()
      }
      if (mutating) {
        pending.delete(key!)
        const intent = retained.get(operation.operationId)
        if (intent && intent.key === key) {
          const result = parsedOutput.value
          if (response.status >= 200 && response.status < 300 &&
              typeof result === "object" && result !== null && "status" in result && result.status === "ok")
            retained.set(operation.operationId, { ...intent, confirmed: true })
          else retained.delete(operation.operationId)
        }
      }
      return { kind: "response", status: response.status, headers: response.headers, body: parsedOutput.value }
      } finally {
        if (mutating) mutationInFlight.delete(key!)
      }
    },
    /**
     * A06 original supplier CSV producer, exactly {mount}/procurement?download=suppliers.
     * No URL/navigation from the page and no fake JSON codec for the byte operation.
     * Original serveDownload owns roles/bank masking/order fields/audit/versions.
     * Source reauthorizes after generation; we independently rebind the principal,
     * policy and access revision via ctx.context before releasing any bytes to UI.
     */
    async downloadSupplierCsv(input, call): Promise<SfSupplierCsvExportResult> {
      const original = stamp
      if (!validBinding || !owned || !isCurrent() || (!options.desktop && !webOrigin()))
        return { status: "unavailable" }
      if (call.signal.aborted) return { status: "aborted" }
      if (!original || !sameStampInstallation(original, options.binding)) return { status: "unauthenticated" }
      if (call.idempotencyKey !== undefined) return { status: "invalid" }
      const parsed = Schema.decodeUnknownOption(
        Schema.toType(SfSupplierCsvExportRequest), { onExcessProperty: "error" },
      )(input)
      if (Option.isNone(parsed)) return { status: "invalid" }
      const meta = SfOperationRegistry["files.export.suppliers"]
      if (meta.method !== "GET" || meta.effect !== "read" ||
          meta.responseMode !== "bytes" || meta.pathTemplate !== "{mount}/{surface}" ||
          meta.fixedQuery.download !== "suppliers" ||
          Object.keys(meta.fixedQuery).length !== 1)
        return { status: "unavailable" }
      const route = operationUrl(options.binding, meta, parsed.value, "files.export.suppliers")
      if (!route) return { status: "invalid" }
      const isOwned = () => isCurrent() && !call.signal.aborted &&
        stamp !== undefined && equalContextStamp(stamp, original)
      const limit = 64 * 1024 * 1024
      const chunks: Uint8Array[] = []
      let total = 0
      const add = (chunk: Uint8Array) => {
        if (chunk.byteLength < 1 || chunk.byteLength > limit - total) return false
        chunks.push(chunk.slice())
        total += chunk.byteLength
        return true
      }
      const failure = (code: number): SfSupplierCsvExportResult =>
        code === 401 ? { status: "unauthenticated" } : code === 403 ? { status: "denied" } :
        code === 409 ? { status: "stale" } : { status: "unavailable" }
      try {
        if (options.desktop && options.desktopBinding) {
          const binding = options.desktopBinding
          const owner = { bindingHandle: binding.bindingHandle, generation: options.generation }
          const requestId = crypto.randomUUID()
          const cancel = () => { void options.desktop?.abort({ ...owner, requestId }).catch(() => undefined) }
          call.signal.addEventListener("abort", cancel, { once: true })
          try {
            const first = await options.desktop.invoke({
              kind: "request", ...owner, requestId, operationId: "files.export.suppliers",
              input: parsed.value,
            })
            if (!isOwned()) return { status: "aborted" }
            if ("status" in first && first.status !== 200) return failure(first.status)
            if (first.kind === "transport-error") return { status: "unavailable" }
            if (first.kind !== "byte-response" || first.status !== 200 ||
                !validSupplierCsvHeaders(first.headers["content-type"], first.headers["content-disposition"]))
              return { status: "invalid" }
            for (let sequence = 0; ; sequence++) {
              if (!isOwned()) return { status: "aborted" }
              const next = await options.desktop.invoke({
                kind: "response-chunk", ...owner, requestId,
                responseHandle: first.responseHandle, sequence,
              })
              if (!isOwned()) return { status: "aborted" }
              if (next.kind !== "byte-chunk" || next.sequence !== sequence) return { status: "invalid" }
              if (next.done) {
                if (next.bytes.byteLength !== 0) return { status: "invalid" }
                break
              }
              if (!add(next.bytes)) return { status: "invalid" }
            }
          } finally {
            call.signal.removeEventListener("abort", cancel)
            // The broker releases the completed request. Abort also closes a
            // partially consumed stream without transferring private bytes.
            await options.desktop.abort({ ...owner, requestId }).catch(() => undefined)
          }
        } else {
          const response = await options.fetch(route, {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            redirect: "error",
            signal: call.signal,
            headers: { Accept: "text/csv" },
          })
          if (!isOwned()) return { status: "aborted" }
          if (response.status !== 200) return failure(response.status)
          if (!validSupplierCsvHeaders(
            response.headers.get("content-type"), response.headers.get("content-disposition"),
          )) return { status: "invalid" }
          const reader = response.body?.getReader()
          if (!reader) return { status: "invalid" }
          try {
            for (;;) {
              if (!isOwned()) return { status: "aborted" }
              const next = await reader.read()
              if (!isOwned()) return { status: "aborted" }
              if (next.done) break
              if (!add(next.value)) return { status: "invalid" }
            }
          } finally {
            await reader.cancel().catch(() => undefined)
            reader.releaseLock()
          }
        }
        if (!isOwned() || !total) return { status: isOwned() ? "invalid" : "aborted" }
        // Fresh authenticated identity/policy check after the byte read,
        // before constructing a Blob/download handle.
        const live = await transport.execute({
          operationId: "ctx.context",
          input: SfExpectedContextBinding,
          output: SfContextResult,
        }, {
          installationId: options.binding.installationId,
          projectId: options.binding.projectId,
          hostId: options.binding.hostId,
        }, { signal: call.signal })
        if (!isCurrent() || call.signal.aborted) return { status: "aborted" }
        if (live.kind !== "response" || live.status !== 200 || live.body.status !== "ok")
          return { status: "denied" }
        const fresh = live.body.value
        if (!equalContextStamp(fresh.stamp, original)) return { status: "stale" }
        if (!fresh.destinations.some((d) => d.capabilityId === "CAP27" &&
            d.surface === "procurement" && d.page === "Suppliers" && d.canRead) ||
            !fresh.availability.some((r) =>
              r.family === "files" && r.resource === "exports" &&
              r.operations.some((o) => o.operationId === "files.export.suppliers" &&
                o.state === "ready" && o.operational)))
          return { status: "denied" }
        if (!isOwned()) return { status: "aborted" }
        const bytes = new Uint8Array(total)
        let offset = 0
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
        return {
          status: "ok",
          fileName: "suppliers.csv",
          mediaType: "text/csv; charset=utf-8",
          bytes,
          stamp: fresh.stamp,
        }
      } catch {
        return { status: call.signal.aborted || !isCurrent() ? "aborted" : "unavailable" }
      }
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

function equalContextStamp(a: SfContextStamp, b: SfContextStamp) {
  return a.installationId === b.installationId && a.projectId === b.projectId &&
    a.hostId === b.hostId && a.principalRef === b.principalRef &&
    a.policyVersion === b.policyVersion && a.accessRevision === b.accessRevision
}

function validSupplierCsvHeaders(contentType: string | null | undefined, disposition: string | null | undefined) {
  return typeof contentType === "string" &&
    /^text\/csv;\s*charset=utf-8$/i.test(contentType) &&
    typeof disposition === "string" &&
    /^attachment;\s*filename\*=UTF-8''suppliers\.csv$/i.test(disposition)
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
    const special = operationId.startsWith("files.") && source
      ? sfFilesSourceQuery(operationId, source) : undefined
    if (["files.import-targets","files.asset.link","files.asset.download","files.asset.upload","files.export.review",
      "files.document-open","files.document-scenario-targets"].includes(operationId) && !special)
      return undefined
    if (special) {
      for (const [key, value] of Object.entries(special)) {
        if (url.searchParams.has(key)) return undefined
        url.searchParams.set(key, value)
      }
    } else if (meta.method === "GET" && input !== undefined) {
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

/** F02 streaming. The declared size is a hint; every actual chunk is bounded. */
async function readSfBytesBounded(response: Response, signal: AbortSignal,
  recheck: () => Promise<boolean>): Promise<Uint8Array | undefined> {
  const declared = response.headers.get("content-length")
  if (declared !== null && (!/^(0|[1-9][0-9]*)$/.test(declared) ||
      Number(declared) > SF_FILE_BYTE_LIMIT)) {
    await response.body?.cancel().catch(() => undefined)
    return undefined
  }
  const reader = response.body?.getReader()
  if (!reader) return undefined
  const parts: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      if (signal.aborted || !await recheck()) { await reader.cancel(); return undefined }
      const part = await reader.read()
      if (part.done) break
      if (part.value.byteLength === 0) continue
      total += part.value.byteLength
      if (total > SF_FILE_BYTE_LIMIT) { await reader.cancel(); return undefined }
      parts.push(new Uint8Array(part.value))
    }
    if (signal.aborted || !await recheck() ||
        declared !== null && total !== Number(declared)) return undefined
    const result = new Uint8Array(total)
    let offset = 0
    for (const part of parts) { result.set(part, offset); offset += part.byteLength }
    return result
  } catch { return undefined }
  finally { reader.releaseLock() }
}
async function sha256Bytes(bytes: Uint8Array): Promise<string | undefined> {
  if (!crypto?.subtle) return undefined
  const value = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)).catch(() => undefined)
  return value ? Array.from(new Uint8Array(value), (b) => b.toString(16).padStart(2, "0")).join("") : undefined
}

/**
 * An authenticated original ctx.context request (never renderer-provided URL)
 * fences each web byte read against owner, policy and accessRevision changes.
 * Server producers separately reauthenticate record/export access at egress.
 */
async function refreshSfFileAuthority(options: Readonly<{
  binding: SfInstallationDescriptor; fetch: SfTransportFetch;
  operations: SfOperationBindings;
}>, expected: SfContextStamp, operationId: SfOperationId): Promise<boolean> {
  const meta = cataloguedRoute("ctx.context")
  const codec = options.operations["ctx.context"]
  if (!meta || !codec || meta.method !== "GET" || meta.responseMode !== "json") return false
  const tuple = { installationId: options.binding.installationId,
    projectId: options.binding.projectId, hostId: options.binding.hostId }
  const route = operationUrl(options.binding, meta, tuple, "ctx.context")
  if (!route) return false
  try {
    const reply = await options.fetch(route, {
      method: "GET", credentials: "same-origin", cache: "no-store", redirect: "error",
      headers: { Accept: "application/json" },
    })
    if (reply.status !== 200 || !isJsonContentType(reply.headers.get("content-type"))) return false
    const wire = await readJsonBounded(reply)
    if (wire === undefined) return false
    const context = codec.decodeOutput(wire)
    if (context.status !== "ok" || !validContextOutcome(context.value, options.binding, 200)) return false
    const value = context.value
    if (!value || typeof value !== "object" || !("status" in value) ||
        value.status !== "ok" || !("value" in value) || !value.value ||
        typeof value.value !== "object" || !("stamp" in value.value)) return false
    const current = value.value.stamp
    const availability = "availability" in value.value ? value.value.availability : undefined
    const permitted = Array.isArray(availability) && availability.some((resource: unknown) =>
      !!resource && typeof resource === "object" && "operations" in resource &&
      Array.isArray(resource.operations) && resource.operations.some((item: unknown) =>
        !!item && typeof item === "object" && "operationId" in item &&
        "state" in item && "operational" in item && item.operationId === operationId &&
        item.state === "ready" && item.operational === true))
    return permitted && validContextStamp(current) && sameStampInstallation(current, options.binding) &&
      current.principalRef === expected.principalRef &&
      current.policyVersion === expected.policyVersion &&
      current.accessRevision === expected.accessRevision
  } catch { return false }
}

// Reuse the public, already-exported transport entry for desktop protocol and broker.
export { sfAllowedByteMime, sfFilesSourceQuery, sfIsByteOperation, sfIsUploadOperation, SF_FILE_BYTE_LIMIT } from "./transport/files"
