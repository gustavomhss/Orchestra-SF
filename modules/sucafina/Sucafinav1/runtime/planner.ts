import type { Actor, Command, Domain, Environment, Result, Snapshot } from "./contract.ts"
import { changed, conflict, finite, object, rows, text } from "./contract.ts"
import type { RenderContext } from "./ui.ts"
import { fields, form, metric, metricGrid, table } from "./ui.ts"
import { esc } from "../src/screen-shell.ts"
import { assignOwner, deleteRate, ownerLineScope, ownerMayEdit, plannerField } from "../src/planner-role.ts"
import {
  changeAnnual,
  cents,
  chosenRate,
  clampFte,
  emptyFlags,
  fteDecember,
  hrLineDomains,
  hrMonth,
  nextCpx,
  normName,
  orderSpan,
  outlookMonth,
  resetSpread,
  spread,
  syncEnters,
  syncRoster,
  syntheticHr,
  typeMonth,
  usdAmount,
  variance,
  ytd,
  zeroMonths,
  OPEX_ELEMENTS,
} from "../src/planner-accounts.ts"
import type { RateCard, RosterPerson } from "../src/planner-accounts.ts"
export const pages = [
  "Overview",
  "OPEX",
  "CAPEX",
  "Headcount",
  "Entities & allocations",
  "FX rates",
  "Versions",
] as const

type Row = Record<string, unknown>
function idOf(value: unknown): string {
  return typeof value === "string" || (typeof value === "number" && Number.isFinite(value)) ? String(value) : ""
}
function identified(row: Row): Row {
  return {
    ...row,
    ...(row.id === undefined ? {} : { id: idOf(row.id) }),
    ...Object.fromEntries(
      ["proj", "entity", "alloc", "rateId", "owner"]
        .filter((key) => typeof row[key] === "number")
        .map((key) => [key, idOf(row[key])]),
    ),
    ...(row.owner && typeof row.owner === "object"
      ? { owner: { ...object(row.owner), id: idOf(object(row.owner).id) } }
      : {}),
  }
}
type Version = Row & {
  id: string
  name: string
  year: number
  locked: boolean
  closed: number
  lines: Row[]
  projects: Row[]
  hc: Row & {
    positions: Row[]
    rates: Row[]
    inc: number
    incMonth: number
    hrAF: Row
  }
  fx: Row[]
  lists: Row
}
// Original backups store versions by id; normalize at the boundary, never by re-spreading money.
function plannerData(data: Row) {
  const errors: string[] = []
  const raw = data.versions
  if (raw !== undefined && (raw === null || typeof raw !== "object")) errors.push("Invalid versions collection")
  const entries: [string, unknown][] = Array.isArray(raw)
    ? raw.map((value) => ["", value])
    : Object.entries(object(raw))
  const ids = new Set<string>()
  const versions = entries.flatMap(([key, value]) => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      errors.push("Invalid version record")
      return []
    }
    const row = object(value)
    const id = idOf(row.id) || key
    if (!id || ids.has(id)) errors.push("Missing or duplicate version id")
    ids.add(id)
    return [key ? { ...row, id } : row]
  })
  const app = object(data.app)
  const officials = { ...object(data.officials) }
  const legacy = idOf(app.officialId ?? data.officialId)
  if (legacy) {
    const targetId = Array.isArray(raw) ? legacy : idOf(object(object(raw)[legacy]).id) || legacy
    const target = versions.find((row) => idOf(row.id) === legacy) || versions.find((row) => idOf(row.id) === targetId)
    if (!target && !Object.keys(officials).length) errors.push("Official version does not exist")
    if (target) {
      const year = finite(target.year)
      if ((!Number.isInteger(year) || year <= 2000 || year >= 2100) && !Object.keys(officials).length)
        errors.push("Invalid official fiscal year")
      else if (Number.isInteger(year) && year > 2000 && year < 2100 && !Object.hasOwn(officials, String(year))) {
        officials[String(year)] = idOf(target.id)
        versions[versions.indexOf(target)] = { ...target, locked: true }
      }
    }
  }
  return {
    data: {
      ...data,
      ...(data.entities === undefined && app.entities !== undefined ? { entities: app.entities } : {}),
      ...(data.allocations === undefined && app.allocations !== undefined ? { allocations: app.allocations } : {}),
      versions,
      officials,
    },
    errors,
  }
}
function versionOf(row: Row): Version {
  const hc = object(row.hc)
  return {
    ...row,
    id: idOf(row.id),
    name: text(row.name),
    year: finite(row.year),
    locked: typeof row.locked === "boolean" ? row.locked : row.lockBudget === true,
    closed: finite(row.closed),
    lines: rows(row.lines).map(identified),
    projects: rows(row.projects).map(identified),
    hc: {
      ...hc,
      positions: rows(hc.positions).map(identified),
      rates: rows(hc.rates).map(identified),
      inc: finite(hc.inc),
      incMonth: finite(hc.incMonth, 1),
      hrAF: Object.fromEntries(
        Object.entries(object(hc.hrAF ?? row.hrAF)).map(([domain, value]) => [domain, identified(object(value))]),
      ),
    },
    fx: rows(row.fx).map((rate) => ({
      ...rate,
      id: text(rate.id) || text(rate.cur),
    })),
    lists: object(row.lists ?? row.els),
  }
}
function months(value: unknown, nullable = false): (number | null)[] {
  return Array.from({ length: 12 }, (_, i) =>
    Array.isArray(value) && value[i] != null ? finite(value[i]) : nullable ? null : 0,
  )
}
function numericMonths(value: unknown): number[] {
  return months(value).map((value) => value ?? 0)
}
function flags(value: unknown): boolean[] {
  return Array.from({ length: 12 }, (_, i) => Array.isArray(value) && value[i] === true)
}
function privateAccess(actor: Actor) {
  return actor.roles.some((role) => ["admin", "hr", "finance"].includes(role))
}
// Redact recursively: migrated data can contain salary fields outside their original container.
function redact(value: unknown, position = false, fx = false): unknown {
  if (Array.isArray(value)) return value.map((item) => redact(item, position, fx))
  if (value === null || typeof value !== "object") return value
  return Object.fromEntries(
    Object.entries(object(value))
      .filter(
        ([key]) =>
          !/(salary|cost|override)|^(rates|rateId|inc|incMonth)$/i.test(key) &&
          (key !== "rate" || fx) &&
          !(position && /^(annual|months|total|budget|annualCost)$/i.test(key)),
      )
      .map(([key, item]) => [key, redact(item, position || key === "positions", fx || key === "fx")]),
  )
}
function calculated(version: Version) {
  const warnings = new Set<string>()
  const convert = (amount: number, cur: unknown) => {
    const converted = usdAmount(
      amount,
      text(cur),
      cur === "USD" ? 1 : (version.fx.find((rate) => rate.cur === cur)?.rate as number | null | undefined),
    )
    if (converted.warning) warnings.add(converted.warning)
    return converted.usd
  }
  const positions = version.hc.positions.map((position) => {
    const rate = chosenRate(
      version.hc.rates as RateCard[],
      text(position.type),
      text(position.location),
      text(position.rateId),
      position.rateOverride as number | string | null | undefined,
    )
    const fx = rate ? convert(1, rate.cur) : 0
    const fte = clampFte(finite(position.fte, 1))
    return {
      ...position,
      domain: text(position.domain) || "Unassigned",
      hasRate: !!rate,
      include: position.include === true,
      fte,
      start: finite(position.start, 1),
      end: finite(position.end, 12),
      type: text(position.type),
      months: Array.from({ length: 12 }, (_, i) =>
        hrMonth(
          position.include === true,
          !!rate,
          fte,
          rate?.annual ?? 0,
          fx,
          i + 1,
          finite(position.start, 1),
          finite(position.end, 12),
          version.hc.incMonth,
          version.hc.inc,
        ),
      ),
    }
  })
  const hr = hrLineDomains(positions, version.hc.hrAF).map((domain) => {
    const aggregate = syntheticHr(
      domain,
      positions.filter((position) => position.domain === domain),
      object(version.hc.hrAF[domain]),
    )
    return {
      id: `HR:${domain}`,
      sec: "opex",
      el: "hr",
      domain,
      cur: "USD",
      name: domain,
      b: aggregate.budget,
      annual: aggregate.annual,
      a: aggregate.actual,
      f: aggregate.forecast,
      owner: aggregate.owner,
      entity: aggregate.entity,
      alloc: aggregate.alloc,
      synthetic: true,
    }
  })
  const lines = [
    ...version.lines.filter(
      (line) => !(line.sec === "opex" && line.el === "hr") && !(line.sec === "capex" && line.el === "depr"),
    ),
    ...hr,
  ].map((line) => {
    const budget = numericMonths(line.b).map((value) => convert(value, line.cur))
    const actual = months(line.a, true).map((value) => convert(value ?? 0, line.cur))
    const outlook = budget.map((value, i) =>
      outlookMonth(
        i,
        version.closed,
        months(line.a, true)[i] === null ? null : actual[i],
        months(line.f, true)[i] === null ? null : convert(months(line.f, true)[i] ?? 0, line.cur),
        value,
      ),
    )
    return {
      ...line,
      budget,
      actual,
      outlook,
      total: budget.reduce((a, b) => a + b, 0),
    }
  })
  const budget = zeroMonths().map((_, i) => lines.reduce((sum, line) => sum + line.budget[i], 0))
  const actual = zeroMonths().map((_, i) => lines.reduce((sum, line) => sum + line.actual[i], 0))
  const outlook = zeroMonths().map((_, i) => lines.reduce((sum, line) => sum + line.outlook[i], 0))
  return {
    positions,
    hr,
    lines,
    budget,
    actual,
    outlook,
    total: budget.reduce((a, b) => a + b, 0),
    actualYTD: ytd(actual, version.closed),
    fullYear: outlook.reduce((a, b) => a + b, 0),
    hrTotal: hr.reduce((sum, line) => sum + line.annual, 0),
    fte: fteDecember(positions),
    warnings: [...warnings],
  }
}
export const domain: Domain = {
  execute(snapshot, actor, command, environment) {
    if (!actor.canWrite || !actor.roles.some((role) => ["admin", "finance", "hr", "budget owner"].includes(role)))
      return { ok: false, status: 403 }
    if (!pages.includes(command.page as (typeof pages)[number])) return { ok: false, status: 400 }
    if (
      ![
        "save",
        "delete",
        "copy",
        "lock",
        "unlock",
        "official",
        "reset",
        "spread",
        "sync",
        "common",
        "import-workbook",
      ].includes(command.action)
    )
      return { ok: false, status: 400 }
    // Work against a clone so every validation failure, including multi-record actions, is atomic.
    const draft = structuredClone(snapshot)
    const normalized = plannerData(draft.data)
    if (normalized.errors.length) return { ok: false, status: 422, errors: normalized.errors }
    draft.data = normalized.data
    const result = execute(draft, actor, command, environment)
    if (result.ok) Object.assign(snapshot, draft)
    if (!result.ok && result.stored !== undefined && !privateAccess(actor))
      return {
        ...result,
        stored: redact(result.stored, command.page === "Headcount"),
      }
    return result
  },
  view(snapshot, actor, environment) {
    const normalized = plannerData(structuredClone(snapshot.data)).data
    const versions = rows(normalized.versions)
      .map(versionOf)
      .map((version) => {
        const computed = calculated(version)
        return {
          ...version,
          hc: { ...version.hc, positions: computed.positions },
          summary: computed,
          hr: computed.hr,
        }
      })
    const data = {
      ...normalized,
      versions,
      directory: structuredClone(environment.directory),
    }
    return {
      data: privateAccess(actor) ? data : object(redact(data)),
      versions: structuredClone(snapshot.versions),
    }
  },
}
function lineScope(line: Row | undefined) {
  if (!line) return undefined
  const ownerId = text(line.ownerId) || text(object(line.owner).id) || text(line.owner)
  const domain = text(line.domain)
  return { ownerId, domain: domain || undefined, hr: line.synthetic === true }
}

function postedLineScope(values: Row) {
  const owner = values.owner
  const ownerId = owner !== null && typeof owner === "object" ? text(object(owner).id) : text(owner)
  const domain = text(values.domain)
  return { ownerId, domain: domain || undefined }
}

function mergedLineScope(stored: Row, values: Row) {
  const current = lineScope(stored)
  const ownerId = Object.hasOwn(values, "owner")
    ? values.owner !== null && typeof values.owner === "object"
      ? text(object(values.owner).id)
      : text(values.owner)
    : current?.ownerId
  const domain = Object.hasOwn(values, "domain") ? text(values.domain) : text(current?.domain)
  return { ownerId, domain: domain || undefined, hr: current?.hr }
}

// A logical HR domain is an own hrAF key or a real position domain. Missing storage is not a domain.
// An hrAF-only domain reuses structure authority, which is an unlocked admin on a version that is not official.
function hrDomainAuthorized(version: Version, domain: string, officialId: string | undefined, actor: Actor) {
  if (Object.hasOwn(version.hc.hrAF, domain) || version.hc.positions.some((position) => text(position.domain) === domain))
    return true
  return officialId !== version.id && plannerField("structure", version, officialId, actor)
}

function readJson(raw: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw) }
  } catch {
    return { ok: false }
  }
}

// budgetEdited is a JSON string of unique month indexes. Absent keeps the legacy "every posted bN is manual" rule.
function budgetMarks(values: Row): { ok: true; marks?: number[] } | { ok: false } {
  if (!Object.hasOwn(values, "budgetEdited")) return { ok: true }
  const raw = values.budgetEdited
  if (typeof raw !== "string") return { ok: false }
  const parsed = readJson(raw)
  if (!parsed.ok || !Array.isArray(parsed.value)) return { ok: false }
  const marks: number[] = []
  for (const item of parsed.value) {
    if (typeof item !== "number" || !Number.isInteger(item) || item < 0 || item > 11 || marks.includes(item))
      return { ok: false }
    const key = `b${item}`
    if (!Object.hasOwn(values, key)) return { ok: false }
    const posted = values[key]
    const amount = posted === null || posted === "" ? 0 : posted
    if (typeof amount !== "number" || !Number.isFinite(amount)) return { ok: false }
    marks.push(item)
  }
  return { ok: true, marks }
}

function execute(snapshot: Snapshot, actor: Actor, command: Command, environment: Environment): Result {
  const versions = rows(snapshot.data.versions).map(versionOf)
  const values = command.values
  const reject: Result = { ok: false, status: 403 }
  const invalid = (message: string): Result => ({
    ok: false,
    status: 422,
    errors: [message],
  })
  const write = (key: string, was: unknown, became: unknown) =>
    changed(snapshot, key, actor, environment.at, was, became)
  const persist = () => {
    snapshot.data.versions = versions
  }
  if (command.action === "import-workbook") return importWorkbook(snapshot, actor, command, environment)
  if (command.page === "Overview") return { ok: false, status: 400 }
  if (command.page === "Versions") return executeVersions(snapshot, actor, command, environment, versions)
  if (command.page === "Entities & allocations") return executeLists(snapshot, actor, command, environment, versions)
  const version = versions.find((item) => item.id === text(values.versionId))
  if (!version) return { ok: false, status: 404, errors: ["Choose a version"] }
  const official = idOf(object(snapshot.data.officials)[String(version.year)])
  const allowed = (field: string, line?: Row) =>
    plannerField(
      field,
      version,
      official,
      actor,
      line
        ? {
            ownerId: text(line.ownerId) || text(object(line.owner).id) || text(line.owner),
            domain: text(line.domain),
            hr: line.synthetic === true,
          }
        : undefined,
    )
  if (values.closed !== undefined) {
    if (
      command.page !== "OPEX" ||
      command.action !== "save" ||
      !allowed("closedThrough") ||
      actor.roles.every((role) => !["admin", "finance"].includes(role))
    )
      return reject
    const closed = Number(values.closed)
    if (!Number.isInteger(closed) || closed < 0 || closed > 12) return invalid("Closed month must be 0–12")
    if (Object.keys(values).some((key) => !["versionId", "closed"].includes(key)))
      return invalid("Unknown closed month field")
    const key = `${version.id}:closed`
    const stale = conflict(snapshot, key, command, version.closed)
    if (stale) return stale
    const was = version.closed
    version.closed = closed
    persist()
    write(key, was, closed)
    return { ok: true }
  }
  if (command.page === "Headcount" && command.action === "sync") {
    if (!allowed("headcount")) return reject
    const key = `${version.id}:positions:sync`
    const stale = conflict(snapshot, key, command, version.hc.positions)
    if (stale) return stale
    // Each position also has a revision; sync updates these, invalidating stale editors.
    const was = structuredClone(version.hc.positions)
    const roster = rows(snapshot.data.roster) as RosterPerson[]
    const synced = syncRoster(
      version.hc.positions.map((row) => ({
        ...row,
        name: text(row.name),
        end: finite(row.end, 12),
        domain: text(row.domain),
        domainManual: row.domainManual === true,
      })),
      roster,
      version.year,
      object(version.hc.leaderDomains) as Record<string, string>,
      version.locked,
    )
    if (!synced.ok) return reject
    version.hc.positions = synced.positions
    for (const person of roster.filter((person) => syncEnters(person, version.year)))
      if (!version.hc.positions.some((position) => normName(text(position.name)) === normName(person.name)))
        version.hc.positions.push({
          id: environment.id(),
          name: person.name,
          include: true,
          fte: 1,
          start:
            person.start && Number(person.start.slice(0, 4)) === version.year ? Number(person.start.slice(5, 7)) : 1,
          end: person.end ? Number(person.end.slice(5, 7)) : 12,
          type: "Employee",
          domain: text(object(version.hc.leaderDomains)[person.leader ?? ""]) || person.domain || "Unassigned",
          src: "roster",
        })
    version.hc.positions.forEach((position) =>
      write(
        `${version.id}:positions:${position.id}`,
        was.find((row) => row.id === position.id),
        position,
      ),
    )
    persist()
    write(key, was, version.hc.positions)
    return { ok: true }
  }
  if (command.page === "OPEX" && values.split !== undefined) {
    if (Object.keys(values).some((key) => !["versionId", "el", "split"].includes(key)))
      return invalid("Unknown split field")
    if (command.action !== "save" || !allowed("structure")) return reject
    const el = text(values.el)
    if (!OPEX_ELEMENTS.includes(el as (typeof OPEX_ELEMENTS)[number]) || el === "hr")
      return invalid("HR is always breakdown")
    const split = values.split === true || values.split === "true"
    const lines = version.lines.filter((line) => line.sec === "opex" && line.el === el)
    if (!split && lines.length > 1) return invalid("More than one line requires breakdown")
    const key = `${version.id}:lists:${el}`
    const stale = conflict(snapshot, key, command, version.lists[el])
    if (stale) return stale
    const was = structuredClone(version.lists[el])
    version.lists[el] = { ...object(was), split }
    if (split && lines.length === 1 && !text(lines[0].name) && finite(lines[0].annual) !== 0) {
      const before = structuredClone(lines[0])
      lines[0].name = "Unallocated"
      write(`${version.id}:lines:${lines[0].id}`, before, lines[0])
    }
    persist()
    write(key, was, version.lists[el])
    return { ok: true }
  }
  const collection =
    command.page === "FX rates"
      ? "fx"
      : command.page === "Headcount"
        ? text(values.collection) || "positions"
        : command.page === "CAPEX" && values.collection === "projects"
          ? "projects"
          : "lines"
  if (command.page !== "Headcount" && values.collection !== undefined && values.collection !== collection)
    return invalid("Unknown page collection")
  if (command.page === "Headcount" && !["positions", "rates", "increase", "leaderDomains"].includes(collection))
    return invalid("Unknown headcount collection")
  if (collection === "increase" || collection === "leaderDomains") {
    const permitted =
      collection === "increase"
        ? ["versionId", "collection", "inc", "incMonth"]
        : ["versionId", "collection", "mapping", "leader", "domain"]
    if (Object.keys(values).some((key) => !permitted.includes(key))) return invalid("Unknown headcount setting")
    if (!allowed(collection === "increase" ? "increase" : "headcount")) return reject
    const key = `${version.id}:${collection}`
    const was =
      collection === "increase" ? { inc: version.hc.inc, incMonth: version.hc.incMonth } : version.hc.leaderDomains
    const stale = conflict(snapshot, key, command, was)
    if (stale) return stale
    if (command.action !== "save") return { ok: false, status: 400 }
    if (collection === "increase") {
      const inc = Number(values.inc)
      const month = Number(values.incMonth)
      if (!Number.isFinite(inc) || !Number.isInteger(month) || month < 1 || month > 12)
        return invalid("Invalid increase")
      version.hc.inc = inc
      version.hc.incMonth = month
    } else {
      const leaders = [
        ...new Set(
          rows(snapshot.data.roster)
            .map((row) => text(row.leader))
            .filter(Boolean),
        ),
      ]
      if (values.mapping !== undefined) {
        if (Object.keys(object(values.mapping)).some((leader) => !leaders.includes(leader)))
          return invalid("Unknown roster leader")
        version.hc.leaderDomains = {
          ...object(version.hc.leaderDomains),
          ...Object.fromEntries(
            Object.entries(object(values.mapping)).map(([leader, domain]) => [leader, text(domain)]),
          ),
        }
      } else {
        const leader = text(values.leader)
        if (!leaders.includes(leader)) return invalid("Unknown roster leader")
        version.hc.leaderDomains = {
          ...object(version.hc.leaderDomains),
          [leader]: text(values.domain),
        }
      }
    }
    persist()
    write(
      key,
      was,
      collection === "increase" ? { inc: version.hc.inc, incMonth: version.hc.incMonth } : version.hc.leaderDomains,
    )
    return { ok: true }
  }
  const records =
    collection === "positions"
      ? version.hc.positions
      : collection === "rates"
        ? version.hc.rates
        : collection === "projects"
          ? version.projects
          : collection === "fx"
            ? version.fx
            : version.lines
  const id = command.id || environment.id()
  const synthetic = id.startsWith("HR:") && collection === "lines"
  if (synthetic && command.page !== "OPEX") return { ok: false, status: 400 }
  const hrDomain = synthetic ? id.slice(3) : ""
  const stored = synthetic
    ? Object.hasOwn(version.hc.hrAF, hrDomain)
      ? object(version.hc.hrAF[hrDomain])
      : undefined
    : records.find((row) => row.id === id)
  if (stored && collection === "lines" && !synthetic && stored.sec !== (command.page === "OPEX" ? "opex" : "capex"))
    return { ok: false, status: 400 }
  const key = `${version.id}:${synthetic ? "hrAF" : collection}:${id}`
  const stale = conflict(snapshot, key, command, stored)
  if (stale) return stale
  const fieldsByCollection: Record<string, string[]> = {
    lines: [
      "name",
      "desc",
      "owner",
      "entity",
      "alloc",
      "cls",
      "cur",
      "annual",
      "b",
      "a",
      "f",
      "el",
      "proj",
      "domain",
      "month",
      "value",
    ],
    projects: ["name", "desc", "owner", "code"],
    positions: [
      "name",
      "title",
      "type",
      "location",
      "include",
      "fte",
      "start",
      "end",
      "domain",
      "rateId",
      "rateOverride",
    ],
    rates: ["name", "locs", "annual", "cur"],
    fx: ["cur", "rate"],
  }
  if (
    Object.keys(values).some(
      (field) =>
        !["versionId", "collection", ...fieldsByCollection[collection]].includes(field) &&
        !(collection === "lines" && (field === "budgetEdited" || /^[baf](?:[0-9]|1[01])$/.test(field))),
    )
  )
    return invalid("Unknown field")
  const permission = (field: string) =>
    collection === "positions"
      ? "headcount"
      : collection === "rates"
        ? "rate"
        : collection === "fx"
          ? "fx"
          : field === "a" || /^a\d+$/.test(field)
            ? "actual"
            : field === "f" || /^f\d+$/.test(field)
              ? "forecast"
              : field === "owner" || field === "name" || field === "desc" || field === "code"
                ? field
                : field === "entity"
                  ? "entity"
                  : field === "alloc"
                    ? "allocation"
                    : field === "cls"
                      ? "classification"
                      : field === "cur"
                        ? "currency"
                        : "budget"
  const target = synthetic ? { ...stored, domain: hrDomain, synthetic: true } : stored
  const authLine = stored || synthetic ? lineScope(target) : postedLineScope(values)
  const may = (field: string) => {
    if (allowed(field, target)) return true
    if (collection !== "lines" || !ownerMayEdit(field, version, official, actor, authLine)) return false
    if (!stored) return true
    return ownerLineScope(actor, mergedLineScope(stored, values))
  }
  const recordField =
    collection === "positions"
      ? "headcount"
      : collection === "rates"
        ? "rate"
        : collection === "fx"
          ? "fx"
          : "structure"
  if (!stored && !synthetic && !may(recordField)) return reject
  if (synthetic && command.action === "save" && !hrDomainAuthorized(version, hrDomain, official, actor)) return reject
  if (command.action === "delete") {
    if (synthetic || !stored) return invalid("Cannot delete this record")
    if (!may(recordField)) return reject
    if (collection === "rates" && !deleteRate(id, version.hc.positions, true).ok) return invalid("Rate card is in use")
    if (collection === "projects" && version.lines.some((line) => line.proj === id)) return invalid("Project is in use")
    if (
      collection === "fx" &&
      (stored.cur === "USD" || [...version.lines, ...version.hc.rates].some((row) => row.cur === stored.cur))
    )
      return invalid("Currency is in use")
    records.splice(records.indexOf(stored), 1)
    persist()
    write(key, stored, undefined)
    if (collection === "positions") write(`${version.id}:positions:sync`, undefined, version.hc.positions)
    return { ok: true }
  }
  if (!["save", "spread", "reset"].includes(command.action)) return { ok: false, status: 400 }
  if (command.action !== "save" && (collection !== "lines" || synthetic || !may("budget"))) return reject
  for (const field of Object.keys(values).filter((field) => !["versionId", "collection", "budgetEdited"].includes(field)))
    if (!may(permission(field))) return reject
  if (
    synthetic &&
    Object.keys(values).some(
      (field) =>
        !["versionId", "collection", "a", "f", "owner", "entity", "alloc"].includes(field) &&
        !/^[af](?:[0-9]|1[01])$/.test(field),
    )
  )
    return reject
  const marker = collection === "lines" && !synthetic ? budgetMarks(values) : undefined
  if (marker && !marker.ok) return invalid("Invalid budget edit marker")
  if (
    stored &&
    command.action === "save" &&
    Object.keys(values).every((field) => ["versionId", "collection", "budgetEdited"].includes(field))
  )
    return reject
  if (collection === "lines" && values.domain !== undefined) return invalid("Domain belongs to synthetic HR lines")
  if (collection === "lines" && !synthetic && !stored && command.page === "OPEX") {
    const element = text(values.el) || "licenses"
    const split = object(version.lists[element]).split ?? ["licenses", "services", "hwo", "hr", "te"].includes(element)
    if (!split && records.some((row) => row.sec === "opex" && row.el === element))
      return invalid("Total only allows one line")
  }
  const next: Row = { ...stored, id }
  for (const [field, value] of Object.entries(values).filter(
    ([field]) =>
      !["versionId", "collection", "month", "value", "budgetEdited"].includes(field) &&
      !/^[baf](?:[0-9]|1[01])$/.test(field),
  ))
    next[field] = value
  const warnings: string[] = []
  for (const [field, value] of Object.entries(values).filter(([field]) => /^[baf](?:[0-9]|1[01])$/.test(field))) {
    const number = value === "" || value === null ? null : Number(value)
    if (number !== null && !Number.isFinite(number)) return invalid("Invalid monthly amount")
    if (field[0] === "b") continue
    const vector = months(next[field[0]], true)
    vector[Number(field.slice(1))] = number
    next[field[0]] = vector
  }

  if (values.owner !== undefined) {
    const requested = text(values.owner)
    const person = environment.directory.find((person) => person.id === requested)
    if (person) next.owner = { id: person.id, name: person.name }
    else if (!requested) next.owner = ""
    else {
      const result = assignOwner(
        stored?.owner && typeof stored.owner === "object"
          ? (object(stored.owner) as { id: string; name: string })
          : null,
        requested,
        environment.directory,
      )
      next.owner = result.owner ?? stored?.owner ?? ""
      if (result.warning) warnings.push(`Unknown owner: ${result.warning}`)
    }
  }
  for (const [field, list] of [
    ["entity", "entities"],
    ["alloc", "allocations"],
  ])
    if (
      values[field] !== undefined &&
      values[field] !== "" &&
      !rows(snapshot.data[list]).some((row) => idOf(row.id) === idOf(values[field]))
    )
      return invalid(`Unknown ${field}`)
  if (collection === "lines" && !synthetic) {
    next.sec = command.page === "OPEX" ? "opex" : "capex"
    next.el = text(next.el) || "licenses"
    next.cur = text(next.cur) || "USD"
    if (
      !OPEX_ELEMENTS.includes(next.el as (typeof OPEX_ELEMENTS)[number]) ||
      (next.sec === "opex" && next.el === "hr") ||
      (next.sec === "capex" && next.el === "depr")
    )
      return invalid("Invalid cost element")
    if (next.sec === "capex") {
      if (!version.projects.some((project) => project.id === next.proj)) return invalid("Choose a project")
      next.cls = text(next.cls) || "capex"
      if (!["capex", "opex"].includes(text(next.cls))) return invalid("Invalid classification")
    }
    const base = {
      annual: finite(stored?.annual),
      b: numericMonths(stored?.b),
      bm: flags(stored?.bm),
    }
    if (
      values.b !== undefined &&
      (!Array.isArray(values.b) ||
        values.b.length !== 12 ||
        values.b.some((value) => typeof value !== "number" || !Number.isFinite(value)))
    )
      return invalid("Budget requires twelve finite numbers")
    const month = Number(values.month)
    if (values.value !== undefined && !Number.isFinite(Number(values.value))) return invalid("Invalid monthly value")
    if (values.month !== undefined && (!Number.isInteger(month) || month < 0 || month > 11))
      return invalid("Invalid month")
    if (values.annual !== undefined && !Number.isFinite(Number(values.annual))) return invalid("Invalid annual amount")
    const plan =
      command.action === "reset"
        ? resetSpread(base)
        : command.action === "spread"
          ? spread(base)
          : values.month !== undefined
            ? typeMonth(base, month, values.value == null ? 0 : Number(values.value))
            : values.b !== undefined
              ? {
                  annual: Math.round(numericMonths(values.b).reduce((a, b) => a + b, 0) * 100) / 100,
                  b: numericMonths(values.b),
                  bm: Array.from({ length: 12 }, () => true),
                }
              : values.annual !== undefined
                ? changeAnnual(base, Number(values.annual))
                : base
    const postedBudget = Object.entries(values).filter(([field]) => /^b(?:[0-9]|1[01])$/.test(field))
    const explicit = marker && marker.ok ? marker.marks : undefined
    const chosen = postedBudget.filter(([field]) => {
      if (explicit === undefined) return true
      return explicit.includes(Number(field.slice(1)))
    })
    const edited = chosen.reduce(
      (line, [field, value]) =>
        typeMonth(line, Number(field.slice(1)), value === "" || value === null ? 0 : Number(value)),
      plan,
    )
    if (!stored || command.action !== "save" || values.month !== undefined || values.b !== undefined || values.annual !== undefined || chosen.length)
      Object.assign(next, edited)
    if (!stored || values.a !== undefined || Object.keys(values).some((field) => /^a(?:[0-9]|1[01])$/.test(field)))
      next.a = months(next.a, true)
    if (!stored || values.f !== undefined || Object.keys(values).some((field) => /^f(?:[0-9]|1[01])$/.test(field)))
      next.f = months(next.f, true)
  }
  if (collection === "lines" || synthetic)
    for (const field of ["a", "f"])
      if (
        values[field] !== undefined &&
        (!Array.isArray(values[field]) ||
          values[field].length !== 12 ||
          values[field].some((value) => value !== null && (typeof value !== "number" || !Number.isFinite(value))))
      )
        return invalid("Actual and forecast require twelve numbers or nulls")
  if (collection === "projects") {
    next.name = text(next.name).trim()
    if (!next.name) return invalid("Project name is required")
    next.code = text(values.code).trim() || text(stored?.code)
    if (!next.code && (!stored || values.code !== undefined)) {
      const sequence = nextCpx(
        version.year,
        finite(snapshot.sequences.cpx),
        versions.flatMap((version) => version.projects.map((project) => text(project.code))),
      )
      next.code = sequence.code
      snapshot.sequences.cpx = sequence.counter
    }
    if (records.some((row) => row.id !== id && normName(text(row.code)) === normName(text(next.code))))
      return invalid("Duplicate project code")
    const match = text(next.code).match(/^CPX-\d{4}-(\d+)$/i)
    if (match && (!stored || values.code !== undefined)) snapshot.sequences.cpx = Math.max(finite(snapshot.sequences.cpx), Number(match[1]))
  }
  if (collection === "positions") {
    next.name = text(next.name).trim()
    if (!next.name) return invalid("Position name is required")
    next.fte = clampFte(next.fte == null ? null : Number(next.fte))
    const span = orderSpan(Number(next.start ?? 1), Number(next.end ?? 12))
    if (!Number.isInteger(span.start) || !Number.isInteger(span.end) || span.start < 1 || span.end > 12)
      return invalid("Invalid position months")
    Object.assign(next, span)
    next.include = next.include !== false && next.include !== "false"
    next.type = text(next.type) || "Employee"
    next.src = text(stored?.src) || "new"
    if (values.domain !== undefined) next.domainManual = true
    if (next.rateId && !version.hc.rates.some((rate) => rate.id === next.rateId)) return invalid("Unknown rate card")
    if (
      next.rateOverride != null &&
      next.rateOverride !== "" &&
      (!Number.isFinite(Number(next.rateOverride)) || Number(next.rateOverride) < 0)
    )
      return invalid("Invalid rate override")
  }
  if (collection === "rates") {
    next.annual = Number(next.annual)
    if (!text(next.name).trim() || !Number.isFinite(next.annual) || Number(next.annual) < 0)
      return invalid("Invalid rate card")
    next.cur = text(next.cur) || "USD"
  }
  if (collection === "fx") {
    next.cur = text(next.cur).trim().toUpperCase()
    if (!/^[A-Z]{3}$/.test(text(next.cur)) || next.cur === "USD")
      return invalid("USD is fixed at 1; use a three letter code")
    if (records.some((row) => row.id !== id && row.cur === next.cur)) return invalid("Duplicate currency")
    const token = String(next.rate ?? "").trim()
    next.rate = token === "" ? null : Number(/^\d+,\d+$/.test(token) ? token.replace(",", ".") : token)
    if (next.rate !== null && (!Number.isFinite(next.rate) || Number(next.rate) <= 0))
      return invalid("Rate must be positive")
    if (next.rate !== null) next.rate = Math.round(Number(next.rate) * 1e6) / 1e6
  }
  if (
    ((collection === "lines" && !synthetic) || collection === "rates") &&
    next.cur !== "USD" &&
    !version.fx.some((rate) => rate.cur === next.cur)
  )
    return invalid("Unknown currency")
  if (stored && command.action === "save") {
    const normalized =
      collection === "lines" && !synthetic
        ? ["sec", "el", "cur", "cls"]
        : collection === "projects"
          ? ["name", "code"]
          : collection === "positions"
            ? ["name", "fte", "start", "end", "include", "type", "src"]
            : collection === "rates"
              ? ["annual", "cur"]
              : collection === "fx"
                ? ["cur", "rate"]
                : []
    for (const field of normalized.filter((field) => !Object.hasOwn(values, field))) {
      if (Object.hasOwn(stored, field)) next[field] = stored[field]
      else delete next[field]
    }
  }
  if (synthetic) version.hc.hrAF[id.slice(3)] = next
  else if (stored) records.splice(records.indexOf(stored), 1, next)
  else records.push(next)
  persist()
  write(key, stored, next)
  if (collection === "positions") write(`${version.id}:positions:sync`, undefined, version.hc.positions)
  return { ok: true, value: id, warnings }
}
function renderPage(page: string, data: Record<string, unknown>, context: RenderContext): string | undefined {
  if (!pages.includes(page as (typeof pages)[number])) return undefined
  // Defense in depth for callers that render an unfiltered snapshot.
  const normalized = plannerData(data).data
  const enriched = {
    ...normalized,
    versions: rows(normalized.versions).map((row) => {
      const version = versionOf(row)
      const computed = row.summary ? object(row.summary) : calculated(version)
      return { ...row, summary: computed, hr: row.hr ?? computed.hr }
    }),
  }
  const safe: Row = privateAccess(context.actor) ? enriched : object(redact(enriched))
  const versions = rows(safe.versions).map(versionOf)
  const version =
    versions.find((version) => version.id === idOf(safe.version ?? safe.versionId)) ||
    versions.find((version) => version.year === context.year) ||
    versions[0]
  const canWrite =
    context.actor.canWrite &&
    context.actor.roles.some((role) => ["admin", "finance", "hr", "budget owner"].includes(role))
  const revision = (key: string) => context.versions[key]?.version ?? 0
  const versionField = version ? `<input type="hidden" name="versionId" value="${esc(version.id)}">` : ""
  const controls = (
    action: string,
    id: string,
    collection: string,
    body: string,
    label = "Save",
    key?: string,
    disabled = false,
  ) =>
    form(
      page,
      action,
      id,
      revision(key || `${version?.id}:${collection}:${id}`),
      versionField + `<input type="hidden" name="collection" value="${esc(collection)}">` + body,
      label,
      !canWrite || disabled,
    )
  const heading = `<h2>${esc(page)}</h2>`
  if (page === "Versions")
    return (
      heading +
      table(
        ["Version", "Year", "State", "Actions"],
        versions.map((item) => [
          esc(item.name),
          String(item.year),
          idOf(object(safe.officials)[String(item.year)]) === item.id ? "Official" : item.locked ? "Locked" : "Draft",
          [
            form(
              page,
              "save",
              item.id,
              revision(`versions:${item.id}`),
              `<h3>Edit version</h3>` +
              fields([
                { name: "name", label: "Name", value: item.name },
                {
                  name: "year",
                  label: "Year",
                  type: "number",
                  value: item.year,
                  min: 2001,
                  max: 2099,
                  readonly: item.locked,
                },
              ]),
              "Save",
              !canWrite,
            ),
            ...(["copy", item.locked ? "unlock" : "lock", "official", "delete"] as const).map((action) =>
              form(
                page,
                action,
                item.id,
                revision(action === "official" ? `officials:${item.year}` : `versions:${item.id}`),
                "",
                action,
                !canWrite ||
                  (idOf(object(safe.officials)[String(item.year)]) === item.id &&
                    (action === "delete" || action === "unlock")),
              ),
            ),
          ].join(""),
        ]),
      ) +
      (!versions.length
        ? form(
            page,
            "save",
            "",
            revision("versions:first"),
            "<h3>Create first version</h3><p>Create the first fiscal plan.</p>",
            "Create first version",
            !canWrite,
          )
        : "")
    )
  if (page === "Entities & allocations")
    return (
      heading +
      ["entities", "allocations"]
        .map(
          (collection) =>
            `<h3>${esc(collection)}</h3>` +
            table(
              ["Name", "Details", "Actions"],
              rows(safe[collection]).map((row) => [
                esc(text(row.name)),
                esc(text(row.code) || text(row.desc)),
                controls(
                  "save",
                  text(row.id),
                  collection,
                  fields([
                    { name: "name", label: "Name", value: row.name },
                    {
                      name: collection === "entities" ? "code" : "desc",
                      label: "Details",
                      value: row.code ?? row.desc,
                    },
                  ]),
                  "Save",
                  `${collection}:${row.id}`,
                ) + controls("delete", text(row.id), collection, "", "Delete", `${collection}:${row.id}`),
              ]),
            ) +
            `<h3>${collection === "entities" ? "Add entity" : "Add allocation"}</h3>` +
            controls(
              "save",
              "",
              collection,
              fields([
                { name: "name", label: "Name", required: true },
                {
                  name: collection === "entities" ? "code" : "desc",
                  label: "Details",
                },
              ]),
              "Add",
              `${collection}:`,
            ) +
            (collection === "allocations"
              ? controls("common", "", collection, "", "Add common keys", "allocations:common")
              : ""),
        )
        .join("")
    )
  if (!version) return heading + metric("Plan", "No version. An admin can create the first plan in Versions.")
  const summary = object(rows(safe.versions).find((row) => row.id === version.id)?.summary)
  const warningCodes = Array.isArray(summary.warnings)
    ? summary.warnings.map((value) => text(value)).filter(Boolean)
    : []
  const selector = `${warningCodes.length ? `<p role="status">Missing FX rate: ${warningCodes.map(esc).join(", ")}</p>` : ""}<form method="get" class="filter-bar"><input type="hidden" name="page" value="${esc(page)}"><label>Plan <select name="version">${versions.map((item) => `<option value="${esc(item.id)}"${item.id === version.id ? " selected" : ""}>${esc(item.name)}</option>`).join("")}</select></label><button type="submit">Open plan</button></form><a href="?download=xlsx&amp;version=${esc(version.id)}">Export Excel</a>${workbookForm(page, version, context)}`
  if (page === "Overview")
    return (
      heading +
      selector +
      metricGrid([
        metric("Total budget OPEX + CAPEX USD", money(summary.total)),
        metric("Actual YTD", money(summary.actualYTD)),
        metric("Full-year outlook", money(summary.fullYear)),
        metric("HR Staff", money(summary.hrTotal)),
      ]) +
      monthlyChart(summary, version.closed) +
      `<form method="get" class="filter-bar"><input type="hidden" name="page" value="Overview"><input type="hidden" name="version" value="${esc(version.id)}"><label>Compare budget <select name="filter"><option value="">All budgets</option>${versions
        .filter((item) => item.id !== version.id)
        .map((item) => `<option value="${esc(item.id)}">${esc(item.name)}</option>`)
        .join("")}</select></label><button type="submit">Compare budgets</button></form>` +
      table(
        ["Month", "Budget USD", "Actual USD", "Outlook USD"],
        zeroMonths().map((_, i) => [
          String(i + 1),
          money(numericMonths(summary.budget)[i]),
          i >= version.closed && numericMonths(summary.actual)[i] === 0 ? "–" : money(numericMonths(summary.actual)[i]),
          money(numericMonths(summary.outlook)[i]),
        ]),
      ) +
      table(
        ["Cost element", "Budget USD"],
        OPEX_ELEMENTS.map((el) => [
          esc(el),
          money(
            rows(summary.lines)
              .filter((line) => line.el === el)
              .reduce((sum, line) => sum + finite(line.total), 0),
          ),
        ]),
      ) +
      table(
        ["Version", "Budget USD", "FTE December"],
        rows(safe.versions)
          .filter((item) => !safe.filter || idOf(item.id) === version.id || idOf(item.id) === idOf(safe.filter))
          .map((item) => [
            esc(text(item.name)),
            money(object(item.summary).total),
            String(finite(object(item.summary).fte)),
          ]),
      )
    )
  if (page === "FX rates")
    return (
      heading +
      selector +
      metric("USD", "1 (fixed)") +
      table(
        ["Code", "Rate", "Actions"],
        version.fx.map((rate) => [
          esc(text(rate.cur)),
          esc(String(rate.rate ?? "No rate")),
          controls(
            "save",
            text(rate.id),
            "fx",
            fields([
              { name: "cur", label: "Code", value: rate.cur },
              { name: "rate", label: "Rate", value: rate.rate },
            ]),
            "Save",
            undefined,
            version.locked,
          ) + controls("delete", text(rate.id), "fx", "", "Delete", undefined, version.locked),
        ]),
      ) +
      `<h3>Add currency</h3>` +
      controls(
        "save",
        "",
        "fx",
        fields([
          { name: "cur", label: "Currency", required: true },
          { name: "rate", label: "Rate", value: "" },
        ]),
        "Add currency",
        undefined,
        version.locked,
      ) +
      rows(summary.warnings)
        .map((row) => esc(text(row.code)))
        .join("")
    )
  if (page === "Headcount") return renderHeadcount(version, safe, summary, context, heading, selector, controls)
  const sec = page === "OPEX" ? "opex" : "capex"
  const lineRows = [
    ...version.lines.filter((line) => line.sec === sec),
    ...(sec === "opex"
      ? rows(safe.versions).find((row) => row.id === version.id)
        ? rows(rows(safe.versions).find((row) => row.id === version.id)?.hr)
        : []
      : []),
  ].filter((line) => {
    const owner =
      idOf(object(line.owner).id) ||
      idOf(line.owner) ||
      idOf(object(version.projects.find((project) => project.id === line.proj)?.owner).id) ||
      idOf(version.projects.find((project) => project.id === line.proj)?.owner)
    return (
      (!safe.owner || owner === idOf(safe.owner)) &&
      (!safe.class || text(line.cls) === text(safe.class)) &&
      (!safe.q || normName(`${text(line.name)} ${text(line.desc)}`).includes(normName(text(safe.q))))
    )
  })
  const lineEditor = (line: Row) => {
    const id = text(line.id)
    const synthetic = id.startsWith("HR:")
    return controls(
      "save",
      id,
      "lines",
      fields(
        [
          ...(synthetic ? [] : [{ name: "name", label: "Name", value: line.name }]),
          {
            name: "owner",
            label: "Owner",
            type: "select" as const,
            value: text(object(line.owner).id) || text(line.owner),
            options: ["", ...rows(safe.directory).map((person) => text(person.id))],
          },
          {
            name: "entity",
            label: "Entity",
            type: "select" as const,
            value: line.entity,
            options: ["", ...rows(safe.entities).map((row) => text(row.id))],
          },
          {
            name: "alloc",
            label: "Allocation",
            type: "select" as const,
            value: line.alloc,
            options: ["", ...rows(safe.allocations).map((row) => text(row.id))],
          },
          ...(synthetic
            ? []
            : [
                {
                  name: "el",
                  label: "Element",
                  type: "select" as const,
                  value: line.el,
                  options: OPEX_ELEMENTS.filter((el) => (sec === "capex" ? el !== "depr" : el !== "hr")),
                },
                {
                  name: "cur",
                  label: "Currency",
                  type: "select" as const,
                  value: line.cur || "USD",
                  options: ["USD", ...version.fx.map((rate) => text(rate.cur))],
                },
                {
                  name: "annual",
                  label: "Annual budget",
                  type: "number" as const,
                  value: line.annual ?? 0,
                },
                ...(sec === "capex"
                  ? [
                      {
                        name: "proj",
                        label: "Project",
                        type: "select" as const,
                        value: line.proj,
                        options: version.projects.map((project) => text(project.id)),
                      },
                      {
                        name: "cls",
                        label: "Classification",
                        type: "select" as const,
                        value: line.cls || "capex",
                        options: ["capex", "opex"],
                      },
                    ]
                  : []),
              ]),
        ].filter((field) => !version.locked || ["name", "owner", "desc"].includes(field.name)),
      ),
      "Save",
      synthetic ? `${version.id}:hrAF:${id}` : undefined,
    )
  }
  return (
    heading +
    selector +
    (sec === "opex"
      ? `<details class="editor-panel"><summary>Cost element settings</summary><div class="compact-forms">` +
        OPEX_ELEMENTS.filter((el) => el !== "hr")
          .map((el) =>
            form(
              page,
              "save",
              "",
              revision(`${version.id}:lists:${el}`),
              versionField +
                fields([
                  { name: "el", label: "Element", value: el },
                  {
                    name: "split",
                    label: "Mode",
                    type: "select",
                    value: String(
                      object(version.lists[el]).split ?? ["licenses", "services", "hwo", "te"].includes(el),
                    ),
                    options: ["true", "false"],
                  },
                ]),
              "Set breakdown",
              !canWrite || version.locked,
            ),
          )
          .join("") +
        "</div></details>"
      : "") +
    (sec === "opex"
      ? form(
          page,
          "save",
          "",
          revision(`${version.id}:closed`),
          versionField +
            fields([
              {
                name: "closed",
                label: "Actuals closed through (0 = none)",
                type: "number",
                value: version.closed,
                min: 0,
                max: 12,
              },
            ]),
          "Save closed month",
          !canWrite,
        ).replace("<form ", '<form class="filter-bar" ')
      : `<form method="get"><input type="hidden" name="page" value="${esc(page)}"><input type="hidden" name="version" value="${esc(version.id)}"><label>Owner <select name="owner"><option value="">All</option>${rows(
          safe.directory,
        )
          .map(
            (person) =>
              `<option value="${esc(idOf(person.id))}"${idOf(person.id) === idOf(safe.owner) ? " selected" : ""}>${esc(text(person.name))}</option>`,
          )
          .join(
            "",
          )}</select></label><label>Classification <select name="class"><option value="">All</option><option${safe.class === "capex" ? " selected" : ""}>capex</option><option${safe.class === "opex" ? " selected" : ""}>opex</option></select></label><label>Search <input name="q" value="${esc(text(safe.q))}"></label><button type="submit">Filter</button></form>` +
        table(
          ["Project", "Code", "Owner", "Actions"],
          version.projects.map((project) => [
            esc(text(project.name)),
            esc(text(project.code)),
            esc(text(object(project.owner).name) || text(project.owner)),
            controls(
              "save",
              text(project.id),
              "projects",
              fields([
                { name: "name", label: "Project", value: project.name },
                { name: "code", label: "Code", value: project.code, readonly: version.locked },
                {
                  name: "owner",
                  label: "Owner",
                  type: "select",
                  value: object(project.owner).id,
                  options: ["", ...rows(safe.directory).map((person) => text(person.id))],
                },
              ]),
            ) + controls("delete", text(project.id), "projects", "", "Delete"),
          ]),
        ) +
        controls(
          "save",
          "",
          "projects",
          fields([{ name: "name", label: "Project name", required: true }]),
          "Add project",
        )) +
    `<form method="get" class="filter-bar"><input type="hidden" name="page" value="${esc(page)}"><input type="hidden" name="version" value="${esc(version.id)}"><label>Grid <select name="mode">${["budget", "actual", "forecast", "compare"].map((mode) => `<option${safe.mode === mode ? " selected" : ""}>${mode}</option>`).join("")}</select></label><button type="submit">Show grid</button></form>` +
    table(
      (safe.mode === "compare"
        ? ["Element", "Line", "Budget FY", "Budget YTD", "Actual YTD", "YTD var", "Outlook FY", "FY var", "Var%", "Actions"]
        : ["Element", "Line", "Budget", "Actual", "Forecast", "Compare", "Actions"]
      ).filter(
        (_, index) =>
          safe.mode === "compare" ||
          !safe.mode ||
          index < 2 ||
          index === 6 ||
          index === ({ budget: 2, actual: 3, forecast: 4, compare: 5 } as Record<string, number>)[text(safe.mode)],
      ),
      lineRows.map((line) => {
        const computed = rows(summary.lines).find((row) => row.id === line.id)
        const budgetFY = finite(computed?.total)
        const budgetYTD = ytd(numericMonths(computed?.budget), version.closed)
        const actualYTD = ytd(numericMonths(computed?.actual), version.closed)
        const outlookFY = numericMonths(computed?.outlook).reduce((sum, value) => sum + value, 0)
        const ytdVariance = actualYTD - budgetYTD
        const fyVariance = outlookFY - budgetFY
        const delta = variance(
          outlookFY,
          budgetFY,
        )
        const id = text(line.id)
        const key = `${version.id}:${id.startsWith("HR:") ? "hrAF" : "lines"}:${id}`
        const actions = lineEditor(line) +
          (id.startsWith("HR:")
            ? ""
            : controls("spread", id, "lines", "", "Spread") +
              controls("reset", id, "lines", "", "Reset spread") +
              controls("delete", id, "lines", "", "Delete"))
        if (safe.mode === "compare")
          return [
            esc(text(line.el)),
            esc(text(line.name)),
            money(budgetFY),
            money(budgetYTD),
            money(actualYTD),
            money(ytdVariance),
            money(outlookFY),
            money(fyVariance),
            budgetFY === 0 ? "–" : `${((fyVariance / budgetFY) * 100).toFixed(2)}%`,
            actions,
          ]
        return [
          esc(text(line.el)),
          esc(text(line.name)),
          id.startsWith("HR:")
            ? money(line.annual)
            : controls(
                "save",
                id,
                "lines",
                fields(
                  zeroMonths().map((_, i) => ({
                    name: `b${i}`,
                    label: `Budget ${i + 1}`,
                    type: "number" as const,
                    value: numericMonths(line.b)[i],
                  })),
                ) + `<input type="hidden" name="budgetEdited" value="[]">`,
                "Save budget",
                key,
              ),
          ...(["a", "f"] as const).map((field) =>
            controls(
              "save",
              id,
              "lines",
              fields(
                zeroMonths().map((_, i) => ({
                  name: `${field}${i}`,
                  label: `${field === "a" ? "Actual" : "Forecast"} ${i + 1}`,
                  type: "number" as const,
                  value: months(line[field], true)[i],
                })),
              ),
              "Save",
              key,
            ),
          ),
          `<span${delta.over ? ' class="over"' : ""}>${esc(String(delta.shown))}</span>`,
          actions,
        ].filter(
          (_, index) =>
            !safe.mode ||
            index < 2 ||
            index === 6 ||
            index === ({ budget: 2, actual: 3, forecast: 4, compare: 5 } as Record<string, number>)[text(safe.mode)],
        )
      }),
    ) +
    `<h3>Add budget line</h3>` +
    lineEditor({})
  )
}

function executeVersions(
  snapshot: Snapshot,
  actor: Actor,
  command: Command,
  environment: Environment,
  versions: Version[],
): Result {
  const values = command.values
  const admin = actor.roles.includes("admin")
  const reject: Result = { ok: false, status: 403 }
  const invalid = (message: string): Result => ({
    ok: false,
    status: 422,
    errors: [message],
  })
  const write = (key: string, was: unknown, became: unknown) =>
    changed(snapshot, key, actor, environment.at, was, became)
  const persist = () => {
    snapshot.data.versions = versions
  }
  if (!admin) return reject
  const version = versions.find((item) => item.id === command.id)
  if (!version) {
    if (command.action !== "save" || command.id || versions.length) return { ok: false, status: 400 }
    const key = "versions:first"
    const stale = conflict(snapshot, key, command, undefined)
    if (stale) return stale
    const year = Number(environment.at.slice(0, 4)) + 1
    const first = versionOf({
      id: environment.id(),
      name: `FY${year} — Draft 1`,
      year,
      locked: false,
      closed: 0,
      hc: { inc: 0, incMonth: 1 },
      lists: {},
    })
    versions.push(first)
    snapshot.data.officials = object(snapshot.data.officials)
    snapshot.data.entities = rows(snapshot.data.entities)
    snapshot.data.allocations = rows(snapshot.data.allocations)
    snapshot.data.roster = rows(snapshot.data.roster)
    persist()
    write(key, undefined, first)
    write(`versions:${first.id}`, undefined, first)
    return { ok: true, value: first.id }
  }
  const key = command.action === "official" ? `officials:${version.year}` : `versions:${version.id}`
  const stale = conflict(
    snapshot,
    key,
    command,
    command.action === "official" ? object(snapshot.data.officials)[String(version.year)] : version,
  )
  if (stale) return stale
  const was = structuredClone(version)
  const officials = object(snapshot.data.officials)
  if (command.action === "official") {
    const previous = officials[String(version.year)]
    version.locked = true
    officials[String(version.year)] = version.id
    snapshot.data.officials = officials
    persist()
    write(key, previous, version.id)
    write(`versions:${version.id}`, was, version)
    return { ok: true }
  }
  if (command.action === "unlock" || command.action === "delete") {
    if (idOf(officials[String(version.year)]) === version.id) return reject
  }
  if (command.action === "copy") {
    const copy = structuredClone(version)
    copy.id = environment.id()
    copy.name = text(values.name) || `${version.name} — Copy`
    copy.locked = false
    if (versions.some((item) => item.id === copy.id)) return invalid("Duplicate version id")
    versions.push(copy)
    persist()
    write(`versions:${copy.id}`, undefined, copy)
    return { ok: true, value: copy.id }
  }
  if (command.action === "delete") versions.splice(versions.indexOf(version), 1)
  else if (command.action === "lock") version.locked = true
  else if (command.action === "unlock") version.locked = false
  else if (command.action === "save") {
    if (values.year !== undefined) {
      const year = Number(values.year)
      if (version.locked) return reject
      if (!Number.isInteger(year) || year <= 2000 || year >= 2100) return invalid("Invalid fiscal year")
      version.year = year
    }
    if (text(values.name).trim()) version.name = text(values.name).trim()
    if (Object.keys(values).some((key) => !["name", "year"].includes(key))) return invalid("Unknown version field")
  } else return { ok: false, status: 400 }
  persist()
  write(key, was, command.action === "delete" ? undefined : version)
  return { ok: true }
}

function executeLists(
  snapshot: Snapshot,
  actor: Actor,
  command: Command,
  environment: Environment,
  versions: Version[],
): Result {
  const values = command.values
  const admin = actor.roles.includes("admin")
  const reject: Result = { ok: false, status: 403 }
  const invalid = (message: string): Result => ({
    ok: false,
    status: 422,
    errors: [message],
  })
  const write = (key: string, was: unknown, became: unknown) =>
    changed(snapshot, key, actor, environment.at, was, became)
  const persist = () => {
    snapshot.data.versions = versions
  }
  if (!admin) return reject
  const collection = text(values.collection)
  if (!["entities", "allocations"].includes(collection)) return invalid("Choose entities or allocations")
  const records = rows(snapshot.data[collection]).map(identified)
  if (command.action === "common") {
    if (collection !== "allocations") return invalid("Common keys are allocations")
    const stale = conflict(snapshot, "allocations:common", command, records)
    if (stale) return stale
    const was = structuredClone(records)
    for (const name of ["Direct", "By headcount", "By IT users", "By revenue", "Equal split", "Group shared service"])
      if (!records.some((row) => normName(text(row.name)) === normName(name))) {
        const row = { id: environment.id(), name, desc: "" }
        records.push(row)
        write(`allocations:${row.id}`, undefined, row)
      }
    snapshot.data[collection] = records
    write("allocations:common", was, records)
    return { ok: true }
  }
  if (!["save", "delete"].includes(command.action)) return { ok: false, status: 400 }
  const id = command.id || environment.id()
  const stored = records.find((row) => row.id === id)
  const key = `${collection}:${id}`
  const stale = conflict(snapshot, key, command, stored)
  if (stale) return stale
  if (command.action === "delete") {
    if (!stored) return { ok: false, status: 404 }
    const field = collection === "entities" ? "entity" : "alloc"
    if (
      versions.some((version) =>
        [...version.lines, ...Object.values(version.hc.hrAF).map(object)].some((line) => line[field] === id),
      )
    )
      return invalid("Record is in use")
    snapshot.data[collection] = records.filter((row) => row.id !== id)
    write(key, stored, undefined)
    return { ok: true }
  }
  const name = text(values.name).trim() || text(stored?.name)
  if (!name || records.some((row) => row.id !== id && normName(text(row.name)) === normName(name)))
    return invalid("Empty or duplicate name")
  const next = {
    ...stored,
    id,
    name,
    ...(collection === "entities"
      ? { code: text(values.code ?? stored?.code) }
      : { desc: text(values.desc ?? stored?.desc) }),
  }
  snapshot.data[collection] = [...records.filter((row) => row.id !== id), next]
  write(key, stored, next)
  return { ok: true, value: id }
}

type Controls = (
  action: string,
  id: string,
  collection: string,
  body: string,
  label?: string,
  key?: string,
  disabled?: boolean,
) => string
function money(value: unknown) {
  return finite(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  })
}
function renderHeadcount(
  version: Version,
  safe: Row,
  summary: Row,
  context: RenderContext,
  heading: string,
  selector: string,
  controls: Controls,
): string {
  const salary = privateAccess(context.actor)
  const mapping = salary
    ? table(
        ["Roster leader", "Domain"],
        [
          ...new Set(
            rows(safe.roster)
              .map((row) => text(row.leader))
              .filter(Boolean),
          ),
        ].map((leader) => [
          esc(leader),
          controls(
            "save",
            "",
            "leaderDomains",
            fields([
              { name: "leader", label: "Leader", value: leader },
              {
                name: "domain",
                label: "Domain",
                value: object(version.hc.leaderDomains)[leader],
              },
            ]),
            "Save mapping",
            `${version.id}:leaderDomains`,
          ),
        ]),
      )
    : ""
  return (
    heading +
    selector +
    mapping +
    metricGrid([
      metric("Positions in plan", String(version.hc.positions.filter((position) => position.include).length)),
      metric("FTE December", String(finite(summary.fte))),
      metric("HR Staff budget USD", money(summary.hrTotal)),
      metric("Average cost per FTE", money(finite(summary.fte) ? finite(summary.hrTotal) / finite(summary.fte) : 0)),
    ]) +
    (version.hc.exampleRates === true || version.hc.ratesAreExamples === true ? "<p>Example rates</p>" : "") +
    table(
      ["Domain", "Budget USD"],
      rows(summary.hr).map((row) => [esc(text(row.domain)), money(row.annual)]),
    ) +
    (salary
      ? `<h3>Rate cards</h3>` +
        table(
          ["Name", "Currency", "Annual", "Actions"],
          version.hc.rates.map((rate) => [
            esc(text(rate.name)),
            esc(text(rate.cur)),
            esc(String(rate.annual)),
            controls(
              "save",
              text(rate.id),
              "rates",
              fields([
                { name: "name", label: "Name", value: rate.name },
                { name: "locs", label: "Locations", value: rate.locs },
                { name: "cur", label: "Currency", value: rate.cur },
                {
                  name: "annual",
                  label: "Annual",
                  type: "number",
                  value: rate.annual,
                },
              ]),
            ) + controls("delete", text(rate.id), "rates", "", "Delete"),
          ]),
        ) +
        `<h3>Add rate card</h3>` +
        controls(
          "save",
          "",
          "rates",
          fields([
            { name: "name", label: "Name", required: true },
            { name: "locs", label: "Locations" },
            { name: "cur", label: "Currency", value: "USD" },
            { name: "annual", label: "Annual", type: "number", value: 0 },
          ]),
          "Add rate card",
        ) +
        `<h3>Salary increase</h3>` +
        controls(
          "save",
          "",
          "increase",
          fields([
            {
              name: "inc",
              label: "Increase %",
              type: "number",
              value: version.hc.inc,
            },
            {
              name: "incMonth",
              label: "Effective month",
              type: "number",
              value: version.hc.incMonth,
              min: 1,
              max: 12,
            },
          ]),
          "Save increase",
          `${version.id}:increase`,
        )
      : "") +
    table(
      ["Position", "Domain", "Status", ...(salary ? ["FY cost USD", "Actions"] : [])],
      version.hc.positions.map((position) => [
        esc(text(position.name)),
        esc(text(position.domain)),
        position.include !== true
          ? "Excluded"
          : position.left
            ? "Not in roster"
            : position.hasRate === false
              ? "No rate"
              : position.src === "new"
                ? "New hire"
                : "In roster",
        ...(salary
          ? [
              money(numericMonths(position.months).reduce((a, b) => a + b, 0)),
              controls(
                "save",
                text(position.id),
                "positions",
                fields([
                  { name: "name", label: "Name", value: position.name },
                  {
                    name: "include",
                    label: "Include",
                    type: "checkbox",
                    value: position.include,
                  },
                  {
                    name: "fte",
                    label: "FTE",
                    type: "number",
                    value: position.fte,
                    min: 0,
                    max: 2,
                    step: "0.01",
                  },
                  {
                    name: "start",
                    label: "Start",
                    type: "number",
                    value: position.start,
                    min: 1,
                    max: 12,
                  },
                  {
                    name: "end",
                    label: "End",
                    type: "number",
                    value: position.end,
                    min: 1,
                    max: 12,
                  },
                  { name: "domain", label: "Domain", value: position.domain },
                  {
                    name: "type",
                    label: "Type",
                    type: "select",
                    value: position.type,
                    options: ["Employee", "Contractor"],
                  },
                  {
                    name: "location",
                    label: "Location",
                    value: position.location,
                  },
                  {
                    name: "rateId",
                    label: "Rate card",
                    type: "select",
                    value: position.rateId,
                    options: ["", ...version.hc.rates.map((rate) => text(rate.id))],
                  },
                  {
                    name: "rateOverride",
                    label: "Rate override",
                    type: "number",
                    value: position.rateOverride,
                  },
                ]),
              ) + controls("delete", text(position.id), "positions", "", "Delete"),
            ]
          : []),
      ]),
    ) +
    (salary
      ? `<h3>Add new hire</h3>` +
        controls(
          "save",
          "",
          "positions",
          fields([
            { name: "name", label: "New hire", required: true },
            { name: "domain", label: "Domain" },
            { name: "fte", label: "FTE", type: "number", value: 1 },
            { name: "start", label: "Start", type: "number", value: 1 },
            { name: "end", label: "End", type: "number", value: 12 },
          ]),
          "Add new hire",
        ) + controls("sync", "", "positions", "", "Sync roster", `${version.id}:positions:sync`)
      : "")
  )
}

function monthlyChart(summary: Row, closed: number): string {
  const series = [
    { key: "budget", name: "Budget", color: "#245ca6" },
    { key: "actual", name: "Actual", color: "#b54a22" },
    { key: "outlook", name: "Outlook", color: "#227b48" },
  ].map((line) => ({ ...line, values: Array.from({ length: 12 }, (_, index) => {
    const months = summary[line.key]
    const value: unknown = Array.isArray(months) ? months[index] : null
    if (typeof value !== "number" || !Number.isFinite(value)) return null
    // Keep the original closed-month policy without turning absent months into zero.
    return line.key === "actual" && index >= closed && value === 0 ? null : value
  }) }))
  const values = series.flatMap((line) => line.values.filter((value) => value !== null))
  const low = Math.min(0, ...values)
  const high = Math.max(1, ...values)
  const y = (value: number) => 180 - ((value - low) / (high - low)) * 150
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  return `<figure><figcaption>Monthly Budget, Actual, Outlook (USD)</figcaption><ul class="chart-legend">${series.map((line) => `<li><span aria-hidden="true" style="background:${line.color}"></span>${line.name}</li>`).join("")}</ul>${values.length ? `<svg viewBox="0 0 720 230" role="img" aria-label="Monthly Budget, Actual, Outlook in USD"><title>Monthly Budget, Actual, Outlook in USD</title><g class="chart-axis">${[...new Set([low, 0, high / 2, high])].map((value) => `<line x1="100" x2="705" y1="${y(value)}" y2="${y(value)}" stroke="#cbd5e1"/><text x="95" y="${y(value) + 4}" text-anchor="end" font-size="11">${esc(money(value))}</text>`).join("")}${months.map((month, index) => `<text x="${115 + index * 52}" y="202" text-anchor="middle" font-size="12">${month}</text>`).join("")}<text x="100" y="16" font-size="12">USD</text><text x="400" y="224" text-anchor="middle" font-size="12">Month</text></g>${series.map((line) => line.values.map((value, index) => value === null ? "" : `<circle cx="${115 + index * 52}" cy="${y(value)}" r="4" fill="${line.color}"><title>${line.name} ${index + 1}: ${esc(money(value))}</title></circle>`).join("")).join("")}</svg>` : '<p class="chart-empty">No data available for this chart.</p>'}</figure>`
}

export function render(page: string, data: Record<string, unknown>, context: RenderContext): string | undefined {
  const html = renderPage(page, data, context)
  if (html === undefined) return undefined
  const normalized = plannerData(data).data
  const versions = rows(normalized.versions).map(versionOf)
  const lookups: Record<string, Row[]> = {
    owner: rows(data.directory),
    entity: rows(normalized.entities),
    alloc: rows(normalized.allocations),
    proj: versions.flatMap((version) => version.projects),
    rateId: privateAccess(context.actor) ? versions.flatMap((version) => version.hc.rates) : [],
    versionId: versions,
  }
  return html.replace(
    /<select name="([^"]+)"([^>]*)>([\s\S]*?)<\/select>/g,
    (_whole: string, name: string, attrs: string, options: string) => {
      const labels = lookups[name]
      return `<select name="${name}"${attrs}>${options.replace(
        /<option value="([^"]*)"([^>]*)>([\s\S]*?)<\/option>/g,
        (_option: string, value: string, extra: string, label: string) => {
          const row = labels?.find((row) => esc(idOf(row.id)) === value)
          const display = row
            ? esc(text(row.name))
            : name === "split"
              ? value === "true"
                ? "Breakdown"
                : "Total only"
              : label
          return `<option value="${value}"${extra}>${display || "—"}</option>`
        },
      )}</select>`
    },
  )
}

const workbookMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const workbookElements = [
  "Licenses",
  "Services",
  "Hardware",
  "Depreciation",
  "HR Staff",
  "Facilities",
  "Travel & Expenses",
  "Others",
]
type ImportIssue = { result?: Result; warnings: string[] }
function workbookNumber(value: unknown, empty: number | null): number | null | undefined {
  if (value == null || value === "") return empty
  if (typeof value !== "number" && typeof value !== "string") return undefined
  const token = typeof value === "string" ? value.trim() : value
  if (token === "") return empty
  const parsed =
    typeof token === "string" && /^[-+]?\d+,\d+$/.test(token) ? Number(token.replace(",", ".")) : Number(token)
  return Number.isFinite(parsed) ? parsed : undefined
}
function workbookSpan(value: unknown, fallback: number): number | undefined {
  if (value == null || value === "") return fallback
  const month =
    typeof value === "string"
      ? workbookMonths.findIndex((month) => normName(month) === normName(value).slice(0, 3))
      : -1
  if (month >= 0) return month + 1
  const number = workbookNumber(value, fallback)
  return number != null && Number.isInteger(number) && number >= 1 && number <= 12 ? number : undefined
}
function workbookOwner(value: unknown, current: unknown, environment: Environment, issue: ImportIssue): unknown {
  if (value == null) return current
  if (typeof value !== "string" && (typeof value !== "number" || !Number.isFinite(value))) {
    issue.result = {
      ok: false,
      status: 422,
      errors: ["Invalid directory or list reference"],
    }
    return current
  }
  const token = typeof value === "number" ? idOf(value) : text(value).trim()
  if (!token) return ""
  const owner = environment.directory.find(
    (person) => idOf(person.id) === token || normName(person.name) === normName(token),
  )
  if (owner) return { id: idOf(owner.id), name: owner.name }
  issue.warnings.push(`Unknown owner: ${token}`)
  return current
}
function workbookReference(
  value: unknown,
  current: unknown,
  records: Row[],
  label: string,
  issue: ImportIssue,
): unknown {
  if (value == null) return current
  if (typeof value !== "string" && (typeof value !== "number" || !Number.isFinite(value))) {
    issue.result = {
      ok: false,
      status: 422,
      errors: ["Invalid directory or list reference"],
    }
    return current
  }
  const token = typeof value === "number" ? idOf(value) : text(value).trim()
  if (!token) return ""
  const record = records.find(
    (row) =>
      idOf(row.id) === token ||
      normName(text(row.name)) === normName(token) ||
      (!!text(row.code) && normName(text(row.code)) === normName(token)),
  )
  if (record) return idOf(record.id)
  issue.warnings.push(`Unknown ${label}: ${token}`)
  return current
}
function workbookCurrency(value: unknown, current: unknown, version: Version, issue: ImportIssue): unknown {
  if (value == null || value === "") return current ?? "USD"
  if (typeof value !== "string") {
    issue.result = { ok: false, status: 422, errors: ["Invalid currency"] }
    return current ?? "USD"
  }
  const currency = text(value).trim().toUpperCase()
  if (currency === "USD" || version.fx.some((rate) => rate.cur === currency)) return currency
  issue.warnings.push(`Unknown currency: ${text(value)}`)
  return current ?? "USD"
}
function workbookRevision(
  snapshot: Snapshot,
  command: Command,
  key: string,
  stored: unknown,
  newVersion = false,
): Result | undefined {
  const token = object(command.values.versions)[key]
  const version = newVersion ? 0 : token === undefined ? 0 : typeof token === "number" ? token : object(token).version
  if (typeof version !== "number" || !Number.isInteger(version) || version < 0)
    return { ok: false, status: 422, errors: [`Invalid revision: ${key}`] }
  return conflict(snapshot, key, { ...command, version }, stored)
}
function importWorkbook(snapshot: Snapshot, actor: Actor, command: Command, environment: Environment): Result {
  const input = command.values
  if (
    Object.keys(input).some((key) => !["versionId", "sheets", "newVersion", "removeMissing", "versions"].includes(key))
  )
    return { ok: false, status: 422, errors: ["Unknown workbook option"] }
  if (
    (input.newVersion !== undefined && typeof input.newVersion !== "boolean") ||
    (input.removeMissing !== undefined && typeof input.removeMissing !== "boolean")
  )
    return { ok: false, status: 422, errors: ["Invalid workbook options"] }
  if (
    input.versions !== undefined &&
    (input.versions === null || typeof input.versions !== "object" || Array.isArray(input.versions))
  )
    return { ok: false, status: 422, errors: ["Invalid workbook revisions"] }
  const sheetObject = object(input.sheets)
  if (!input.sheets || Array.isArray(input.sheets) || !Object.keys(sheetObject).length)
    return { ok: false, status: 422, errors: ["Workbook sheets are required"] }
  const sheets: Record<string, Row[]> = {}
  let allMembers: Row[] | undefined
  let hasLeaderSummary = false
  for (const [name, value] of Object.entries(sheetObject)) {
    if (!Array.isArray(value) || value.some((row) => row === null || typeof row !== "object" || Array.isArray(row)))
      return { ok: false, status: 422, errors: [`Invalid sheet: ${name}`] }
    if (name === "All Members") {
      if (allMembers) return { ok: false, status: 422, errors: [`Invalid sheet: ${name}`] }
      allMembers = rows(value)
      continue
    }
    if (name === "Summary by Leader") {
      if (hasLeaderSummary) return { ok: false, status: 422, errors: [`Invalid sheet: ${name}`] }
      hasLeaderSummary = true
      continue
    }
    const canonical = ["Info", "OPEX", "CAPEX", "Headcount", "Rate cards", "FX rates"].find(
      (sheet) => normName(sheet) === normName(name),
    )
    if (!canonical || sheets[canonical]) return { ok: false, status: 422, errors: [`Invalid sheet: ${name}`] }
    sheets[canonical] = rows(value)
  }
  if (hasLeaderSummary && allMembers === undefined)
    return { ok: false, status: 422, errors: ["Invalid sheet: Summary by Leader"] }
  const membersWorkbook = allMembers !== undefined
  if (allMembers !== undefined) {
    if (sheets.Headcount) return { ok: false, status: 422, errors: ["Invalid sheet: All Members"] }
    sheets.Headcount = allMembers
  }
  const storedVersions = rows(snapshot.data.versions)
  const versions = storedVersions.map(versionOf)
  const source = versions.find((version) => version.id === idOf(input.versionId ?? command.id))
  if (!source) return { ok: false, status: 404 }
  // The source metadata token guards lock/copy; content uses independent per-record tokens below.
  const stale = conflict(snapshot, `versions:${source.id}`, command, source)
  if (stale) return stale
  const asNew = input.newVersion === true
  if (asNew && !actor.roles.includes("admin")) return { ok: false, status: 403 }
  const version = structuredClone(source)
  if (asNew) {
    version.id = environment.id()
    version.name = `${source.name} — Import`
    version.locked = false
    if (!version.id || versions.some((item) => item.id === version.id))
      return { ok: false, status: 422, errors: ["Duplicate version id"] }
  }
  const official = idOf(object(snapshot.data.officials)[String(version.year)])
  const can = (field: string, line?: Row) =>
    plannerField(
      field,
      version,
      asNew ? undefined : official,
      actor,
      line
        ? {
            ownerId: idOf(object(line.owner).id) || idOf(line.owner),
            domain: text(line.domain),
            hr: line.synthetic === true,
          }
        : undefined,
    )
  const budgetOK = can("budget")
  const issue: ImportIssue = { warnings: [] }
  const workbookVersion = idOf(sheets.Info?.find((row) => row.Field === "Version ID")?.Value)
  if (workbookVersion && workbookVersion !== source.id)
    issue.warnings.push(
      "Workbook was exported from another version; matching records are applied to the selected version",
    )
  const fail = (message: string) => {
    issue.result = { ok: false, status: 422, errors: [message] }
  }
  const before = structuredClone(version)
  const sequenceBefore = finite(snapshot.sequences.cpx)
  let sequence = sequenceBefore
  const allocate = (records: Row[]) => {
    const id = environment.id()
    if (!id || records.some((row) => idOf(row.id) === id)) fail("Duplicate generated record id")
    return id
  }
  readWorkbookRates(sheets, version, can, issue, allocate)
  if (issue.result) return issue.result
  const seen: {
    opex: Set<string>
    capex: Set<string>
    positions: Set<string>
  } = {
    opex: new Set(),
    capex: new Set(),
    positions: new Set(),
  }
  const businessRows = new Set<string>()
  for (const section of ["OPEX", "CAPEX"] as const)
    for (const row of sheets[section] ?? []) {
      const sec = section === "OPEX" ? "opex" : "capex"
      const rawMeasure = normName(text(row.Measure))
      const measure = rawMeasure.startsWith("budget")
        ? "b"
        : rawMeasure.startsWith("actual")
          ? "a"
          : rawMeasure.startsWith("forecast")
            ? "f"
            : undefined
      if (!measure) {
        fail(`${section}: Measure must be Budget, Actual or Forecast`)
        break
      }
      const suppliedId = idOf(row["Line ID"])
      const matchedId = version.lines.find((line) => suppliedId && line.id === suppliedId && line.sec === sec)
      const elementToken =
        text(row["Cost element"]) || text(matchedId?.el) || (suppliedId.startsWith("HR:") ? "hr" : "")
      const elementIndex = workbookElements.findIndex((name) => normName(name) === normName(elementToken))
      const el =
        elementIndex >= 0 ? OPEX_ELEMENTS[elementIndex] : OPEX_ELEMENTS.find((el) => el === normName(elementToken))
      const synthetic = suppliedId.startsWith("HR:") || (sec === "opex" && el === "hr")
      if (!el || (sec === "capex" && (el === "depr" || suppliedId.startsWith("HR:")))) {
        fail(`${section}: Invalid cost element`)
        break
      }
      const name = text(row["Vendor / item"]).trim()
      let project: Row | undefined
      if (sec === "capex") {
        const code = text(row["Project code"]).trim(),
          projectName = text(row.Project).trim()
        project =
          version.projects.find((project) => !!code && normName(text(project.code)) === normName(code)) ||
          version.projects.find((project) => !!projectName && normName(text(project.name)) === normName(projectName))
        const originalLine = version.lines.find((line) => suppliedId && line.id === suppliedId && line.sec === "capex")
        const originalProject = version.projects.find((project) => project.id === originalLine?.proj)
        if (originalProject && (!project || !can("structure"))) project = originalProject
        if (!project) {
          if (!can("structure")) {
            issue.warnings.push(`Unknown project unchanged: ${projectName || code}`)
            continue
          }
          if (!projectName) {
            fail("CAPEX: Project name is required")
            break
          }
          const minted = code
            ? undefined
            : nextCpx(
                version.year,
                sequence,
                [...versions, version].flatMap((version) => version.projects.map((project) => text(project.code))),
              )
          if (minted) sequence = minted.counter
          project = {
            id: allocate(version.projects),
            name: projectName,
            code: code || minted?.code,
            owner: "",
          }
          version.projects.push(project)
        }
        if (can("owner", project) && row["Project owner"] !== undefined)
          project.owner = workbookOwner(row["Project owner"], project.owner, environment, issue)
        const codeMatch = text(project.code).match(/^CPX-\d{4}-(\d+)$/i)
        if (codeMatch && can("structure")) sequence = Math.max(sequence, Number(codeMatch[1]))
      }
      const domain = synthetic ? (suppliedId.startsWith("HR:") ? suppliedId.slice(3) : name) : ""
      if (synthetic && !domain) {
        fail("HR domain is required")
        break
      }
      if (synthetic && !hrDomainAuthorized(version, domain, asNew ? undefined : official, actor))
        return { ok: false, status: 403 }
      const found = synthetic
        ? object(version.hc.hrAF[domain])
        : version.lines.find((line) => !!suppliedId && line.id === suppliedId && line.sec === sec) ||
          version.lines.find(
            (line) =>
              line.sec === sec &&
              line.el === el &&
              (sec !== "capex" || line.proj === project?.id) &&
              normName(text(line.name)) === normName(name),
          )
      if (!synthetic && !found && !can("structure")) {
        issue.warnings.push(`Unknown line unchanged: ${name || suppliedId}`)
        continue
      }
      const line: Row = synthetic
        ? { ...found, id: `HR:${domain}`, domain, synthetic: true }
        : found
          ? { ...found }
          : {
              id: allocate(version.lines),
              sec,
              el,
              proj: project?.id ?? "",
              name,
              cur: "USD",
              annual: 0,
              b: zeroMonths(),
              bm: emptyFlags(),
              a: months(undefined, true),
              f: months(undefined, true),
            }
      const duplicateKey = `${line.id}:${measure}`
      if (businessRows.has(duplicateKey)) {
        fail(`Duplicate ${measure} row for ${line.id}`)
        break
      }
      businessRows.add(duplicateKey)
      if (!synthetic && budgetOK) {
        line.sec = sec
        line.el = el
        line.proj = project?.id ?? text(line.proj)
        line.name = name || text(line.name)
        line.desc = row.Description == null ? text(line.desc) : text(row.Description)
        line.cur = workbookCurrency(row.Currency, line.cur, version, issue)
        if (sec === "capex") {
          const classification = normName(text(row.Classification))
          if (classification.startsWith("op")) line.cls = "opex"
          else if (classification.startsWith("cap")) line.cls = "capex"
          else if (row.Classification != null && row.Classification !== "")
            issue.warnings.push(`Unknown classification: ${text(row.Classification)}`)
          line.cls = line.cls ?? "capex"
        }
      }
      if (can("owner", line) && row.Owner !== undefined)
        line.owner = workbookOwner(row.Owner, line.owner, environment, issue)
      if (can("entity", line) && row.Entity !== undefined)
        line.entity = workbookReference(row.Entity, line.entity, rows(snapshot.data.entities), "entity", issue)
      if (can("allocation", line) && row.Allocation !== undefined)
        line.alloc = workbookReference(row.Allocation, line.alloc, rows(snapshot.data.allocations), "allocation", issue)
      const field = measure === "b" ? "budget" : measure === "a" ? "actual" : "forecast"
      if (!(synthetic && measure === "b") && can(field, line)) {
        const amounts = workbookMonths.map((month) => workbookNumber(row[month], measure === "b" ? 0 : null))
        if (amounts.some((amount) => amount === undefined)) {
          fail(`${section}: Invalid monthly amount`)
          break
        }
        if (measure === "b") {
          const budget = amounts.map((amount) => amount ?? 0)
          line.b = budget
          line.annual = cents(budget.reduce((sum, value) => sum + value, 0))
          line.bm = budget.every((value) => Math.abs(value - budget[0]) < 1.01)
            ? emptyFlags()
            : Array.from({ length: 12 }, () => true)
        } else line[measure] = amounts
      } else if (measure !== "b" && workbookMonths.some((month) => row[month] != null && row[month] !== "")) {
        // A budget owner must never partially apply another owner's forecast.
        if (
          measure === "f" &&
          actor.roles.includes("budget owner") &&
          !actor.roles.some((role) => ["admin", "finance"].includes(role))
        ) {
          issue.result = { ok: false, status: 403 }
          break
        }
      }
      if (synthetic) {
        const { synthetic: _synthetic, domain: _domain, id: _id, ...af } = line
        version.hc.hrAF[domain] = af
      } else {
        seen[sec].add(idOf(line.id))
        if (found) version.lines.splice(version.lines.indexOf(found), 1, line)
        else version.lines.push(line)
      }
    }
  if (membersWorkbook && !actor.roles.some((role) => ["admin", "hr"].includes(role)))
    return { ok: false, status: 403 }
  const lockedMembers = membersWorkbook && (version.locked || (!asNew && official === version.id))
  if (lockedMembers) issue.warnings.push("Roster unchanged: version is locked")
  const headcountImport = readWorkbookHeadcount(
    lockedMembers ? undefined : sheets.Headcount,
    version,
    actor,
    can,
    issue,
    allocate,
    seen.positions,
  )
  if (issue.result) return issue.result
  const importedRoster = headcountImport.roster
  const syncMembersPositions = membersWorkbook && importedRoster !== undefined && can("headcount") && !version.locked
  if (syncMembersPositions && importedRoster !== undefined) {
    const synced = syncRoster(
      version.hc.positions.map((row) => ({
        ...row,
        name: text(row.name),
        end: finite(row.end, 12),
        domain: text(row.domain),
        domainManual: row.domainManual === true,
      })),
      importedRoster as RosterPerson[],
      version.year,
      object(version.hc.leaderDomains) as Record<string, string>,
      false,
    )
    if (!synced.ok) return { ok: false, status: 403 }
    version.hc.positions = synced.positions as Row[]
    for (const person of importedRoster.filter((person) => syncEnters(person as RosterPerson, version.year)))
      if (!version.hc.positions.some((position) => normName(text(position.name)) === normName(text(person.name)))) {
        const id = allocate(version.hc.positions)
        if (issue.result) return issue.result
        version.hc.positions.push({
          id,
          name: person.name,
          include: true,
          fte: 1,
          start:
            person.start && Number(String(person.start).slice(0, 4)) === version.year
              ? Number(String(person.start).slice(5, 7))
              : 1,
          end: person.end ? Number(String(person.end).slice(5, 7)) : 12,
          type: "Employee",
          domain: text(object(version.hc.leaderDomains)[text(person.leader)]) || text(person.domain) || "Unassigned",
          src: "roster",
        })
      }
  }
  if (input.removeMissing === true) {
    if (budgetOK)
      version.lines = version.lines.filter(
        (line) =>
          !sheets[line.sec === "opex" ? "OPEX" : "CAPEX"] ||
          seen[line.sec === "opex" ? "opex" : "capex"].has(idOf(line.id)),
      )
    if (sheets.Headcount && !lockedMembers && !headcountImport.rosterRows && can("headcount"))
      version.hc.positions = version.hc.positions.filter((position) => seen.positions.has(idOf(position.id)))
  }
  if (budgetOK)
    for (const el of OPEX_ELEMENTS.filter((el) => el !== "hr")) {
      const lines = version.lines.filter((line) => line.sec === "opex" && line.el === el)
      if (lines.length > 1 && object(version.lists[el]).split === false)
        version.lists[el] = { ...object(version.lists[el]), split: true }
    }
  if (issue.result) return issue.result
  const changes: { key: string; was: unknown; became: unknown }[] = []
  const collect = (collection: string, was: Row[], became: Row[]) => {
    for (const id of new Set([...was, ...became].map((row) => idOf(row.id)))) {
      const old = was.find((row) => idOf(row.id) === id),
        next = became.find((row) => idOf(row.id) === id)
      if (JSON.stringify(old) !== JSON.stringify(next))
        changes.push({
          key: `${version.id}:${collection}:${id}`,
          was: old,
          became: next,
        })
    }
  }
  for (const collection of ["lines", "projects", "fx"] as const)
    collect(collection, asNew ? [] : before[collection], version[collection])
  for (const collection of ["positions", "rates"] as const)
    collect(collection, asNew ? [] : before.hc[collection], version.hc[collection])
  if (syncMembersPositions)
    for (const position of version.hc.positions) {
      const key = `${version.id}:positions:${idOf(position.id)}`
      if (!changes.some((change) => change.key === key))
        changes.push({
          key,
          was: before.hc.positions.find((row) => idOf(row.id) === idOf(position.id)),
          became: position,
        })
    }
  for (const domain of new Set([...Object.keys(before.hc.hrAF), ...Object.keys(version.hc.hrAF)]))
    if (asNew || JSON.stringify(before.hc.hrAF[domain]) !== JSON.stringify(version.hc.hrAF[domain]))
      changes.push({
        key: `${version.id}:hrAF:HR:${domain}`,
        was: asNew ? undefined : before.hc.hrAF[domain],
        became: version.hc.hrAF[domain],
      })
  for (const el of new Set([...Object.keys(before.lists), ...Object.keys(version.lists)]))
    if (asNew || JSON.stringify(before.lists[el]) !== JSON.stringify(version.lists[el]))
      changes.push({
        key: `${version.id}:lists:${el}`,
        was: asNew ? undefined : before.lists[el],
        became: version.lists[el],
      })
  if (asNew)
    changes.push(
      { key: `${version.id}:closed`, was: undefined, became: version.closed },
      {
        key: `${version.id}:increase`,
        was: undefined,
        became: { inc: version.hc.inc, incMonth: version.hc.incMonth },
      },
    )
  if (syncMembersPositions || changes.some((change) => change.key.startsWith(`${version.id}:positions:`)))
    changes.push({
      key: `${version.id}:positions:sync`,
      was: asNew ? undefined : before.hc.positions,
      became: version.hc.positions,
    })
  if (
    headcountImport.roster !== undefined &&
    JSON.stringify(headcountImport.roster) !== JSON.stringify(snapshot.data.roster)
  )
    changes.push({
      key: "roster:file",
      was: snapshot.data.roster,
      became: headcountImport.roster,
    })
  if (sequence !== sequenceBefore)
    changes.push({
      key: "sequences:cpx",
      was: sequenceBefore,
      became: sequence,
    })
  for (const change of changes) {
    const result = workbookRevision(
      snapshot,
      command,
      change.key,
      change.was,
      asNew && change.key.startsWith(`${version.id}:`),
    )
    if (result) return result
  }
  if (!changes.length && !asNew)
    return {
      ok: true,
      value: source.id,
      warnings: [...new Set(issue.warnings)],
    }
  if (asNew) {
    const result = workbookRevision(snapshot, command, `versions:${version.id}`, undefined, true)
    if (result) return result
    storedVersions.push(version)
  } else
    storedVersions.splice(
      storedVersions.findIndex((row) => idOf(row.id) === source.id),
      1,
      version,
    )
  snapshot.data.versions = storedVersions
  if (headcountImport.roster !== undefined) snapshot.data.roster = headcountImport.roster
  if (sequence !== sequenceBefore) snapshot.sequences.cpx = sequence
  for (const change of changes) changed(snapshot, change.key, actor, environment.at, change.was, change.became)
  if (asNew) changed(snapshot, `versions:${version.id}`, actor, environment.at, undefined, version)
  return {
    ok: true,
    value: version.id,
    warnings: [...new Set(issue.warnings)],
  }
}
function workbookDate(value: unknown): string | undefined {
  if (value == null || value === "") return ""
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000)
    return Number.isFinite(date.valueOf()) ? date.toISOString().slice(0, 10) : undefined
  }
  const token = text(value).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(token)) return undefined
  const date = new Date(`${token}T00:00:00Z`)
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === token ? token : undefined
}

type WorkbookPermission = (field: string, line?: Row) => boolean
function readWorkbookHeadcount(
  headcount: Row[] | undefined,
  version: Version,
  actor: Actor,
  can: WorkbookPermission,
  issue: ImportIssue,
  allocate: (records: Row[]) => string,
  seen: Set<string>,
) {
  const fail = (message: string) => {
    issue.result = { ok: false, status: 422, errors: [message] }
  }
  const rosterRows =
    headcount?.some((row) =>
      ["Start Date", "End Date", "Start", "End", "Leader", "Status"].some((key) => key in row),
    ) && !headcount.some((row) => ["Position ID", "FTE", "Start month"].some((key) => key in row))
  let roster: Row[] | undefined
  if (rosterRows) {
    if (!actor.roles.some((role) => ["admin", "hr"].includes(role))) issue.result = { ok: false, status: 403 }
    else {
      roster = []
      for (const row of headcount ?? []) {
        if (!text(row.Name).trim()) {
          fail("Roster name is required")
          break
        }
        const start = workbookDate(row["Start Date"] ?? row.Start),
          end = workbookDate(row["End Date"] ?? row.End)
        if (start === undefined || end === undefined) {
          fail("Invalid roster date")
          break
        }
        roster.push({
          name: text(row.Name).trim(),
          title: text(row.Title),
          type: text(row.Type),
          leader: text(row.Leader),
          location: text(row.Location),
          start,
          end,
          status: text(row.Status),
        })
      }
    }
  } else if (headcount) {
    if (!can("headcount")) issue.warnings.push("Headcount unchanged: budget or role is read-only")
    else
      for (const row of headcount ?? []) {
        const name = text(row.Name).trim(),
          id = idOf(row["Position ID"])
        const found =
          version.hc.positions.find((position) => !!id && position.id === id) ||
          version.hc.positions.find((position) => normName(text(position.name)) === normName(name))
        const fte = workbookNumber(row.FTE, row.FTE === undefined && found ? finite(found.fte, 1) : 1)
        const start = workbookSpan(row["Start month"], finite(found?.start, 1)),
          end = workbookSpan(row["End month"], finite(found?.end, 12))
        const positionName = name || text(found?.name)
        if (!positionName || fte == null || start === undefined || end === undefined) {
          fail("Invalid position name, FTE or month")
          break
        }
        const next: Row = {
          ...found,
          id: idOf(found?.id) || allocate(version.hc.positions),
          name: positionName,
          fte: clampFte(fte),
          ...orderSpan(start, end),
          src: found?.src ?? "new",
        }
        const included = normName(String(row.Include ?? (found?.include === false ? "N" : "Y")))
        if (!["y", "yes", "true", "1", "n", "no", "false", "0"].includes(included)) {
          fail("Invalid Include value")
          break
        }
        next.include = ["y", "yes", "true", "1"].includes(included)
        for (const [column, field] of [
          ["Title", "title"],
          ["Location", "location"],
          ["Type", "type"],
          ["Domain", "domain"],
        ])
          if (row[column] !== undefined) next[field] = text(row[column])
        next.type = next.type || "Employee"
        if (!["Employee", "Contractor"].includes(text(next.type))) {
          fail("Invalid position type")
          break
        }
        if (row.Domain !== undefined) next.domainManual = true
        if (row["Rate card"] !== undefined)
          next.rateId = workbookReference(row["Rate card"], next.rateId, version.hc.rates, "rate card", issue)
        if (row["Rate override"] !== undefined) {
          const override = workbookNumber(row["Rate override"], null)
          if (override === undefined || (override !== null && override < 0)) {
            fail("Invalid rate override")
            break
          }
          next.rateOverride = override
        }
        seen.add(idOf(next.id))
        if (found) version.hc.positions.splice(version.hc.positions.indexOf(found), 1, next)
        else version.hc.positions.push(next)
      }
  }
  return { rosterRows, roster }
}

function readWorkbookRates(
  sheets: Record<string, Row[]>,
  version: Version,
  can: WorkbookPermission,
  issue: ImportIssue,
  allocate: (records: Row[]) => string,
) {
  const fail = (message: string) => {
    issue.result = { ok: false, status: 422, errors: [message] }
  }
  // FX runs first so currencies added in this workbook are available to later sheets.
  // Blank rate stays null. A bad currency or rate warns and skips only that row. USD is never stored.
  if (sheets["FX rates"]) {
    if (!can("fx")) issue.warnings.push("FX rates unchanged: budget or role is read-only")
    else
      for (const [index, row] of sheets["FX rates"].entries()) {
        const currency = (typeof row.Currency === "string" || typeof row.Currency === "number"
          ? String(row.Currency)
          : ""
        )
          .trim()
          .toUpperCase()
        if (!currency || currency === "USD") continue
        if (!/^[A-Z]{3}$/.test(currency)) {
          issue.warnings.push(`FX rates row ${index + 2}: "${currency}" is not a 3-letter currency code. Skipped.`)
          continue
        }
        const rate = parseWorkbookRate(row["USD per 1 unit"])
        if (typeof rate === "number" && Number.isNaN(rate)) {
          issue.warnings.push(`FX rates row ${index + 2}: rate for ${currency} is not a positive number. Skipped.`)
          continue
        }
        const found = version.fx.find((item) => item.cur === currency)
        const next = {
          ...found,
          id: idOf(found?.id) || currency,
          cur: currency,
          rate,
        }
        if (found) version.fx.splice(version.fx.indexOf(found), 1, next)
        else version.fx.push(next)
      }
  }
  if (sheets["Rate cards"]) {
    if (!can("rate")) issue.warnings.push("Rate cards unchanged: budget or role is read-only")
    else
      for (const row of sheets["Rate cards"]) {
        const name = text(row["Rate card"]).trim()
        const found =
          version.hc.rates.find((rate) => idOf(row["Rate ID"]) && rate.id === idOf(row["Rate ID"])) ||
          version.hc.rates.find((rate) => normName(text(rate.name)) === normName(name))
        const cardName = name || text(found?.name)
        const annual = workbookNumber(row["Annual cost per FTE"], found ? finite(found.annual) : 0)
        if (!cardName || annual == null || annual < 0) {
          fail("Invalid rate card name or annual cost")
          break
        }
        const next = {
          ...found,
          id: idOf(found?.id) || allocate(version.hc.rates),
          name: cardName,
          locs: row.Locations == null ? text(found?.locs) : text(row.Locations),
          annual,
          cur: workbookCurrency(row.Currency, found?.cur, version, issue),
        }
        if (found) version.hc.rates.splice(version.hc.rates.indexOf(found), 1, next)
        else version.hc.rates.push(next)
      }
  }
}

function parseWorkbookRate(value: unknown): number | null {
  if (value == null) return null
  if (typeof value !== "number" && typeof value !== "string") return Number.NaN
  const token = String(value).trim().replace(/\s/g, "")
  if (!token) return null
  const normalized = /^\d+,\d+$/.test(token) ? token.replace(",", ".") : token
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed <= 0) return Number.NaN
  const rate = Math.round(parsed * 1e6) / 1e6
  return rate > 0 ? rate : Number.NaN
}

function workbookForm(page: string, version: Version, context: RenderContext): string {
  const writable =
    context.actor.canWrite &&
    context.actor.roles.some((role) => ["admin", "finance", "hr", "budget owner"].includes(role))
  return `<details class="editor-panel"><summary>Import workbook</summary>${form(
    page,
    "import-workbook",
    version.id,
    context.versions[`versions:${version.id}`]?.version ?? 0,
    `<input type="hidden" name="versionId" value="${esc(version.id)}"><input type="hidden" name="sheets" data-json="true" value=""><input type="hidden" name="versions" data-json="true" value="${esc(JSON.stringify(context.versions))}"><label>Import Excel <input type="file" accept=".xlsx,.xls" data-workbook="planner"${writable ? "" : " disabled"}></label><p data-import-notice role="status" aria-live="polite">Choose a workbook to preview before applying.</p>` +
      fields([
        {
          name: "newVersion",
          label: "Import into a new version",
          type: "checkbox",
        },
        {
          name: "removeMissing",
          label: "Remove missing lines and positions from provided sheets",
          type: "checkbox",
        },
      ]),
    "Apply",
    !writable,
  )}</details>`
}

export const PlannerModule = { pages, domain, render }
