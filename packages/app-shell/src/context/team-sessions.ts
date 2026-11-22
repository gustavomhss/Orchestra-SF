import { batch } from "solid-js"
import { createStore, produce, reconcile, unwrap } from "solid-js/store"
import { Option, Schema } from "effect"
import { Session } from "@orchestra/schema/session"
import { SessionMessage } from "@orchestra/schema/session-message"
import { SessionEvent } from "@orchestra/schema/session-event"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import type { SfTeamContext, SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import { createSfTeamSessions, SfTeamSessionError, sameTeamSessionOwner,
  type SfTeamSessions, type SfTeamSessionInfo, type SfTeamSessionMessage,
  type SfTeamSessionFailure } from "@orchestra/client/sucafina/sessions"
import type { SfTransportFetch } from "@orchestra/client/sucafina/transport"
import type { PromptInputV2PersistedState } from "@orchestra/session-ui/v2/prompt-input/types"
import { sameTeamSessionContext, type TeamSessionRetirement } from "./team-session-lifetime"
import { clearTeamSessionHints, teamPrivateKey, type TeamHintStorage, type TeamWindowIdentity } from "../utils/team-profile-storage"
import { createTeamSessionLive } from "./team-session-live"

const strict = { onExcessProperty: "error" } as const
const SessionID = Session.ID.check(Schema.isMaxLength(256))
const MessageID = SessionMessage.ID.check(Schema.isMaxLength(256))
const Pending = Schema.Union([
  Schema.Struct({ action: Schema.Literal("create"), sessionID: SessionID }),
  Schema.Struct({ action: Schema.Literal("interrupt"), sessionID: SessionID }),
  Schema.Struct({ action: Schema.Literal("prompt"), sessionID: SessionID, messageID: MessageID,
    after: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER)) }),
])
type Pending = typeof Pending.Type
const Receipt = Schema.Struct({ sessionID: SessionID, messageID: MessageID })
const Hints = Schema.Struct({
  version: Schema.Literal(1), namespace: TeamProfile.SessionNamespace,
  tabs: Schema.Array(SessionID).check(Schema.isMaxLength(16)),
  closed: Schema.Array(SessionID).check(Schema.isMaxLength(24)),
  pending: Schema.Array(Pending).check(Schema.isMaxLength(32)),
  receipts: Schema.Array(Receipt).check(Schema.isMaxLength(64)),
})
const transcriptBound = (values: Iterable<SfTeamSessionMessage>) => {
  const items = [...values]
  if (items.length > 2000 || JSON.stringify(items).length > 8 * 1024 * 1024)
    throw new Error("TEAM_SESSION_TRANSCRIPT_BOUND")
  return items
}
const emptyPrompt = (): PromptInputV2PersistedState => ({ prompt: [], context: { items: [] } })
const promptText = (draft: PromptInputV2PersistedState) =>
  draft.prompt.every((part) => part.type === "text") && draft.context.items.length === 0
    ? draft.prompt.map((part) => "content" in part ? part.content : "").join("") : undefined
const operationKey = (operation: Pending) =>
  JSON.stringify([operation.action, operation.sessionID, operation.action === "prompt" ? operation.messageID : ""])
type Thread = {
  info: SfTeamSessionInfo
  messages: SfTeamSessionMessage[]
  queue: { id: string; text: string }[]
  status: "loading" | "ready" | "unavailable"
  cursor?: string
  running: boolean
  scrollTop: number
}
type State = {
  status: "idle" | "loading" | "ready" | "unavailable"
  reason?: SfTeamSessionFailure | "stream"
  recent: SfTeamSessionInfo[]
  tabs: SfTeamSessionInfo[]
  closed: string[]
  threads: Record<string, Thread>
  active?: string
  pending: Pending[]
  stream: "idle" | "connecting" | "open"
  search: string
  cursor?: string
  busy: boolean
  generation: number
  persistent: boolean
}
type Scope = {
  context: SfTeamContext; generation: number; owner: TeamProfile.Owner
  abort: AbortController; client: SfTeamSessions
  namespace?: TeamProfile.SessionNamespace
  key: string
  loaded?: Promise<boolean>
  streamStarted: boolean
  receipts: (typeof Receipt.Type)[]
  snapshots: Map<string, SfTeamSessionMessage[]>
  live: Map<string, ReturnType<typeof createTeamSessionLive>>
  reads: Map<string, Promise<void>>
  wanted: Set<string>
  openSerial: number
  listSerial: number
}
type Quarantine = {
  context: SfTeamContext; namespace: TeamProfile.SessionNamespace
  drafts: Map<string, PromptInputV2PersistedState>
}
export type TeamChatNotice = "sf.teams.chatUnavailable" | "sf.teams.pending" | "sf.teams.actionFailed" |
  "sf.teams.chatActionUnavailable" | "sf.teams.chatUpdatesStopped" | "sf.teams.chatDraftsRemoved" | "sf.teams.chatTabLimit" | "sf.teams.chatListLimit"

/**
 * Browser state is never an admission handle. Every read/mutation uses the
 * original cookie through the generated Client facade, then rechecks this exact
 * F02 lifetime and the server response namespace before publishing private data.
 */
export function createTeamSessionsWorkspace(input: Readonly<{
  binding: SfTeamInstallationDescriptor; window: TeamWindowIdentity
  storage: TeamHintStorage
  fetch: SfTransportFetch
  current(context: SfTeamContext, generation: number): boolean
  unauthenticated(): void
  notice(key: TeamChatNotice): void
  opened(sessionID: Session.ID): void
}>) {
  const initial = (): Omit<State, "generation"> => ({
    status: "idle", recent: [], tabs: [], closed: [], threads: {}, pending: [],
    stream: "idle", search: "", busy: false, persistent: input.window.persistent,
  })
  const [state, setState] = createStore<State>({ ...initial(), generation: 0 })
  const prompt = createStore<PromptInputV2PersistedState>(emptyPrompt())
  let active: Scope | undefined, quarantine: Quarantine | undefined
  let drafts = new Map<string, PromptInputV2PersistedState>()
  const hints = new Map<string, typeof Hints.Type>()
  let lastOwner: TeamProfile.Owner | undefined
  const draftKey = () => state.active ?? "new"
  const snapshotDraft = () => structuredClone(unwrap(prompt[0]))
  const replaceDraft = (draft: PromptInputV2PersistedState) => {
    const next = structuredClone(unwrap(draft))
    batch(() => {
      // The native editor suppresses its local input echo. External transitions
      // replace the prompt array so resets and restorations are still observed.
      prompt[1]("prompt", next.prompt)
      prompt[1](reconcile(next))
    })
  }
  const saveDraft = () => { if (active) drafts.set(draftKey(), snapshotDraft()) }
  const valid = (scope: Scope) => active === scope && !scope.abort.signal.aborted &&
    input.current(scope.context, scope.generation)
  const check = (scope: Scope) => { if (!valid(scope)) throw new SfTeamSessionError("retired") }
  const persist = (scope: Scope) => {
    if (!scope.namespace) return
    const value: typeof Hints.Type = { version: 1, namespace: scope.namespace,
      tabs: state.tabs.map((item) => SessionID.make(item.id)), closed: state.closed.map((id) => SessionID.make(id)),
      pending: state.pending.map((item) => structuredClone(unwrap(item))), receipts: scope.receipts }
    try {
      const decoded = Schema.decodeUnknownSync(Hints, strict)(value)
      const raw = JSON.stringify(decoded)
      if (raw.length > 32768) throw new Error("Session hints exceeded their storage bound")
      // Unknown results must remain reconcilable in this document even when optional storage fails.
      hints.set(scope.key, structuredClone(decoded))
      if (!input.window.persistent) return
      input.storage.setItem(scope.key, raw)
      if (input.storage.getItem(scope.key) !== raw) throw new Error("Session hints were not stored")
    } catch {
      // ID restoration is optional, and never changes the result of a server action.
      setState("persistent", false)
    }
  }
  const stored = (scope: Scope): typeof Hints.Type | undefined => {
    const memory = hints.get(scope.key)
    if (memory) return structuredClone(memory)
    if (!input.window.persistent) return
    try {
      const raw = input.storage.getItem(scope.key)
      if (!raw || raw.length > 32768) return
      const decoded = Schema.decodeUnknownOption(Hints, strict)(JSON.parse(raw))
      if (Option.isNone(decoded) || raw !== JSON.stringify(decoded.value) ||
          !sameTeamSessionOwner(decoded.value.namespace.owner, scope.owner)) return
      hints.set(scope.key, structuredClone(decoded.value))
      return decoded.value
    } catch { return } // Restored IDs are optional intent; a failed read grants nothing.
  }
  const retire = (reason: TeamSessionRetirement) => {
    const previous = active
    const purge = reason === "logout" || reason === "revoked" || reason === "principal-change"
    if (previous) {
      if (!purge) { saveDraft(); persist(previous) }
      if (reason === "refresh" && previous.namespace) quarantine = {
        context: previous.context, namespace: previous.namespace, drafts,
      }
      else quarantine = undefined
      active = undefined
      previous.abort.abort(); previous.client.dispose()
      previous.live.forEach((live) => live.clear()); previous.live.clear()
      previous.snapshots.clear(); previous.reads.clear(); previous.wanted.clear(); previous.receipts = []
    } else if (reason !== "refresh") quarantine = undefined
    if (purge) {
      for (const key of hints.keys()) { try { input.storage.removeItem(key) } catch { /* Live memory is still scrubbed. */ } }
      if (lastOwner) clearTeamSessionHints(input.storage, lastOwner, input.window.id)
      hints.clear(); lastOwner = undefined
    }
    drafts = new Map()
    batch(() => { replaceDraft(emptyPrompt()); setState(reconcile({ ...initial(), generation: state.generation + 1 })) })
  }
  const invalidate = (scope: Scope, reason: SfTeamSessionFailure | "stream") => {
    if (active !== scope) return
    // Invalid response labels or a lost stream retire IO/content, without proving that a dispatched write did not apply.
    const authorityLost = reason === "unauthenticated" || reason === "denied"
    retire(authorityLost ? "revoked" : reason === "stream" ? "stream" : "unverified")
    setState({ status: "unavailable", reason })
    input.notice(reason === "stream" ? "sf.teams.chatUpdatesStopped" : "sf.teams.chatUnavailable")
    if (reason === "unauthenticated") input.unauthenticated()
  }
  const failure = (scope: Scope, error: unknown, action = true) => {
    if (!valid(scope)) return
    console.error("Teams session action failed", error instanceof Error ? error.name : "unknown")
    if (error instanceof SfTeamSessionError && ["namespace", "protocol", "unauthenticated", "denied"].includes(error.reason)) {
      invalidate(scope, error.reason); return
    }
    if (action) input.notice("sf.teams.actionFailed")
  }
  const pending = (scope: Scope, operation: Pending) => {
    check(scope)
    const key = operationKey(operation)
    if (state.pending.length >= 32 || state.pending.some((item) => operationKey(item) === key))
      throw new Error("TEAM_SESSION_PENDING_BOUND")
    setState("pending", (values) => [...values, operation])
    persist(scope)
  }
  const settled = (scope: Scope, operation: Pending) => {
    check(scope)
    setState("pending", (values) => values.filter((item) => operationKey(item) !== operationKey(operation)))
    persist(scope)
  }
  const publishMessages = (scope: Scope, id: string) => {
    if (!valid(scope) || !state.threads[id]) return
    const values = scope.live.get(id)?.merge(scope.snapshots.get(id) ?? []) ?? scope.snapshots.get(id) ?? []
    setState("threads", id, "messages", reconcile(values))
    const promoted = new Set(values.filter((message) => message.type === "user").map((message) => message.id))
    setState("threads", id, "queue", (queue) => queue.filter((item) => !promoted.has(item.id)))
    scope.receipts = scope.receipts.filter((item) => item.sessionID !== id || !promoted.has(item.messageID))
  }
  const readMessages = (scope: Scope, id: Session.ID): Promise<void> => {
    check(scope)
    if (scope.reads.has(id)) { scope.wanted.add(id); return scope.reads.get(id)! }
    const task = (async () => {
      do {
        scope.wanted.delete(id)
        const result = await scope.client.messages({ sessionID: id, limit: 100, order: "desc" })
        check(scope)
        if (!state.threads[id]) return
        const byId = new Map((scope.snapshots.get(id) ?? []).map((message) => [message.id, message]))
        result.data.forEach((message) => byId.set(message.id, message))
        scope.snapshots.set(id, transcriptBound(byId.values()))
        setState("threads", id, { status: "ready", cursor: result.cursor.next })
        publishMessages(scope, id)
      } while (scope.wanted.has(id) && valid(scope) && state.threads[id])
    })()
    scope.reads.set(id, task)
    void task.finally(() => scope.reads.delete(id)).catch(() => {}) // The caller owns the read error; cleanup has no UI result.
    return task
  }
  const refreshRecent = async (scope: Scope, append = false) => {
    const serial = ++scope.listSerial
    const result = await scope.client.list({ limit: 50, order: "desc", ...(state.search ? { search: state.search } : {}),
      ...(append && state.cursor ? { cursor: state.cursor } : {}) })
    check(scope)
    if (serial !== scope.listSerial) return
    const values = append ? new Map(state.recent.map((info) => [info.id, structuredClone(unwrap(info))])) : new Map<string, SfTeamSessionInfo>()
    result.data.forEach((info) => values.set(info.id, info))
    const limited = values.size >= 500 && !!result.cursor.next
    setState({ recent: [...values.values()].slice(0, 500), cursor: limited ? undefined : result.cursor.next })
    if (limited) input.notice("sf.teams.chatListLimit")
  }
  const stream = (scope: Scope) => {
    if (scope.streamStarted) return
    scope.streamStarted = true
    setState("stream", "connecting")
    void (async () => {
      for await (const event of scope.client.events()) {
        check(scope); setState("stream", "open")
        const decoded = Schema.decodeUnknownOption(SessionEvent.All, strict)(event)
        if (Option.isNone(decoded)) continue
        const value = Schema.encodeSync(SessionEvent.All)(decoded.value), id = value.data.sessionID
        if (["session.next.created", "session.next.renamed", "session.next.archive.changed", "session.next.deleted"].includes(value.type))
          await refreshRecent(scope)
        const thread = state.threads[id]
        if (!thread) continue
        if (value.type === "session.next.deleted") {
          scope.snapshots.delete(id); scope.live.get(id)?.clear(); setState("threads", id, { messages: [], queue: [], status: "unavailable" })
          continue
        }
        if (value.type.startsWith("session.next.revert.")) {
          scope.snapshots.delete(id); scope.live.get(id)?.clear()
          setState("threads", id, { messages: [], queue: [], status: "loading" })
        }
        const live = scope.live.get(id)
        if (live?.apply(value, scope.snapshots.get(id) ?? [])) publishMessages(scope, id)
        if (value.type === "session.next.step.started") setState("threads", id, "running", true)
        if (value.type === "session.next.step.ended" || value.type === "session.next.step.failed") setState("threads", id, "running", false)
        if (value.durable && !["session.next.text.started", "session.next.text.ended", "session.next.reasoning.started", "session.next.reasoning.ended"].includes(value.type))
          void readMessages(scope, SessionID.make(id)).catch((error) => {
            failure(scope, error, false)
            if (valid(scope) && state.threads[id]) {
              setState("threads", id, "status", "unavailable")
              input.notice("sf.teams.chatUpdatesStopped")
            }
          })
      }
      if (valid(scope)) invalidate(scope, "stream")
    })().catch((error) => {
      if (!valid(scope)) return
      failure(scope, error, false)
      if (valid(scope)) invalidate(scope, "stream")
    })
  }
  const ensure = async (): Promise<Scope | undefined> => {
    const scope = active
    if (!scope || !valid(scope)) return
    if (!scope.loaded) scope.loaded = (async () => {
      setState({ status: "loading", reason: undefined })
      await refreshRecent(scope)
      check(scope)
      const namespace = scope.client.namespace()
      if (!namespace) throw new SfTeamSessionError("namespace")
      scope.namespace = namespace
      const hint = stored(scope), sameGeneration = hint?.namespace.authorityGeneration === namespace.authorityGeneration
      // Titles and contents are never restored. IDs only select among this fresh
      // server response, and opening any selected item still performs its own GET.
      if (sameGeneration && hint) {
        const restored = await Promise.allSettled(hint.tabs.map((sessionID) => scope.client.get({ sessionID })))
        check(scope)
        setState({ tabs: restored.flatMap((result) => result.status === "fulfilled" ? [result.value] : []),
          closed: [...hint.closed] })
      }
      // Uncertain operation IDs remain hints even if authority generation changes.
      // A fresh admitted GET/history must establish their result; absence is not a negative proof.
      if (hint) { setState("pending", [...hint.pending]); scope.receipts = [...hint.receipts] }
      if (quarantine) {
        if (sameTeamSessionContext(quarantine.context.stamp, scope.context.stamp) &&
            sameTeamSessionOwner(quarantine.namespace.owner, namespace.owner) &&
            quarantine.namespace.authorityGeneration === namespace.authorityGeneration) {
          drafts = quarantine.drafts
          replaceDraft(drafts.get(draftKey()) ?? emptyPrompt())
        }
        else if ([...quarantine.drafts.values()].some((draft) => (promptText(draft) ?? "").trim()))
          input.notice("sf.teams.chatDraftsRemoved")
        quarantine = undefined
      }
      setState("status", "ready")
      stream(scope); persist(scope)
      return true
    })().catch((error) => {
      failure(scope, error)
      if (valid(scope)) { setState("status", "unavailable"); scope.loaded = undefined }
      return false
    })
    if (!await scope.loaded || !valid(scope)) return
    return scope
  }
  const open = async (id?: string): Promise<boolean> => {
    const scope = await ensure()
    if (!scope) return false
    const serial = ++scope.openSerial
    saveDraft()
    if (!id) {
      setState("active", undefined)
      replaceDraft(drafts.get("new") ?? emptyPrompt())
      return true
    }
    const parsed = Schema.decodeUnknownOption(SessionID)(id)
    if (Option.isNone(parsed)) { input.notice("sf.teams.chatUnavailable"); return false }
    try {
      const info = await scope.client.get({ sessionID: parsed.value })
      check(scope)
      if (serial !== scope.openSerial) return false
      if (!state.tabs.some((tab) => tab.id === id) && state.tabs.length >= 16) { input.notice("sf.teams.chatTabLimit"); return false }
      if (!scope.live.has(id)) scope.live.set(id, createTeamSessionLive())
      if (!state.threads[id]) setState("threads", id, { info, messages: [], queue: [], status: "loading", running: false, scrollTop: 0 })
      else setState("threads", id, "info", info)
      saveDraft()
      batch(() => {
        setState({ active: id, tabs: [...state.tabs.filter((tab) => tab.id !== id), info],
          closed: state.closed.filter((tab) => tab !== id) })
        replaceDraft(drafts.get(id) ?? emptyPrompt())
      })
      await readMessages(scope, parsed.value)
      check(scope)
      const running = await scope.client.active()
      check(scope)
      if (state.threads[id]) setState("threads", id, "running", !!running.data[id])
      for (const receipt of scope.receipts.filter((item) => item.sessionID === id)) {
        if (state.threads[id]?.messages.some((message) => message.id === receipt.messageID)) continue
        const operation: Pending = { action: "prompt", ...receipt, after: 0 }
        if (!state.pending.some((item) => operationKey(item) === operationKey(operation))) pending(scope, operation)
        await confirmPending(operation)
        check(scope)
      }
      persist(scope)
      return serial === scope.openSerial
    } catch (error) {
      failure(scope, error)
      if (valid(scope) && state.threads[id]) setState("threads", id, "status", "unavailable")
      return false
    }
  }
  const confirmPending = async (operation: Pending): Promise<boolean> => {
    const scope = await ensure()
    if (!scope) return false
    try {
      if (operation.action === "interrupt") {
        const running = await scope.client.active()
        check(scope)
        if (!running.data[operation.sessionID]) {
          settled(scope, operation)
          if (state.threads[operation.sessionID]) setState("threads", operation.sessionID, "running", false)
          return true
        }
        input.notice("sf.teams.pending"); return false
      }
      if (operation.action === "create") {
        const info = await scope.client.get({ sessionID: operation.sessionID })
        check(scope); settled(scope, operation)
        saveDraft()
        const unsent = drafts.get("new")
        if (unsent && !drafts.has(info.id)) { drafts.set(info.id, unsent); drafts.delete("new") }
        const opened = await open(info.id)
        if (opened && valid(scope)) input.opened(SessionID.make(info.id))
        return opened
      }
      let after = operation.after
      for (let page = 0; page < 10; page++) {
        const history = await scope.client.history({ sessionID: operation.sessionID, limit: 100, after })
        check(scope)
        const found = history.data.findLast((event) =>
          (event.type === "session.next.prompt.admitted" || event.type === "session.next.prompted") && event.data.messageID === operation.messageID)
        if (found && (found.type === "session.next.prompt.admitted" || found.type === "session.next.prompted")) {
          settled(scope, operation)
          if (found.type === "session.next.prompted") await readMessages(scope, operation.sessionID)
          check(scope)
          const thread = state.threads[operation.sessionID]
          if (thread && found.type === "session.next.prompt.admitted" &&
              !thread.messages.some((message) => message.id === operation.messageID))
            setState("threads", operation.sessionID, "queue", (queue) => [
              ...queue.filter((item) => item.id !== operation.messageID), { id: operation.messageID, text: found.data.prompt.text },
            ])
          return true
        }
        const next = history.data.at(-1)?.durable?.seq
        if (next !== undefined && Number.isSafeInteger(next) && next > after) after = next
        if (!history.hasMore || next === undefined) break
      }
      check(scope)
      setState("pending", (values) => values.map((item) =>
        operationKey(item) === operationKey(operation) && item.action === "prompt" ? { ...item, after } : item))
      persist(scope); input.notice("sf.teams.pending")
    } catch (error) { failure(scope, error); if (valid(scope)) input.notice("sf.teams.pending") }
    return false
  }
  const unresolved = () => state.pending.length > 0 || !!(lastOwner &&
    hints.get(teamPrivateKey(lastOwner, "session-hints", input.window.id))?.pending.length)
  return Object.freeze({
    state, prompt,
    hasPendingRequests: unresolved,
    activate(context: SfTeamContext, generation: number, signal: AbortSignal) {
      const bound = context.stamp.team
      if (!bound || signal.aborted) {
        if (!bound && context.profile.teams.status !== "unavailable") {
          const dirty = quarantine && [...quarantine.drafts.values()].some((draft) => !!(promptText(draft) ?? "").trim())
          quarantine = undefined
          if (dirty) input.notice("sf.teams.chatDraftsRemoved")
        }
        return
      }
      if (active) retire("revoked")
      const abort = new AbortController(), owner = bound.owner
      lastOwner = owner
      const scope: Scope = {
        context, generation, owner, abort, key: teamPrivateKey(owner, "session-hints", input.window.id),
        client: createSfTeamSessions({ binding: input.binding, owner, fetch: input.fetch,
          signal: AbortSignal.any([signal, abort.signal]),
          current: () => active === scope && input.current(context, generation),
          invalidated: (reason) => invalidate(scope, reason) }),
        streamStarted: false, receipts: [], snapshots: new Map(), live: new Map(), reads: new Map(), wanted: new Set(), openSerial: 0, listSerial: 0,
      }
      active = scope
    },
    retire, open, load: async () => !!await ensure(),
    dirty(id: string) { return !!(promptText(state.active === id ? prompt[0] : drafts.get(id) ?? emptyPrompt()) ?? "").trim() },
    hasDirtyDrafts: () => unresolved() || !!(promptText(prompt[0]) ?? "").trim() ||
      [...drafts].some(([id, draft]) => id !== draftKey() && !!(promptText(draft) ?? "").trim()) ||
      !!(quarantine && [...quarantine.drafts.values()].some((draft) => !!(promptText(draft) ?? "").trim())),
    discardDrafts() {
      if (unresolved()) { input.notice("sf.teams.pending"); return false }
      quarantine = undefined; drafts.clear(); replaceDraft(emptyPrompt()); return true
    },
    async closeTab(id: string, discard = false) {
      const scope = active
      if (!scope || !valid(scope) || state.pending.some((item) => item.sessionID === id)) { input.notice("sf.teams.pending"); return false }
      saveDraft()
      if (!discard && (promptText(drafts.get(id) ?? emptyPrompt()) ?? "").trim()) return false
      const tab = state.tabs.find((item) => item.id === id)
      if (!tab) return false
      drafts.delete(id); scope.live.get(id)?.clear(); scope.live.delete(id); scope.snapshots.delete(id)
      setState("threads", produce((threads) => { delete threads[id] }))
      setState({ tabs: state.tabs.filter((item) => item.id !== id),
        closed: [id, ...state.closed.filter((item) => item !== id)].slice(0, 24) })
      if (state.active === id) { setState("active", undefined); replaceDraft(drafts.get("new") ?? emptyPrompt()) }
      persist(scope)
      return true
    },
    async search(value: string, append = false) {
      const scope = await ensure()
      if (!scope || value.length > 256 || append && !state.cursor) return false
      if (!append) setState({ search: value, cursor: undefined })
      try { await refreshRecent(scope, append); return true } catch (error) { failure(scope, error); return false }
    },
    async older() {
      const scope = active, id = state.active, cursor = id ? state.threads[id]?.cursor : undefined
      if (!scope || !valid(scope) || !id || !cursor) return false
      try {
        const result = await scope.client.messages({ sessionID: SessionID.make(id), cursor, order: "desc", limit: 100 })
        check(scope)
        if (!state.threads[id]) return false
        const values = new Map((scope.snapshots.get(id) ?? []).map((message) => [message.id, message]))
        result.data.forEach((message) => values.set(message.id, message))
        scope.snapshots.set(id, transcriptBound(values.values())); setState("threads", id, "cursor", result.cursor.next)
        publishMessages(scope, id); return true
      } catch (error) { failure(scope, error); return false }
    },
    async submit() {
      const scope = await ensure()
      if (!scope || state.busy) return false
      const text = promptText(prompt[0])
      if (text === undefined || !text.trim() || text.length > 131072) { input.notice("sf.teams.chatActionUnavailable"); return false }
      if (state.pending.length) { input.notice("sf.teams.pending"); return false }
      if (!state.active && state.tabs.length >= 16) { input.notice("sf.teams.chatTabLimit"); return false }
      setState("busy", true)
      let operation: Pending | undefined
      try {
        let id = state.active ? SessionID.make(state.active) : undefined
        if (!id) {
          id = Session.ID.create()
          operation = { action: "create", sessionID: id }
          pending(scope, operation)
          const info = await scope.client.create({ id })
          check(scope); settled(scope, operation); operation = undefined
          const draft = snapshotDraft()
          drafts.delete("new"); drafts.set(id, draft)
          scope.live.set(id, createTeamSessionLive()); scope.snapshots.set(id, [])
          setState("threads", id, { info, messages: [], queue: [], status: "ready", running: false, scrollTop: 0 })
          setState({ active: id, tabs: [...state.tabs, info], recent: [info, ...state.recent.filter((value) => value.id !== id)] })
          input.opened(id)
        }
        const messageID = SessionMessage.ID.create()
        operation = { action: "prompt", sessionID: id, messageID, after: 0 }
        pending(scope, operation)
        // Dispatch retires this text as an unsent draft. Unknown outcomes retain
        // IDs for read-only reconciliation and are never converted into a retry.
        drafts.delete(id); replaceDraft(emptyPrompt())
        const admitted = await scope.client.prompt({ sessionID: id, id: messageID, text })
        check(scope); settled(scope, operation); operation = undefined
        scope.receipts = [...scope.receipts.filter((value) => value.messageID !== messageID), { sessionID: id, messageID }].slice(-64)
        if (state.threads[id]) setState("threads", id, "queue", (queue) => [...queue, { id: messageID, text: admitted.prompt.text }])
        persist(scope)
        await readMessages(scope, id)
        return true
      } catch (error) {
        failure(scope, error)
        if (valid(scope) && operation) input.notice("sf.teams.pending")
        return false
      } finally { if (valid(scope)) setState("busy", false) }
    },
    confirmPending,
    async stop() {
      const scope = active, id = state.active
      if (!scope || !id || !valid(scope) || state.busy) return false
      if (state.pending.length) { input.notice("sf.teams.pending"); return false }
      setState("busy", true)
      const operation: Pending = { action: "interrupt", sessionID: SessionID.make(id) }
      try {
        pending(scope, operation)
        await scope.client.interrupt({ sessionID: operation.sessionID })
        check(scope)
        return await confirmPending(operation)
      } catch (error) { failure(scope, error); if (valid(scope)) input.notice("sf.teams.pending"); return false }
      finally { if (valid(scope)) setState("busy", false) }
    },
    scroll(id: string | undefined, top: number) {
      if (active && valid(active) && id && state.threads[id] && Number.isFinite(top) && top >= 0)
        setState("threads", id, "scrollTop", top)
    },
  })
}
export type TeamSessionsWorkspace = ReturnType<typeof createTeamSessionsWorkspace>
