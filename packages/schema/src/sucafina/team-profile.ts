/**
 * Browser-safe Teams profile contracts. This additive module does not replace
 * sf-native-ui/1 or admit a request. Every selector and decoded projection is
 * untrusted until the owning server verifies the current Microsoft principal,
 * installation, membership, policy and resource grants.
 */
import { Schema } from "effect"
import { NonNegativeInt } from "../schema"

export * as TeamProfile from "./team-profile"

export const ContractRevision = Schema.Literal("sf-team-profile/1")
  .annotate({ identifier: "Sucafina.TeamProfile.ContractRevision" })
export type ContractRevision = typeof ContractRevision.Type

const OpaqueText = Schema.NonEmptyString.check(
  Schema.isMaxLength(256),
  Schema.isTrimmed(),
  Schema.isPattern(/^[^\u0000-\u001f\u007f]+$/),
)

// The Microsoft reader validates and canonicalizes IDs before constructing a
// projection. Requiring one complete lowercase GUID spelling prevents aliases;
// this codec never derives an identity from a name, path, email or Project ID.
const MicrosoftObjectId = Schema.String.check(
  Schema.isPattern(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
)

export const InstallationId = OpaqueText.pipe(Schema.brand("Sucafina.TeamProfile.InstallationId"))
  .annotate({ identifier: "Sucafina.TeamProfile.InstallationId" })
export type InstallationId = typeof InstallationId.Type

export const TenantId = MicrosoftObjectId.pipe(Schema.brand("Sucafina.TeamProfile.TenantId"))
  .annotate({ identifier: "Sucafina.TeamProfile.TenantId" })
export type TenantId = typeof TenantId.Type

export const PrincipalObjectId = MicrosoftObjectId.pipe(Schema.brand("Sucafina.TeamProfile.PrincipalObjectId"))
  .annotate({ identifier: "Sucafina.TeamProfile.PrincipalObjectId" })
export type PrincipalObjectId = typeof PrincipalObjectId.Type

export const TeamObjectId = MicrosoftObjectId.pipe(Schema.brand("Sucafina.TeamProfile.TeamObjectId"))
  .annotate({ identifier: "Sucafina.TeamProfile.TeamObjectId" })
export type TeamObjectId = typeof TeamObjectId.Type

/** Preserve the producer's revision type and bytes; never coerce "1" to 1. */
export const ConfigRevision = Schema.Union([OpaqueText, NonNegativeInt])
  .annotate({ identifier: "Sucafina.TeamProfile.ConfigRevision" })
export type ConfigRevision = typeof ConfigRevision.Type

/**
 * One opaque effective authority revision, issued and revalidated by the
 * server. It includes current policy/grant/membership changes, independently
 * of the shared profile configuration revision. Possessing it is not access.
 */
export const AccessRevision = OpaqueText
  .annotate({ identifier: "Sucafina.TeamProfile.AccessRevision" })
export type AccessRevision = typeof AccessRevision.Type

/** Shared configuration identity. Personal state additionally requires Principal. */
export const Ref = Schema.Struct({
  installationId: InstallationId,
  tenantId: TenantId,
  teamObjectId: TeamObjectId,
}).annotate({
  identifier: "Sucafina.TeamProfile.Ref",
  parseOptions: { onExcessProperty: "error" },
})
export interface Ref extends Schema.Schema.Type<typeof Ref> {}

/** tenantId is the resource tenant, including for a B2B guest. */
export const Principal = Schema.Struct({
  tenantId: TenantId,
  principalObjectId: PrincipalObjectId,
}).annotate({
  identifier: "Sucafina.TeamProfile.Principal",
  parseOptions: { onExcessProperty: "error" },
})
export interface Principal extends Schema.Schema.Type<typeof Principal> {}

export const Revisions = Schema.Struct({
  configRevision: ConfigRevision,
  accessRevision: AccessRevision,
}).annotate({
  identifier: "Sucafina.TeamProfile.Revisions",
  parseOptions: { onExcessProperty: "error" },
})
export interface Revisions extends Schema.Schema.Type<typeof Revisions> {}

export const Owner = Schema.Struct({
  profile: Ref,
  principal: Principal,
}).check(Schema.makeFilter(
  (owner) => owner.profile.tenantId === owner.principal.tenantId,
  { message: "The profile and principal must belong to the same resource tenant" },
)).annotate({
  identifier: "Sucafina.TeamProfile.Owner",
  parseOptions: { onExcessProperty: "error" },
})
export interface Owner extends Schema.Schema.Type<typeof Owner> {}

export const Binding = Schema.Struct({
  owner: Owner,
  revisions: Revisions,
}).annotate({
  identifier: "Sucafina.TeamProfile.Binding",
  parseOptions: { onExcessProperty: "error" },
})
export interface Binding extends Schema.Schema.Type<typeof Binding> {}
