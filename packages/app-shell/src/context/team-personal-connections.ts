import { createStore, reconcile } from "solid-js/store"
import { Option, Schema } from "effect"
import { ConnectionAccess } from "@orchestra/schema/connection-access"
import { ProviderAccess } from "@orchestra/schema/provider-access"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { NonNegativeInt } from "@orchestra/schema/schema"
import type { SfTeamContext, SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import { createSfPersonalConnections } from "@orchestra/client/sucafina/personal-connections"
import type { SfTransportFetch } from "@orchestra/client/sucafina/transport"
import type { TeamAdministrativeDraft } from "../orchestra/chapters/sucafina/local-administration/team-configuration-state"
import { teamPrivateKey, type TeamWindowIdentity } from "../utils/team-profile-storage"

const strict = { onExcessProperty: "error" } as const
const Pending = Schema.Struct({
  version: Schema.Literal(1), owner: TeamProfile.Owner, windowId: Schema.String,
  key: ConnectionAccess.PersonalKey, action: Schema.Literals(["create", "update", "remove"]), expectedRevision: NonNegativeInt,
}).annotate({ parseOptions: { onExcessProperty: "error" } })
type Pending = typeof Pending.Type
export type TeamPersonalNotice = "sf.teams.personalUnavailable" | "sf.teams.personalDenied" | "sf.teams.personalInvalid" |
  "sf.teams.personalSaved" | "sf.teams.personalRemoved" | "sf.teams.personalUnknown" | "sf.teams.personalObserved" |
  "sf.teams.personalConflict" | "sf.teams.personalJournalUnavailable"
type State = {
  status: "idle" | "loading" | "ready" | "denied" | "unavailable"
  providers: readonly ProviderAccess.Metadata[]
  selected?: string
  connection?: ConnectionAccess.Slot
  label: string
  secret: string
  busy: boolean
  sending: boolean
  pending: boolean
  observed: boolean
  canWrite: boolean
  message?: TeamPersonalNotice
}
type Lifetime = {
  context: SfTeamContext; generation: number; owner: TeamProfile.Owner; abort: AbortController
  client: ReturnType<typeof createSfPersonalConnections>
}
const keyText = (key: ConnectionAccess.PersonalKey) => JSON.stringify([key.category, key.resourceId, key.id])
const initial = (): State => ({ status: "idle", providers: [], label: "", secret: "",
  busy: false, sending: false, pending: false, observed: false, canWrite: false })

/** Secret text exists only in the current form and the single in-flight POST.
 * The optional journal retains only an original-owner/window intent. A later GET
 * observes current metadata; it cannot establish who committed an unknown POST. */
export function createTeamPersonalConnections(input: Readonly<{
  binding: SfTeamInstallationDescriptor
  window: TeamWindowIdentity
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">
  context(): SfTeamContext | undefined
  generation(): number
  fetch: SfTransportFetch
  confirmDiscard(): Promise<boolean>
  notice(key: TeamPersonalNotice): void
}>) {
  const [state, setState] = createStore<State>(initial())
  let active: Lifetime | undefined, pending: Pending | undefined, baseline = "", serial = 0
  const current = (life: Lifetime) => active === life && !life.abort.signal.aborted &&
    input.context() === life.context && input.generation() === life.generation
  const selected = () => state.providers.find((provider) => provider.providerId === state.selected)
  const journalKey = (life: Lifetime, key: ConnectionAccess.PersonalKey) =>
    teamPrivateKey(life.owner, "personal-connection-pending", input.window.id) + ":" + encodeURIComponent(keyText(key))
  const remembered = (life: Lifetime, key: ConnectionAccess.PersonalKey): Pending | undefined => {
    if (!input.window.persistent) return
    try {
      const raw = input.storage.getItem(journalKey(life, key))
      if (!raw || raw.length > 4096) return
      const decoded = Schema.decodeUnknownOption(Pending, strict)(JSON.parse(raw))
      if (Option.isNone(decoded) || decoded.value.windowId !== input.window.id ||
          JSON.stringify(decoded.value.owner) !== JSON.stringify(life.owner) || keyText(decoded.value.key) !== keyText(key)) return
      return decoded.value
    } catch { return } // Optional restore never authorizes a request or restores a secret.
  }
  const remember = (life: Lifetime, value: Pending) => {
    if (!input.window.persistent) return false
    try {
      const key = journalKey(life, value.key), raw = JSON.stringify(value)
      input.storage.setItem(key, raw)
      return input.storage.getItem(key) === raw
    } catch { return false }
  }
  const forget = (life: Lifetime, value: Pending) => {
    try {
      if (JSON.stringify(remembered(life, value.key)) === JSON.stringify(value))
        input.storage.removeItem(journalKey(life, value.key))
      return input.storage.getItem(journalKey(life, value.key)) === null
    } catch { return false } // A retained reference needs an explicit later read; it is never replayed.
  }
  const dirty = () => state.busy || state.pending || !!state.secret || state.label !== baseline
  const retire = () => {
    serial++; active?.abort.abort(); active?.client.dispose(); active = undefined; pending = undefined; baseline = ""
    setState(reconcile(initial()))
  }
  const show = (key: TeamPersonalNotice) => { setState("message", key); input.notice(key) }
  const failed = (life: Lifetime, status: string) => {
    if (!current(life)) return
    if (status === "denied") {
      retire(); setState("status", "denied"); show("sf.teams.personalDenied")
    } else {
      setState({ status: "unavailable", connection: undefined, label: "", secret: "", canWrite: false })
      baseline = ""; show("sf.teams.personalUnavailable")
    }
    // Log only the bounded outcome label. Requests and credential values never enter diagnostics.
    console.error("Personal connection action was not completed", status === "denied" ? "denied" : "unavailable")
  }
  const read = async (life: Lifetime, key: ConnectionAccess.PersonalKey) => {
    setState({ busy: true, canWrite: false, secret: "", observed: false })
    try {
      const result = await life.client.read(key, { signal: life.abort.signal })
      if (!current(life)) return false
      if (result.kind !== "response") { failed(life, "unavailable"); return false }
      if (result.body.status !== "available") { failed(life, result.body.status); return false }
      const retained = remembered(life, key)
      baseline = result.body.connection.label
      pending = retained
      setState({ status: "ready", connection: structuredClone(result.body.connection), label: baseline,
        secret: "", pending: !!retained, observed: !!retained, canWrite: !retained })
      if (retained) show("sf.teams.personalObserved")
      return true
    } finally { if (current(life)) setState("busy", false) }
  }
  const choose = async (providerId: string) => {
    const life = active, epoch = serial, provider = state.providers.find((item) => item.providerId === providerId)
    if (!life || !current(life) || !provider || state.busy) return false
    if (dirty() && !await input.confirmDiscard()) return false
    if (epoch !== serial || !current(life)) return false
    pending = undefined; baseline = ""
    setState({ selected: provider.providerId, connection: undefined, label: "", secret: "",
      pending: false, observed: false, canWrite: false, message: undefined })
    return read(life, provider.connection)
  }
  const open = async () => {
    if (state.busy) return false
    const context = input.context(), generation = input.generation(), previous = active, epoch = serial
    if (!context?.stamp.team) return false
    if (dirty() && !await input.confirmDiscard()) return false
    if (epoch !== serial || active !== previous || input.context() !== context || input.generation() !== generation) return false
    retire()
    const owner = Schema.decodeUnknownSync(TeamProfile.Owner, strict)(structuredClone(context.stamp.team.owner))
    const abort = new AbortController()
    const life: Lifetime = { context, generation, owner, abort,
      client: createSfPersonalConnections({ binding: input.binding, owner, signal: abort.signal,
        current: () => current(life), fetch: input.fetch }) }
    active = life
    setState({ status: "loading", busy: true })
    try {
      const result = await life.client.catalog({ signal: life.abort.signal })
      if (!current(life)) return false
      if (result.kind !== "response") { failed(life, "unavailable"); return false }
      if (!("namespace" in result.body)) { failed(life, result.body.status); return false }
      setState({ status: "ready", providers: structuredClone(result.body.providers), busy: false })
      if (result.body.providers.length === 1) return choose(result.body.providers[0]!.providerId)
      return true
    } finally { if (current(life)) setState("busy", false) }
  }
  const submit = async (remove = false) => {
    const life = active, provider = selected(), connection = state.connection
    if (!life || !current(life) || !provider || !connection || state.busy || state.pending || !state.canWrite) return false
    const parsed = Schema.decodeUnknownOption(ConnectionAccess.PersonalCommand, strict)(remove ?
      { action: "remove", key: provider.connection, expectedRevision: connection.revision } :
      { action: connection.state === "active" ? "update" : "create", key: provider.connection,
        expectedRevision: connection.revision, label: state.label, secret: state.secret })
    if (Option.isNone(parsed)) { show("sf.teams.personalInvalid"); console.error("Personal connection input is invalid"); return false }
    const written = Schema.decodeUnknownSync(Pending, strict)({ version: 1, owner: life.owner, windowId: input.window.id,
      key: parsed.value.key, action: parsed.value.action, expectedRevision: parsed.value.expectedRevision })
    if (!remember(life, written)) {
      show("sf.teams.personalJournalUnavailable"); console.error("Personal connection reference could not be retained"); return false
    }
    pending = written
    setState({ busy: true, sending: true, pending: true, observed: false, canWrite: false, secret: "", message: undefined })
    try {
      const result = await life.client.command(parsed.value, { signal: life.abort.signal })
      if (!current(life)) return false
      if (result.kind !== "response") {
        show("sf.teams.personalUnknown"); console.error("Personal connection outcome is unknown"); return false
      }
      if (result.body.status === "saved" || result.body.status === "removed") {
        forget(life, written); pending = undefined; baseline = result.body.connection.label
        setState({ connection: structuredClone(result.body.connection), label: baseline, pending: false })
        show(result.body.status === "saved" ? "sf.teams.personalSaved" : "sf.teams.personalRemoved")
        return true
      }
      if (result.body.status === "unavailable") {
        show("sf.teams.personalUnknown"); console.error("Personal connection outcome is unknown"); return false
      }
      forget(life, written); pending = undefined; setState("pending", false)
      if (result.body.status === "denied") { failed(life, "denied"); return false }
      show(result.body.status === "conflict" ? "sf.teams.personalConflict" : "sf.teams.personalInvalid")
      console.error("Personal connection was not changed", result.body.status)
      return false
    } finally { if (current(life)) setState({ busy: false, sending: false }) }
  }
  const guard: TeamAdministrativeDraft = {
    dirty, pending: () => state.sending,
    discard() { if (!state.sending) { setState({ secret: "", label: baseline, pending: false }); pending = undefined } },
    retire,
  }
  return Object.freeze({
    state, guard, open, choose, submit,
    edit(field: "label" | "secret", value: string) {
      if (!active || !current(active) || state.busy || state.pending || !state.canWrite) return false
      if (value.length > (field === "secret" ? 16384 : 256)) return false
      setState(field, value); return true
    },
    async refresh() {
      const life = active, provider = selected(), epoch = serial
      if (!life || !current(life) || !provider || state.busy) return false
      if ((!!state.secret || state.label !== baseline) && !await input.confirmDiscard()) return false
      if (!current(life) || epoch !== serial) return false
      return read(life, provider.connection)
    },
    acceptObserved() {
      const life = active
      if (!life || !current(life) || !pending || state.busy || !state.observed || !state.connection) return false
      if (!forget(life, pending)) {
        show("sf.teams.personalJournalUnavailable"); console.error("Personal connection reference could not be cleared"); return false
      }
      pending = undefined
      setState({ pending: false, observed: false, canWrite: true, message: undefined })
      return true
    },
    dispose: retire,
  })
}
