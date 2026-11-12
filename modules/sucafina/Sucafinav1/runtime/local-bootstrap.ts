import { emptyMap, surfaceAdmin } from "../src/identity.ts"
import type { Surface } from "../src/identity.ts"
import type { LocalIdentity, LocalStore } from "./local-contract.ts"
import { changed } from "./contract.ts"

/** Seed only an absent map, after live membership confirms this real user is a configured admin. */
export async function bootstrapLocalSurface(options: {
  request: Request
  surface: Surface
  groups: Readonly<Record<string, string>>
  identity: LocalIdentity
  store: LocalStore
  now?: () => Date
}) {
  const map = emptyMap().filter((row) => row.surface === options.surface).map((row) => ({ ...row, entra: options.groups[row.role]?.trim() || null }))
  if (!map.some((row) => row.role === "admin" && row.entra)) return false
  const actor = await options.identity.authenticate(options.request, { surface: options.surface, roleMap: map })
  if (!actor || !surfaceAdmin(actor, options.surface)) return false
  const person = await options.identity.person(options.request)
  if (!person || person.id !== actor.id) return false
  return options.store.transaction(options.surface, async (snapshot) => {
    // An explicitly empty saved map is intentional and must never be repaired at startup.
    if (snapshot.data.roleMap !== undefined) return { commit: false, value: false }
    snapshot.data.roleMap = map.map((row) => ({ ...row, version: 1, by: actor.id }))
    changed(snapshot, "bootstrap:role-map", { id: actor.id, canWrite: true, roles: ["admin"] }, (options.now?.() ?? new Date()).toISOString(), undefined, snapshot.data.roleMap)
    snapshot.audit[snapshot.audit.length - 1].name = person.name
    snapshot.versions.dataset = { version: (snapshot.versions.dataset?.version ?? 0) + 1, by: actor.id }
    return { commit: true, value: true }
  }, { signal: options.request.signal })
}
