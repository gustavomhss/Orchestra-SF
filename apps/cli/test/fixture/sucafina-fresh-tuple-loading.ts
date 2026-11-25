/** Test-only process boundary. The original canonical module loads before the
 * hook; the tuple helper has no static import in this child. */
export const freshTupleLoadingModes = [
  "clean", "object-tojson", "array-tojson", "stateful-map", "stateful-keys",
  "stateful-hasher", "clone-identity", "reflection-descriptor", "reflection-keys",
  "proxy-checker", "weakmap-get", "bootstrap-api-absent", "bootstrap-api-accessor",
] as const
type LoadingMode = typeof freshTupleLoadingModes[number]
type StageReceipt = {
  phase: string
  original: string
  actual: string
  originalHookCalls: number
  actualHookCalls: number
  originalTraps: string[]
  actualTraps: string[]
}
type LoadingReceipt = {
  mode: LoadingMode
  pid: number
  order: string[]
  beforeHookAdmitted: boolean
  duringHookAdmitted: boolean
  restoredAdmitted: boolean
  loadHookCalls: number
  loadTraps: string[]
  factoryHookCalls: number
  factoryTraps: string[]
  bootstrapGetterCalls: number
  stages: StageReceipt[]
}

export async function runSfFreshTupleLoadingControl(file: string, mode: LoadingMode): Promise<LoadingReceipt & { omniSpawns: number; omniDelegations: number }> {
  // Parent-only imports cannot preload SF in the new process.
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
    throw new Error("Fresh tuple child did not complete: " + JSON.stringify({
      mode, exitCode: result.exitCode, stdoutTruncated: result.stdoutTruncated,
      stderrTruncated: result.stderrTruncated, stdout, stderr,
    }))
  const receipt: unknown = JSON.parse(stdout)
  if (!receipt || typeof receipt !== "object" || !("mode" in receipt) || receipt.mode !== mode)
    throw new Error("Fresh tuple child returned an invalid receipt")
  return { ...(receipt as LoadingReceipt),
    omniSpawns: after.spawns - before.spawns, omniDelegations: after.delegations - before.delegations }
}

async function child(mode: LoadingMode): Promise<LoadingReceipt> {
  const property = Object.getOwnPropertyDescriptor, define = Object.defineProperty
  const remove = Reflect.deleteProperty, apply = Reflect.apply
  const originalMap = Array.prototype.map, originalKeys = Object.keys
  const originalOwnKeys = Reflect.ownKeys, originalWeakGet = WeakMap.prototype.get
  const originalReflectPrototype = Reflect.getPrototypeOf, originalReflectKeys = Reflect.ownKeys
  const originalReflectDescriptor = Reflect.getOwnPropertyDescriptor, originalReflectGet = Reflect.get
  let restoreBootstrap = () => {}, restoreHook = () => {}
  let bootstrapGetterCalls = 0, calls = 0, collapse = false
  const order: string[] = [], traps: string[] = []
  const limited = mode === "bootstrap-api-absent" || mode === "bootstrap-api-accessor"
  let owner: { digest(value: unknown): string; close(): void } | undefined
  function replace(target: object, key: PropertyKey, replacement: PropertyDescriptor) {
    const saved = property(target, key)
    define(target, key, replacement)
    return () => { if (saved) define(target, key, saved); else remove(target, key) }
  }
  function replaceValue(target: object, key: PropertyKey, value: unknown) {
    const saved = property(target, key)
    if (!saved || !Object.hasOwn(saved, "value")) throw new Error("Expected an own runtime data property")
    return replace(target, key, { ...saved, value })
  }
  if (limited) {
    const saved = property(process, "getBuiltinModule")
    if (!saved || !Object.hasOwn(saved, "value")) throw new Error("The pinned Bun backend lookup is required")
    restoreBootstrap = mode === "bootstrap-api-absent"
      ? replaceValue(process, "getBuiltinModule", undefined)
      : replace(process, "getBuiltinModule", { configurable: true, get() { bootstrapGetterCalls++; return saved.value } })
    order.push("bootstrap-limited")
  }
  try {
    const canonical = await import("../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts")
    const copying = await import("../../../../modules/sucafina/Sucafinav1/product/contracts/canonical-clone.ts")
    order.push("canonical-loaded")
    restoreBootstrap()
    restoreBootstrap = () => {}
    const beforeHookAdmitted = !!canonical.sfCanonicalCaptureRuntime() && copying.sfOriginalStructuredCloneCurrent()
    const target = { x: 1, values: [1, 2] }
    const source = mode === "proxy-checker" ? new Proxy(target, {
      getPrototypeOf(value) { traps.push("prototype"); return originalReflectPrototype(value) },
      ownKeys(value) { traps.push("keys"); return originalReflectKeys(value) },
      getOwnPropertyDescriptor(value, key) { traps.push("descriptor:" + String(key)); return originalReflectDescriptor(value, key) },
      get(value, key, receiver) { traps.push("get:" + String(key)); return originalReflectGet(value, key, receiver) },
    }) : target
    if (mode === "object-tojson" || mode === "array-tojson") {
      restoreHook = replace(mode === "object-tojson" ? Object.prototype : Array.prototype, "toJSON", {
        configurable: true, value: function(this: unknown) { calls++; return collapse ? "changed-tojson" : this },
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
    } else if (mode === "stateful-hasher" || limited) {
      const originalHash = property(Bun.CryptoHasher.prototype, "digest")?.value
      if (typeof originalHash !== "function") throw new Error("The original hash method is required")
      restoreHook = replaceValue(Bun.CryptoHasher.prototype, "digest", function(this: unknown, ...args: unknown[]) {
        calls++
        return collapse ? "changed-hasher" : apply(originalHash, this, args)
      })
    } else if (mode === "clone-identity") {
      restoreHook = replaceValue(globalThis, "structuredClone", (value: unknown) => { calls++; return value })
    } else if (mode === "reflection-descriptor") {
      restoreHook = replaceValue(Object, "getOwnPropertyDescriptor", (...args: Parameters<typeof property>) => {
        calls++
        return apply(property, Object, args)
      })
    } else if (mode === "reflection-keys") {
      restoreHook = replaceValue(Reflect, "ownKeys", (value: object) => { calls++; return originalOwnKeys(value) })
    } else if (mode === "proxy-checker") {
      const proxyTypes: unknown = process.getBuiltinModule("node:util/types")
      if (!proxyTypes || typeof proxyTypes !== "object") throw new Error("The builtin proxy checker is required")
      restoreHook = replaceValue(proxyTypes, "isProxy", () => { calls++; return false })
    } else if (mode === "weakmap-get") {
      restoreHook = replaceValue(WeakMap.prototype, "get", function(this: WeakMap<object, unknown>, key: object) {
        if (key === target) calls++
        return apply(originalWeakGet, this, [key])
      })
    }
    order.push("hook-arranged")
    const duringHookAdmitted = !!canonical.sfCanonicalCaptureRuntime() && copying.sfOriginalStructuredCloneCurrent()
    calls = 0
    traps.length = 0
    const helper = await import("../../src/sucafina-product/fresh-tuple-digest.ts")
    order.push("helper-loaded")
    const loadHookCalls = calls, loadTraps = [...traps]
    calls = 0
    traps.length = 0
    const digest = helper.createSfFreshTupleDigest()
    owner = digest
    const factoryHookCalls = calls, factoryTraps = [...traps]
    const stages: StageReceipt[] = []
    function stage(phase: string) {
      calls = 0
      traps.length = 0
      const original = canonical.digestSfValue(source)
      const originalHookCalls = calls, originalTraps = [...traps]
      calls = 0
      traps.length = 0
      const actual = digest.digest(source)
      stages.push({ phase, original, actual, originalHookCalls, originalTraps,
        actualHookCalls: calls, actualTraps: [...traps] })
      order.push(phase)
    }
    stage("cold")
    stage("unchanged")
    // The hook's identity and input bytes stay the same; only its state changes.
    // An old retained digest must not replace the current original observation.
    collapse = true
    stage("hook-state-changed")
    collapse = false
    target.x = 2
    stage("input-mutated")
    restoreHook()
    restoreHook = () => {}
    order.push("restored")
    const restoredAdmitted = !!canonical.sfCanonicalCaptureRuntime() && copying.sfOriginalStructuredCloneCurrent()
    stage("after-restore")
    digest.close()
    target.x = 3
    stage("after-close")
    return { mode, pid: process.pid, order, beforeHookAdmitted, duringHookAdmitted, restoredAdmitted,
      loadHookCalls, loadTraps, factoryHookCalls, factoryTraps, bootstrapGetterCalls, stages }
  } finally {
    owner?.close()
    restoreHook()
    restoreBootstrap()
  }
}

if (import.meta.main) {
  const mode = process.argv[2]
  if (!freshTupleLoadingModes.some((entry) => entry === mode)) throw new Error("Unknown fresh tuple loading mode")
  const receipt = await child(mode as LoadingMode)
  process.stdout.write(JSON.stringify(receipt) + "\n")
}
