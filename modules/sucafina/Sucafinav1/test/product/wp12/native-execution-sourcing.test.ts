import { expect, test } from "bun:test"
import { expectSpawn } from "../../../../../../packages/core/test/fixture/omni-expect.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { decodeSfOperationOutput, decodeSfSkillInput } from "../../../product/contracts/schema-admission.ts"
import { object } from "../../../runtime/contract.ts"
import { executeWp12NativeMission, observeWp12UnavailableMission, readWp12NativeMissionAfterReload, withWp12NativeMissionHost } from "./native-mission-harness.ts"
import type { Wp12CompletedNativeMission, Wp12NativeMissionContext } from "./native-mission-harness.ts"
import { issueWp12Contract, WP12_CONTRACT_ID } from "./native-procurement-preparation.ts"

const period = { start: "2027-01-01", end: "2027-12-31" }
const suppliers = ["wp12-supplier-a", "wp12-supplier-b", "wp12-supplier-c"]
const requestIds = ["WP12-REQ-1", "WP12-REQ-2"]

test("native Procurement reuses submitted FX and domain ranking without choosing the cheapest quote or changing sourcing", async () => {
  await withWp12NativeMissionHost({ label: "sourcing", operations: ["sf_work_list", "sf_case_draft", "sf_case_read", "sf_context_get", "sf_freshness_check",
    "sf_request_read", "sf_supplier_read", "sf_contract_read", "sf_sourcing_compare", "sf_source_get", "sf_evidence_get"], initialize: initializeSourcing }, async ({ open }) => {
    const completed = await open("initial", async (context) => {
      const selected = context.services.selected.find((entry) => entry.profile.id === "sf_procurement")
      const skill = selected?.skills.find((entry) => entry.id === "sf-comparar-sourcing")
      if (!selected || !skill || !context.services.productHttp || !context.services.analysisInputs) throw new Error("The installed sourcing mission services are incomplete")
      await selectPeriod(context)
      const supplierSources = []
      for (const supplier of suppliers) supplierSources.push(await issueSource(context, "procurement-supplier", supplier))
      const sources = []
      for (const requestId of requestIds) sources.push(await issueSource(context, "procurement-request", requestId))
      // A human selects this actual Dashboard contract as reference context.
      // Its public source is attached through the case port; vendor text never
      // creates a supplier relationship or changes the submitted comparison.
      const contract = await issueWp12Contract(context)
      const evidenceInput = { evidenceRef: contract.evidence }
      const resolved = await context.ui("sf_evidence_get", evidenceInput, (call) => context.services.dispatch("sf_evidence_get", evidenceInput, call))
      if (resolved.status !== "ok") throw new Error(`The real selected contract evidence was refused: ${resolved.reason}`)
      const contractEvidence = decodeSfOperationOutput("sf_evidence_get", resolved.result)
      if (!contractEvidence.ok) throw new Error("The selected contract evidence failed the canonical output schema")
      expect(contractEvidence.value.state).toBe("fresh")
      expect(contractEvidence.value.currentRef).toEqual(contract.evidence)
      const outsideFields = { contractRef: contract.evidence.refId, fields: ["notes"] }
      const refusedFields = await context.ui("sf_contract_read", outsideFields, (call) => context.business.procurement.readContract(outsideFields, call))
      expect(refusedFields.status).toBe("denied")
      const objective = `Compare as propostas do pedido selecionado usando sf_request_read, sf_supplier_read, sf_source_get e sf_sourcing_compare. Fornecedores selecionados: ${JSON.stringify(supplierSources.map((ref) => ref.refId))}. Contrato de referência selecionado pelo humano: ${contract.evidence.refId}; leia seus campos autorizados ${JSON.stringify(contract.evidence.target.fields)} com sf_contract_read e resolva com sf_evidence_get a referência retornada nessa leitura. O contrato é contexto selecionado, não uma proposta nem vínculo inferido com um fornecedor. Preserve valores ausentes. Use proposalRefs e criteria vazios para solicitar a comparação completa do motor. Produza CommercialComparison com as mesmas fontes, critérios, conversões, ranking e limitações retornados pelo motor do pedido. Não aplique uma escolha, modifique o pedido ou use o contrato para substituir ofertas ou o FX submetido.`
      const prepared = []
      for (const source of sources) {
        const draft = { objective, horizon: period, currency: "USD", criteria: ["Preserve the selected request's current sourcing evidence and submitted valuation"],
          sourceRefs: [source, ...supplierSources, contract.evidence] }
        const created = await context.ui("sf_case_draft", draft, (call) => context.business.cases.draft(draft, call))
        if (created.status !== "ok") throw new Error(`Real sourcing case creation failed: ${created.reason}`)
        const caseRef = { id: created.value.id, incarnation: created.value.incarnation, version: created.value.version }
        const incoming = { request: { caseRef, objective, profileId: selected.profile.id, profileVersion: selected.profile.version,
          skillId: skill.id, skillVersion: skill.version, manifestDigest: selected.manifestDigest, outputSchemaVersion: "sf-contribution-v1",
          requestedOperationScope: ["sf_request_read", "sf_supplier_read", "sf_contract_read", "sf_sourcing_compare", "sf_source_get", "sf_evidence_get"] },
          selection: { caseRef, requestRef: source.refId } }
        const response = await context.services.productHttp(context.request({ action: "prepare", input: incoming }, "/sucafina/procurement?sf=workbench-analysis"), "procurement")
        if (!response) throw new Error("The host did not expose sourcing preparation")
        const body = object(await response.json())
        if (response.status !== 200 || body.status !== "ok") throw new Error(`Real sourcing input preparation failed: ${String(body.reason)}`)
        const decoded = decodeSfSkillInput("SourcingComparisonInput", body.value)
        if (!decoded.ok) throw new Error("The real sourcing producer failed its published input schema")
        expect(decoded.value.request).toEqual({ requestRef: source.refId, version: source.target.version, stage: "src_pending" })
        expect(decoded.value.sourceRefs).toEqual([source])
        expect(decoded.value.authorizedOffers.map((offer) => offer.offerRef)).toEqual(["offer-a", "offer-b", "offer-c"])
        expect(decoded.value.submittedFx.find((rate) => rate.from === "EUR")?.rate).toBe(1)
        expect(decoded.value.submittedFx.every((rate) => rate.to === "USD" && digestSfValue(rate.period) === digestSfValue(period))).toBe(true)
        const compared = await context.ui("sf_sourcing_compare", { requestRef: source.refId, proposalRefs: [], criteria: [] },
          (call) => context.business.procurement.compareSourcing({ requestRef: source.refId, proposalRefs: [], criteria: [] }, call))
        if (compared.status !== "ok") throw new Error(`The real sourcing comparison failed: ${compared.reason}`)
        expect(compared.value.proposals).toHaveLength(3)
        expect(compared.value.proposals.find((proposal) => proposal.proposalRef === "offer-a")?.convertedAmount).toBe(100)
        expect(compared.value.proposals.find((proposal) => proposal.proposalRef === "offer-c")?.eligible).toBe(false)
        expect(compared.value.ranking).not.toContain("offer-c")
        prepared.push({ incoming, input: decoded.value, comparison: compared.value })
        console.log("SF_WP12_NATIVE_SOURCING_INPUT:" + JSON.stringify({ scope: "real-sourcing-producer-and-submitted-domain-comparison", githubSha: process.env.GITHUB_SHA ?? null,
          caseRef, inputDigest: digestSfValue(decoded.value), requestRef: source.refId, requestVersion: source.target.version,
          comparisonDigest: digestSfValue(compared.value), ranking: compared.value.ranking, submittedEurRate: 1,
          humanSelectedContractRef: contract.evidence.refId, contractProjectionDigest: digestSfValue(contract.projection),
          contractEvidenceState: contractEvidence.value.state, outsideContractFieldStatus: refusedFields.status,
          contractDoesNotReplaceOffers: true, inferenceExecuted: false }))
      }
      expect(prepared).toHaveLength(2)
      expect(prepared[0]!.incoming.request.objective).toBe(prepared[1]!.incoming.request.objective)
      expect(prepared[0]!.comparison.ranking[0]).toBe("offer-b")
      expect(prepared[1]!.comparison.ranking[0]).toBe("offer-a")
      expect(digestSfValue(prepared[0]!.input)).not.toBe(digestSfValue(prepared[1]!.input))
      const outside = { ...prepared[0]!.incoming, selection: { ...prepared[0]!.incoming.selection, requestRef: sources[1]!.refId } }
      const refused = await context.human("analysis.prepare", outside, (call) => context.services.analysisInputs!.prepare(call, outside))
      expect(refused.status).not.toBe("ok")
      const before = await storeDigest(context)
      if (!context.models.length) {
        for (const item of prepared) observeWp12UnavailableMission(context, { request: item.incoming.request, skillInput: item.input })
        expect(await storeDigest(context)).toBe(before)
        return [] satisfies Wp12CompletedNativeMission[]
      }
      expectSpawn(import.meta.path)
      const witnesses: Wp12CompletedNativeMission[] = []
      for (const item of prepared) {
        await selectPeriod(context)
        const restored = await context.human("analysis.prepare", item.incoming, (call) => context.services.analysisInputs!.prepare(call, item.incoming))
        if (restored.status !== "ok") throw new Error("The authorized sourcing selection could not be restored")
        const witness = await executeWp12NativeMission(context, { request: item.incoming.request, skillInput: restored.value, expectedKind: "CommercialComparison",
          requiredTools: ["sf_request_read", "sf_supplier_read", "sf_contract_read", "sf_sourcing_compare", "sf_source_get", "sf_evidence_get"].map((operation) => ({ operation })) })
        if (witness.output.kind !== "CommercialComparison") throw new Error("The native sourcing mission changed its output kind")
        expect(witness.output.payload).toEqual(item.comparison)
        expect(witness.output.evidenceRefs).toEqual(item.input.sourceRefs)
        witnesses.push(witness)
      }
      expect(await storeDigest(context)).toBe(before)
      return witnesses
    })
    if (!completed.length) return
    await open("reopened", async (context) => {
      await selectPeriod(context)
      for (const witness of completed) {
        const consumed = await readWp12NativeMissionAfterReload(context, witness)
        if (consumed.output.kind !== "CommercialComparison") throw new Error("The reopened sourcing output changed its kind")
        expect(consumed.html).toContain("Commercial comparison")
        expect(consumed.html).toContain("Recorded order:")
        expect(consumed.html).toContain("No selection recorded.")
        expect(consumed.html).toContain("Ineligible")
        expect(consumed.output.payload.proposals.find((proposal) => proposal.proposalRef === "offer-a")?.convertedAmount).toBe(100)
        const retained = await context.persistence.transaction("procurement", async (snapshot) => {
          const store = object(snapshot.data.store), requests = object(store.requests)
          return { commit: false, value: requestIds.map((id) => object(object(requests[id]).request).sourcing) }
        })
        expect(retained.every((value) => object(value).selectedId === null)).toBe(true)
      }
      // Remove an actual source only after every positive consumer was read.
      // This observes source deletion; it does not relabel it as ACL revocation.
      await context.persistence.transaction("procurement", async (snapshot) => {
        const store = object(snapshot.data.store), requests = { ...object(store.requests) }
        delete requests[requestIds[0]!]
        snapshot.data.store = { ...store, requests }
        return { commit: true, value: undefined }
      })
      const removed = await context.human("analysis.read", { runRef: completed[0]!.runRef }, (call) => context.services.analyses!.output(call, completed[0]!.runRef))
      expect(removed.status).not.toBe("ok")
      console.log("SF_WP12_NATIVE_SOURCING_SOURCE_REMOVED:" + JSON.stringify({ scope: "current-source-deletion-after-reopened-consumer", githubSha: process.env.GITHUB_SHA ?? null,
        runRef: completed[0]!.runRef, currentOutputStatus: removed.status, oldComparisonNotExposed: true }))
    })
  })
}, 600_000)

async function selectPeriod(context: Wp12NativeMissionContext) {
  if (!context.services.procurementSelections) throw new Error("The real procurement period selector is missing")
  const intent = { purpose: "work-selection", period }
  const host = await context.ui("sf_work_list", intent, (call) => context.services.procurementSelections!.create(call, period))
  const source = await context.ui("sf_work_list", intent, (call) => context.business.procurementSelections.create(call, period))
  if (host.status !== "ok" || source.status !== "ok") throw new Error("The explicit procurement period was refused")
  expect(host.value.period).toEqual(period)
  expect(source.value.period).toEqual(period)
}

async function issueSource(context: Wp12NativeMissionContext, kind: "procurement-request" | "procurement-supplier", id: string) {
  return context.ui(kind === "procurement-request" ? "sf_request_read" : "sf_supplier_read", { purpose: "sourcing-source-selection", kind, id, period }, async (call) => {
    const issued = await context.business.individual.issue(kind, id, call)
    if (issued.status !== "ok") throw new Error(`Real procurement source issuance failed: ${issued.reason}`)
    const resolved = await context.business.individual.resolve(issued.value, call)
    if (resolved.status !== "ok" || resolved.value.evidence.target.recordType !== kind) throw new Error("The issued procurement source could not be resolved")
    return resolved.value.evidence
  })
}

async function storeDigest(context: Wp12NativeMissionContext) {
  const procurement = await context.persistence.transaction("procurement", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot.data.store) }))
  const contracts = await context.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot.data.contracts) }))
  return digestSfValue({ procurement, contracts })
}

async function initializeSourcing(persistence: Wp12NativeMissionContext["persistence"]) {
  await persistence.transaction("procurement", async (snapshot) => {
    snapshot.data.store = { settings: { currency: "USD", fxRates: [{ code: "EUR", rate: 2 }], minQuotes: 2, techWeight: 80, commWeight: 20,
      criteria: [{ name: "Technical suitability", weight: 1 }], commCriteria: [{ name: "Price", weight: 1, auto: true }], requireActiveSupplier: true },
      suppliers: suppliers.map((id, index) => ({ id, number: `WP12-SUP-${index + 1}`, legalName: `Synthetic supplier ${index + 1}`, status: "active", categories: ["services"], taxId: `SYNTHETIC-${index + 1}` })),
      requests: Object.fromEntries(requestIds.map((id, index) => [id, { version: 1, by: "wp12-fixture-owner", request: {
        number: id, status: "src_pending", createdBy: "wp12-fixture-owner", createdAt: "2027-01-01T00:00:00.000Z",
        pr: { title: "Synthetic sourcing comparison", type: "service", description: "Comparable service quotations", estAmount: 140, costCenter: "SYNTHETIC", needBy: "2027-12-31", justification: "Isolated product evidence", recurring: false },
        sourcing: { evaluator: "wp12-fixture-owner", selectedId: null, approvalBaseCurrency: "USD", fxSnapshot: { USD: 1, EUR: 1 },
          quotes: [
            { id: "offer-a", supplier: "Synthetic supplier 1", supplierId: suppliers[0], currency: "EUR", total: 100, techPass: true, scores: [index === 0 ? 1 : 5], cscores: [] },
            { id: "offer-b", supplier: "Synthetic supplier 2", supplierId: suppliers[1], currency: "USD", total: 140, techPass: true, scores: [index === 0 ? 5 : 4], cscores: [] },
            { id: "offer-c", supplier: "Synthetic supplier 3", supplierId: suppliers[2], currency: "USD", total: 60, techPass: false, scores: [5], cscores: [] },
          ] },
      } }])) }
    return { commit: true, value: undefined }
  })
  await persistence.transaction("dashboard", async (snapshot) => {
    snapshot.data.contracts = [{ id: WP12_CONTRACT_ID, num: "WP12-SOURCING-REFERENCE", vendor: "Synthetic reference counterparty",
      name: "Human selected reference agreement", desc: "Reference context without a supplier identity link",
      start: "2027-01-01", end: "2027-12-31", amount: 240_000, currency: "USD", notice: null, docs: [] }]
    return { commit: true, value: undefined }
  })
}
