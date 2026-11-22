import { Option, Schema } from "effect"
import { SfInstallationList, SfTeamContextResult, SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"

const mountPath = /^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/

export async function readCurrentTeamInstallation(signal: AbortSignal) {
  const origin = window.location.origin
  if (window.location.protocol !== "https:") return
  const url = new URL("/api/sucafina/installations", origin)
  url.search = new URLSearchParams({ select: "current", contractRevision: "sf-team-profile/1" }).toString()
  const response = await getJson(url, signal, 16_384)
  if (response?.status !== 200) return
  const list = Schema.decodeUnknownOption(SfInstallationList, { onExcessProperty: "error" })(response.body)
  if (Option.isNone(list) || list.value.installations.length !== 1) return
  const binding = list.value.installations[0]
  if (Schema.is(SfTeamInstallationDescriptor)(binding) && binding.publicOrigin === origin && mountPath.test(binding.mount))
    return binding
}

export async function readTeamWebContext(binding: SfTeamInstallationDescriptor, signal: AbortSignal, teamObjectId?: string): Promise<Extract<SfTeamContextResult, { status: "ok" | "unauthenticated" | "denied" }> | undefined> {
  const url = new URL(binding.mount + "/api/ui/context", binding.publicOrigin)
  url.search = new URLSearchParams({
    contractRevision: binding.contractRevision,
    installationId: binding.installationId,
    hostId: binding.hostId,
    tenantId: binding.tenantId,
    kind: teamObjectId ? "team" : "selection",
    ...(teamObjectId ? { teamObjectId } : {}),
  }).toString()
  const response = await getJson(url, signal, 1_048_576)
  if (!response) return
  const decoded = Schema.decodeUnknownOption(SfTeamContextResult, { onExcessProperty: "error" })(response.body)
  if (Option.isNone(decoded)) return
  const result = decoded.value
  if (result.status === "unauthenticated" && response.status === 401) return result
  if (result.status === "denied" && response.status === 403) return result
  if (result.status !== "ok" || response.status !== 200) return
  const { stamp, profile } = result.value
  if (stamp.installationId !== binding.installationId || stamp.hostId !== binding.hostId ||
      stamp.projectId !== binding.projectId || profile.principal.tenantId !== binding.tenantId ||
      profile.teams.status === "ready" && !stamp.team ||
      profile.teams.status !== "ready" && stamp.team ||
      stamp.team && (stamp.team.owner.principal.tenantId !== profile.principal.tenantId ||
        stamp.team.owner.principal.principalObjectId !== profile.principal.principalObjectId) ||
      teamObjectId && profile.teams.status === "ready" && profile.teams.selected.teamObjectId !== teamObjectId) return
  return result
}

async function getJson(url: URL, signal: AbortSignal, limit: number) {
  if (url.origin !== window.location.origin || signal.aborted) return
  try {
    const response = await fetch(url, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      headers: { Accept: "application/json" },
    })
    const reader = response.body?.getReader()
    if (!reader) return
    try {
      if (response.headers.get("cache-control") !== "no-store" ||
          !/^application\/json(?:\s*;[^\r\n]*)?$/i.test(response.headers.get("content-type") ?? "")) return
      const decoder = new TextDecoder("utf-8", { fatal: true })
      let length = 0
      let json = ""
      for (;;) {
        const chunk = await reader.read()
        if (chunk.done) break
        length += chunk.value.byteLength
        if (length > limit) return
        json += decoder.decode(chunk.value, { stream: true })
      }
      if (!signal.aborted) return { status: response.status, body: JSON.parse(json + decoder.decode()) as unknown }
    } finally {
      void reader.cancel().catch(() => undefined)
      reader.releaseLock()
    }
  } catch {
    return undefined
  }
}
