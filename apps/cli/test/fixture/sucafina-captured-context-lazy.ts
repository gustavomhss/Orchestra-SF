/** Test-only isolated process. Bootstrap spies precede canonical initialization;
 * they prove ordering and failure handling, not native runtime purity or speed. */
export async function runSfCaptureLazyControl(file: string) {
  const [{ AppProcess }, { LayerNode }, { expectSpawn }, { Effect }, { ChildProcess }, { Omni }] = await Promise.all([
    import("@orchestra/core/process"), import("@orchestra/core/effect/layer-node"),
    import("@orchestra/core/test/fixture/omni-expect"), import("effect"), import("effect/unstable/process"),
    import("@orchestra/core/omni"),
  ])
  expectSpawn(file)
  const before = Omni.snapshot()
  const result = await Effect.runPromise(Effect.scoped(Effect.provide(Effect.gen(function* () {
    const processes = yield* AppProcess.Service
    return yield* processes.run(ChildProcess.make(process.execPath, [import.meta.path], {
      cwd: import.meta.dir, extendEnv: true, stdin: "ignore", stdout: "pipe", stderr: "pipe",
      killSignal: "SIGTERM", forceKillAfter: "1 second",
    }), { timeout: 3_000, maxOutputBytes: 65_536, maxErrorBytes: 65_536 })
  }), LayerNode.compile(AppProcess.node))))
  const after = Omni.snapshot()
  const stdout = result.stdout.toString("utf8"), stderr = result.stderr.toString("utf8")
  if (result.exitCode !== 0 || result.stdoutTruncated || result.stderrTruncated)
    throw new Error("Captured context lazy child did not complete: " + JSON.stringify({
      exitCode: result.exitCode, stdoutTruncated: result.stdoutTruncated,
      stderrTruncated: result.stderrTruncated, stdout, stderr,
    }))
  const receipt: unknown = JSON.parse(stdout)
  if (!receipt || typeof receipt !== "object" || !("mode" in receipt) || receipt.mode !== "deferred-baseline" ||
    !("pid" in receipt) || typeof receipt.pid !== "number" || !Number.isSafeInteger(receipt.pid) || receipt.pid <= 0)
    throw new Error("Captured context lazy child returned an invalid receipt")
  return { pid: receipt.pid, report: receipt,
    omniSpawns: after.spawns - before.spawns, omniDelegations: after.delegations - before.delegations }
}

async function child() {
  const property = Object.getOwnPropertyDescriptor, define = Object.defineProperty
  const create = Object.create, parent = Object.getPrototypeOf, own = Object.hasOwn
  const remove = Reflect.deleteProperty, apply = Reflect.apply, construct = Reflect.construct
  const savedCreate = property(Object, "create"), savedDefine = property(Object, "defineProperty")
  const savedHasher = property(Bun, "CryptoHasher"), savedIndex = property(Array.prototype, "0")
  const savedLength = property(Array.prototype, "length"), savedStringify = property(JSON, "stringify")
  if (!savedCreate || !savedDefine || !savedHasher || !savedLength || !savedStringify)
    throw new Error("The original bootstrap descriptors are required")
  let observing = false, createCalls = 0, defineCalls = 0, hashCalls = 0
  let stringSlots = 0, objectSlots = 0, captureAliases = false
  let copiedRoot: object | undefined, copiedLeft: unknown, copiedRight: unknown
  let createAction: (() => void) | undefined, defineAction: (() => void) | undefined
  let hashAction: (() => void) | undefined
  const counts = () => ({ create: createCalls, define: defineCalls, hash: hashCalls })
  const reset = () => { createCalls = 0; defineCalls = 0; hashCalls = 0 }
  const thrown = (work: () => unknown): { threw: boolean; error: unknown } => {
    try { work(); return { threw: false, error: undefined } }
    catch (error) { return { threw: true, error } }
  }
  const createSpy = new Proxy(Object.create, { apply(target, receiver, args) {
    if (observing) {
      createCalls++
      const action = createAction
      createAction = undefined
      action?.()
    }
    return apply(target, receiver, args)
  } })
  const defineSpy = new Proxy(Object.defineProperty, { apply(target, receiver, args) {
    if (observing) {
      defineCalls++
      const action = defineAction
      defineAction = undefined
      action?.()
      const owner: unknown = args[0], key: unknown = args[1], descriptor: unknown = args[2]
      if (captureAliases && owner && typeof owner === "object" &&
        descriptor && typeof descriptor === "object" && "value" in descriptor) {
        if (key === "left") { copiedRoot = owner; copiedLeft = descriptor.value }
        if (key === "right") copiedRight = descriptor.value
      }
    }
    return apply(target, receiver, args)
  } })
  const hasherSpy = new Proxy(Bun.CryptoHasher, { construct(target, args) {
    if (observing) {
      hashCalls++
      const action = hashAction
      hashAction = undefined
      action?.()
    }
    return construct(target, args)
  } })
  try {
    // The setter preserves ordinary writes. Only observation is disabled during imports.
    // New private nodes/edges/copies must never arrive here; historical names are strings.
    define(Array.prototype, "0", { configurable: true, get() { return undefined },
      set(this: object, value: unknown) {
        if (observing) {
          if (typeof value === "string") stringSlots++
          if (value !== null && (typeof value === "object" || typeof value === "function")) objectSlots++
        }
        define(this, "0", { value, enumerable: true, writable: true, configurable: true })
      } })
    define(Object, "create", { ...savedCreate, value: createSpy })
    define(Object, "defineProperty", { ...savedDefine, value: defineSpy })
    define(Bun, "CryptoHasher", { ...savedHasher, value: hasherSpy })
    const canonical = await import("../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts")
    const helper = await import("../../../../modules/sucafina/Sucafinav1/product/host-binding/captured-context-identity.ts")
    const runtime = canonical.sfCanonicalCaptureRuntime()
    if (!runtime) throw new Error("The synthetic bootstrap must be admitted")
    const makeSource = () => {
      const source: object = create(null)
      const shared = { amount: -0, optional: undefined, nested: [null, true, "quoted"] }
      const special = { zero: -0 }, hidden = { value: 7 }
      define(source, "left", { value: shared, enumerable: true, writable: true, configurable: true })
      define(source, "right", { value: shared, enumerable: true, writable: true, configurable: true })
      define(source, "__proto__", { value: special, enumerable: true, writable: true, configurable: true })
      define(source, "optional", { value: undefined, enumerable: true, writable: true, configurable: true })
      define(source, "hidden", { value: hidden, enumerable: false, writable: true, configurable: true })
      return { source, shared, special }
    }
    const input = makeSource(), equivalent = makeSource()
    let liveGetterCalls = 0, reentries = 0, reentryMatches: boolean | undefined
    observing = true
    captureAliases = true
    const same = helper.prepareSfCapturedContextIdentity(input.source)
    const prepared = counts()
    input.shared.nested[0] = "changed"
    input.special.zero = 1
    remove(input.source, "optional")
    define(input.source, "left", { configurable: true, enumerable: true,
      get() { liveGetterCalls++; return input.shared } })
    createAction = () => { reentries++; reentryMatches = same(equivalent.source) }
    const first = same(equivalent.source), firstCounts = counts(), firstLiveReads = liveGetterCalls
    const second = same(equivalent.source), secondCounts = counts(), secondLiveReads = liveGetterCalls
    const changed = same(input.source), changedCounts = counts()
    captureAliases = false
    const root = copiedRoot, left = copiedLeft
    const specialDescriptor = root && property(root, "__proto__")
    const optionalDescriptor = root && property(root, "optional")
    const hiddenDescriptor = root && property(root, "hidden")
    const shape = {
      alias: left !== undefined && left === copiedRight,
      detached: left !== input.shared && left !== equivalent.shared,
      nullPrototype: !!root && parent(root) === null,
      ownProto: !!specialDescriptor && own(specialDescriptor, "value") &&
        specialDescriptor.value !== input.special && specialDescriptor.value !== equivalent.special,
      ownUndefined: !!optionalDescriptor && own(optionalDescriptor, "value") && optionalDescriptor.value === undefined,
      hidden: !!hiddenDescriptor && hiddenDescriptor.enumerable === false,
      negativeZero: !!left && typeof left === "object" && Object.is(property(left, "amount")?.value, -0),
    }
    const deferred = { prepared, first, firstCounts, firstLiveReads, second, secondCounts, secondLiveReads,
      changed, changedCounts, changedLiveReads: liveGetterCalls, reentries, reentryMatches, shape }

    reset()
    const sameUndefined = helper.prepareSfCapturedContextIdentity(undefined)
    const undefinedPrepared = counts()
    const undefinedMatches = sameUndefined(undefined), undefinedFirst = counts()
    const nullMatches = sameUndefined(null), undefinedLast = counts()
    const primitiveUndefined = { prepared: undefinedPrepared, undefinedMatches, first: undefinedFirst,
      nullMatches, last: undefinedLast }

    reset()
    const allocationSentinel = new Error("capture-allocation-sentinel")
    const failSource = { value: 1 }, sameFailure = helper.prepareSfCapturedContextIdentity(failSource)
    failSource.value = 2
    defineAction = () => { throw allocationSentinel }
    const failedFirst = thrown(() => sameFailure({ value: 1 })), failedFirstCounts = counts()
    const failedAgain = thrown(() => sameFailure(failSource)), failedLastCounts = counts()
    const allocationFailure = { firstThrew: failedFirst.threw, firstExact: failedFirst.error === allocationSentinel,
      first: failedFirstCounts, againThrew: failedAgain.threw, againExact: failedAgain.error === allocationSentinel,
      last: failedLastCounts }

    reset()
    const sameUndefinedFailure = helper.prepareSfCapturedContextIdentity({ value: 1 })
    createAction = () => { throw undefined }
    const undefinedFailureFirst = thrown(() => sameUndefinedFailure({ value: 1 })), undefinedFailureFirstCounts = counts()
    const undefinedFailureAgain = thrown(() => sameUndefinedFailure({ value: 2 })), undefinedFailureLastCounts = counts()
    const undefinedFailure = { firstThrew: undefinedFailureFirst.threw, firstUndefined: undefinedFailureFirst.error === undefined,
      first: undefinedFailureFirstCounts, againThrew: undefinedFailureAgain.threw,
      againUndefined: undefinedFailureAgain.error === undefined, last: undefinedFailureLastCounts }

    reset()
    const hashSentinel = new Error("capture-hash-sentinel")
    const hashSource = { value: 10 }, sameHash = helper.prepareSfCapturedContextIdentity(hashSource)
    hashSource.value = 20
    hashAction = () => { throw hashSentinel }
    const hashFailureFirst = thrown(() => sameHash(hashSource)), hashFailureFirstCounts = counts()
    const changedAfterRetry = sameHash(hashSource), retriedCounts = counts()
    const originalAfterRetry = sameHash({ value: 10 }), hashLastCounts = counts()
    const hashRetry = { firstThrew: hashFailureFirst.threw, firstExact: hashFailureFirst.error === hashSentinel,
      first: hashFailureFirstCounts, changedAfterRetry, retried: retriedCounts, originalAfterRetry, last: hashLastCounts }

    reset()
    const sameBeforeDrift = helper.prepareSfCapturedContextIdentity({ value: 1 })
    let unexpectedCreate = 0
    define(Object, "create", { ...savedCreate, value: () => { unexpectedCreate++; return {} } })
    const beforeDrift = sameBeforeDrift({ value: 1 }), beforeDriftCounts = counts()
    define(Object, "create", { ...savedCreate, value: createSpy })
    const afterRestore = sameBeforeDrift({ value: 1 }), afterRestoreCounts = counts()
    const prebuildDrift = { beforeDrift, before: beforeDriftCounts, unexpectedCreate, afterRestore, after: afterRestoreCounts }

    reset()
    const sameDuringDrift = helper.prepareSfCapturedContextIdentity({ value: 1 })
    let stringifyCalls = 0, driftLiveReads = 0
    const stringifySpy = new Proxy(JSON.stringify, { apply(target, receiver, args) {
      stringifyCalls++
      return apply(target, receiver, args)
    } })
    defineAction = () => { define(JSON, "stringify", { ...savedStringify, value: stringifySpy }) }
    const currentWithGetter = { get value() { driftLiveReads++; return 1 } }
    const duringDrift = sameDuringDrift(currentWithGetter), duringCounts = counts()
    define(JSON, "stringify", savedStringify)
    const refusedAfterRestore = sameDuringDrift(currentWithGetter), refusedCounts = counts()
    const constructionDrift = { duringDrift, during: duringCounts, refusedAfterRestore, after: refusedCounts,
      stringifyCalls, liveReads: driftLiveReads }

    const setterIsolation = { historicalStringsObserved: stringSlots > 0, objectWrites: objectSlots }
    observing = false
    return { mode: "deferred-baseline", pid: process.pid, syntheticBootstrap: true, admitted: runtime.current(),
      deferred, primitiveUndefined, allocationFailure, undefinedFailure, hashRetry, prebuildDrift, constructionDrift,
      setterIsolation }
  } finally {
    observing = false
    define(JSON, "stringify", savedStringify)
    define(Object, "create", savedCreate)
    define(Object, "defineProperty", savedDefine)
    define(Bun, "CryptoHasher", savedHasher)
    if (savedIndex) define(Array.prototype, "0", savedIndex)
    else remove(Array.prototype, "0")
    define(Array.prototype, "length", savedLength)
  }
}

if (import.meta.main) {
  const receipt = await child()
  process.stdout.write(JSON.stringify(receipt) + "\n")
}
