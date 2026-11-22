/** Test-only process boundary. The child has no SF static imports and loads the
 * original canonical module before arranging a hook and loading the helper. */
export const capturedContextLoadingModes = [
  "clean", "object-tojson", "array-tojson", "stateful-map", "stateful-keys",
  "copy-descriptors", "reflection-descriptor", "proxy-checker", "stateful-hasher",
  "bootstrap-api-absent", "bootstrap-api-accessor",
] as const
type LoadingMode = typeof capturedContextLoadingModes[number]

type LoadingReceipt = {
  mode: LoadingMode
  pid: number
  order: string[]
  beforeHookAdmitted: boolean
  duringHookAdmitted: boolean
  restoredAdmitted: boolean
  bundleFrozen: boolean
  loadHookCalls: number
  originalHookCalls: number
  preparationHookCalls: number
  positivePreparationHookCalls: number
  unchangedHookCalls: number
  unchangedMatches: boolean
  originalTraps: string[]
  preparationTraps: string[]
  positivePreparationTraps: string[]
  unchangedTraps: string[]
  originalMatches: boolean
  actualMatches: boolean
  bootstrapGetterCalls: number
}

export async function runSfCaptureLoadingControl(file: string, mode: LoadingMode): Promise<LoadingReceipt & { omniSpawns: number; omniDelegations: number }> {
  // These imports belong only to the parent. They cannot preload SF in the child.
  const [{ AppProcess }, { LayerNode }, { expectSpawn }, { Effect }, { ChildProcess }, { Omni }] = await Promise.all([
    import("@orchestra/core/process"), import("@orchestra/core/effect/layer-node"),
    import("@orchestra/core/test/fixture/omni-expect"), import("effect"), import("effect/unstable/process"),
    import("@orchestra/core/omni"),
  ])
  expectSpawn(file)
  const before = Omni.snapshot()
  const result = await Effect.runPromise(Effect.scoped(Effect.provide(Effect.gen(function* () {
    const processes = yield* AppProcess.Service
    return yield* processes.run(ChildProcess.make(process.execPath, [import.meta.path, mode], {
      cwd: import.meta.dir, extendEnv: true, stdin: "ignore", stdout: "pipe", stderr: "pipe",
      killSignal: "SIGTERM", forceKillAfter: "1 second",
    }), { timeout: 3_000, maxOutputBytes: 65_536, maxErrorBytes: 65_536 })
  }), LayerNode.compile(AppProcess.node))))
  const after = Omni.snapshot()
  const stdout = result.stdout.toString("utf8"), stderr = result.stderr.toString("utf8")
  if (result.exitCode !== 0 || result.stdoutTruncated || result.stderrTruncated)
    throw new Error("Captured context child did not complete: " + JSON.stringify({
      mode, exitCode: result.exitCode, stdoutTruncated: result.stdoutTruncated,
      stderrTruncated: result.stderrTruncated, stdout, stderr,
    }))
  const receipt: unknown = JSON.parse(stdout)
  if (!receipt || typeof receipt !== "object" || !("mode" in receipt) || receipt.mode !== mode)
    throw new Error("Captured context child returned an invalid receipt")
  return { ...(receipt as LoadingReceipt),
    omniSpawns: after.spawns - before.spawns, omniDelegations: after.delegations - before.delegations }
}

async function child(mode: LoadingMode): Promise<LoadingReceipt> {
  const property = Object.getOwnPropertyDescriptor, define = Object.defineProperty
  const remove = Reflect.deleteProperty, apply = Reflect.apply
  const originalMap = Array.prototype.map, originalKeys = Object.keys
  const originalDescriptors = Object.getOwnPropertyDescriptors
  const originalReflectPrototype = Reflect.getPrototypeOf, originalReflectKeys = Reflect.ownKeys
  const originalReflectDescriptor = Reflect.getOwnPropertyDescriptor, originalReflectGet = Reflect.get
  let restoreBootstrap = () => {}, restoreHook = () => {}
  let bootstrapGetterCalls = 0, calls = 0, collapse = false
  const order: string[] = [], traps: string[] = []
  const limitedBootstrap = mode === "bootstrap-api-absent" || mode === "bootstrap-api-accessor"
  function replace(owner: object, key: PropertyKey, replacement: PropertyDescriptor) {
    const saved = property(owner, key)
    define(owner, key, replacement)
    return () => { if (saved) define(owner, key, saved); else remove(owner, key) }
  }
  function replaceValue(owner: object, key: PropertyKey, value: unknown) {
    const saved = property(owner, key)
    if (!saved || !Object.hasOwn(saved, "value")) throw new Error("Expected an own runtime data property")
    return replace(owner, key, { ...saved, value })
  }
  if (limitedBootstrap) {
    const saved = property(process, "getBuiltinModule")
    if (!saved || !Object.hasOwn(saved, "value")) throw new Error("The pinned Bun backend lookup is required")
    restoreBootstrap = mode === "bootstrap-api-absent"
      ? replaceValue(process, "getBuiltinModule", undefined)
      : replace(process, "getBuiltinModule", { configurable: true, get() { bootstrapGetterCalls++; return saved.value } })
    order.push("bootstrap-limited")
  }
  try {
    const canonical = await import("../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts")
    order.push("canonical-loaded")
    restoreBootstrap()
    restoreBootstrap = () => {}
    const before = canonical.sfCanonicalCaptureRuntime()
    const beforeHookAdmitted = !!before, bundleFrozen = !!before && Object.isFrozen(before)
    const target = { x: 1, values: [1, 2] }
    const source = mode === "proxy-checker" ? new Proxy(target, {
      getPrototypeOf(value) { traps.push("prototype"); return originalReflectPrototype(value) },
      ownKeys(value) { traps.push("keys"); return originalReflectKeys(value) },
      getOwnPropertyDescriptor(value, key) { traps.push("descriptor:" + String(key)); return originalReflectDescriptor(value, key) },
      get(value, key, receiver) { traps.push("get:" + String(key)); return originalReflectGet(value, key, receiver) },
    }) : target
    if (mode === "object-tojson" || mode === "array-tojson") {
      restoreHook = replace(mode === "object-tojson" ? Object.prototype : Array.prototype, "toJSON", {
        configurable: true, value: function(this: unknown) { calls++; return this },
      })
    } else if (mode === "stateful-map") {
      restoreHook = replaceValue(Array.prototype, "map", function(this: unknown[], ...args: unknown[]) {
        calls++
        return collapse ? [] : apply(originalMap, this, args)
      })
    } else if (mode === "stateful-keys") {
      restoreHook = replaceValue(Object, "keys", (value: object) => {
        calls++
        return collapse ? [] : originalKeys(value)
      })
    } else if (mode === "copy-descriptors") {
      restoreHook = replaceValue(Object, "getOwnPropertyDescriptors", (value: object) => {
        calls++
        const result = originalDescriptors(value)
        if (value === target) result.x = { ...result.x, value: 2 }
        return result
      })
    } else if (mode === "reflection-descriptor") {
      restoreHook = replaceValue(Object, "getOwnPropertyDescriptor", (...args: Parameters<typeof property>) => {
        calls++
        return apply(property, Object, args)
      })
    } else if (mode === "proxy-checker") {
      const proxyTypes: unknown = process.getBuiltinModule("node:util/types")
      if (!proxyTypes || typeof proxyTypes !== "object") throw new Error("The builtin proxy checker is required")
      restoreHook = replaceValue(proxyTypes, "isProxy", () => { calls++; return false })
    } else if (mode === "stateful-hasher" || limitedBootstrap) {
      const constructor = Bun.CryptoHasher
      restoreHook = replaceValue(Bun, "CryptoHasher", new Proxy(constructor, { construct(value, args) {
        calls++
        if (collapse) return { update() { return this }, digest() { return "changed-hasher" } }
        return Reflect.construct(value, args)
      } }))
    }
    order.push("hook-arranged")
    const duringHookAdmitted = !!canonical.sfCanonicalCaptureRuntime()
    calls = 0
    traps.length = 0
    const original = canonical.digestSfValue(source)
    const originalHookCalls = calls, originalTraps = [...traps]
    calls = 0
    traps.length = 0
    const helper = await import("../../../../modules/sucafina/Sucafinav1/product/host-binding/captured-context-identity.ts")
    order.push("helper-loaded")
    const loadHookCalls = calls
    calls = 0
    const same = helper.prepareSfCapturedContextIdentity(source)
    const preparationHookCalls = calls, preparationTraps = [...traps]
    order.push("cold-prepared")
    // The first matcher stays unconsumed until the change. A positive must not
    // warm its deferred baseline and hide the original stateful-hook finding.
    calls = 0
    traps.length = 0
    const sameUnchanged = helper.prepareSfCapturedContextIdentity(source)
    const positivePreparationHookCalls = calls, positivePreparationTraps = [...traps]
    order.push("positive-prepared")
    calls = 0
    traps.length = 0
    const unchangedMatches = sameUnchanged(source)
    const unchangedHookCalls = calls, unchangedTraps = [...traps]
    order.push("positive-compared")
    target.x = 2
    collapse = mode === "stateful-map" || mode === "stateful-keys" || mode === "stateful-hasher"
    order.push("changed")
    const originalMatches = original === canonical.digestSfValue(source)
    const actualMatches = same(source)
    order.push("cold-compared")
    restoreHook()
    restoreHook = () => {}
    order.push("restored")
    const restoredAdmitted = !!canonical.sfCanonicalCaptureRuntime()
    return {
      mode, pid: process.pid, order, beforeHookAdmitted, duringHookAdmitted, restoredAdmitted, bundleFrozen,
      loadHookCalls, originalHookCalls, preparationHookCalls, originalTraps, preparationTraps,
      positivePreparationHookCalls, positivePreparationTraps, unchangedHookCalls, unchangedTraps, unchangedMatches,
      originalMatches, actualMatches, bootstrapGetterCalls,
    }
  } finally {
    restoreHook()
    restoreBootstrap()
  }
}

if (import.meta.main) {
  const mode = process.argv[2]
  if (!capturedContextLoadingModes.some((entry) => entry === mode)) throw new Error("Unknown captured context loading mode")
  const receipt = await child(mode as LoadingMode)
  process.stdout.write(JSON.stringify(receipt) + "\n")
}
