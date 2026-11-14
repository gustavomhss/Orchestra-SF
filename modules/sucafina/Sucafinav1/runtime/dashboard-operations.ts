import {
  SECURITY_KPIS,
  securityKpiStatus,
  socClosureValue,
  heatCell,
  phishRate,
  phishTone,
  deptFailColor,
} from "../src/dashboard-accounts.ts"
import { esc } from "../src/screen-shell.ts"
import { changed, conflict, object, rows, text, finite } from "./contract.ts"
import type { Actor, Domain, Result, Snapshot } from "./contract.ts"
import { fields, form, metric, metricGrid, table } from "./ui.ts"
import type { Field, RenderContext } from "./ui.ts"

export const pages = ["IT Operations", "IT Security KPIs"] as const
// Source keys: opsCategories → opsCats, opsItems → opsHmItems,
// secEntries → secKpi, secCampaigns → secPhishing (Reverse §§1.10–1.11).
// Ticket keys match CIO Dashboard.html's catMetricKey verbatim.
const operations = ["opsTickets", "opsSLA", "opsHeatmap", "opsCats", "opsHmItems"]
const security = ["secKpi", "secActions", "secIncidents", "secPhishing"]
const categories = ["IT Security", "Infrastructure", "Application", "IT Operations", "Others (Beyers OT)"]
const items = ["iRely", "SAP BCC", "SAP TOM", "SUN", "SOL", "Daily PNL"]
const kpiFields = [
  "training",
  "assessment",
  "scan",
  "patch",
  "patchEndpoint",
  "patchServer",
  "socCritical",
  "socHigh",
  "socMedium",
  "socLow",
  "socPending",
  "socTP",
  "socFP",
  "socEPS",
  "socIPs",
  "socClosure",
]
const campaignNumbers = [
  "targeted",
  "noInteraction",
  "openedOnly",
  "clicked",
  "entered",
  "reported",
  "trainingCompletion",
  "avgMinutes",
]
const consequences = ["Data exfiltration", "Data loss", "Service unavailability"]

function writable(actor: Actor, page: string) {
  return (
    actor.canWrite &&
    (actor.roles.includes("admin") ||
      (actor.roles.includes("contributor") &&
        (actor.assigned ?? []).includes(page === pages[0] ? "Operations" : "security")))
  )
}
function readable(snapshot: Snapshot, actor: Actor, page: string) {
  if (actor.roles.some((role) => ["admin", "domain leader", "contributor"].includes(role))) return true
  // The admin-owned summaries list is the existing navigation permission input.
  return (
    actor.roles.includes("viewer") && Array.isArray(snapshot.data.summaries) && snapshot.data.summaries.includes(page)
  )
}
function list(value: unknown, defaults: string[]) {
  const found = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && !!item.trim())
    : []
  return found.length ? found : defaults
}
function ticketFields(data: Record<string, unknown>) {
  return list(data.opsCats, categories).flatMap((category) =>
    ["Incidents", "Service Requests"].flatMap((type) =>
      ["Initial Balance", "Open", "Closed"].map((measure) => `${category}|${type}|${measure}`),
    ),
  )
}
function invalid(errors: string[]): Result {
  return { ok: false, status: 422, errors }
}
function date(value: unknown) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  )
}
// Validation builds a fresh record; no caller data is ever mutated on rejection.
function record(
  input: Record<string, unknown>,
  numeric: string[],
  strings: string[],
  booleans: string[] = [],
  blank: number | "" = 0,
) {
  const errors: string[] = []
  const value: Record<string, unknown> = {}
  numeric.forEach((key) => {
    const raw = input[key]
    const parsed =
      raw == null || raw === ""
        ? blank
        : typeof raw === "number" || (typeof raw === "string" && raw.trim())
          ? Number(raw)
          : NaN
    if (parsed !== "" && (!Number.isFinite(parsed) || Number(parsed) < 0))
      errors.push(`${key}: nonnegative finite number required`)
    value[key] = parsed
  })
  strings.forEach((key) => {
    if (input[key] != null && typeof input[key] !== "string") errors.push(`${key}: text required`)
    value[key] = text(input[key]).trim()
  })
  booleans.forEach((key) => {
    if (input[key] != null && ![true, false, "true", "false", "yes", "no", ""].includes(input[key] as string | boolean))
      errors.push(`${key}: boolean required`)
    value[key] = input[key] === true || input[key] === "true" || input[key] === "yes"
  })
  Object.keys(input)
    .filter((key) => ![...numeric, ...strings, ...booleans, "year", "month"].includes(key))
    .forEach((key) => errors.push(`Unknown field: ${key}`))
  return { value, errors }
}
function json(value: unknown): unknown {
  if (typeof value !== "string") return value
  try {
    return JSON.parse(value) as unknown
  } catch {
    return undefined
  }
}
function month(input: Record<string, unknown>) {
  if (!["number", "string"].includes(typeof input.year) || !["number", "string"].includes(typeof input.month))
    return undefined
  const year = Number(input.year)
  const month = Number(input.month)
  return Number.isInteger(year) && year >= 2024 && year <= 2027 && Number.isInteger(month) && month >= 1 && month <= 12
    ? { year, month }
    : undefined
}
function sameMonth(row: Record<string, unknown>, period: { year: number; month: number }) {
  return row.year === period.year && row.month === period.month
}
function monthly(snapshot: Snapshot, period: { year: number; month: number }) {
  return Object.fromEntries(
    operations.slice(0, 3).map((key) => [key, rows(snapshot.data[key]).filter((row) => sameMonth(row, period))]),
  )
}

export const domain: Domain = {
  execute(snapshot, actor, command, environment) {
    if (!actor.canWrite) return { ok: false, status: 403 }
    if (!pages.some((page) => page === command.page)) return { ok: false, status: 400 }
    if (!writable(actor, command.page)) return { ok: false, status: 403 }
    // Shared forms send textarea values as strings. Decode at the server boundary.
    const structured =
      command.action === "import-month"
        ? ["tickets", "sla", "heatmap"]
        : command.action === "save-campaign"
          ? ["departments"]
          : command.action === "save-incident"
            ? ["consequences"]
            : []
    const decoded = Object.fromEntries(
      structured.filter((key) => command.values[key] !== undefined).map((key) => [key, json(command.values[key])]),
    )
    if (Object.values(decoded).some((value) => value === undefined)) return invalid(["Invalid JSON field"])
    command = {
      ...command,
      confirmed: command.confirmed === true || command.values.confirmed === true || command.values.confirmed === "true",
      values: {
        ...Object.fromEntries(Object.entries(command.values).filter(([key]) => key !== "confirmed")),
        ...decoded,
      },
    }
    if (!Number.isInteger(command.version) || command.version < 0) return invalid(["Invalid version"])
    if (command.page === pages[0]) {
      if (["save-categories", "save-items"].includes(command.action)) {
        const collection = command.action === "save-categories" ? "opsCats" : "opsHmItems"
        const raw = command.values.names
        const names: unknown =
          typeof raw === "string"
            ? raw
                .split("\n")
                .map((name) => name.trim())
                .filter(Boolean)
            : raw
        if (
          !Array.isArray(names) ||
          names.some((name) => typeof name !== "string" || !name.trim() || name.includes("|")) ||
          new Set(names).size !== names.length ||
          Object.keys(command.values).some((key) => key !== "names")
        )
          return invalid(["Unique category/item names required; | is reserved"])
        const key = `ops-list:${collection}`
        const was = snapshot.data[collection] ?? []
        const stale = conflict(snapshot, key, command, was)
        if (stale) return stale
        snapshot.data[collection] = names.slice()
        changed(snapshot, key, actor, environment.at, was, names)
        return { ok: true }
      }
      if (!["save-tickets", "save-sla", "save-heatmap", "import-month"].includes(command.action))
        return { ok: false, status: 400 }
      const period = month(command.values)
      if (!period) return invalid(["Year 2024–2027 and month 1–12 required"])
      const key = `ops:${period.year}-${period.month}`
      const was = monthly(snapshot, period)
      const stale = conflict(snapshot, key, command, was)
      if (stale) return stale
      const replacements: Record<string, Record<string, unknown>[]> = {}
      const listChanges: {
        collection: string
        key: string
        was: unknown
        became: string[]
      }[] = []
      if (command.action === "import-month") {
        if (!command.confirmed) return invalid(["Confirm full month replacement"])
        if (
          Object.keys(command.values).some(
            (key) => !["year", "month", "tickets", "sla", "heatmap", "categoriesVersion", "itemsVersion"].includes(key),
          ) ||
          !command.values.tickets ||
          typeof command.values.tickets !== "object" ||
          Array.isArray(command.values.tickets) ||
          (command.values.sla !== undefined &&
            (!command.values.sla || typeof command.values.sla !== "object" || Array.isArray(command.values.sla))) ||
          (command.values.heatmap !== undefined &&
            (!Array.isArray(command.values.heatmap) ||
              rows(command.values.heatmap).length !== command.values.heatmap.length))
        )
          return invalid(["Complete tickets, SLA and heatmap objects required"])
        const ticketInput = object(command.values.tickets)
        const ticketKeys = Object.keys(ticketInput)
        if (ticketKeys.some((key) => !/^[^|]+\|(Incidents|Service Requests)\|(Initial Balance|Open|Closed)$/.test(key)))
          return invalid(["Invalid ticket category metric"])
        const tickets = record(ticketInput, ticketKeys, [])
        const sla = record(object(command.values.sla), ["incSLA", "svcSLA", "avail"], [])
        sla.value.avail =
          command.values.sla && object(command.values.sla).avail != null && object(command.values.sla).avail !== ""
            ? sla.value.avail
            : 100
        const heatmap = rows(command.values.heatmap).map((row) =>
          record(row, ["p1", "p2", "tickets"], ["item", "comments"]),
        )
        const errors = [...tickets.errors, ...sla.errors, ...heatmap.flatMap((row) => row.errors)]
        if (
          heatmap.some((row) => !row.value.item) ||
          new Set(heatmap.map((row) => row.value.item)).size !== heatmap.length
        )
          errors.push("Heatmap requires unique nonempty items")
        if (errors.length) return invalid(errors)
        const additions = [
          {
            collection: "opsCats",
            defaults: categories,
            names: ticketKeys.map((key) => key.split("|")[0]!),
            version: command.values.categoriesVersion,
          },
          {
            collection: "opsHmItems",
            defaults: items,
            names: heatmap.map((row) => text(row.value.item)),
            version: command.values.itemsVersion,
          },
        ]
        for (const addition of additions) {
          const before = list(snapshot.data[addition.collection], addition.defaults)
          const after = [...new Set([...before, ...addition.names])]
          if (after.length === before.length) continue
          const listVersion = Number(addition.version ?? 0)
          if (!Number.isInteger(listVersion) || listVersion < 0) return invalid(["Invalid list version"])
          const listKey = `ops-list:${addition.collection}`
          const outdated = conflict(
            snapshot,
            listKey,
            { ...command, version: listVersion },
            snapshot.data[addition.collection] ?? [],
          )
          if (outdated) return outdated
          listChanges.push({
            collection: addition.collection,
            key: listKey,
            was: snapshot.data[addition.collection] ?? [],
            became: after,
          })
        }
        replacements.opsTickets = [{ id: `${period.year}-${period.month}`, ...period, ...tickets.value }]
        if (command.values.sla !== undefined)
          replacements.opsSLA = [{ id: `${period.year}-${period.month}`, ...period, ...sla.value }]
        if (command.values.heatmap !== undefined)
          replacements.opsHeatmap = heatmap.map((row) => ({
            id: `${period.year}-${period.month}:${row.value.item}`,
            ...period,
            ...row.value,
          }))
      }
      if (command.action === "save-tickets") {
        const parsed = record(command.values, ticketFields(snapshot.data), [])
        if (parsed.errors.length) return invalid(parsed.errors)
        replacements.opsTickets = [{ id: `${period.year}-${period.month}`, ...period, ...parsed.value }]
      }
      if (command.action === "save-sla") {
        const parsed = record(command.values, ["incSLA", "svcSLA", "avail"], [])
        if (parsed.errors.length) return invalid(parsed.errors)
        if (command.values.avail == null || command.values.avail === "") parsed.value.avail = 100
        replacements.opsSLA = [{ id: `${period.year}-${period.month}`, ...period, ...parsed.value }]
      }
      if (command.action === "save-heatmap") {
        const parsed = record(command.values, ["p1", "p2", "tickets"], ["item", "comments"])
        if (!list(snapshot.data.opsHmItems, items).includes(text(parsed.value.item)))
          parsed.errors.push("Choose a configured heatmap item")
        if (parsed.errors.length) return invalid(parsed.errors)
        replacements.opsHeatmap = [
          ...rows(snapshot.data.opsHeatmap).filter((row) => sameMonth(row, period) && row.item !== parsed.value.item),
          {
            id: `${period.year}-${period.month}:${parsed.value.item}`,
            ...period,
            ...parsed.value,
          },
        ]
      }
      Object.entries(replacements).forEach(([collection, values]) => {
        snapshot.data[collection] = [
          ...rows(snapshot.data[collection]).filter((row) => !sameMonth(row, period)),
          ...values,
        ]
      })
      listChanges.forEach((change) => {
        snapshot.data[change.collection] = change.became
        changed(snapshot, change.key, actor, environment.at, change.was, change.became)
      })
      changed(snapshot, key, actor, environment.at, was, monthly(snapshot, period))
      return { ok: true }
    }
    const actions: Record<string, string> = {
      "save-kpi": "secKpi",
      "delete-kpi": "secKpi",
      "save-action": "secActions",
      "delete-action": "secActions",
      "save-incident": "secIncidents",
      "delete-incident": "secIncidents",
      "save-campaign": "secPhishing",
      "delete-campaign": "secPhishing",
    }
    const collection = actions[command.action]
    if (!Object.hasOwn(actions, command.action) || !collection) return { ok: false, status: 400 }
    const current = rows(snapshot.data[collection])
    const period = collection === "secKpi" ? month(command.values) : undefined
    if (collection === "secKpi" && !period) return invalid(["Year 2024–2027 and month 1–12 required"])
    const stored =
      collection === "secKpi"
        ? current.find((row) => sameMonth(row, period!))
        : current.find((row) => String(row.id) === command.id)
    if (command.id && (!stored || String(stored.id) !== command.id)) return { ok: false, status: 404 }
    const id = stored?.id ?? (period ? `${period.year}-${period.month}` : (command.id ?? environment.id()))
    const key = period ? `security:${period.year}-${period.month}` : `${collection}:${id}`
    const stale = conflict(snapshot, key, command, stored ?? null)
    if (stale) return stale
    if (command.action.startsWith("delete-")) {
      if (!stored) return { ok: false, status: 404 }
      snapshot.data[collection] = current.filter((row) => row !== stored)
      changed(snapshot, key, actor, environment.at, stored, null)
      return { ok: true }
    }
    const parsed =
      collection === "secKpi"
        ? record(command.values, kpiFields, ["notes"], [], "")
        : collection === "secActions"
          ? record(command.values, [], ["text"], ["done"])
          : collection === "secIncidents"
            ? record(
                Object.fromEntries(Object.entries(command.values).filter(([key]) => key !== "consequences")),
                [],
                ["title", "date", "impact", "notes"],
                ["contained", "remediated", "rootCause"],
              )
            : record(
                Object.fromEntries(Object.entries(command.values).filter(([key]) => key !== "departments")),
                campaignNumbers,
                ["name", "start", "end", "notes"],
                [],
                "",
              )
    if (collection === "secActions" && !parsed.value.text) parsed.errors.push("Action text required")
    if (collection === "secIncidents") {
      if (!parsed.value.title || !date(parsed.value.date)) parsed.errors.push("Incident title and valid date required")
      const values = command.values.consequences ?? []
      if (!Array.isArray(values) || values.some((value) => !consequences.includes(value)))
        parsed.errors.push("Unknown incident consequence")
      parsed.value.consequences = Array.isArray(values) ? structuredClone(values) : []
    }
    if (collection === "secPhishing") {
      if (!parsed.value.name) parsed.errors.push("Campaign name required")
      ;["start", "end"].forEach((key) => {
        if (parsed.value[key] && !date(parsed.value[key])) parsed.errors.push(`${key}: invalid date`)
      })
      const departments = Array.isArray(command.values.departments)
        ? rows(command.values.departments).filter((row) =>
            Object.values(row).some((value) => value !== "" && value != null),
          )
        : (command.values.departments ?? [])
      if (!Array.isArray(departments) || rows(departments).length !== departments.length)
        parsed.errors.push("Invalid departments")
      const values = rows(departments).map((row) =>
        record(row, ["users", "failed", "entered", "reported"], ["name"], [], ""),
      )
      parsed.errors.push(...values.flatMap((row) => row.errors))
      if (values.some((row) => !row.value.name)) parsed.errors.push("Department name required")
      parsed.value.departments = values.map((row) => row.value)
    }
    if (parsed.errors.length) return invalid(parsed.errors)
    const became = { id, ...period, ...parsed.value }
    snapshot.data[collection] = [...current.filter((row) => row !== stored), became]
    changed(snapshot, key, actor, environment.at, stored ?? null, became)
    return { ok: true, value: became }
  },
  view(snapshot, actor) {
    const permitted = [
      ...(readable(snapshot, actor, pages[0]) ? operations : []),
      ...(readable(snapshot, actor, pages[1]) ? security : []),
    ]
    const prefixes = [
      ...(permitted.includes("opsTickets") ? ["ops:", "ops-list:"] : []),
      ...(permitted.includes("secKpi") ? ["security:", "secActions:", "secIncidents:", "secPhishing:"] : []),
    ]
    return {
      data: structuredClone(
        Object.fromEntries(
          permitted.filter((key) => snapshot.data[key] !== undefined).map((key) => [key, snapshot.data[key]]),
        ),
      ),
      versions: structuredClone(
        Object.fromEntries(
          Object.entries(snapshot.versions).filter(([key]) => prefixes.some((prefix) => key.startsWith(prefix))),
        ),
      ),
    }
  },
}

function periodFields(context: RenderContext) {
  return fields([
    {
      name: "year",
      label: "Year",
      type: "number",
      min: 2024,
      max: 2027,
      value: context.year,
      required: true,
    },
    {
      name: "month",
      label: "Month",
      type: "number",
      min: 1,
      max: 12,
      value: context.month,
      required: true,
    },
  ])
}
function inputs(names: string[], row: Record<string, unknown>, type: Field["type"] = "number") {
  return fields(
    names.map((name) => ({
      name,
      label: name,
      type,
      value: row[name],
      ...(type === "number" ? { min: 0, step: "any" } : {}),
    })),
  )
}
function chart(title: string, labels: string[], series: { name: string; values: (number | null)[] }[]) {
  const colors = ["#0f766e", "#2563eb", "#b45309", "#dc2626"]
  const values = series.flatMap((line) => line.values.filter((value): value is number => value !== null && Number.isFinite(value)))
  const low = Math.min(0, ...values)
  const high = Math.max(1, ...values)
  const y = (value: number) => 180 - ((value - low) / (high - low)) * 150
  const slot = 600 / Math.max(labels.length, 1)
  const width = Math.min(12, slot / Math.max(series.length + 1, 1))
  return `<figure><figcaption>${esc(title)}</figcaption><ul class="chart-legend">${series.map((line, index) => `<li><span aria-hidden="true" style="background:${colors[index % colors.length]}"></span>${esc(line.name)}</li>`).join("")}</ul>${values.length ? `<svg role="img" aria-label="${esc(title)}" viewBox="0 0 720 230"><title>${esc(title)}</title><g class="chart-axis">${[...new Set([low, 0, high / 2, high])].map((value) => `<line x1="90" x2="705" y1="${y(value)}" y2="${y(value)}" stroke="#cbd5e1"/><text x="85" y="${y(value) + 4}" text-anchor="end" font-size="11">${esc(String(value))}</text>`).join("")}${labels.map((label, index) => `<text x="${100 + (index + 0.5) * slot}" y="202" text-anchor="middle" font-size="12">${esc(label)}</text>`).join("")}<text x="400" y="224" text-anchor="middle" font-size="12">Month</text></g>${series.flatMap((line, lineIndex) => line.values.flatMap((value, index) => value == null || !Number.isFinite(value) ? [] : [`<rect x="${100 + index * slot + lineIndex * width}" y="${Math.min(y(0), y(value))}" width="${width}" height="${Math.abs(y(value) - y(0))}" fill="${colors[lineIndex % colors.length]}"><title>${esc(`${labels[index]} ${line.name}: ${value}`)}</title></rect>`])).join("")}</svg>` : '<p class="chart-empty">No data available for this chart.</p>'}${table(
    ["Month", ...series.map((line) => line.name)],
    labels.map((label, index) => [
      esc(label),
      ...series.map((line) => (line.values[index] == null ? "No data" : esc(String(line.values[index])))),
    ]),
  )}</figure>`
}

export function render(page: string, data: Record<string, unknown>, context: RenderContext): string | undefined {
  if (!pages.some((owned) => page === owned)) return undefined
  const disabled = !writable(context.actor, page)
  const period = { year: context.year, month: context.month }
  const selector = `<div class="period-selector"><label>Year<select data-year="own" data-query="${page === pages[0] ? "opsYear" : "secYear"}">${[2024, 2025, 2026, 2027].map((year) => `<option${year === context.year ? " selected" : ""}>${year}</option>`).join("")}</select></label><label>Month<select data-month="own" data-query="${page === pages[0] ? "operationsMonth" : "securityMonth"}">${Array.from(
    { length: 12 },
    (_, index) => index + 1,
  )
    .map((month) => `<option${month === context.month ? " selected" : ""}>${month}</option>`)
    .join("")}</select></label></div>`
  const monthID = `${context.year}-${context.month}`
  if (page === pages[0]) {
    const version = context.versions[`ops:${monthID}`]?.version ?? 0
    const tickets = rows(data.opsTickets)
      .filter((row) => row.year === context.year)
      .sort((a, b) => finite(a.month) - finite(b.month))
    const keys = ticketFields(data)
    const ticket = tickets.find((row) => sameMonth(row, period)) ?? {}
    const sla = rows(data.opsSLA).find((row) => sameMonth(row, period)) ?? {}
    const heatmap = rows(data.opsHeatmap).filter((row) => row.year === context.year)
    const ticketTable = table(
      ["Month", ...keys],
      tickets.map((row) => [esc(String(row.month)), ...keys.map((key) => esc(String(finite(row[key]))))]),
    )
    const ticketForm = form(
      page,
      "save-tickets",
      monthID,
      version,
      periodFields(context) + inputs(keys, ticket),
      "Save tickets",
      disabled,
    )
    const slaForm = form(
      page,
      "save-sla",
      monthID,
      version,
      periodFields(context) + inputs(["incSLA", "svcSLA", "avail"], sla),
      "Save SLA",
      disabled,
    )
    const heatForms = list(data.opsHmItems, items)
      .map((item) => {
        const row = heatmap.find((row) => sameMonth(row, period) && row.item === item) ?? { item }
        return form(
          page,
          "save-heatmap",
          monthID,
          version,
          periodFields(context) +
            fields([
              {
                name: "item",
                label: "Item",
                type: "select",
                value: item,
                options: list(data.opsHmItems, items),
              },
            ]) +
            inputs(["p1", "p2", "tickets"], row) +
            inputs(["comments"], row, "textarea"),
          "Save heatmap cell",
          disabled,
        )
      })
      .join("")
    const months = Array.from({ length: 12 }, (_, index) => index + 1)
    const heatTable = table(
      ["Item", ...months.map(String)],
      list(data.opsHmItems, items).map((item) => [
        esc(item),
        ...months.map((month) => {
          const row = heatmap.find((row) => row.month === month && row.item === item)
          if (!row) return "—"
          const color = heatCell(finite(row.p1), finite(row.p2), finite(row.tickets))
          return `<span style="background:${color.bg}" title="${esc(text(row.comments))}">${color.dot} ${esc(`${finite(row.p1)}/${finite(row.p2)}/${finite(row.tickets)}`)}</span>`
        }),
      ]),
    )
    const sums = (measure: string) =>
      months.map((month) => {
        const row = tickets.find((row) => row.month === month)
        return row
          ? keys.filter((key) => key.endsWith(`|${measure}`)).reduce((sum, key) => sum + finite(row[key]), 0)
          : null
      })
    const slaRows = rows(data.opsSLA).filter((row) => row.year === context.year)
    const configuration = [
      ["save-categories", "opsCats", categories],
      ["save-items", "opsHmItems", items],
    ] as const
    return `${selector}<section><h2>Ticket Register</h2>${ticketTable}<details class="editor-panel"><summary>Edit monthly ticket register</summary>${ticketForm}</details></section>${chart(
      "Opened vs Closed",
      months.map(String),
      [
        { name: "Opened", values: sums("Open") },
        { name: "Closed", values: sums("Closed") },
      ],
    )}<section><h2>SLA and Availability</h2>${table(
      ["Month", "Incident SLA", "Service SLA", "Availability"],
      slaRows.map((row) => [
        esc(String(row.month)),
        ...["incSLA", "svcSLA", "avail"].map((key) => esc(String(row[key] ?? ""))),
      ]),
    )}<details class="editor-panel"><summary>Edit monthly service levels</summary>${slaForm}</details></section>${chart(
      "SLA and availability trend",
      months.map(String),
      ["incSLA", "svcSLA", "avail"].map((key) => ({
        name: key,
        values: months.map((month) => {
          const row = slaRows.find((row) => row.month === month)
          return row ? finite(row[key]) : null
        }),
      })),
    )}<section><h2>Heat Map</h2>${heatTable}<details class="editor-panel"><summary>Edit heat map</summary><div>${heatForms}</div></details></section><details class="editor-panel"><summary>Categories and items</summary><div>${configuration.map(([action, key, defaults]) => form(page, action, key, context.versions[`ops-list:${key}`]?.version ?? 0, fields([{ name: "names", label: key, type: "textarea", value: list(data[key], [...defaults]).join("\n") }]), "Save list", disabled)).join("")}</div></details><details class="editor-panel"><summary>Import month</summary><div><p>Replaces the selected month’s ticket register after preview and confirmation.</p>${form(page, "import-month", monthID, version, periodFields(context) + `<input type="hidden" name="categoriesVersion" value="${context.versions["ops-list:opsCats"]?.version ?? 0}"><input type="hidden" name="itemsVersion" value="${context.versions["ops-list:opsHmItems"]?.version ?? 0}"><label>Ticket Register workbook<input type="file" data-workbook="operations" accept=".xlsx,.xlsm"></label><input type="hidden" name="tickets" data-workbook-rows data-json="true"><p data-import-notice></p>`, "Replace month", disabled)}</div></details>`
  }
  const entries = rows(data.secKpi)
    .filter((row) => row.year === context.year)
    .sort((a, b) => finite(a.month) - finite(b.month))
  const entry = entries.find((row) => row.month === context.month) ?? {}
  const closure = socClosureValue(entry)
  const tiles = SECURITY_KPIS.map((kpi) => {
    const value = kpi.key === "socClosure" ? closure : entry[kpi.key]
    return (
      '<div class="metric-tile">' +
      metric(kpi.key, value == null || value === "" ? "No data" : String(value)) +
      `<p>${securityKpiStatus(kpi.better, kpi.target, kpi.moderate, typeof value === "number" || typeof value === "string" ? value : null)}</p></div>`
    )
  })
  const kpiForm = form(
    page,
    "save-kpi",
    entry.id == null ? "" : String(entry.id),
    context.versions[`security:${monthID}`]?.version ?? 0,
    periodFields(context) + inputs(kpiFields, entry) + inputs(["notes"], entry, "textarea"),
    "Save monthly entry",
    disabled,
  )
  const securityForm = (kind: string, collection: string, row: Record<string, unknown>, body: string) => {
    const id = row.id == null ? "" : String(row.id)
    const version = context.versions[`${collection}:${id}`]?.version ?? 0
    return (
      `<details class="editor-panel"><summary>${id ? `Edit ${esc(text(row.title) || text(row.name) || text(row.text) || kind)}` : `Add ${esc(kind)}`}</summary>` +
      form(page, `save-${kind}`, id, version, body, `Save ${kind}`, disabled) +
      (id ? form(page, `delete-${kind}`, id, version, "", `Delete ${kind}`, disabled) : "") + "</details>"
    )
  }
  const actions = [...rows(data.secActions), {}]
    .map((row) =>
      securityForm(
        "action",
        "secActions",
        row,
        inputs(["text"], row, "textarea") +
          fields([{ name: "done", label: "Done", type: "checkbox", value: row.done }]),
      ),
    )
    .join("")
  const incidents = rows(data.secIncidents).filter((row) => text(row.date).startsWith(String(context.year)))
  const incidentForms = [...incidents, {}]
    .map((row) =>
      securityForm(
        "incident",
        "secIncidents",
        row,
        fields([
          { name: "title", label: "Title", value: row.title, required: true },
          {
            name: "date",
            label: "Date",
            type: "date",
            value: row.date,
            required: true,
          },
        ]) +
          inputs(["impact", "notes"], row, "textarea") +
          fields(
            ["contained", "remediated", "rootCause"].map((name) => ({
              name,
              label: name,
              type: "checkbox",
              value: row[name],
            })),
          ) +
          `<fieldset><legend>Consequences</legend>${consequences.map((value, index) => `<label><input type="checkbox" name="consequences.${index}" data-choice="true" value="${esc(value)}"${Array.isArray(row.consequences) && row.consequences.includes(value) ? " checked" : ""}>${esc(value)}</label>`).join("")}</fieldset>`,
      ),
    )
    .join("")
  const campaigns = [...rows(data.secPhishing), {}]
    .map((row) => {
      const targeted = finite(row.targeted)
      const measures = [
        {
          name: "Failure",
          value: phishRate(finite(row.clicked) + finite(row.entered), targeted),
          better: "low" as const,
          target: 10,
          moderate: 20,
        },
        {
          name: "Entered",
          value: phishRate(finite(row.entered), targeted),
          better: "low" as const,
          target: 5,
          moderate: 10,
        },
        {
          name: "Reported",
          value: phishRate(finite(row.reported), targeted),
          better: "high" as const,
          target: 20,
          moderate: 10,
        },
      ]
      return `<article><h3>${esc(text(row.name) || "New campaign")}</h3>${metricGrid(measures.map((measure) => `<div class="metric-tile" data-tone="${phishTone(measure.better, measure.value, measure.target, measure.moderate)}">${metric(measure.name, measure.value == null ? "No data" : `${measure.value}%`)}</div>`), 3)}${table(
        ["Department", "Users", "Failure %", "Entered", "Reported"],
        rows(row.departments).map((department) => {
          const failure = phishRate(finite(department.failed), finite(department.users))
          return [
            esc(text(department.name)),
            esc(String(department.users ?? "")),
            `<span data-tone="${deptFailColor(failure)}">${failure == null ? "No data" : esc(String(failure))}</span>`,
            esc(String(department.entered ?? "")),
            esc(String(department.reported ?? "")),
          ]
        }),
      )}${securityForm(
        "campaign",
        "secPhishing",
        row,
        fields([
          {
            name: "name",
            label: "Campaign name",
            value: row.name,
            required: true,
          },
        ]) +
          inputs(["start", "end"], row, "date") +
          inputs(campaignNumbers, row) +
          inputs(["notes"], row, "textarea") +
          table(
            ["Department", "Users", "Failed", "Entered", "Reported"],
            [...rows(row.departments), {}].map((department, index) =>
              ["name", "users", "failed", "entered", "reported"].map(
                (name) =>
                  `<label>${esc(name)}<input name="departments.${index}.${name}" type="${name === "name" ? "text" : "number"}" value="${esc(String(department[name] ?? ""))}"></label>`,
              ),
            ),
          ),
      )}</article>`
    })
    .join("")
  const series = (names: string[]) =>
    names.map((name) => ({
      name,
      values: entries.map((row) => (row[name] === "" || row[name] == null ? null : finite(row[name]))),
    }))
  return `${selector}<section><h2>Monthly KPIs</h2>${metricGrid(tiles)}${table(
    ["Month", ...SECURITY_KPIS.map((kpi) => kpi.key)],
    entries.map((row) => [
      esc(String(row.month)),
      ...SECURITY_KPIS.map((kpi) => {
        const value = kpi.key === "socClosure" ? socClosureValue(row) : row[kpi.key]
        return esc(value == null || value === "" ? "No data" : String(value))
      }),
    ]),
  )}<details class="editor-panel"><summary>Edit monthly security KPIs</summary>${kpiForm}${entry.id == null ? "" : form(page, "delete-kpi", String(entry.id), context.versions[`security:${monthID}`]?.version ?? 0, periodFields(context), "Delete monthly entry", disabled)}</details></section><section><h2>Management Actions</h2><p>Current action records as of ${esc(context.at.slice(0, 10))}; the selected KPI year does not create a historical action snapshot.</p>${table(["Action", "Status"], rows(data.secActions).map((row) => [esc(text(row.text)), row.done === true ? "Done" : "Open"]))}${actions}</section>${chart(
    "SOC trend",
    entries.map((row) => String(row.month)),
    series(["socPending", "socTP", "socFP"]),
  )}${chart(
    "SOC severity",
    entries.map((row) => String(row.month)),
    series(["socCritical", "socHigh", "socMedium", "socLow"]),
  )}${chart(
    "Patch trend",
    entries.map((row) => String(row.month)),
    series(["patch", "patchEndpoint", "patchServer"]),
  )}<section><h2>Phishing Simulation</h2><p>Current campaign records as of ${esc(context.at.slice(0, 10))}; the selected KPI year does not create a historical campaign snapshot.</p>${campaigns}</section><section><h2>Security Incidents with Business Impact</h2><p>Incidents dated in ${context.year}; containment, remediation and root-cause status are current as of ${esc(context.at.slice(0, 10))}.</p>${metric("Open incidents", String(incidents.filter((row) => !row.contained || !row.remediated || !row.rootCause).length))}${table(
    ["Title", "Date", "Status", "Impact"],
    incidents.map((row) => [
      esc(text(row.title)),
      esc(text(row.date)),
      !row.contained || !row.remediated || !row.rootCause ? "Open" : "Closed",
      esc(text(row.impact)),
    ]),
  )}${incidentForms}</section>`
}

export const DashboardOperations = { pages, domain, render }
