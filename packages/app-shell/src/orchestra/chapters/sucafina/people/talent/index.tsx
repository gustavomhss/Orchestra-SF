import { createEffect, For, onCleanup, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { useNavigate } from "@solidjs/router"
import { usePlatform } from "@/context/platform"
import { SfPeople } from "@orchestra/schema/sucafina/people"
import { createSfPeopleClient } from "@orchestra/client/sucafina/people"
import type { SfRef } from "@orchestra/schema/sucafina/context"
import type { SfSurfaceProps } from "../../context/contracts"
import { SfPageFrame } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import { sfCommonKey, useSfPresentation } from "../../shared/frame/presentation"
import type { SfCopyKey } from "../../shared/frame"
import { createPeopleSession } from "../structure/session"
import {
  SfPeopleEditor, type PeopleField, type PeopleFormValues, type PeopleSaveOutcome,
} from "../structure/editor"
import { downloadTalentMembers } from "./download"
import "../structure/people.css"

type TalentResponse = typeof SfPeople.operations["domain.page.CAP08"]["output"]["Type"]
type TalentData = Extract<TalentResponse, { status: "ok" }>["value"]["data"]
type TalentSelection = Readonly<{ id: string; edit: boolean }> | Readonly<{ newMember: true; edit: true }>
const key = (value: string) => value as SfCopyKey
const ref = (value: string) => value as SfRef

// Literal values and field names come from dashboard-people.ts / memberForm.
// CAP08 is the only place where admin-authorized cls/outlook/notes are edited.
const talentFields: readonly PeopleField[] = [
  { name: "name", labelKey: key("sf.u47.name"), input: "text", required: true },
  { name: "title", labelKey: key("sf.u47.title"), input: "text" },
  { name: "type", labelKey: key("sf.u47.type"), input: "select", required: true,
    options: [
      { value: "Employee", labelKey: key("sf.u47.employee") },
      { value: "Contractor", labelKey: key("sf.u47.contractor") },
    ] },
  // CAP08 projection currently lacks the source leaders catalogue. Retain the
  // exact opaque leader ID as a field; never invent a leader name/membership.
  { name: "leaderId", labelKey: key("sf.u47.leader"), input: "text" },
  { name: "location", labelKey: key("sf.u47.location"), input: "text" },
  { name: "start", labelKey: key("sf.u47.start"), input: "date" },
  { name: "end", labelKey: key("sf.u47.end"), input: "date" },
  { name: "status", labelKey: key("sf.u47.status"), input: "select", required: true,
    options: [
      { value: "Active", labelKey: key("sf.u47.active") },
      { value: "On Leave", labelKey: key("sf.u47.onLeave") },
      { value: "Terminated", labelKey: key("sf.u47.terminated") },
    ] },
  { name: "cls", labelKey: key("sf.u47.classification"), input: "select",
    options: [
      { value: "", labelKey: key("sf.u47.notReviewed") },
      { value: "Talent", labelKey: key("sf.u47.talent") },
      { value: "Solid Contributor", labelKey: key("sf.u47.solidContributor") },
      { value: "Lagger", labelKey: key("sf.u47.lagger") },
    ] },
  { name: "outlook", labelKey: key("sf.u47.outlook"), input: "select",
    options: [
      { value: "", labelKey: key("sf.u47.notReviewed") },
      { value: "Promote", labelKey: key("sf.u47.promote") },
      { value: "Stay", labelKey: key("sf.u47.stay") },
      { value: "Replace", labelKey: key("sf.u47.replace") },
      { value: "Termination", labelKey: key("sf.u47.termination") },
    ] },
  { name: "notes", labelKey: key("sf.u47.notes"), input: "textarea" },
]

function toTalentValues(person: object): PeopleFormValues {
  const fields = person as Readonly<Record<string, unknown>>
  return Object.fromEntries(talentFields.filter((field) => Object.hasOwn(fields, field.name))
    .map((field) => [field.name, String(fields[field.name] ?? "")]))
}

/**
 * U47 / CAP08 Talent Review. Read-only actors see only the server-projected
 * member fields. Actions are independently fenced by F01 context and A10.
 * Workbook controls require their original files operations and current owner.
 * Imports navigate to the source-bound UI55 preview/apply flow; exports use
 * the original members byte producer without serializing the page projection.
 */
export function SfPeopleTalentView(props: SfSurfaceProps<"CAP08">): JSX.Element {
  const { t } = useSfPresentation()
  const navigate = useNavigate()
  const platform = usePlatform()
  const session = createPeopleSession<TalentData>("CAP08", () => props.route.href,
    (transport, signal) => {
      const status = props.route.query.status
      const memberStatus = status === "" || status === "Active" || status === "On Leave" || status === "Terminated"
        ? status : undefined
      return createSfPeopleClient(transport)["domain.page.CAP08"]({
        ...(props.route.query.year === undefined ? {} : { year: props.route.query.year }),
        ...(props.route.query.month === undefined ? {} : { month: props.route.query.month }),
        ...(memberStatus === undefined ? {} : { memberStatus }),
      }, { signal })
    })
  const [local, setLocal] = createStore<{
    filter: string
    selection: TalentSelection | undefined
    deleting: string | undefined
    pending: boolean
    exporting: boolean
    message: string
  }>({
    filter: props.route.query.status || "Active",
    selection: undefined,
    deleting: undefined,
    pending: false,
    exporting: false,
    message: "",
  })
  const ready = () => session.ready()
  const data = () => ready()?.value.data
  const allowedStatuses = ["Active", "On Leave", "Terminated"]
  const filter = () => allowedStatuses.includes(local.filter) ? local.filter : "Active"
  const displayed = () => data()?.members.filter((person) => person.status === filter()) ?? []
  const routeSelection = (): TalentSelection | undefined => {
    const route = props.route
    if (route.kind === "member") return { id: route.params.personRef, edit: false }
    if (route.kind === "edit") return { id: route.params.personRef, edit: true }
    return undefined
  }
  const selected = () => local.selection ?? routeSelection()
  const selectionId = () => selected() && "id" in selected()! ? (selected() as { id: string }).id : undefined
  const member = (id: string) => data()?.members.find((person) => person.id === id)
  const version = (id: string) => ready()?.value.versions["members:" + id] ?? 0
  const dismiss = () => {
    setLocal("selection", undefined)
    if (props.route.kind !== "entry") navigate(-1)
  }
  async function save(
    id: string | undefined, values: PeopleFormValues, expectedVersion: number,
    idempotencyKey: string, signal: AbortSignal,
  ): Promise<PeopleSaveOutcome> {
    const active = ready()
    if (!active || !session.can("save")) return { kind: "denied" }
    const result = await createSfPeopleClient(active.transport)["domain.command.CAP08.save"]({
      ...(id === undefined ? {} : { id }),
      version: expectedVersion, values,
    }, { signal, idempotencyKey })
    if (result.kind === "transport-error") return { kind: "outcome-unknown" }
    if (!result.body.ok) {
      if (result.status === 409) return { kind: "conflict" }
      if (result.status === 403) return { kind: "denied" }
      if (result.status === 400 || result.status === 422)
        return { kind: "invalid", message: result.body.errors?.join("; ") ??
          t(sfCommonKey("sf.common.fieldErrorSummary")) }
      return { kind: "unavailable" }
    }
    const refreshed = await session.reload()
    if (!refreshed || id === undefined) return { kind: "confirmed-without-projection" }
    const record = refreshed.data.members.find((person) => person.id === id)
    return record ? { kind: "projected",
      value: toTalentValues(record), version: refreshed.versions["members:" + id] ?? 0 } :
      { kind: "confirmed-without-projection" }
  }

  const confirmDelete = async () => {
    const id = local.deleting
    const active = ready()
    if (!id || !active || local.pending || !session.can("delete")) return
    setLocal("pending", true)
    const controller = new AbortController()
    try {
      const result = await createSfPeopleClient(active.transport)["domain.command.CAP08.delete"]({
        id, version: version(id), values: {},
      }, { signal: controller.signal, idempotencyKey: crypto.randomUUID() })
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
      setLocal({ deleting: undefined, selection: undefined })
    } finally {
      setLocal("pending", false)
    }
  }
  const stateMessage = () => session.ui() === "denied" ? sfCommonKey("sf.common.noAccess") :
    session.ui() === "session-expired" ? sfCommonKey("sf.common.loginAgain") :
    session.ui() === "unavailable" ? sfCommonKey("sf.common.unavailable") :
    session.ui() === "stale" ? sfCommonKey("sf.common.stale") :
    sfCommonKey("sf.common.loading")
  const showEditor = () => session.can("save") && !!selected()?.edit
  const original = () => {
    const id = selectionId()
    return id ? member(id) : undefined
  }
  const workbookAllowed = (action: "import" | "exportAllMembers", operations: readonly string[]) => {
    const active = ready()
    if (!active || !active.value.allowedActionIds.includes(action) ||
        !active.context.destinations.some((destination) => destination.capabilityId === "CAP08" &&
          destination.surface === "dashboard" && destination.canRead &&
          destination.allowedActionIds.includes(action))) return false
    return operations.every((operationId) => active.context.availability.some((resource) =>
      resource.family === "files" && resource.operations.some((operation) =>
        operation.operationId === operationId && operation.state === "ready" && operation.operational)))
  }
  const canImport = () => workbookAllowed("import", [
    "files.import-targets", "files.import-admit", "files.import-preview",
    "files.import-reference", "files.import-detail", "files.import-apply",
  ])
  const canExport = () => workbookAllowed("exportAllMembers", ["files.export.members"])
  const workbookScope = () => {
    const active = ready()
    return active ? JSON.stringify([active.ownerKey, session.context.generation(),
      active.context.stamp, props.route.href]) : undefined
  }
  let exportAbort: AbortController | undefined
  createEffect(() => {
    workbookScope()
    exportAbort?.abort()
    exportAbort = undefined
    setLocal("exporting", false)
  })
  onCleanup(() => exportAbort?.abort())
  const beginExport = async () => {
    const active = ready()
    const scope = workbookScope()
    if (!active || !scope || !canExport() || local.exporting || local.pending) return
    const controller = new AbortController()
    exportAbort?.abort()
    exportAbort = controller
    setLocal({ exporting: true, message: "" })
    const current = () => !controller.signal.aborted && workbookScope() === scope && canExport()
    try {
      await downloadTalentMembers({
        transport: active.transport, signal: controller.signal, current,
        ...(platform.downloadResponse ? { downloadResponse: platform.downloadResponse } : {}),
      })
    } catch (error) {
      if (!current()) return
      console.error("Sucafina members export failed", error instanceof Error ? error.name : "unknown")
      setLocal("message", t(sfCommonKey("sf.common.unavailable")))
    } finally {
      if (exportAbort === controller) {
        exportAbort = undefined
        setLocal("exporting", false)
      }
    }
  }
  const importView = () => props.route.kind === "import"
  const exportView = () => props.route.kind === "export"

  return (
    <SfPageFrame
      titleKey={key("sf.cap08.title")}
      context={ready() ? [{ id: "installation", label: { key: key("sf.u47.installation") },
        value: { kind: "data", text: ready()!.context.stamp.installationId } }] : []}
      tabs={[]} activeTab={null}
      primaryAction={{
        id: "edit-talent-review", labelKey: key("sf.cap08.primary"),
        tone: "primary", disabled: !session.can("save") || !selectionId(), busy: false,
        reasonKey: !session.can("save") ? sfCommonKey("sf.common.readOnly") : undefined,
        onInvoke: () => {
          const id = selectionId()
          if (id) setLocal("selection", { id, edit: true })
        },
      }}
      secondaryActions={[]} density="comfortable" layout="work"
      onLayoutMode={() => undefined}
    >
      <SfStatePanel state={session.ui()} messageKey={stateMessage()}
        onRetryRead={() => { void session.reload() }}>
        <Show when={data()}>
          {(authorized) => (
            <>
              <section class="sf-people-section">
                <div class="sf-people-toolbar">
                  <label for="sf-talent-status">{t(key("sf.u47.statusFilter"))}</label>
                  <select id="sf-talent-status" value={filter()}
                    onChange={(event) => setLocal("filter", event.currentTarget.value)}>
                    <For each={allowedStatuses}>
                      {(status) => <option value={status}>{status}</option>}
                    </For>
                  </select>
                  <Show when={session.can("save")}>
                    <button type="button" class="mx-btn"
                      onClick={() => setLocal("selection", { newMember: true, edit: true })}>
                      {t(key("sf.u47.addMember"))}
                    </button>
                  </Show>
                </div>
                <Show when={!displayed().length}>
                  <SfStatePanel
                    state={authorized().members.length ? "filtered-empty" : "empty"}
                    messageKey={authorized().members.length ?
                      sfCommonKey("sf.common.filterEmpty") : sfCommonKey("sf.common.empty")}
                  />
                </Show>
                <div class="sf-people-table-region" role="region" tabindex="0"
                  aria-label={t(key("sf.cap08.title"))}>
                  <table class="sf-people-table">
                    <caption>{t(key("sf.cap08.title"))}</caption>
                    <thead><tr>
                      <th scope="col">{t(key("sf.u47.name"))}</th>
                      <Show when={session.can("save")}>
                        <th scope="col">{t(key("sf.u47.classification"))}</th>
                        <th scope="col">{t(key("sf.u47.outlook"))}</th>
                      </Show>
                      <th scope="col">{t(key("sf.u47.status"))}</th>
                      <th scope="col">{t(key("sf.u47.save"))}</th>
                    </tr></thead>
                    <tbody><For each={displayed()}>
                      {(person) => (
                        <tr aria-selected={selectionId() === person.id}>
                          <th scope="row"><button type="button" class="mx-btn"
                            onClick={() => setLocal("selection", { id: person.id, edit: false })}>
                            {person.name ?? person.id}
                          </button></th>
                          <Show when={session.can("save")}>
                            <td>{person.cls || t(key("sf.u47.notReviewed"))}</td>
                            <td>{person.outlook || t(key("sf.u47.notReviewed"))}</td>
                          </Show>
                          <td>{person.status ?? "—"}</td>
                          <td>
                            <Show when={session.can("save")}>
                              <button type="button" class="mx-btn"
                                onClick={() => setLocal("selection", { id: person.id, edit: true })}>
                                {t(key("sf.cap08.primary"))}
                              </button>
                            </Show>
                            <Show when={session.can("delete")}>
                              <button type="button" class="mx-btn"
                                onClick={() => setLocal("deleting", person.id)}>
                                {t(key("sf.u47.delete"))}
                              </button>
                            </Show>
                          </td>
                        </tr>
                      )}
                    </For></tbody>
                  </table>
                </div>
              </section>
              <Show when={selectionId() && !showEditor()}>
                <section class="sf-people-section sf-people-detail" data-sf-selection="details">
                  <h2>{t(key("sf.u47.name"))}</h2>
                  <Show when={original()} fallback={
                    <SfStatePanel state="not-found" messageKey={sfCommonKey("sf.common.removed")} />
                  }>
                    {(record) => <dl>
                      <For each={talentFields.filter((field) =>
                        Object.hasOwn(record(), field.name) &&
                        (session.can("save") || !["cls", "outlook", "notes"].includes(field.name)))}>
                        {(field) => <div>
                          <dt>{t(field.labelKey)}</dt>
                          <dd>{String((record() as Record<string, unknown>)[field.name] ?? "")}</dd>
                        </div>}
                      </For>
                    </dl>}
                  </Show>
                </section>
              </Show>
              <Show when={showEditor()}>
                <section class="sf-people-section" data-sf-selection="editor">
                  <SfPeopleEditor
                    surfaceId="CAP08"
                    scopeKey={"people:talent:" + String(props.route.query.year ?? "current")}
                    entity="talent"
                    recordRef={selectionId() ? ref(selectionId()!) : undefined}
                    version={selectionId() ? version(selectionId()!) : 0}
                    original={original() ? toTalentValues(original()!) : null}
                    fields={talentFields}
                    action={{ id: "save", operationId: "domain.command.CAP08.save",
                      labelKey: key("sf.u47.save") }}
                    admitted={session.can("save")}
                    drafts={session.ready()!.drafts}
                    onClose={dismiss}
                    onCommit={(values, expected, keyId, signal) =>
                      save(selectionId(), values, expected, keyId, signal)}
                  />
                </section>
              </Show>
              <Show when={local.deleting}>
                {(id) => <section class="sf-people-deletion" role="alertdialog"
                  aria-labelledby="sf-talent-delete-title" aria-modal="false">
                  <h2 id="sf-talent-delete-title">{t(key("sf.u47.delete"))}</h2>
                  <p>{member(id())?.name ?? id()}</p>
                  <button type="button" class="mx-btn" disabled={local.pending}
                    onClick={() => { void confirmDelete() }}>
                    {t(key("sf.u47.delete"))}
                  </button>
                  <button type="button" class="mx-btn" disabled={local.pending}
                    onClick={() => setLocal("deleting", undefined)}>
                    {t(sfCommonKey("sf.common.back"))}
                  </button>
                </section>}
              </Show>
              <section class="sf-people-section" data-sf-section="import-export">
                <h2>{t(key("sf.u47.importTitle"))}</h2>
                <div class="sf-people-toolbar">
                  <button type="button" class="mx-btn" data-sf-talent-workbook="import"
                    disabled={!canImport() || local.pending || local.exporting}
                    title={!canImport() ? t(sfCommonKey("sf.common.unavailable")) : undefined}
                    onClick={() => { if (canImport()) navigate("/orchestra/sf-imports/new") }}>
                    {t(key("sf.u47.import"))}
                  </button>
                  <button type="button" class="mx-btn" data-sf-talent-workbook="export"
                    disabled={!canExport() || local.pending || local.exporting}
                    title={!canExport() ? t(sfCommonKey("sf.common.unavailable")) : undefined}
                    aria-busy={local.exporting}
                    onClick={() => { void beginExport() }}>
                    {t(key("sf.u47.export"))}
                  </button>
                </div>
                <Show when={importView() && !canImport() || exportView() && !canExport()}>
                  <SfStatePanel state="unavailable" messageKey={sfCommonKey("sf.common.unavailable")} />
                </Show>
              </section>
              <Show when={local.message}><p role="alert" class="sf-people-error">{local.message}</p></Show>
            </>
          )}
        </Show>
      </SfStatePanel>
    </SfPageFrame>
  )
}
