import { Option, Schema } from "effect"
import { ConnectionAccess } from "@orchestra/schema/connection-access"
import { ProviderAccess } from "@orchestra/schema/provider-access"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import type { SfTransportFailure, SfTransportResult } from "@orchestra/schema/sucafina/common"
import type { SfCallOptions, SfTransportFetch } from "./transport"

const strict = { onExcessProperty: "error" } as const
const CatalogResult = Schema.Union([ProviderAccess.Catalog, Schema.Struct({
  status: Schema.Literals(["denied", "unavailable", "invalid-request"]),
})])
export type SfPersonalCatalogResult = typeof CatalogResult.Type
const sameOwner = (left: TeamProfile.Owner, right: TeamProfile.Owner) =>
  left.profile.installationId === right.profile.installationId && left.profile.tenantId === right.profile.tenantId &&
  left.profile.teamObjectId === right.profile.teamObjectId && left.principal.tenantId === right.principal.tenantId &&
  left.principal.principalObjectId === right.principal.principalObjectId
const keyText = (key: ConnectionAccess.Key) => JSON.stringify([key.category, key.resourceId, key.id])
const failed = (reason: SfTransportFailure["reason"]): SfTransportFailure => ({ kind: "transport-error", reason })

/** Response namespaces and catalog keys constrain this window's presentation.
 * They are never authority: the installed endpoint admits every original
 * Request independently using its Microsoft cookie, Team intent and current ACL. */
export function createSfPersonalConnections(input: Readonly<{
  binding: SfTeamInstallationDescriptor
  owner: TeamProfile.Owner
  current(): boolean
  signal: AbortSignal
  fetch: SfTransportFetch
}>) {
  const binding = Schema.decodeUnknownSync(SfTeamInstallationDescriptor, strict)(structuredClone(input.binding))
  const owner = Schema.decodeUnknownSync(TeamProfile.Owner, strict)(structuredClone(input.owner))
  const origin = new URL(binding.publicOrigin)
  if (origin.protocol !== "https:" || origin.origin !== binding.publicOrigin || origin.username || origin.password ||
      !/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(binding.mount) ||
      owner.profile.installationId !== binding.installationId || owner.profile.tenantId !== binding.tenantId)
    throw new Error("SF_PERSONAL_CONNECTION_BINDING_INVALID")
  const life = new AbortController(), keys = new Set<string>(), slots = new Map<string, ConnectionAccess.Slot>()
  let namespace: TeamProfile.SessionNamespace | undefined
  const retire = () => { life.abort(); keys.clear(); slots.clear(); namespace = undefined }
  input.signal.addEventListener("abort", retire, { once: true })
  if (input.signal.aborted) retire()
  const current = () => !life.signal.aborted && !input.signal.aborted && input.current() &&
    typeof window === "object" && window.location.origin === binding.publicOrigin
  const inspect = (value: TeamProfile.SessionNamespace, initialize = false) => {
    if (!current() || !sameOwner(owner, value.owner) ||
        namespace && namespace.authorityGeneration !== value.authorityGeneration || !namespace && !initialize) {
      retire(); return false
    }
    namespace ??= structuredClone(value)
    return true
  }
  const send = async <Output>(schema: Schema.Schema<Output>, path: string, call: SfCallOptions,
    command?: ConnectionAccess.PersonalCommand, key?: ConnectionAccess.PersonalKey): Promise<SfTransportResult<Output>> => {
    if (call.signal.aborted || !current()) return failed("aborted")
    if (call.idempotencyKey !== undefined || call.retry !== undefined) return failed("contract-mismatch")
    const endpoint = new URL(binding.mount + path, binding.publicOrigin)
    if (key) endpoint.search = new URLSearchParams({ category: key.category, resourceId: key.resourceId, id: key.id }).toString()
    const body = command ? JSON.stringify(command) : undefined
    if (body && new TextEncoder().encode(body).byteLength > 32768) return failed("contract-mismatch")
    const controller = new AbortController(), stopped = Promise.withResolvers<undefined>()
    const abort = () => { controller.abort(); stopped.resolve(undefined) }
    call.signal.addEventListener("abort", abort, { once: true })
    life.signal.addEventListener("abort", abort, { once: true })
    const timer = setTimeout(abort, 30000)
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined, dispatched = false
    const failure = (reason: SfTransportFailure["reason"]) => failed(command && dispatched ? "outcome-unknown" : reason)
    try {
      if (call.signal.aborted || !current()) return failed("aborted")
      dispatched = true
      const response = await Promise.race([input.fetch(endpoint.href, {
        method: command ? "POST" : "GET", credentials: "same-origin", mode: "same-origin",
        cache: "no-store", redirect: "error", signal: controller.signal,
        headers: { Accept: "application/json", "x-sf-team-profile": JSON.stringify({
          contractRevision: "sf-team-profile/1", kind: "team", profile: owner.profile,
        }), ...(command ? { "Content-Type": "application/json" } : {}) },
        ...(body ? { body } : {}),
      }), stopped.promise])
      reader = response?.body?.getReader()
      if (!response || controller.signal.aborted || !current()) return failure(call.signal.aborted ? "aborted" : "network")
      if (!/^application\/json(?:\s*;[^\r\n]*)?$/i.test(response.headers.get("content-type") ?? "") ||
          response.headers.get("cache-control") !== "no-store") return failure("invalid-response")
      const declared = response.headers.get("content-length"), limit = path === "/api/provider/catalog" ? 4 * 1024 * 1024 : 65536
      if (declared !== null && (!/^(0|[1-9][0-9]*)$/.test(declared) || Number(declared) > limit)) return failure("invalid-response")
      if (!reader) return failure("invalid-response")
      const parts: Uint8Array[] = []
      let size = 0
      for (;;) {
        const part = await Promise.race([reader.read(), stopped.promise])
        if (!part || controller.signal.aborted || !current()) return failure(call.signal.aborted ? "aborted" : "network")
        if (part.done) break
        size += part.value.byteLength
        if (size > limit) return failure("invalid-response")
        parts.push(part.value)
      }
      if (!size || declared !== null && Number(declared) !== size) return failure("invalid-response")
      const bytes = new Uint8Array(size)
      let offset = 0
      for (const part of parts) { bytes.set(part, offset); offset += part.byteLength }
      const json = Schema.decodeUnknownOption(Schema.UnknownFromJsonString)(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      )
      if (Option.isNone(json)) return failure("invalid-response")
      const parsed = Schema.decodeUnknownOption(Schema.toCodecJson(schema), strict)(json.value)
      if (Option.isNone(parsed) || !current() || controller.signal.aborted || !validStatus(parsed.value, response.status))
        return failure("invalid-response")
      return { kind: "response", status: response.status,
        headers: { "content-type": response.headers.get("content-type")! }, body: parsed.value }
    } catch {
      return failure(call.signal.aborted ? "aborted" : "network")
    } finally {
      clearTimeout(timer)
      call.signal.removeEventListener("abort", abort); life.signal.removeEventListener("abort", abort)
      controller.abort()
      if (reader) {
        void reader.cancel().catch(() => undefined) // Cleanup cannot keep a retired request or secret alive.
        reader.releaseLock()
      }
    }
  }
  return Object.freeze({
    async catalog(call: SfCallOptions): Promise<SfTransportResult<SfPersonalCatalogResult>> {
      const result = await send(CatalogResult, "/api/provider/catalog", call)
      if (result.kind !== "response" || !("namespace" in result.body)) {
        keys.clear(); slots.clear()
        return result
      }
      if (!inspect(result.body.namespace, true)) return failed("invalid-response")
      keys.clear(); slots.clear()
      for (const provider of result.body.providers) keys.add(keyText(provider.connection))
      return result
    },
    async read(key: ConnectionAccess.PersonalKey, call: SfCallOptions): Promise<SfTransportResult<ConnectionAccess.PersonalMetadataResult>> {
      const parsed = Schema.decodeUnknownOption(ConnectionAccess.PersonalKey, strict)(key)
      if (Option.isNone(parsed) || !namespace || !keys.has(keyText(parsed.value))) return failed("contract-mismatch")
      slots.delete(keyText(parsed.value))
      const result = await send(ConnectionAccess.PersonalMetadataResult, "/api/connection/personal", call, undefined, parsed.value)
      if (result.kind !== "response" || result.body.status !== "available") return result
      if (!inspect(result.body.namespace) || keyText(result.body.connection.key) !== keyText(parsed.value))
        return failed("invalid-response")
      slots.set(keyText(parsed.value), structuredClone(result.body.connection))
      return result
    },
    async command(command: ConnectionAccess.PersonalCommand, call: SfCallOptions): Promise<SfTransportResult<ConnectionAccess.PersonalCommandResult>> {
      const parsed = Schema.decodeUnknownOption(ConnectionAccess.PersonalCommand, strict)(command)
      if (Option.isNone(parsed) || !namespace || !keys.has(keyText(parsed.value.key))) return failed("contract-mismatch")
      const value = parsed.value, observed = slots.get(keyText(value.key))
      if (!observed || observed.revision !== value.expectedRevision ||
          value.action === "create" && observed.state === "active" ||
          value.action !== "create" && observed.state !== "active") return failed("contract-mismatch")
      // A new attempt always requires a later explicit read, even after a lost response.
      slots.delete(keyText(value.key))
      const result = await send(ConnectionAccess.PersonalCommandResult, "/api/connection/personal", call, value)
      if (result.kind !== "response") return result
      if (result.body.status === "unavailable") return failed("outcome-unknown")
      if (result.body.status !== "saved" && result.body.status !== "removed") return result
      const metadata = result.body.connection
      if (!inspect(result.body.namespace) || keyText(metadata.key) !== keyText(value.key) ||
          value.action === "remove" && (result.body.status !== "removed" ||
            metadata.revision !== value.expectedRevision && metadata.revision !== value.expectedRevision + 1) ||
          value.action !== "remove" && (result.body.status !== "saved" ||
            metadata.revision !== value.expectedRevision + 1 || metadata.label !== value.label))
        return failed("outcome-unknown")
      return result
    },
    dispose() { input.signal.removeEventListener("abort", retire); retire() },
  })
}

function validStatus(value: unknown, status: number): boolean {
  if (!value || typeof value !== "object") return false
  if (!("status" in value)) return "providers" in value && "namespace" in value && status === 200
  if (value.status === "available" || value.status === "saved" || value.status === "removed") return status === 200
  if (value.status === "denied") return status === 403
  if (value.status === "unavailable") return status === 503
  if (value.status === "conflict") return status === 409
  return value.status === "invalid-request" && [400, 405, 408, 413, 415].includes(status)
}
