import { For, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { useNavigate } from "@solidjs/router"
import { sfPeopleCollectionHref } from "../paths"
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
  { name: "leaderId", labelKey: key("sf.u47.leader"), input: "text", hintKey: key("sf.u47.leaderHint") },
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
    sourceLabels: { Grow: key("sf.u47.grow") },
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
 * A missing workbook preview/download binding cannot become a fake import or
 * an arbitrary fetch; both remain explicitly unavailable until 125 integrates
 * the source-bound bytes/preview contract.
 */
export function SfPeopleTalentView(props: SfSurfaceProps<"CAP08">): JSX.Element {
  const { t, locale } = useSfPresentation()
  const navigate = useNavigate()
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
    search: string
    selection: TalentSelection | undefined
    deleting: string | undefined
    pending: boolean
    message: string
  }>({
    filter: props.route.query.status || "Active",
    search: "",
    selection: undefined,
    deleting: undefined,
    pending: false,
    message: "",
  })
  const ready = () => session.ready()
  const data = () => ready()?.value.data
  const allowedStatuses = ["Active", "On Leave", "Terminated"]
  const filter = () => allowedStatuses.includes(local.filter) ? local.filter : "Active"
  const displayed = () => data()?.members.filter((person) => person.status === filter() &&
    (!local.search.trim() || [person.name, person.title, person.location].some((value) =>
      String(value ?? "").toLocaleLowerCase().includes(local.search.trim().toLocaleLowerCase())))) ?? []
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
    if (props.route.kind !== "entry") {
      const href = sfPeopleCollectionHref(props.route, filter())
      if (href) navigate(href)
    }
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
  const importView = () => props.route.kind === "import"
  const exportView = () => props.route.kind === "export"

  const fieldValue = (field: PeopleField, value: unknown) => {
    if (value === undefined || value === null || value === "") return t(key(
      field.name === "cls" || field.name === "outlook" ? "sf.u47.notReviewed" : "sf.u03.design.notRecorded"))
    const option = field.options?.find((entry) => entry.value === String(value))
    const sourceLabel = field.sourceLabels?.[String(value)]
    if (sourceLabel) return t(sourceLabel)
    if (field.input === "date" && typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)))
      return new Intl.DateTimeFormat(locale(), { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value + "T00:00:00Z"))
    return option?.labelKey ? t(option.labelKey) : String(value)
  }
  const statusLabel = (status: string) => t(key(status === "Active" ? "sf.u47.active" :
    status === "On Leave" ? "sf.u47.onLeave" : "sf.u47.terminated"))
  return (
    <SfPageFrame titleKey={key("sf.cap08.title")} context={[]}
      tabs={[]} activeTab={null}
      primaryAction={selectionId() && !showEditor() && !local.deleting && !importView() && !exportView() ? {
        id: "edit-talent-review", labelKey: key("sf.cap08.primary"),
        tone: "primary", disabled: !session.can("save"), busy: false,
        reasonKey: !session.can("save") ? sfCommonKey("sf.common.readOnly") : undefined,
        onInvoke: () => { const id = selectionId(); if (id) setLocal("selection", { id, edit: true }) },
      } : undefined}
      secondaryActions={[]} density="comfortable" layout="work" onLayoutMode={() => undefined}>
      <div class="sf-people-workspace" data-sf-wave="three" data-sf-surface="CAP08"
        data-sf-stage={importView() ? "import" : exportView() ? "export" : local.deleting ? "delete" : showEditor() ? "editor" : selected() ? "detail" : "collection"}>
      <SfStatePanel state={session.ui()} messageKey={stateMessage()} onRetryRead={() => { void session.reload() }}>
        <Show when={data()}>
          {(authorized) => (
            <>
              <div class="sf-people-collection" hidden={!!selected() || !!local.deleting || importView() || exportView()}>
                <p class="sf-people-lead">{t(key("sf.u47.design.collectionLead"))}</p>
                <section class="sf-people-section" aria-label={t(key("sf.cap08.title"))}>
                  <div class="sf-people-toolbar sf-people-talent-filters">
                    <label class="sf-people-search">{t(key("sf.u47.design.search"))}
                      <input type="search" value={local.search}
                        onInput={(event) => setLocal("search", event.currentTarget.value)} />
                    </label>
                    <div class="sf-people-filter">
                      <label for="sf-talent-status">{t(key("sf.u47.design.status"))}</label>
                      <select id="sf-talent-status" value={filter()}
                        onChange={(event) => setLocal("filter", event.currentTarget.value)}>
                        <For each={allowedStatuses}>{(status) => <option value={status}>{statusLabel(status)}</option>}</For>
                      </select>
                    </div>
                    <Show when={session.can("save")}>
                      <button type="button" class="mx-btn primary"
                        onClick={() => setLocal("selection", { newMember: true, edit: true })}>{t(key("sf.u47.addMember"))}</button>
                    </Show>
                  </div>
                  <Show when={!displayed().length}>
                    <SfStatePanel state={authorized().members.length ? "filtered-empty" : "empty"}
                      messageKey={authorized().members.length ? sfCommonKey("sf.common.filterEmpty") : sfCommonKey("sf.common.empty")} />
                  </Show>
                  <div class="sf-people-table-region" role="region" tabindex="0" aria-label={t(key("sf.cap08.title"))}>
                    <table class="sf-people-table">
                      <caption class="sf-people-sr-only">{t(key("sf.cap08.title"))}</caption>
                      <thead><tr>
                        <th scope="col">{t(key("sf.u47.name"))}</th>
                        <Show when={session.can("save")}>
                          <th scope="col">{t(key("sf.u47.classification"))}</th><th scope="col">{t(key("sf.u47.outlook"))}</th>
                        </Show>
                        <th scope="col">{t(key("sf.u47.status"))}</th><th scope="col">{t(key("sf.u47.design.actions"))}</th>
                      </tr></thead>
                      <tbody><For each={displayed()}>
                        {(person) => (
                          <tr data-sf-record={person.id}>
                            <th scope="row" data-label={t(key("sf.u47.name"))}>
                              <button type="button" class="sf-people-record-link"
                                onClick={() => setLocal("selection", { id: person.id, edit: false })}><bdi>{person.name ?? person.id}</bdi></button>
                              <Show when={person.title}><small class="sf-people-row-meta"><bdi>{person.title}</bdi></small></Show>
                            </th>
                            <Show when={session.can("save")}>
                              <td data-label={t(key("sf.u47.classification"))}>{fieldValue(talentFields.find((field) => field.name === "cls")!, person.cls)}</td>
                              <td data-label={t(key("sf.u47.outlook"))}>{fieldValue(talentFields.find((field) => field.name === "outlook")!, person.outlook)}</td>
                            </Show>
                            <td data-label={t(key("sf.u47.status"))}><span class="sf-people-status">{person.status ? statusLabel(person.status) : t(key("sf.u03.design.notRecorded"))}</span></td>
                            <td data-label={t(key("sf.u47.design.actions"))}><div class="sf-people-row-actions">
                              <Show when={session.can("save")}>
                                <button type="button" class="mx-btn"
                                  onClick={() => setLocal("selection", { id: person.id, edit: true })}>{t(key("sf.cap08.primary"))}</button>
                              </Show>
                              <Show when={session.can("delete")}>
                                <button type="button" class="mx-btn sf-people-danger"
                                  onClick={() => setLocal("deleting", person.id)}>{t(key("sf.u47.delete"))}</button>
                              </Show>
                            </div></td>
                          </tr>
                        )}
                      </For></tbody>
                    </table>
                  </div>
                </section>
                <details class="sf-people-workbook" data-sf-section="import-export">
                  <summary>{t(key("sf.u47.design.workbook"))}</summary>
                  <p>{t(key("sf.u47.design.workbookHint"))}</p>
                  <div class="sf-people-workbook-options">
                    <section><h3>{t(key("sf.u47.importRoute"))}</h3>
                      <p>{t(key("sf.u47.design.importUnavailable"))}</p>
                      <button type="button" class="mx-btn" disabled>{t(key("sf.u47.import"))}</button>
                    </section>
                    <section><h3>{t(key("sf.u47.exportRoute"))}</h3>
                      <p>{t(key("sf.u47.design.exportUnavailable"))}</p>
                      <button type="button" class="mx-btn" disabled>{t(key("sf.u47.export"))}</button>
                    </section>
                  </div>
                </details>
              </div>
              <Show when={selected() && !local.deleting && !importView() && !exportView()}>
                <div class="sf-people-stage-nav"><button type="button" class="mx-btn" onClick={dismiss}>{t(key("sf.u47.design.back"))}</button></div>
              </Show>
              <Show when={selectionId() && !showEditor() && !local.deleting && !importView() && !exportView()}>
                <section class="sf-people-section sf-people-detail" data-sf-selection="details">
                  <div class="sf-people-section-heading"><div>
                    <p class="sf-people-eyebrow">{t(key("sf.u47.design.member"))}</p>
                    <h2><bdi>{original()?.name || selectionId()}</bdi></h2>
                  </div></div>
                  <Show when={original()} fallback={<SfStatePanel state="not-found" messageKey={sfCommonKey("sf.common.removed")} />}>
                    {(record) => <dl>
                      <For each={talentFields.filter((field) => Object.hasOwn(record(), field.name) &&
                        (session.can("save") || !["cls", "outlook", "notes"].includes(field.name)))}>
                        {(field) => <div classList={{"sf-people-detail-wide": field.input === "textarea"}}>
                          <dt>{t(field.labelKey)}</dt><dd><bdi>{fieldValue(field, (record() as Record<string, unknown>)[field.name])}</bdi></dd>
                        </div>}
                      </For>
                    </dl>}
                  </Show>
                </section>
              </Show>
              <div hidden={!!local.deleting || importView() || exportView()}>
                <Show when={showEditor()}>
                  <section class="sf-people-editor-stage" data-sf-selection="editor">
                    <SfPeopleEditor surfaceId="CAP08" scopeKey={"people:talent:" + String(props.route.query.year ?? "current")}
                      entity="talent" recordRef={selectionId() ? ref(selectionId()!) : undefined}
                      version={selectionId() ? version(selectionId()!) : 0} original={original() ? toTalentValues(original()!) : null}
                      fields={talentFields} action={{ id: "save", operationId: "domain.command.CAP08.save", labelKey: key(selectionId() ? "sf.u47.design.saveReview" : "sf.u47.save") }}
                      admitted={session.can("save")} drafts={session.ready()!.drafts} onClose={dismiss}
                      onCommit={(values, expected, keyId, signal) => save(selectionId(), values, expected, keyId, signal)} />
                  </section>
                </Show>
              </div>
              <Show when={local.deleting}>
                {(id) => <section class="sf-people-deletion" role="alertdialog"
                  aria-labelledby="sf-talent-delete-title" aria-describedby="sf-talent-delete-hint" aria-modal="false">
                  <p class="sf-people-eyebrow">{t(key("sf.u47.design.member"))}</p>
                  <h2 id="sf-talent-delete-title">{t(key("sf.u47.delete"))}</h2>
                  <p id="sf-talent-delete-hint">{t(key("sf.u03.design.deleteHint"))}</p>
                  <p class="sf-people-delete-record"><bdi>{member(id())?.name ?? id()}</bdi></p>
                  <div class="sf-people-actions">
                    <button type="button" class="mx-btn sf-people-danger" disabled={local.pending}
                      onClick={() => { void confirmDelete() }}>{t(key("sf.u47.delete"))}</button>
                    <button type="button" class="mx-btn" disabled={local.pending}
                      onClick={() => setLocal("deleting", undefined)}>{t(sfCommonKey("sf.common.back"))}</button>
                  </div>
                </section>}
              </Show>
              <Show when={importView() || exportView()}>
                <div class="sf-people-stage-nav"><button type="button" class="mx-btn" onClick={dismiss}>{t(key("sf.u47.design.back"))}</button></div>
                <section class="sf-people-section sf-people-workbook-stage" data-sf-section={importView() ? "import" : "export"}>
                  <p class="sf-people-eyebrow">{t(key("sf.u47.design.workbook"))}</p>
                  <h2>{t(key(importView() ? "sf.u47.importTitle" : "sf.u47.export"))}</h2>
                  <p>{t(key(importView() ? "sf.u47.design.importUnavailable" : "sf.u47.design.exportUnavailable"))}</p>
                  <SfStatePanel state="unavailable" messageKey={key("sf.u47.design.workbookAvailability")} />
                  <button type="button" class="mx-btn" disabled>{t(key(importView() ? "sf.u47.import" : "sf.u47.export"))}</button>
                </section>
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
