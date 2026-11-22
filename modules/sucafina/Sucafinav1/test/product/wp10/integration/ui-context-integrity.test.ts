import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { createSfUiAuthority, observeSfUiContextIntegrity } from "../../../../product/integration/ui-authority.ts"

const property = Object.getOwnPropertyDescriptor, define = Object.defineProperty
const species = Symbol.species
const freshIdentity = () => ({
  installationId: "installation", projectId: "project", principalRef: "operator",
  policyVersion: "policy-1", accessRevision: "access-1",
})
async function fixture(beforeCommand: (identity: ReturnType<typeof freshIdentity>) => void = () => {}) {
  const identity = freshIdentity(), controller = new AbortController()
  const control = { active: true, now: Date.parse("2027-02-02T00:00:00Z"), authorizations: 0 }
  const request = new Request("https://integrity.example.test/planner", { method: "POST", signal: controller.signal })
  const operation = "sf_case_read", inputDigest = digestSfValue({})
  let sequence = 0
  const authority = createSfUiAuthority({
    authorize: async () => { control.authorizations++; return control.active ? identity : undefined },
    commandIdentity: async () => { beforeCommand(identity); return "command" },
    createId: () => "request-" + ++sequence, now: () => control.now,
  })
  const admitted = await authority.admit(request, operation, inputDigest)
  if (admitted.status !== "ok") throw new Error("integrity fixture admission failed")
  const call = admitted.value
  if (!await authority.validate(call, operation, inputDigest)) throw new Error("integrity fixture validation failed")
  return { authority, call, request, identity, controller, control, operation, inputDigest }
}
function withProperty<Value>(owner: object, key: PropertyKey, replacement: PropertyDescriptor, work: () => Value): Value {
  const saved = property(owner, key)
  define(owner, key, replacement)
  try { return work() } finally {
    if (saved) define(owner, key, saved)
    else Reflect.deleteProperty(owner, key)
  }
}
function withValue<Value>(owner: object, key: PropertyKey, value: unknown, work: () => Value): Value {
  const saved = property(owner, key)
  if (!saved || !Object.hasOwn(saved, "value")) throw new Error("expected own data property")
  return withProperty(owner, key, { ...saved, value }, work)
}
async function withAsyncValue<Value>(owner: object, key: PropertyKey, value: unknown, work: () => Promise<Value>): Promise<Value> {
  const saved = property(owner, key)
  if (!saved || !Object.hasOwn(saved, "value")) throw new Error("expected own data property")
  define(owner, key, { ...saved, value })
  try { return await work() } finally { define(owner, key, saved) }
}

test("immutable UI integrity remains separate from live admission and revocation", async () => {
  for (const action of ["finish", "expiry", "abort", "revoke"] as const) {
    const f = await fixture(), observed = observeSfUiContextIntegrity(f.call)
    expect(observed.digest).toBe(digestSfValue([f.call.kind, f.call.binding]))
    expect(f.authority.requestFor(f.call)).toBe(f.request)
    const authorizations = f.control.authorizations
    expect(observed.current()).toBe(true)
    expect(observed.current()).toBe(true)
    expect(f.control.authorizations).toBe(authorizations)
    if (action === "finish") f.authority.finish(f.call)
    if (action === "expiry") f.control.now += 5 * 60 * 1000
    if (action === "abort") f.controller.abort()
    if (action === "revoke") f.control.active = false
    expect(observed.current()).toBe(true)
    expect(await f.authority.revalidate(f.call)).toBe(false)
    expect(f.authority.requestFor(f.call)).toBeUndefined()
    expect(f.authority.matchesIntent(f.call, f.operation, f.inputDigest)).toBe(false)
    expect(await f.authority.validate(f.call, f.operation, f.inputDigest)).toBe(false)
  }
})

test("opaque contexts retain kind/binding getter order and the Root's already captured binding", async () => {
  const { call } = await fixture(), changed = { ...call.binding, principalRef: "changed" }
  const reads: string[] = []
  let binding = call.binding
  const opaque = { ...call }
  define(opaque, "kind", { get: () => { reads.push("kind"); return "ui" } })
  define(opaque, "binding", { get: () => { reads.push("binding"); return binding } })
  const observed = observeSfUiContextIntegrity(opaque)
  expect(reads).toEqual(["kind", "binding"])
  reads.length = 0
  expect(observed.current()).toBe(true)
  expect(reads).toEqual(["kind", "binding"])
  binding = changed
  expect(observed.current()).toBe(false)

  const alternating = { ...call }
  let bindingReads = 0
  reads.length = 0
  define(alternating, "kind", { get: () => { reads.push("kind"); return "ui" } })
  define(alternating, "binding", { get: () => {
    reads.push("binding")
    return ++bindingReads === 1 ? call.binding : changed
  } })
  const capturedBinding = alternating.binding
  const rootObservation = observeSfUiContextIntegrity(alternating, { binding: capturedBinding })
  expect(reads).toEqual(["binding", "kind"])
  expect(bindingReads).toBe(1)
  reads.length = 0
  expect(rootObservation.current()).toBe(false)
  expect(reads).toEqual(["kind", "binding"])
  expect(bindingReads).toBe(2)
  expect(observeSfUiContextIntegrity(call, { binding: changed }).current()).toBe(false)

  const native = { ...call, binding: { ...call.binding } }
  define(native, "kind", { value: "native" })
  const nativeObservation = observeSfUiContextIntegrity(native)
  native.binding.principalRef = "changed"
  expect(nativeObservation.current()).toBe(false)
})

test("mint inspects values after commandIdentity and the actual freeze result", async () => {
  const nested = { value: "original" }
  const late = await fixture((identity) => { define(identity, "principalRef", { value: nested }) })
  const lateObservation = observeSfUiContextIntegrity(late.call)
  expect(lateObservation.current()).toBe(true)
  nested.value = "changed"
  expect(lateObservation.current()).toBe(false)

  const mutable = await withAsyncValue(Object, "freeze", <Value>(value: Value) => value, () => fixture())
  const mutableObservation = observeSfUiContextIntegrity(mutable.call)
  define(mutable.call.binding, "principalRef", { value: "changed" })
  expect(mutableObservation.current()).toBe(false)

  let principal = "operator"
  const accessorFreeze = new Proxy(Object.freeze, { apply(target, receiver, args) {
    const value = args[0]
    if (value && typeof value === "object" && Object.hasOwn(value, "requestId"))
      define(value, "principalRef", { get: () => principal, enumerable: true, configurable: true })
    return Reflect.apply(target, receiver, args)
  } })
  const accessor = await withAsyncValue(Object, "freeze", accessorFreeze, () => fixture())
  const accessorObservation = observeSfUiContextIntegrity(accessor.call)
  principal = "changed"
  expect(accessorObservation.current()).toBe(false)

  let proxyReads = 0
  const proxyFreeze = new Proxy(Object.freeze, { apply(target, receiver, args) {
    const value = Reflect.apply(target, receiver, args)
    return value && typeof value === "object" && Object.hasOwn(value, "requestId")
      ? new Proxy(value, { get(target, key, receiver) {
        if (key === "principalRef") proxyReads++
        return Reflect.get(target, key, receiver)
      } }) : value
  } })
  const proxied = await withAsyncValue(Object, "freeze", proxyFreeze, () => fixture())
  const proxyObservation = observeSfUiContextIntegrity(proxied.call), previousReads = proxyReads
  expect(proxyObservation.current()).toBe(true)
  expect(proxyReads).toBeGreaterThan(previousReads)
})

test("serializer changes and inherited hooks retain the original canonical path", async () => {
  const { call } = await fixture(), observed = observeSfUiContextIntegrity(call)
  const hooks = [
    { owner: JSON, key: "stringify", value: JSON.stringify },
    { owner: Object, key: "keys", value: Object.keys },
    { owner: Object, key: "getPrototypeOf", value: Object.getPrototypeOf },
    { owner: Array, key: "isArray", value: Array.isArray },
    { owner: Array.prototype, key: "map", value: Array.prototype.map },
    { owner: Array.prototype, key: "sort", value: Array.prototype.sort },
    { owner: Array.prototype, key: "includes", value: Array.prototype.includes },
  ]
  for (const hook of hooks) {
    let calls = 0
    const replacement = new Proxy(hook.value, { apply(target, receiver, args) {
      calls++
      return Reflect.apply(target, receiver, args)
    } })
    const current = withValue(hook.owner, hook.key, replacement, () => observed.current())
    expect(current).toBe(true)
    expect(calls).toBeGreaterThan(0)
  }
  let speciesReads = 0
  const speciesDescriptor = property(Array, species)
  if (!speciesDescriptor) throw new Error("missing Array species")
  const speciesCurrent = withProperty(Array, species, { ...speciesDescriptor, get: () => { speciesReads++; return Array } }, () => observed.current())
  expect(speciesCurrent).toBe(true)
  expect(speciesReads).toBeGreaterThan(0)

  let constructorReads = 0
  const constructor = new Proxy(Array, { get(target, key, receiver) {
    if (key === species) constructorReads++
    return Reflect.get(target, key, receiver)
  } })
  const constructorCurrent = withValue(Array.prototype, "constructor", constructor, () => observed.current())
  expect(constructorCurrent).toBe(true)
  expect(constructorReads).toBeGreaterThan(0)

  for (const prototype of [Array.prototype, Object.prototype]) {
    let calls = 0
    const current = withProperty(prototype, "toJSON", {
      configurable: true, value: function (this: unknown) { calls++; return this },
    }, () => observed.current())
    expect(current).toBe(true)
    expect(calls).toBeGreaterThan(0)
  }
  const parent = Object.getPrototypeOf(Array.prototype)
  let prototypeCurrent: boolean
  try {
    Object.setPrototypeOf(Array.prototype, { toJSON: () => "changed" })
    prototypeCurrent = observed.current()
  } finally { Object.setPrototypeOf(Array.prototype, parent) }
  expect(prototypeCurrent).toBe(false)

  const stringify = JSON.stringify
  let getterReads = 0
  const getterCurrent = withProperty(JSON, "stringify", {
    configurable: true, get: () => { getterReads++; return stringify },
  }, () => observed.current())
  expect(getterCurrent).toBe(true)
  expect(getterReads).toBe(1)
  expect(observed.current()).toBe(true)
})

test("CryptoHasher hooks execute on fallback, including its original exception", async () => {
  const { call } = await fixture(), observed = observeSfUiContextIntegrity(call)
  let constructions = 0
  const constructor = new Proxy(Bun.CryptoHasher, { construct(target, args) {
    constructions++
    return Reflect.construct(target, args)
  } })
  const constructorCurrent = withValue(Bun, "CryptoHasher", constructor, () => observed.current())
  expect(constructorCurrent).toBe(true)
  expect(constructions).toBe(1)
  for (const key of ["update", "digest"] as const) {
    let calls = 0
    const replacement = new Proxy(Bun.CryptoHasher.prototype[key], { apply(target, receiver, args) {
      calls++
      return Reflect.apply(target, receiver, args)
    } })
    const current = withValue(Bun.CryptoHasher.prototype, key, replacement, () => observed.current())
    expect(current).toBe(true)
    expect(calls).toBe(1)
  }
  const failure = new Error("original hasher failure")
  const throwing = new Proxy(Bun.CryptoHasher, { construct() { throw failure } })
  expect(() => withValue(Bun, "CryptoHasher", throwing, () => observed.current())).toThrow(failure)
})

test("a temporary hasher or update getter cannot attest a capture made under hooks", async () => {
  const { call } = await fixture(), originalDigest = digestSfValue([call.kind, call.binding])
  const constructorDescriptor = property(Bun, "CryptoHasher")
  if (!constructorDescriptor) throw new Error("missing CryptoHasher descriptor")
  const transient = new Proxy(Bun.CryptoHasher, { construct(target, args) {
    define(Bun, "CryptoHasher", constructorDescriptor)
    const hasher = Reflect.construct(target, args)
    define(hasher, "digest", { value: () => "captured-under-hook", configurable: true })
    return hasher
  } })
  const captured = withValue(Bun, "CryptoHasher", transient, () => observeSfUiContextIntegrity(call))
  expect(captured.digest).toBe("captured-under-hook")
  expect(captured.current()).toBe(false)

  const prototype = Bun.CryptoHasher.prototype
  const updateDescriptor = property(prototype, "update"), stringifyDescriptor = property(JSON, "stringify")
  if (!updateDescriptor || !stringifyDescriptor) throw new Error("missing canonical descriptors")
  let updateReads = 0, serializerCalls = 0
  const restored = withProperty(prototype, "update", {
    configurable: updateDescriptor.configurable, enumerable: updateDescriptor.enumerable,
    get: () => {
      updateReads++
      define(prototype, "update", updateDescriptor)
      define(JSON, "stringify", { ...stringifyDescriptor, value: new Proxy(JSON.stringify, { apply() {
        serializerCalls++
        define(JSON, "stringify", stringifyDescriptor)
        return '"captured-under-update-getter"'
      } }) })
      return updateDescriptor.value
    },
  }, () => {
    try { return observeSfUiContextIntegrity(call) } finally { define(JSON, "stringify", stringifyDescriptor) }
  })
  expect(updateReads).toBe(1)
  expect(serializerCalls).toBe(1)
  expect(restored.digest).not.toBe(originalDigest)
  expect(restored.current()).toBe(false)
})

test("private integrity checks do not consult later Symbol or WeakMap method hooks", async () => {
  const { call } = await fixture(), observed = observeSfUiContextIntegrity(call)
  let symbolReads = 0, mapReads = 0
  const symbolCurrent = withProperty(globalThis, "Symbol", { configurable: true, get: () => {
    symbolReads++
    throw new Error("unexpected Symbol lookup")
  } }, () => observed.current())
  const mapCurrent = withValue(WeakMap.prototype, "get", () => {
    mapReads++
    throw new Error("unexpected WeakMap lookup")
  }, () => observed.current())
  expect(symbolCurrent).toBe(true)
  expect(mapCurrent).toBe(true)
  expect(symbolReads).toBe(0)
  expect(mapReads).toBe(0)
})
