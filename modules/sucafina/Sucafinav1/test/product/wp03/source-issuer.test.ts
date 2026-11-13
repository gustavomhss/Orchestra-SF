import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { resolve } from "../../../src/identity.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { sfPlannerProjectionSelector, createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { plannerPreparedRevision, preparePlannerMutation } from "../../../product/planner/prepared.ts"
import { createPlannerProduct } from "../../../product/planner/product.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

const binding = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "finance", requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedDomainContext

test("planner issuer resolves authenticated current identities and rejects stale and revoked sources", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-planner-issuer-"))
  const store = await openLocalStore(directory)
  try {
    const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => "2026-11-13T00:00:00Z") })
    await persistence.initializeSources("planner")
    await persistence.transaction("planner", async (snapshot) => {
      snapshot.data.roleMap = [{ surface: "planner", role: "finance", entra: "finance-group", version: 1, by: "admin" }]
      snapshot.data.versions = [{ id: "v0", year: 2027, closed: 0, lines: [{ id: "line", sec: "opex", el: "licenses", cur: "USD", b: [100] }], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }]
      return { commit: true, value: undefined }
    })
    const session = { request: new Request("https://example.test", { headers: { authorization: "finance" } }), active: true }
    const host: DomainPortHost = { persistence, authenticate: async (request, context) => { const id = request.headers.get("authorization"); return id ? resolve(id, [...context!.roleMap], (group) => id === "finance" && group === "finance-group") : null }, environment: async () => ({ at: "2026-11-13T00:00:00Z", id: randomUUID, directory: [] }), requestFor: () => session.request, revalidate: async () => session.active }
    const product = createPlannerProduct({ host, scopedSources: persistence, coverageFor: async () => ({ status: "unavailable", reason: "missing" }) })
    const first = await product.issueSource("v0", binding)
    expect(first.status).toBe("ok")
    if (first.status !== "ok") return
    expect(first.value.evidence.refId).toMatch(/^planner-version:/)
    expect(await product.sources.resolveForecastSource(first.value.evidence.refId, binding)).toMatchObject({ status: "ok" })
    const captured = await persistence.transaction("planner", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    const actor = { id: "finance", roles: ["finance"], canWrite: true, assigned: [], domains: [] }
    const environment = { at: "2026-11-13T00:00:00Z", id: randomUUID, directory: [] }
    const target = { surface: "planner" as const, type: "planner-version", id: "v0", incarnation: first.value.evidence.target.incarnation, version: first.value.evidence.target.version, fields: first.value.evidence.target.fields, period: first.value.evidence.target.period!, observedAt: environment.at }
    const scope = { principalRef: "finance", accessRevision: "1", policyVersion: "1", recordType: "planner-version", recordId: "v0", selector: sfPlannerProjectionSelector(captured, actor) }
    const prepared = preparePlannerMutation({ snapshot: captured, actor, environment, context: binding, target, scope, command: { page: "OPEX", action: "save", id: "line", version: 0, values: { versionId: "v0", f0: 42 } }, operationId: "operation", idempotencyKey: "edit" })
    expect(prepared).toBeDefined()
    if (!prepared) return
    const staged = structuredClone(captured)
    expect(prepared.mutation.execute(staged, actor, environment)).toMatchObject({ commit: true, value: { status: "applied" } })
    expect((staged.data.versions as { lines: { f: (number | null)[] }[] }[])[0].lines[0].f[0]).toBe(42)
    expect(plannerPreparedRevision(staged, prepared.command)).toBe(1)
    expect(plannerPreparedRevision(captured, prepared.command)).toBeUndefined()
    expect((captured.data.versions as { lines: { f?: (number | null)[] }[] }[])[0].lines[0].f?.[0]).not.toBe(42)
    expect(prepared.mutation.execute(staged, actor, environment)).toMatchObject({ commit: false, value: { status: "conflict" } })
    expect(prepared.mutation.execute(structuredClone(captured), { ...actor, id: "other" }, environment)).toMatchObject({ commit: false, value: { status: "denied" } })
    expect(prepared.mutation.execute(structuredClone(captured), { ...actor, assigned: ["forged"] }, environment)).toMatchObject({ commit: false, value: { status: "denied" } })
    expect(preparePlannerMutation({ snapshot: captured, actor, environment, context: binding, target, scope, command: { page: "OPEX", action: "save", id: "line", version: 0, values: { versionId: "v0", b0: 42 } }, operationId: "operation", idempotencyKey: "edit" })).toBeUndefined()
    expect(preparePlannerMutation({ snapshot: captured, actor, environment, context: binding, target, scope: { ...scope, accessRevision: "revoked" }, command: { page: "OPEX", action: "save", id: "line", version: 0, values: { versionId: "v0", f0: 42 } }, operationId: "operation", idempotencyKey: "edit" })).toBeUndefined()
    expect(preparePlannerMutation({ snapshot: captured, actor, environment, context: binding, target: { ...target, period: { start: "2027-02-01", end: "2027-02-28" } }, scope, command: { page: "OPEX", action: "save", id: "line", version: 0, values: { versionId: "v0", f0: 42 } }, operationId: "operation", idempotencyKey: "edit" })).toBeUndefined()

    await persistence.transaction("planner", async (snapshot) => { const versions = snapshot.data.versions as { lines: { b: number[] }[] }[]; versions[0].lines[0].b[0] = 200; return { commit: true, value: undefined } })
    expect(await product.sources.resolveForecastSource(first.value.evidence.refId, binding)).toMatchObject({ status: "stale" })
    const second = await product.issueSource("v0", binding)
    expect(second.status).toBe("ok")
    if (second.status === "ok") expect(second.value.evidence.target.version).toBeGreaterThan(first.value.evidence.target.version)
    session.active = false
    expect(await product.issueSource("v0", binding)).toMatchObject({ status: "denied" })
    expect(await product.sources.resolveForecastSource(first.value.evidence.refId, binding)).toMatchObject({ status: "denied" })
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
