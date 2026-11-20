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

/**
 * Selectors never carry a claimed principal, role, grant or authority revision.
 * Administration is a separate route intent; it cannot stand in for a Team.
 * Raw URL duplicate-key rejection belongs to the transport parser.
 */
export const Selector = Schema.Union([
  Schema.Struct({
    contractRevision: ContractRevision,
    kind: Schema.Literal("team"),
    profile: Ref,
  }),
  Schema.Struct({
    contractRevision: ContractRevision,
    kind: Schema.Literal("administration"),
    installationId: InstallationId,
    tenantId: TenantId,
  }),
]).annotate({
  identifier: "Sucafina.TeamProfile.Selector",
  parseOptions: { onExcessProperty: "error" },
})
export type Selector = Schema.Schema.Type<typeof Selector>

export const Choice = Schema.Struct({
  profile: Ref,
  displayName: Schema.NonEmptyString.check(Schema.isMaxLength(256)),
}).annotate({
  identifier: "Sucafina.TeamProfile.Choice",
  parseOptions: { onExcessProperty: "error" },
})
export interface Choice extends Schema.Schema.Type<typeof Choice> {}

const Choices = Schema.Array(Choice).check(Schema.makeFilter(
  (choices) => new Set(choices.map((choice) => JSON.stringify([
    choice.profile.installationId,
    choice.profile.tenantId,
    choice.profile.teamObjectId,
  ]))).size === choices.length,
  { message: "A Team may occur only once in the eligible profile list" },
))

export const UnavailableReason = Schema.Literals([
  "identity-unavailable",
  "consent-required",
  "forbidden",
  "rate-limited",
  "timeout",
  "incomplete",
  "invalid-response",
  "provider-unavailable",
]).annotate({ identifier: "Sucafina.TeamProfile.UnavailableReason" })
export type UnavailableReason = typeof UnavailableReason.Type

/**
 * A complete eligible list is required for ready/selection-required/no-teams.
 * Provider failure and partial data have no eligible-list field and cannot be
 * represented as a successful empty result.
 */
export const TeamState = Schema.Union([
  Schema.Struct({
    status: Schema.Literal("ready"),
    choices: Choices.check(Schema.isMinLength(1)),
    selected: Ref,
    configRevision: ConfigRevision,
  }).check(Schema.makeFilter(
    (state) => state.choices.some((choice) =>
      choice.profile.installationId === state.selected.installationId &&
      choice.profile.tenantId === state.selected.tenantId &&
      choice.profile.teamObjectId === state.selected.teamObjectId),
    { message: "The selected profile must occur in the complete eligible list" },
  )),
  Schema.Struct({
    status: Schema.Literal("selection-required"),
    choices: Choices.check(Schema.isMinLength(2)),
  }),
  Schema.Struct({ status: Schema.Literal("no-teams") }),
  Schema.Struct({ status: Schema.Literal("denied") }),
  Schema.Struct({ status: Schema.Literal("revoked") }),
  Schema.Struct({
    status: Schema.Literal("unavailable"),
    reason: UnavailableReason,
  }),
]).annotate({
  identifier: "Sucafina.TeamProfile.TeamState",
  parseOptions: { onExcessProperty: "error" },
})
export type TeamState = Schema.Schema.Type<typeof TeamState>

/**
 * The server checks the configured corporate administration group separately
 * from Teams enumeration. An available administrative destination grants no
 * business access, Team membership or visibility into personal content.
 */
export const Administration = Schema.Union([
  Schema.Struct({ status: Schema.Literal("available") }),
  Schema.Struct({ status: Schema.Literal("denied") }),
  Schema.Struct({
    status: Schema.Literal("unavailable"),
    reason: UnavailableReason,
  }),
]).annotate({
  identifier: "Sucafina.TeamProfile.Administration",
  parseOptions: { onExcessProperty: "error" },
})
export type Administration = Schema.Schema.Type<typeof Administration>

export const Authenticated = Schema.Struct({
  contractRevision: ContractRevision,
  status: Schema.Literal("authenticated"),
  installationId: InstallationId,
  principal: Principal,
  accessRevision: AccessRevision,
  administration: Administration,
  teams: TeamState,
}).check(Schema.makeFilter(
  (value) => {
    if (value.teams.status !== "ready" && value.teams.status !== "selection-required") return true
    return value.teams.choices.every((choice) =>
      choice.profile.installationId === value.installationId &&
      choice.profile.tenantId === value.principal.tenantId)
  },
  { message: "Every eligible profile must match the authenticated installation and resource tenant" },
)).annotate({
  identifier: "Sucafina.TeamProfile.Authenticated",
  parseOptions: { onExcessProperty: "error" },
})
export interface Authenticated extends Schema.Schema.Type<typeof Authenticated> {}

/**
 * This is a projection of a server decision, not a transferable admission.
 * Window/auth epochs and non-serializable admitted handles remain the runtime's
 * responsibility. Historical repo-profile rows are decoded by their importer;
 * they are never accepted here as a current profile or an authority fallback.
 */
export const Projection = Schema.Union([
  Authenticated,
  Schema.Struct({
    contractRevision: ContractRevision,
    status: Schema.Literal("unauthenticated"),
  }),
  Schema.Struct({
    contractRevision: ContractRevision,
    status: Schema.Literal("denied"),
  }),
  Schema.Struct({
    contractRevision: ContractRevision,
    status: Schema.Literal("unavailable"),
    reason: UnavailableReason,
  }),
]).annotate({
  identifier: "Sucafina.TeamProfile.Projection",
  parseOptions: { onExcessProperty: "error" },
})
export type Projection = Schema.Schema.Type<typeof Projection>

/** Administration has no Team selection or transferable authority revision. */
export const AdminUnavailableReason = Schema.Literals([
  "identity-unavailable",
  "capability-disabled",
  "consent-required",
  "forbidden",
  "rate-limited",
  "timeout",
  "incomplete",
  "invalid-response",
  "provider-unavailable",
  "policy-unavailable",
  "policy-changed",
  "store-unavailable",
]).annotate({ identifier: "Sucafina.TeamProfile.AdminUnavailableReason" })
export type AdminUnavailableReason = typeof AdminUnavailableReason.Type

/** A configuration intent; the server separately verifies current supreme membership. */
export const AdminCommand = Schema.Struct({
  action: Schema.Literals(["enable", "disable", "remove"]),
  profile: Ref,
  expectedRevision: NonNegativeInt,
}).annotate({
  identifier: "Sucafina.TeamProfile.AdminCommand",
  parseOptions: { onExcessProperty: "error" },
})
export interface AdminCommand extends Schema.Schema.Type<typeof AdminCommand> {}

export const AdminProfile = Schema.Struct({
  profile: Ref,
  enabled: Schema.Boolean,
}).annotate({
  identifier: "Sucafina.TeamProfile.AdminProfile",
  parseOptions: { onExcessProperty: "error" },
})
export interface AdminProfile extends Schema.Schema.Type<typeof AdminProfile> {}

const AdminProfiles = Schema.Array(AdminProfile).check(
  Schema.isMaxLength(10000),
  Schema.makeFilter(
    (profiles) => new Set(profiles.map((entry) => JSON.stringify([
      entry.profile.installationId, entry.profile.tenantId, entry.profile.teamObjectId,
    ]))).size === profiles.length && profiles.every((entry) =>
      entry.profile.installationId === profiles[0]?.profile.installationId &&
      entry.profile.tenantId === profiles[0]?.profile.tenantId),
    { message: "Administrative profiles must be unique and belong to one installation and resource tenant" },
  ),
)

const AdminFailure = Schema.Union([
  Schema.Struct({ status: Schema.Literal("unauthenticated") }),
  Schema.Struct({ status: Schema.Literal("denied") }),
  Schema.Struct({ status: Schema.Literal("invalid-request") }),
  Schema.Struct({ status: Schema.Literal("unavailable"), reason: AdminUnavailableReason }),
])

/** Shared configuration only; no groups, grants, audit rows, tokens or session handles. */
export const AdminListResult = Schema.Union([
  Schema.Struct({
    status: Schema.Literal("ok"),
    configRevision: NonNegativeInt,
    profiles: AdminProfiles,
  }),
  AdminFailure,
]).annotate({
  identifier: "Sucafina.TeamProfile.AdminListResult",
  parseOptions: { onExcessProperty: "error" },
})
export type AdminListResult = Schema.Schema.Type<typeof AdminListResult>

/** Compare-and-swap outcome; revision numbers are safe integers and are never coerced. */
export const AdminConfigureResult = Schema.Union([
  Schema.Struct({
    status: Schema.Literal("ok"),
    configRevision: NonNegativeInt,
    changed: Schema.Boolean,
  }),
  Schema.Struct({ status: Schema.Literal("conflict"), configRevision: NonNegativeInt }),
  Schema.Struct({ status: Schema.Literal("not-found") }),
  AdminFailure,
]).annotate({
  identifier: "Sucafina.TeamProfile.AdminConfigureResult",
  parseOptions: { onExcessProperty: "error" },
})
export type AdminConfigureResult = Schema.Schema.Type<typeof AdminConfigureResult>
