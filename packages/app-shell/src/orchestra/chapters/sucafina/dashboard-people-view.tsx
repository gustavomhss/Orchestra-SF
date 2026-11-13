import { For, Match, Show, Switch } from "solid-js"
import type { Sucafina } from "@orchestra/schema/sucafina"
import { useLanguage } from "@/context/language"
import { MxBadge } from "../kit"
import type { NativeViewProps } from "./view-contract"

type Row = Record<string, unknown>
type Collection = { available: true; rows: Row[] } | { available: false }
type TableRow = { key: string; cells: string[] }

const peoplePages = ["Headcount Overview", "Team Structure", "Talent Review"] as const
const memberStatuses = ["", "Active", "On Leave", "Terminated"] as const
const headcountYears = ["2024", "2025", "2026", "2027"] as const

export function DashboardPeopleView(props: NativeViewProps) {
  const valid = () =>
    props.page.surface === "dashboard" &&
    peoplePages.includes(props.page.page as (typeof peoplePages)[number]) &&
    props.page.pages.includes(props.page.page)

  return (
    <Show when={valid()} fallback={null}>
      <Switch fallback={<TalentReviewView props={props} />}>
        <Match when={props.page.page === "Headcount Overview"}><HeadcountView props={props} /></Match>
        <Match when={props.page.page === "Team Structure"}><TeamStructureView props={props} /></Match>
      </Switch>
    </Show>
  )
}

function HeadcountView(props: { props: NativeViewProps }) {
  const language = useLanguage()
  const memberProjection = () => collection(props.props.page.data.members)
  const leaderProjection = () => collection(props.props.page.data.leaders)
  const year = () =>
    headcountYears.includes(props.props.query.year as (typeof headcountYears)[number])
      ? props.props.query.year!
      : String(props.props.page.year)
  const memberRows = (): TableRow[] => {
    const members = memberProjection()
    const leaders = leaderProjection()
    if (!members.available) return []
    return members.rows.map((member, index) => {
      const leader = findLeader(member.leaderId, leaders)
      return {
        key: string(member.id) || `${string(member.name)}-${index}`,
        cells: [
          display(member.name),
          leaderLabel(member.leaderId, leaders, language.t("sucafina.native.dashboard-people.leaderUnassigned"), language.t("sucafina.native.dashboard-people.leaderDataUnavailable")),
          leaders.available ? display(leader?.domain) : language.t("sucafina.native.dashboard-people.leaderDataUnavailable"),
          display(member.location),
          display(member.type),
          display(member.status),
        ],
      }
    })
  }

  return (
    <>
      <div class="mx-card">
        <div class="mx-fields">
          <label class="mx-field">
            <span>{language.t("sucafina.native.dashboard-people.year")}</span>
            <select
              value={year()}
              onChange={(event) => props.props.onQuery({ ...props.props.query, year: event.currentTarget.value })}
            >
              <For each={headcountYears}>{(item) => <option value={item}>{item}</option>}</For>
            </select>
          </label>
        </div>
        <div class="mx-meta">
          <MxBadge>{language.t("sucafina.native.dashboard-people.projectionLimited")}</MxBadge>
          <span>{language.t("sucafina.native.dashboard-people.measuresUnavailable")}</span>
        </div>
      </div>
      <Show when={memberProjection().available} fallback={<UnavailableProjection message={language.t("sucafina.native.dashboard-people.memberRecordsUnavailable")} />}>
        <ReadTable
          label={language.t("sucafina.native.dashboard-people.headcountPeople")}
          columns={[
            language.t("sucafina.native.dashboard-people.name"),
            language.t("sucafina.native.dashboard-people.leader"),
            language.t("sucafina.native.dashboard-people.domain"),
            language.t("sucafina.native.dashboard-people.location"),
            language.t("sucafina.native.dashboard-people.type"),
            language.t("sucafina.native.dashboard-people.status"),
          ]}
          rows={memberRows()}
          empty={language.t("sucafina.native.dashboard-people.noMemberRecords")}
        />
      </Show>
    </>
  )
}

function TeamStructureView(props: { props: NativeViewProps }) {
  const language = useLanguage()
  const memberProjection = () => collection(props.props.page.data.members)
  const leaderProjection = () => collection(props.props.page.data.leaders)
  const cioProjection = () => objectProjection(props.props.page.data.cio)
  const leaderRows = (): TableRow[] => {
    const leaders = leaderProjection()
    const members = memberProjection()
    if (!leaders.available) return []
    return leaders.rows.map((leader, index) => {
      const leaderId = identifier(leader.id)
      const childNames = members.available && leaderId !== undefined
        ? members.rows
            .filter((member) => identifier(member.leaderId) === leaderId && identifier(member.leaderId) !== undefined)
            .map((member) => display(member.name))
            .join(", ")
        : ""
      return {
        key: string(leader.id) || `${string(leader.name)}-${index}`,
        cells: [
          display(leader.name),
          display(leader.title),
          display(leader.domain),
          display(leader.location),
          display(leader.start),
          members.available ? childNames || "—" : language.t("sucafina.native.dashboard-people.memberDataUnavailable"),
        ],
      }
    })
  }
  const memberRows = (): TableRow[] => {
    const members = memberProjection()
    const leaders = leaderProjection()
    if (!members.available) return []
    return members.rows.map((member, index) => ({
      key: string(member.id) || `${string(member.name)}-${index}`,
      cells: [
        display(member.name),
        leaderLabel(member.leaderId, leaders, language.t("sucafina.native.dashboard-people.leaderUnassigned"), language.t("sucafina.native.dashboard-people.leaderDataUnavailable")),
        display(member.title),
        display(member.type),
        display(member.location),
        display(member.start),
        display(member.end),
        display(member.status),
      ],
    }))
  }

  return (
    <>
      <Show when={cioProjection()} fallback={<UnavailableProjection message={language.t("sucafina.native.dashboard-people.cioPositionUnavailable")} />}>
        {(cio) => (
          <section class="mx-card" aria-labelledby="people-cio-title">
            <div class="mx-card-top"><h2 id="people-cio-title">{language.t("sucafina.native.dashboard-people.cioPosition")}</h2></div>
            <dl class="mx-fields">
              <Value label={language.t("sucafina.native.dashboard-people.name")} value={cio().name} />
              <Value label={language.t("sucafina.native.dashboard-people.title")} value={cio().title} />
              <Value label={language.t("sucafina.native.dashboard-people.location")} value={cio().location} />
              <Value label={language.t("sucafina.native.dashboard-people.start")} value={cio().start} />
            </dl>
          </section>
        )}
      </Show>
      <Show when={leaderProjection().available} fallback={<UnavailableProjection message={language.t("sucafina.native.dashboard-people.teamLeadersUnavailable")} />}>
        <ReadTable
          label={language.t("sucafina.native.dashboard-people.teamLeaders")}
          columns={[
            language.t("sucafina.native.dashboard-people.leader"),
            language.t("sucafina.native.dashboard-people.title"),
            language.t("sucafina.native.dashboard-people.domain"),
            language.t("sucafina.native.dashboard-people.location"),
            language.t("sucafina.native.dashboard-people.start"),
            language.t("sucafina.native.dashboard-people.members"),
          ]}
          rows={leaderRows()}
          empty={language.t("sucafina.native.dashboard-people.noLeaders")}
        />
      </Show>
      <Show when={memberProjection().available} fallback={<UnavailableProjection message={language.t("sucafina.native.dashboard-people.teamMembersUnavailable")} />}>
        <ReadTable
          label={language.t("sucafina.native.dashboard-people.teamMembers")}
          columns={[
            language.t("sucafina.native.dashboard-people.name"),
            language.t("sucafina.native.dashboard-people.leader"),
            language.t("sucafina.native.dashboard-people.title"),
            language.t("sucafina.native.dashboard-people.type"),
            language.t("sucafina.native.dashboard-people.location"),
            language.t("sucafina.native.dashboard-people.startDate"),
            language.t("sucafina.native.dashboard-people.endDate"),
            language.t("sucafina.native.dashboard-people.status"),
          ]}
          rows={memberRows()}
          empty={language.t("sucafina.native.dashboard-people.noMemberRecords")}
        />
      </Show>
    </>
  )
}

function TalentReviewView(props: { props: NativeViewProps }) {
  const language = useLanguage()
  const memberProjection = () => collection(props.props.page.data.members)
  const leaderProjection = () => collection(props.props.page.data.leaders)
  const members = () => {
    const projection = memberProjection()
    return projection.available ? projection.rows : []
  }
  const selectedStatus = () =>
    memberStatuses.includes(props.props.query.memberStatus as (typeof memberStatuses)[number])
      ? props.props.query.memberStatus ?? ""
      : ""
  const statusFilteredMembers = () => members().filter((member) => string(member.status) === (selectedStatus() || "Active"))
  const privateColumn = (field: "cls" | "outlook" | "notes") =>
    members().some((member) => Object.prototype.hasOwnProperty.call(member, field))
  const statusLabel = (status: (typeof memberStatuses)[number]) => {
    if (status === "") return language.t("sucafina.native.dashboard-people.activeDefault")
    if (status === "Active") return language.t("sucafina.native.dashboard-people.active")
    if (status === "On Leave") return language.t("sucafina.native.dashboard-people.onLeave")
    return language.t("sucafina.native.dashboard-people.terminated")
  }
  const talentColumns = () => [
    language.t("sucafina.native.dashboard-people.name"),
    language.t("sucafina.native.dashboard-people.title"),
    language.t("sucafina.native.dashboard-people.type"),
    language.t("sucafina.native.dashboard-people.reportsTo"),
    language.t("sucafina.native.dashboard-people.location"),
    language.t("sucafina.native.dashboard-people.status"),
    ...(privateColumn("cls") ? [language.t("sucafina.native.dashboard-people.classification")] : []),
    ...(privateColumn("outlook") ? [language.t("sucafina.native.dashboard-people.outlook")] : []),
    ...(privateColumn("notes") ? [language.t("sucafina.native.dashboard-people.notes")] : []),
  ]
  const talentRows = (): TableRow[] =>
    statusFilteredMembers().map((member, index) => {
      const leaders = leaderProjection()
      return {
        key: string(member.id) || `${string(member.name)}-${index}`,
        cells: [
          display(member.name),
          display(member.title),
          display(member.type),
          leaderLabel(member.leaderId, leaders, "—", language.t("sucafina.native.dashboard-people.leaderDataUnavailable")),
          display(member.location),
          display(member.status),
          ...(privateColumn("cls") ? [display(member.cls)] : []),
          ...(privateColumn("outlook") ? [display(member.outlook)] : []),
          ...(privateColumn("notes") ? [display(member.notes)] : []),
        ],
      }
    })

  return (
    <>
      <div class="mx-card">
        <div class="mx-fields">
          <label class="mx-field">
            <span>{language.t("sucafina.native.dashboard-people.status")}</span>
            <select
              value={selectedStatus()}
              onChange={(event) => props.props.onQuery({ ...props.props.query, memberStatus: event.currentTarget.value })}
            >
              <For each={memberStatuses}>{(status) => <option value={status}>{statusLabel(status)}</option>}</For>
            </select>
          </label>
        </div>
      </div>
      <Show when={!leaderProjection().available}>
        <UnavailableProjection message={language.t("sucafina.native.dashboard-people.leaderRecordsUnavailable")} />
      </Show>
      <Show when={memberProjection().available} fallback={<UnavailableProjection message={language.t("sucafina.native.dashboard-people.memberRecordsUnavailable")} />}>
        <ReadTable
          label={language.t("sucafina.native.dashboard-people.talentReview")}
          columns={talentColumns()}
          rows={talentRows()}
          empty={members().length
            ? language.t("sucafina.native.dashboard-people.noStatusMatch")
            : language.t("sucafina.native.dashboard-people.noMemberRecords")}
        />
      </Show>
    </>
  )
}

function ReadTable(props: { label: string; columns: string[]; rows: TableRow[]; empty: string }) {
  return (
    <section class="mx-section" aria-label={props.label}>
      <h2>{props.label}</h2>
      <div class="mx-table" role="table" aria-label={props.label}>
        <div role="rowgroup">
          <div class="mx-row" role="row">
            <For each={props.columns}>{(column) => <span class="mx-grow" role="columnheader">{column}</span>}</For>
          </div>
        </div>
        <div role="rowgroup">
          <For each={props.rows}>
            {(item) => (
              <div class="mx-row" role="row">
                <For each={item.cells}>{(cell) => <span class="mx-grow" role="cell" style={{ "overflow-wrap": "anywhere" }}>{cell}</span>}</For>
              </div>
            )}
          </For>
        </div>
      </div>
      <Show when={props.rows.length === 0}><div class="mx-empty" role="status">{props.empty}</div></Show>
    </section>
  )
}

function Value(props: { label: string; value: unknown }) {
  return (
    <div class="mx-field">
      <dt>{props.label}</dt>
      <dd>{display(props.value)}</dd>
    </div>
  )
}

function UnavailableProjection(props: { message: string }) {
  return <div class="mx-empty" role="status">{props.message}</div>
}

function collection(value: Sucafina.PageState["data"][string]): Collection {
  if (!Array.isArray(value)) return { available: false }
  const validRows = value.filter((item): item is Row => isRow(item) && identifier(item.id) !== undefined)
  return validRows.length === value.length ? { available: true, rows: validRows } : { available: false }
}

function objectProjection(value: Sucafina.PageState["data"][string]): Row | undefined {
  return isRow(value) ? value : undefined
}

function findLeader(leaderId: unknown, leaders: Collection): Row | undefined {
  const normalizedLeaderId = identifier(leaderId)
  if (normalizedLeaderId === undefined || !leaders.available) return undefined
  return leaders.rows.find((leader) => identifier(leader.id) === normalizedLeaderId)
}

function leaderLabel(leaderId: unknown, leaders: Collection, emptyLabel: string, unavailableLabel: string): string {
  const normalizedLeaderId = identifier(leaderId)
  if (normalizedLeaderId === undefined) return emptyLabel
  if (!leaders.available) return unavailableLabel
  return display(findLeader(leaderId, leaders)?.name ?? leaderId)
}

function isRow(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function identifier(value: unknown): string | undefined {
  if (typeof value === "string") return value === "" ? undefined : value
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return undefined
}

function string(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—"
  if (typeof value === "string" || typeof value === "number") return String(value)
  return "—"
}
