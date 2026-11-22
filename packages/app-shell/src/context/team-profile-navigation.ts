import { Option, Schema } from "effect"
import type { SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"

type TeamNavigationIntent = Extract<TeamProfile.Selector, { kind: "selection" | "team" }>
const paths = ["/", "/orchestra/sf-home", "/orchestra/sf-home/context"]
const names = ["contractRevision", "server", "installationId", "tenantId", "teamObjectId"]

/** Decode navigation intent only. Discovery and the current Microsoft context remain authoritative. */
export function readTeamNavigationIntent(url: URL, binding: SfTeamInstallationDescriptor): TeamNavigationIntent | undefined {
  if (url.protocol !== "https:" || url.origin !== binding.publicOrigin || url.username || url.password || url.hash ||
      !paths.includes(url.pathname) || /%(?![\da-fA-F]{2})/.test(url.search)) return
  const params = url.searchParams
  if (params.size === 0) return {
    contractRevision: binding.contractRevision, kind: "selection",
    installationId: binding.installationId, tenantId: binding.tenantId,
  }
  if ((params.size !== 4 && params.size !== 5) ||
      [...params.keys()].some((key) => !names.includes(key) || params.getAll(key).length !== 1) ||
      params.get("server") !== binding.publicOrigin) return
  const parsed = Schema.decodeUnknownOption(TeamProfile.Selector, { onExcessProperty: "error" })({
    contractRevision: params.get("contractRevision"),
    ...(params.has("teamObjectId") ? {
      kind: "team",
      profile: {
        installationId: params.get("installationId"), tenantId: params.get("tenantId"),
        teamObjectId: params.get("teamObjectId"),
      },
    } : {
      kind: "selection", installationId: params.get("installationId"), tenantId: params.get("tenantId"),
    }),
  })
  if (Option.isNone(parsed) || parsed.value.kind === "administration") return
  const profile = parsed.value.kind === "team" ? parsed.value.profile : parsed.value
  if (profile.installationId !== binding.installationId || profile.tenantId !== binding.tenantId) return
  return parsed.value
}

/** Call only after the original context has confirmed this profile. No authority is stored in history. */
export function teamNavigationURL(url: URL, binding: SfTeamInstallationDescriptor, profile: TeamProfile.Ref) {
  if (!readTeamNavigationIntent(url, binding)) return
  const result = new URL(url.href)
  result.search = new URLSearchParams({
    contractRevision: binding.contractRevision, server: binding.publicOrigin,
    installationId: profile.installationId, tenantId: profile.tenantId, teamObjectId: profile.teamObjectId,
  }).toString()
  return readTeamNavigationIntent(result, binding)?.kind === "team" ? result : undefined
}

/** The identity handler independently validates this relative path and closed query on login and callback. */
export function teamNavigationReturnTo(url: URL, binding: SfTeamInstallationDescriptor) {
  if (readTeamNavigationIntent(url, binding)) return url.pathname + url.search
}
