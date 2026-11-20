import { Option, Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import type { SfTransportFailure, SfTransportResult } from "@orchestra/schema/sucafina/common"
import type { SfCallOptions, SfTransportFetch } from "./transport"

/** Shared configuration only. Corporate group admission remains at the original server endpoint. */
export function createSfTeamProfileClient(options: Readonly<{
  binding: SfTeamInstallationDescriptor
  generation: number
  currentGeneration: () => number
  fetch: SfTransportFetch
}>): Readonly<{
  list(options: SfCallOptions): Promise<SfTransportResult<TeamProfile.AdminListResult>>
  configure(command: TeamProfile.AdminCommand, options: SfCallOptions): Promise<SfTransportResult<TeamProfile.AdminConfigureResult>>
}> {
  const binding = structuredClone(options.binding)
  const bindingText = JSON.stringify(binding)
  const current = () => options.generation === options.currentGeneration() &&
    JSON.stringify(options.binding) === bindingText
  const valid = Schema.is(SfTeamInstallationDescriptor)(binding) &&
    /^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(binding.mount) &&
    URL.canParse(binding.publicOrigin) && new URL(binding.publicOrigin).origin === binding.publicOrigin &&
    new URL(binding.publicOrigin).protocol === "https:"
  const url = valid ? new URL(binding.mount + "/api/ui/team-profiles", binding.publicOrigin) : undefined
  if (url) url.search = new URLSearchParams({ contractRevision: "sf-team-profile/1",
    installationId: binding.installationId, tenantId: binding.tenantId }).toString()

  const send = async <Output>(
    schema: Schema.Schema<Output>, command: TeamProfile.AdminCommand | undefined, call: SfCallOptions,
  ): Promise<SfTransportResult<Output>> => {
    const fail = (reason: SfTransportFailure["reason"]): SfTransportFailure => ({ kind: "transport-error", reason })
    if (!valid || !url || !current() || typeof window === "undefined" || window.location.origin !== binding.publicOrigin)
      return fail("contract-mismatch")
    if (call.signal.aborted) return fail("aborted")
    if (call.idempotencyKey !== undefined || call.retry !== undefined) return fail("contract-mismatch")
    if (command && (!Schema.is(TeamProfile.AdminCommand)(command) ||
      command.profile.installationId !== binding.installationId || command.profile.tenantId !== binding.tenantId))
      return fail("contract-mismatch")
    const body = command ? JSON.stringify(command) : undefined
    if (body && new TextEncoder().encode(body).byteLength > 8192) return fail("contract-mismatch")
    const controller = new AbortController()
    const stopped = Promise.withResolvers<undefined>()
    const abort = () => { controller.abort(); stopped.resolve(undefined) }
    call.signal.addEventListener("abort", abort, { once: true })
    const timer = setTimeout(abort, 30000)
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
    let dispatched = false
    try {
      if (call.signal.aborted || !current()) return fail("aborted")
      dispatched = true
      const response = await Promise.race([options.fetch(url.href, {
        method: command ? "POST" : "GET", credentials: "same-origin", cache: "no-store", redirect: "error",
        signal: controller.signal,
        headers: { Accept: "application/json", ...(command ? { "Content-Type": "application/json" } : {}) },
        ...(body ? { body } : {}),
      }), stopped.promise])
      if (!response || controller.signal.aborted || !current())
        return fail(command ? "outcome-unknown" : call.signal.aborted ? "aborted" : "network")
      if (!/^application\/json(?:\s*;[^\r\n]*)?$/i.test(response.headers.get("content-type") ?? "") ||
        response.headers.get("cache-control") !== "no-store") return fail(command ? "outcome-unknown" : "invalid-response")
      const declared = response.headers.get("content-length")
      if (declared !== null && (!/^(0|[1-9][0-9]*)$/.test(declared) || Number(declared) > 4 * 1024 * 1024))
        return fail(command ? "outcome-unknown" : "invalid-response")
      reader = response.body?.getReader()
      if (!reader) return fail(command ? "outcome-unknown" : "invalid-response")
      const parts: Uint8Array[] = []
      let size = 0
      for (;;) {
        const part = await Promise.race([reader.read(), stopped.promise])
        if (!part || controller.signal.aborted || !current())
          return fail(command ? "outcome-unknown" : call.signal.aborted ? "aborted" : "network")
        if (part.done) break
        size += part.value.byteLength
        if (size > 4 * 1024 * 1024) return fail(command ? "outcome-unknown" : "invalid-response")
        parts.push(part.value)
      }
      if (!size || declared !== null && Number(declared) !== size)
        return fail(command ? "outcome-unknown" : "invalid-response")
      const bytes = new Uint8Array(size)
      let offset = 0
      for (const part of parts) { bytes.set(part, offset); offset += part.byteLength }
      const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
      const parsed = Schema.decodeUnknownOption(Schema.toType(schema), { onExcessProperty: "error" })(value)
      if (Option.isNone(parsed) || !validStatus(value, response.status) || controller.signal.aborted || !current() ||
        Schema.is(TeamProfile.AdminListResult)(value) && value.status === "ok" &&
          value.profiles.some((entry) => entry.profile.installationId !== binding.installationId || entry.profile.tenantId !== binding.tenantId))
        return fail(command ? "outcome-unknown" : "invalid-response")
      return { kind: "response", status: response.status,
        headers: { "content-type": response.headers.get("content-type")! }, body: parsed.value }
    } catch {
      return fail(command && dispatched ? "outcome-unknown" : call.signal.aborted ? "aborted" : "network")
    } finally {
      clearTimeout(timer)
      call.signal.removeEventListener("abort", abort)
      controller.abort()
      if (reader) {
        void reader.cancel().catch(() => undefined)
        reader.releaseLock()
      }
    }
  }
  return Object.freeze({
    list: (call: SfCallOptions) => send(TeamProfile.AdminListResult, undefined, call),
    configure: (command: TeamProfile.AdminCommand, call: SfCallOptions) => send(TeamProfile.AdminConfigureResult, command, call),
  })
}

function validStatus(value: unknown, status: number): boolean {
  if (!value || typeof value !== "object" || !("status" in value)) return false
  if (value.status === "ok") return status === 200
  if (value.status === "unauthenticated") return status === 401
  if (value.status === "denied") return status === 403
  if (value.status === "invalid-request") return [400, 405, 408, 413, 415].includes(status)
  if (value.status === "not-found") return status === 404
  if (value.status === "conflict") return status === 409
  return value.status === "unavailable" && status === 503
}
