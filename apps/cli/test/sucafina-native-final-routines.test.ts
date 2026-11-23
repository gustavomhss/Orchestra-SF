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
import { enumerateSfSources } from "../../../modules/sucafina/Sucafinav1/product/integration/source-inventory.ts"
import { withNativeInstallation } from "./fixture/sucafina-native-installation"

const it = testEffect(LayerNode.compile(AppProcess.node))

it.live.skipIf(process.platform === "win32")(
  "installed historical routine read health and residents keep planning, execution and Schedule unavailable",
  () => Effect.scoped(Effect.gen(function* () {
    expectSpawn(import.meta.path)
    const serverPassword = randomUUID()
    const serverAuthorization = "Basic " + Buffer.from("orchestra:" + serverPassword).toString("base64")
    const installation = yield* withNativeInstallation({ serverPassword, seed: async () => {} })
    yield* Effect.promise(async () => {
      const workspace = await prepareSfLocalWorkspace(installation.root)
      const discovery = await fetch(installation.origin + "/api/sucafina/installations?" +
        new URLSearchParams({ select: "location", "location[directory]": workspace }),
        { headers: { authorization: serverAuthorization },
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
        const snapshot = () => store.transaction("dashboard", async (value) => ({ commit: false, value: structuredClone(value) }))
        const before = await snapshot()
        const unchanged = async () => {
          const after = await snapshot()
          // The native maintenance job updates localJobState concurrently. The
          // original source inventory conservatively includes that field in its
          // Dashboard aggregate fingerprints. C08 and every business field,
          // audit entry, version, notice and existing scoped source must stay put.
          const stable = (value: typeof before) => digestSfValue({
            ...value,
            data: Object.fromEntries(Object.entries(value.data).filter(([key]) => key !== "localJobState")),
            sfSources: { ...value.sfSources, records: {} },
          })
          expect(digestSfValue(after.data.__sfProductV1)).toBe(digestSfValue(before.data.__sfProductV1))
          expect(stable(after)).toBe(stable(before))
          if (!before.sfSources || !after.sfSources) throw new Error("Original source identities are absent")
          expect(Object.keys(after.sfSources.records).sort()).toEqual(Object.keys(before.sfSources.records).sort())
          const first = new Map(enumerateSfSources("dashboard", before).map((entry) =>
            [JSON.stringify([entry.recordType, entry.recordId]), entry.inputDigest]))
          const latest = new Map(enumerateSfSources("dashboard", after).map((entry) =>
            [JSON.stringify([entry.recordType, entry.recordId]), entry.inputDigest]))
          const bookkeeping = new Set<string>()
          for (const [key, prior] of Object.entries(before.sfSources.records)) {
            const current = after.sfSources.records[key]!
            if (digestSfValue(current) === digestSfValue(prior)) continue
            const family: unknown = JSON.parse(key)[0]
            if (family !== "dashboard-dataset" && family !== "dashboard-page")
              throw new Error("A business source identity changed during native reads")
            expect(digestSfValue({ ...current, version: prior.version, inputDigest: prior.inputDigest })).toBe(digestSfValue(prior))
            const firstDigest = first.get(key), latestDigest = latest.get(key)
            if (typeof firstDigest !== "string" || typeof latestDigest !== "string")
              throw new Error("The original Dashboard aggregate source is absent")
            expect(prior.inputDigest).toBe(firstDigest)
            expect(current.inputDigest).toBe(latestDigest)
            expect(Number.isSafeInteger(current.version)).toBe(true)
            expect(current.version).toBeGreaterThan(prior.version)
            bookkeeping.add(family)
          }
          console.info("SF_FINAL_ROUTINES_READ_SNAPSHOT " + JSON.stringify({
            c08Unchanged: true, businessSnapshotUnchanged: true, derivedSourceBookkeeping: [...bookkeeping].sort(),
          }))
        }
        const result = await installation.request("/api/ui/context?" + query)
        expect(result.status).toBe(200)
        const context = Schema.decodeUnknownSync(SfContextResult, { onExcessProperty: "error" })(await result.json())
        if (context.status !== "ok") throw new Error("Original installed context was not admitted")
        expect(context.value.stamp.principalRef).toBe(installation.actorId)
        const operations = context.value.availability.flatMap((entry) => entry.operations)
        for (const id of ["projection.residents", "projection.routine", "routines.read-admission", "routines.read-run"]) {
          const entries = operations.filter((entry) => entry.operationId === id)
          expect(entries.length).toBeGreaterThan(0)
          expect(entries.every((entry) => entry.state === "ready" && entry.operational === true && entry.reason === null)).toBe(true)
        }
        for (const id of ["routines.catalog", "routines.prepare-admission", "routines.run", "schedules.create", "schedules.list",
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
        await unchanged()
        const denied = await fetch(installation.origin + installation.mount + "/api/ui/projections/residents",
          { headers: { authorization: serverAuthorization }, signal: AbortSignal.timeout(20_000) })
        expect(denied.status).toBe(401)
        expect((await denied.json()).status).toBe("unauthenticated")
        const crossSite = await installation.request("/api/ui/projections/residents", {
          headers: { origin: "https://unrelated.example", "sec-fetch-site": "cross-site" },
        })
        expect(crossSite.status).toBe(400)
        await unchanged()
        console.info("SF_FINAL_ROUTINES_NATIVE " + JSON.stringify({
          source: "original-native-installation", readOperations: 4, catalogOperational: false, residents: inventory.value.profiles.length,
          caseStateChangedByReads: false, approvalRequestsSubmitted: 0, schedulePortInstalled: false,
        }))
      } finally { await store.dispose() }
    })
  })),
  { timeout: 150_000 },
)
