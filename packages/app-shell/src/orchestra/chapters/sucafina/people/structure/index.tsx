import { For, Show, createMemo, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { useNavigate } from "@solidjs/router"
import { SfPeople } from "@orchestra/schema/sucafina/people"
import { createSfPeopleClient } from "@orchestra/client/sucafina/people"
import type { SfRef } from "@orchestra/schema/sucafina/context"
import type { SfSurfaceProps } from "../../context/contracts"
import { SfPageFrame } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import { sfCommonKey, useSfPresentation } from "../../shared/frame/presentation"
import type { SfCopyKey } from "../../shared/frame"
import { createPeopleSession } from "./session"
import {
  SfPeopleEditor, type PeopleField, type PeopleFormValues, type PeopleSaveOutcome,
} from "./editor"
import "./people.css"

type StructureResponse = typeof SfPeople.operations["domain.page.CAP07"]["output"]["Type"]
type StructureData = Extract<StructureResponse, { status: "ok" }>["value"]["data"]
type Selection =
  | Readonly<{ kind: "cio"; edit: boolean }>
  | Readonly<{ kind: "leader" | "member"; id: string; edit: boolean }>
  | Readonly<{ kind: "new-leader" | "new-member"; edit: true }>
type DeleteIntent = Readonly<{ kind: "leader" | "member"; id: string; ref: string }>
const key = (value: string) => value as SfCopyKey
const ref = (value: string) => value as SfRef

const cioFields: readonly PeopleField[] = [
  { name: "name", labelKey: key("sf.u03.name"), input: "text" },
  { name: "title", labelKey: key("sf.u03.title"), input: "text" },
  { name: "location", labelKey: key("sf.u03.location"), input: "text" },
  { name: "start", labelKey: key("sf.u03.start"), input: "date" },
]
const leaderFields: readonly PeopleField[] = [
  { name: "name", labelKey: key("sf.u03.name"), input: "text", required: true },
  { name: "title", labelKey: key("sf.u03.title"), input: "text" },
  { name: "domain", labelKey: key("sf.u03.domain"), input: "text" },
  { name: "location", labelKey: key("sf.u03.location"), input: "text" },
  { name: "start", labelKey: key("sf.u03.start"), input: "date" },
]
const memberFields = (leaders: StructureData["leaders"]): readonly PeopleField[] => [
  { name: "name", labelKey: key("sf.u03.name"), input: "text", required: true },
  { name: "title", labelKey: key("sf.u03.title"), input: "text" },
  { name: "type", labelKey: key("sf.u03.type"), input: "select", required: true,
    options: [{ value: "Employee", labelKey: key("sf.u03.employee") },
      { value: "Contractor", labelKey: key("sf.u03.contractor") }] },
  { name: "leaderId", labelKey: key("sf.u03.leader"), input: "select",
    options: [{ value: "", labelKey: key("sf.u03.noLeader") },
      ...leaders.map((leader) => ({ value: leader.id, label: leader.name || leader.id }))] },
  { name: "location", labelKey: key("sf.u03.location"), input: "text" },
  { name: "start", labelKey: key("sf.u03.start"), input: "date" },
  { name: "end", labelKey: key("sf.u03.end"), input: "date" },
  { name: "status", labelKey: key("sf.u03.status"), input: "select", required: true,
    options: [{ value: "Active", labelKey: key("sf.u03.active") },
      { value: "On Leave", labelKey: key("sf.u03.onLeave") },
      { value: "Terminated", labelKey: key("sf.u03.terminated") }] },
]
const toValues = (value: object, fields: readonly PeopleField[]): PeopleFormValues => {
  const source = value as Record<string, unknown>
  const entries = fields.flatMap((item): ReadonlyArray<readonly [string, string]> => {
    if (!Object.hasOwn(source, item.name)) return []
    const field = source[item.name]
    const text = typeof field === "number" ? String(field) : typeof field === "string" ? field : ""
    return [[item.name, text]]
  })
  return Object.fromEntries(entries)
}

export function SfPeopleStructureView(props: SfSurfaceProps<"CAP07">): JSX.Element {
  const { t, locale } = useSfPresentation()
  const navigate = useNavigate()
  const session = createPeopleSession<StructureData>("CAP07", () => props.route.href,
    (transport, signal) => createSfPeopleClient(transport)["domain.page.CAP07"]({
      ...(props.route.query.year === undefined ? {} : { year: props.route.query.year }),
      ...(props.route.query.month === undefined ? {} : { month: props.route.query.month }),
    }, { signal }))
  const [local, setLocal] = createStore<{
    selection: Selection | undefined
    deleting: DeleteIntent | undefined
    pendingDelete: boolean
    message: string
    search: string
  }>({ selection: undefined, deleting: undefined, pendingDelete: false, message: "", search: "" })
  const current = () => session.ready()
  const source = () => current()?.value.data
  const selectionFromRoute = (): Selection | undefined => {
    switch (props.route.kind) {
      case "cio": return { kind: "cio", edit: true }
      case "leader": return { kind: "leader", id: props.route.params.personRef, edit: false }
      case "member": return { kind: "member", id: props.route.params.personRef, edit: false }
      case "member-edit": return { kind: "member", id: props.route.params.personRef, edit: true }
      case "new-member": return { kind: "new-member", edit: true }
      default: return undefined
    }
  }
  const selected = () => local.selection ?? selectionFromRoute()
  const selectedId = () => {
    const value = selected()
    return value && "id" in value ? value.id : undefined
  }
  const fieldCopy: Readonly<Record<string, SfCopyKey>> = {
    name: key("sf.u03.name"), title: key("sf.u03.title"),
    domain: key("sf.u03.domain"), type: key("sf.u03.type"),
    leaderId: key("sf.u03.leader"), location: key("sf.u03.location"),
    start: key("sf.u03.start"), end: key("sf.u03.end"),
    status: key("sf.u03.status"),
  }
  const leader = (id: string) => source()?.leaders.find((person) => person.id === id)
  const member = (id: string) => source()?.members.find((person) => person.id === id)
  const nameForLeader = (leaderId: string | number | undefined) =>
    leaderId === undefined || String(leaderId) === "" ? t(key("sf.u03.noLeader")) :
      source()?.leaders.find((person) => person.id === String(leaderId))?.name ?? String(leaderId)
  const version = (kind: string, id: string) => current()?.value.versions[kind + ":" + id] ?? 0
  const close = () => {
    setLocal("selection", undefined)
    if (props.route.kind !== "entry") navigate(-1)
  }

  async function saveRecord(
    choice: Selection, values: PeopleFormValues, expectedVersion: number,
    idempotencyKey: string, signal: AbortSignal,
  ): Promise<PeopleSaveOutcome> {
    const active = session.ready()
    if (!active || active.context.stamp.accessRevision !== current()?.context.stamp.accessRevision)
      return { kind: "denied" }
    let result: Awaited<ReturnType<ReturnType<typeof createSfPeopleClient>["domain.command.CAP07.saveMember"]>>
    const client = createSfPeopleClient(active.transport)
    const options = { signal, idempotencyKey }
    if (choice.kind === "cio") {
      if (!session.can("saveCio")) return { kind: "denied" }
      result = await client["domain.command.CAP07.saveCio"]({ version: expectedVersion, values }, options)
    } else if (choice.kind === "leader" || choice.kind === "new-leader") {
      if (!session.can("saveLeader")) return { kind: "denied" }
      result = await client["domain.command.CAP07.saveLeader"]({
        ...(choice.kind === "leader" ? { id: choice.id } : {}),
        version: expectedVersion, values,
      }, options)
    } else {
      if (!session.can("saveMember")) return { kind: "denied" }
      result = await client["domain.command.CAP07.saveMember"]({
        ...(choice.kind === "member" ? { id: choice.id } : {}),
        version: expectedVersion, values,
      }, options)
    }
    if (result.kind === "transport-error") return { kind: "outcome-unknown" }
    if (!result.body.ok) {
      if (result.status === 409) return { kind: "conflict" }
      if (result.status === 403) return { kind: "denied" }
      if (result.status === 422 || result.status === 400)
        return { kind: "invalid", message: result.body.errors?.join("; ") ?? t(sfCommonKey("sf.common.fieldErrorSummary")) }
      return { kind: "unavailable" }
    }
    // POST only confirms the producer command, not a new page projection.
    const refreshed = await session.reload()
    if (!refreshed) return { kind: "confirmed-without-projection" }
    if (choice.kind === "cio") return { kind: "projected",
      value: toValues(refreshed.data.cio, cioFields), version: refreshed.versions.cio ?? 0 }
    if (choice.kind === "new-member" || choice.kind === "new-leader")
      return { kind: "confirmed-without-projection" } // POST never returns new id
    if (choice.kind === "member") {
      const memberId = choice.id
      const updated = refreshed.data.members.find((person) => person.id === memberId)
      return updated ? { kind: "projected", value: toValues(updated, memberFields(refreshed.data.leaders)),
        version: refreshed.versions["members:" + memberId] ?? 0 } :
        { kind: "confirmed-without-projection" }
    }
    if (choice.kind !== "leader") return { kind: "confirmed-without-projection" }
    const leaderId = choice.id
    const updated = refreshed.data.leaders.find((person) => person.id === leaderId)
    return updated ? { kind: "projected", value: toValues(updated, leaderFields),
      version: refreshed.versions["leaders:" + leaderId] ?? 0 } :
      { kind: "confirmed-without-projection" }
  }

  const chooseDelete = (kind: DeleteIntent["kind"], id: string) => {
    const action = kind === "leader" ? "deleteLeader" : "deleteMember"
    if (!session.can(action) || local.pendingDelete) return
    setLocal({ deleting: { kind, id, ref: crypto.randomUUID() }, message: "" })
  }
  const confirmDelete = async () => {
    const intent = local.deleting
    const active = session.ready()
    if (!intent || !active || local.pendingDelete || !session.can(
      intent.kind === "leader" ? "deleteLeader" : "deleteMember")) return
    const selectedVersion = version(intent.kind === "leader" ? "leaders" : "members", intent.id)
    const affectedMembers = intent.kind === "leader" ?
      active.value.data.members.filter((person) => String(person.leaderId ?? "") === intent.id) : []
    const affectedVersions = Object.fromEntries(affectedMembers.map((person) =>
      ["members:" + person.id, version("members", person.id)]))
    const client = createSfPeopleClient(active.transport)
    const controller = new AbortController()
    const options = { signal: controller.signal, idempotencyKey: crypto.randomUUID() }
    setLocal("pendingDelete", true)
    try {
      const result = intent.kind === "leader"
        ? await client["domain.command.CAP07.deleteLeader"]({
          id: intent.id, version: selectedVersion, values: { versions: affectedVersions },
        }, options)
        : await client["domain.command.CAP07.deleteMember"]({
          id: intent.id, version: selectedVersion, values: {},
        }, options)
      if (result.kind === "transport-error") {
        setLocal("message", t(sfCommonKey("sf.common.operationUnknown")))
        return
      }
      if (!result.body.ok) {
        setLocal("message", result.body.errors?.join("; ") ??
          (result.status === 409 ? t(sfCommonKey("sf.common.conflict")) :
            t(sfCommonKey("sf.common.unavailable"))))
        return
      }
      const renewed = await session.reload()
      setLocal("message", renewed ? "" : t(sfCommonKey("sf.common.sourceChanged")))
      setLocal("deleting", undefined)
      if (renewed) setLocal("selection", undefined)
    } finally {
      setLocal("pendingDelete", false)
    }
  }

  const activeEditor = createMemo(() => {
    const choice = selected()
    if (!choice?.edit || !source() || !session.ready()) return undefined
    if (choice.kind === "cio") return {
      choice, entity: "cio" as const, recordRef: ref("cio"),
      version: current()!.value.versions.cio ?? 0,
      original: toValues(source()!.cio, cioFields), fields: cioFields,
      action: { id: "saveCio", operationId: "domain.command.CAP07.saveCio" as const, labelKey: key("sf.u03.saveCio") },
    }
    if (choice.kind === "leader" || choice.kind === "new-leader") {
      const row = choice.kind === "leader" ? leader(choice.id) : undefined
      if (choice.kind === "leader" && !row) return undefined
      return {
        choice, entity: "leader" as const,
        recordRef: choice.kind === "leader" ? ref(choice.id) : undefined,
        version: choice.kind === "leader" ? version("leaders", choice.id) : 0,
        original: row ? toValues(row, leaderFields) : null, fields: leaderFields,
        action: { id: "saveLeader", operationId: "domain.command.CAP07.saveLeader" as const, labelKey: key("sf.u03.saveLeader") },
      }
    }
    const row = choice.kind === "member" ? member(choice.id) : undefined
    if (choice.kind === "member" && !row) return undefined
    const fields = memberFields(source()!.leaders)
    return {
      choice, entity: "member" as const,
      recordRef: choice.kind === "member" ? ref(choice.id) : undefined,
      version: choice.kind === "member" ? version("members", choice.id) : 0,
      original: row ? toValues(row, fields) : null, fields,
      action: { id: "saveMember", operationId: "domain.command.CAP07.saveMember" as const, labelKey: key("sf.u03.saveMember") },
    }
  })
  const detailRow = () => {
    const current = selected()
    if (!current || current.edit) return undefined
    if (current.kind === "leader") return leader(current.id)
    if (current.kind === "member") return member(current.id)
    return undefined
  }
  const stateMessage = () => session.ui() === "denied" ? sfCommonKey("sf.common.noAccess") :
    session.ui() === "session-expired" ? sfCommonKey("sf.common.loginAgain") :
    session.ui() === "unavailable" ? sfCommonKey("sf.common.unavailable") :
    session.ui() === "stale" ? sfCommonKey("sf.common.stale") :
    sfCommonKey("sf.common.loading")
  const visibleMembers = () => {
    const search = local.search.trim().toLocaleLowerCase()
    return source()?.members.filter((person) => !search ||
      [person.name, person.title, person.location, nameForLeader(person.leaderId)]
        .some((value) => String(value ?? "").toLocaleLowerCase().includes(search))) ?? []
  }
  const fieldValue = (field: string, value: unknown) => {
    if (value === undefined || value === null || value === "") return t(key("sf.u03.design.notRecorded"))
    if (field === "leaderId") return nameForLeader(String(value))
    if ((field === "start" || field === "end") && typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)))
      return new Intl.DateTimeFormat(locale(), { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value + "T00:00:00Z"))
    const labels: Readonly<Record<string, SfCopyKey>> = {
      Active: key("sf.u03.active"), "On Leave": key("sf.u03.onLeave"),
      Terminated: key("sf.u03.terminated"), Employee: key("sf.u03.employee"), Contractor: key("sf.u03.contractor"),
    }
    return (field === "status" || field === "type") && labels[String(value)] ?
      t(labels[String(value)]!) : String(value)
  }
  return (
    <SfPageFrame titleKey={key("sf.cap07.title")} context={[]}
      tabs={[]} activeTab={null}
      primaryAction={!selected() && !local.deleting ? {
        id: "add-member", labelKey: key("sf.cap07.primary"),
        tone: "primary", disabled: !session.can("saveMember"), busy: false,
        reasonKey: !session.can("saveMember") ? sfCommonKey("sf.common.readOnly") : undefined,
        onInvoke: () => setLocal("selection", { kind: "new-member", edit: true }),
      } : undefined}
      secondaryActions={[]} density="comfortable" layout="work"
      onLayoutMode={() => undefined}>
      <div class="sf-people-workspace" data-sf-wave="three" data-sf-surface="CAP07"
        data-sf-stage={local.deleting ? "delete" : selected()?.edit ? "editor" : selected() ? "detail" : "collection"}>
      <SfStatePanel state={session.ui()} messageKey={stateMessage()}
        onRetryRead={() => { void session.reload() }}>
        <Show when={source()}>
          {(data) => (
            <>
              <div class="sf-people-collection" hidden={!!selected() || !!local.deleting}>
                <p class="sf-people-lead">{t(key("sf.u03.design.structureLead"))}</p>
                <section class="sf-people-section sf-people-cio" aria-label={t(key("sf.u03.cio"))}>
                  <div class="sf-people-section-heading">
                    <div>
                      <p class="sf-people-eyebrow">{t(key("sf.u03.cio"))}</p>
                      <h2><bdi>{data().cio.name || t(key("sf.u03.design.notRecorded"))}</bdi></h2>
                      <p><bdi>{data().cio.title || t(key("sf.u03.design.notRecorded"))}</bdi></p>
                    </div>
                    <Show when={session.can("saveCio")}>
                      <button type="button" class="mx-btn"
                        onClick={() => setLocal("selection", { kind: "cio", edit: true })}>
                        {t(key("sf.u03.editCio"))}
                      </button>
                    </Show>
                  </div>
                  <dl class="sf-people-profile-meta">
                    <div><dt>{t(key("sf.u03.location"))}</dt><dd>{data().cio.location || t(key("sf.u03.design.notRecorded"))}</dd></div>
                    <div><dt>{t(key("sf.u03.start"))}</dt><dd>{fieldValue("start", data().cio.start)}</dd></div>
                  </dl>
                </section>
                <section class="sf-people-section" aria-label={t(key("sf.u03.leaders"))}>
                  <div class="sf-people-section-heading">
                    <div><h2>{t(key("sf.u03.leaders"))}</h2><p>{t(key("sf.u03.design.leadersLead"))}</p></div>
                    <Show when={session.can("saveLeader")}>
                      <button class="mx-btn" type="button"
                        onClick={() => setLocal("selection", { kind: "new-leader", edit: true })}>
                        {t(key("sf.u03.addLeader"))}
                      </button>
                    </Show>
                  </div>
                  <div class="sf-people-table-region" role="region" tabindex="0" aria-label={t(key("sf.u03.leaders"))}>
                    <table class="sf-people-table">
                      <thead><tr>
                        <th scope="col">{t(key("sf.u03.leader"))}</th>
                        <th scope="col">{t(key("sf.u03.domain"))}</th>
                        <th scope="col">{t(key("sf.u03.members"))}</th>
                        <th scope="col">{t(key("sf.u03.design.actions"))}</th>
                      </tr></thead>
                      <tbody><For each={data().leaders}>
                        {(person) => (
                          <tr data-sf-record={person.id}>
                            <th scope="row" data-label={t(key("sf.u03.leader"))}>
                              <button type="button" class="sf-people-record-link"
                                onClick={() => setLocal("selection", { kind: "leader", id: person.id, edit: false })}>
                                <bdi>{person.name ?? person.id}</bdi>
                              </button>
                              <Show when={person.title}><small class="sf-people-row-meta"><bdi>{person.title}</bdi></small></Show>
                            </th>
                            <td data-label={t(key("sf.u03.domain"))}>{person.domain || t(key("sf.u03.design.notRecorded"))}</td>
                            <td data-label={t(key("sf.u03.members"))}>
                              <span class="sf-people-member-names">{data().members.filter((row) => String(row.leaderId ?? "") === person.id)
                                .map((row) => row.name ?? row.id).join(", ") || t(key("sf.u03.design.notRecorded"))}</span>
                            </td>
                            <td data-label={t(key("sf.u03.design.actions"))}><div class="sf-people-row-actions">
                              <Show when={session.can("saveLeader")}>
                                <button type="button" class="mx-btn"
                                  onClick={() => setLocal("selection", { kind: "leader", id: person.id, edit: true })}>{t(key("sf.u03.edit"))}</button>
                              </Show>
                              <Show when={session.can("deleteLeader")}>
                                <button type="button" class="mx-btn sf-people-danger"
                                  onClick={() => chooseDelete("leader", person.id)}>{t(key("sf.u03.deleteLeader"))}</button>
                              </Show>
                            </div></td>
                          </tr>
                        )}
                      </For></tbody>
                    </table>
                  </div>
                  <Show when={!data().leaders.length}>
                    <SfStatePanel state="empty" messageKey={sfCommonKey("sf.common.empty")} />
                  </Show>
                </section>
                <section class="sf-people-section" aria-label={t(key("sf.u03.members"))}>
                  <div class="sf-people-section-heading"><div>
                    <h2>{t(key("sf.u03.members"))}</h2><p>{t(key("sf.u03.design.membersLead"))}</p>
                  </div></div>
                  <div class="sf-people-toolbar">
                    <label class="sf-people-search">{t(key("sf.u03.design.searchMembers"))}
                      <input type="search" value={local.search}
                        onInput={(event) => setLocal("search", event.currentTarget.value)} />
                    </label>
                  </div>
                  <div class="sf-people-table-region" role="region" tabindex="0" aria-label={t(key("sf.u03.members"))}>
                    <table class="sf-people-table">
                      <thead><tr>
                        <th scope="col">{t(key("sf.u03.name"))}</th><th scope="col">{t(key("sf.u03.leader"))}</th>
                        <th scope="col">{t(key("sf.u03.status"))}</th><th scope="col">{t(key("sf.u03.design.actions"))}</th>
                      </tr></thead>
                      <tbody><For each={visibleMembers()}>
                        {(person) => (
                          <tr data-sf-record={person.id}>
                            <th scope="row" data-label={t(key("sf.u03.name"))}>
                              <button type="button" class="sf-people-record-link"
                                onClick={() => setLocal("selection", { kind: "member", id: person.id, edit: false })}>
                                <bdi>{person.name ?? person.id}</bdi>
                              </button>
                              <Show when={person.title}><small class="sf-people-row-meta"><bdi>{person.title}</bdi></small></Show>
                            </th>
                            <td data-label={t(key("sf.u03.leader"))}><bdi>{nameForLeader(person.leaderId)}</bdi></td>
                            <td data-label={t(key("sf.u03.status"))}><span class="sf-people-status">{fieldValue("status", person.status)}</span></td>
                            <td data-label={t(key("sf.u03.design.actions"))}><div class="sf-people-row-actions">
                              <Show when={session.can("saveMember")}>
                                <button type="button" class="mx-btn"
                                  onClick={() => setLocal("selection", { kind: "member", id: person.id, edit: true })}>{t(key("sf.u03.edit"))}</button>
                              </Show>
                              <Show when={session.can("deleteMember")}>
                                <button type="button" class="mx-btn sf-people-danger"
                                  onClick={() => chooseDelete("member", person.id)}>{t(key("sf.u03.deleteMember"))}</button>
                              </Show>
                            </div></td>
                          </tr>
                        )}
                      </For></tbody>
                    </table>
                  </div>
                  <Show when={!visibleMembers().length}>
                    <SfStatePanel state={data().members.length ? "filtered-empty" : "empty"}
                      messageKey={data().members.length ? key("sf.u03.design.noMembers") : sfCommonKey("sf.common.empty")} />
                  </Show>
                </section>
              </div>
              <Show when={selected() && !local.deleting}>
                <div class="sf-people-stage-nav">
                  <button type="button" class="mx-btn" onClick={close}>{t(key("sf.u03.design.backToStructure"))}</button>
                </div>
              </Show>
              <Show when={selected() && !selected()!.edit && !local.deleting}>
                <section class="sf-people-section sf-people-detail" data-sf-selection="details">
                  <div class="sf-people-section-heading">
                    <div><p class="sf-people-eyebrow">{t(key("sf.u03.details"))}</p>
                      <h2><bdi>{detailRow()?.name || t(key("sf.u03.design.notRecorded"))}</bdi></h2></div>
                    <Show when={detailRow() && session.can(selected()?.kind === "leader" ? "saveLeader" : "saveMember")}>
                      <button type="button" class="mx-btn primary" onClick={() => {
                        const choice = selected()
                        if (choice?.kind === "leader" || choice?.kind === "member") setLocal("selection", { ...choice, edit: true })
                      }}>{t(key("sf.u03.edit"))}</button>
                    </Show>
                  </div>
                  <Show when={detailRow()} fallback={<SfStatePanel state="not-found" messageKey={sfCommonKey("sf.common.removed")} />}>
                    {(row) => <dl>
                      <For each={Object.entries(row()).filter(([field]) => !["id", "cls", "outlook", "notes"].includes(field))}>
                        {([field, value]) => <div><dt>{t(fieldCopy[field] ?? key("sf.u03.details"))}</dt><dd><bdi>{fieldValue(field, value)}</bdi></dd></div>}
                      </For>
                    </dl>}
                  </Show>
                </section>
              </Show>
              <div hidden={!!local.deleting}>
                <Show when={activeEditor()}>
                  {(editor) => <section class="sf-people-editor-stage" data-sf-selection="editor">
                    <SfPeopleEditor surfaceId="CAP07"
                      scopeKey={"people:structure:" + String(props.route.query.year ?? "current")}
                      entity={editor().entity} recordRef={editor().recordRef} version={editor().version}
                      original={editor().original} fields={editor().fields} action={editor().action}
                      admitted={session.can(editor().action.id)} drafts={session.ready()!.drafts}
                      onClose={close}
                      onCommit={(values, expected, keyId, signal) => saveRecord(editor().choice, values, expected, keyId, signal)}
                    />
                  </section>}
                </Show>
              </div>
              <Show when={local.deleting}>
                {(intent) => <section class="sf-people-deletion" role="alertdialog"
                  aria-labelledby="sf-people-delete-title" aria-describedby="sf-people-delete-hint" aria-modal="false">
                  <p class="sf-people-eyebrow">{t(key("sf.u03.details"))}</p>
                  <h2 id="sf-people-delete-title">{t(key(intent().kind === "leader" ? "sf.u03.deleteLeader" : "sf.u03.deleteMember"))}</h2>
                  <p id="sf-people-delete-hint">{t(key("sf.u03.design.deleteHint"))}</p>
                  <p class="sf-people-delete-record"><bdi>{intent().kind === "leader" ? leader(intent().id)?.name ?? intent().id : member(intent().id)?.name ?? intent().id}</bdi></p>
                  <Show when={intent().kind === "leader"}>
                    <p>{t(key("sf.u03.affectedMembers"))}: {data().members.filter(
                      (person) => String(person.leaderId ?? "") === intent().id).length}</p>
                  </Show>
                  <div class="sf-people-actions">
                    <button type="button" class="mx-btn sf-people-danger" disabled={local.pendingDelete}
                      onClick={() => { void confirmDelete() }}>{t(key("sf.u03.delete"))}</button>
                    <button type="button" class="mx-btn" disabled={local.pendingDelete}
                      onClick={() => setLocal("deleting", undefined)}>{t(sfCommonKey("sf.common.back"))}</button>
                  </div>
                </section>}
              </Show>
              <Show when={local.message}><p role="alert" class="sf-people-error">{local.message}</p></Show>
            </>
          )}
        </Show>
      </SfStatePanel>
      </div>
    </SfPageFrame>
  )
}
