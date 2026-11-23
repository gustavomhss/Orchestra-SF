import { expect, test } from "bun:test"
import { createSfLiveContext, type SfLiveContextAdmission, type SfLiveContextSources, type SfLiveOperationalObservation } from "../../../../../apps/cli/src/sucafina-product/native-ui/live-context.ts"

const origin = "http://127.0.0.1:4096"
const mount = "/sucafina"
const binding = Object.freeze({ installationId: "installation-a", projectId: "project-a", hostId: "host-a" })
const stamp = Object.freeze({ ...binding, principalRef: "person", policyVersion: "policy", accessRevision: "revision" })
const contextUrl = origin + mount + "/api/ui/context?installationId=installation-a&projectId=project-a&hostId=host-a"
const admitted = {
  status: "ok", stamp, authMode: "microsoft", destinations: [{
    capabilityId: "CAP27", surface: "procurement", page: "Suppliers", canRead: true, allowedActionIds: ["save"],
  }],
} as const
const observations = [
  { operationId: "files.asset.link", state: "ready", reason: null, operational: true },
  { operationId: "files.asset.download", state: "ready", reason: null, operational: true },
] as const satisfies readonly SfLiveOperationalObservation[]
const mismatch = { status: "unavailable", reason: "contract-mismatch" } as const

function fixture(request = new Request(contextUrl)) {
  const counts = { admits: 0, reads: 0 }
  const source: SfLiveContextSources = {
    origin, mount, currentBinding: () => binding,
    admit: async (original) => { expect(original).toBe(request); counts.admits++; return admitted },
    operational: async (original, currentStamp) => {
      expect(original).toBe(request)
      expect(currentStamp).toEqual(stamp)
      counts.reads++
      return structuredClone(observations)
    },
  }
  const live = createSfLiveContext(source)
  return { request, source, counts, live, read: () => live.readContext(request, binding) }
}

function barrier() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => { release = resolve })
  return { promise, release }
}

test("external context retains its full payload, three admissions and two independent observations", async () => {
  const canonical = await fixture().read()
  expect(canonical.status).toBe("ok")
  const f = fixture()
  let active = false
  let owners = 0
  let retained: SfLiveOperationalObservation[] = []
  const admit = f.source.admit
  const operational = f.source.operational!
  Reflect.set(f.source, "admit", async (request: Request) => {
    expect(active).toBe(false)
    return admit(request)
  })
  Reflect.set(f.source, "operational", async (request: Request, currentStamp: typeof stamp) => {
    expect(active).toBe(true)
    retained = [...await operational(request, currentStamp)]
    return retained
  })
  Reflect.set(f.source, "contextObservation", async (request: Request, read: () => Promise<void>) => {
    expect(request).toBe(f.request)
    expect(active).toBe(false)
    active = true
    owners++
    try {
      expect(await read()).toBeUndefined()
      // Mutation while the owner is still pending cannot replace the host's copy.
      retained.splice(0)
      await Promise.resolve()
      return true
    } finally { active = false }
  })
  expect(await f.read()).toEqual(canonical)
  expect(f.counts).toEqual({ admits: 3, reads: 2 })
  expect(owners).toBe(2)
  expect(active).toBe(false)
})

test("only the validated external context route invokes the observation owner", async () => {
  for (const target of [
    { path: origin + mount + "/api/ui/projections/home", method: "GET" },
    { path: origin + mount + "/api/ui/projections/search", method: "POST" },
    { path: origin + mount + "/api/ui/pages/CAP27?supplier=one", method: "GET" },
  ]) {
    const f = fixture(new Request(target.path, { method: target.method }))
    let owners = 0
    Reflect.set(f.source, "contextObservation", async () => { owners++; throw new Error("External owner must not run") })
    expect((await f.live.readRequestContext(f.request, binding)).status).toBe("ok")
    expect(f.counts).toEqual({ admits: 3, reads: 2 })
    expect(owners).toBe(0)
  }
  for (const request of [
    new Request(contextUrl + "&unexpected=1"),
    new Request(contextUrl + "&hostId=host-a"),
    new Request(contextUrl.replace("hostId=host-a", "hostId=other")),
    new Request(contextUrl, { method: "POST" }),
    new Request(origin + mount + "/api/ui/context"),
  ]) {
    const f = fixture(request)
    let owners = 0
    Reflect.set(f.source, "contextObservation", async () => { owners++; return true })
    expect(await f.read()).toEqual(mismatch)
    expect(f.counts).toEqual({ admits: 0, reads: 0 })
    expect(owners).toBe(0)
  }
})

test("opaque observation inputs retain the canonical read without invoking getters or proxy metadata traps", async () => {
  const canonical = await fixture().read()
  for (const mode of ["getter", "nonfunction", "prototype", "proxy"] as const) {
    const f = fixture()
    let traps = 0
    if (mode === "getter") Object.defineProperty(f.source, "contextObservation", {
      configurable: true, get() { traps++; throw new Error("Opaque getter must not run") },
    })
    if (mode === "nonfunction") Reflect.set(f.source, "contextObservation", {})
    if (mode === "prototype") Object.setPrototypeOf(f.source, { contextObservation: () => { traps++; return false } })
    const source = mode === "proxy" ? new Proxy(f.source, {
      getOwnPropertyDescriptor() { traps++; throw new Error("Opaque descriptor trap must not run") },
      getPrototypeOf() { traps++; throw new Error("Opaque prototype trap must not run") },
    }) : f.source
    expect(await createSfLiveContext(source).readContext(f.request, binding)).toEqual(canonical)
    expect(f.counts).toEqual({ admits: 3, reads: 2 })
    expect(traps).toBe(0)
  }
})

test("an admitted observation cannot forge a result or replay an omitted, duplicate, rejected or failed read", async () => {
  const cases: { name: string; reads: number; observe: (request: Request, read: () => Promise<void>) => Promise<unknown> }[] = [
    { name: "omitted", reads: 0, observe: async () => true },
    { name: "duplicate", reads: 1, observe: async (_request, read) => { await read(); await read(); return true } },
    { name: "rejected", reads: 1, observe: async (_request, read) => { await read(); return false } },
    { name: "throw", reads: 1, observe: async (_request, read) => { await read(); throw new Error("Observer failed") } },
    { name: "payload", reads: 1, observe: async (_request, read) => { await read(); return structuredClone(observations) } },
  ]
  for (const entry of cases) {
    const f = fixture()
    let owners = 0
    Reflect.set(f.source, "contextObservation", (request: Request, read: () => Promise<void>) => {
      owners++
      return entry.observe(request, read)
    })
    expect(await f.read()).toEqual(mismatch)
    expect(f.counts).toEqual({ admits: 1, reads: entry.reads })
    expect(owners).toBe(1)
  }
  const f = fixture()
  let reads = 0
  Reflect.set(f.source, "operational", async () => { reads++; throw new Error("Original producer failed") })
  Reflect.set(f.source, "contextObservation", async (_request: Request, read: () => Promise<void>) => { await read(); return true })
  expect(await f.read()).toEqual(mismatch)
  expect(reads).toBe(1)
  expect(f.counts.admits).toBe(1)
})

test("a retained first invocation and an unfinished read cannot publish after the owner closes", async () => {
  const late = fixture()
  let retained: (() => Promise<void>) | undefined
  Reflect.set(late.source, "contextObservation", async (_request: Request, read: () => Promise<void>) => {
    retained = read
    return true
  })
  expect(await late.read()).toEqual(mismatch)
  expect(retained).toBeDefined()
  await retained!()
  await retained!()
  expect(late.counts).toEqual({ admits: 1, reads: 0 })

  const pending = fixture()
  const entered = barrier()
  const released = barrier()
  let inflight: Promise<void> | undefined
  let reads = 0
  Reflect.set(pending.source, "operational", async () => {
    reads++
    entered.release()
    await released.promise
    return structuredClone(observations)
  })
  Reflect.set(pending.source, "contextObservation", async (_request: Request, read: () => Promise<void>) => {
    retained = read
    inflight = read()
    await entered.promise
    return true
  })
  try {
    expect(await pending.read()).toEqual(mismatch)
    expect(reads).toBe(1)
  } finally { released.release(); await inflight }
  await retained!()
  expect(reads).toBe(1)
  expect(pending.counts.admits).toBe(1)
})

test("reader drift and abort during an admitted observation refuse without executing substituted readers", async () => {
  for (const field of ["operational", "contextObservation"] as const) {
    const f = fixture()
    let replacements = 0
    const original = f.source.operational!
    Reflect.set(f.source, "operational", async (request: Request, currentStamp: typeof stamp) => {
      const value = await original(request, currentStamp)
      Object.defineProperty(f.source, field, {
        configurable: true, get() { replacements++; throw new Error("Replacement must not run") },
      })
      return value
    })
    Reflect.set(f.source, "contextObservation", async (_request: Request, read: () => Promise<void>) => { await read(); return true })
    expect(await f.read()).toEqual(mismatch)
    expect(f.counts).toEqual({ admits: 1, reads: 1 })
    expect(replacements).toBe(0)
  }
  const controller = new AbortController()
  const f = fixture(new Request(contextUrl, { signal: controller.signal }))
  let owners = 0
  Reflect.set(f.source, "contextObservation", async (_request: Request, read: () => Promise<void>) => {
    owners++
    await read()
    controller.abort()
    return true
  })
  expect(await f.read()).toEqual(mismatch)
  expect(f.counts).toEqual({ admits: 1, reads: 1 })
  expect(owners).toBe(1)
})

test("the independent observations retain both authority rechecks and the original health comparison", async () => {
  for (const revokeAfter of [1, 2] as const) {
    const f = fixture()
    let owners = 0
    let current: SfLiveContextAdmission = admitted
    Reflect.set(f.source, "admit", async () => { f.counts.admits++; return current })
    Reflect.set(f.source, "contextObservation", async (_request: Request, read: () => Promise<void>) => {
      owners++
      await read()
      if (owners === revokeAfter) current = { status: "denied" }
      return true
    })
    expect(await f.read()).toEqual(mismatch)
    expect(f.counts).toEqual({ admits: revokeAfter + 1, reads: revokeAfter })
    expect(owners).toBe(revokeAfter)
  }
  const f = fixture()
  let owners = 0
  Reflect.set(f.source, "operational", async () => {
    f.counts.reads++
    return f.counts.reads === 1 ? structuredClone(observations) : observations.map((item): SfLiveOperationalObservation => ({
      operationId: item.operationId, state: "unavailable", reason: "operational-source-unavailable", operational: false,
    }))
  })
  Reflect.set(f.source, "contextObservation", async (_request: Request, read: () => Promise<void>) => { owners++; await read(); return true })
  expect(await f.read()).toEqual(mismatch)
  expect(f.counts).toEqual({ admits: 2, reads: 2 })
  expect(owners).toBe(2)
})
