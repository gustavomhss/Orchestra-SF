import { expect, test } from "bun:test"
import { initialProcurementSettings } from "../../../src/initial-settings.ts"
import { object } from "../../../runtime/contract.ts"
import type { ProductContext } from "../../../product/contracts/context.ts"
import type { PortResult } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createProcurementCollectionRegistry, createProcurementSourceResolver } from "../../../product/procurement/sources.ts"
import { createProcurementContractSource } from "../../../product/procurement/contracts.ts"
import { createProcurementPort } from "../../../product/procurement/port.ts"
import { createProcurementSourcingEvidence } from "../../../product/procurement/sourcing-evidence.ts"
import { createSfRequestDocumentEvidence } from "../../../product/documents/request-evidence.ts"
import { createSourcingDossierPreparation } from "../../../product/routines/dossier-host.ts"
import { createWp06Runtime } from "../wp06/runtime-fixture.ts"

test("dossier keeps the real WP04 ranking, submitted FX, technical exclusion, missing scores and rejected Request stage", async () => {
  const fixture = await createWp06Runtime()
  try {
    const initialized = await fixture.authority.state.transaction(fixture.request(), { namespace: "documents", expectedStorageVersion: 0, idempotencyKey: "empty-document-fixture", commandDigest: digestSfValue({ purpose: "empty-document-fixture" }), targetRef: fixture.authority.creationTarget.ref, targetIncarnation: fixture.authority.creationTarget.incarnation }, async () => ({ commit: true, value: true }))
    if (initialized.status !== "ok") throw new Error("Document namespace provisioning failed")
    const contextFor = async (context: TrustedDomainContext): Promise<PortResult<ProductContext>> => ({ status: "ok", value: { installationId: context.binding.installationId, projectId: context.binding.projectId, principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, surface: "procurement", period: { start: "2026-01-01", end: "2026-12-31" }, currency: "USD", sourceRefs: [], capabilities: [] } })
    const registry = createProcurementCollectionRegistry({ host: fixture.authority.host, scopedSources: fixture.store, contextFor })
    const individual = createProcurementSourceResolver({ host: fixture.authority.host, scopedSources: fixture.store, contextFor })
    const contracts = createProcurementContractSource({ host: fixture.authority.host, scopedSources: fixture.store })
    const host = { ...fixture.authority.host, ...registry, resolveSupplierSource: individual.resolve, isCurrentSupplierSource: individual.isCurrent, readContractSource: contracts.readContractSource }
    const procurement = createProcurementPort(host)
    const documents = createSfRequestDocumentEvidence({ host: fixture.authority.host, state: fixture.authority.state, services: fixture.runtime.assets.services, resolveRequest: (ref, context) => registry.resolveRequestSource(ref, context), list: fixture.documents.documents.list })
    const prepare = createSourcingDossierPreparation({ procurement, sourcingEvidence: createProcurementSourcingEvidence(host), selectedDocuments: documents, reader: fixture.documents.documents.reader, revalidateAuthority: fixture.authority.host.revalidate })
    const originalQuotes = [
      { id: "A", supplier: "A", total: 32400, currency: "USD", qty: 1, unitPrice: 32400, techPass: true, scores: [5, 4, 4, 4, 4] as (number | null)[], cscores: [null, 4, 4] },
      { id: "B", supplier: "B", total: 28000, currency: "EUR", qty: 1, unitPrice: 28000, techPass: true, scores: [4, 4, 4, 3, 4] as (number | null)[], cscores: [null, 5, 4] },
      { id: "C", supplier: "C", total: 20000, currency: "USD", qty: 1, unitPrice: 20000, techPass: false, scores: [5, 5, 5, 5, 5] as (number | null)[], cscores: [null, 5, 5] },
    ]
    const settings = initialProcurementSettings()
    settings.fxRates = [{ code: "EUR", rate: 2 }]
    for (const scenario of ["three", "one", "missing-score", "missing-fx", "rejected", "absent"] as const) {
      const quotes = structuredClone(scenario === "absent" ? [] : scenario === "one" ? originalQuotes.slice(0, 1) : originalQuotes)
      if (scenario === "missing-score") quotes[1]!.scores[4] = null
      await fixture.store.transaction("procurement", async (snapshot) => {
        snapshot.data.store = { settings, requests: { r1: { request: { number: "r1", status: scenario === "rejected" ? "src_rejected" : "src_pending", createdBy: fixture.principal.id, pr: { title: "Sourcing comparison", estAmount: 32400 }, history: [], sourcing: { quotes, selectedId: "B", selectionJustification: "Recorded human choice", approvalBaseCurrency: "USD", fxSnapshot: scenario === "missing-fx" ? { USD: 1 } : { USD: 1, EUR: 1.08 } } } } } }
        return { commit: true, value: undefined }
      })
      await fixture.uiCall("sf_evidence_get", { scenario }, async (context) => {
        const selection = await registry.createSelection(context)
        if (selection.status !== "ok") throw new Error(selection.reason)
        const collection = await registry.resolveRequestCollection(selection.value, context)
        if (collection.status !== "ok") throw new Error(collection.reason)
        const ref = collection.value.requests.find((request) => request.target.recordId === "r1")?.refId
        if (!ref) throw new Error("Request selection unavailable")
        const expected = await procurement.compareSourcing({ requestRef: ref, proposalRefs: [], criteria: [] }, context)
        const before = await fixture.store.transaction("procurement", async (snapshot) => ({ commit: false, value: structuredClone(snapshot.data.store) }))
        const result = await prepare(ref, context)
        if (result.status !== "ok") throw new Error(`${scenario} dossier unavailable: ${result.reason}`)
        expect(result.value.comparison).toEqual(expected.status === "ok" ? expected.value : null)
        expect(result.value.complete).toBe(false)
        expect(result.value.synthesisIncluded).toBe(false)
        expect(result.value.draft.domainApplied).toBe(false)
        expect(result.value.draft.gaps).toContain("document-evidence-unavailable")
        expect(result.value.commercialSources.supplierRegister).toEqual({ status: "not-selected" })
        expect(result.value.explanation.sourceDistinction).toBe("Condições negociadas vêm das propostas deste pedido. O cadastro do fornecedor não foi selecionado como evidência dessas condições.")
        expect(result.value.explanation.proposals.map((proposal) => proposal.proposalRef)).toEqual(result.value.comparison?.proposals.map((proposal) => proposal.proposalRef) ?? [])
        for (const explained of result.value.explanation.proposals) {
          const original = result.value.comparison?.proposals.find((proposal) => proposal.proposalRef === explained.proposalRef)
          if (!original) throw new Error("Explained proposal has no authenticated domain source")
          expect(explained.evidenceRefs).toEqual(original.evidenceRefs)
        }
        expect(result.value.commercialSources.proposalTerms).toMatchObject({ status: "available", sourceRef: { refId: ref }, offers: quotes.map((quote) => expect.objectContaining({ offerRef: quote.id, amount: quote.total, currency: quote.currency })) })
        if (scenario === "three") {
          expect(result.value.comparison?.proposals).toHaveLength(3)
          expect(result.value.comparison?.ranking).not.toContain("C")
          expect(result.value.comparison?.proposals.find((proposal) => proposal.proposalRef === "C")).toMatchObject({ eligible: false, score: null })
          expect(result.value.comparison?.proposals.find((proposal) => proposal.proposalRef === "B")?.convertedAmount).toBeCloseTo(30240, 6)
          expect(result.value.sourcing?.submittedFx).toContainEqual({ from: "EUR", rate: 1.08 })
          expect(result.value.explanation.selection).toMatchObject({ state: "recorded", proposalRef: "B", message: expect.stringContaining("custo comparável USD 30.240") })
          expect(result.value.explanation.selection.message).toContain("Justificativa registrada: Recorded human choice")
          expect(result.value.explanation.proposals.find((proposal) => proposal.proposalRef === "C")?.text).toContain("não elegível segundo o domínio")
          expect(result.value.request.values).toContainEqual(expect.objectContaining({ id: "reason", value: "Recorded human choice" }))
        }
        if (scenario === "one") {
          expect(result.value.draft.gaps).toContain("comparison-needs-multiple-proposals")
          expect(result.value.explanation.selection.state).toBe("unavailable")
        }
        if (scenario === "missing-score") expect(result.value.comparison?.ranking).toEqual([])
        if (scenario === "missing-fx") {
          expect(result.value.comparison?.ranking).toEqual([])
          expect(result.value.comparison?.proposals.find((proposal) => proposal.proposalRef === "B")?.convertedAmount).toBeNull()
          expect(result.value.explanation.proposals.find((proposal) => proposal.proposalRef === "B")?.text).toContain("custo comparável indisponível")
        }
        if (scenario === "rejected") expect(result.value.sourcing?.stage).toBe("src_rejected")
        if (scenario === "absent") {
          expect(result.value.comparison).toBeNull()
          expect(result.value.explanation.selection.state).toBe("unavailable")
          expect(result.value.explanation.proposals).toEqual([])
        }
        expect(await fixture.store.transaction("procurement", async (snapshot) => ({ commit: false, value: snapshot.data.store }))).toEqual(before)
        // The original selection becomes unusable after a material Request edit.
        await fixture.store.transaction("procurement", async (snapshot) => {
          object(object(object(object(snapshot.data.store).requests).r1).request).status = "sourcing"
          return { commit: true, value: undefined }
        })
        expect((await prepare(ref, context)).status).not.toBe("ok")
      })
    }
  } finally { await fixture.dispose() }
}, 120_000)
