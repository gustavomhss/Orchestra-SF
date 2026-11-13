import { createHash } from "node:crypto"
import { writeFile } from "node:fs/promises"
import path from "node:path"
import { prepareLocalConfiguration } from "../../../../../modules/sucafina/Sucafinav1/runtime/local-configuration.ts"
import { prepareOperatorAccess } from "../../../../../modules/sucafina/Sucafinav1/local/enroll.ts"
import { openLocalStore } from "../../../../../modules/sucafina/Sucafinav1/runtime/local-store.ts"
import { initialProcurementSettings } from "../../../../../modules/sucafina/Sucafinav1/src/initial-settings.ts"
import { createVolumeCorpus } from "../../../../../modules/sucafina/Sucafinav1/test/product/wp00/fixtures/volume.ts"
import { createPlannerCorpus } from "../../../../../modules/sucafina/Sucafinav1/test/product/wp00/fixtures/planner.ts"

// This helper prepares synthetic data through the existing persistence adapter. It starts no server.
if (process.env.GITHUB_ACTIONS !== "true") throw new Error("WP00 browser qualification runs only in GitHub Actions")
const directory = process.argv[2]
if (!directory || !path.isAbsolute(directory)) throw new Error("An absolute private fixture directory is required")
const config = await prepareLocalConfiguration(directory)
const volume = createVolumeCorpus()
const dashboard = {
  opexOwners: [{ id: "synthetic-owner", name: "Synthetic volume owner", budget: 12000 }],
  opexEntries: volume.financial,
  capexProjects: volume.projects,
  capexEntries: [],
  projects: volume.projects,
  revenueByYear: { "2027": 1000000 },
  budgetCurrentMonth: { "2027": 9 },
}
const planner = createPlannerCorpus()
const procurement = {
  store: {
    settings: initialProcurementSettings(),
    issued: { pr: [], po: [] },
    sup: [], suppliers: [], actCalls: 0, lastIssued: null,
    requests: Object.fromEntries(volume.purchaseOrders.map((request) => [request.number, {
      request: { ...request, history: [] }, version: 1, by: "synthetic-seed",
    }])),
  },
}
const store = await openLocalStore(path.join(directory, "business-local"))
try {
  for (const surface of ["dashboard", "planner", "procurement"] as const) {
    await store.transaction(surface, async (snapshot) => {
      snapshot.data = structuredClone(surface === "dashboard" ? dashboard : surface === "planner" ? planner.data : procurement)
      snapshot.versions = { dataset: { version: 1, by: "synthetic-seed" } }
      snapshot.sequences = {}; snapshot.audit = []; snapshot.notices = []
      return { commit: true, value: true }
    })
  }
} finally { await store.dispose() }
await prepareOperatorAccess(config, true)
await writeFile(path.join(directory, "corpus-receipt.json"), JSON.stringify({
  schema: "wp00-ui-corpus-v1", synthetic: true,
  datasetDigest: createHash("sha256").update(JSON.stringify({ dashboard, planner: planner.data, procurement })).digest("hex"),
  counts: { financialLines: volume.financial.length, purchaseOrders: volume.purchaseOrders.length, projects: volume.projects.length },
  expected: { actual2027: "$1000", forecast2027: "$2000", openRequests: 200, firstRequest: "synthetic-po-1", firstAmount: "1 USD", lastRequest: "synthetic-po-200", lastAmount: "200 USD" },
  runtimeVersion: Bun.version,
  authentication: "local-operator",
  provider: "runtime/local-store.ts#openLocalStore",
}), { mode: 0o600 })
