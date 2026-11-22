import { createHmac, randomUUID } from "node:crypto"
import type { SfTeamCurrentChoice } from "../../../../apps/cli/src/sucafina-product/team-current-choice.ts"
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
import type { createTeamProfileAccess } from "./team-profile-access.ts"
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
}) {
  const { request, route, admission, identity, keys } = input
  const unavailable = () => Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  let config: MicrosoftConfiguration
  try {
    if (typeof input.readCurrentConfiguration !== "function") return unavailable()
    config = await input.readCurrentConfiguration()
  } catch { return unavailable() }
  // One validated private snapshot supplies this request. Its authority is never
  // reused across an await without reopening the canonical installation reader.
  const configurationDigest = digestSfValue(config)
  const configurationCurrent = async () => {
    try {
      const current = await input.readCurrentConfiguration()
      return !request.signal.aborted && current.teams === "direct" && digestSfValue(current) === configurationDigest
    } catch { return false }
  }
  const partition = digestSfValue(admission.profile)
  const denied = () => new Response(null, { status: 403, headers: { "Cache-Control": "no-store" } })
  if (config.teams !== "direct") return denied()
  const rolePolicy = (surface: Surface) => emptyMap().filter((row) => row.surface === surface)
    .map((row) => ({ ...row, entra: config.groups[surface][row.role] ?? null }))
  const currentActor = async (surface = route.surface) => {
    if (!await configurationCurrent() || !await admission.verifyCurrent()) return null
    const actor = await identity.authenticate(request, { surface, roleMap: rolePolicy(surface) })
    return actor?.id === admission.principalObjectId && await admission.verifyCurrent() && await configurationCurrent() ? actor : null
  }
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
  const storeDirectory = path.join(input.directory, "business-teams", partition)
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
    const sourceStore = input.teamCurrentChoice?.sources(store) ??
      (config.clawPurchasePeriod && route.surface === "procurement" ? await (async () => {
        const { createSfSourcePersistence } = await import("../product/integration/source-lifecycle.ts")
        const { enumerateSfSources } = await import("../product/integration/source-inventory.ts")
        const { projectSfProcurementScope } = await import("../product/integration/procurement-projections.ts")
        return createSfSourcePersistence({ persistence: store, enumerate: enumerateSfSources,
          projectScope: projectSfProcurementScope, createId: randomUUID, bootstrapOnWrite: true })
      })() : store)
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
        if (actor?.roles.length) authorized.actor = actor
        return actor
      },
      environment,
      maxJsonBytes: 2 * 1024 * 1024,
      assets: { persistence, services },
    })
    const response = await business(request)
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

function rosterDigest(people: readonly DirectoryPerson[]) {
  return digestSfValue(people.toSorted((left, right) => left.id.localeCompare(right.id)))
}

class TeamAuthorityChanged extends Error {}
class TeamDirectoryUnavailable extends Error {}
