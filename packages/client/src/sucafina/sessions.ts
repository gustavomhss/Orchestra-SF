import { Schema } from "effect"
import { Orchestra } from "../generated/index"
import { Session } from "@orchestra/schema/session"
import { SessionMessage } from "@orchestra/schema/session-message"
import { SessionInput } from "@orchestra/schema/session-input"
import { SessionEvent } from "@orchestra/schema/session-event"
import { PositiveInt, NonNegativeInt } from "@orchestra/schema/schema"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import { OrchestraEvent } from "@orchestra/protocol/groups/event"
import { SessionsCursor } from "@orchestra/protocol/groups/session"
import type { SfTransportFetch } from "./transport"

const strict = { onExcessProperty: "error" } as const
const Info = Session.Info.mapFields((fields) => ({ ...fields, namespace: TeamProfile.SessionNamespace }))
const Cursor = Schema.Struct({ previous: Schema.optional(Schema.String), next: Schema.optional(Schema.String) })
const List = Schema.Struct({
  data: Schema.Array(Info), namespace: TeamProfile.SessionNamespace,
  cursor: Schema.Struct({ previous: Schema.optional(SessionsCursor), next: Schema.optional(SessionsCursor) }),
})
const Active = Schema.Struct({
  data: Schema.Record(Session.ID, Schema.Struct({ type: Schema.Literal("running") })),
  namespace: TeamProfile.SessionNamespace,
})
const Messages = Schema.Struct({ data: Schema.Array(SessionMessage.Message), namespace: TeamProfile.SessionNamespace, cursor: Cursor })
const History = Schema.Struct({ data: Schema.Array(SessionEvent.Durable), namespace: TeamProfile.SessionNamespace, hasMore: Schema.Boolean })
const Frame = Schema.Struct({ namespace: TeamProfile.SessionNamespace, event: OrchestraEvent })
const ListInput = Schema.Struct({
  limit: Schema.optional(PositiveInt.check(Schema.isLessThanOrEqualTo(200))),
  order: Schema.optional(Schema.Literals(["asc", "desc"])),
  search: Schema.optional(Schema.String.check(Schema.isMaxLength(256))),
  includeArchived: Schema.optional(Schema.Boolean),
  cursor: Schema.optional(Schema.String),
})
const MessageInput = Schema.Struct({
  sessionID: Session.ID,
  limit: Schema.optional(PositiveInt.check(Schema.isLessThanOrEqualTo(200))),
  order: Schema.optional(Schema.Literals(["asc", "desc"])),
  cursor: Schema.optional(Schema.String),
})
const HistoryInput = Schema.Struct({
  sessionID: Session.ID, limit: Schema.optional(PositiveInt.check(Schema.isLessThanOrEqualTo(100))),
  after: Schema.optional(NonNegativeInt),
})
const CreateInput = Schema.Struct({ id: Session.ID })
const PromptInput = Schema.Struct({
  sessionID: Session.ID, id: SessionMessage.ID,
  text: Schema.NonEmptyString.check(Schema.isMaxLength(131072)),
})
const ArchiveInput = Schema.Struct({ sessionID: Session.ID, archived: Schema.Boolean })
const GetInput = Schema.Struct({ sessionID: Session.ID })
const RenameInput = Schema.Struct({ sessionID: Session.ID, title: Schema.NonEmptyString.check(Schema.isMaxLength(256)) })

export type SfTeamSessionInfo = typeof Info.Encoded
export type SfTeamSessionMessage = typeof SessionMessage.Message.Encoded
export type SfTeamSessionEvent = typeof OrchestraEvent.Encoded
export type SfTeamSessionFailure = "retired" | "namespace" | "protocol" | "transport" | "unauthenticated" | "denied"

/** Client lifecycle failures are not evidence that an already dispatched mutation did not apply. */
export class SfTeamSessionError extends Error {
  constructor(readonly reason: SfTeamSessionFailure, options?: ErrorOptions) {
    super("SF_TEAM_SESSION_" + reason.toUpperCase(), options)
    this.name = "SfTeamSessionError"
  }
}

export function sameTeamSessionOwner(left: TeamProfile.Owner, right: TeamProfile.Owner): boolean {
  return left.profile.installationId === right.profile.installationId &&
    left.profile.tenantId === right.profile.tenantId && left.profile.teamObjectId === right.profile.teamObjectId &&
    left.principal.tenantId === right.principal.tenantId && left.principal.principalObjectId === right.principal.principalObjectId
}

/**
 * A Web-only facade over the officially generated Client. The supplied owner is
 * a response namespace, never a grant: every Request is admitted independently
 * by the installed server with the actual Microsoft cookie and closed selector.
 * No Project/directory/Location, Basic credential or restored browser epoch enters IO.
 */
export function createSfTeamSessions(input: Readonly<{
  binding: SfTeamInstallationDescriptor
  owner: TeamProfile.Owner
  current(): boolean
  signal: AbortSignal
  fetch: SfTransportFetch
  invalidated(reason: SfTeamSessionFailure): void
}>) {
  const binding = Schema.decodeUnknownSync(SfTeamInstallationDescriptor, strict)(structuredClone(input.binding))
  const owner = Schema.decodeUnknownSync(TeamProfile.Owner, strict)(structuredClone(input.owner))
  const origin = new URL(binding.publicOrigin)
  if (origin.protocol !== "https:" || origin.origin !== binding.publicOrigin || origin.username || origin.password ||
      !/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(binding.mount) ||
      owner.profile.installationId !== binding.installationId || owner.profile.tenantId !== binding.tenantId ||
      typeof window !== "object" || window.location.origin !== binding.publicOrigin)
    throw new SfTeamSessionError("protocol")
  const life = new AbortController()
  let namespace: TeamProfile.SessionNamespace | undefined, failed = false
  const listCursors = new Set<string>(), messageCursors = new Map<string, Set<string>>()
  const retire = () => { life.abort(); namespace = undefined; listCursors.clear(); messageCursors.clear() }
  input.signal.addEventListener("abort", retire, { once: true })
  if (input.signal.aborted) retire()
  const check = () => {
    if (life.signal.aborted || input.signal.aborted || !input.current() ||
        typeof window !== "object" || window.location.origin !== binding.publicOrigin) {
      retire()
      throw new SfTeamSessionError("retired")
    }
  }
  const invalidate = (reason: SfTeamSessionFailure): never => {
    retire()
    if (!failed) { failed = true; input.invalidated(reason) }
    throw new SfTeamSessionError(reason)
  }
  const inspect = (value: TeamProfile.SessionNamespace, mayInitialize = false) => {
    check()
    if (!sameTeamSessionOwner(owner, value.owner) ||
        namespace && namespace.authorityGeneration !== value.authorityGeneration) return invalidate("namespace")
    if (!namespace) {
      if (!mayInitialize) return invalidate("namespace")
      namespace = structuredClone(value)
    }
  }
  const ready = () => { check(); if (!namespace) throw new SfTeamSessionError("namespace") }
  const remember = (cursors: { readonly previous?: string; readonly next?: string }, target: Set<string>) => {
    if (cursors.previous) target.add(cursors.previous)
    if (cursors.next) target.add(cursors.next)
  }
  const withCurrent = async <A>(run: () => Promise<A>): Promise<A> => {
    check()
    const value = await run()
    check()
    return value
  }
  const decode = <A>(run: () => A): A => {
    try { return run() }
    catch (error) {
      if (error instanceof SfTeamSessionError) throw error
      return invalidate("protocol")
    }
  }
  const selector = JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "team", profile: owner.profile })
  const allowed = (url: URL, method: string) => {
    if (url.origin !== origin.origin || url.username || url.password || url.hash || /%2f|%5c/i.test(url.pathname)) return false
    if (url.pathname === "/api/event") return method === "GET" && !url.search
    if (url.pathname === "/api/session") {
      if (method === "POST") return !url.search
      return method === "GET" && [...url.searchParams.keys()].every((key) =>
        ["limit", "order", "search", "includeArchived", "cursor"].includes(key) && url.searchParams.getAll(key).length === 1)
    }
    if (url.pathname === "/api/session/active") return method === "GET" && !url.search
    const match = /^\/api\/session\/([^/]+)(?:\/(message|history|prompt|archive|rename|interrupt))?$/.exec(url.pathname)
    if (!match || !Schema.is(Session.ID)(decodeURIComponent(match[1]!))) return false
    const operation = match[2]
    if (operation === "message" || operation === "history")
      return method === "GET" && [...url.searchParams.keys()].every((key) =>
        (operation === "message" ? ["limit", "order", "cursor"] : ["limit", "after"]).includes(key) &&
        url.searchParams.getAll(key).length === 1)
    return !url.search && (operation ? method === "POST" : method === "GET")
  }

  const fetch: SfTransportFetch = async (address, init) => {
    check()
    const url = new URL(address instanceof Request ? address.url : String(address)), method = init?.method ?? "GET"
    const headers = new Headers(init?.headers)
    if (address instanceof Request || !allowed(url, method) ||
        [...headers.keys()].some((key) => key !== "content-type")) throw new SfTeamSessionError("protocol")
    headers.set("x-sf-team-profile", selector)
    const abort = new AbortController()
    const signal = AbortSignal.any([life.signal, input.signal, abort.signal, ...(init?.signal ? [init.signal] : [])])
    const timer = setTimeout(() => abort.abort(), 15000)
    const streaming = url.pathname === "/api/event"
    url.pathname = binding.mount + url.pathname
    let response: Response
    try {
      response = await input.fetch(url.href, { ...init, method, headers, signal,
        credentials: "same-origin", cache: "no-store", redirect: "error", mode: "same-origin" })
      check()
      if (signal.aborted) throw new SfTeamSessionError("transport")
      if (response.status === 401 || response.status === 403) {
        // Cancellation has no user-visible payload and must not delay retirement.
        void response.body?.cancel().catch(() => {})
        return invalidate(response.status === 401 ? "unauthenticated" : "denied")
      }
      if (response.redirected || response.headers.get("cache-control") !== "no-store") {
        void response.body?.cancel().catch(() => {})
        return invalidate("protocol")
      }
    } catch (cause) {
      clearTimeout(timer)
      abort.abort()
      if (cause instanceof SfTeamSessionError) throw cause
      throw new SfTeamSessionError("transport", { cause })
    }
    if (!response.body) { clearTimeout(timer); return response }
    if (streaming) clearTimeout(timer)
    const reader = response.body.getReader()
    let consumed = 0, closed = false
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener("abort", cancelled) }
    const cancelReader = () => { void reader.cancel().catch(() => {}) }
    let failBody: ((error: Error) => void) | undefined
    const cancelled = () => {
      if (closed) return
      closed = true; cleanup(); cancelReader(); failBody?.(new SfTeamSessionError("retired"))
    }
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        failBody = (error) => controller.error(error)
        signal.addEventListener("abort", cancelled, { once: true })
        if (signal.aborted) cancelled()
      },
      async pull(controller) {
        if (closed) return
        try {
          check()
          const chunk = await reader.read()
          check()
          if (signal.aborted || closed) return
          if (chunk.done) { closed = true; cleanup(); reader.releaseLock(); controller.close(); return }
          consumed += chunk.value.byteLength
          if (!streaming && consumed > 8 * 1024 * 1024) throw new SfTeamSessionError("protocol")
          controller.enqueue(chunk.value)
        } catch (error) {
          if (closed) return
          closed = true; cleanup(); cancelReader()
          controller.error(error)
        }
      },
      cancel() { if (!closed) { closed = true; cleanup(); cancelReader() } },
    })
    return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers })
  }
  const client = Orchestra.make({ baseUrl: binding.publicOrigin, fetch })
  const checkedInfo = (value: unknown, initialize = false) => {
    const decoded = decode(() => Schema.decodeUnknownSync(Info, strict)(value))
    inspect(decoded.namespace, initialize)
    return Schema.encodeSync(Info)(decoded)
  }
  return Object.freeze({
    namespace: () => namespace ? structuredClone(namespace) : undefined,
    async list(value: typeof ListInput.Type = {}, signal?: AbortSignal) {
      const query = decode(() => Schema.decodeUnknownSync(ListInput, strict)(value))
      if (query.cursor && !listCursors.has(query.cursor)) throw new SfTeamSessionError("protocol")
      const wire = await withCurrent(() => client.sessions.list(query, { signal }))
      const decoded = decode(() => Schema.decodeUnknownSync(List, strict)(wire))
      inspect(decoded.namespace, true)
      for (const item of decoded.data) inspect(item.namespace)
      remember(decoded.cursor, listCursors)
      return Schema.encodeSync(List)(decoded)
    },
    async get(value: typeof GetInput.Type, signal?: AbortSignal) {
      const query = decode(() => Schema.decodeUnknownSync(GetInput, strict)(value))
      const result = checkedInfo(await withCurrent(() => client.sessions.get(query, { signal })), true)
      if (result.id !== query.sessionID) return invalidate("protocol")
      return result
    },
    async active(signal?: AbortSignal) {
      ready()
      const value = await withCurrent(() => client.sessions.active({ signal }))
      const result = decode(() => Schema.decodeUnknownSync(Active, strict)(value))
      inspect(result.namespace)
      return Schema.encodeSync(Active)(result)
    },
    async messages(value: typeof MessageInput.Type, signal?: AbortSignal) {
      ready()
      const query = decode(() => Schema.decodeUnknownSync(MessageInput, strict)(value))
      const cursors = messageCursors.get(query.sessionID) ?? new Set<string>()
      if (query.cursor && !cursors.has(query.cursor)) throw new SfTeamSessionError("protocol")
      const wire = await withCurrent(() => client.messages.list(query, { signal }))
      const result = decode(() => Schema.decodeUnknownSync(Messages, strict)(wire))
      inspect(result.namespace); remember(result.cursor, cursors); messageCursors.set(query.sessionID, cursors)
      return Schema.encodeSync(Messages)(result)
    },
    async history(value: typeof HistoryInput.Type, signal?: AbortSignal) {
      ready()
      const query = decode(() => Schema.decodeUnknownSync(HistoryInput, strict)(value))
      const wire = await withCurrent(() => client.sessions.history(query, { signal }))
      const result = decode(() => Schema.decodeUnknownSync(History, strict)(wire))
      inspect(result.namespace)
      if (result.data.some((event) => event.data.sessionID !== query.sessionID)) return invalidate("protocol")
      return Schema.encodeSync(History)(result)
    },
    async create(value: typeof CreateInput.Type, signal?: AbortSignal) {
      ready()
      const query = decode(() => Schema.decodeUnknownSync(CreateInput, strict)(value))
      const result = checkedInfo(await withCurrent(() => client.sessions.create(query, { signal })))
      if (result.id !== query.id) return invalidate("protocol")
      return result
    },
    async prompt(value: typeof PromptInput.Type, signal?: AbortSignal) {
      ready()
      const query = decode(() => Schema.decodeUnknownSync(PromptInput, strict)(value))
      const wire = await withCurrent(() => client.sessions.prompt({
        sessionID: query.sessionID, id: query.id, prompt: { text: query.text },
      }, { signal }))
      const result = decode(() => Schema.decodeUnknownSync(SessionInput.Admitted, strict)(wire))
      if (result.id !== query.id || result.sessionID !== query.sessionID || result.prompt.text !== query.text) return invalidate("protocol")
      return Schema.encodeSync(SessionInput.Admitted)(result)
    },
    async archive(value: typeof ArchiveInput.Type, signal?: AbortSignal) {
      ready()
      const query = decode(() => Schema.decodeUnknownSync(ArchiveInput, strict)(value))
      await withCurrent(() => client.sessions.archive(query, { signal }))
    },
    async rename(value: typeof RenameInput.Type, signal?: AbortSignal) {
      ready()
      const query = decode(() => Schema.decodeUnknownSync(RenameInput, strict)(value))
      await withCurrent(() => client.sessions.rename(query, { signal }))
    },
    async interrupt(value: typeof GetInput.Type, signal?: AbortSignal) {
      ready()
      const query = decode(() => Schema.decodeUnknownSync(GetInput, strict)(value))
      await withCurrent(() => client.sessions.interrupt(query, { signal }))
    },
    async *events(signal?: AbortSignal): AsyncIterable<SfTeamSessionEvent> {
      ready()
      for await (const value of client.events.subscribe({ signal })) {
        check()
        const result = decode(() => Schema.decodeUnknownSync(Frame, strict)(value))
        inspect(result.namespace)
        yield Schema.encodeSync(OrchestraEvent)(result.event)
      }
      check()
    },
    dispose() { input.signal.removeEventListener("abort", retire); retire() },
  })
}
export type SfTeamSessions = ReturnType<typeof createSfTeamSessions>
