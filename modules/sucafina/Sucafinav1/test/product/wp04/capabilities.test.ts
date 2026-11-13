import { expect, test } from "bun:test"
import path from "node:path"
import { readRequest } from "../../../product/procurement/capabilities.ts"
import type { ProcurementPort } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

const binding = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "a", requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedDomainContext

test("capability refuses forged arguments and refuses an ungranted direct call", async () => {
  const unavailable = async () => ({ status: "unavailable" as const, reason: "not reached" })
  const port: ProcurementPort = { read: unavailable, readSupplier: unavailable, readContract: unavailable, compareSourcing: unavailable }
  const authority = { validateDomainContext: async () => false, revalidateDomainContext: async () => false, receiptFor: () => undefined }
  expect(await readRequest({ requestRef: "r", actor: "forged" }, binding, { port, authority })).toMatchObject({ status: "denied", receipt: { code: "invalid-input" } })
  expect(await readRequest({ requestRef: "r" }, binding, { port, authority })).toMatchObject({ status: "denied", receipt: { code: "invalid-binding" } })
})

test("authorized capability reads through an issued scoped source and consumes once", async () => {
  const { mkdtemp, realpath, rm } = await import("node:fs/promises")
  const { tmpdir } = await import("node:os")
  const { randomUUID } = await import("node:crypto")
  const { openLocalStore } = await import("../../../runtime/local-store.ts")
  const { createSfSourcePersistence } = await import("../../../product/integration/source-lifecycle.ts")
  const { enumerateSfSources } = await import("../../../product/integration/source-inventory.ts")
  const { projectSfProcurementScope } = await import("../../../product/integration/procurement-projections.ts")
  const { createProcurementPort } = await import("../../../product/procurement/port.ts")
  const { createProcurementSourceResolver } = await import("../../../product/procurement/sources.ts")
  const { createSfUiAuthority } = await import("../../../product/integration/ui-authority.ts")
  const { digestSfValue } = await import("../../../product/contracts/canonical.ts")
  const { createProcurementUiBindings } = await import("../../../product/procurement/ui-bindings.ts")
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-capability-scope-"))
  const store = await openLocalStore(directory)
  const persistence = createSfSourcePersistence({ persistence: store, enumerate: enumerateSfSources, projectScope: projectSfProcurementScope, createId: randomUUID })
  try {
    await persistence.initializeSources("procurement")
    await persistence.transaction("procurement", async (snapshot) => {
      snapshot.data.store = { requests: { "PR-1": { request: { number: "PR-1", status: "draft", createdBy: "a", pr: { title: "Owned", estAmount: 100 } }, version: 4, by: "a" } }, settings: { currency: "USD" }, suppliers: [], issued: { pr: ["PR-1"], po: [] } }
      return { commit: true, value: undefined }
    })
    const request = new Request("https://local.invalid/procurement")
    const ui = createSfUiAuthority({ authorize: async () => ({ installationId: "i", projectId: "p", principalRef: "a", policyVersion: "1", accessRevision: "1" }), commandIdentity: async () => "command", createId: randomUUID, now: Date.now })
    const issuePayload = { requestRef: "issuer" }
    const admission = await ui.admit(request, "sf_request_read", digestSfValue(issuePayload))
    if (admission.status !== "ok") throw new Error("UI admission failed")
    expect(await ui.validate(admission.value, "sf_request_read", digestSfValue(issuePayload))).toBe(true)
    const host = {
      requestFor: (context: TrustedDomainContext) => context.kind === "ui" ? ui.requestFor(context) : undefined,
      revalidate: (context: TrustedDomainContext) => context.kind === "ui" ? ui.revalidate(context) : Promise.resolve(false),
      environment: async () => ({ at: "2026-01-01T00:00:00Z", directory: [], id: randomUUID }),
      authenticate: async () => ({ id: "a", canWrite: true, roles: [{ surface: "procurement" as const, role: "requester" }] }), persistence,
    }
    const contextFor = async () => ({ status: "ok" as const, value: { installationId: "i", projectId: "p", principalRef: "a", accessRevision: "1", policyVersion: "1", surface: "procurement" as const, period: { start: "2026-01-01", end: "2026-12-31" }, currency: "USD", sourceRefs: [], capabilities: [] } })
    const resolver = createProcurementSourceResolver({ host, scopedSources: persistence, contextFor })
    const issued = await resolver.issue("procurement-request", "PR-1", admission.value)
    if (issued.status !== "ok") throw new Error(`source issue failed: ${issued.reason}`)
    const preparationSource = await resolver.resolveForPreparation(issued.value, admission.value)
    expect(preparationSource).toMatchObject({ status: "ok", value: { scope: { recordType: "procurement-request", recordId: "PR-1", principalRef: "a" } } })
    const restarted = createProcurementSourceResolver({ host, scopedSources: persistence, contextFor })
    expect(await restarted.resolveForPreparation(issued.value, admission.value)).toEqual(preparationSource)
    if (preparationSource.status !== "ok") throw new Error("preparation scope unavailable")
    const { prepareProcurementMutation, procurementPreparedScope } = await import("../../../product/procurement/prepared.ts")
    const target = preparationSource.value.evidence.target
    const targetRef = { surface: "procurement" as const, type: target.recordType, id: target.recordId, incarnation: target.incarnation, version: target.version, fields: target.fields, period: preparationSource.value.context.period, observedAt: "2026-01-01T00:00:00Z" }
    const recovered = await persistence.transaction("procurement", async (snapshot) => ({ commit: false, value: procurementPreparedScope(snapshot, targetRef, admission.value) }))
    expect(recovered).toEqual(preparationSource.value.scope)
    const collateral = await persistence.transaction("procurement", async (snapshot) => {
      const store = snapshot.data.store as { suppliers: unknown[] }
      store.suppliers = [{ id: 1, legalName: "Unrelated" }]
      return { commit: false, value: prepareProcurementMutation({ snapshot, actor: { id: "a", roles: ["requester"], canWrite: true, assigned: [], domains: [] }, environment: await host.environment(), context: admission.value, target: targetRef, scope: preparationSource.value.scope, evidence: preparationSource.value.evidence, command: { page: "Requests", action: "save", id: "PR-1", version: 0, values: { pr: { estAmount: 125 } } }, operationId: "collateral", idempotencyKey: "collateral" }) }
    })
    expect(collateral).toBeUndefined()
    const unrelatedSettings = await persistence.transaction("procurement", async (snapshot) => {
      const store = snapshot.data.store as { form?: unknown }
      store.form = { currency: "EUR" }
      return { commit: false, value: prepareProcurementMutation({ snapshot, actor: { id: "a", roles: ["requester"], canWrite: true, assigned: [], domains: [] }, environment: await host.environment(), context: admission.value, target: targetRef, scope: preparationSource.value.scope, evidence: preparationSource.value.evidence, command: { page: "Requests", action: "save", id: "PR-1", version: 0, values: { pr: { estAmount: 125 } } }, operationId: "settings", idempotencyKey: "settings" }) }
    })
    expect(unrelatedSettings).toBeUndefined()
    const { createProcurementScenarioPreparation } = await import("../../../product/procurement/scenario-preparation.ts")
    const operation = { kind: "replace" as const, targetRef: issued.value, amount: 125, currency: "USD", period: targetRef.period }
    const coverage = { basisId: "basis", basisVersion: 1, alternativeId: "a", alternativeVersion: 1, currency: "USD", horizon: targetRef.period, issues: [], evaluatedSourceRefs: [], coverageState: "pending" as const, entries: [], derivedMissingCategoryIds: [] }
    const comparison = { baselineResultRef: "base", alternativeResultRef: "result", costCoverageRefs: [], criterionResults: [], unresolvedConditions: [], comparisonStatus: "conditioned" as const, knownDifference: null, completeDifference: null }
    const choice = { id: "choice", alternativeId: "a", alternativeVersion: 1, basisVersion: 1, criteria: [], values: [], evidenceRefs: [preparationSource.value.evidence], principalRef: "a", reason: "Recorded human choice", at: "2026-01-01T00:00:00Z", scenario: { baseRef: "base", operations: [operation], assumptions: [] }, result: { id: "result", version: 1, components: [], currency: "USD", horizon: targetRef.period, sourceRefs: [preparationSource.value.evidence], unresolvedConditions: [], restrictions: [], comparisonStatus: "conditioned" as const, costCoverage: coverage, knownSubtotal: null, total: null }, comparison, comparisonStatus: "conditioned" as const, costCoverage: coverage }
    const prepareScenario = createProcurementScenarioPreparation({ host, sources: resolver })
    const selection = { operation, choice, operationId: "op-1", idempotencyKey: "key-1" }
    const proposed = await prepareScenario(selection, admission.value)
    expect(proposed).toMatchObject({ status: "ok", value: { command: { command: { action: "save", values: { pr: { estAmount: 125 } } } } } })
    expect((await prepareScenario({ ...selection, operation: { ...operation, amount: 126 } }, admission.value)).status).toBe("denied")
    expect((await prepareScenario({ ...selection, choice: { ...choice, result: { ...choice.result, sourceRefs: [] } } }, admission.value)).status).toBe("denied")
    const input = { requestRef: issued.value }
    const port = createProcurementPort({ ...host, resolveRequestSource: resolver.resolve, resolveSupplierSource: resolver.resolve, isCurrentRequestSource: resolver.isCurrent, isCurrentSupplierSource: resolver.isCurrent, resolveRequestCollection: async () => ({ status: "unavailable", reason: "not used" }), isCurrentRequestCollection: () => false, readContractSource: async () => ({ status: "unavailable", reason: "not used" }) })
    const authority = { validateDomainContext: (context: TrustedDomainContext, operation: string, digest: string) => context.kind === "ui" ? ui.validate(context, operation, digest) : Promise.resolve(false), revalidateDomainContext: (context: TrustedDomainContext) => context.kind === "ui" ? ui.revalidate(context) : Promise.resolve(false), receiptFor: (context: TrustedDomainContext, operation: string, digest: string, output?: string) => context.kind === "ui" ? ui.receiptFor(context, operation, digest, output) : undefined }
    const call = await ui.admit(request, "sf_request_read", digestSfValue(input))
    if (call.status !== "ok") throw new Error("UI admission failed")
    expect((await readRequest(input, call.value, { port, authority })).status).toBe("denied")
    expect(await ui.validate(call.value, "sf_request_read", digestSfValue(input))).toBe(true)
    const result = await readRequest(input, call.value, { port, authority })
    expect(result.status === "ok" && result.result).toMatchObject({ values: expect.arrayContaining([expect.objectContaining({ id: "subject", value: "Owned" })]) })
    const bindings = createProcurementUiBindings({ authority: ui, dispatch: async (operation, payload, context) => {
      if (operation !== "sf_request_read" || context.kind !== "ui" || !await ui.validate(context, operation, digestSfValue(payload))) throw new Error("invalid dispatch")
      expect(ui.requestFor(context)).toBe(request)
      return readRequest(payload, context, { port, authority })
    } })
    const fromUi = await bindings.readRequest(request, input)
    expect(fromUi.status === "ok" && fromUi.result).toMatchObject({ values: expect.arrayContaining([expect.objectContaining({ id: "subject", value: "Owned" })]) })
    if (proposed.status !== "ok") throw new Error("scenario preparation failed")
    const { createProcurementPreparedReview } = await import("../../../product/procurement/prepared-review.ts")
    const review = createProcurementPreparedReview({ port, individual: resolver })
    const beforeApply = await review(proposed.value.command, admission.value)
    expect(beforeApply).toMatchObject({ status: "ok", value: { fields: expect.arrayContaining([expect.objectContaining({ field: "originalAmount", before: 100, after: 125, beforeCurrency: "USD", afterCurrency: "USD" })]) } })
    expect(JSON.stringify(beforeApply)).not.toContain("idempotencyKey")
    const altered = { ...proposed.value.command, preview: { ...proposed.value.command.preview, values: proposed.value.command.preview.values.map((value) => value.id === "status" ? { ...value, value: "po_issued" } : value) } }
    expect((await review(altered, admission.value)).status).toBe("unavailable")
    const { createProcurementDecisionPreparation } = await import("../../../product/procurement/decision-preparation.ts")
    const prepare = createProcurementDecisionPreparation(port)
    const first = await prepare(input.requestRef, admission.value)
    const again = await prepare(input.requestRef, admission.value)
    expect(first).toEqual(again)
    expect(first).toMatchObject({ status: "ok", value: { comparison: null, limitations: ["Proposals unavailable"] } })
    expect((await port.read(input, admission.value)).status).toBe("ok")
    const { domain } = await import("../../../runtime/procurement.ts")
    await persistence.transaction("procurement", async (snapshot) => {
      const result = domain.execute(snapshot, { id: "a", roles: ["requester"], canWrite: true, assigned: [], domains: [] }, { page: "Requests", action: "save", id: "PR-1", version: 0, values: { pr: { estAmount: 100 } } }, { at: "2026-01-01T01:00:00Z", directory: [], id: randomUUID })
      return { commit: result.ok, value: result }
    })
    expect((await review(proposed.value.command, admission.value)).status).toBe("stale")
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
