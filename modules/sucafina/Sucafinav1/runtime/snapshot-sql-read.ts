import { Database, Statement } from "bun:sqlite"
import { types } from "node:util"
import type { Surface } from "../src/identity.ts"

type PayloadPlan = Readonly<{ payload?: string; units: number }>
type PayloadRow = { payload: unknown; storageType: unknown }
type BoundRead = { plan: PayloadPlan; statement: Statement<PayloadRow, string[]>; units: number }

const originalSql = "SELECT payload FROM snapshots WHERE surface = ?"
const conditionalSql = "SELECT CASE WHEN typeof(payload) = 'text' AND payload = ? COLLATE BINARY THEN NULL ELSE payload END AS payload, typeof(payload) AS storageType FROM snapshots WHERE surface = ?"
const maximumUnits = 8 * 1024 * 1024
const surfaces: readonly Surface[] = ["dashboard", "planner", "procurement"]
const descriptor = Object.getOwnPropertyDescriptor, prototype = Object.getPrototypeOf
const apply = Reflect.apply, create = Object.create, get = Reflect.get, own = Object.hasOwn, isProxy = types.isProxy
const objectPrototype = Object.prototype, mapGet = Map.prototype.get, mapForEach = Map.prototype.forEach
const charCodeAt = String.prototype.charCodeAt
const NativeWeakMap = WeakMap, weakGet = WeakMap.prototype.get, weakSet = WeakMap.prototype.set

function same(owner: object, key: PropertyKey, expected: PropertyDescriptor | undefined) {
  const current = descriptor(owner, key)
  if (!current || !expected) return current === expected
  if (current.enumerable !== expected.enumerable || current.configurable !== expected.configurable ||
    own(current, "value") !== own(expected, "value")) return false
  if (own(current, "value")) return current.value === expected.value && current.writable === expected.writable
  return current.get === expected.get && current.set === expected.set
}

// Optional native admission starts with the original module import, not a later
// first read. It does not attest an environment changed before that bootstrap.
// The private in-memory probe prepares a statement but never steps a SELECT.
const runtime = (() => {
  try {
    if (typeof Bun === "undefined") return undefined
    const engine = Bun
    const version = descriptor(engine, "version"), revision = descriptor(engine, "revision")
    if (!version || !revision || !own(version, "value") || !own(revision, "value") || !(
      version.value === "1.3.14" && revision.value === "0d9b296af33f2b851fcbf4df3e9ec89751734ba4" ||
      version.value === "1.4.1" && revision.value === "4661e494f052c83c80dade1318e5710238340be6"
    )) return undefined
    const databasePrototype = Database.prototype, statementPrototype = Statement.prototype
    const native = descriptor(statementPrototype, "native")?.get
    if (typeof native !== "function") return undefined
    const database = new Database(":memory:", { strict: true })
    let probe: Statement<unknown, string[]> | undefined
    try {
      probe = database.prepare<unknown, string[]>("SELECT ?", [""])
      const wrapperGet = descriptor(probe, "get")
      const raw: unknown = apply(native, probe, [])
      if (!wrapperGet || typeof wrapperGet.value !== "function" || !raw || typeof raw !== "object") return undefined
      const rawPrototype: object = prototype(raw)
      const finalize = descriptor(rawPrototype, "finalize")?.value
      if (typeof finalize !== "function") return undefined
      const pins: { owner: object; key: PropertyKey; expected: PropertyDescriptor | undefined }[] = [
        { owner: globalThis, key: "Bun", expected: descriptor(globalThis, "Bun") },
        { owner: engine, key: "version", expected: version },
        { owner: engine, key: "revision", expected: revision },
        { owner: Database, key: "prototype", expected: descriptor(Database, "prototype") },
        { owner: Statement, key: "prototype", expected: descriptor(Statement, "prototype") },
      ]
      for (const key of ["query", "prepare"]) pins.push({ owner: databasePrototype, key, expected: descriptor(databasePrototype, key) })
      for (const key of ["native", "isFinalized"]) pins.push({ owner: statementPrototype, key, expected: descriptor(statementPrototype, key) })
      for (const key of ["get", "finalize", "paramsCount", "safeIntegers"]) pins.push({ owner: rawPrototype, key, expected: descriptor(rawPrototype, key) })
      const query = descriptor(databasePrototype, "query")
      const indexOf = descriptor(Array.prototype, "indexOf"), push = descriptor(Array.prototype, "push")
      const parents = [prototype(databasePrototype), prototype(statementPrototype), prototype(rawPrototype)]
      const current = () => {
        for (let index = 0; index < pins.length; index++) {
          const pin = pins[index]
          if (!pin || !same(pin.owner, pin.key, pin.expected)) return false
        }
        return prototype(databasePrototype) === parents[0] && prototype(statementPrototype) === parents[1] &&
          prototype(rawPrototype) === parents[2]
      }
      const accepted = (statement: object, count: number) => {
        if (isProxy(statement) || prototype(statement) !== statementPrototype ||
          !same(statement, "get", wrapperGet) || descriptor(statement, "native")) return false
        const value: unknown = apply(native, statement, [])
        return !!value && typeof value === "object" && !isProxy(value) && prototype(value) === rawPrototype &&
          !descriptor(value, "get") && !descriptor(value, "paramsCount") && !descriptor(value, "safeIntegers") &&
          get(value, "paramsCount") === count && get(value, "safeIntegers") === false
      }
      if (!current() || !accepted(probe, 1)) return undefined
      return {
        beforeQuery(database: Database) {
          try {
            return !isProxy(database) && prototype(database) === databasePrototype && !descriptor(database, "query") &&
              same(databasePrototype, "query", query) && same(Array.prototype, "indexOf", indexOf) && same(Array.prototype, "push", push)
          } catch { return false }
        },
        accepts(database: Database, statement: object, count: number) {
          try { return current() && !descriptor(database, "prepare") && accepted(statement, count) }
          catch { return false }
        },
        canPrepare() {
          // Statement's constructor assigns these own methods. Reject an
          // inherited setter before any private conditional statement is made.
          const assigned = ["get", "all", "iterate", "values", "raw", "run"]
          for (let index = 0; index < assigned.length; index++) {
            const key = assigned[index]
            if (key === undefined || descriptor(statementPrototype, key) || descriptor(objectPrototype, key)) return false
          }
          return current()
        },
        finalize(statement: object) {
          apply(finalize, apply(native, statement, []), [])
        },
      }
    } finally {
      try { probe?.finalize() } finally { database.close() }
    }
  } catch { return undefined }
})()

function bindingUnits(plan: PayloadPlan): number | undefined {
  if (isProxy(plan)) return undefined
  const stored = descriptor(plan, "payload"), size = descriptor(plan, "units")
  if (!stored || !own(stored, "value") || typeof stored.value !== "string" || stored.writable || stored.configurable ||
    !size || !own(size, "value") || typeof size.value !== "number" || size.writable || size.configurable) return undefined
  const payload = stored.value
  if (payload.length > maximumUnits / 2) return undefined
  for (let index = 0; index < payload.length; index++) {
    const unit: number = apply(charCodeAt, payload, [index])
    if (unit === 0 || unit === 0xfeff) return undefined
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next: number = apply(charCodeAt, payload, [++index])
      if (!(next >= 0xdc00 && next <= 0xdfff)) return undefined
      continue
    }
    if (unit >= 0xdc00 && unit <= 0xdfff) return undefined
  }
  return 2 * payload.length + 1
}

export function createSnapshotSqlReader() {
  const entries: Partial<Record<Surface, BoundRead>> = create(null)
  const eligibility = new NativeWeakMap<PayloadPlan, number | false>()
  let retainedUnits = 0, nativeUnits = 0
  const drop = (surface: Surface) => {
    const entry = entries[surface]
    if (!entry) return
    runtime?.finalize(entry.statement)
    delete entries[surface]
    nativeUnits -= entry.units
  }
  return {
    drop,
    reconcile(plans: ReadonlyMap<Surface, PayloadPlan>) {
      retainedUnits = 0
      apply(mapForEach, plans, [(plan: PayloadPlan) => {
        if (isProxy(plan)) { retainedUnits = maximumUnits; return }
        const size = descriptor(plan, "units")
        if (!size || !own(size, "value") || typeof size.value !== "number" || size.writable || size.configurable ||
          !(size.value >= 0 && size.value <= maximumUnits && size.value % 1 === 0)) {
          retainedUnits = maximumUnits
          return
        }
        retainedUnits += size.value
      }])
      for (let index = 0; index < surfaces.length; index++) {
        const surface = surfaces[index]
        if (surface === undefined) continue
        const entry = entries[surface]
        if (entry && apply(mapGet, plans, [surface]) !== entry.plan) drop(surface)
      }
      // Only optional native bindings leave under pressure; decoder plans and
      // their byte identities keep the original retention and eviction policy.
      for (let index = 0; index < surfaces.length; index++) {
        if (retainedUnits + nativeUnits <= maximumUnits) break
        const surface = surfaces[index]
        if (surface !== undefined) drop(surface)
      }
    },
    read(database: Database, surface: Surface, plan: PayloadPlan | undefined): unknown {
      const before = runtime?.beforeQuery(database) ?? false
      const original = database.query<{ payload: unknown }, [string]>(originalSql)
      if (!runtime || !before || !plan || isProxy(plan) || !runtime.accepts(database, original, 1))
        return original.get(surface)?.payload
      let entry = entries[surface]
      if (!entry || entry.plan !== plan) {
        drop(surface)
        let payloadUnits: number | false | undefined = apply(weakGet, eligibility, [plan])
        if (payloadUnits === undefined) {
          payloadUnits = bindingUnits(plan) ?? false
          apply(weakSet, eligibility, [plan, payloadUnits])
        }
        const surfaceUnits = 2 * surface.length + 1
        const units = payloadUnits === false ? 0 : payloadUnits + (surfaceUnits < 16 ? 16 : surfaceUnits)
        if (payloadUnits === false || retainedUnits + nativeUnits + units > maximumUnits || !runtime.canPrepare())
          return original.get(surface)?.payload
        const payload = plan.payload
        if (typeof payload !== "string") return original.get(surface)?.payload
        const statement = database.prepare<PayloadRow, string[]>(conditionalSql, [payload, surface])
        if (!runtime.accepts(database, statement, 2)) {
          runtime.finalize(statement)
          return original.get(surface)?.payload
        }
        entry = { plan, statement, units }
        entries[surface] = entry
        nativeUnits += units
      }
      // One fresh SELECT. In particular, an error or a miss never triggers a
      // second SELECT and never substitutes a previously decoded object graph.
      const row = entry.statement.get()
      return row?.storageType === "text" && row.payload === null ? plan.payload : row?.payload
    },
    close() {
      for (let index = 0; index < surfaces.length; index++) {
        const surface = surfaces[index]
        if (surface !== undefined) drop(surface)
      }
      retainedUnits = 0
    },
  }
}
