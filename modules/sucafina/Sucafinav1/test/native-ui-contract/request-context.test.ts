import { expect, test } from "bun:test"
import { createSfLiveContext, createSfPageObservations, type SfLiveContextAdmission, type SfLiveOperationalObservation } from "../../../../../apps/cli/src/sucafina-product/native-ui/live-context.ts"

const origin = "http://127.0.0.1:4096"
const mount = "/sucafina"
const binding = Object.freeze({ installationId: "installation-a", projectId: "project-a", hostId: "host-a" })
const stamp = Object.freeze({ ...binding, principalRef: "person", policyVersion: "policy", accessRevision: "revision" })
const contextUrl = origin + mount + "/api/ui/context?installationId=installation-a&projectId=project-a&hostId=host-a"

test("CAP25 preflight rechecks original authority independently of other surface health", async () => {
  const request = new Request(origin + mount + "/api/ui/pages/CAP25?request=PR-2026-0001")
  let checks = 0
  let revoked = false
  let probes = 0
  const live = createSfLiveContext({
    origin, mount, currentBinding: () => binding,
    admit: async (original) => {
      if (original === request) checks++
      return { status: "ok", stamp: { ...stamp, accessRevision: revoked && checks > 3 ? "revoked" : stamp.accessRevision },
        authMode: "microsoft", destinations: [{ capabilityId: "CAP25", surface: "procurement", page: "Requests",
          canRead: true, allowedActionIds: ["select_quote"] }] }
    },
    operational: async () => { probes++; throw new Error("Unrelated producer unavailable") },
  })
  expect(await live.readRequestContext(request, binding)).toMatchObject({ status: "ok", value: {
    stamp, destinations: [{ capabilityId: "CAP25", allowedActionIds: ["select_quote"] }],
  } })
  expect(checks).toBe(3)
  expect(probes).toBe(0)
  expect((await live.readContext(new Request(contextUrl), binding)).status).toBe("unavailable")
  expect(probes).toBe(1)
  const approvals = new Request(origin + mount + "/api/ui/pages/CAP26")
  expect((await live.readRequestContext(approvals, binding)).status).toBe("unavailable")
  expect(probes).toBe(2)
  revoked = true
  checks = 2
  expect(await live.readRequestContext(request, binding)).toEqual({ status: "unavailable", reason: "contract-mismatch" })
  expect(probes).toBe(2)
})

const supplier = {
  capabilityId: "CAP27", surface: "procurement", page: "Suppliers",
  canRead: true, allowedActionIds: ["save"],
} as const
const admitted = {
  status: "ok", stamp, authMode: "microsoft", destinations: [supplier],
} as const
const assetReads = [
  { operationId: "files.asset.link", state: "ready", reason: null, operational: true },
  { operationId: "files.asset.download", state: "ready", reason: null, operational: true },
] as const satisfies readonly SfLiveOperationalObservation[]
const unavailableAssets = assetReads.map((item): SfLiveOperationalObservation => ({
  operationId: item.operationId, state: "unavailable",
  reason: "operational-source-unavailable", operational: false,
}))

for (const capability of Array.from({ length: 28 }, (_, index) => "CAP" + String(index + 1).padStart(2, "0"))) {
  test(capability + " internal page admission uses only its composed page observations", async () => {
    const request = new Request(origin + mount + "/api/ui/pages/" + capability)
    let checks = 0
    let pageProbes = 0
    let globalProbes = 0
    const live = createSfLiveContext({
      origin, mount, currentBinding: () => binding,
      admit: async (original) => {
        expect(original).toBe(request)
        checks++
        return admitted
      },
      operational: async () => { globalProbes++; throw new Error("Unrelated producer unavailable") },
      pageOperational: async (original, observedStamp) => {
        expect(original).toBe(request)
        expect(observedStamp).toEqual(stamp)
        expect(Object.isFrozen(observedStamp)).toBe(true)
        pageProbes++
        return []
      },
    })
    expect(await live.readRequestContext(request, binding)).toMatchObject({
      status: "ok", value: { stamp, destinations: [supplier] },
    })
    expect(checks).toBe(3)
    expect(pageProbes).toBe(capability === "CAP25" ? 0 : 2)
    expect(globalProbes).toBe(0)
  })
}

test("a missing page observation port preserves the original operational fallback", async () => {
  const request = new Request(origin + mount + "/api/ui/pages/CAP24")
  let checks = 0
  let probes = 0
  const live = createSfLiveContext({
    origin, mount, currentBinding: () => binding,
    admit: async () => { checks++; return admitted },
    operational: async (original, observedStamp) => {
      expect(original).toBe(request)
      expect(observedStamp).toEqual(stamp)
      probes++
      return assetReads
    },
  })
  expect((await live.readRequestContext(request, binding)).status).toBe("ok")
  expect(checks).toBe(3)
  expect(probes).toBe(2)
})

for (const target of [
  { path: contextUrl, method: "GET", internal: false },
  { path: origin + mount + "/api/ui/projections/home", method: "GET", internal: true },
  { path: origin + mount + "/api/ui/projections/search", method: "POST", internal: true },
]) {
  test(target.method + " " + new URL(target.path).pathname + " keeps the general observation port", async () => {
    const request = new Request(target.path, { method: target.method })
    let checks = 0
    let pageProbes = 0
    let globalProbes = 0
    const live = createSfLiveContext({
      origin, mount, currentBinding: () => binding,
      admit: async (original) => { expect(original).toBe(request); checks++; return admitted },
      operational: async (original) => { expect(original).toBe(request); globalProbes++; return [] },
      pageOperational: async () => { pageProbes++; throw new Error("Page port must not run") },
    })
    const result = target.internal
      ? await live.readRequestContext(request, binding)
      : await live.readContext(request, binding)
    expect(result.status).toBe("ok")
    expect(checks).toBe(3)
    expect(globalProbes).toBe(2)
    expect(pageProbes).toBe(0)
  })
}

for (const target of [
  { path: "/api/ui/pages/CAP24/", method: "GET" },
  { path: "/api/ui/pages/CAP024", method: "GET" },
  { path: "/api/ui/pages/CAP29", method: "GET" },
  { path: "/api/ui/pages/cap24", method: "GET" },
  { path: "/api/ui/pages/CAP24/extra", method: "GET" },
  { path: "/api/ui/pages/CAP24", method: "POST" },
]) {
  test("noncanonical " + target.method + " " + target.path + " cannot reach page observations", async () => {
    let checks = 0
    let probes = 0
    const live = createSfLiveContext({
      origin, mount, currentBinding: () => binding,
      admit: async () => { checks++; return admitted },
      operational: async () => { probes++; return [] },
      pageOperational: async () => { probes++; return [] },
    })
    expect(await live.readRequestContext(new Request(origin + mount + target.path, {
      method: target.method,
    }), binding)).toEqual({ status: "unavailable", reason: "contract-mismatch" })
    expect(checks).toBe(0)
    expect(probes).toBe(0)
  })
}

for (const observations of [assetReads, unavailableAssets] as const) {
  test("CAP27 preserves " + observations[0]!.state + " original asset observations", async () => {
    let checks = 0
    let probes = 0
    const request = new Request(origin + mount + "/api/ui/pages/CAP27?supplier=supplier-a")
    const live = createSfLiveContext({
      origin, mount, currentBinding: () => binding,
      admit: async () => { checks++; return admitted },
      operational: async () => { throw new Error("General probe must not run") },
      pageOperational: async (original) => { expect(original).toBe(request); probes++; return observations },
    })
    const result = await live.readRequestContext(request, binding)
    expect(result.status).toBe("ok")
    if (result.status !== "ok") throw new Error("Original supplier context was not admitted")
    expect(result.value.destinations).toEqual([supplier])
    const evidence = result.value.availability.find((entry) => entry.family === "files" && entry.resource === "evidence")
    for (const observation of observations)
      expect(evidence?.operations.find((entry) => entry.operationId === observation.operationId)).toEqual(observation)
    expect(checks).toBe(3)
    expect(probes).toBe(2)
  })
}

for (const duringProbe of [1, 2] as const) {
  test("authority revoked during page observation " + duringProbe + " is refused", async () => {
    let checks = 0
    let probes = 0
    let current: SfLiveContextAdmission = admitted
    const live = createSfLiveContext({
      origin, mount, currentBinding: () => binding,
      admit: async () => { checks++; return current },
      pageOperational: async () => {
        probes++
        if (probes === duringProbe) current = { status: "denied" }
        return assetReads
      },
    })
    expect(await live.readRequestContext(new Request(origin + mount + "/api/ui/pages/CAP27"), binding))
      .toEqual({ status: "unavailable", reason: "contract-mismatch" })
    expect(probes).toBe(duringProbe)
    expect(checks).toBe(duringProbe + 1)
  })
}

for (const change of ["principalRef", "policyVersion", "accessRevision", "destinations"] as const) {
  test("page admission refuses changed " + change + " after an observation", async () => {
    let checks = 0
    let probes = 0
    let current: SfLiveContextAdmission = admitted
    const live = createSfLiveContext({
      origin, mount, currentBinding: () => binding,
      admit: async () => { checks++; return current },
      pageOperational: async () => {
        probes++
        current = change === "destinations"
          ? { ...admitted, destinations: [{ ...supplier, allowedActionIds: ["block"] }] }
          : { ...admitted, stamp: { ...stamp, [change]: "changed" } }
        return assetReads
      },
    })
    expect(await live.readRequestContext(new Request(origin + mount + "/api/ui/pages/CAP27"), binding))
      .toEqual({ status: "unavailable", reason: "contract-mismatch" })
    expect(probes).toBe(1)
    expect(checks).toBe(2)
  })
}

test("page admission refuses health that changes between its two observations", async () => {
  let checks = 0
  let probes = 0
  const live = createSfLiveContext({
    origin, mount, currentBinding: () => binding,
    admit: async () => { checks++; return admitted },
    pageOperational: async () => ++probes === 1 ? assetReads : unavailableAssets,
  })
  expect(await live.readRequestContext(new Request(origin + mount + "/api/ui/pages/CAP27"), binding))
    .toEqual({ status: "unavailable", reason: "contract-mismatch" })
  expect(probes).toBe(2)
  expect(checks).toBe(2)
})

for (const transition of ["replaced-binding", "aborted-request"] as const) {
  test("page observation cannot survive " + transition, async () => {
    const abort = new AbortController()
    let current = binding
    let checks = 0
    let probes = 0
    const live = createSfLiveContext({
      origin, mount, currentBinding: () => current,
      admit: async () => { checks++; return admitted },
      pageOperational: async () => {
        probes++
        if (transition === "replaced-binding") current = { ...binding }
        if (transition === "aborted-request") abort.abort()
        return assetReads
      },
    })
    expect(await live.readRequestContext(new Request(origin + mount + "/api/ui/pages/CAP27", {
      signal: abort.signal,
    }), binding)).toEqual({ status: "unavailable", reason: "contract-mismatch" })
    expect(probes).toBe(1)
    expect(checks).toBe(1)
  })
}

test("a failing page observation is closed without falling back to unrelated health", async () => {
  let globalProbes = 0
  const live = createSfLiveContext({
    origin, mount, currentBinding: () => binding,
    admit: async () => admitted,
    operational: async () => { globalProbes++; return assetReads },
    pageOperational: async () => { throw new Error("Original domain probe unavailable") },
  })
  expect(await live.readRequestContext(new Request(origin + mount + "/api/ui/pages/CAP27"), binding))
    .toEqual({ status: "unavailable", reason: "contract-mismatch" })
  expect(globalProbes).toBe(0)
})

test("missing page evidence remains unavailable without changing admitted destinations", async () => {
  const live = createSfLiveContext({
    origin, mount, currentBinding: () => binding,
    admit: async () => admitted,
    pageOperational: async () => [],
  })
  const result = await live.readRequestContext(new Request(origin + mount + "/api/ui/pages/CAP27"), binding)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") throw new Error("Original supplier context was not admitted")
  expect(result.value.destinations).toEqual([supplier])
  const evidence = result.value.availability.find((entry) => entry.family === "files" && entry.resource === "evidence")
  for (const observation of assetReads) {
    expect(evidence?.operations.find((entry) => entry.operationId === observation.operationId)).toEqual({
      operationId: observation.operationId, state: "unavailable",
      reason: "operational-source-unavailable", operational: false,
    })
  }
})

test("duplicate page observations remain a contract mismatch", async () => {
  const live = createSfLiveContext({
    origin, mount, currentBinding: () => binding,
    admit: async () => admitted,
    pageOperational: async () => [assetReads[0], assetReads[0]],
  })
  expect(await live.readRequestContext(new Request(origin + mount + "/api/ui/pages/CAP27"), binding))
    .toEqual({ status: "unavailable", reason: "contract-mismatch" })
})

const versions = {
  capabilityId: "CAP23", surface: "planner", page: "Versions",
  canRead: true, allowedActionIds: ["save", "copy"],
} as const
const versionsAdmission = { ...admitted, destinations: [versions] } as const

test("the installed CAP23 page composition retains three admissions without unrelated health", async () => {
  const request = new Request(origin + mount + "/api/ui/pages/CAP23?year=2026")
  let checks = 0
  let probes = 0
  const live = createSfLiveContext({
    origin, mount, currentBinding: () => binding,
    admit: async (original) => { expect(original).toBe(request); checks++; return versionsAdmission },
    pageOperational: createSfPageObservations(mount, async () => {
      probes++
      throw new Error("Unrelated installation health must not delay the versions source")
    }),
  })
  const result = await live.readRequestContext(request, binding)
  expect(result).toMatchObject({ status: "ok", value: { stamp, destinations: [versions] } })
  if (result.status !== "ok") throw new Error("The original versions authority was not admitted")
  expect(result.value.availability.find((entry) => entry.resource === "CAP23")?.operations
    .find((entry) => entry.operationId === "domain.page.CAP23")).toEqual({
      operationId: "domain.page.CAP23", state: "unavailable",
      reason: "operational-source-unavailable", operational: false,
    })
  expect(checks).toBe(3)
  expect(probes).toBe(0)
})

for (const duringAdmission of [2, 3]) {
  test("installed CAP23 composition refuses revocation at original admission " + duringAdmission, async () => {
    const request = new Request(origin + mount + "/api/ui/pages/CAP23?year=2026")
    let checks = 0
    let probes = 0
    const live = createSfLiveContext({
      origin, mount, currentBinding: () => binding,
      admit: async () => {
        checks++
        return checks === duringAdmission
          ? { ...versionsAdmission, stamp: { ...stamp, accessRevision: "revoked" } }
          : versionsAdmission
      },
      pageOperational: createSfPageObservations(mount, async () => { probes++; return [] }),
    })
    expect(await live.readRequestContext(request, binding))
      .toEqual({ status: "unavailable", reason: "contract-mismatch" })
    expect(checks).toBe(duringAdmission)
    expect(probes).toBe(0)
  })
}

for (const capability of ["CAP22", "CAP24", "CAP26", "CAP27"]) {
  test("installed " + capability + " composition preserves its original health observations", async () => {
    const request = new Request(origin + mount + "/api/ui/pages/" + capability)
    let probes = 0
    const live = createSfLiveContext({
      origin, mount, currentBinding: () => binding, admit: async () => admitted,
      pageOperational: createSfPageObservations(mount, async (original, observedStamp) => {
        expect(original).toBe(request)
        expect(observedStamp).toEqual(stamp)
        probes++
        return assetReads
      }),
    })
    const result = await live.readRequestContext(request, binding)
    expect(result.status).toBe("ok")
    if (result.status !== "ok") throw new Error("The original page observations were not admitted")
    const evidence = result.value.availability.find((entry) => entry.family === "files" && entry.resource === "evidence")
    for (const observation of assetReads)
      expect(evidence?.operations.find((entry) => entry.operationId === observation.operationId)).toEqual(observation)
    expect(probes).toBe(2)
  })
}

test("installed CAP27 composition still refuses attachment health changed between observations", async () => {
  let probes = 0
  const live = createSfLiveContext({
    origin, mount, currentBinding: () => binding, admit: async () => admitted,
    pageOperational: createSfPageObservations(mount, async () => ++probes === 1 ? assetReads : unavailableAssets),
  })
  expect(await live.readRequestContext(new Request(origin + mount + "/api/ui/pages/CAP27"), binding))
    .toEqual({ status: "unavailable", reason: "contract-mismatch" })
  expect(probes).toBe(2)
})

test("installed page composition never substitutes for full context observations", async () => {
  const request = new Request(contextUrl)
  let globalProbes = 0
  let pageProbes = 0
  const live = createSfLiveContext({
    origin, mount, currentBinding: () => binding, admit: async () => versionsAdmission,
    operational: async (original) => {
      expect(original).toBe(request)
      globalProbes++
      return assetReads
    },
    pageOperational: createSfPageObservations(mount, async () => { pageProbes++; return [] }),
  })
  expect((await live.readContext(request, binding)).status).toBe("ok")
  expect(globalProbes).toBe(2)
  expect(pageProbes).toBe(0)
})
