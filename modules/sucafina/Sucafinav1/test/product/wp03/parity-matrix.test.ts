import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { domain } from "../../../runtime/planner.ts"
import type { Actor, Snapshot } from "../../../runtime/contract.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { resolve } from "../../../src/identity.ts"
import { createPlannerPort } from "../../../product/planner/port.ts"
import { createPlannerSourceIssuer } from "../../../product/planner/source-issuer.ts"
import { createSfPlannerSourceHost } from "../../../product/integration/planner-sources.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

const period = { start: "2027-01-01", end: "2027-12-31" }
const binding = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "finance", requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedDomainContext
const actor: Actor = { id: "finance", roles: ["finance"], canWrite: true, assigned: [], domains: [] }
const at = "2026-11-13T00:00:00Z"
const environment = { at, id: randomUUID, directory: [] }

test("Planner finance projection matches the legacy engine across provenance, period, currency, absence, and coverage states", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-planner-parity-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  try {
    const line = {
      id: "line",
      sec: "opex",
      el: "licenses",
      cur: "USD",
      b: [40000, 45000, 45000, 50000, 50000, 50000, 50000, 50000, 50000, 50000, 60000, 60000],
      a: [40000, 40000, 45000, 45000, 45000, 45000, 45000, 45000, 50000, null, null, null],
      f: [null, null, null, null, null, null, null, null, null, 38000, 112000, 40000],
    }
    const v0 = { id: "v0", year: 2027, closed: 9, lines: [line], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }
    const v1 = { ...structuredClone(v0), id: "v1", lines: [{ ...line, f: [...line.f.slice(0, 10), 124000, 40000] }] }
    const v2 = { ...structuredClone(v0), id: "v2", lines: [{ ...line, a: [null, 0, ...line.a.slice(2)] }] }
    const v3 = { ...structuredClone(v0), id: "v3", lines: [{ ...line, cur: "EUR" }], fx: [{ id: "EUR", cur: "EUR", rate: null }] }
    const snapshot: Snapshot = {
      data: {
        roleMap: [{ surface: "planner", role: "finance", entra: "finance-group", version: 1, by: "admin" }],
        versions: [v0, v1, v2, v3],
        officials: {},
        entities: [],
        allocations: [],
        roster: [],
      },
      versions: {},
      sequences: {},
      audit: [],
      notices: [],
    }
    await store.transaction("planner", async (current) => {
      Object.assign(current, structuredClone(snapshot))
      return { commit: true, value: undefined }
    })

    const persistence = createSfSourcePersistence({
      persistence: store,
      createId: randomUUID,
      enumerate: enumerateSfSources,
      projectScope: createSfSourceScopeProjector(() => at),
    })
    await persistence.initializeSources("planner")
    const request = new Request("https://example.test/planner", { headers: { authorization: "finance" } })
    const host: DomainPortHost = {
      persistence,
      authenticate: async (_request, context) => resolve("finance", [...context!.roleMap], (group) => group === "finance-group"),
      environment: async () => environment,
      requestFor: () => request,
      revalidate: async () => true,
    }
    const sources = createSfPlannerSourceHost({
      host,
      scopedSources: persistence,
      coverageFor: async () => ({ status: "unavailable", reason: "missing" }),
    })
    const issue = createPlannerSourceIssuer({ host, scopedSources: persistence, sources })
    const selections = await Promise.all(["v0", "v1", "v2", "v3"].map((id) => issue(id, binding)))
    if (selections.some((selection) => selection.status !== "ok")) throw new Error("Planner source issuance failed")
    const selectors = selections.flatMap((selection) => selection.status === "ok" ? [selection.value.evidence.refId] : [])
    const port = createPlannerPort({ host, sources })
    const versions = await persistence.transaction("planner", async (current) => ({
      commit: false,
      value: domain.view(current, actor, environment).data.versions as {
        id: string
        summary: { budget: number[]; actual: number[]; outlook: number[]; fullYear: number; lines: { id: string; outlook: number[] }[] }
      }[],
    }))
    const baseline = versions.find((version) => version.id === "v0")!
    const candidate = versions.find((version) => version.id === "v1")!
    const analysis = await port.compareForecast({ baseRef: selectors[0]!, candidateRef: selectors[1]!, period, currency: "USD" }, binding)

    expect(analysis.status).toBe("ok")
    if (analysis.status !== "ok") return
    expect(analysis.value.knownDifference).toBe(12000)
    expect(analysis.value.completeDifference).toBeNull()
    expect(analysis.value.comparison.comparisonStatus).toBe("conditioned")
    expect(analysis.value.gaps).toContain("cost-coverage-unavailable")
    expect(analysis.value.baseline.context).toMatchObject({ period, currency: "USD", sourceRefs: [{ id: "v0", type: "planner-version" }] })
    expect(analysis.value.candidate.context).toMatchObject({ period, currency: "USD", sourceRefs: [{ id: "v1", type: "planner-version" }] })
    expect(analysis.value.sourceRefs.map((source) => source.target.recordId)).toEqual(["v0", "v1"])
    expect(analysis.value.baseline.values.filter((value) => value.id.startsWith("month:") && value.id.endsWith(":budget")).map((value) => value.value)).toEqual(baseline.summary.budget)
    expect(analysis.value.candidate.values.filter((value) => value.id.startsWith("month:") && value.id.endsWith(":budget")).map((value) => value.value)).toEqual(candidate.summary.budget)
    expect(analysis.value.baseline.values.filter((value) => value.id.startsWith("month:") && value.id.endsWith(":outlook")).map((value) => value.value)).toEqual(baseline.summary.outlook)
    expect(analysis.value.candidate.values.filter((value) => value.id.startsWith("month:") && value.id.endsWith(":outlook")).map((value) => value.value)).toEqual(candidate.summary.outlook)
    expect(analysis.value.baseline.components.map((component) => component.amount)).toEqual(baseline.summary.lines.find((line) => line.id === "line")!.outlook)
    expect(analysis.value.candidate.components.map((component) => component.amount)).toEqual(candidate.summary.lines.find((line) => line.id === "line")!.outlook)
    expect(analysis.value.baseline.values.find((value) => value.id === "month:1:actual")).toMatchObject({ value: baseline.summary.actual[0], evidenceState: "confirmed" })
    expect(analysis.value.baseline.values.find((value) => value.id === "month:10:actual")).toMatchObject({ value: null, evidenceState: "absent" })
    expect(baseline.summary.fullYear).toBe(590000)
    expect(candidate.summary.fullYear).toBe(602000)

    const november = await port.compareForecast({
      baseRef: selectors[0]!,
      candidateRef: selectors[1]!,
      period: { start: "2027-11-01", end: "2027-11-30" },
      currency: "USD",
    }, binding)
    expect(november.status).toBe("ok")
    if (november.status === "ok") expect(november.value.baseline.values.find((value) => value.id === "line:11:budget")).toMatchObject({ value: 60000, period: { start: "2027-11-01", end: "2027-11-30" } })
    expect(await port.compareForecast({ baseRef: selectors[0]!, candidateRef: selectors[1]!, period, currency: "EUR" }, binding)).toMatchObject({ status: "needs-input", reason: "planner-requires-usd" })
    expect(await port.compareForecast({ baseRef: selectors[0]!, candidateRef: selectors[1]!, period: { start: "2027-01-02", end: "2027-12-31" }, currency: "USD" }, binding)).toMatchObject({ status: "needs-input", reason: "period-must-cover-whole-months-in-one-year" })

    const nullAndZero = await port.compareForecast({ baseRef: selectors[0]!, candidateRef: selectors[2]!, period, currency: "USD" }, binding)
    expect(nullAndZero.status).toBe("ok")
    if (nullAndZero.status === "ok") {
      expect(nullAndZero.value.candidate.values.find((value) => value.id === "month:1:actual")).toMatchObject({ value: null, evidenceState: "absent" })
      expect(nullAndZero.value.candidate.values.find((value) => value.id === "month:2:actual")).toMatchObject({ value: 0, evidenceState: "confirmed" })
      expect(nullAndZero.value.candidate.values.find((value) => value.id === "month:2:outlook")).toMatchObject({ value: 0, evidenceState: "confirmed" })
    }

    const missingFx = await port.compareForecast({ baseRef: selectors[0]!, candidateRef: selectors[3]!, period, currency: "USD" }, binding)
    expect(missingFx.status).toBe("ok")
    if (missingFx.status === "ok") {
      expect(missingFx.value.candidate.missing).toContainEqual({ field: "currency", reason: "missing-fx" })
      expect(missingFx.value.candidate.components.every((component) => component.amount === null && component.evidenceState === "absent")).toBe(true)
      expect(missingFx.value.candidate.values.find((value) => value.id === "month:1:outlook")).toMatchObject({ value: null, evidenceState: "absent" })
    }

    await persistence.transaction("planner", async (current) => {
      const stored = current.data.versions as { id: string; lines: { f: (number | null)[] }[] }[]
      stored.find((version) => version.id === "v1")!.lines[0]!.f[10] = 125000
      return { commit: true, value: undefined }
    })
    expect(await port.compareForecast({ baseRef: selectors[0]!, candidateRef: selectors[1]!, period, currency: "USD" }, binding)).toMatchObject({ status: "stale", reason: "source-replaced-or-changed" })
  } finally {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
