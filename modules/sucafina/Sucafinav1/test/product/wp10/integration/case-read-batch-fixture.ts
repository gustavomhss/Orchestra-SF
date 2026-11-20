import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../../product/contracts/business-context.ts"
import type { DecisionCase } from "../../../../product/contracts/decisions.ts"
import type { DecisionCasePort, PortResult } from "../../../../product/contracts/ports.ts"
import { encodeCaseRef } from "../../../../product/decisions/case-port.ts"
import { createSfPlannerCaseReadBatch } from "../../../../../../../apps/cli/src/sucafina-product/planner-case-read-batch.ts"
import { financialCompositionFixture } from "./financial-composition-fixture.ts"
import type { compositionTestDeadline } from "./composition-test-deadline.ts"

function ok<T>(result: PortResult<T>, label: string): T {
  if (result.status !== "ok") throw new Error(label + ": " + JSON.stringify(result))
  return result.value
}

export async function prepareCaseReadBatch(deadline: ReturnType<typeof compositionTestDeadline>, mixed = false) {
  const cancellation = new AbortController()
  const fixture = await financialCompositionFixture({ signal: AbortSignal.any([deadline.signal, cancellation.signal]),
    beforeEnvironment: async () => deadline.check() })
  deadline.own(() => fixture.dispose())
  await fixture.persistence.transaction("planner", async (snapshot) => {
    snapshot.data.versions = [100, 80, 120].map((amount, index) => ({ id: "source-" + index,
      name: "Recorded service " + index, year: 2026, closed: 0,
      lines: [{ id: "line", name: "Service", sec: "opex", el: "licenses", cur: "USD",
        b: Array(12).fill(amount), a: Array(12).fill(null), f: Array(12).fill(amount) }],
      fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }))
    return { commit: true, value: undefined }
  })
  await fixture.persistence.initializeSources("planner")
  const call = await fixture.read()
  deadline.own(() => fixture.authority.ui.finish(call))
  const refs: Extract<BusinessEvidenceRef, { kind: "record" }>[] = []
  for (const id of ["source-0", "source-1", "source-2"])
    refs.push(ok(await fixture.business.plannerProduct.issueSource(id, call), "Issue actual Planner source").evidence)
  const period = { start: "2026-01-01", end: "2026-12-31" }
  const companion = mixed ? await procurementSource(fixture, call, period) : undefined
  const caseRef = { id: "read-batch-case", incarnation: "read-batch-case-incarnation", version: 1 }
  // Empty C08 case plus real C02 references: no financial result, coverage
  // assertion or canonical reader is replaced by this authority fixture.
  const initial: DecisionCase = { ...caseRef, state: "draft", objective: "Read current recorded sources", currency: "USD",
    horizon: period, criteria: [{ id: "cost", description: "Preserve source provenance", required: true }],
    participants: ["person"], sourceRefs: [...refs, ...(companion ? [companion] : [])], alternatives: [], costCoverageBases: [],
    assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
  const seeded = await fixture.authority.state.transaction(fixture.request("batch-case-empty"), { namespace: "cases", expectedStorageVersion: 0,
    targetRef: fixture.authority.creationTarget.ref, targetIncarnation: fixture.authority.creationTarget.incarnation,
    idempotencyKey: "batch-case-empty", commandDigest: digestSfValue(initial) }, async (state) => {
    state.cases[initial.id] = initial
    return { commit: true, value: true }
  })
  if (seeded.status !== "ok") throw new Error("Actual case authority unavailable: " + JSON.stringify(seeded))
  const batch = (read: DecisionCasePort["read"]) => createSfPlannerCaseReadBatch({
    host: fixture.business.host, state: fixture.authority.state, read, sources: fixture.business.plannerSources,
    readerIdentity: () => fixture.business.evidence.current, lockedSourceFences: fixture.business.lockedSourceFences,
  })
  return { ...fixture, cancellation, call, caseRef, refs, companion, initial, batch,
    argument: { caseRef: encodeCaseRef(caseRef) } }
}

export function observeCaseReadBatch(fixture: Awaited<ReturnType<typeof prepareCaseReadBatch>>, deadline: ReturnType<typeof compositionTestDeadline>) {
  const counts = { physical: 0, roots: 0, transactions: 0, sources: 0, sourcesInRoot: 0, procurementSources: 0, procurementInRoot: 0 }
  const transaction = fixture.store.transaction, all = fixture.store.transactionAll, root = fixture.store.readSnapshotRoot
  const source = fixture.business.plannerSources.resolveForecastSource, procurement = fixture.business.individual.resolve
  fixture.store.transaction = (surface, work, options) => {
    counts.transactions++
    if (!fixture.store.currentSnapshots()) counts.physical++
    return transaction(surface, work, options)
  }
  fixture.store.transactionAll = (work, options) => { counts.physical++; return all(work, options) }
  fixture.store.readSnapshotRoot = (work, options) => { counts.physical++; counts.roots++; return root(work, options) }
  fixture.business.plannerSources.resolveForecastSource = (...args) => {
    counts.sources++
    if (fixture.store.currentSnapshots()) counts.sourcesInRoot++
    return source(...args)
  }
  fixture.business.individual.resolve = (...args) => {
    counts.procurementSources++
    if (fixture.store.currentSnapshots()) counts.procurementInRoot++
    return procurement(...args)
  }
  deadline.own(() => {
    fixture.store.transaction = transaction
    fixture.store.transactionAll = all
    fixture.store.readSnapshotRoot = root
    fixture.business.plannerSources.resolveForecastSource = source
    fixture.business.individual.resolve = procurement
  })
  return { counts, reset: () => { for (const key of Object.keys(counts) as (keyof typeof counts)[]) counts[key] = 0 } }
}

async function procurementSource(fixture: Awaited<ReturnType<typeof financialCompositionFixture>>,
  call: Awaited<ReturnType<typeof fixture.read>>, period: { start: string; end: string }) {
  await fixture.persistence.transaction("procurement", async (snapshot) => {
    snapshot.data.store = { settings: { currency: "USD", fxRates: [], minQuotes: 2, techWeight: 80, commWeight: 20,
      criteria: [{ name: "Technical suitability", weight: 1 }], commCriteria: [{ name: "Price", weight: 1, auto: true }], requireActiveSupplier: true },
      suppliers: [], requests: { "MIXED-1": { version: 1, by: "person", request: {
        number: "MIXED-1", status: "src_pending", createdBy: "person", createdAt: "2026-01-01T00:00:00.000Z",
        pr: { title: "Companion purchase source", type: "service", description: "Explicit source fixture", estAmount: 140,
          costCenter: "TEST", needBy: "2026-12-31", justification: "Observe the current mixed case", recurring: false },
        sourcing: { evaluator: "person", selectedId: null, approvalBaseCurrency: "USD", fxSnapshot: { USD: 1 }, quotes: [] },
      } } } }
    return { commit: true, value: undefined }
  })
  await selectCaseReadBatchPeriod(fixture, period)
  const issued = await fixture.business.individual.issue("procurement-request", "MIXED-1", call)
  if (issued.status !== "ok") throw new Error("Actual mixed source unavailable: " + issued.reason)
  const resolved = await fixture.business.individual.resolve(issued.value, call)
  if (resolved.status !== "ok") throw new Error("Actual mixed projection unavailable: " + resolved.reason)
  return resolved.value.evidence
}

export async function selectCaseReadBatchPeriod(fixture: Awaited<ReturnType<typeof financialCompositionFixture>>,
  period: { start: string; end: string }) {
  const intent = { purpose: "work-selection", period }
  const selection = await fixture.authority.ui.admit(fixture.request(), "sf_work_list", digestSfValue(intent))
  if (selection.status !== "ok" || !await fixture.authority.ui.validate(selection.value, "sf_work_list", digestSfValue(intent)))
    throw new Error("Actual Procurement selection admission unavailable")
  try {
    const selected = await fixture.business.procurementSelections.create(selection.value, period)
    if (selected.status !== "ok") throw new Error("Actual Procurement period selection unavailable")
  } finally { fixture.authority.ui.finish(selection.value) }
}
