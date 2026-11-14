import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import type { SfProductState } from "../../../product/contracts/state.ts"
import { createPortfolioHistory } from "../../../product/decisions/portfolio-history.ts"
import { createPortfolioResultBindings, type PortfolioBinding } from "../../../product/decisions/portfolio-bindings.ts"
import type { PortfolioSelection } from "../../../product/decisions/portfolio-selection.ts"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"

/** Reader-boundary proof only: the empty portfolio does not stand in for canonical financial replay. */
test("portfolio history can retain a result at the same case version and still requires private provenance and current access", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-history-version-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  try {
    const access = { current: true, provenance: true }
    const writes = new WeakSet<object>()
    const request = new Request("https://example.test")
    const context = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "principal", requestId: "request", policyVersion: "policy", accessRevision: "access", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
    const host = { requestFor: () => request, revalidate: async () => access.current }
    const state = createSfProductState({ persistence: store, proposalCoverageWrites: writes, createId: () => "state", resolveTarget: async () => ({ incarnation: "inc" }), authorize: async () => access.current ? { principalRef: "principal", policyVersion: "policy", accessRevision: "access" } : undefined })
    const caseRef = { id: "case", incarnation: "inc", version: 1 }
    const horizon = { start: "2027-01-01", end: "2027-12-31" }
    const decision = { ...caseRef, state: "comparing", objective: "review retained result", currency: "USD", horizon, participants: ["principal"], criteria: [], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] } as const
    await state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, targetRef: "case", targetIncarnation: "inc", idempotencyKey: "seed", commandDigest: "a".repeat(64) }, async (value) => { value.cases.case = decision; return { commit: true, value: true } })
    const results = createSfDecisionResultStore({ state, host, authorizeCase: async () => access.current, verifySources: async () => access.current, createId: () => "result", now: () => "2026-11-14T00:00:00Z" })
    const portfolioRequest = { scope: { horizon, currency: "USD" }, candidateRefs: ["candidate"], operations: [], constraints: [], priorities: [], explorationLimit: 1 }
    const saved = await results.write({ kind: "portfolio", caseRef, requestDigest: digestSfValue(portfolioRequest), result: { combinations: [], limitations: ["reader fixture"], evidenceRefs: [] }, sourceRefs: [], idempotencyKey: "portfolio" }, context)
    if (saved.status !== "ok") throw new Error(saved.reason)
    const selectionBase = { schema: "sf-portfolio-selection-v1" as const, selectionRef: "selection", caseRef, baselineAlternativeId: "base", alternativeId: "alternative", baselineRef: "base-result", alternativeRef: "alternative-result", criteria: [], comparisonDigest: "b".repeat(64), version: 1, principalRef: "principal", accessRevision: "access", policyVersion: "policy", createdAt: "2026-11-14T00:00:00Z" }
    const selection: PortfolioSelection = { ...selectionBase, selectionDigest: digestSfValue(selectionBase) }
    const bindingBase = { schema: "sf-portfolio-binding-v1" as const, caseRef, resultRef: saved.value.resultRef, resultDigest: saved.value.resultDigest, request: portfolioRequest, requestDigest: digestSfValue(portfolioRequest), proof: { candidates: [{ ref: "candidate", digest: "c".repeat(64) }], selectionDigest: selection.selectionDigest }, createdAt: "2026-11-14T00:00:00Z" }
    const binding: PortfolioBinding = { ...bindingBase, bindingDigest: digestSfValue(bindingBase) }
    const bindingKey = `sf:criterion-rule:portfolio:${digestSfValue(saved.value.resultRef)}`
    const put = async (item: PortfolioBinding, key: string) => {
      const current = await state.read(request, "preferences", () => null)
      if (current.status !== "ok") throw new Error("preferences unavailable")
      const work = async (value: SfProductState) => { value.preferences[bindingKey] = item; value.preferences["sf:criterion-rule:selection:history:selection"] = selection; return { commit: true, value: true } }
      writes.add(work)
      const written = await state.transaction(request, { namespace: "preferences", expectedStorageVersion: current.storageVersion, targetRef: "case", targetIncarnation: "inc", idempotencyKey: key, commandDigest: digestSfValue(item) }, work).finally(() => writes.delete(work))
      expect(written.status).toBe("ok")
    }
    await put(binding, "bind")
    const unavailable = async () => ({ status: "unavailable" as const, reason: "not-used-by-historical-reader" })
    const bindings = createPortfolioResultBindings({ state, host, results, selection: { read: unavailable, inspect: unavailable, register: unavailable }, resolveCandidate: unavailable, authorizeCase: async () => access.current, verifyBinding: async () => false, verifySnapshot: () => false, operationIdentity: () => "unused", proposalCoverageWrites: writes, now: () => "2026-11-14T00:00:00Z" })
    const history = createPortfolioHistory({ state, host, authorizeCase: async () => access.current, verifyHistoricalProvenance: async (stored, context) => access.provenance && (await bindings.readHistoricalBinding({ caseRef, resultRef: stored.resultRef }, context)).status === "ok" })
    const lookup = { caseRef, resultRef: saved.value.resultRef }
    expect(await bindings.readHistoricalBinding(lookup, context)).toMatchObject({ status: "ok", value: { binding, selection } })
    expect(await history.read(lookup, context)).toMatchObject({ status: "ok", value: { state: "historical", originalCaseRef: caseRef, resultDigest: saved.value.resultDigest } })
    expect(await history.list({ caseRef }, context)).toMatchObject({ status: "ok", value: [{ resultRef: saved.value.resultRef }] })
    expect((await history.read({ ...lookup, caseRef: { ...caseRef, version: 2 } }, context)).status).toBe("denied")
    access.provenance = false
    expect((await history.read(lookup, context)).status).toBe("denied")
    access.provenance = true
    access.current = false
    expect((await history.read(lookup, context)).status).toBe("denied")
    access.current = true
    await put({ ...binding, requestDigest: "d".repeat(64) }, "tampered-binding")
    expect((await bindings.readHistoricalBinding(lookup, context)).status).toBe("unavailable")
    expect((await history.read(lookup, context)).status).toBe("denied")
    expect(await history.list({ caseRef }, context)).toMatchObject({ status: "ok", value: [] })
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
