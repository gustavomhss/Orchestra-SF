import { Option, Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import type { SfContextStamp, SfOwnerSelection, SfReadableContext, SfRef, SfServerKey } from "@orchestra/schema/sucafina/context"

/** Presentation selectors only. These helpers never admit a principal or Team. */
export const sfOwnerQueryKeys = ["server", "project", "installation", "contractRevision", "installationId", "tenantId", "teamObjectId"] as const
const legacyKeys = ["server", "project", "installation"] as const
const teamKeys = ["contractRevision", "server", "installationId", "tenantId", "teamObjectId"] as const
export type SfParsedOwnerQuery =
  | Readonly<{ kind: "absent" }>
  | Readonly<{ kind: "invalid" }>
  | Readonly<{ kind: "legacy"; serverKey: string; projectId: string; installationId: string }>
  | Readonly<{ kind: "team"; serverKey: string; profile: TeamProfile.Ref }>

export function sfSameTeamRef(left: TeamProfile.Ref | undefined, right: TeamProfile.Ref | undefined): boolean {
  return !left || !right ? left === right :
    left.installationId === right.installationId && left.tenantId === right.tenantId &&
    left.teamObjectId === right.teamObjectId
}

export function sfParseOwnerQuery(params: URLSearchParams): SfParsedOwnerQuery {
  const entries = [...params].filter(([key]) => sfOwnerQueryKeys.some((name) => name === key))
  if (!entries.length) return { kind: "absent" }
  if (entries.some(([, value]) => !value || value.length > 4096) ||
      new Set(entries.map(([key]) => key)).size !== entries.length) return { kind: "invalid" }
  const owns = (keys: readonly string[]) => entries.length === keys.length && entries.every(([key]) => keys.includes(key))
  if (owns(teamKeys) && params.get("contractRevision") === "sf-team-profile/1") {
    const decoded = Schema.decodeUnknownOption(TeamProfile.Ref, { onExcessProperty: "error" })({
      installationId: params.get("installationId"), tenantId: params.get("tenantId"), teamObjectId: params.get("teamObjectId"),
    })
    return Option.isSome(decoded) ? { kind: "team", serverKey: params.get("server")!, profile: decoded.value } : { kind: "invalid" }
  }
  if (owns(legacyKeys)) return { kind: "legacy", serverKey: params.get("server")!,
    projectId: params.get("project")!, installationId: params.get("installation")! }
  return { kind: "invalid" }
}

export function sfOwnerQueryValid(params: URLSearchParams): boolean {
  return sfParseOwnerQuery(params).kind !== "invalid"
}

/** Team URLs contain the complete versioned Ref, never the physical ProjectId. */
export function sfOwnerQuery(selection: SfOwnerSelection): Record<string, string> {
  if (!selection.serverKey || !selection.installationId) throw new Error("SF_OWNER_SELECTOR_INCOMPLETE")
  if (selection.team) {
    // A Solid Store adds non-JSON tracking symbols to its proxy. Snapshot every
    // enumerable JSON field, including unknown fields, before applying the same
    // closed public codec. The schema still rejects extra JSON properties.
    const parsed = Schema.decodeUnknownOption(TeamProfile.Ref, { onExcessProperty: "error" })(
      Object.fromEntries(Object.entries(selection.team)),
    )
    if (Option.isNone(parsed) || parsed.value.installationId !== selection.installationId)
      throw new Error("SF_OWNER_SELECTOR_MISMATCH")
    return { contractRevision: "sf-team-profile/1", server: selection.serverKey,
      installationId: parsed.value.installationId, tenantId: parsed.value.tenantId,
      teamObjectId: parsed.value.teamObjectId }
  }
  if (!selection.projectId) throw new Error("SF_OWNER_SELECTOR_INCOMPLETE")
  return { server: selection.serverKey, project: selection.projectId, installation: selection.installationId }
}

export function sfAppendOwnerQuery(params: URLSearchParams, selection: SfOwnerSelection): void {
  if (sfParseOwnerQuery(params).kind !== "absent") throw new Error("SF_OWNER_SELECTOR_ALREADY_PRESENT")
  for (const [key, value] of Object.entries(sfOwnerQuery(selection))) params.set(key, value)
}

/** The current runtime supplies placement; an incoming Team selector cannot supply or change it. */
export function sfSelectionFromQuery(params: URLSearchParams, current: SfOwnerSelection): SfOwnerSelection | undefined {
  const parsed = sfParseOwnerQuery(params)
  if (parsed.kind === "invalid") return
  if (parsed.kind === "absent") return current
  if (parsed.kind === "team") {
    if (!current.team || parsed.serverKey !== current.serverKey ||
        parsed.profile.installationId !== current.installationId ||
        parsed.profile.tenantId !== current.team.tenantId) return
    return { serverKey: current.serverKey, projectId: current.projectId,
      installationId: current.installationId, team: parsed.profile }
  }
  if (current.team) return
  return { serverKey: parsed.serverKey as SfServerKey, projectId: parsed.projectId as SfRef,
    installationId: parsed.installationId as SfRef }
}

export function sfSameOwnerSelection(left: SfOwnerSelection, right: SfOwnerSelection): boolean {
  return left.serverKey === right.serverKey && left.projectId === right.projectId &&
    left.installationId === right.installationId && sfSameTeamRef(left.team, right.team)
}

export function sfOwnerMatchesContext(context: SfReadableContext, selection: SfOwnerSelection): boolean {
  if (context.stamp.projectId !== selection.projectId ||
      selection.installationId !== undefined && context.stamp.installationId !== selection.installationId) return false
  if (context.contractRevision === "sf-team-profile/1")
    return !!selection.team && !!context.stamp.team && sfSameTeamRef(selection.team, context.stamp.team.owner.profile)
  return selection.team === undefined && context.stamp.team === undefined
}

export function sfSameContextStamp(left: SfContextStamp, right: SfContextStamp): boolean {
  if (left.installationId !== right.installationId || left.projectId !== right.projectId ||
      left.hostId !== right.hostId || left.principalRef !== right.principalRef ||
      left.policyVersion !== right.policyVersion || left.accessRevision !== right.accessRevision) return false
  const a = left.team, b = right.team
  return !a || !b ? a === b : sfSameTeamRef(a.owner.profile, b.owner.profile) &&
    a.owner.principal.tenantId === b.owner.principal.tenantId &&
    a.owner.principal.principalObjectId === b.owner.principal.principalObjectId &&
    a.revisions.configRevision === b.revisions.configRevision &&
    a.revisions.accessRevision === b.revisions.accessRevision
}
