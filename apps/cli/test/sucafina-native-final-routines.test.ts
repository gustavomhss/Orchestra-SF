import { expect } from "bun:test"
import { randomUUID } from "node:crypto"
import { AppProcess } from "@orchestra/core/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { testEffect } from "@orchestra/core/test/lib/effect"
import { Effect, Schema } from "effect"
import { SfInstallationList, SfContextResult } from "@orchestra/schema/sucafina/context"
import { SfProjectionResidents } from "@orchestra/schema/sucafina/analyses"
import { prepareSfLocalWorkspace } from "../../../modules/sucafina/Sucafinav1/local/workspace.ts"
import { openLocalStore } from "../../../modules/sucafina/Sucafinav1/runtime/local-store.ts"
import { digestSfValue } from "../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { withNativeInstallation } from "./fixture/sucafina-native-installation"

const it = testEffect(LayerNode.compile(AppProcess.node))

it.live.skipIf(process.platform === "win32")(
  "installed routine read health and resident inventory keep native execution and Schedule unavailable",
  () => Effect.scoped(Effect.gen(function* () {
    expectSpawn(import.meta.path)
    const serverPassword = randomUUID()
    const installation = yield* withNativeInstallation({ serverPassword, seed: async () => {} })
    yield* Effect.promise(async () => {
      const workspace = await prepareSfLocalWorkspace(installation.root)
      const discovery = await fetch(installation.origin + "/api/sucafina/installations?" +
        new URLSearchParams({ select: "location", "location[directory]": workspace }),
        { headers: { authorization: "Basic " + Buffer.from("orchestra:" + serverPassword).toString("base64") },
          signal: AbortSignal.timeout(20_000) })
      expect(discovery.status).toBe(200)
      const catalog = Schema.decodeUnknownSync(SfInstallationList, { onExcessProperty: "error" })(await discovery.json())
      expect(catalog.installations).toHaveLength(1)
      const owner = catalog.installations[0]!
      const year = new Date().getUTCFullYear()
      // Initial case state is created only by its original human command.
      const created = await installation.request("/dashboard?sf=workbench-command", {
        method: "POST", headers: { "content-type": "application/json", "idempotency-key": randomUUID() },
        body: JSON.stringify({ operation: "sf_case_draft", input: {
          objective: "Installed routine reading source", horizon: { start: year + "-01-01", end: year + "-12-31" },
          currency: "USD", criteria: ["Review the authorized source"], sourceRefs: [],
        } }),
      })
      expect(created.status).toBe(200)
      expect((await created.json()).status).toBe("ok")
      const query = new URLSearchParams({ installationId: owner.installationId, projectId: owner.projectId, hostId: owner.hostId })
      const store = await openLocalStore(installation.businessDirectory)
      try {
        const snapshot = () => store.transaction("dashboard", async (value) => ({ commit: false, value: digestSfValue(value) }))
        const before = await snapshot()
        const result = await installation.request("/api/ui/context?" + query)
        expect(result.status).toBe(200)
        const context = Schema.decodeUnknownSync(SfContextResult, { onExcessProperty: "error" })(await result.json())
        if (context.status !== "ok") throw new Error("Original installed context was not admitted")
        expect(context.value.stamp.principalRef).toBe(installation.actorId)
        const operations = context.value.availability.flatMap((entry) => entry.operations)
        for (const id of ["projection.residents", "projection.routine", "routines.catalog", "routines.read-admission", "routines.read-run"]) {
          const entries = operations.filter((entry) => entry.operationId === id)
          expect(entries.length).toBeGreaterThan(0)
          expect(entries.every((entry) => entry.state === "ready" && entry.operational === true && entry.reason === null)).toBe(true)
        }
        for (const id of ["routines.prepare-admission", "routines.run", "schedules.create", "schedules.list",
          "schedules.read", "schedules.update", "schedules.pause", "schedules.read-run"]) {
          const entries = operations.filter((entry) => entry.operationId === id)
          expect(entries.length).toBeGreaterThan(0)
          expect(entries.every((entry) => entry.state === "unavailable" && entry.operational === false)).toBe(true)
        }
        const response = await installation.request("/api/ui/projections/residents")
        expect(response.status).toBe(200)
        const inventory = Schema.decodeUnknownSync(SfProjectionResidents, { onExcessProperty: "error" })(await response.json())
        if (inventory.status !== "ok") throw new Error("Original installed residents were not readable")
        expect(inventory.context).toEqual(context.value.stamp)
        expect(inventory.value.profiles.map((entry) => entry.id).sort()).toEqual(["sf_finance", "sf_maestro", "sf_portfolio", "sf_procurement", "sf_reviewer"])
        expect(await snapshot()).toBe(before)
        const denied = await fetch(installation.origin + installation.mount + "/api/ui/projections/residents",
          { signal: AbortSignal.timeout(20_000) })
        expect(denied.status).toBe(401)
        expect((await denied.json()).status).toBe("unauthenticated")
        const crossSite = await installation.request("/api/ui/projections/residents", {
          headers: { origin: "https://unrelated.example", "sec-fetch-site": "cross-site" },
        })
        expect(crossSite.status).toBe(400)
        expect(await snapshot()).toBe(before)
        console.info("SF_FINAL_ROUTINES_NATIVE " + JSON.stringify({
          source: "original-native-installation", readOperations: 5, residents: inventory.value.profiles.length,
          caseStateChangedByReads: false, approvalRequestsSubmitted: 0, schedulePortInstalled: false,
        }))
      } finally { await store.dispose() }
    })
  })),
  { timeout: 150_000 },
)
