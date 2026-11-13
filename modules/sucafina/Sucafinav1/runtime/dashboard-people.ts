import { changed, conflict, object, rows, text } from "./contract.ts"
import type { Actor, Command, Domain, Environment, Result, Snapshot } from "./contract.ts"
import { fields, form, metric, metricGrid, table } from "./ui.ts"
import type { Field, RenderContext } from "./ui.ts"
import { esc } from "../src/screen-shell.ts"
import { dashboardPages } from "../src/nav.ts"
import { itUsersForMonth } from "../src/dashboard-accounts.ts"
import { WorkbookDate } from "../src/workbook-date.ts"

export const pages = ["Hot Topics & Actions", "Headcount Overview", "Team Structure", "Talent Review"] as const
const statuses = ["Active", "On Leave", "Terminated"]
const classifications = ["", "Talent", "Solid Contributor", "Lagger"]
const outlooks = ["", "Promote", "Stay", "Replace", "Termination"]
const memberFields = [
  "name",
  "title",
  "type",
  "leaderId",
  "location",
  "start",
  "end",
  "status",
  "cls",
  "outlook",
  "notes",
]
const topicFields = ["action", "responsible", "owner", "due", "status", "priority", "notes"]
const leaderFields = ["name", "title", "domain", "location", "start"]
const cioFields = ["name", "title", "location", "start"]

export const domain: Domain = {
  execute(snapshot, actor, command, environment) {
    if (!actor.canWrite) return { ok: false, status: 403 }
    if (!(pages as readonly string[]).includes(command.page)) return { ok: false, status: 400 }
    if (!canRead(snapshot, actor, command.page)) return { ok: false, status: 403 }
    if (command.page === pages[1]) return { ok: false, status: 400 }
    const admin = actor.roles.includes("admin")
    if (command.page === pages[3]) {
      if (!admin)
        return {
          ok: false,
          status: 403,
          errors: ["You do not have access to Talent Review."],
        }
      if (command.action === "exportAllMembers") {
        return {
          ok: true,
          value: {
            file: true,
            live: false,
            sheet: "All Members",
            rows: readMembers(snapshot, actor, environment).map((member) => ({
              Name: text(member.name),
              Title: text(member.title),
              Type: text(member.type),
              Leader: text(
                rows(snapshot.data.leaders).find((leader) => idOf(leader.id) === idOf(member.leaderId))?.name,
              ),
              Location: text(member.location),
              Start: text(member.start),
              End: text(member.end),
              Status: text(member.status),
              Classification: text(member.cls),
              Outlook: text(member.outlook),
            })),
          },
        }
      }
      if (command.action === "import") return importMembers(snapshot, actor, command, environment)
      if (!["save", "delete"].includes(command.action)) return { ok: false, status: 400 }
      return saveRecord(snapshot, actor, command, environment, "members", memberFields)
    }
    if (command.page === pages[2]) {
      if (!["saveCio", "saveLeader", "deleteLeader", "saveMember", "deleteMember"].includes(command.action))
        return { ok: false, status: 400 }
      if (!admin && !actor.roles.includes("domain leader"))
        return {
          ok: false,
          status: 403,
          errors: ["You do not have permission to change this team."],
        }
      if (command.action === "saveCio") {
        const stored = object(snapshot.data.cio)
        const stale = conflict(snapshot, "cio", command, stored)
        if (stale) return stale
        const next = { ...stored, ...pick(command.values, cioFields) }
        snapshot.data.cio = next
        changed(snapshot, "cio", actor, environment.at, stored, next)
        return { ok: true, value: next }
      }
      return saveRecord(
        snapshot,
        actor,
        {
          ...command,
          action: command.action.startsWith("delete") ? "delete" : "save",
        },
        environment,
        command.action.endsWith("Leader") ? "leaders" : "members",
        command.action.endsWith("Leader") ? leaderFields : memberFields,
      )
    }
    if (!["save", "delete"].includes(command.action)) return { ok: false, status: 400 }
    // §4.1 authorizes domain leaders' hot topics without an owner qualifier.
    if (!admin && !actor.roles.includes("domain leader")) return { ok: false, status: 403 }
    return saveRecord(snapshot, actor, command, environment, "hotTopics", topicFields)
  },
  view(snapshot, actor, environment) {
    const allowed = pages.filter((page) => canRead(snapshot, actor, page))
    const people = allowed.some((page) => page !== pages[0]) || dashboardPages(actor).includes("Executive Dashboard")
    const data: Record<string, unknown> = {}
    if (allowed.includes(pages[0]))
      data.hotTopics = rows(snapshot.data.hotTopics).map((row) => ({
        id: idOf(row.id),
        ...pick(row, topicFields),
        responsible: hotTopicResponsible(row),
      }))
    if (people) {
      data.members = readMembers(snapshot, actor, environment)
      data.leaders = rows(snapshot.data.leaders).map((row) => ({
        id: idOf(row.id),
        ...pick(row, leaderFields),
      }))
      data.cio = pick(object(snapshot.data.cio), cioFields)
      data.itUsersMonthly = structuredClone(snapshot.data.itUsersMonthly ?? [])
    }
    return {
      data,
      versions: Object.fromEntries(
        Object.entries(snapshot.versions).filter(
          ([key]) =>
            (people && (key.startsWith("members:") || key.startsWith("leaders:") || key === "cio")) ||
            (allowed.includes(pages[0]) && key.startsWith("hotTopics:")),
        ),
      ),
    }
  },
}

function canRead(snapshot: Snapshot, actor: Actor, page: string) {
  return dashboardPages(
    actor,
    Array.isArray(snapshot.data.summaries)
      ? snapshot.data.summaries.filter((item): item is string => typeof item === "string")
      : [],
  ).includes(page)
}

function pick(values: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  return Object.fromEntries(
    keys
      .filter(
        (key) =>
          typeof values[key] === "string" ||
          (key === "leaderId" && typeof values[key] === "number" && Number.isFinite(values[key])),
      )
      .map((key) => [key, values[key]]),
  )
}

// Missing responsible is the legacy owner. An explicit empty string stays empty.
function hotTopicResponsible(row: Record<string, unknown>) {
  if (row.responsible !== undefined) return text(row.responsible)
  return text(row.owner)
}

function readMembers(snapshot: Snapshot, actor: Actor, environment: Environment): Record<string, unknown>[] {
  return rows(snapshot.data.members).map((member) => {
    snapshot.audit.push({
      who: actor.id,
      at: environment.at,
      record: `members:${idOf(member.id)}`,
      was: null,
      became: { read: true, member: idOf(member.id) },
    })
    return {
      id: idOf(member.id),
      ...pick(
        member,
        actor.roles.includes("admin")
          ? memberFields
          : memberFields.filter((key) => !["cls", "outlook", "notes"].includes(key)),
      ),
    }
  })
}

function invalidMember(member: Record<string, unknown>) {
  return (
    !text(member.name).trim() ||
    !statuses.includes(text(member.status)) ||
    !["Employee", "Contractor"].includes(text(member.type)) ||
    !classifications.includes(text(member.cls)) ||
    !outlooks.includes(text(member.outlook))
  )
}

function saveRecord(
  snapshot: Snapshot,
  actor: Actor,
  command: Command,
  environment: Environment,
  collection: string,
  keys: string[],
): Result {
  const records = rows(snapshot.data[collection])
  const stored = command.id ? records.find((row) => idOf(row.id) === command.id) : undefined
  if (command.id && !stored) return { ok: false, status: 404 }
  if (command.action === "delete" && !stored) return { ok: false, status: 400 }
  const id = command.id || environment.id()
  if (!id || (!stored && (records.some((row) => idOf(row.id) === id) || snapshot.versions[`${collection}:${id}`])))
    return { ok: false, status: 409 }
  const key = `${collection}:${id}`
  const stale = conflict(snapshot, key, command, stored ?? null)
  if (stale) return stale
  // Non-admin team saves ignore posted classification, outlook, and notes.
  const recordKeys =
    collection === "members" && !actor.roles.includes("admin")
      ? keys.filter((field) => field !== "cls" && field !== "outlook" && field !== "notes")
      : keys
  const next: Record<string, unknown> = {
    ...(collection === "members"
      ? { type: "Employee", status: "Active", cls: "", outlook: "" }
      : collection === "hotTopics"
        ? { status: "open", priority: "normal" }
        : {}),
    ...stored,
    ...pick(command.values, recordKeys),
    id: stored?.id ?? id,
  }
  if (command.action !== "delete") {
    if (collection === "members" && invalidMember(next))
      return {
        ok: false,
        status: 422,
        errors: ["Name, valid status, type, classification and outlook required."],
      }
    if (collection === "leaders" && !text(next.name).trim())
      return { ok: false, status: 422, errors: ["Name required."] }
    if (
      collection === "hotTopics" &&
      (!text(next.action).trim() ||
        !["open", "progress", "blocked", "done"].includes(text(next.status)) ||
        !["critical", "high", "normal"].includes(text(next.priority)))
    )
      return {
        ok: false,
        status: 422,
        errors: ["Action, valid status and priority required."],
      }
    if (
      collection === "members" &&
      idOf(next.leaderId) !== "" &&
      !rows(snapshot.data.leaders).some((leader) => idOf(leader.id) === idOf(next.leaderId))
    )
      return { ok: false, status: 422, errors: ["Unknown leader."] }
  }
  const affected =
    collection === "leaders" && command.action === "delete"
      ? rows(snapshot.data.members).filter((member) => idOf(member.leaderId) === id)
      : []
  for (const member of affected) {
    const version = object(jsonField(command.values.versions))[`members:${idOf(member.id)}`]
    if (typeof version !== "number")
      return {
        ok: false,
        status: 422,
        errors: ["Each affected member version is required."],
      }
    const staleMember = conflict(snapshot, `members:${idOf(member.id)}`, { ...command, version }, member)
    if (staleMember) return staleMember
  }
  snapshot.data[collection] =
    command.action === "delete"
      ? records.filter((row) => idOf(row.id) !== id)
      : stored
        ? records.map((row) => (idOf(row.id) === id ? next : row))
        : [...records, next]
  changed(snapshot, key, actor, environment.at, stored ?? null, command.action === "delete" ? null : next)
  if (affected.length) {
    snapshot.data.members = rows(snapshot.data.members).map((member) => {
      if (!affected.includes(member)) return member
      const cleared = { ...member, leaderId: "" }
      changed(snapshot, `members:${idOf(member.id)}`, actor, environment.at, member, cleared)
      return cleared
    })
  }
  return { ok: true, value: command.action === "delete" ? null : next }
}

function importMembers(snapshot: Snapshot, actor: Actor, command: Command, environment: Environment): Result {
  if (command.values.replace === true && command.confirmed !== true)
    return {
      ok: false,
      status: 422,
      errors: ["Replace requires confirmation."],
    }
  const imported = jsonField(command.values.rows)
  if (
    !Array.isArray(imported) ||
    !imported.length ||
    imported.some((row) => !text(object(row).Name ?? object(row).name).trim())
  )
    return {
      ok: false,
      status: 422,
      errors: ["Import needs named member rows."],
    }
  // Stage the complete transaction so a late validation/conflict never leaves partial writes.
  const staged = structuredClone(snapshot)
  const versions = object(jsonField(command.values.versions))
  if (command.values.replace === true) {
    for (const member of rows(staged.data.members)) {
      const version = versions[`members:${idOf(member.id)}`]
      if (typeof version !== "number")
        return {
          ok: false,
          status: 422,
          errors: ["Each replaced member version is required."],
        }
      const result = saveRecord(
        staged,
        actor,
        { ...command, action: "delete", id: idOf(member.id), version },
        environment,
        "members",
        memberFields,
      )
      if (!result.ok) return result
    }
  }
  for (const row of rows(imported)) {
    const name = text(row.Name ?? row.name).trim()
    const stored = rows(staged.data.members).find(
      (member) => text(member.name).trim().toLowerCase() === name.toLowerCase(),
    )
    const start = WorkbookDate.parse(row["Start Date"] ?? row.Start ?? row.start)
    const end = WorkbookDate.parse(row["End Date"] ?? row.End ?? row.end)
    if (start === undefined || end === undefined)
      return { ok: false, status: 422, errors: ["Invalid member date"] }
    const mapping: Record<string, string> = {
      Name: "name",
      Title: "title",
      Type: "type",
      Location: "location",
      Status: "status",
      Classification: "cls",
      Outlook: "outlook",
      Notes: "notes",
    }
    const values = Object.fromEntries(
      Object.entries(mapping).flatMap(([column, field]) => {
        const value = row[column] ?? row[field]
        if (typeof value !== "string" || (!value && !["cls", "outlook"].includes(field))) return []
        return [[field, value]]
      }),
    )
    if (start) values.start = start
    if (end) values.end = end
    if (command.values.replace === true && !stored && (!start || !end)) {
      const prior = rows(snapshot.data.members).find(
        (member) => text(member.name).trim().toLowerCase() === name.toLowerCase(),
      )
      if (!start && typeof prior?.start === "string") values.start = prior.start
      if (!end && typeof prior?.end === "string") values.end = prior.end
    }
    if (typeof row.Leader === "string" && row.Leader.trim()) {
      const leader = rows(staged.data.leaders).find(
        (item) => text(item.name).trim().toLowerCase() === text(row.Leader).trim().toLowerCase(),
      )
      if (!leader) return { ok: false, status: 422, errors: ["Unknown leader name."] }
      values.leaderId = idOf(leader.id)
    }
    const key = stored ? `members:${idOf(stored.id)}` : ""
    // Existing rows require their read version; repeated homonyms use the version staged by this import.
    const original = rows(snapshot.data.members).find((member) => idOf(member.id) === idOf(stored?.id))
    const expected = original ? versions[key] : 0
    if (original && typeof expected !== "number")
      return {
        ok: false,
        status: 422,
        errors: ["Each matched member version is required."],
      }
    if (original && snapshot.versions[key]?.version !== undefined && snapshot.versions[key]?.version !== expected)
      return {
        ok: false,
        status: 409,
        stored: original,
        by: snapshot.versions[key]?.by,
      }
    if (original && !snapshot.versions[key] && expected !== 0) return { ok: false, status: 409, stored: original }
    const result = saveRecord(
      staged,
      actor,
      {
        ...command,
        action: "save",
        id: stored ? idOf(stored.id) : undefined,
        version: stored ? (staged.versions[key]?.version ?? 0) : 0,
        values,
      },
      environment,
      "members",
      memberFields,
    )
    if (!result.ok) return result
  }
  snapshot.data = staged.data
  snapshot.versions = staged.versions
  snapshot.audit = staged.audit
  return { ok: true }
}

export function render(page: string, data: Record<string, unknown>, context: RenderContext): string | undefined {
  if (!(pages as readonly string[]).includes(page)) return undefined
  const admin = context.actor.roles.includes("admin")
  const disabled =
    !context.actor.canWrite ||
    (!admin &&
      !(context.actor.roles.includes("domain leader") && (page === pages[0] || page === pages[2])))
  const version = (key: string) => context.versions[key]?.version ?? 0
  if (page === pages[0]) {
    const edit = (row: Record<string, unknown>) =>
      form(
        page,
        "save",
        idOf(row.id),
        version(`hotTopics:${idOf(row.id)}`),
        fields([
          {
            name: "action",
            label: "Action",
            value: row.action,
            required: true,
          },
          { name: "responsible", label: "Responsible", value: hotTopicResponsible(row) },
          { name: "owner", label: "Owner", value: row.owner },
          { name: "due", label: "Due", type: "date", value: row.due },
          {
            name: "status",
            label: "Status",
            type: "select",
            options: ["open", "progress", "blocked", "done"],
            value: row.status,
          },
          {
            name: "priority",
            label: "Priority",
            type: "select",
            options: ["critical", "high", "normal"],
            value: row.priority,
          },
          { name: "notes", label: "Notes", type: "textarea", value: row.notes },
        ]),
        "Save",
        disabled,
      )
    const midnight = new Date(context.at)
    midnight.setHours(0, 0, 0, 0)
    const topicStatus = text(data.topicStatus)
    const topicPriority = text(data.priority)
    return (
      filterForm(page, context.year, [
        {
          name: "topicStatus",
          label: "Filter status",
          type: "select",
          options: ["", "open", "progress", "blocked", "done"],
          value: data.topicStatus,
        },
        {
          name: "priority",
          label: "Priority",
          type: "select",
          options: ["", "critical", "high", "normal"],
          value: data.priority,
        },
      ]) +
      table(
        ["Action", "Responsible", "Status", "Priority", "Due", "Edit", "Delete"],
        rows(data.hotTopics)
          .filter(
            (row) =>
              (!topicStatus || text(row.status) === topicStatus) &&
              (!topicPriority || text(row.priority) === topicPriority),
          )
          .map((row) => [
            esc(text(row.action)),
            esc(hotTopicResponsible(row)),
            esc(text(row.status)),
            esc(text(row.priority)),
            esc(text(row.due)) +
              (row.due && row.status !== "done" && new Date(`${text(row.due)}T00:00:00`).getTime() < midnight.getTime()
                ? " Overdue"
                : ""),
            edit(row),
            form(page, "delete", idOf(row.id), version(`hotTopics:${idOf(row.id)}`), "", "Delete", disabled),
          ]),
      ) +
      edit({})
    )
  }
  const members = rows(data.members)
  if (page === pages[1]) {
    const active = members.filter((member) => member.status === "Active")
    const terminated = members.filter((member) => member.status === "Terminated")
    const departures = terminated.filter((member) => text(member.end).startsWith(String(context.year))).length
    const denominator = active.length + departures / 2
    const now = new Date(context.at)
    const tenure = active
      .filter((member) => text(member.start) && Number.isFinite(new Date(text(member.start)).getTime()))
      .map(
        (member) =>
          (now.getFullYear() - new Date(text(member.start)).getFullYear()) * 12 +
          now.getMonth() -
          new Date(text(member.start)).getMonth(),
      )
    const month = context.year === now.getFullYear() ? now.getMonth() + 1 : 12
    const users = monthlyUsers(data.itUsersMonthly, context.year, month)
    return (
      metricGrid([
        metric("Active", String(active.length)),
        metric("Terminated", String(terminated.length)),
        metric("Attrition YTD", `${(denominator ? (departures / denominator) * 100 : 0).toFixed(1)}%`),
        metric(
          "Average tenure (months)",
          tenure.length ? (tenure.reduce((total, value) => total + value, 0) / tenure.length).toFixed(1) : "—",
        ),
        metric("Staff ratio", users && active.length ? String(Math.round(users / active.length)) : "—"),
        metric("Contractors", String(active.filter((member) => member.type === "Contractor").length)),
        metric("Employees", String(active.filter((member) => member.type !== "Contractor").length)),
        (admin ? metric("Talent", String(members.filter((member) => member.cls === "Talent").length)) : ""),
      ], 4) +
      table(
        ["Leader", "Active", ...(admin ? ["Talent (active)"] : [])],
        [...rows(data.leaders), { id: "", name: "No leader" }].map((leader) => [
          esc(text(leader.name)),
          String(active.filter((member) => idOf(member.leaderId) === idOf(leader.id)).length),
          ...(admin
            ? [
                String(
                  active.filter((member) => idOf(member.leaderId) === idOf(leader.id) && member.cls === "Talent")
                    .length,
                ),
              ]
            : []),
        ]),
      ) +
      '<a href="?page=Team%20Structure">Team Structure</a>'
    )
  }
  if (page === pages[2]) {
    const cio = object(data.cio)
    const memberVersions = Object.fromEntries(
      members.map((member) => [`members:${idOf(member.id)}`, version(`members:${idOf(member.id)}`)]),
    )
    const leaderEditor = (row: Record<string, unknown>) =>
      form(
        page,
        "saveLeader",
        idOf(row.id),
        version(`leaders:${idOf(row.id)}`),
        fields(
          leaderFields.map((name) => ({
            name,
            label: name,
            value: row[name],
            required: name === "name",
          })),
        ),
        "Save leader",
        disabled,
      )
    return (
      "<h2>CIO</h2>" +
      form(
        page,
        "saveCio",
        "",
        version("cio"),
        fields(cioFields.map((name) => ({ name, label: name, value: cio[name] }))),
        "Save CIO",
        disabled,
      ) +
      "<h2>Leaders</h2>" +
      table(
        ["Leader", "Domain", "Members", "Edit", "Delete"],
        rows(data.leaders).map((leader) => [
          esc(text(leader.name)),
          esc(text(leader.domain)),
          members
            .filter((member) => idOf(member.leaderId) === idOf(leader.id))
            .map((member) => esc(text(member.name)))
            .join(", "),
          leaderEditor(leader),
          form(
            page,
            "deleteLeader",
            idOf(leader.id),
            version(`leaders:${idOf(leader.id)}`),
            `<input type="hidden" name="versions" value="${esc(JSON.stringify(memberVersions))}">`,
            "Delete leader",
            disabled,
          ),
        ]),
      ) +
      leaderEditor({}) +
      "<h2>Members</h2>" +
      table(
        ["Name", "Leader", "Edit", "Delete"],
        members.map((member) => [
          esc(text(member.name)),
          esc(text(rows(data.leaders).find((leader) => idOf(leader.id) === idOf(member.leaderId))?.name)),
          memberForm(page, member, context, data, disabled, false),
          form(
            page,
            "deleteMember",
            idOf(member.id),
            version(`members:${idOf(member.id)}`),
            "",
            "Delete member",
            disabled,
          ),
        ]),
      ) +
      memberForm(page, {}, context, data, disabled, false)
    )
  }
  if (!admin)
    return (
      filterForm(page, context.year, {
        name: "memberStatus",
        label: "Status filter (blank = Active)",
        type: "select",
        options: ["", ...statuses],
        value: data.memberStatus,
      }) +
      table(
        ["Name", "Title", "Type", "Status"],
        members
          .filter((member) => member.status === (text(data.memberStatus) || "Active"))
          .map((member) => [
            esc(text(member.name)),
            esc(text(member.title)),
            esc(text(member.type)),
            esc(text(member.status)),
          ]),
      )
    )
  return (
    filterForm(page, context.year, {
      name: "memberStatus",
      label: "Status filter (blank = Active)",
      type: "select",
      options: ["", ...statuses],
      value: data.memberStatus,
    }) +
    table(
      ["Name", "Classification", "Outlook", "Edit", "Delete"],
      members
        .filter((member) => member.status === (text(data.memberStatus) || "Active"))
        .map((member) => [
          esc(text(member.name)),
          esc(text(member.cls) || "Not reviewed"),
          esc(text(member.outlook) || "Not reviewed"),
          memberForm(page, member, context, data, disabled, true),
          form(page, "delete", idOf(member.id), version(`members:${idOf(member.id)}`), "", "Delete", disabled),
        ]),
    ) +
    memberForm(page, {}, context, data, disabled, true) +
    form(
      page,
      "import",
      "",
      0,
      '<label>Import members workbook<input type="file" name="workbook" accept=".xlsx" data-workbook="members" required></label><input type="hidden" name="rows" data-workbook-rows data-json="true"><p data-import-notice role="status"></p>' +
        fields([
          { name: "replace", label: "Replace members", type: "checkbox" },
          { name: "confirmed", label: "Confirm replacement", type: "checkbox" },
        ]) +
        `<input type="hidden" name="versions" value="${esc(JSON.stringify(Object.fromEntries(members.map((member) => [`members:${idOf(member.id)}`, version(`members:${idOf(member.id)}`)]))))}">`,
      "Import",
      disabled,
    ) +
    '<a href="?download=members">Export All Members</a>'
  )
}

function memberForm(
  page: string,
  member: Record<string, unknown>,
  context: RenderContext,
  data: Record<string, unknown>,
  disabled: boolean,
  talent: boolean,
) {
  const items: Field[] = memberFields
    .filter((key) => talent || !["cls", "outlook", "notes"].includes(key))
    .map((name) => ({
      name,
      label: (
        {
          name: "Name",
          title: "Title",
          type: "Type",
          leaderId: "Leader",
          location: "Location",
          start: "Start date",
          end: "End date",
          status: "Status",
          cls: "Classification",
          outlook: "Outlook",
          notes: "Notes",
        } as Record<string, string>
      )[name],
      value: member[name],
      required: name === "name",
      ...(name === "status"
        ? { type: "select", options: statuses }
        : name === "type"
          ? { type: "select", options: ["Employee", "Contractor"] }
          : name === "cls"
            ? { type: "select", options: classifications }
            : name === "outlook"
              ? { type: "select", options: outlooks }
              : name === "leaderId"
                ? {
                    type: "select",
                    options: ["", ...rows(data.leaders).map((leader) => idOf(leader.id))],
                  }
                : ["start", "end"].includes(name)
                  ? { type: "date" }
                  : name === "notes"
                    ? { type: "textarea" }
                    : {}),
    }))
  return form(
    page,
    talent ? "save" : "saveMember",
    idOf(member.id),
    context.versions[`members:${idOf(member.id)}`]?.version ?? 0,
    fields(items),
    "Save member",
    disabled,
  )
}

function monthlyUsers(value: unknown, year: number, month: number) {
  return itUsersForMonth(
    rows(value)
      .map((row) => ({
        year: Number(row.year),
        month: Number(row.month),
        users: Number(row.users),
      }))
      .filter((row) => Number.isFinite(row.year) && Number.isFinite(row.month) && Number.isFinite(row.users)),
    month,
    year,
  )
}

// Workbook adapters supply structured rows; hidden version maps can arrive as JSON strings.
function jsonField(value: unknown): unknown {
  if (typeof value !== "string") return value
  try {
    return JSON.parse(value) as unknown
  } catch {
    return undefined
  }
}

// Imported artifact IDs can be numbers. Convert identifiers only, never ordinary field values.
function idOf(value: unknown): string {
  return typeof value === "string" ? value : typeof value === "number" && Number.isFinite(value) ? String(value) : ""
}

function filterForm(page: string, year: number, field: Field | readonly Field[]) {
  const items = Array.isArray(field) ? [...field] : [field]
  return `<form method="get"><input type="hidden" name="page" value="${esc(page)}"><input type="hidden" name="year" value="${year}">${fields(items)}<button type="submit">Apply filter</button></form>`
}

export const DashboardPeople = { pages, domain, render }
