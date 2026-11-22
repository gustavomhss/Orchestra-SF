import { createHmac, randomUUID } from "node:crypto"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { Schema } from "effect"
import type { SfTeamCurrentChoice } from "../../../../apps/cli/src/sucafina-product/team-current-choice.ts"
import type { SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import type { SfTeamNativeDomainInput, SfTeamNativeDomainBindings } from "../../../../apps/cli/src/sucafina-product/team-native-domain.ts"
import path from "node:path"
import { createModule } from "../index.ts"
import { digestSfValue } from "../product/contracts/canonical.ts"
import { emptyMap } from "../src/identity.ts"
import type { ResolvedActor, Surface } from "../src/identity.ts"
import type { AssetPersistence } from "./assets.ts"
import type { DirectoryPerson, LocalIdentity, LocalStore } from "./local-contract.ts"
import { scanLocalFile } from "./local-scanner.ts"
import { openLocalStore } from "./local-store.ts"
import type { MicrosoftConfiguration } from "./microsoft-configuration.ts"
import type { createTeamProfileAccess, TeamBusinessContext, TeamBusinessContextAdmission } from "./team-profile-access.ts"
import type { teamBusinessRoute } from "./team-profile-selector.ts"

type TeamAccess = ReturnType<typeof createTeamProfileAccess>
type Admission = Extract<Awaited<ReturnType<TeamAccess>>, { status: "allowed" }>
type Route = NonNullable<ReturnType<typeof teamBusinessRoute>>

export async function runTeamBusiness(input: {
  request: Request
  route: Route
  admission: Admission
  authorizeTeam: TeamAccess
  identity: LocalIdentity
  readCurrentConfiguration: () => Promise<MicrosoftConfiguration>
  directory: string
  keys: { assets: Uint8Array; bank: Uint8Array }
  now: () => Date
  teamCurrentChoice?: SfTeamCurrentChoice
  decisionIntentions?: Pick<LocalStore, "transaction">
  nativeDomain?: Pick<SfTeamNativeDomainInput, "binding" | "readContext">
}) {
  const { request, route, admission, identity, keys } = input
  const policy = await readTeamBusinessPolicy(input).catch(() => undefined)
  if (!policy) return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  const { config, configurationCurrent } = policy
  const source = teamBusinessSource({ ...input, ...policy })
  const partition = source.partition
  const denied = () => new Response(null, { status: 403, headers: { "Cache-Control": "no-store" } })
  if (config.teams !== "direct") return denied()
  const rolePolicy = source.rolePolicy
  const currentActor = (surface = route.surface) => source.currentActor(surface)
  const authorized: { actor?: ResolvedActor; committed: boolean; roster?: string } = { committed: false }
  const readDirectory = async (admitted: Admission) => {
    if (!admitted.readMembers) throw new TeamDirectoryUnavailable()
    return admitted.readMembers().catch(async () => {
      if (!await admitted.verifyCurrent()) throw new TeamAuthorityChanged()
      throw new TeamDirectoryUnavailable()
    })
  }
  const reauthorize = async (options?: { refreshSession?: boolean }) => {
    if (!await configurationCurrent()) return false
    // Recheck the roster before the last authority read so a provider wait cannot extend that decision.
    if (authorized.roster !== undefined && rosterDigest(await readDirectory(admission)) !== authorized.roster) return false
    const [actor, current] = await Promise.all([
      currentActor(),
      input.authorizeTeam(request, route.teamObjectId, options),
    ])
    if (!actor || !authorized.actor || digestSfValue(actor) !== digestSfValue(authorized.actor) ||
        current.status !== "allowed" || current.principalObjectId !== admission.principalObjectId) return false
    return await admission.verifyCurrent() && await configurationCurrent()
  }
  const storeDirectory = source.directory
  const currentChoice = input.teamCurrentChoice?.handles(request) ? input.teamCurrentChoice : undefined
  const store = await openLocalStore(storeDirectory)
  try {
    if (currentChoice) {
      if (route.surface !== "dashboard") return denied()
      const grants = config.grants.filter((grant) => grant.principalRef === admission.principalObjectId)
      if (grants.length !== 1 || !grants[0]) return denied()
      const actor = await currentActor()
      if (!actor?.roles.some((role) => role.surface === "dashboard") ||
          request.method === "POST" && (!actor.canWrite || !actor.roles.some((role) => role.surface === "dashboard" && ["admin", "contributor"].includes(role.role)))) return denied()
      authorized.actor = actor
      return await currentChoice.run({
        request, origin: config.origin, mount: route.mount, partition, directory: storeDirectory, persistence: store,
        principalId: admission.principalObjectId, grant: grants[0],
        authenticate: (original, context) => original === request && context ? currentActor(context.surface) : Promise.resolve(null),
        environment: async () => ({ at: input.now().toISOString(), id: randomUUID, directory: [] }),
        current: () => reauthorize({ refreshSession: false }),
      })
    }
    if (input.decisionIntentions && route.surface === "dashboard" && new URL(request.url).searchParams.get("sf") === "workbench-command") {
      const grants = config.grants.filter((grant) => grant.principalRef === admission.principalObjectId)
      const grant = grants[0]
      if (grants.length !== 1 || !Array.isArray(grant?.namespaces) || !grant.namespaces.includes("cases") ||
          !Array.isArray(grant.operations) || !grant.operations.includes("sf_case_draft")) return denied()
      const actor = await currentActor()
      if (!actor?.canWrite || !actor.roles.some((role) => role.surface === "dashboard" && (role.role === "admin" || role.role === "contributor"))) return denied()
      authorized.actor = actor
      const { runTeamDecisions } = await import("./team-decisions.ts")
      return await runTeamDecisions({
        request, directory: storeDirectory, partition, principalId: admission.principalObjectId,
        persistence: store, intentions: input.decisionIntentions, current: reauthorize, now: input.now,
        authenticate: (original, context) => original === request && context?.surface === "dashboard" ? currentActor() : Promise.resolve(null),
      })
    }
    const sourceStore = await teamBusinessPersistence({ ...input, config }, store, route.surface)
    const persistence: AssetPersistence = {
      transaction: (surface, work, options) => sourceStore.transaction(surface, async (snapshot, blobs) => {
        const result = await work(snapshot, blobs)
        // Blob writes and business mutations share this transaction and roll back together.
        if (result.commit) {
          if (!await reauthorize()) throw new TeamAuthorityChanged()
          authorized.committed = true
        }
        return result
      }, options),
    }
    const derive = (key: Uint8Array) => createHmac("sha256", key).update("sucafina-team/1\0" + partition).digest()
    const bankKey = derive(keys.bank)
    const environment = async () => {
      const at = input.now().toISOString()
      if (config.teamDirectory === "members") {
        const actor = await currentActor()
        if (!actor?.roles.length || (request.method === "POST" && !actor.canWrite)) throw new TeamAuthorityChanged()
        const directory = await readDirectory(admission)
        authorized.roster = rosterDigest(directory)
        return { at, id: randomUUID, directory, bankKey, directoryScope: "team" as const }
      }
      const person = await identity.person(request)
      const directory = person?.id === admission.principalObjectId ? [person] : []
      return { at, id: randomUUID, directory, bankKey, directoryScope: "team" as const }
    }
    const services = { signingKey: derive(keys.assets), scan: (bytes: Uint8Array) => scanLocalFile(bytes, config.scanner) }
    const mode = new URL(request.url).searchParams.get("sf")
    if (mode === "imports" || mode?.startsWith("import-")) {
      const actor = await currentActor()
      if (!actor?.roles.length) return denied()
      authorized.actor = actor
      const { runSfTeamImports } = await import("../../../../apps/cli/src/sucafina-product/team-imports.ts")
      const response = await runSfTeamImports({
        request, origin: config.origin, mount: route.mount, surface: route.surface, partition,
        directory: storeDirectory, principalId: admission.principalObjectId, grants: config.grants,
        persistence: store, assets: services, environment, now: input.now,
        authenticate: (original, context) => original === request && context ? currentActor(context.surface) : Promise.resolve(null),
        current: () => reauthorize({ refreshSession: false }),
      })
      if (response) return response
    }
    const business = createModule(route.mount, {
      persistence,
      rolePolicy,
      authMount: config.mount,
      authenticate: async () => {
        const actor = await currentActor()
        if (actor?.roles.length && !authorized.actor) authorized.actor = actor
        return actor
      },
      environment,
      maxJsonBytes: 2 * 1024 * 1024,
      assets: { persistence, services },
    })
    const native = input.nativeDomain && await (async () => {
      // The original module and every native fence hold the same first role
      // observation. Repeated authentication cannot replace that authority.
      const actor = await currentActor()
      if (!actor?.roles.length) return denied()
      authorized.actor = actor
      const { createSfTeamNativeDomain } = await import("../../../../apps/cli/src/sucafina-product/team-native-domain.ts")
      const domain = await createSfTeamNativeDomain({
        request, handler: business, ...input.nativeDomain, profile: admission.profile,
        current: () => reauthorize({ refreshSession: false }),
      }).handle()
      if (domain) return domain
      const { createSfTeamNativeProcurement } = await import("../../../../apps/cli/src/sucafina-product/team-native-procurement.ts")
      return createSfTeamNativeProcurement({
        request, handler: business, ...input.nativeDomain, profile: admission.profile,
        current: () => reauthorize({ refreshSession: false }),
      }).handle()
    })()
    const response = native || await business(request)
    // This request already proved Microsoft/Team admission. Revocation during the
    // first role/roster await is forbidden even when no actor reached the module.
    if (response?.status === 401 && (!await admission.verifyCurrent().catch(() => false) || !await configurationCurrent())) return denied()
    // Uncommitted conflicts and previews can include stored data too. Exports may
    // generate their bytes after the audit transaction, so they are checked again.
    if (response && authorized.actor && (!authorized.committed || request.method !== "POST") && !await reauthorize())
      return denied()
    return response
  } catch (error) {
    if (error instanceof TeamAuthorityChanged || currentChoice && !request.signal.aborted &&
        !await reauthorize({ refreshSession: false }).catch(() => false)) return denied()
    if (error instanceof TeamDirectoryUnavailable)
      return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } })
    throw error
  } finally {
    await store.dispose()
  }
}

/** The F02 reader uses the same original application, partition and Microsoft role policy as HTTP. */
export async function readTeamBusinessContext(input: {
  request: Request
  admission: TeamBusinessContextAdmission
  identity: LocalIdentity
  readCurrentConfiguration: () => Promise<MicrosoftConfiguration>
  directory: string
  now: () => Date
  teamCurrentChoice?: SfTeamCurrentChoice
  nativeDomain?: SfTeamInstallationDescriptor
}): Promise<TeamBusinessContext | undefined> {
  const policy = await readTeamBusinessPolicy(input).catch(() => undefined)
  if (!policy || policy.config.teams !== "direct") return undefined
  const { config, configurationCurrent } = policy
  const { readSfApplicationContext } = await import("./application.ts")
  const { sfContextDestinationsFromPages } = await import("../../../../apps/cli/src/sucafina-product/native-ui/live-context.ts")
  const source = teamBusinessSource({ ...input, ...policy })
  const admittedOwner = Schema.decodeUnknownSync(TeamProfile.Owner)({
    profile: input.admission.profile,
    principal: { tenantId: input.admission.profile.tenantId, principalObjectId: input.admission.principalObjectId },
  })
  const owner = Object.freeze({
    profile: Object.freeze(admittedOwner.profile),
    principal: Object.freeze(admittedOwner.principal),
  })
  const authorityCurrent = async () =>
    await input.admission.verifyCurrent() && await configurationCurrent()
  const observe = async () => {
    if (!await configurationCurrent() || !await authorityCurrent()) return undefined
    const store = await openLocalStore(source.directory)
    try {
      const persistence = await teamBusinessPersistence({ ...input, config }, store)
      const application = createModule(source.mount, {
        persistence, rolePolicy: source.rolePolicy, authMount: config.mount,
        authenticate: (request, context) => request === input.request && context
          ? source.currentActor(context.surface) : Promise.resolve(null),
        environment: async (request) => {
          const person = request === input.request ? await input.identity.person(request) : null
          return { at: input.now().toISOString(), id: randomUUID,
            directory: person?.id === input.admission.principalObjectId ? [person] : [], directoryScope: "team" }
        },
        maxJsonBytes: 2 * 1024 * 1024,
      })
      const native = input.nativeDomain
        ? await import("../../../../apps/cli/src/sucafina-product/team-native-domain.ts") : undefined
      const captured: { native?: SfTeamNativeDomainBindings } = {}
      const observed = await readSfApplicationContext(application, input.request, input.admission.principalObjectId, async () => {
        if (!await authorityCurrent()) return false
        if (!input.nativeDomain || !native) return true
        const heldRoot = persistence.currentSnapshotScope?.()
        if (!heldRoot?.readOnly || heldRoot.poisoned) return false
        captured.native = await native.readSfTeamNativeDomainBindings({
          request: input.request, handler: application, binding: input.nativeDomain,
          profile: input.admission.profile, principalObjectId: input.admission.principalObjectId,
          current: authorityCurrent, heldRoot: heldRoot.identity,
        })
        return !!captured.native
      })
      if (!observed || input.request.signal.aborted || input.nativeDomain && !captured.native) return undefined
      // The final business observation runs inside the original held read root;
      // no later private-policy await can outlive its roles/ACL observation.
      const destinations = sfContextDestinationsFromPages(observed.pages)
      if (!destinations) return undefined
      const replaced = new Set(captured.native?.destinations.map((entry) => entry.capabilityId))
      return {
        accessRevision: digestSfValue({
          owner, configuration: policy.configurationDigest, business: observed.accessRevision,
          ...(captured.native ? { native: captured.native.accessRevision } : {}),
        }),
        destinations: captured.native
          ? [...destinations.filter((entry) => !replaced.has(entry.capabilityId)), ...captured.native.destinations]
          : destinations,
        availability: captured.native?.availability ?? [],
      }
    } finally { await store.dispose() }
  }
  const observed = await observe()
  if (!observed) return undefined
  return {
    owner, ...observed,
    verifyCurrent: async () => {
      const current = await observe()
      return !!current && current.accessRevision === observed.accessRevision &&
        digestSfValue(current.destinations) === digestSfValue(observed.destinations) &&
        digestSfValue(current.availability) === digestSfValue(observed.availability) && !input.request.signal.aborted
    },
  }
}

async function teamBusinessPersistence(input: { config: MicrosoftConfiguration; teamCurrentChoice?: SfTeamCurrentChoice },
  store: LocalStore, surface?: Surface) {
  if (input.teamCurrentChoice) return input.teamCurrentChoice.sources(store)
  if (!input.config.clawPurchasePeriod || surface !== undefined && surface !== "procurement") return store
  const { createSfSourcePersistence } = await import("../product/integration/source-lifecycle.ts")
  const { enumerateSfSources } = await import("../product/integration/source-inventory.ts")
  const { projectSfProcurementScope } = await import("../product/integration/procurement-projections.ts")
  return createSfSourcePersistence({ persistence: store, enumerate: enumerateSfSources,
    projectScope: projectSfProcurementScope, createId: randomUUID, bootstrapOnWrite: true })
}

function teamBusinessSource(input: {
  request: Request
  admission: TeamBusinessContextAdmission
  identity: LocalIdentity
  config: MicrosoftConfiguration
  configurationCurrent: () => Promise<boolean>
  directory: string
}) {
  const partition = digestSfValue(input.admission.profile)
  const rolePolicy = (surface: Surface) => emptyMap().filter((row) => row.surface === surface)
    .map((row) => ({ ...row, entra: input.config.groups[surface][row.role] ?? null }))
  return {
    partition,
    directory: path.join(input.directory, "business-teams", partition),
    mount: input.config.mount + "/teams/" + input.admission.profile.teamObjectId,
    rolePolicy,
    currentActor: async (surface: Surface) => {
      if (!await input.configurationCurrent() || !await input.admission.verifyCurrent()) return null
      const actor = await input.identity.authenticate(input.request, { surface, roleMap: rolePolicy(surface) })
      return actor?.id === input.admission.principalObjectId &&
        await input.admission.verifyCurrent() && await input.configurationCurrent() ? actor : null
    },
  }
}

/** One private policy snapshot per request, reread at every async authority fence. */
async function readTeamBusinessPolicy(input: {
  request: Request
  readCurrentConfiguration: () => Promise<MicrosoftConfiguration>
}) {
  const config = await input.readCurrentConfiguration()
  const configurationDigest = digestSfValue(config)
  const configurationCurrent = async () => {
    try {
      const current = await input.readCurrentConfiguration()
      return !input.request.signal.aborted && current.teams === "direct" &&
        digestSfValue(current) === configurationDigest
    } catch { return false }
  }
  return { config, configurationDigest, configurationCurrent }
}

function rosterDigest(people: readonly DirectoryPerson[]) {
  return digestSfValue(people.toSorted((left, right) => left.id.localeCompare(right.id)))
}

class TeamAuthorityChanged extends Error {}
class TeamDirectoryUnavailable extends Error {}
