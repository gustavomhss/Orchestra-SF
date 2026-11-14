import { createHash } from "node:crypto"
import { writeFile } from "node:fs/promises"
import path from "node:path"
import { prepareLocalConfiguration } from "../../../../../modules/sucafina/Sucafinav1/runtime/local-configuration.ts"
import { prepareOperatorAccess } from "../../../../../modules/sucafina/Sucafinav1/local/enroll.ts"
import { openLocalStore } from "../../../../../modules/sucafina/Sucafinav1/runtime/local-store.ts"
import { initialProcurementSettings } from "../../../../../modules/sucafina/Sucafinav1/src/initial-settings.ts"
import { createVolumeCorpus } from "../../../../../modules/sucafina/Sucafinav1/test/product/wp00/fixtures/volume.ts"
import { createPlannerCorpus } from "../../../../../modules/sucafina/Sucafinav1/test/product/wp00/fixtures/planner.ts"
import inputs from "../../../../../modules/sucafina/Sucafinav1/test/product/wp00/fixtures/consumer-inputs.json"
import type { UiCorpusReceipt } from "./flows.ts"

// This helper prepares synthetic data through the existing persistence adapter. It starts no server.
if (process.env.GITHUB_ACTIONS !== "true") throw new Error("WP00 browser qualification runs only in GitHub Actions")
const directory = process.argv[2]
if (!directory || !path.isAbsolute(directory)) throw new Error("An absolute private fixture directory is required")
const config = await prepareLocalConfiguration(directory)
const volume = createVolumeCorpus()
const projects = volume.projects.map((project, index) => ({ ...project, name: `WP00 project ${String(index + 1).padStart(3, "0")} END` }))
const dashboard = {
  opexOwners: [{ id: "synthetic-owner", name: "Synthetic volume owner", budget: 12000 }],
  opexEntries: volume.financial,
  capexProjects: projects,
  capexEntries: [],
  projects,
  revenueByYear: { "2027": 1000000 },
  budgetCurrentMonth: { "2027": 9 },
}
const planner = createPlannerCorpus()
type SeedPlan = { id: string; name?: string; locked: boolean; lines: { id: string; f: (number | null)[] }[] }
const versions = planner.data.versions as SeedPlan[]
const base = versions[0]
if (!base || base.id !== inputs.planner.versionId) throw new Error("The explicit Planner corpus is missing its base version")
base.name = "WP00 base 2027"
base.locked = true
for (const amount of [84000, 78000]) {
  const alternative = structuredClone(base)
  alternative.id = `synthetic-corpus-${amount}`
  alternative.name = `WP00 alternative ${amount}`
  alternative.locked = false
  const license = alternative.lines.find((line) => line.id === inputs.planner.licenseLineId)
  if (!license) throw new Error("The explicit Planner corpus is missing the license line")
  license.f[inputs.planner.licenseMonthIndex] = amount
  versions.push(alternative)
}
planner.data.officials = { "2027": base.id }
const procurement = {
  store: {
    settings: initialProcurementSettings(),
    issued: { pr: [], po: [] },
    sup: [], suppliers: [], actCalls: 0, lastIssued: null,
    requests: Object.fromEntries(volume.purchaseOrders.map((request) => [request.number, {
      request: {
        ...request, history: [],
        ...(request.number === "synthetic-po-1" ? {
          pr: { ...request.pr, title: "WP00 sourcing comparison", estAmount: inputs.procurement.prEstimate },
          sourcing: { ...inputs.procurement, selectedId: null },
        } : {}),
      }, version: 1, by: "synthetic-seed",
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
const receipt: UiCorpusReceipt & { synthetic: true } = {
  schema: "wp00-ui-corpus-v2", synthetic: true,
  datasetDigest: createHash("sha256").update(JSON.stringify({ dashboard, planner: planner.data, procurement })).digest("hex"),
  counts: { financialLines: volume.financial.length, purchaseOrders: volume.purchaseOrders.length, projects: volume.projects.length },
  expected: { actual2027: "$1000", forecast2027: "$2000", openRequests: 200, firstRequest: "synthetic-po-1", firstAmount: "32000 USD", lastRequest: "synthetic-po-200", lastAmount: "200 USD" },
  planner: {
    baseId: inputs.planner.versionId, baseName: "WP00 base 2027", alternative84Id: "synthetic-corpus-84000", alternative78Id: "synthetic-corpus-78000", alternative78Name: "WP00 alternative 78000",
    baseOutlook: "$590,000.00", outlook84: "$602,000.00", outlook78: "$596,000.00", budget: "$600,000.00", actual: "$400,000.00",
  },
  sourcing: { requestId: "synthetic-po-1", title: "WP00 sourcing comparison" },
  report: { names: projects.map((project) => project.name), search: projects[0]!.name },
  runtimeVersion: Bun.version,
  authentication: "local-operator",
  provider: "runtime/local-store.ts#openLocalStore",
}
await writeFile(path.join(directory, "corpus-receipt.json"), JSON.stringify(receipt), { mode: 0o600 })
