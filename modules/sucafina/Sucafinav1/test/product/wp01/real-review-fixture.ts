import { randomUUID } from "node:crypto"
import { object } from "../../../runtime/contract.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { createRecoveryFixture, initialCaseRef, storeExistingChoice } from "../wp02/workbench-recovery-fixture.ts"

/** Obtain actual producer material before exercising the shared UI's transport states.
 * The source, draft, choice, preparation, authority and C08 stores use the real services.
 * The chosen scenario is a fixture input, as in the Dashboard integration consumers.
 */
export async function createRealReviewFixture() {
  const host = await createRecoveryFixture()
  const post = async (mode: string, body: unknown, key = randomUUID()) => {
    const headers = new Headers(host.request().headers)
    headers.set("idempotency-key", key)
    const response = await fetch(`${host.origin}/sucafina/dashboard?sf=${mode}`, { method: "POST", headers, body: JSON.stringify(body) })
    const result = object(await response.json())
    if (!response.ok || result.status !== "ok") throw new Error(`Real review fixture ${mode}: ${response.status} ${String(result.reason)}`)
    return result.value
  }
  try {
    const discovery = await host.read((context) => host.dashboard.discover({ page: "Hot Topics & Actions" }, context))
    if (discovery.status !== "ok") throw new Error("Real Dashboard discovery unavailable")
    const source = discovery.value.records.find((entry) => entry.draft)?.draft
    if (!source) throw new Error("Real draft source unavailable")
    const saved = object(await post("dashboard-hot-topic-draft", { caseRef: initialCaseRef, ...source, fields: { ...source.fields, action: "Reviewed action" }, sourceRefs: [source.targetEvidence], expectedVersion: 0 }))
    if (typeof saved.draftRef !== "string") throw new Error("Actual draft receipt unavailable")
    const draftRef = saved.draftRef
    const draft = await host.read((context) => host.decisions.drafts.readCurrent({ caseRef: initialCaseRef, draftRef }, context))
    if (draft.status !== "ok") throw new Error("Actual saved draft unavailable")
    await storeExistingChoice(host, draft.value)
    const prepared = object(await post("dashboard-hot-topic-prepare", { caseRef: { ...initialCaseRef, version: 2 }, choiceId: "choice", draftRef: draft.value.draftRef }))
    const selected = object(prepared.caseRef)
    if (typeof selected.id !== "string" || typeof selected.incarnation !== "string" || typeof selected.version !== "number" || typeof prepared.choiceId !== "string" || typeof prepared.changeId !== "string") throw new Error("Real preparation identity unavailable")
    const request = { caseRef: { id: selected.id, incarnation: selected.incarnation, version: selected.version }, choiceId: prepared.choiceId, changeId: prepared.changeId }
    const result = await host.read((context) => host.decisions.review(request, context))
    if (result.status !== "ok" || !/^[a-f0-9]{64}$/.test(result.value.reviewDigest)) throw new Error("Real review proof unavailable")
    const current = await host.read((context) => host.business.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, context))
    if (current.status !== "ok") throw new Error("Real prepared case projection unavailable")
    return { host, post, request, review: result.value, projection: current.value, close: host.close }
  } catch (error) { await host.close(); throw error }
}
