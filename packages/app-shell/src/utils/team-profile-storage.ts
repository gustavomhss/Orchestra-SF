import { Option, Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"

const windowId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
type BrowserStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">
export type TeamWindowIdentity = Readonly<{ id: string; persistent: boolean; dispose(): void }>
export type TeamPersonalScope = Readonly<{
  installationId: TeamProfile.InstallationId
  principal: TeamProfile.Principal
  windowId: string
}>
const bounded = (value: string) => value.length > 0 && value.length <= 256 && !/[\u0000-\u001f\u007f]/.test(value)
const encode = (parts: readonly string[]) => encodeURIComponent(JSON.stringify(parts))

/** A full tuple, not a hash, display name, directory or shared "browser" window. */
export function teamPersonalKey(scope: TeamPersonalScope, category: "selection" | "tabs"): string {
  if (!Schema.is(TeamProfile.Principal)(scope.principal) || !Schema.is(TeamProfile.InstallationId)(scope.installationId) ||
      !windowId.test(scope.windowId)) throw new Error("TEAM_PERSONAL_SCOPE_INVALID")
  return "orchestra.team.personal.v1:" + encode([
    scope.installationId, scope.principal.tenantId, scope.principal.principalObjectId, scope.windowId, category,
  ])
}
export function teamPrivateKey(owner: TeamProfile.Owner, category: string, actualWindowId?: string): string {
  if (!Schema.is(TeamProfile.Owner)(owner) || !bounded(category) ||
      actualWindowId !== undefined && !windowId.test(actualWindowId)) throw new Error("TEAM_PRIVATE_SCOPE_INVALID")
  return "orchestra.team.private.v1:" + encode([
    owner.profile.installationId, owner.profile.tenantId, owner.profile.teamObjectId,
    owner.principal.principalObjectId, category, ...(actualWindowId ? [actualWindowId] : []),
  ])
}

/**
 * A restored choice is an untrusted hint. Call only after authenticating this
 * exact principal; the controller rereads the selected Team before using it.
 * Legacy keys are never inspected or reassigned.
 */
export function readTeamSelection(storage: BrowserStorage, scope: TeamPersonalScope): TeamProfile.Ref | undefined {
  try {
    const raw = storage.getItem(teamPersonalKey(scope, "selection"))
    if (!raw || raw.length > 2048) return
    const value: unknown = JSON.parse(raw)
    const decoded = Schema.decodeUnknownOption(TeamProfile.Ref, { onExcessProperty: "error" })(value)
    if (Option.isNone(decoded) || raw !== JSON.stringify(decoded.value) || decoded.value.installationId !== scope.installationId ||
        decoded.value.tenantId !== scope.principal.tenantId) return
    return decoded.value
  } catch { return } // Optional restore cannot grant access or hide an explicit user action.
}
export function writeTeamSelection(storage: BrowserStorage, scope: TeamPersonalScope, profile: TeamProfile.Ref): boolean {
  if (!Schema.is(TeamProfile.Ref)(profile) || profile.installationId !== scope.installationId ||
      profile.tenantId !== scope.principal.tenantId) return false
  try {
    const key = teamPersonalKey(scope, "selection"), raw = JSON.stringify(profile)
    storage.setItem(key, raw)
    return storage.getItem(key) === raw
  } catch { return false }
}
export function clearTeamSelection(storage: BrowserStorage, scope: TeamPersonalScope): boolean {
  try { storage.removeItem(teamPersonalKey(scope, "selection")); return true } catch { return false }
}

/** Each async operation captures this UI lifetime; it is never backend authority. */
export function createTeamPrivateLifetime(owner: TeamProfile.Owner, actualWindowId: string) {
  const captured = Schema.decodeUnknownSync(TeamProfile.Owner, { onExcessProperty: "error" })(structuredClone(owner))
  Object.freeze(captured.profile); Object.freeze(captured.principal); Object.freeze(captured)
  teamPrivateKey(captured, "lifetime", actualWindowId)
  let active = true
  const controllers = new Set<AbortController>()
  const urls = new Set<string>()
  return Object.freeze({
    owner: captured,
    current: () => active,
    capture() {
      if (!active) return undefined
      const controller = new AbortController()
      controllers.add(controller)
      return Object.freeze({ signal: controller.signal, current: () => active && !controller.signal.aborted,
        release: () => { controllers.delete(controller); controller.abort() } })
    },
    key: (category: string) => active ? teamPrivateKey(captured, category, actualWindowId) : undefined,
    async read<Value>(read: () => Promise<Value>): Promise<Value | undefined> {
      if (!active) return
      const value = await read()
      return active ? value : undefined
    },
    async write<Value>(prepare: () => Promise<Value>, commit: (value: Value) => void): Promise<boolean> {
      if (!active) return false
      const value = await prepare()
      if (!active) return false
      // The sink is synchronous so revocation cannot interleave between the fence and commit.
      commit(value)
      return active
    },
    objectUrl(blob: Blob): string | undefined {
      if (!active) return
      const url = URL.createObjectURL(blob)
      urls.add(url)
      return url
    },
    revoke() {
      if (!active) return
      active = false
      controllers.forEach((controller) => controller.abort())
      controllers.clear()
      urls.forEach((url) => URL.revokeObjectURL(url))
      urls.clear()
    },
  })
}

/**
 * sessionStorage can be copied into a new tab. A held Web Lock proves that a
 * saved window ID is not simultaneously owned by another live document.
 * Unsupported storage/locks use a fresh ephemeral UUID, never a shared fallback.
 */
export async function acquireTeamWindowIdentity(input: Readonly<{
  storage: BrowserStorage
  locks?: Pick<LockManager, "request">
  signal: AbortSignal
}>): Promise<TeamWindowIdentity | undefined> {
  if (input.signal.aborted) return
  const key = "orchestra.team.window.v1"
  let previous: string | undefined
  try { const raw = input.storage.getItem(key); if (raw && windowId.test(raw)) previous = raw } catch { /* Ephemeral identity remains isolated. */ }
  if (!input.locks) return { id: crypto.randomUUID(), persistent: false, dispose: () => undefined }
  for (let attempt = 0; attempt < 2; attempt++) {
    const id = attempt === 0 && previous ? previous : crypto.randomUUID()
    let release: (() => void) | undefined
    let announce: (held: boolean) => void = () => undefined
    const acquired = new Promise<boolean>((resolve) => { announce = resolve })
    const done = new Promise<void>((resolve) => { release = resolve })
    const abort = () => { announce(false); release?.() }
    input.signal.addEventListener("abort", abort, { once: true })
    if (input.signal.aborted) abort()
    void input.locks.request("orchestra.team.window.v1:" + id, { mode: "exclusive", ifAvailable: true },
      async (lock) => {
        announce(!!lock && !input.signal.aborted)
        if (lock && !input.signal.aborted) await done
      }).catch(() => announce(false)) // A denied optional lock never admits a persisted identity.
    const held = await acquired
    if (held && !input.signal.aborted) {
      let persistent = false
      try { input.storage.setItem(key, id); persistent = input.storage.getItem(key) === id } catch { /* No persisted restore. */ }
      return { id, persistent, dispose: () => { input.signal.removeEventListener("abort", abort); release?.() } }
    }
    input.signal.removeEventListener("abort", abort)
    release?.()
    if (input.signal.aborted) return
  }
  return { id: crypto.randomUUID(), persistent: false, dispose: () => undefined }
}
