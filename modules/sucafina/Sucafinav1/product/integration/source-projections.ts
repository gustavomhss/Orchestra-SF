import { domain, sfOriginalPlannerViewCurrent } from "../../runtime/planner.ts"
import { plannerKeys, PLANNER_TABS } from "../../src/nav.ts"
import { roleMap } from "../../runtime/admin.ts"
import { object } from "../../runtime/contract.ts"
import type { Actor, Snapshot } from "../../runtime/contract.ts"
import type { Surface } from "../../src/identity.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import { digestSfValue, sfCanonicalCaptureRuntime } from "../contracts/canonical.ts"
import { sfOriginalStructuredCloneCurrent } from "../contracts/canonical-clone.ts"
import { projectPlannerSource } from "../planner/port.ts"
import { projectDashboardScope } from "../dashboard/scope.ts"
import type { Period } from "../contracts/context.ts"
import type { SfSourceScope } from "./source-lifecycle.ts"
import { projectSfProcurementScope } from "./procurement-projections.ts"
import { normalizeDashboardRecords } from "../dashboard/records.ts"
import { dashboardPerformanceAgendaRecords } from "../dashboard/agenda.ts"
import { dashboardPageViewsCurrent, projectDashboardSource } from "../dashboard/port.ts"
import { publicSfData } from "./public-state.ts"

// This optional proof shares the trusted module-bootstrap boundary. It checks
// the finite dependencies of the successful Planner terminal, not the whole VM.
// The callback-taking factory below remains opaque and its execution stays live.
const canonicalPlannerProjectors = (() => {
  try {
    const runtime = sfCanonicalCaptureRuntime()
    if (!runtime || !sfOriginalStructuredCloneCurrent()) return undefined
    const descriptor = Object.getOwnPropertyDescriptor, prototype = Object.getPrototypeOf
    const own = Object.hasOwn, same = Object.is, keys = Reflect.ownKeys
    const pins: { owner: object; key: PropertyKey; expected: PropertyDescriptor }[] = []
    const shapes: { owner: object; parent: object | null; fields: { key: PropertyKey; expected: PropertyDescriptor }[] }[] = []
    const links: { owner: object; parent: object | null }[] = []
    const fields = ["configurable", "enumerable", "value", "writable", "get", "set"] as const
    const objectLike = (value: unknown): value is object => !!value &&
      (typeof value === "object" || typeof value === "function") && !runtime.isProxy(value)
    const pin = (owner: object, key: PropertyKey) => {
      if (!objectLike(owner)) throw 0
      const expected = descriptor(owner, key)
      if (!expected) throw 0
      pins[pins.length] = { owner, key, expected }
      return expected
    }
    const data = (owner: object, key: PropertyKey): unknown => {
      const expected = pin(owner, key)
      if (!own(expected, "value")) throw 0
      return expected.value
    }
    const method = (owner: object, key: PropertyKey) => {
      const value = data(owner, key)
      if (typeof value !== "function" || runtime.isProxy(value)) throw 0
      return value
    }
    const shape = (owner: object) => {
      if (!objectLike(owner)) throw 0
      const names = keys(owner), captured: { key: PropertyKey; expected: PropertyDescriptor }[] = []
      for (let index = 0; index < names.length; index++) {
        const key = names[index]!, expected = descriptor(owner, key)
        if (!expected) throw 0
        captured[index] = { key, expected }
      }
      shapes[shapes.length] = { owner, parent: prototype(owner), fields: captured }
    }
    const constructor = (name: string) => {
      const value = method(globalThis, name), target = data(value, "prototype")
      if (!objectLike(target)) throw 0
      links[links.length] = { owner: value, parent: prototype(value) }
      return { value, target }
    }

    // Static operations actually used by the terminal and its error envelope.
    for (const key of ["entries", "fromEntries", "values"]) method(Object, key)
    method(Array, "from")
    method(Number, "isInteger")
    method(Number, "isSafeInteger")
    method(JSON, "parse")
    const apply = method(Reflect, "apply") as typeof Reflect.apply
    for (const key of ["Boolean", "encodeURIComponent", "decodeURIComponent"]) method(globalThis, key)
    const math = data(globalThis, "Math")
    if (!objectLike(math)) return undefined
    links[links.length] = { owner: math, parent: prototype(math) }
    method(math, "round")
    method(math, "abs")

    const date = constructor("Date")
    method(date.value, "UTC")
    method(date.target, "toISOString")
    method(date.target, "getUTCDate")
    links[links.length] = { owner: date.target, parent: prototype(date.target) }
    const string = constructor("String")
    if (prototype("") !== string.target) return undefined
    shape(string.target)
    // Literal regular expressions use this realm prototype, independently of
    // the global RegExp binding. Closed descriptors include flags/protocols.
    shape(prototype(/(?:)/))
    const map = constructor("Map"), set = constructor("Set")
    shape(map.target)
    shape(set.target)
    method(WeakMap.prototype, "delete")
    const promise = constructor("Promise")
    shape(promise.target)
    pin(promise.value, Symbol.species)

    // Only empty original builtin iterators are created here. No domain reader,
    // projector, iterator.next or sampled product callback runs at bootstrap.
    const iterator = data(Symbol, "iterator")
    if (typeof iterator !== "symbol") return undefined
    const arrayIterator = apply(method(Array.prototype, iterator), [], [])
    const emptySet = new (set.value as SetConstructor)()
    const setIterator = apply(method(set.target, iterator), emptySet, [])
    const closeIterator = (value: unknown) => {
      if (!objectLike(value)) throw 0
      let parent: object | null = prototype(value), count = 0
      while (parent !== Object.prototype && parent !== null) {
        if (++count > 4) throw 0
        shape(parent)
        parent = prototype(parent)
      }
      if (parent !== Object.prototype) throw 0
    }
    closeIterator(arrayIterator)
    closeIterator(setIterator)

    // The method's identity is anchored inside its producer module, before a
    // consumer could import that module, replace it and then load this factory.
    if (!sfOriginalPlannerViewCurrent()) return undefined
    method(domain, "view")
    links[links.length] = { owner: domain, parent: prototype(domain) }
    const tabs = PLANNER_TABS
    const expectedTabs = ["Overview", "OPEX", "CAPEX", "Headcount", "Entities & allocations", "FX rates", "Versions"]
    if (!objectLike(tabs) || !Array.isArray(tabs) || prototype(tabs) !== Array.prototype ||
      tabs.length !== expectedTabs.length || keys(tabs).length !== expectedTabs.length + 1) return undefined
    for (let index = 0; index < expectedTabs.length; index++) {
      const field = descriptor(tabs, `${index}`)
      if (!field || !own(field, "value") || field.value !== expectedTabs[index]) return undefined
    }
    shape(tabs)

    const equalDescriptor = (left: PropertyDescriptor | undefined, right: PropertyDescriptor) => {
      if (!left) return false
      for (let index = 0; index < fields.length; index++) {
        const field = fields[index]!
        if (own(left, field) !== own(right, field) || own(left, field) && !same(left[field], right[field])) return false
      }
      return true
    }
    const current = () => {
      try {
        if (!runtime.current() || !sfOriginalStructuredCloneCurrent() || !sfOriginalPlannerViewCurrent() || PLANNER_TABS !== tabs) return false
        for (let index = 0; index < links.length; index++) {
          const link = links[index]!
          if (prototype(link.owner) !== link.parent) return false
        }
        for (let index = 0; index < pins.length; index++) {
          const item = pins[index]!
          if (!equalDescriptor(descriptor(item.owner, item.key), item.expected)) return false
        }
        for (let index = 0; index < shapes.length; index++) {
          const item = shapes[index]!, names = keys(item.owner)
          if (prototype(item.owner) !== item.parent || names.length !== item.fields.length) return false
          for (let position = 0; position < names.length; position++) {
            const field = item.fields[position]!
            if (names[position] !== field.key || !equalDescriptor(descriptor(item.owner, field.key), field.expected)) return false
          }
        }
        return true
      } catch { return false }
    }
    if (!current()) return undefined
    return { current, runtime, values: new WeakSet<object>() }
  } catch { return undefined }
})()

/** No storage/authority is exported. Private consumers may capture cleanup
 * primitives once at module bootstrap only when this original capsule is current. */
export function sfCanonicalPlannerSourceRuntimeCurrent() {
  return canonicalPlannerProjectors?.current() === true
}

/** The installed factory owns its live clock; it accepts no caller callback. */
export function createSfCanonicalSourceScopeProjector() {
  // Keep the same live clock expression as the original installed wiring. A
  // disabled proof never calls captured Date methods to evade current hooks.
  const projector = createSfSourceScopeProjector(() => new Date().toISOString())
  if (canonicalPlannerProjectors?.current()) canonicalPlannerProjectors.values.add(projector)
  return projector
}

/** Membership is private: callers can create our factory, never register theirs. */
export function isSfCanonicalPlannerSourceProjector(projector: unknown) {
  return canonicalPlannerProjectors?.current() === true && typeof projector === "function" &&
    !canonicalPlannerProjectors.runtime.isProxy(projector) && canonicalPlannerProjectors.values.has(projector)
}

/** Saved roles define the projection, never authenticate a later caller. Reads authenticate again. */
export function sfPlannerProjectionSelector(snapshot: Pick<Snapshot, "data">, actor: Actor) {
  return { kind: "planner-source-v1", roles: [...actor.roles].sort(), canWrite: actor.canWrite, roleMapDigest: digestSfValue(roleMap(snapshot, "planner")) }
}

export function sfPlannerRosterProjectionSelector(snapshot: Snapshot, actor: Actor, fields: readonly string[], period: Period) {
  return { ...sfPlannerProjectionSelector(snapshot, actor), kind: "planner-roster-v1", fields: [...fields].sort(), period: structuredClone(period) }
}

// The host shares this clock with its request environment; a client cannot supply it.
export function createSfSourceScopeProjector(now: () => string) {
  const observations = new WeakMap<object, Map<string, ReturnType<typeof projectDashboardScope>>>()
  const primitives = { clone: structuredClone, parseDate: Date.parse, stringify: JSON.stringify }
  return (surface: Surface, snapshot: Snapshot, scope: SfSourceScope, heldSource?: object) => {
    const observedAt = now()
    if (surface !== "dashboard" || !heldSource || structuredClone !== primitives.clone || Date.parse !== primitives.parseDate ||
      JSON.stringify !== primitives.stringify || Object.hasOwn(Object.prototype, "toJSON") || Object.hasOwn(Array.prototype, "toJSON"))
      return projectSfSourceScope(surface, snapshot, scope, observedAt)
    const views = observations.get(heldSource) ?? new Map<string, ReturnType<typeof projectDashboardScope>>()
    observations.set(heldSource, views)
    return projectSfSourceScope(surface, snapshot, scope, observedAt, (source, actor, selector, at) => {
      // The project register and forecast line readers share these page views.
      // Leave the other pages on their original dependency paths.
      if (!dashboardPageViewsCurrent() || !["Portfolio Dashboard", "All Projects", "OPEX Detail", "CAPEX Projects"].includes(selector.page))
        return projectDashboardScope(source, actor, selector, at)
      const key = digestSfValue({ actor, selector, at })
      if (views.has(key)) return structuredClone(views.get(key))
      const projected = projectDashboardScope(source, actor, selector, at)
      // The page can be shared by many individual record observations. Every
      // observer gets an independent result for the same sealed domain bytes.
      if (views.size < 64) views.set(key, structuredClone(projected))
      return projected
    })
  }
}

export function projectSfSourceScope(surface: Surface, snapshot: Snapshot, scope: SfSourceScope, observedAt?: string, projectPage = projectDashboardScope) {
  const selector = object(scope.selector)
  if (surface === "procurement") return projectSfProcurementScope(surface, snapshot, scope)
  if (surface === "dashboard") {
    const stored = object(selector.actor)
    const access = object(object(snapshot.data.access)[scope.principalRef])
    if (stored.id !== scope.principalRef || selector.roleMapDigest !== digestSfValue(roleMap(snapshot, "dashboard")) || typeof stored.canWrite !== "boolean" || !Array.isArray(stored.roles) || !stored.roles.every((role) => typeof role === "string")) return undefined
    const actor: Actor = { id: scope.principalRef, roles: stored.roles, canWrite: stored.canWrite, assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
    if (digestSfValue(actor) !== digestSfValue(stored)) return undefined
    // Whole-backup authority is explicit and retains the legacy dashboard administrator boundary.
    if (scope.recordType === "dashboard-dataset") return scope.recordId === "all" && selector.kind === "dashboard-dataset-v1" && actor.canWrite && actor.roles.includes("admin") &&
      Array.isArray(selector.fields) && selector.fields.length === 1 && selector.fields[0] === "data" && selector.period === undefined
      ? { data: publicSfData(snapshot.data) } : undefined
    if (typeof selector.page !== "string" || !Array.isArray(selector.fields) || !selector.fields.every((field) => typeof field === "string") || !selector.period || typeof selector.period !== "object") return undefined
    if (typeof observedAt !== "string" || !Number.isFinite(Date.parse(observedAt))) return undefined
    const asOf = `${new Date(observedAt).toISOString().slice(0, 10)}T00:00:00Z`
    if (scope.recordType === "dashboard-page" && scope.recordId === selector.page) return projectPage(snapshot, actor, { page: selector.page, fields: selector.fields, period: selector.period as Period }, asOf)
    // Record scopes are admitted only through a page the same actor can view.
    if (scope.recordType === "dashboard-page" || scope.recordId === "__singleton__") return undefined
    if (scope.recordType === "itperf-item") {
      if (selector.page !== "IT Performance Contract" || !dashboardPerformanceAgendaRecords(snapshot.data.itperf)) return undefined
      const projection = projectPage(snapshot, actor, { page: selector.page, fields: ["itperf"], period: selector.period as Period }, asOf)
      const records = projection && dashboardPerformanceAgendaRecords(projection.selected.itperf)
      const matches = records?.filter((record) => String(record.id) === scope.recordId)
      if (!matches || matches.length !== 1 || selector.fields.some((field) => !Object.hasOwn(matches[0]!, field))) return undefined
      return Object.fromEntries([...selector.fields].sort().map((field) => [field, matches[0]![field]]))
    }
    const logical = ["budgetYtd", "deviations", "budgetCurrentMonth", "revenueByYear"].includes(scope.recordType)
    const visible = logical ? projectDashboardSource(snapshot, actor, { at: asOf, id: () => "", directory: [] }, selector.page) : undefined
    const projection = logical ? undefined : projectPage(snapshot, actor, { page: selector.page, fields: [scope.recordType], period: selector.period as Period }, asOf)
    const records = logical ? normalizeDashboardRecords(scope.recordType, snapshot.data[scope.recordType]) : projection?.selected[scope.recordType]
    if (!Array.isArray(records)) return undefined
    const matches = records.filter((entry) => String(object(entry).id ?? "") === scope.recordId)
    if (matches.length !== 1 || selector.fields.some((field) => !Object.hasOwn(object(matches[0]), field))) return undefined
    const record = object(matches[0])
    if (logical) {
      if (!visible) return undefined
      if (scope.recordType === "revenueByYear" || scope.recordType === "budgetCurrentMonth") {
        if (selector.page !== "Budget Overview" || selector.fields.some((field) => !["value", "year"].includes(field))) return undefined
      }
      if (scope.recordType === "budgetYtd" || scope.recordType === "deviations") {
        const page = record.kind === "opex" ? "OPEX Detail" : record.kind === "capex" ? "CAPEX Projects" : undefined
        const owners = page === "OPEX Detail" ? visible.opexOwners : page === "CAPEX Projects" ? visible.capexProjects : undefined
        const fields = scope.recordType === "budgetYtd" ? ["kind", "year", "ownerId", "amount", "months", "perMonth", "at"] : ["kind", "year", "month", "ownerId", "flag", "text"]
        if (selector.page !== page || !Array.isArray(owners) || !owners.some((owner) => String(object(owner).id ?? "") === record.ownerId) || selector.fields.some((field) => !fields.includes(field))) return undefined
      }
    }
    const period = object(selector.period)
    if (typeof period.start !== "string" || typeof period.end !== "string") return undefined
    if (scope.recordType === "hotTopics") {
      const today = asOf.slice(0, 10)
      if (selector.page !== "Hot Topics & Actions" || period.start !== today || period.end !== today ||
        selector.fields.some((field) => !["id", "action", "owner", "due", "status", "priority", "notes"].includes(field))) return undefined
      return Object.fromEntries([...selector.fields].sort().map((field) => [field, record[field]]))
    }
    const year = record.year === undefined ? Number(period.start.slice(0, 4)) : Number(record.year)
    const month = record.month === undefined ? undefined : Number(record.month)
    if (!Number.isInteger(year) || year < 2024 || year > 2027 || (month !== undefined && (!Number.isInteger(month) || month < 1 || month > 12))) return undefined
    const start = month === undefined ? `${year}-01-01` : `${year}-${String(month).padStart(2, "0")}-01`
    const end = month === undefined ? `${year}-12-31` : `${year}-${String(month).padStart(2, "0")}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}`
    if (period.start > start || period.end < end) return undefined
    return Object.fromEntries([...selector.fields].sort().map((field) => [field, record[field]]))
  }
  if (surface !== "planner" || !["planner-source-v1", "planner-roster-v1"].includes(String(selector.kind)) ||
    selector.roleMapDigest !== digestSfValue(roleMap(snapshot, "planner")) || typeof selector.canWrite !== "boolean" ||
    !Array.isArray(selector.roles) || !selector.roles.every((role): role is string => typeof role === "string")) return undefined
  const access = object(object(snapshot.data.access)[scope.principalRef])
  const actor: Actor = { id: scope.principalRef, roles: selector.roles, canWrite: selector.canWrite,
    assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [],
    domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
  if (scope.recordType === "planner-version" && selector.kind === "planner-source-v1") return projectPlannerSource(snapshot, actor, scope.recordId)
  const fields = selector.fields
  if (scope.recordType !== "planner-roster" || scope.recordId !== "file" || selector.kind !== "planner-roster-v1" || !actor.canWrite ||
    !actor.roles.some((role) => role === "admin" || role === "hr") || !plannerKeys(actor).includes("Headcount") || !Array.isArray(snapshot.data.roster) ||
    !isSfPeriod(selector.period) || !Array.isArray(fields) || !fields.length || fields.some((field) => typeof field !== "string" || !["name", "title", "type", "leader", "location", "start", "end", "status"].includes(field)) ||
    new Set(fields).size !== fields.length || digestSfValue(fields) !== digestSfValue([...fields].sort())) return undefined
  const roster = domain.view(snapshot, actor, { at: observedAt ?? "1970-01-01T00:00:00.000Z", id: () => "", directory: [] }).data.roster
  if (!Array.isArray(roster) || roster.some((row) => !row || typeof row !== "object" || Array.isArray(row))) return undefined
  const source = snapshot.sfSources?.records[JSON.stringify(["planner-roster", "file"])]
  if (!source?.alive || !Number.isSafeInteger(source.version) || source.version < 1) return undefined
  // The full physical revision also fences changes in fields used by roster synchronization.
  return { roster: roster.map((row) => Object.fromEntries(fields.map((field) => [field, object(row)[field]]))), sourceVersion: source.version }

}
