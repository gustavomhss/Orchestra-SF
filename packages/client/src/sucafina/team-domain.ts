import { Option, Schema } from "effect"
import { SfContextStamp, SfTeamContext, SfTeamContextResult, SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import { SfDomain } from "@orchestra/schema/sucafina/domain"
import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import type { SfOperation, SfTransportFailure, SfTransportResult } from "@orchestra/schema/sucafina/common"
import type { SfCallOptions, SfTransport, SfTransportFetch } from "./transport"

const capabilities = ["CAP14", "CAP04", "CAP05"] as const
const failure = (reason: SfTransportFailure["reason"]): SfTransportFailure => ({ kind: "transport-error", reason })
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024

/**
 * Browser-only Team transport for the existing three domain families. The
 * current context is an observation, never authorization: each operation first
 * re-reads the original Team F02, and the server independently re-admits it.
 */
export function createSfTeamDomainTransport(options: Readonly<{
  binding: SfTeamInstallationDescriptor
  context: () => SfTeamContext | undefined
  generation: number
  currentGeneration: () => number
  fetch: SfTransportFetch
}>): SfTransport {
  const parsed = Schema.decodeUnknownOption(SfTeamInstallationDescriptor, { onExcessProperty: "error" })(options.binding)
  const binding = Option.isSome(parsed) ? parsed.value : undefined
  const used = new Set<string>()
  const uncertain = new Set<string>()
  const inFlight = new Set<string>()
  const transport: SfTransport = {
    async execute<Input, Output>(operation: SfOperation<Input, Output>, input: Input, call: SfCallOptions): Promise<SfTransportResult<Output>> {
      if (!binding || !validOrigin(binding.publicOrigin) || !/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(binding.mount) ||
        typeof window === "undefined" || window.location.origin !== binding.publicOrigin) return failure("contract-mismatch")
      if (call.signal.aborted) return failure("aborted")
      const initial = options.context()
      if (!initial || !Schema.is(SfTeamContext)(initial) || !initial.stamp.team || !matches(initial, binding)) return failure("contract-unavailable")
      const stamp = stampKey(initial.stamp)
      const profile = { ...initial.stamp.team.owner.profile }
      const current = () => options.generation === options.currentGeneration() && !call.signal.aborted &&
        window.location.origin === binding.publicOrigin && stampKey(options.context()?.stamp) === stamp
      if (!current()) return failure("contract-mismatch")
      const selected = capabilities.find((cap) => operation.operationId === "domain.page." + cap ||
        operation.operationId.startsWith("domain.command." + cap + "."))
      if (!selected || !(operation.operationId in SfDomain.operations)) return failure("contract-unavailable")
      const canonical = SfDomain.operations[operation.operationId as keyof typeof SfDomain.operations]
      if (!Object.is(operation, canonical)) return failure("contract-mismatch")
      const metadata = SfOperationRegistry[operation.operationId]
      const mutating = metadata.method === "POST"
      if (metadata.responseMode !== "json" || (mutating ? metadata.effect !== "mutation" ||
        metadata.pathTemplate !== "{mount}/dashboard" : metadata.method !== "GET" || metadata.effect !== "read" ||
        metadata.pathTemplate !== "{mount}/api/ui/pages/" + selected)) return failure("contract-unavailable")
      if (call.retry !== undefined || (mutating ? !call.idempotencyKey ||
        !/^[A-Za-z0-9._:-]{8,128}$/.test(call.idempotencyKey) : call.idempotencyKey !== undefined))
        return failure("contract-mismatch")
      if (mutating && (used.has(call.idempotencyKey!) || used.size >= 256 || inFlight.has(operation.operationId)))
        return failure(uncertain.has(operation.operationId) ? "outcome-unknown" : "contract-mismatch")
      if (uncertain.has(operation.operationId)) return failure("outcome-unknown")
      const decoded = Schema.decodeUnknownOption(Schema.toType(operation.input), { onExcessProperty: "error" })(input)
      if (Option.isNone(decoded)) return failure("contract-mismatch")
      const json = Schema.decodeUnknownOption(Schema.Json)(decoded.value)
      if (Option.isNone(json) || !json.value || typeof json.value !== "object" || Array.isArray(json.value))
        return failure("contract-mismatch")
      const url = new URL(binding.mount + (mutating ? "/teams/" + profile.teamObjectId + "/dashboard" : "/api/ui/pages/" + selected), binding.publicOrigin)
      if (mutating && "fixedQuery" in metadata)
        Object.entries(metadata.fixedQuery).forEach(([key, value]) => url.searchParams.set(key, value))
      if (!mutating) Object.entries(json.value).forEach(([key, value]) => {
        if (value !== undefined && value !== null) url.searchParams.set(key, String(value))
      })
      if (url.search.length > 4096) return failure("contract-mismatch")
      const fixed = mutating && "fixedBodyDiscriminator" in metadata ? metadata.fixedBodyDiscriminator : undefined
      if (mutating && (!fixed || Object.entries(fixed).some(([key, value]) => key in json.value && json.value[key] !== value)))
        return failure("contract-mismatch")
      const body = mutating ? JSON.stringify({ ...json.value, ...fixed }) : undefined
      if (body && new TextEncoder().encode(body).byteLength > 2 * 1024 * 1024) return failure("contract-mismatch")
      const fresh = async () => {
        const contextUrl = new URL(binding.mount + "/api/ui/context", binding.publicOrigin)
        contextUrl.search = new URLSearchParams({
          contractRevision: "sf-team-profile/1", installationId: binding.installationId,
          tenantId: binding.tenantId, hostId: binding.hostId, kind: "team", teamObjectId: profile.teamObjectId,
        }).toString()
        if (!current()) return
        const response = await options.fetch(contextUrl, {
          signal: call.signal, method: "GET", credentials: "same-origin", cache: "no-store", redirect: "error",
          mode: "same-origin", headers: { Accept: "application/json" },
        })
        if (!current() || response.status !== 200 || !sameResponseOrigin(response, contextUrl)) return
        const raw = await readJson(response)
        const result = Schema.decodeUnknownOption(SfTeamContextResult, { onExcessProperty: "error" })(raw)
        if (!current() || Option.isNone(result) || result.value.status !== "ok" ||
          !matches(result.value.value, binding) || stampKey(result.value.value.stamp) !== stamp) return
        return result.value.value
      }
      let dispatched = false
      let claimed = false
      try {
        const admitted = await fresh()
        if (!admitted || !current()) return failure("contract-unavailable")
        const destination = admitted.destinations.find((entry) => entry.capabilityId === selected)
        const available = admitted.availability.find((entry) => entry.family === "domain-read" && entry.resource === selected)
        const ready = available?.operations.find((entry) => entry.operationId === operation.operationId)
        if (!destination?.canRead || ready?.state !== "ready" || !ready.operational ||
          mutating && !destination.allowedActionIds.includes(operation.operationId.split(".")[3]!))
          return failure("contract-unavailable")
        if (mutating && (used.has(call.idempotencyKey!) || inFlight.has(operation.operationId)))
          return failure("contract-mismatch")
        const headers: Record<string, string> = { Accept: "application/json", "X-SF-Team-Profile": JSON.stringify({
          contractRevision: "sf-team-profile/1", kind: "team", profile,
        }) }
        if (mutating) {
          headers["Content-Type"] = "application/json"
          headers["Idempotency-Key"] = call.idempotencyKey!
          headers["X-SF-Access-Revision"] = admitted.stamp.accessRevision
          headers["X-SF-Native-Owner"] = ownerHeader(admitted)
          used.add(call.idempotencyKey!)
          inFlight.add(operation.operationId)
          claimed = true
        }
        if (!current()) return failure("aborted")
        dispatched = true
        const response = await options.fetch(url, { method: metadata.method, body, headers,
          signal: call.signal, credentials: "same-origin", mode: "same-origin", cache: "no-store", redirect: "error" })
        if (!current() || !sameResponseOrigin(response, url) || mutating && response.status >= 500)
          return failure(mutating ? "outcome-unknown" : "contract-mismatch")
        const wire = await readJson(response)
        const output = Schema.decodeUnknownOption(Schema.toType(operation.output), { onExcessProperty: "error" })(wire)
        if (!current() || Option.isNone(output)) return failure(mutating ? "outcome-unknown" : "invalid-response")
        if (!mutating && wire && typeof wire === "object" && "status" in wire && wire.status === "ok" &&
          (!("context" in wire) || stampKey(wire.context) !== stamp)) return failure("contract-mismatch")
        if (!await fresh() || !current()) return failure(mutating ? "outcome-unknown" : "contract-unavailable")
        if (!mutating && wire && typeof wire === "object" && "status" in wire &&
          (wire.status === "ok" ? response.status !== 200 : wire.status === "denied" ? response.status !== 403 :
            wire.status === "unauthenticated" ? response.status !== 401 : wire.status === "stale" ? response.status !== 409 :
              wire.status === "needs-input" ? response.status !== 400 : response.status !== 503))
          return failure("invalid-response")
        if (mutating && wire && typeof wire === "object" && "ok" in wire &&
          (wire.ok === true ? response.status !== 200 : !("status" in wire) || wire.status !== response.status))
          return failure("outcome-unknown")
        uncertain.delete(operation.operationId)
        inFlight.delete(operation.operationId)
        return { kind: "response", status: response.status, headers: {
          ...(response.headers.get("content-type") ? { "content-type": response.headers.get("content-type")! } : {}),
          ...(response.headers.get("cache-control") ? { "cache-control": response.headers.get("cache-control")! } : {}),
        }, body: output.value }
      } catch {
        return failure(mutating && dispatched ? "outcome-unknown" : call.signal.aborted ? "aborted" : "network")
      } finally {
        if (claimed && !dispatched) { used.delete(call.idempotencyKey!); inFlight.delete(operation.operationId) }
        if (claimed && dispatched) {
          // Only a complete original response + reread clears the uncertain slot.
          // Failure before returning that response cannot authorize another POST.
          if (inFlight.has(operation.operationId)) uncertain.add(operation.operationId)
          inFlight.delete(operation.operationId)
        }
      }
    },
  }
  return Object.freeze(transport)
}
function validOrigin(value: string) {
  try { const url = new URL(value); return url.protocol === "https:" && url.origin === value && !url.username && !url.password }
  catch { return false }
}
function matches(context: SfTeamContext, binding: SfTeamInstallationDescriptor) {
  return context.contractRevision === "sf-team-profile/1" && context.authMode === "microsoft" &&
    context.stamp.installationId === binding.installationId && context.stamp.projectId === binding.projectId &&
    context.stamp.hostId === binding.hostId && context.profile.principal.tenantId === binding.tenantId &&
    !!context.stamp.team && context.stamp.team.owner.profile.installationId === binding.installationId &&
    context.stamp.team.owner.profile.tenantId === binding.tenantId
}
function ownerHeader(context: SfTeamContext) {
  const value = JSON.stringify({ installationId: context.stamp.installationId, projectId: context.stamp.projectId,
    hostId: context.stamp.hostId, principalRef: context.stamp.principalRef })
  const binary = Array.from(new TextEncoder().encode(value), (byte) => String.fromCharCode(byte)).join("")
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")
}
function sameResponseOrigin(response: Response, url: URL) {
  return !response.redirected && (!response.url || response.url === url.href) &&
    response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() === "application/json"
}
async function readJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader()
  if (!reader) return undefined
  const parts: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      size += next.value.byteLength
      if (size > MAX_RESPONSE_BYTES) { await reader.cancel(); return undefined }
      parts.push(next.value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength }
  const value = Schema.decodeUnknownOption(Schema.UnknownFromJsonString)(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
  return Option.isSome(value) ? value.value : undefined
}

function stampKey(value: unknown) {
  if (!Schema.is(SfContextStamp)(value) || !value.team) return undefined
  const owner = value.team.owner
  return JSON.stringify([value.installationId, value.projectId, value.hostId, value.principalRef,
    value.policyVersion, value.accessRevision, owner.profile.installationId, owner.profile.tenantId,
    owner.profile.teamObjectId, owner.principal.tenantId, owner.principal.principalObjectId,
    value.team.revisions.configRevision, value.team.revisions.accessRevision])
}
