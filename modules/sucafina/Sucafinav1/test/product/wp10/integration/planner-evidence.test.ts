import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { createSfUiAuthority } from "../../../../product/integration/ui-authority.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { createPlannerProduct } from "../../../../product/planner/product.ts"
import type { DomainPortHost } from "../../../../product/contracts/ports.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { createSfPlannerEvidence } from "../../../../../../../apps/cli/src/sucafina-product/planner-evidence.ts"
import { createSfBusinessServices } from "../../../../../../../apps/cli/src/sucafina-product/business-services.ts"

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

for (const changed of ["source", "principal"] as const) test(`composed BCS rejects a Planner ${changed} change during the authorized projection`, async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-planner-bcs-"))
  const driver = await openLocalStore(directory)
  const at = "2027-02-02T00:00:00Z"
  const persistence = { ...driver, ...createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources,
    createId: randomUUID, projectScope: createSfSourceScopeProjector(() => at) }) }
  const actor = { id: "person" }
  const duringProjection: { action?: () => Promise<void> } = {}
  const identity = { installationId: "installation", hostId: "host", projectId: "project",
    location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
  const proposalCoverageWrites = new WeakSet<object>()
  const authority = createSfProductAuthority({ identity: () => identity, installationId: identity.installationId,
    origin: "https://example.test", policyVersion: "policy", persistence, proposalCoverageWrites,
    grants: [{ principalRef: "person", namespaces: ["preferences", "cases"], operations: ["sf_forecast_compare"] }],
    now: Date.now, createId: randomUUID,
    authenticate: async (_request, scope) => scope ? { id: actor.id, canWrite: true, roles: [{ surface: scope.surface, role: "admin" }] } : null,
    environment: async () => {
      // A real host boundary runs after the first source proof and before the
      // projection. The callback changes persisted data or current identity.
      const action = duringProjection.action
      delete duringProjection.action
      await action?.()
      return { at, id: randomUUID, directory: [] }
    },
    commandIdentity: async (_request, operation, digest) => digestSfValue({ operation, digest }),
    inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false,
    providerGeneration: async () => undefined, authorizeDocument: async () => undefined })
  const business = createSfBusinessServices({ authority, persistence, proposalCoverageWrites })
  const request = new Request("https://example.test/planner", { headers: { origin: "https://example.test" } })
  const forecast = (amount: number) => ({ id: "v0", year: 2027, closed: 0,
    lines: [{ id: "line", sec: "opex", el: "licenses", cur: "USD", b: Array(12).fill(120), a: Array(12).fill(null), f: Array(12).fill(amount) }],
    fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} })
  try {
    for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
    await persistence.transaction("planner", async (snapshot) => {
      snapshot.data.versions = [forecast(120)]
      return { commit: true, value: undefined }
    })
    business.initializeAtlas(undefined, { boundaryVersion: "planner-bcs-fixture", schemaVersion: "a".repeat(64), manifestVersion: "b".repeat(64), skillVersion: "c".repeat(64) })
    const digest = digestSfValue({ version: "v0" })
    const admitted = await authority.ui.admit(request, "sf_forecast_compare", digest)
    if (admitted.status !== "ok") throw new Error("Real product authority unavailable")
    const call = admitted.value
    try {
      if (!await authority.ui.validate(call, "sf_forecast_compare", digest)) throw new Error("Real product lease unavailable")
      const source = await business.plannerProduct.issueSource("v0", call)
      if (source.status !== "ok") throw new Error(`Real Planner source unavailable: ${source.reason}`)
      const before = await business.context.context({ refs: [source.value.evidence] }, call)
      expect(before[0]).toMatchObject({ state: "fresh", ref: source.value.evidence, currentRef: source.value.evidence,
        authorizedProjection: { context: { principalRef: "person", surface: "planner" } } })
      duringProjection.action = changed === "source" ? async () => {
        await persistence.transaction("planner", async (snapshot) => {
          snapshot.data.versions = [forecast(240)]
          return { commit: true, value: undefined }
        })
      } : async () => { actor.id = "other-person" }
      const after = await business.context.context({ refs: [source.value.evidence] }, call)
      expect(duringProjection.action).toBeUndefined()
      expect(after[0]?.state).toBe("unavailable")
      expect(after[0]?.authorizedProjection).toBeUndefined()
      expect((await business.context.context({ refs: [source.value.evidence] }, call))[0]?.state).not.toBe("fresh")
    } finally { authority.ui.finish(call) }
  } finally { business.dispose(); await driver.dispose(); await rm(directory, { recursive: true, force: true }) }
})
