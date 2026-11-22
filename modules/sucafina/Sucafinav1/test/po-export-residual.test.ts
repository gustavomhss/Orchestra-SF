import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { createModule } from "../index.ts"
import { openLocalStore } from "../runtime/local-store.ts"
import type { Persistence } from "../runtime/contract.ts"
import type { RoleRow } from "../src/identity.ts"
import { mountSfFilesOriginalRoutes } from "../runtime/native-files/routing.ts"
import { sfHasOperationalResource } from "../../../../apps/cli/src/sucafina-product/native-ui/live-context.ts"

type Change = "none" | "recipient" | "missing" | "access" | "source"

/** Real SQLite, Files routing, application admission, PO renderer and egress.
 * Signed-in identity and intentional between-observation faults are fixture boundaries.
 * This diagnoses the current producer; it does not qualify installed Teams or readiness. */
async function fixture(change: Change = "none") {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-po-residual-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const original = {
    settings: { currency: "USD" },
    requests: {
      request1: {
        version: 1,
        request: {
          id: "request1", number: 41, createdBy: "po-owner", status: "po_issued",
          ...(change === "missing" ? {} : { po: {
            number: "PO-00041", description: "Authorized purchase order",
            currency: "USD", supplier: "Supplier <private>", issuedAt: "2026-11-22T00:00:00Z",
            lines: [{ desc: "Selected item", qty: 2, uom: "ea", unitPrice: 25 }],
          } }),
        },
      },
    },
  }
  await store.transaction("procurement", async (snapshot) => {
    snapshot.data.store = structuredClone(original)
    snapshot.data.__sfProductV1 = { marker: "PRIVATE_PRODUCT_STATE" }
    snapshot.versions.store = 1
    return { commit: true, value: undefined }
  })
  const gate: { transactions: number; exportCommits: number; producerCalls: number; seen?: Request } = {
    transactions: 0, exportCommits: 0, producerCalls: 0,
  }
  const persistence: Persistence = {
    async transaction(surface, work, options) {
      gate.transactions += 1
      if (change === "source" && gate.transactions === 2) {
        await store.transaction("procurement", async (snapshot) => {
          snapshot.data.store = { ...structuredClone(original), settings: { currency: "EUR" } }
          snapshot.versions.store = 2
          return { commit: true, value: undefined }
        })
      }
      return store.transaction(surface, async (snapshot, blobs) => {
        const result = await work(snapshot, blobs)
        if (result.commit) gate.exportCommits += 1
        return result
      }, options)
    },
  }
  const roles: RoleRow[] = [{ surface: "procurement", role: "requester", entra: "po-group", version: 1, by: "fixture" }]
  const business = createModule("/sf", {
    persistence,
    rolePolicy: () => roles,
    authenticate: async (request, context) => {
      expect(context?.surface).toBe("procurement")
      expect(context?.roleMap).toEqual(roles)
      if (change === "access" && gate.transactions > 1) return null
      const principal = request.headers.get("x-fixture-actor")
      return principal ? { id: principal, canWrite: true, roles: [{ surface: "procurement", role: "requester" }] } : null
    },
    environment: async () => ({ at: "2026-11-22T00:00:00Z", id: randomUUID, directory: [] }),
    maxJsonBytes: 65_536,
  })
  const application = async (request: Request) => {
    gate.producerCalls += 1
    gate.seen = request
    return business(request)
  }
  const route = mountSfFilesOriginalRoutes({ origin: "https://po.example", mount: "/sf", sources: { application } })
  return {
    route, gate,
    request: (signal?: AbortSignal) => new Request("https://po.example/sf/procurement?download=po&request=41", {
      headers: { "x-fixture-actor": change === "recipient" ? "another-person" : "po-owner" }, signal,
    }),
    snapshot: () => store.transaction("procurement", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) })),
    dispose: async () => { await store.dispose(); await rm(directory, { recursive: true, force: true }) },
  }
}

test.each([
  { change: "none" as const, status: 200 },
  { change: "recipient" as const, status: 404 },
  { change: "missing" as const, status: 404 },
  { change: "access" as const, status: 403 },
  { change: "source" as const, status: 409 },
])("real PO export preserves $change admission and egress", async ({ change, status }) => {
  const value = await fixture(change)
  try {
    const before = await value.snapshot()
    const request = value.request()
    const response = await value.route(request)
    expect(value.gate.seen).toBe(request)
    expect(value.gate.producerCalls).toBe(1)
    expect(value.gate.transactions).toBe(2)
    expect(response?.status).toBe(status)
    expect(response?.headers.get("cache-control")).toBe("no-store")
    const body = await response!.text()
    expect(body).not.toContain("PRIVATE_PRODUCT_STATE")
    expect(value.gate.exportCommits).toBe(0)
    const after = await value.snapshot()
    expect(after.audit).toEqual(before.audit)
    if (change !== "source") expect(after).toEqual(before)
    if (status === 200) {
      expect(response?.headers.get("content-type")).toBe("text/html; charset=utf-8")
      expect(response?.headers.get("content-disposition")).toContain("PO-00041.html")
      expect(body).toContain("PURCHASE ORDER")
      expect(body).toContain("PO-00041")
      expect(body).toContain("Authorized purchase order")
      expect(body).toContain("Supplier &lt;private&gt;")
      expect(body).toContain("Selected item")
      expect(body).toContain("50.00")
    } else {
      expect(body).not.toContain("PO-00041")
      expect(body).not.toContain("Authorized purchase order")
      expect(body).not.toContain("Selected item")
    }
  } finally { await value.dispose() }
})

test("PO routing preserves a missing producer and abort without returning bytes", async () => {
  const value = await fixture()
  try {
    const missing = mountSfFilesOriginalRoutes({ origin: "https://po.example", mount: "/sf", sources: {} })
    const absent = await missing(value.request())
    expect(absent?.status).toBe(503)
    expect(await absent?.text()).not.toContain("PO-00041")
    const abort = new AbortController()
    abort.abort()
    const cancelled = await value.route(value.request(abort.signal))
    expect(cancelled?.status).toBe(503)
    expect(await cancelled?.text()).not.toContain("PO-00041")
    expect(value.gate.producerCalls).toBe(0)
    expect(value.gate.transactions).toBe(0)
  } finally { await value.dispose() }
})

test("current PO operational resource gap remains explicit", () => {
  // A green diagnostic records the missing index, not a successful health observation.
  expect(sfHasOperationalResource("files.export.po")).toBe(false)
  expect(sfHasOperationalResource("files.export.members")).toBe(true)
})
