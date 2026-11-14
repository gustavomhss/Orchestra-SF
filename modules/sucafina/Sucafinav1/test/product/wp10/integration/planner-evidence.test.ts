import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { createSfUiAuthority } from "../../../../product/integration/ui-authority.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { createPlannerProduct } from "../../../../product/planner/product.ts"
import type { DomainPortHost } from "../../../../product/contracts/ports.ts"
import { createSfPlannerEvidence } from "../../../../../../../apps/cli/src/sucafina-product/planner-evidence.ts"

test("coverage evidence projects exact whole months through Planner without recursively reading coverage", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-planner-evidence-"))
  const driver = await openLocalStore(directory)
  const at = "2027-02-02T00:00:00Z"
  const live = { allowed: true, coverageReads: 0 }
  const subject = { installationId: "installation", projectId: "project", principalRef: "person", accessRevision: "access", policyVersion: "policy" }
  const ui = createSfUiAuthority({ authorize: async () => live.allowed ? subject : undefined, createId: randomUUID,
    now: () => Date.parse(at), commandIdentity: async () => randomUUID() })
  const request = new Request("https://example.test/planner")
  const admitted = await ui.admit(request, "sf_forecast_compare", "a".repeat(64))
  if (admitted.status !== "ok") throw new Error("Real UI authority unavailable")
  const call = admitted.value
  const persistence = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources,
    createId: randomUUID, projectScope: createSfSourceScopeProjector(() => at) })
  const host: DomainPortHost = { persistence, requestFor: (current) => current.kind === "ui" ? ui.requestFor(current) : undefined,
    revalidate: (current) => current.kind === "ui" ? ui.revalidate(current) : Promise.resolve(false),
    environment: async () => ({ at, id: randomUUID, directory: [] }),
    authenticate: async (_request, scope) => live.allowed && scope ? { id: "person", canWrite: true, roles: [{ surface: scope.surface, role: "finance" }] } : null }
  try {
    if (!await ui.validate(call, "sf_forecast_compare", "a".repeat(64))) throw new Error("Real UI read lease could not be consumed")
    for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
    await persistence.transaction("planner", async (snapshot) => {
      snapshot.data = { versions: [{ id: "v0", name: "Monthly forecast", year: 2027, closed: 1,
        lines: [{ id: "line", name: "Service", ownerId: "owner", sec: "opex", el: "licenses", cur: "USD",
          b: Array(12).fill(120), a: [100, ...Array(11).fill(null)], f: [null, ...Array(11).fill(120)] }],
        fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }],
        officials: { "2027": "v0" }, entities: [], allocations: [], roster: [] }
      return { commit: true, value: undefined }
    })
    const planner = createPlannerProduct({ host, scopedSources: persistence, coverageFor: async () => {
      live.coverageReads++
      return { status: "unavailable", reason: "coverage-not-registered" }
    } })
    const source = await planner.issueSource("v0", call)
    if (source.status !== "ok") throw new Error(`Planner source unavailable: ${source.reason}`)
    const project = createSfPlannerEvidence({ host, sources: planner.sources })
    const period = { start: "2027-01-01", end: "2027-01-31" }
    const evidence = await project(source.value.evidence, call, { period, currency: "USD" })
    expect(live.coverageReads).toBe(0)
    expect(evidence.status).toBe("ok")
    if (evidence.status !== "ok") throw new Error(`Planner projection unavailable: ${evidence.reason}`)
    expect(evidence.value.context.period).toEqual(period)
    const comparison = await planner.planner.compareForecast({ baseRef: source.value.evidence.refId,
      candidateRef: source.value.evidence.refId, period, currency: "USD" }, call)
    expect(comparison.status).toBe("ok")
    if (comparison.status !== "ok") throw new Error(`Planner comparison unavailable: ${comparison.reason}`)
    expect(evidence.value).toEqual(comparison.value.baseline)
    expect(await project(source.value.evidence, call, { period: { start: "2027-01-02", end: "2027-01-31" }, currency: "USD" }))
      .toMatchObject({ status: "needs-input", reason: "period-must-cover-whole-months-in-one-year" })
    live.allowed = false
    expect(await project(source.value.evidence, call, { period, currency: "USD" })).toMatchObject({ status: "denied" })
  } finally { ui.finish(call); await driver.dispose(); await rm(directory, { recursive: true, force: true }) }
})
