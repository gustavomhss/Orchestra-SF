import { For, Match, Show, Switch } from "solid-js"
import type { Sucafina } from "@orchestra/schema/sucafina"
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
          leaderLabel(member.leaderId, leaders, "Unassigned"),
          leaders.available ? display(leader?.domain) : "Leader data unavailable",
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
            <span>Year</span>
            <select
              value={year()}
              onChange={(event) => props.props.onQuery({ ...props.props.query, year: event.currentTarget.value })}
            >
              <For each={headcountYears}>{(item) => <option value={item}>{item}</option>}</For>
            </select>
          </label>
        </div>
        <div class="mx-meta">
          <MxBadge>Projection limited</MxBadge>
          <span>Headcount measures and leader aggregates are not included in the authorized page data.</span>
        </div>
      </div>
      <Show when={memberProjection().available} fallback={<UnavailableProjection label="Member records" />}>
        <ReadTable
          label="Headcount people"
          columns={["Name", "Leader", "Domain", "Location", "Type", "Status"]}
          rows={memberRows()}
          empty="No member records in this authorized projection."
        />
      </Show>
    </>
  )
}

function TeamStructureView(props: { props: NativeViewProps }) {
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
          members.available ? childNames || "—" : "Member data unavailable",
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
        leaderLabel(member.leaderId, leaders, "Unassigned"),
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
      <Show when={cioProjection()} fallback={<UnavailableProjection label="CIO position" />}>
        {(cio) => (
          <section class="mx-card" aria-labelledby="people-cio-title">
            <div class="mx-card-top"><h2 id="people-cio-title">CIO position</h2></div>
            <dl class="mx-fields">
              <Value label="Name" value={cio().name} />
              <Value label="Title" value={cio().title} />
              <Value label="Location" value={cio().location} />
              <Value label="Start" value={cio().start} />
            </dl>
          </section>
        )}
      </Show>
      <Show when={leaderProjection().available} fallback={<UnavailableProjection label="Team leaders" />}>
        <ReadTable
          label="Team leaders"
          columns={["Leader", "Title", "Domain", "Location", "Start", "Members"]}
          rows={leaderRows()}
          empty="No leaders in this authorized projection."
        />
      </Show>
      <Show when={memberProjection().available} fallback={<UnavailableProjection label="Team members" />}>
        <ReadTable
          label="Team members"
          columns={["Name", "Leader", "Title", "Type", "Location", "Start date", "End date", "Status"]}
          rows={memberRows()}
          empty="No member records in this authorized projection."
        />
      </Show>
    </>
  )
}

function TalentReviewView(props: { props: NativeViewProps }) {
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
  const talentColumns = () => [
    "Name",
    "Title",
    "Type",
    "Reports To",
    "Location",
    "Status",
    ...(privateColumn("cls") ? ["Classification"] : []),
    ...(privateColumn("outlook") ? ["3-Yr Outlook"] : []),
    ...(privateColumn("notes") ? ["Notes"] : []),
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
          leaderLabel(member.leaderId, leaders, "—"),
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
            <span>Status</span>
            <select
              value={selectedStatus()}
              onChange={(event) => props.props.onQuery({ ...props.props.query, memberStatus: event.currentTarget.value })}
            >
              <For each={memberStatuses}>{(status) => <option value={status}>{status || "Active (default)"}</option>}</For>
            </select>
          </label>
        </div>
      </div>
      <Show when={!leaderProjection().available}>
        <UnavailableProjection label="Leader records" />
      </Show>
      <Show when={memberProjection().available} fallback={<UnavailableProjection label="Member records" />}>
        <ReadTable
          label="Talent review"
          columns={talentColumns()}
          rows={talentRows()}
          empty={members().length ? "No members match the selected status." : "No member records in this authorized projection."}
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

function UnavailableProjection(props: { label: string }) {
  return <div class="mx-empty" role="status">No authorized projection was supplied for {props.label}.</div>
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

function leaderLabel(leaderId: unknown, leaders: Collection, emptyLabel: string): string {
  const normalizedLeaderId = identifier(leaderId)
  if (normalizedLeaderId === undefined) return emptyLabel
  if (!leaders.available) return "Leader data unavailable"
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
