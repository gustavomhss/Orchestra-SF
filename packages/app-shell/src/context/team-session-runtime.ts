import type { SfTeamContext, SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import type { SfTransportFetch } from "@orchestra/client/sucafina/transport"
import { createTeamSessionsWorkspace, type TeamChatNotice } from "./team-sessions"
import type { TeamHintStorage, TeamWindowIdentity } from "../utils/team-profile-storage"

export type TeamSessionCurrent = Readonly<{ context: SfTeamContext; generation: number; signal: AbortSignal }>

/** Adapter for the existing authenticated Teams shell. No generic owner or provider is mounted here. */
export function createTeamSessionRuntime(input: Readonly<{
  binding: SfTeamInstallationDescriptor
  window: TeamWindowIdentity
  storage: TeamHintStorage
  fetch: SfTransportFetch
  current(): TeamSessionCurrent | undefined
  href(): string
  confirmedHref(): string | undefined
  refresh(): Promise<void>
  confirmDiscard(): Promise<boolean>
  notice(key: TeamChatNotice): void
  unauthenticated(): void
  opened(id?: string): void
}>) {
  const same = (source: TeamSessionCurrent, href: string) => {
    const current = input.current()
    return !source.signal.aborted && current?.context === source.context &&
      current.generation === source.generation && input.href() === href
  }
  const sessions = createTeamSessionsWorkspace({
    binding: input.binding, window: input.window, storage: input.storage, fetch: input.fetch,
    current: (context, generation) => {
      const current = input.current()
      return current?.context === context && current.generation === generation &&
        !current.signal.aborted && input.href() === input.confirmedHref()
    },
    unauthenticated: input.unauthenticated, notice: input.notice, opened: input.opened,
  })
  return Object.freeze({
    binding: input.binding, sessions, current: input.current, refresh: input.refresh,
    async leave() {
      if (sessions.hasPendingRequests()) { input.notice("sf.teams.pending"); return false }
      if (!sessions.hasDirtyDrafts()) return true
      const source = input.current(), href = input.href()
      if (!source || !await input.confirmDiscard() || !same(source, href)) return false
      return sessions.discardDrafts()
    },
    async closeSession(id: string) {
      const source = input.current(), href = input.href()
      if (!source) return false
      if (sessions.state.pending.some((operation) => operation.sessionID === id)) {
        input.notice("sf.teams.pending"); return false
      }
      if (sessions.dirty(id) && (!await input.confirmDiscard() || !same(source, href))) return false
      if (!same(source, href)) return false
      const selected = sessions.state.active === id
      const closed = await sessions.closeTab(id, true)
      if (closed && selected && same(source, href)) input.opened()
      return closed
    },
  })
}
export type TeamSessionRuntime = ReturnType<typeof createTeamSessionRuntime>
