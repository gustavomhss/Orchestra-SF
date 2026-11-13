import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { initialProcurementSettings } from "../../../src/initial-settings.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { projectSfProcurementScope } from "../../../product/integration/procurement-projections.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createProcurementConfirmationObserver } from "../../../product/procurement/confirmation.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

test("confirmation reauthorizes material across buyers and fences physical replacement", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-procurement-confirmation-actors-"))
  const store = await openLocalStore(directory)
  try {
    const persistence = createSfSourcePersistence({
      persistence: store,
      enumerate: enumerateSfSources,
      projectScope: projectSfProcurementScope,
      createId: randomUUID,
    })
    await persistence.initializeSources("procurement")
    const settings = initialProcurementSettings()
    settings.fxRates = [{ code: "EUR", rate: 2 }, { code: "GBP", rate: 3 }]
    await persistence.transaction("procurement", async (snapshot) => {
      snapshot.data.store = { requests: { "PR-1": { request: { number: "PR-1", createdBy: "a", status: "draft", value: 20, pr: { title: "Need", description: "Private detail" }, sourcing: { selectedId: "Q-EUR", approvalBaseCurrency: "USD", fxSnapshot: { USD: 1, EUR: 2 }, approval: { amount: 20 }, quotes: [{ id: "Q-EUR", currency: "EUR", total: 10, qty: 2, unitPrice: 5 }] } }, version: 1, by: "a" } }, suppliers: [], settings, issued: { pr: ["PR-1"], po: [] } }
      return { commit: true, value: undefined }
    })

    const principals = new Map<string, "buyer" | "viewer-without-access">([["a", "buyer"], ["b", "buyer"]])
    const ui = createSfUiAuthority({
      authorize: async (request) => {
        const principalRef = request.headers.get("x-principal")
        return principalRef && principals.has(principalRef) ? { installationId: "i", projectId: "p", principalRef, accessRevision: "1", policyVersion: "1" } : undefined
      },
      commandIdentity: async () => randomUUID(),
      createId: randomUUID,
      now: Date.now,
    })
    const host = {
      persistence,
      requestFor: (context: TrustedDomainContext) => context.kind === "ui" ? ui.requestFor(context) : undefined,
      revalidate: (context: TrustedDomainContext) => context.kind === "ui" ? ui.revalidate(context) : Promise.resolve(false),
      environment: async () => ({ at: "2026-01-01T00:00:00Z", directory: [], id: randomUUID }),
      authenticate: async (request: Request) => {
        const principalRef = request.headers.get("x-principal")
        const role = principalRef ? principals.get(principalRef) : undefined
        return principalRef && role ? { id: principalRef, canWrite: true, roles: [{ surface: "procurement" as const, role }] } : undefined
      },
    }
    const period = { start: "2026-01-01", end: "2026-12-31" }
    const contextFor = async (context: TrustedDomainContext) => ({ status: "ok" as const, value: { installationId: context.binding.installationId, projectId: context.binding.projectId, principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, surface: "procurement" as const, period, currency: "USD", sourceRefs: [], capabilities: [] } })
    const observer = createProcurementConfirmationObserver({ host, scopedSources: persistence, contextFor })
    const bindingFor = async (principal: string) => {
      const request = new Request("https://local.invalid/procurement", { headers: { "x-principal": principal } })
      const admission = await ui.admit(request, "sf_request_read", digestSfValue({ requestRef: "source" }))
      if (admission.status !== "ok" || !await ui.validate(admission.value, "sf_request_read", digestSfValue({ requestRef: "source" }))) throw new Error(`${principal} admission failed`)
      return admission.value
    }
    const bindingA = await bindingFor("a")
    const bindingB = await bindingFor("b")
    const sourceA = await observer.issue("PR-1", ["subject"], period, bindingA)
    if (sourceA.status !== "ok") throw new Error("A material source unavailable")
    const scope = { sourceRef: { surface: "procurement" as const, type: "procurement-request", id: "PR-1", incarnation: sourceA.value.evidence.target.incarnation }, fields: ["subject"], period, materialDependencies: [], scopeDefinitionVersion: "procurement-c06-v1" }
    const observationA = await observer.observe(scope, bindingA)
    if (observationA.state !== "available") throw new Error("A observation unavailable")
    expect(observationA.projection.values).toMatchObject([{ id: "subject", value: "Need", period, evidenceState: "confirmed" }])

    const observationB = await observer.observe(scope, bindingB)
    expect(observationB.state).toBe("available")
    if (observationB.state === "available") {
      expect(observationB.sourceFingerprint).toBe(observationA.sourceFingerprint)
      expect(observationB.scopeFingerprint).toBe(observationA.scopeFingerprint)
      expect(observationB.evidence.target.incarnation).not.toBe(observationA.evidence.target.incarnation)
      expect((await observer.resolve(sourceA.value.evidence.refId, bindingB)).status).toBe("unavailable")
    }

    expect(await observer.fence(scope, observationA, bindingA)).toBe(false)
    expect(await persistence.transactionAll!(async () => ({ commit: false, value: await observer.fence(scope, observationA, bindingA) }))).toBe(true)
    await persistence.transaction("procurement", async (snapshot) => {
      const requests = (snapshot.data.store as { requests: Record<string, { request: { pr: { title: string; description: string } } }> }).requests
      requests["PR-1"]!.request.pr.description = "Unrelated change"
      return { commit: true, value: undefined }
    })
    expect(await persistence.transactionAll!(async () => ({ commit: false, value: await observer.fence(scope, observationA, bindingA) }))).toBe(true)
    await persistence.transaction("procurement", async (snapshot) => {
      const requests = (snapshot.data.store as { requests: Record<string, { request: { status: string } }> }).requests
      requests["PR-1"]!.request.status = "pr_pending"
      return { commit: true, value: undefined }
    })
    expect(await persistence.transactionAll!(async () => ({ commit: false, value: await observer.fence(scope, observationA, bindingA) }))).toBe(false)
    const dependencyChanged = await observer.observe(scope, bindingA)
    if (dependencyChanged.state !== "available") throw new Error("dependency observation unavailable")
    expect(dependencyChanged.sourceFingerprint).toBe(observationA.sourceFingerprint)
    expect(dependencyChanged.dependencyFingerprint).not.toBe(observationA.dependencyFingerprint)
    expect(dependencyChanged.scopeFingerprint).not.toBe(observationA.scopeFingerprint)
    await persistence.transaction("procurement", async (snapshot) => {
      const requests = (snapshot.data.store as { requests: Record<string, { request: { pr: { title: string } } }> }).requests
      requests["PR-1"]!.request.pr.title = "Changed need"
      return { commit: true, value: undefined }
    })
    expect(await persistence.transactionAll!(async () => ({ commit: false, value: await observer.fence(scope, dependencyChanged, bindingA) }))).toBe(false)
    const changed = await observer.observe(scope, bindingA)
    expect(changed.state).toBe("available")
    if (changed.state === "available") expect(changed.sourceFingerprint).not.toBe(observationA.sourceFingerprint)

    const moneyFields = ["baseAmount", "originalAmount", "originalCurrency", "fxRate", "fxSource", "monetaryState", "submittedAmount", "submittedCurrency", "submittedFxRate"].sort()
    const moneySource = await observer.issue("PR-1", moneyFields, period, bindingA)
    if (moneySource.status !== "ok") throw new Error("financial material source unavailable")
    const moneyScope = { sourceRef: { surface: "procurement" as const, type: "procurement-request", id: "PR-1", incarnation: moneySource.value.evidence.target.incarnation }, fields: moneyFields, period, materialDependencies: [], scopeDefinitionVersion: "procurement-c06-v1" }
    const moneyInitial = await observer.observe(moneyScope, bindingA)
    if (moneyInitial.state !== "available") throw new Error("financial observation unavailable")
    expect(Object.fromEntries(moneyInitial.projection.values.map((item) => [item.id, item.value]))).toMatchObject({ baseAmount: 20, originalAmount: 10, originalCurrency: "EUR", fxRate: 2, fxSource: "submitted", monetaryState: "pending-approval", submittedAmount: 20, submittedCurrency: "USD", submittedFxRate: 2 })

    await persistence.transaction("procurement", async (snapshot) => {
      const fxRates = (snapshot.data.store as { settings: { fxRates: { code: string; rate: number }[] } }).settings.fxRates
      fxRates.find((rate) => rate.code === "GBP")!.rate = 9
      return { commit: true, value: undefined }
    })
    const unrelatedFx = await observer.observe(moneyScope, bindingA)
    expect(unrelatedFx.state).toBe("available")
    if (unrelatedFx.state !== "available") throw new Error("unrelated FX observation unavailable")
    expect(unrelatedFx.scopeFingerprint).toBe(moneyInitial.scopeFingerprint)

    await persistence.transaction("procurement", async (snapshot) => {
      const requests = (snapshot.data.store as { requests: Record<string, { request: { sourcing: { fxSnapshot: Record<string, number> } } }> }).requests
      requests["PR-1"]!.request.sourcing.fxSnapshot.EUR = 3
      return { commit: true, value: undefined }
    })
    const relevantFx = await observer.observe(moneyScope, bindingA)
    if (relevantFx.state !== "available") throw new Error("relevant FX observation unavailable")
    expect(relevantFx.scopeFingerprint).not.toBe(moneyInitial.scopeFingerprint)
    expect(relevantFx.projection.values.find((item) => item.id === "submittedFxRate")).toMatchObject({ value: 3, evidenceState: "confirmed" })

    await persistence.transaction("procurement", async (snapshot) => {
      const requests = (snapshot.data.store as { requests: Record<string, { request: { sourcing: { quotes: { id: string; qty: number; unitPrice: number }[] } } }> }).requests
      requests["PR-1"]!.request.sourcing.quotes[0]!.qty = 4
      return { commit: true, value: undefined }
    })
    const changedQuantity = await observer.observe(moneyScope, bindingA)
    expect(changedQuantity.state).toBe("available")
    if (changedQuantity.state === "available") expect(changedQuantity.scopeFingerprint).not.toBe(relevantFx.scopeFingerprint)

    await persistence.transaction("procurement", async (snapshot) => {
      const requests = (snapshot.data.store as { requests: Record<string, { request: { sourcing: { fxSnapshot: Record<string, number> } } }> }).requests
      delete requests["PR-1"]!.request.sourcing.fxSnapshot.EUR
      return { commit: true, value: undefined }
    })
    const missingFx = await observer.observe(moneyScope, bindingA)
    expect(missingFx.state).toBe("available")
    if (missingFx.state === "available") {
      expect(missingFx.projection.values.find((item) => item.id === "fxRate")).toMatchObject({ value: null, evidenceState: "absent" })
      expect(missingFx.projection.values.find((item) => item.id === "fxSource")).toMatchObject({ value: null, evidenceState: "absent" })
      expect(missingFx.projection.values.find((item) => item.id === "submittedFxRate")).toMatchObject({ value: null, evidenceState: "absent" })
      expect(missingFx.projection.missing).toContainEqual({ field: "fxRate", reason: "missing-fx" })
    }

    principals.set("b", "viewer-without-access")
    expect((await observer.observe(scope, bindingB)).state).toBe("access-unavailable")
    principals.delete("b")
    expect((await observer.observe(scope, bindingB)).state).toBe("access-unavailable")

    await persistence.transaction("procurement", async (snapshot) => {
      const requests = (snapshot.data.store as { requests: Record<string, unknown> }).requests
      delete requests["PR-1"]
      return { commit: true, value: undefined }
    })
    await persistence.transaction("procurement", async (snapshot) => {
      const requests = (snapshot.data.store as { requests: Record<string, unknown> }).requests
      requests["PR-1"] = { request: { number: "PR-1", createdBy: "a", status: "draft", pr: { title: "Recreated need" } }, version: 1, by: "a" }
      return { commit: true, value: undefined }
    })
    const replacement = await observer.observe(scope, bindingA)
    expect(replacement.state).toBe("access-unavailable")
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
