import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { createSfBusinessServices } from "../../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { capturedContextLoadingModes, runSfCaptureLoadingControl } from "../../../../../../../apps/cli/test/fixture/sucafina-captured-context-loading.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { prepareSfCapturedContextIdentity } from "../../../../product/host-binding/captured-context-identity.ts"
import { readSfMemoryCaptureIntegrity } from "../../../../product/host-binding/business-context.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"

const property = Object.getOwnPropertyDescriptor
const define = Object.defineProperty
const remove = Reflect.deleteProperty
const apply = Reflect.apply

function withProperty<Value>(owner: object, key: PropertyKey, replacement: PropertyDescriptor, work: () => Value): Value {
  const saved = property(owner, key)
  define(owner, key, replacement)
  try { return work() } finally {
    if (saved) define(owner, key, saved)
    else remove(owner, key)
  }
}

function withValue<Value>(owner: object, key: PropertyKey, value: unknown, work: () => Value): Value {
  const saved = property(owner, key)
  if (!saved || !Object.hasOwn(saved, "value")) throw new Error("Expected an own data property")
  return withProperty(owner, key, { ...saved, value }, work)
}

test("capture binds the original bytes before its first comparison and keeps later comparisons fresh", () => {
  const source = { values: [{ total: 10 }], optional: undefined }
  const same = prepareSfCapturedContextIdentity(source)
  source.values[0]!.total = 20
  expect(same(source)).toBe(false)
  expect(same({ optional: undefined, values: [{ total: 10 }] })).toBe(true)
  source.values[0]!.total = 10
  expect(same(source)).toBe(true)
  source.values.push({ total: 30 })
  expect(same(source)).toBe(false)
  expect(same({ values: [{ total: 10 }] })).toBe(false)
})

test("aliases remain private while distinct equivalent objects keep canonical equality", () => {
  const shared = { amount: -0, absent: undefined, nested: [null, true, "quote\"\n"] }
  const source = { left: shared, right: shared }
  const expected = digestSfValue(source)
  const same = prepareSfCapturedContextIdentity(source)
  shared.nested[0] = "changed"
  expect(same(source)).toBe(false)
  const equivalent = { right: { amount: -0, absent: undefined, nested: [null, true, "quote\"\n"] },
    left: { amount: -0, absent: undefined, nested: [null, true, "quote\"\n"] } }
  expect(digestSfValue(equivalent)).toBe(expected)
  expect(same(equivalent)).toBe(true)
  equivalent.right.amount = 0
  expect(same(equivalent)).toBe(false)
})

test("null prototypes, own __proto__, undefined and negative zero retain tagged distinctions", () => {
  const source = Object.create(null)
  define(source, "__proto__", { value: { count: -0 }, enumerable: true, configurable: true })
  define(source, "optional", { value: undefined, enumerable: true, configurable: true })
  const same = prepareSfCapturedContextIdentity(source)
  const equivalent = JSON.parse('{"__proto__":{"count":0}}')
  equivalent.__proto__.count = -0
  equivalent.optional = undefined
  expect(same(equivalent)).toBe(true)
  equivalent.__proto__.count = 0
  expect(same(equivalent)).toBe(false)
  expect(prepareSfCapturedContextIdentity(undefined)(undefined)).toBe(true)
  expect(prepareSfCapturedContextIdentity(undefined)(null)).toBe(false)
  expect(prepareSfCapturedContextIdentity(-0)(0)).toBe(false)
})

test("cycles, Date and nonfinite values are rejected during preparation without a consumer", () => {
  const cycle: { next?: unknown } = {}
  cycle.next = cycle
  expect(() => prepareSfCapturedContextIdentity(cycle)).toThrow()
  expect(() => prepareSfCapturedContextIdentity(new Date("2027-01-01T00:00:00Z"))).toThrow("SF_CANONICAL_UNSUPPORTED")
  for (const value of [NaN, Infinity, -Infinity]) {
    expect(() => prepareSfCapturedContextIdentity({ value })).toThrow("SF_CANONICAL_NONFINITE")
  }
  expect(() => prepareSfCapturedContextIdentity({ value: 1n })).toThrow("SF_CANONICAL_UNSUPPORTED")
  expect(() => prepareSfCapturedContextIdentity({ value: () => 1 })).toThrow("SF_CANONICAL_UNSUPPORTED")
})

test("an enumerable accessor follows the eager canonical getter order exactly", () => {
  const reads: string[] = []
  const source = { get z() { reads.push("z"); return 2 }, get a() { reads.push("a"); return 1 } }
  const expected = digestSfValue(source)
  const canonicalReads = reads.slice()
  reads.length = 0
  const same = prepareSfCapturedContextIdentity(source)
  expect(reads).toEqual(canonicalReads)
  expect(reads).toEqual(["a", "z"])
  reads.length = 0
  expect(same(source)).toBe(true)
  expect(reads).toEqual(canonicalReads)
  expect(expected).toBe(digestSfValue({ a: 1, z: 2 }))
})

test("a getter introduced after capture is read on every comparison", () => {
  const source = { amount: 1 }
  const same = prepareSfCapturedContextIdentity(source)
  let reads = 0, amount = 1
  define(source, "amount", { get: () => { reads++; return amount }, enumerable: true, configurable: true })
  expect(same(source)).toBe(true)
  expect(reads).toBe(1)
  amount = 2
  expect(same(source)).toBe(false)
  expect(reads).toBe(2)
  amount = 1
  expect(same(source)).toBe(true)
  expect(reads).toBe(3)
})

test("Proxy fallback adds no traps before the original canonical observation", () => {
  for (const nested of [false, true]) {
    const events: string[] = []
    const proxy = new Proxy({ count: 1 }, {
      getPrototypeOf(target) { events.push("prototype"); return Reflect.getPrototypeOf(target) },
      ownKeys(target) { events.push("keys"); return Reflect.ownKeys(target) },
      getOwnPropertyDescriptor(target, key) { events.push("descriptor:" + String(key)); return property(target, key) },
      get(target, key, receiver) { events.push("get:" + String(key)); return Reflect.get(target, key, receiver) },
    })
    const source = nested ? { nested: proxy } : proxy
    digestSfValue(source)
    const expected = events.slice()
    events.length = 0
    const same = prepareSfCapturedContextIdentity(source)
    expect(events).toEqual(expected)
    events.length = 0
    expect(same(source)).toBe(true)
    expect(events).toEqual(expected)
  }
})

test("a rejecting Proxy retains the original refusal and zero additional traps", () => {
  let traps = 0
  const source = new Proxy({}, { getPrototypeOf() { traps++; throw new Error("opaque rejection") } })
  expect(() => digestSfValue(source)).toThrow("opaque rejection")
  const expected = traps
  traps = 0
  expect(() => prepareSfCapturedContextIdentity(source)).toThrow("opaque rejection")
  expect(traps).toBe(expected)
  expect(traps).toBe(1)
})

test("own array map and sparse slots retain immediate canonical semantics", () => {
  const nativeMap = Array.prototype.map
  const source = [1, 2]
  let calls = 0
  define(source, "map", { value: function(this: number[], ...args: Parameters<typeof nativeMap>) {
    calls++
    return apply(nativeMap, this, args)
  }, configurable: true })
  digestSfValue(source)
  const expected = calls
  calls = 0
  const same = prepareSfCapturedContextIdentity(source)
  expect(calls).toBe(expected)
  expect(calls).toBe(1)
  expect(same(source)).toBe(true)
  expect(calls).toBe(2)
  const sparse = Array(2)
  sparse[1] = undefined
  const sparseSame = prepareSfCapturedContextIdentity(sparse)
  expect(sparseSame(sparse)).toBe(true)
  expect(sparseSame([undefined, undefined])).toBe(false)
})

test("inherited array slots keep the original map behavior and restore prototype length", () => {
  const length = property(Array.prototype, "length")!
  const source = Array(1)
  let observed: { canonical: string; prepared: boolean } | undefined
  try {
    observed = withProperty(Array.prototype, "0", { value: "inherited", writable: true, configurable: true }, () => {
      const canonical = digestSfValue(source)
      const same = prepareSfCapturedContextIdentity(source)
      return { canonical, prepared: same(source) }
    })
  } finally { define(Array.prototype, "length", length) }
  expect(observed?.prepared).toBe(true)
  expect(observed?.canonical).toBe(digestSfValue(["inherited"]))
  expect(prepareSfCapturedContextIdentity(source)([undefined])).toBe(false)
})

test("changed canonical methods use the original eager path with identical hook counts", () => {
  const hooks = [
    { owner: JSON, key: "stringify", value: JSON.stringify },
    { owner: Object, key: "keys", value: Object.keys },
    { owner: Object, key: "getPrototypeOf", value: Object.getPrototypeOf },
    { owner: Object, key: "is", value: Object.is },
    { owner: Array, key: "isArray", value: Array.isArray },
    { owner: Array.prototype, key: "map", value: Array.prototype.map },
    { owner: Array.prototype, key: "sort", value: Array.prototype.sort },
    { owner: Array.prototype, key: "includes", value: Array.prototype.includes },
  ]
  for (const hook of hooks) {
    let calls = 0
    const replacement = new Proxy(hook.value, { apply(target, receiver, args) {
      calls++
      return apply(target, receiver, args)
    } })
    const source = { z: [1, -0], a: undefined }
    const result = withValue(hook.owner, hook.key, replacement, () => {
      digestSfValue(source)
      const canonical = calls
      calls = 0
      const same = prepareSfCapturedContextIdentity(source)
      const preparation = calls
      calls = 0
      const matches = same(source)
      return { canonical, preparation, comparison: calls, matches }
    })
    expect(result.canonical).toBeGreaterThan(0)
    expect(result.preparation).toBe(result.canonical)
    expect(result.comparison).toBe(result.canonical)
    expect(result.matches).toBe(true)
  }
})

test("prototype toJSON and species hooks retain eager canonical observation", () => {
  for (const owner of [Object.prototype, Array.prototype]) {
    let calls = 0
    const source = { values: [1, 2] }
    const result = withProperty(owner, "toJSON", { configurable: true, value: function(this: unknown) { calls++; return this } }, () => {
      digestSfValue(source)
      const canonical = calls
      calls = 0
      const same = prepareSfCapturedContextIdentity(source)
      return { canonical, preparation: calls, matches: same(source) }
    })
    expect(result.canonical).toBeGreaterThan(0)
    expect(result.preparation).toBe(result.canonical)
    expect(result.matches).toBe(true)
  }
  let reads = 0
  const source = { values: [1, 2] }
  const result = withProperty(Array, Symbol.species, { configurable: true, get() { reads++; return Array } }, () => {
    digestSfValue(source)
    const canonical = reads
    reads = 0
    const same = prepareSfCapturedContextIdentity(source)
    return { canonical, preparation: reads, matches: same(source) }
  })
  expect(result.canonical).toBeGreaterThan(0)
  expect(result.preparation).toBe(result.canonical)
  expect(result.matches).toBe(true)
})


for (const mode of capturedContextLoadingModes)
  test("original canonical bootstrap precedes the isolated helper: " + mode, async () => {
    const receipt = await runSfCaptureLoadingControl(import.meta.path, mode)
    const limited = mode === "bootstrap-api-absent" || mode === "bootstrap-api-accessor"
    expect(receipt.mode).toBe(mode)
    expect(Number.isSafeInteger(receipt.pid) && receipt.pid > 0).toBe(true)
    expect(receipt.pid).not.toBe(process.pid)
    expect(receipt.omniSpawns).toBe(1)
    expect(receipt.omniDelegations).toBe(0)
    expect(receipt.order).toEqual([
      ...(limited ? ["bootstrap-limited"] : []),
      "canonical-loaded", "hook-arranged", "helper-loaded", "prepared", "changed", "compared", "restored",
    ])
    expect(receipt.beforeHookAdmitted).toBe(!limited)
    expect(receipt.bundleFrozen).toBe(!limited)
    expect(receipt.duringHookAdmitted).toBe(mode === "clean")
    expect(receipt.restoredAdmitted).toBe(!limited)
    expect(receipt.loadHookCalls).toBe(0)
    expect(receipt.preparationHookCalls).toBe(receipt.originalHookCalls)
    expect(receipt.preparationTraps).toEqual(receipt.originalTraps)
    expect(receipt.originalMatches).toBe(false)
    expect(receipt.actualMatches).toBe(false)
    expect(receipt.bootstrapGetterCalls).toBe(0)
  })

test("a hasher hook present at preparation is invoked immediately by the original path", () => {
  let constructors = 0
  const replacement = new Proxy(Bun.CryptoHasher, { construct(target, args) {
    constructors++
    return Reflect.construct(target, args)
  } })
  const source = { values: [1, 2] }
  const result = withValue(Bun, "CryptoHasher", replacement, () => {
    const same = prepareSfCapturedContextIdentity(source)
    const preparation = constructors
    return { preparation, matches: same(source), total: constructors }
  })
  expect(result.preparation).toBe(1)
  expect(result.matches).toBe(true)
  expect(result.total).toBe(2)
})

test("runtime changes after preparation refuse the private proof without invoking changed methods", () => {
  const hooks = [
    { owner: JSON, key: "stringify", value: JSON.stringify },
    { owner: Object, key: "keys", value: Object.keys },
    { owner: Object, key: "is", value: Object.is },
    { owner: Array.prototype, key: "map", value: Array.prototype.map },
    { owner: Bun.CryptoHasher.prototype, key: "update", value: Bun.CryptoHasher.prototype.update },
    { owner: Bun.CryptoHasher.prototype, key: "digest", value: Bun.CryptoHasher.prototype.digest },
  ]
  for (const hook of hooks) {
    const source = { values: [1, 2] }, same = prepareSfCapturedContextIdentity(source)
    let calls = 0
    const replacement = new Proxy(hook.value, { apply(target, receiver, args) {
      calls++
      return apply(target, receiver, args)
    } })
    const matches = withValue(hook.owner, hook.key, replacement, () => same(source))
    expect(matches).toBe(false)
    expect(calls).toBe(0)
  }
  for (const owner of [Object.prototype, Array.prototype]) {
    const source = { values: [1, 2] }, same = prepareSfCapturedContextIdentity(source)
    let calls = 0
    const matches = withProperty(owner, "toJSON", { configurable: true, value() { calls++; return "changed" } }, () => same(source))
    expect(matches).toBe(false)
    expect(calls).toBe(0)
  }
  const source = { values: [1, 2] }, same = prepareSfCapturedContextIdentity(source)
  let constructors = 0
  const replacement = new Proxy(Bun.CryptoHasher, { construct(target, args) {
    constructors++
    return Reflect.construct(target, args)
  } })
  const matches = withValue(Bun, "CryptoHasher", replacement, () => same(source))
  expect(matches).toBe(false)
  expect(constructors).toBe(0)
})

/** Real SQLite, the shipped authority and BCS factories, with an explicit
 * authentication fixture. Empty capture selection isolates this integrity
 * boundary; it is not installed Microsoft or nonempty memory qualification. */
test("BCS keeps the one-shot capture, original snapshot and real late reauthorization", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-captured-context-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  let disposeBusiness = () => {}
  try {
    const at = "2027-02-02T00:00:00Z"
    const persistence = { ...store, ...createSfSourcePersistence({ persistence: store, createId: randomUUID,
      enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) }) }
    for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
    const control = { active: true, authentications: 0, revalidations: 0, revokeAfterSuccess: false }
    const identity = { installationId: "capture-installation", hostId: "host", projectId: "project",
      location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
    const authority = createSfProductAuthority({
      identity: () => identity, installationId: identity.installationId, origin: "https://capture.example.test",
      policyVersion: "capture-policy", persistence,
      grants: [{ principalRef: "person", namespaces: ["cases", "atlas", "outbox", "preferences"],
        operations: ["sf_context_get"], humanActions: [] }],
      authenticate: async (_request, scope) => {
        control.authentications++
        return control.active && scope ? { id: "person", canWrite: true, roles: [{ surface: scope.surface, role: "admin" }] } : null
      },
      environment: async () => ({ at, id: randomUUID, directory: [] }), createId: randomUUID, now: Date.now,
      commandIdentity: async () => randomUUID(), inspectSession: async () => undefined, verifySelection: async () => false,
      verifySkillReceipt: async () => false, providerGeneration: async () => 1, authorizeDocument: async () => undefined,
    })
    const revalidate = authority.host.revalidate
    authority.host.revalidate = async (call) => {
      control.revalidations++
      const result = await revalidate(call)
      if (result && control.revokeAfterSuccess) {
        control.revokeAfterSuccess = false
        control.active = false
      }
      return result
    }
    const business = createSfBusinessServices({ authority, persistence, proposalCoverageWrites: new WeakSet<object>() })
    disposeBusiness = business.dispose
    business.initializeAtlas(undefined, { boundaryVersion: "fixture", schemaVersion: "fixture", manifestVersion: "fixture", skillVersion: "fixture" })
    if (!persistence.transactionAll) throw new Error("The SQLite all-surface transaction is required")
    for (const mode of ["intact", "mutated", "revoked", "late-revoked"] as const) {
      control.active = true
      control.revokeAfterSuccess = false
      const payload = { refs: [] }, digest = digestSfValue(payload)
      const request = new Request("https://capture.example.test/context", { method: "POST", headers: { origin: "https://capture.example.test" } })
      const admitted = await authority.ui.admit(request, "sf_context_get", digest)
      if (admitted.status !== "ok") throw new Error("Capture fixture admission failed")
      const call = admitted.value
      try {
        expect(await authority.ui.validate(call, "sf_context_get", digest)).toBe(true)
        await persistence.transactionAll(async () => {
          const sources = await business.context.context(payload, call)
          expect(sources).toEqual([])
          const before = { authentications: control.authentications, revalidations: control.revalidations }
          if (mode === "mutated") define(sources, "0", { value: null, enumerable: true, configurable: true, writable: true })
          if (mode === "revoked") control.active = false
          if (mode === "late-revoked") control.revokeAfterSuccess = true
          const result = await readSfMemoryCaptureIntegrity(sources, { caseRefs: [], query: "" }, call)
          if (mode === "intact") {
            expect(result).toBe(true)
            expect(control.revalidations - before.revalidations).toBe(2)
            expect(control.authentications).toBeGreaterThan(before.authentications)
            expect(await readSfMemoryCaptureIntegrity(sources, { caseRefs: [], query: "" }, call)).toBe(false)
          } else {
            expect(result).toBe(false)
            if (mode === "mutated") expect(control.revalidations).toBe(before.revalidations)
            else {
              expect(control.authentications).toBeGreaterThan(before.authentications)
              expect(control.revalidations - before.revalidations).toBe(mode === "late-revoked" ? 2 : 1)
            }
          }
          return { commit: false, value: undefined }
        })
      } finally { authority.ui.finish(call) }
    }
  } finally {
    disposeBusiness()
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
