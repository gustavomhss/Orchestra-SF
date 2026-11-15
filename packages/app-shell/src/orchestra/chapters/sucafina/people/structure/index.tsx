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
  return Object.fromEntries(fields.filter((item) => Object.hasOwn(source, item.name)).map((item) =>
    [item.name, typeof source[item.name] === "number" ? String(source[item.name]) :
      typeof source[item.name] === "string" ? source[item.name] : ""]))
}

export function SfPeopleStructureView(props: SfSurfaceProps<"CAP07">): JSX.Element {
  const { t } = useSfPresentation()
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
  }>({ selection: undefined, deleting: undefined, pendingDelete: false, message: "" })
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
    source()?.leaders.find((person) => person.id === String(leaderId ?? ""))?.name ??
      t(key("sf.u03.noLeader"))
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
      const updated = refreshed.data.members.find((person) => person.id === choice.id)
      return updated ? { kind: "projected", value: toValues(updated, memberFields(refreshed.data.leaders)),
        version: refreshed.versions["members:" + choice.id] ?? 0 } :
        { kind: "confirmed-without-projection" }
    }
    const updated = refreshed.data.leaders.find((person) => person.id === choice.id)
    return updated ? { kind: "projected", value: toValues(updated, leaderFields),
      version: refreshed.versions["leaders:" + choice.id] ?? 0 } :
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
  const stateMessage = () => session.ui() === "denied" ? sfCommonKey("sf.common.noAccess") :
    session.ui() === "session-expired" ? sfCommonKey("sf.common.loginAgain") :
    session.ui() === "unavailable" ? sfCommonKey("sf.common.unavailable") :
    session.ui() === "stale" ? sfCommonKey("sf.common.stale") :
    sfCommonKey("sf.common.loading")
  return (
    <SfPageFrame titleKey={key("sf.cap07.title")}
      context={current() ? [{ id: "installation", label: { key: key("sf.u03.installation") },
        value: { kind: "data", text: current()!.context.stamp.installationId } }] : []}
      tabs={[]} activeTab={null}
      primaryAction={{
        id: "add-member", labelKey: key("sf.cap07.primary"),
        tone: "primary", disabled: !session.can("saveMember"), busy: false,
        reasonKey: !session.can("saveMember") ? sfCommonKey("sf.common.readOnly") : undefined,
        onInvoke: () => setLocal("selection", { kind: "new-member", edit: true }),
      }}
      secondaryActions={[]} density="comfortable" layout="work"
      onLayoutMode={() => undefined}>
      <SfStatePanel state={session.ui()} messageKey={stateMessage()}
        onRetryRead={() => { void session.reload() }}>
        <Show when={source()}>
          {(data) => (
            <>
              <section class="sf-people-section" aria-label={t(key("sf.u03.cio"))}>
                <h2>{t(key("sf.u03.cio"))}</h2>
                <div class="sf-people-detail mx-card">
                  <dl>
                    <div><dt>{t(key("sf.u03.name"))}</dt><dd>{data().cio.name ?? "—"}</dd></div>
                    <div><dt>{t(key("sf.u03.title"))}</dt><dd>{data().cio.title ?? "—"}</dd></div>
                    <div><dt>{t(key("sf.u03.location"))}</dt><dd>{data().cio.location ?? "—"}</dd></div>
                    <div><dt>{t(key("sf.u03.start"))}</dt><dd>{data().cio.start ?? "—"}</dd></div>
                  </dl>
                  <Show when={session.can("saveCio")}>
                    <button type="button" class="mx-btn"
                      onClick={() => setLocal("selection", { kind: "cio", edit: true })}>
                      {t(key("sf.u03.editCio"))}
                    </button>
                  </Show>
                </div>
              </section>
              <section class="sf-people-section" aria-label={t(key("sf.u03.leaders"))}>
                <div class="sf-people-toolbar">
                  <h2>{t(key("sf.u03.leaders"))}</h2>
                  <Show when={session.can("saveLeader")}>
                    <button class="mx-btn" type="button"
                      onClick={() => setLocal("selection", { kind: "new-leader", edit: true })}>
                      {t(key("sf.u03.addLeader"))}
                    </button>
                  </Show>
                </div>
                <div class="sf-people-table-region" role="region" tabindex="0"
                  aria-label={t(key("sf.u03.leaders"))}>
                  <table class="sf-people-table">
                    <thead><tr>
                      <th scope="col">{t(key("sf.u03.leader"))}</th>
                      <th scope="col">{t(key("sf.u03.domain"))}</th>
                      <th scope="col">{t(key("sf.u03.members"))}</th>
                      <th scope="col">{t(key("sf.u03.edit"))}</th>
                    </tr></thead>
                    <tbody><For each={data().leaders}>
                      {(person) => (
                        <tr aria-selected={selected()?.kind === "leader" && selectedId() === person.id}>
                          <th scope="row"><button type="button" class="mx-btn"
                            onClick={() => setLocal("selection", { kind: "leader", id: person.id, edit: false })}>
                            {person.name ?? person.id}
                          </button></th>
                          <td>{person.domain ?? "—"}</td>
                          <td>{data().members.filter((row) => String(row.leaderId ?? "") === person.id)
                            .map((row) => row.name ?? row.id).join(", ") || "—"}</td>
                          <td>
                            <Show when={session.can("saveLeader")}>
                              <button type="button" class="mx-btn"
                                onClick={() => setLocal("selection", { kind: "leader", id: person.id, edit: true })}>
                                {t(key("sf.u03.edit"))}
                              </button>
                            </Show>
                            <Show when={session.can("deleteLeader")}>
                              <button type="button" class="mx-btn"
                                onClick={() => chooseDelete("leader", person.id)}>
                                {t(key("sf.u03.deleteLeader"))}
                              </button>
                            </Show>
                          </td>
                        </tr>
                      )}
                    </For></tbody>
                  </table>
                </div>
              </section>
              <section class="sf-people-section" aria-label={t(key("sf.u03.members"))}>
                <h2>{t(key("sf.u03.members"))}</h2>
                <div class="sf-people-table-region" role="region" tabindex="0"
                  aria-label={t(key("sf.u03.members"))}>
                  <table class="sf-people-table">
                    <thead><tr>
                      <th scope="col">{t(key("sf.u03.name"))}</th>
                      <th scope="col">{t(key("sf.u03.leader"))}</th>
                      <th scope="col">{t(key("sf.u03.status"))}</th>
                      <th scope="col">{t(key("sf.u03.edit"))}</th>
                    </tr></thead>
                    <tbody><For each={data().members}>
                      {(person) => (
                        <tr aria-selected={selected()?.kind === "member" && selectedId() === person.id}>
                          <th scope="row"><button type="button" class="mx-btn"
                            onClick={() => setLocal("selection", { kind: "member", id: person.id, edit: false })}>
                            {person.name ?? person.id}
                          </button></th>
                          <td>{nameForLeader(person.leaderId)}</td>
                          <td>{person.status ?? "—"}</td>
                          <td>
                            <Show when={session.can("saveMember")}>
                              <button type="button" class="mx-btn"
                                onClick={() => setLocal("selection", { kind: "member", id: person.id, edit: true })}>
                                {t(key("sf.u03.edit"))}
                              </button>
                            </Show>
                            <Show when={session.can("deleteMember")}>
                              <button type="button" class="mx-btn"
                                onClick={() => chooseDelete("member", person.id)}>
                                {t(key("sf.u03.deleteMember"))}
                              </button>
                            </Show>
                          </td>
                        </tr>
                      )}
                    </For></tbody>
                  </table>
                </div>
              </section>
              <Show when={selected() && !selected()!.edit}>
                <section class="sf-people-section sf-people-detail" data-sf-selection="details">
                  <h2>{t(key("sf.u03.details"))}</h2>
                  <Show when={selected()?.kind === "leader" ? leader((selected() as Extract<Selection,{kind:"leader"}>).id) :
                    selected()?.kind === "member" ? member((selected() as Extract<Selection,{kind:"member"}>).id) : undefined}
                    fallback={<SfStatePanel state="not-found" messageKey={sfCommonKey("sf.common.removed")} />}>
                    {(row) => <dl>
                      <For each={Object.entries(row()).filter(([field]) =>
                        !["id", "cls", "outlook", "notes"].includes(field))}>
                        {([field, value]) => <div><dt>{t(fieldCopy[field] ?? key("sf.u03.details"))}</dt><dd>{String(value ?? "")}</dd></div>}
                      </For>
                    </dl>}
                  </Show>
                </section>
              </Show>
              <Show when={activeEditor()}>
                {(editor) => <section class="sf-people-section" data-sf-selection="editor">
                  <SfPeopleEditor surfaceId="CAP07"
                    scopeKey={"people:structure:" + String(props.route.query.year ?? "current")}
                    entity={editor().entity}
                    recordRef={editor().recordRef}
                    version={editor().version}
                    original={editor().original}
                    fields={editor().fields} action={editor().action}
                    admitted={session.can(editor().action.id)}
                    drafts={session.ready()!.drafts}
                    onClose={close}
                    onCommit={(values, expected, keyId, signal) =>
                      saveRecord(editor().choice, values, expected, keyId, signal)}
                  />
                </section>}
              </Show>
              <Show when={local.deleting}>
                {(intent) => <section class="sf-people-deletion" role="alertdialog"
                  aria-labelledby="sf-people-delete-title" aria-modal="false">
                  <h2 id="sf-people-delete-title">
                    {t(key(intent().kind === "leader" ? "sf.u03.deleteLeader" : "sf.u03.deleteMember"))}
                  </h2>
                  <p>{intent().kind === "leader" ? leader(intent().id)?.name : member(intent().id)?.name}</p>
                  <Show when={intent().kind === "leader"}>
                    <p>{t(key("sf.u03.affectedMembers"))}: {data().members.filter(
                      (person) => String(person.leaderId ?? "") === intent().id).length}</p>
                  </Show>
                  <button type="button" class="mx-btn" disabled={local.pendingDelete}
                    onClick={() => { void confirmDelete() }}>
                    {t(key("sf.u03.delete"))}
                  </button>
                  <button type="button" class="mx-btn" disabled={local.pendingDelete}
                    onClick={() => setLocal("deleting", undefined)}>
                    {t(sfCommonKey("sf.common.back"))}
                  </button>
                </section>}
              </Show>
              <Show when={local.message}><p role="alert" class="sf-people-error">{local.message}</p></Show>
            </>
          )}
        </Show>
      </SfStatePanel>
    </SfPageFrame>
  )
}
