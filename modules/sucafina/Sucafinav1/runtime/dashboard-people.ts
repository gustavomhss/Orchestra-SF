import { changed, conflict, object, rows, text } from "./contract.ts"
import type { Actor, Command, Domain, Environment, NativeAction, NativeChoice, NativeCommandContext, NativeScalar, NativeText, Result, Snapshot } from "./contract.ts"
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
      if (!canChangeTeam(actor))
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
    if (!canChangeTeam(actor)) return { ok: false, status: 403 }
    return saveRecord(snapshot, actor, command, environment, "hotTopics", topicFields)
  },
  commands(snapshot, actor, _environment, context) {
    if (!actor.canWrite || !canRead(snapshot, actor, context.page)) return []
    if (context.page === pages[1] || !(pages as readonly string[]).includes(context.page)) return []
    if (context.page === pages[3] ? !actor.roles.includes("admin") : !canChangeTeam(actor)) return []
    const definitions = context.page === pages[0]
      ? [{ collection: "hotTopics", keys: topicFields, save: "save", remove: "delete", group: { en: "Hot topics and actions", br: "Temas e ações" }, entity: { en: "action", br: "ação" } }]
      : context.page === pages[2]
        ? [
            { collection: "leaders", keys: leaderFields, save: "saveLeader", remove: "deleteLeader", group: { en: "Leaders", br: "Líderes" }, entity: { en: "leader", br: "líder" } },
            { collection: "members", keys: memberFields.filter((key) => !["cls", "outlook", "notes"].includes(key)), save: "saveMember", remove: "deleteMember", group: { en: "Members", br: "Membros" }, entity: { en: "member", br: "membro" } },
          ]
        : [{ collection: "members", keys: memberFields, save: "save", remove: "delete", group: { en: "Talent review", br: "Avaliação de talentos" }, entity: { en: "member", br: "membro" } }]
    const actions = definitions.flatMap((definition): NativeAction[] => {
      const fields = nativePeopleFields(definition.keys, context)
      const defaults = definition.collection === "hotTopics"
        ? { status: "open", priority: "normal" }
        : definition.collection === "members"
          ? { type: "Employee", status: "Active", leaderId: "", ...(context.page === pages[3] ? { cls: "", outlook: "" } : {}) }
          : {}
      return [
        {
          key: `${definition.collection}:create`,
          label: { en: `Add ${definition.entity.en}`, br: `Adicionar ${definition.entity.br}` },
          group: definition.group,
          command: { page: context.page, action: definition.save, version: 0, values: { ...defaults } },
          fields,
        },
        ...rows(context.view.data[definition.collection]).flatMap((row): NativeAction[] => {
          const id = idOf(row.id)
          const version = context.view.versions[`${definition.collection}:${id}`]?.version ?? 0
          const target = { collection: definition.collection, id }
          const identity = text(definition.collection === "hotTopics" ? row.action : row.name)
          return [
            {
              key: `${definition.collection}:edit:${id}`,
              label: { en: `Edit ${definition.entity.en}: ${identity}`, br: `Editar ${definition.entity.br}: ${identity}` },
              group: definition.group,
              target,
              command: {
                page: context.page,
                action: definition.save,
                id,
                version,
                values: {
                  ...defaults,
                  ...pick(row, definition.keys),
                  ...(definition.collection === "members" ? { leaderId: idOf(row.leaderId) } : {}),
                },
              },
              fields,
            },
            {
              key: `${definition.collection}:delete:${id}`,
              label: { en: `Delete ${definition.entity.en}: ${identity}`, br: `Excluir ${definition.entity.br}: ${identity}` },
              group: definition.group,
              target,
              command: {
                page: context.page,
                action: definition.remove,
                id,
                version,
                values: definition.collection === "leaders"
                  ? {
                      versions: Object.fromEntries(rows(context.view.data.members)
                        .filter((member) => idOf(member.leaderId) === id)
                        .map((member) => [`members:${idOf(member.id)}`, context.view.versions[`members:${idOf(member.id)}`]?.version ?? 0])),
                    }
                  : {},
                confirmed: true,
              },
              fields: [],
              danger: true,
              confirm: definition.collection === "leaders"
                ? { en: "Delete this leader and leave their members unassigned?", br: "Excluir este líder e deixar seus membros sem líder?" }
                : { en: `Delete this ${definition.entity.en}?`, br: `Excluir este registro (${definition.entity.br})?` },
            },
          ]
        }),
      ]
    })
    if (context.page !== pages[2]) return actions
    return [
      {
        key: "cio:save",
        label: { en: "Save CIO", br: "Salvar CIO" },
        group: { en: "CIO", br: "CIO" },
        command: { page: context.page, action: "saveCio", version: context.view.versions.cio?.version ?? 0, values: pick(object(context.view.data.cio), cioFields) },
        fields: nativePeopleFields(cioFields, context),
      },
      ...actions,
    ]
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
    if (allowed.includes(pages[1]))
      data.nativeHeadcountSummaryByYear = Object.fromEntries(
        [2024, 2025, 2026, 2027].map((year) => [year, headcountSummary(data, year, environment.at, actor.roles.includes("admin"))]),
      )
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

function canChangeTeam(actor: Actor) {
  return actor.roles.includes("admin") || actor.roles.includes("domain leader")
}

function nativePeopleFields(keys: readonly string[], context: NativeCommandContext): NativeScalar[] {
  const labels: Record<string, NativeText> = {
    name: { en: "Name", br: "Nome" },
    title: { en: "Job title", br: "Cargo" },
    domain: { en: "Domain", br: "Domínio" },
    type: { en: "Employment type", br: "Tipo de vínculo" },
    leaderId: { en: "Reports to", br: "Líder" },
    location: { en: "Location", br: "Localidade" },
    start: { en: "Start date", br: "Data de início" },
    end: { en: "End date", br: "Data de término" },
    status: { en: "Status", br: "Situação" },
    cls: { en: "Classification", br: "Classificação" },
    outlook: { en: "Outlook", br: "Perspectiva" },
    notes: { en: "Notes", br: "Observações" },
    action: { en: "Action", br: "Ação" },
    responsible: { en: "Responsible", br: "Responsável" },
    owner: { en: "Owner", br: "Titular" },
    due: { en: "Due date", br: "Prazo" },
    priority: { en: "Priority", br: "Prioridade" },
  }
  const choices: Record<string, NativeText> = {
    "": { en: "Not reviewed", br: "Não avaliado" },
    Active: { en: "Active", br: "Ativo" },
    "On Leave": { en: "On leave", br: "Afastado" },
    Terminated: { en: "Terminated", br: "Desligado" },
    Employee: { en: "Employee", br: "Funcionário" },
    Contractor: { en: "Contractor", br: "Prestador de serviços" },
    Talent: { en: "Talent", br: "Talento" },
    "Solid Contributor": { en: "Solid contributor", br: "Colaborador consistente" },
    Lagger: { en: "Lagger", br: "Abaixo do esperado" },
    Promote: { en: "Promote", br: "Promover" },
    Stay: { en: "Stay", br: "Manter" },
    Replace: { en: "Replace", br: "Substituir" },
    Termination: { en: "Termination", br: "Desligamento" },
    open: { en: "Open", br: "Aberto" },
    progress: { en: "In progress", br: "Em andamento" },
    blocked: { en: "Blocked", br: "Bloqueado" },
    done: { en: "Done", br: "Concluído" },
    critical: { en: "Critical", br: "Crítica" },
    high: { en: "High", br: "Alta" },
    normal: { en: "Normal", br: "Normal" },
  }
  return keys.map((key): NativeScalar => {
    const options: NativeChoice[] | undefined = key === "leaderId"
      ? [
          { value: "", label: { en: "No leader", br: "Sem líder" } },
          ...rows(context.view.data.leaders).map((leader) => ({ value: idOf(leader.id), label: { en: text(leader.name), br: text(leader.name) } })),
        ]
      : (key === "status" ? context.page === pages[0] ? ["open", "progress", "blocked", "done"] : statuses
        : key === "type" ? ["Employee", "Contractor"]
          : key === "cls" ? classifications
            : key === "outlook" ? outlooks
              : key === "priority" ? ["critical", "high", "normal"] : undefined)
        ?.map((value) => ({ value, label: choices[value] ?? { en: value, br: value } }))
    return {
      kind: options ? "select" : key === "notes" ? "textarea" : key === "due" || (["start", "end"].includes(key) && keys.includes("leaderId")) ? "date" : "text",
      path: [key],
      label: labels[key] ?? { en: key, br: key },
      required: key === "action" || (key === "name" && keys !== cioFields),
      blank: "empty",
      ...(options ? { options } : {}),
    }
  })
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
    const summary = headcountSummary(data, context.year, context.at, admin)
    return (
      metricGrid([
        metric("Active", String(summary.active)),
        metric("Terminated", String(summary.terminated)),
        metric("Attrition YTD", `${summary.attritionPercent.toFixed(1)}%`),
        metric("Average tenure (months)", summary.averageTenureMonths === null ? "—" : summary.averageTenureMonths.toFixed(1)),
        metric("Staff ratio", summary.staffRatio === null ? "—" : String(summary.staffRatio)),
        metric("Contractors", String(summary.contractors)),
        metric("Employees", String(summary.employees)),
        (admin ? metric("Talent", String(summary.talent)) : ""),
      ], 4) +
      table(
        ["Leader", "Active", ...(admin ? ["Talent (active)"] : [])],
        [...summary.leaders, { ...summary.unassigned, name: "No leader" }].map((leader) => [
          esc(leader.name),
          String(leader.active),
          ...(admin ? [String(leader.talent)] : []),
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

function headcountSummary(data: Record<string, unknown>, year: number, at: string, talentVisible: boolean) {
  const members = rows(data.members)
  const active = members.filter((member) => member.status === "Active")
  const terminated = members.filter((member) => member.status === "Terminated")
  const departed = terminated.filter((member) => text(member.end).startsWith(String(year)))
  const now = new Date(at)
  const tenure = (people: Record<string, unknown>[]) => people
    .filter((member) => text(member.start) && Number.isFinite(new Date(text(member.start)).getTime()))
    .map((member) => (now.getFullYear() - new Date(text(member.start)).getFullYear()) * 12 +
      now.getMonth() - new Date(text(member.start)).getMonth())
  const average = (values: number[]) => values.length ? values.reduce((total, value) => total + value, 0) / values.length : null
  const classifications = (people: Record<string, unknown>[]) => talentVisible ? {
    talent: people.filter((member) => member.cls === "Talent").length,
    solid: people.filter((member) => member.cls === "Solid Contributor").length,
    laggers: people.filter((member) => member.cls === "Lagger").length,
  } : {}
  const leaderSummary = (leader: Record<string, unknown>) => {
    const assigned = active.filter((member) => idOf(member.leaderId) === idOf(leader.id))
    const contractors = assigned.filter((member) => member.type === "Contractor").length
    return {
      id: idOf(leader.id), name: text(leader.name), domain: text(leader.domain), location: text(leader.location),
      active: assigned.length, employees: assigned.length - contractors, contractors,
      averageTenureMonths: average(tenure(assigned)), ...classifications(assigned),
    }
  }
  const leaders = rows(data.leaders).map(leaderSummary)
  const unassigned = leaderSummary({})
  const leaderTotals = {
    employees: leaders.reduce((sum, leader) => sum + leader.employees, 0),
    contractors: leaders.reduce((sum, leader) => sum + leader.contractors, 0),
    active: leaders.reduce((sum, leader) => sum + leader.active, 0),
    ...(talentVisible ? {
      talent: leaders.reduce((sum, leader) => sum + (leader.talent ?? 0), 0),
      solid: leaders.reduce((sum, leader) => sum + (leader.solid ?? 0), 0),
      laggers: leaders.reduce((sum, leader) => sum + (leader.laggers ?? 0), 0),
    } : {}),
  }
  const usersMonth = year === now.getFullYear() ? now.getMonth() + 1 : 12
  const users = monthlyUsers(data.itUsersMonthly, year, usersMonth)
  const averageHeadcount = active.length + departed.length / 2
  const tenures = tenure(active)
  const contractors = active.filter((member) => member.type === "Contractor").length
  return {
    active: active.length, terminated: terminated.length, departures: departed.length,
    attritionPercent: averageHeadcount ? departed.length / averageHeadcount * 100 : 0,
    averageTenureMonths: average(tenures), staffRatio: users && active.length ? Math.round(users / active.length) : null,
    users, usersMonth, averageHeadcount, tenureCount: tenures.length, staffPercent: users !== 0 ? active.length / users * 100 : null,
    employees: active.length - contractors, contractors, itLeaders: leaders.length, ...classifications(members),
    leaders, unassigned, leaderTotals,
    departureDetails: departed.map((member) => ({ id: idOf(member.id), name: text(member.name), end: text(member.end) })),
  }
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
