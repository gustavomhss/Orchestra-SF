import { createStore, produce, reconcile, unwrap } from "solid-js/store"
import { Option, Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import type { SfTeamContext, SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import { createSfTeamProfileClient } from "@orchestra/client/sucafina/team-profile"
import type { SfTransportFetch } from "@orchestra/client/sucafina/transport"
import { teamPrivateKey, type TeamWindowIdentity } from "../../../../utils/team-profile-storage"

const strict = { onExcessProperty: "error" } as const
type Editable<Value> = Value extends object ? { -readonly [Key in keyof Value]: Editable<Value[Key]> } : Value
type Document = Editable<TeamProfile.ConfigurationDocument>
const empty = (): Document => ({ version: 1, settings: {} })
const PendingConfiguration = Schema.Struct({
  version: Schema.Literal(1), owner: TeamProfile.Owner, windowId: Schema.String,
  expectedRevision: Schema.Number.check(Schema.makeFilter((value) => Number.isSafeInteger(value) && value >= 0)),
  identity: Schema.String.check(Schema.isPattern(/^[0-9a-f]{64}$/)),
  documentHash: Schema.String.check(Schema.isPattern(/^[0-9a-f]{64}$/)),
}).annotate({ parseOptions: { onExcessProperty: "error" } })
type Write = typeof PendingConfiguration.Type
const sorted = (value: unknown): unknown => Array.isArray(value) ? value.map(sorted) :
  value && typeof value === "object" ? Object.fromEntries(Object.entries(value)
    .filter(([, item]) => item !== undefined).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, item]) => [key, sorted(item)])) : value
const canonical = (value: unknown) => JSON.stringify(sorted(value))
const digest = async (value: unknown) => Array.from(new Uint8Array(
  await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(value))),
)).map((value) => value.toString(16).padStart(2, "0")).join("")

export type TeamAdministrativeDraft = Readonly<{
  dirty(): boolean
  pending(): boolean
  discard(): void
  retire(): void
}>
type Notice = "sf.teams.configSaved" | "sf.teams.configObserved" | "sf.teams.configDifferent" |
  "sf.teams.configUnknown" | "sf.teams.configInvalid" | "sf.teams.configMissing" | "sf.teams.configJournalUnavailable" |
  "sf.teams.adminConflict" | "sf.teams.adminFailed" | "sf.teams.adminDenied" | "sf.teams.adminUnavailable"
type State = {
  status: "idle" | "loading" | "ready" | "denied" | "unavailable"
  profile?: TeamProfile.Ref
  revision?: number
  document: Document
  busy: boolean
  pending: boolean
  message?: Notice
}
type Lifetime = { generation: number; context: SfTeamContext; abort: AbortController; profile: TeamProfile.Ref;
  owner: TeamProfile.Owner; key: string; client: ReturnType<typeof createSfTeamProfileClient> }

/** An administrative draft is presentation state. Its identity/hash only compare
 * an explicit subsequent GET; they never admit a write or prove who committed it. */
export function createTeamConfigurationState(input: Readonly<{
  binding: SfTeamInstallationDescriptor
  window: TeamWindowIdentity
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">
  context(): SfTeamContext | undefined
  generation(): number
  fetch: SfTransportFetch
  confirmDiscard(): Promise<boolean>
  refresh(): Promise<void>
  notice(key: Notice): void
}>) {
  const [state, setState] = createStore<State>({ status: "idle", document: empty(), busy: false, pending: false })
  let active: Lifetime | undefined, pending: Write | undefined, baseline = canonical(empty()), serial = 0
  const current = (life: Lifetime) => active === life && !life.abort.signal.aborted &&
    input.generation() === life.generation && input.context() === life.context &&
    life.context.profile.administration.status === "available"
  const snapshot = () => structuredClone(unwrap(state.document))
  // Only an original-owner intent is retained. The document, draft, grants and
  // request body never enter browser storage, and this label is not admission.
  const remembered = (life: Lifetime): Write | undefined => {
    if (!input.window.persistent) return
    try {
      const raw = input.storage.getItem(life.key)
      if (!raw || raw.length > 2048) return
      const value = Schema.decodeUnknownOption(PendingConfiguration, strict)(JSON.parse(raw))
      if (Option.isNone(value) || value.value.windowId !== input.window.id ||
          canonical(value.value.owner) !== canonical(life.owner)) return
      return value.value
    } catch { return }
  }
  const remember = (life: Lifetime, written: Write) => {
    if (!input.window.persistent) return false
    try {
      const raw = JSON.stringify(written)
      input.storage.setItem(life.key, raw)
      return input.storage.getItem(life.key) === raw
    } catch { return false }
  }
  const forget = (life: Lifetime, written: Write) => {
    try {
      if (remembered(life)?.identity === written.identity) input.storage.removeItem(life.key)
    } catch { /* A retained intent is reconciled by a later admitted read, never retried. */ }
  }
  const matches = async (life: Lifetime, written: Write, observed: TeamProfile.ConfigurationSnapshot) =>
    observed.configRevision >= written.expectedRevision &&
    await digest(observed.document) === written.documentHash &&
    await digest({ profile: life.profile, expectedRevision: written.expectedRevision, document: observed.document }) === written.identity
  const dirty = () => state.busy || state.pending || state.status === "ready" && canonical(snapshot()) !== baseline
  const retire = () => {
    serial++; active?.abort.abort(); active = undefined; pending = undefined; baseline = canonical(empty())
    setState(reconcile({ status: "idle", document: empty(), busy: false, pending: false }))
  }
  const show = (key: Notice) => { setState("message", key); input.notice(key) }
  const denied = async (life: Lifetime, status: string) => {
    if (!current(life)) return
    if (status === "denied" || status === "unauthenticated") {
      retire(); setState("status", "denied"); show("sf.teams.adminDenied"); await input.refresh()
    } else { setState("status", "unavailable"); show("sf.teams.adminUnavailable") }
  }
  const install = (document: TeamProfile.ConfigurationDocument, revision: number) => {
    baseline = canonical(document)
    setState({ document: structuredClone(document), revision, status: "ready", busy: false, pending: false })
  }
  const open = async (profile: TeamProfile.Ref): Promise<boolean> => {
    if (state.busy || state.pending) { show("sf.teams.configUnknown"); return false }
    const previous = active, epoch = serial, context = input.context(), generation = input.generation()
    if (!context || context.profile.administration.status !== "available") return false
    if (dirty() && !await input.confirmDiscard()) return false
    if (epoch !== serial || active !== previous || input.context() !== context || input.generation() !== generation) return false
    const parsed = Schema.decodeUnknownOption(TeamProfile.Ref, strict)(Object.fromEntries(Object.entries(profile)))
    if (Option.isNone(parsed) || parsed.value.installationId !== input.binding.installationId ||
        parsed.value.tenantId !== input.binding.tenantId) return false
    retire()
    const owner = Schema.decodeUnknownSync(TeamProfile.Owner, strict)({ profile: parsed.value, principal: context.profile.principal })
    const life: Lifetime = { generation, context, profile: parsed.value, owner,
      key: teamPrivateKey(owner, "configuration-pending", input.window.id), abort: new AbortController(),
      client: createSfTeamProfileClient({ binding: input.binding, generation, currentGeneration: input.generation, fetch: input.fetch }) }
    active = life
    setState({ status: "loading", profile: life.profile, busy: true, message: undefined })
    try {
      const result = await life.client.readConfiguration(life.profile, { signal: life.abort.signal })
      if (!current(life)) return false
      if (result.kind !== "response") { await denied(life, "unavailable"); return false }
      if (result.body.status === "ok") {
        const observed = result.body.configuration, retained = remembered(life)
        const matched = retained ? await matches(life, retained, observed) : false
        if (!current(life)) return false
        install(observed.document, observed.configRevision)
        if (retained && matched) {
          forget(life, retained); show("sf.teams.configObserved"); await input.refresh()
        } else if (retained) {
          pending = retained; setState("pending", true); show("sf.teams.configDifferent")
        }
        return true
      }
      if (result.body.status !== "not-found") { await denied(life, result.body.status); return false }
      // A missing document has no revision. Read current installation metadata
      // explicitly; a racing edit is still rejected by the server's CAS.
      const list = await life.client.list({ signal: life.abort.signal })
      if (!current(life)) return false
      if (list.kind !== "response" || list.body.status !== "ok" ||
          !list.body.profiles.some((row) => row.profile.teamObjectId === life.profile.teamObjectId && row.enabled)) {
        await denied(life, list.kind === "response" ? list.body.status : "unavailable"); return false
      }
      install(empty(), list.body.configRevision)
      const retained = remembered(life)
      if (retained) { pending = retained; setState("pending", true); show("sf.teams.configUnknown") }
      else show("sf.teams.configMissing")
      return true
    } catch (error) {
      if (current(life)) { setState("status", "unavailable"); show("sf.teams.adminUnavailable")
        console.error("Teams shared configuration read failed", error instanceof Error ? error.name : "unknown") }
      return false
    } finally { if (current(life)) setState("busy", false) }
  }
  const save = async () => {
    const life = active, revision = state.revision
    if (!life || !current(life) || state.status !== "ready" || state.busy || pending || revision === undefined) return false
    const document = Schema.decodeUnknownOption(TeamProfile.ConfigurationDocument, strict)(snapshot())
    if (Option.isNone(document)) { show("sf.teams.configInvalid"); return false }
    const command = Schema.decodeUnknownSync(TeamProfile.ConfigurationCommand, strict)({
      profile: life.profile, expectedRevision: revision, document: document.value,
    })
    if (new TextEncoder().encode(JSON.stringify(command)).byteLength > 65536) { show("sf.teams.configInvalid"); return false }
    setState({ busy: true, message: undefined })
    let dispatched = false
    try {
      const identity = await digest(command), documentHash = await digest(command.document)
      if (!current(life)) return false
      const written: Write = { version: 1, owner: life.owner, windowId: input.window.id,
        expectedRevision: command.expectedRevision, identity, documentHash }
      if (!remember(life, written)) { show("sf.teams.configJournalUnavailable"); return false }
      pending = written; setState("pending", true)
      dispatched = true
      const result = await life.client.configureDocument(command, { signal: life.abort.signal })
      if (!current(life)) return false
      if (result.kind === "transport-error" && result.reason === "outcome-unknown") {
        show("sf.teams.configUnknown"); return false
      }
      forget(life, written); pending = undefined; setState("pending", false)
      if (result.kind !== "response") { show("sf.teams.configInvalid"); return false }
      if (result.body.status === "ok") {
        install(command.document, result.body.configRevision); show("sf.teams.configSaved")
        await input.refresh(); return true
      }
      if (result.body.status === "conflict") {
        setState("revision", undefined); show("sf.teams.adminConflict"); return false
      }
      if (result.body.status === "denied" || result.body.status === "unauthenticated") {
        await denied(life, result.body.status); return false
      }
      show("sf.teams.adminFailed"); return false
    } catch (error) {
      if (current(life)) { show(dispatched ? "sf.teams.configUnknown" : "sf.teams.configInvalid")
        console.error("Teams shared configuration change was not confirmed", error instanceof Error ? error.name : "unknown") }
      return false
    } finally { if (current(life)) setState("busy", false) }
  }
  const reconcileWrite = async () => {
    const life = active, written = pending
    if (!life || !written || !current(life) || state.busy) return false
    setState("busy", true)
    try {
      if (!current(life) || pending !== written) return false
      const result = await life.client.readConfiguration(life.profile, { signal: life.abort.signal })
      if (!current(life) || pending !== written) return false
      if (result.kind !== "response" || result.body.status !== "ok") {
        if (result.kind === "response" && ["denied", "unauthenticated"].includes(result.body.status))
          await denied(life, result.body.status)
        else show("sf.teams.configUnknown")
        return false
      }
      const observed = result.body.configuration
      const matched = await matches(life, written, observed)
      if (!current(life) || pending !== written) return false
      if (!matched) { show("sf.teams.configDifferent"); return false }
      // A matching current document establishes the requested state, not who
      // committed it or the response of the original request. No POST is retried.
      forget(life, written); pending = undefined
      install(observed.document, observed.configRevision); show("sf.teams.configObserved")
      await input.refresh(); return true
    } catch (error) {
      if (current(life)) { show("sf.teams.configUnknown")
        console.error("Teams shared configuration reconciliation failed", error instanceof Error ? error.name : "unknown") }
      return false
    } finally { if (current(life)) setState("busy", false) }
  }
  const edit = (change: (document: Document) => void) => {
    if (!active || !current(active) || state.status !== "ready" || state.busy || state.pending) return false
    setState("document", produce(change)); setState("message", undefined)
    return true
  }
  return Object.freeze({
    state, open, save, reconcileWrite,
    guard: Object.freeze({ dirty, pending: () => state.busy || state.pending, discard: retire, retire }),
    settings(field: "model" | "default_agent", value: string) {
      edit((document) => { if (value) document.settings[field] = value; else delete document.settings[field] })
    },
    agentText(id: string, field: "name" | "description" | "system" | "model" | "variant", value: string) {
      edit((document) => {
        const agent = document.settings.agents && Object.hasOwn(document.settings.agents, id) ? document.settings.agents[id] : undefined
        if (agent) { if (value) agent[field] = value; else delete agent[field] }
      })
    },
    agentMode(id: string, value: string) {
      if (value !== "" && value !== "primary" && value !== "subagent" && value !== "all") return
      edit((document) => {
        const agent = document.settings.agents && Object.hasOwn(document.settings.agents, id) ? document.settings.agents[id] : undefined
        if (agent) { if (value) agent.mode = value; else delete agent.mode }
      })
    },
    agentFlag(id: string, field: "hidden" | "disabled", value: boolean) {
      edit((document) => { const agent = document.settings.agents && Object.hasOwn(document.settings.agents, id) ? document.settings.agents[id] : undefined; if (agent) agent[field] = value })
    },
    addAgent(id: string) {
      const name = id.trim()
      if (!name || Object.hasOwn(state.document.settings.agents ?? {}, name)) { show("sf.teams.configInvalid"); return false }
      const document = snapshot()
      document.settings.agents = Object.fromEntries([...Object.entries(document.settings.agents ?? {}), [name, {}]])
      if (Option.isNone(Schema.decodeUnknownOption(TeamProfile.ConfigurationDocument, strict)(document))) {
        show("sf.teams.configInvalid"); return false
      }
      return edit((current) => { current.settings.agents = document.settings.agents })
    },
    removeAgent(id: string) {
      edit((document) => {
        if (document.settings.agents) delete document.settings.agents[id]
        if (document.settings.default_agent === id) delete document.settings.default_agent
      })
    },
    dispose: retire,
  })
}
