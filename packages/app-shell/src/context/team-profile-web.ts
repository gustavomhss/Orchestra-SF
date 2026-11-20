import { Option, Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { SfInstallationList, SfTeamContextQuery, SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import { createSfTeamContextClient } from "@orchestra/client/sucafina/context"
import { createSfTransport, type SfTransportFetch } from "@orchestra/client/sucafina/transport"
import { SfNativeOperationBindings } from "@orchestra/client/sucafina/bindings"
import type { TeamProfileSelectionDependencies } from "./team-profile-selection"

/** Public metadata for the explicitly loaded Web host. It does not authenticate a user. */
export async function readCurrentTeamInstallation(input: Readonly<{
  origin: string; browserOrigin: string; fetch: SfTransportFetch; signal: AbortSignal
}>): Promise<SfTeamInstallationDescriptor | undefined> {
  let origin: URL
  try { origin = new URL(input.origin) } catch { return }
  if (origin.origin !== input.origin || origin.origin !== input.browserOrigin || origin.username || origin.password ||
      origin.search || origin.hash || origin.pathname !== "/" || origin.protocol !== "https:") return
  if (input.signal.aborted) return
  const url = new URL("/api/sucafina/installations", origin)
  url.search = new URLSearchParams({ select: "current", contractRevision: "sf-team-profile/1" }).toString()
  const abort = new AbortController(), stopped = Promise.withResolvers<undefined>()
  const stop = () => { abort.abort(); stopped.resolve(undefined) }
  const timer = setTimeout(stop, 10000)
  input.signal.addEventListener("abort", stop, { once: true })
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  try {
    if (input.signal.aborted) return
    const response = await Promise.race([input.fetch(url.href, { method: "GET", signal: abort.signal,
      credentials: "same-origin", cache: "no-store", redirect: "error", headers: { Accept: "application/json" } }), stopped.promise])
    if (!response || abort.signal.aborted || response.status !== 200 ||
        response.headers.get("cache-control") !== "no-store" ||
        !/^application\/json(?:\s*;[^\r\n]*)?$/i.test(response.headers.get("content-type") ?? "")) return
    const declared = response.headers.get("content-length")
    if (declared !== null && (!/^(0|[1-9][0-9]*)$/.test(declared) || Number(declared) > 16384)) return
    reader = response.body?.getReader()
    if (!reader) return
    let length = 0
    const parts: Uint8Array[] = []
    for (;;) {
      const next = await Promise.race([reader.read(), stopped.promise])
      if (!next || abort.signal.aborted) return
      if (next.done) break
      length += next.value.byteLength
      if (length > 16384) return
      parts.push(next.value)
    }
    if (!length || declared !== null && Number(declared) !== length) return
    const bytes = new Uint8Array(length)
    let offset = 0
    for (const part of parts) { bytes.set(part, offset); offset += part.byteLength }
    const list = Schema.decodeUnknownOption(SfInstallationList, { onExcessProperty: "error" })(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
    )
    if (Option.isNone(list) || list.value.installations.length !== 1 || abort.signal.aborted) return
    const binding = list.value.installations[0]
    if (!Schema.is(SfTeamInstallationDescriptor)(binding) || binding.publicOrigin !== input.origin) return
    return binding
  } catch (error) {
    if (!abort.signal.aborted) console.error("Teams installation metadata unavailable", error instanceof Error ? error.name : "unknown")
    return undefined
  } finally {
    clearTimeout(timer); input.signal.removeEventListener("abort", stop); stop()
    if (reader) { void reader.cancel().catch(() => undefined); reader.releaseLock() } // Cleanup must not block the bounded read.
  }
}

export function teamContextQuery(binding: SfTeamInstallationDescriptor, selector: TeamProfile.Selector): SfTeamContextQuery {
  return Schema.decodeUnknownSync(SfTeamContextQuery, { onExcessProperty: "error" })({
    contractRevision: "sf-team-profile/1", installationId: binding.installationId, tenantId: binding.tenantId,
    hostId: binding.hostId, kind: selector.kind,
    ...(selector.kind === "team" ? { teamObjectId: selector.profile.teamObjectId } : {}),
  })
}

/** The same real F02 transport that authenticated the context is returned to the UI owner. */
export function teamWebContextReader(binding: SfTeamInstallationDescriptor, fetch: SfTransportFetch): TeamProfileSelectionDependencies["read"] {
  return async (selector: TeamProfile.Selector, signal: AbortSignal, generation: number, currentGeneration: () => number) => {
    const transport = createSfTransport({ binding, teamSelector: selector, generation, currentGeneration,
      operations: SfNativeOperationBindings, fetch })
    const response = await createSfTeamContextClient(transport)["ctx.context"](teamContextQuery(binding, selector), { signal })
    return { transport, result: response.kind === "response" ? response.body : {
      status: "unavailable", reason: response.reason === "contract-mismatch" || response.reason === "invalid-response"
        ? "contract-mismatch" : "host-unavailable",
    } }
  }
}

/** Login returns to the native Web root; no legacy surface, token or private URL is retained. */
export function teamWebLoginUrl(binding: SfTeamInstallationDescriptor, browserOrigin: string): string | undefined {
  if (!Schema.is(SfTeamInstallationDescriptor)(binding) || binding.publicOrigin !== browserOrigin ||
      !/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(binding.mount) ||
      !URL.canParse(binding.publicOrigin) || new URL(binding.publicOrigin).origin !== binding.publicOrigin ||
      new URL(binding.publicOrigin).protocol !== "https:") return
  const url = new URL(binding.mount + "/auth/login", binding.publicOrigin)
  url.search = new URLSearchParams({ returnTo: "/" }).toString()
  return url.href
}
