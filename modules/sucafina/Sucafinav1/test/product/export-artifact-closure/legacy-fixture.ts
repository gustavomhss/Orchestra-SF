import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { createApplication } from "../../../runtime/application.ts"
import type { Persistence } from "../../../runtime/contract.ts"
import { emptyMap, resolve } from "../../../src/identity.ts"
import type { Surface } from "../../../src/identity.ts"

export const exportAt = "2026-11-14T12:00:00Z"
export const fixtureRoleMap = () => emptyMap().map((row) => ({ ...row, entra: `sf66:${row.surface}:${row.role}`, version: 1, by: "synthetic-fixture" }))

/** Synthetic identities enter at the authentication boundary; the persisted role map resolves their actual roles. */
export function createLegacyDownloadApplication(persistence: Persistence) {
  const sessions = new Map([
    ["admin", { id: "sf66-admin", groups: ["sf66:dashboard:admin", "sf66:planner:admin", "sf66:procurement:admin"] }],
    ["viewer", { id: "sf66-viewer", groups: ["sf66:dashboard:viewer", "sf66:planner:viewer"] }],
    ["buyer", { id: "buyer", groups: ["sf66:procurement:buyer"] }],
    ["requester", { id: "requester", groups: ["sf66:procurement:requester"] }],
    ["other-requester", { id: "other-requester", groups: ["sf66:procurement:requester"] }],
    ["outsider", { id: "sf66-outsider", groups: [] as string[] }],
  ])
  const serve = createApplication("/sf", {
    persistence,
    authenticate: async (request, context) => {
      const session = sessions.get(request.headers.get("x-sf66-session") ?? "")
      if (!session || !context) return null
      return resolve(session.id, [...context.roleMap], (group) => session.groups.includes(group))
    },
    environment: async () => ({ at: exportAt, id: () => "sf66-export", directory: [{ id: "requester", name: "Synthetic requester" }] }),
    domains: { dashboard: [], planner: [], procurement: [] },
    maxJsonBytes: 100_000,
  })
  return {
    serve, sessions,
    request: (user: string, surface: Surface, query: Record<string, string>) => new Request(`https://sf66.invalid/sf/${surface}?${new URLSearchParams(query)}`, { headers: { "x-sf66-session": user } }),
  }
}

export async function legacyDownloadFixture() {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf66-formats-"))
  const store = await openLocalStore(directory)
  await store.transaction("dashboard", async (snapshot) => {
    snapshot.data = {
      roleMap: fixtureRoleMap(),
      settings: { year: 2026 },
      members: [{ id: "member-66", name: "Synthetic member 66", title: "Analyst", type: "Contractor", leaderId: "leader-66", location: "Example", start: "2025-01-01", end: "", status: "Active", cls: "Talent", outlook: "Stay", notes: "Ação — synthetic note", salary: "SALARY_SENTINEL_66" }],
      leaders: [{ id: "leader-66", name: "Synthetic leader 66", domain: "Example domain", location: "Example" }],
      __sfProductV1: { atlas: { token: "PRIVATE_ATLAS_SENTINEL_66" }, receipts: "PRIVATE_RECEIPT_SENTINEL_66" },
      nested: [{ label: "public", __sfProductV1: { token: "PRIVATE_NESTED_SENTINEL_66" } }],
    }
    snapshot.versions["members:member-66"] = { version: 7, by: "synthetic-fixture" }
    return { commit: true, value: undefined }
  })
  await store.transaction("planner", async (snapshot) => {
    snapshot.data = {
      roleMap: fixtureRoleMap(), curId: "v66",
      app: { currency: "EUR", entities: [{ id: "entity", name: "Entity 66" }], allocations: [{ id: "allocation", name: "Allocation 66" }] },
      versions: { v66: {
        id: "v66", name: "Frozen synthetic version 66", year: 2026, closed: 2, created: "2026-01-01",
        lines: [{ id: "line-66", sec: "opex", el: "licenses", name: '=HYPERLINK("https://example.invalid","literal")', desc: 'Ação, "quoted"\nsecond line', owner: "Owner 66", entity: "entity", alloc: "allocation", cur: "EUR", b: [12, 12], a: [null, 0], f: [0, null] }],
        projects: [],
        hc: { inc: 10, incMonth: 7, positions: [{ id: "position-66", name: "Synthetic person 66", title: "Engineer", include: true, domain: "Example", location: "Example", type: "Employee", fte: 1, start: 1, end: 12, rateId: "rate-66", rateOverride: 123456.78 }], rates: [{ id: "rate-66", name: "PRIVATE_RATE_SENTINEL_66", locs: "Example", annual: 987654.32, cur: "EUR" }], hrAF: {} },
        fx: [{ cur: "EUR", rate: 1.2 }, { cur: "GBP", rate: null }],
      } },
    }
    return { commit: true, value: undefined }
  })
  return { ...createLegacyDownloadApplication(store), store, close: async () => { await store.dispose(); await rm(directory, { recursive: true, force: true }) } }
}
