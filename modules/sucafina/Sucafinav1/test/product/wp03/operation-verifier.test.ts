import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { resolve } from "../../../src/identity.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createPlannerProduct } from "../../../product/planner/product.ts"
import { createPlannerOperationResolver, createPlannerOperationVerifier } from "../../../product/planner/operation-verifier.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { ScenarioOperation } from "../../../product/contracts/operations.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"

test("operation proof uses the same domain admission for closed, include, duplicate and defer cases", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-operation-proof-"))
  const database = await openLocalStore(directory)
  try {
    const at = "2026-11-13T00:00:00Z"
    const persistence = createSfSourcePersistence({ persistence: database, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) })
    await persistence.initializeSources("planner")
    await persistence.transaction("planner", async (snapshot) => {
      snapshot.data = { roleMap: [{ surface: "planner", role: "finance", entra: "finance-group", version: 1, by: "admin" }], versions: [{ id: "v", year: 2027, closed: 9, lines: [{ id: "line", sec: "opex", el: "licenses", cur: "USD", b: Array(12).fill(100), a: Array(12).fill(20), f: Array(12).fill(30) }], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }] }
      return { commit: true, value: undefined }
    })
    for (const surface of ["dashboard", "procurement"] as const) await database.transaction(surface, async (snapshot) => { snapshot.data = { preserved: surface, revision: 7 }; return { commit: true, value: undefined } })
    const access = { allowed: true }
    const http = new Request("https://example.test", { headers: { authorization: "finance" } })
    const context = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "finance", requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
    const host: DomainPortHost = { persistence, authenticate: async (_request, scope) => resolve("finance", [...scope!.roleMap], (group) => group === "finance-group"), environment: async () => ({ at, id: randomUUID, directory: [] }), requestFor: () => http, revalidate: async () => access.allowed }
    const product = createPlannerProduct({ host, scopedSources: persistence, coverageFor: async () => ({ status: "unavailable", reason: "coverage-not-selected" }) })
    const source = await product.issueSource("v", context)
    expect(source.status).toBe("ok")
    if (source.status !== "ok") return
    const input = { host, planner: product.planner, sources: product.sources, scenarioInputs: product.scenarioInputs }
    const verify = createPlannerOperationVerifier(input)
    const resolver = createPlannerOperationResolver(input)
    const before = await database.transactionAll!(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) }))
    const run = (operations: readonly ScenarioOperation[]) => verify({ baseRef: source.value.evidence.refId, operations, assumptions: [] }, context)
    const valid: ScenarioOperation = { kind: "replace", targetRef: "line:11", amount: 42, currency: "USD" }
    expect(await run([valid])).toBe(true)
    expect(await resolver({ baseRef: source.value.evidence.refId, operation: valid }, context)).toMatchObject({ status: "ok", value: { producer: "planner" } })
    const invalid: ScenarioOperation[] = [
      { ...valid, targetRef: "line:1" },
      { ...valid, kind: "include" },
      { kind: "defer", targetRef: "line:11", period: { start: "2027-01-01", end: "2027-01-31" } },
    ]
    for (const operation of invalid) {
      expect(await run([operation])).toBe(false)
      expect(await resolver({ baseRef: source.value.evidence.refId, operation }, context)).toMatchObject({ status: "unavailable" })
    }
    expect(await run([valid, valid])).toBe(false)
    expect(await run([{ kind: "defer", targetRef: "line:11", period: { start: "2027-12-01", end: "2027-12-31" } }])).toBe(true)
    expect(await database.transactionAll!(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) }))).toEqual(before)
    // A completed domain observation cannot authorize a different call or
    // caller-owned input changed by the last asynchronous authority callback.
    for (const fault of ["input", "request", "headers", "lease", "binding"] as const) {
      const incoming = { baseRef: source.value.evidence.refId, operations: [structuredClone(valid)], assumptions: [] }
      const originalLease = context.lease, originalPolicy = context.binding.policyVersion
      let currentRequest = http, validations = 0, injected = false
      const guardedHost: DomainPortHost = { ...host, requestFor: () => currentRequest, revalidate: async (trusted) => {
        const allowed = await host.revalidate(trusted)
        if (++validations === 2) {
          injected = true
          if (fault === "input") incoming.operations[0]!.amount = 43
          if (fault === "request") currentRequest = new Request(http)
          if (fault === "headers") http.headers.set("authorization", "another-principal")
          if (fault === "lease") Object.assign(context, { lease: {} })
          if (fault === "binding") Object.assign(context.binding, { policyVersion: "changed" })
        }
        return allowed
      } }
      try {
        expect(await createPlannerOperationVerifier({ ...input, host: guardedHost })(incoming, context)).toBe(false)
        expect(injected).toBe(true)
      } finally {
        http.headers.set("authorization", "finance")
        Object.assign(context, { lease: originalLease })
        Object.assign(context.binding, { policyVersion: originalPolicy })
      }
    }

    // Mutate the actual persisted source after simulation. The independent
    // final raw observation must refuse the previously admitted selector.
    let observations = 0, sourceChanged = false
    const changingHost: DomainPortHost = { ...host, persistence: { ...persistence, transaction: async (surface, work, options) => {
      const result = await persistence.transaction(surface, work, options)
      if (surface === "planner" && ++observations === 2) {
        await persistence.transaction("planner", async (snapshot) => {
          const versions = snapshot.data.versions as { lines: { f: number[] }[] }[]
          versions[0]!.lines[0]!.f[10] = 31
          return { commit: true, value: undefined }
        })
        sourceChanged = true
      }
      return result
    } } }
    expect(await createPlannerOperationVerifier({ ...input, host: changingHost })({ baseRef: source.value.evidence.refId, operations: [valid], assumptions: [] }, context)).toBe(false)
    expect(sourceChanged).toBe(true)
    access.allowed = false
    expect(await run([valid])).toBe(false)
  } finally { await database.dispose(); await rm(directory, { recursive: true, force: true }) }
})
