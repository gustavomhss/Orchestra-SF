import type { SfContextStamp } from "@orchestra/schema/sucafina/context"

export type TeamSessionRetirement =
  | "refresh" | "stream" | "unverified" | "profile-change" | "logout" | "revoked" | "principal-change" | "dispose"

/** An equality fence for previously observed UI context, never an admission grant. */
export function sameTeamSessionContext(left: SfContextStamp, right: SfContextStamp): boolean {
  if (left.installationId !== right.installationId || left.projectId !== right.projectId ||
      left.hostId !== right.hostId || left.principalRef !== right.principalRef ||
      left.policyVersion !== right.policyVersion || left.accessRevision !== right.accessRevision) return false
  const a = left.team, b = right.team
  return !a || !b ? a === b :
    a.owner.profile.installationId === b.owner.profile.installationId &&
    a.owner.profile.tenantId === b.owner.profile.tenantId &&
    a.owner.profile.teamObjectId === b.owner.profile.teamObjectId &&
    a.owner.principal.tenantId === b.owner.principal.tenantId &&
    a.owner.principal.principalObjectId === b.owner.principal.principalObjectId &&
    a.revisions.configRevision === b.revisions.configRevision &&
    a.revisions.accessRevision === b.revisions.accessRevision
}
