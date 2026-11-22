import { Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"

const windowId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
export type TeamHintStorage = Pick<Storage, "getItem" | "setItem" | "removeItem"> &
  Partial<Pick<Storage, "key" | "length">>
type BrowserStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">
export type TeamWindowIdentity = Readonly<{ id: string; persistent: boolean; dispose(): void }>
const bounded = (value: string) => value.length > 0 && value.length <= 256 && !/[\u0000-\u001f\u007f]/.test(value)
const encode = (parts: readonly string[]) => encodeURIComponent(JSON.stringify(parts))

/** Full principal, Team and document tuple. It stores optional IDs, never draft text or authority. */
export function teamPrivateKey(owner: TeamProfile.Owner, category: string, actualWindowId?: string): string {
  if (!Schema.is(TeamProfile.Owner)(owner) || !bounded(category) ||
      actualWindowId !== undefined && !windowId.test(actualWindowId)) throw new Error("TEAM_PRIVATE_SCOPE_INVALID")
  return "orchestra.team.private.v1:" + encode([
    owner.profile.installationId, owner.profile.tenantId, owner.profile.teamObjectId,
    owner.principal.principalObjectId, category, ...(actualWindowId ? [actualWindowId] : []),
  ])
}


/** Logout/revocation also removes hints for other Teams previously visited by this principal in this window. */
export function clearTeamSessionHints(storage: TeamHintStorage, owner: TeamProfile.Owner, actualWindowId: string): void {
  if (!Schema.is(TeamProfile.Owner)(owner) || !windowId.test(actualWindowId)) return
  try {
    if (!storage.key || typeof storage.length !== "number") return
    const keys: string[] = []
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index)
      if (!key?.startsWith("orchestra.team.private.v1:")) continue
      let parts: unknown
      try { parts = JSON.parse(decodeURIComponent(key.slice("orchestra.team.private.v1:".length))) }
      catch { continue }
      if (Array.isArray(parts) && parts.length === 6 &&
          parts[0] === owner.profile.installationId && parts[1] === owner.profile.tenantId &&
          parts[3] === owner.principal.principalObjectId && parts[4] === "session-hints" && parts[5] === actualWindowId)
        keys.push(key)
    }
    for (const key of keys) storage.removeItem(key)
  } catch {
    // Optional restoration is never needed to purge the live transcript and draft stores.
  }
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
