import { Option, Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"

const Binding = Schema.Struct({
  installationId: TeamProfile.InstallationId,
  tenantId: TeamProfile.TenantId,
}).annotate({ parseOptions: { onExcessProperty: "error" } })

export type TeamProfilePolicyBinding = Readonly<Schema.Schema.Type<typeof Binding>>
export type TeamProfilePolicyCommand = Readonly<TeamProfile.AdminCommand>
export type TeamProfilePolicySource = Readonly<{ supremeAdminGroupId?: string; teams?: "direct" }>
export type TeamProfilePolicyRecord = Readonly<TeamProfile.AdminProfile>
export type TeamProfileCatalog = Readonly<{
  configRevision: number
  profiles: readonly TeamProfilePolicyRecord[]
}>
export type TeamProfilePolicyAudit = Readonly<{
  configRevision: number
  action: TeamProfilePolicyCommand["action"]
  profile: TeamProfile.Ref
  principal: TeamProfile.Principal
  at: number
}>
export type TeamProfilePolicyMutation =
  | Readonly<{ status: "ok"; configRevision: number; changed: boolean }>
  | Readonly<{ status: "conflict"; configRevision: number }>
  | Readonly<{ status: "not-found" }>
  | Readonly<{ status: "denied" }>

export function teamProfilePolicyBinding(value: unknown): TeamProfilePolicyBinding {
  return Object.freeze(Schema.decodeUnknownSync(Binding)(value))
}

export function teamProfilePolicyCommand(value: unknown): TeamProfilePolicyCommand | undefined {
  const parsed = Schema.decodeUnknownOption(TeamProfile.AdminCommand)(value)
  return Option.isSome(parsed) ? Object.freeze({ ...parsed.value, profile: Object.freeze(parsed.value.profile) }) : undefined
}

export function teamProfilePrincipal(value: unknown): TeamProfile.Principal {
  return Object.freeze(Schema.decodeUnknownSync(TeamProfile.Principal)(value))
}

export function teamProfileRef(binding: TeamProfilePolicyBinding, teamObjectId: string): TeamProfile.Ref {
  return Object.freeze(Schema.decodeUnknownSync(TeamProfile.Ref)({ ...binding, teamObjectId }))
}

export function sameTeamProfileBinding(profile: TeamProfilePolicyBinding, binding: TeamProfilePolicyBinding) {
  return profile.installationId === binding.installationId && profile.tenantId === binding.tenantId
}
