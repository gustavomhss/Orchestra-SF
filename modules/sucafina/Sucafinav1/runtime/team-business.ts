import { createHmac, randomUUID } from "node:crypto"
import path from "node:path"
import { createModule } from "../index.ts"
import { digestSfValue } from "../product/contracts/canonical.ts"
import { emptyMap } from "../src/identity.ts"
import type { ResolvedActor, Surface } from "../src/identity.ts"
import type { AssetPersistence } from "./assets.ts"
import type { DirectoryPerson, LocalIdentity } from "./local-contract.ts"
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
  config: MicrosoftConfiguration
  directory: string
  keys: { assets: Uint8Array; bank: Uint8Array }
  now: () => Date
}) {
  const { request, route, admission, identity, config, keys } = input
  const partition = digestSfValue(admission.profile)
  const denied = () => new Response(null, { status: 403, headers: { "Cache-Control": "no-store" } })
  const rolePolicy = (surface: Surface) => emptyMap().filter((row) => row.surface === surface)
    .map((row) => ({ ...row, entra: config.groups[surface][row.role] ?? null }))
  const currentActor = async () => {
    if (!await admission.verifyCurrent()) return null
    const actor = await identity.authenticate(request, { surface: route.surface, roleMap: rolePolicy(route.surface) })
    return actor?.id === admission.principalObjectId && await admission.verifyCurrent() ? actor : null
  }
  const authorized: { actor?: ResolvedActor; committed: boolean; roster?: string } = { committed: false }
  const readDirectory = async (admitted: Admission) => {
    if (!admitted.readMembers) throw new TeamDirectoryUnavailable()
    return admitted.readMembers().catch(async () => {
      if (!await admitted.verifyCurrent()) throw new TeamAuthorityChanged()
      throw new TeamDirectoryUnavailable()
    })
  }
  const reauthorize = async () => {
    // Recheck the roster before the last authority read so a provider wait cannot extend that decision.
    if (authorized.roster !== undefined && rosterDigest(await readDirectory(admission)) !== authorized.roster) return false
    const [actor, current] = await Promise.all([
      currentActor(),
      input.authorizeTeam(request, route.teamObjectId),
    ])
    if (!actor || !authorized.actor || digestSfValue(actor) !== digestSfValue(authorized.actor) ||
        current.status !== "allowed" || current.principalObjectId !== admission.principalObjectId) return false
    return admission.verifyCurrent()
  }
  const store = await openLocalStore(path.join(input.directory, "business-teams", partition))
  try {
    const persistence: AssetPersistence = {
      transaction: (surface, work, options) => store.transaction(surface, async (snapshot, blobs) => {
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
    const business = createModule(route.mount, {
      persistence,
      rolePolicy,
      authMount: config.mount,
      authenticate: async () => {
        const actor = await currentActor()
        if (actor?.roles.length) authorized.actor = actor
        return actor
      },
      environment: async () => {
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
      },
      maxJsonBytes: 2 * 1024 * 1024,
      assets: { persistence, services: { signingKey: derive(keys.assets), scan: (bytes) => scanLocalFile(bytes, config.scanner) } },
    })
    const response = await business(request)
    // Uncommitted conflicts and previews can include stored data too. Exports may
    // generate their bytes after the audit transaction, so they are checked again.
    if (response && authorized.actor && (!authorized.committed || request.method !== "POST") && !await reauthorize())
      return denied()
    return response
  } catch (error) {
    if (error instanceof TeamAuthorityChanged) return denied()
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
