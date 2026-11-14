import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { DomainProjection, SourceRef } from "../../../../product/contracts/context.ts"
import type { TrustedDomainContext } from "../../../../product/contracts/sf-execution.ts"
import type { SfProductState } from "../../../../product/contracts/state.ts"
import { createReviewServices } from "../../../../product/reviews/services.ts"
import { createReviewHumanPort } from "../../../../product/reviews/human.ts"
import { createReviewComparisonPort } from "../../../../product/reviews/comparison-port.ts"
import { renderPreservedReview } from "../../../../product/reviews/render.ts"
import { createSfReviewHistory } from "../../../../../../../apps/cli/src/sucafina-product/review-history.ts"
import { financialCompositionFixture } from "./financial-composition-fixture.ts"

test("C08 preserved domain values survive an ordinary edit, while revocation, replacement and receipt tampering deny history and downloads", async () => {
  const fixture = await financialCompositionFixture()
  const { authority, business, persistence } = fixture
  const call = await fixture.read()
  try {
    const historical = createSfReviewHistory({ authority, persistence, evidence: business.context })
    const selected = { projection: undefined as DomainProjection | undefined }
    const selection = { page: "OPEX Detail", recordType: "opexOwners", recordId: "owner", fields: ["budget"], period: { start: "2026-01-01", end: "2026-12-31" } }
    const project = async () => {
      const issued = await business.dashboardRecords.issue(selection, call)
      if (issued.status !== "ok") throw new Error(`Record issue failed: ${issued.reason}`)
      const result = await business.dashboardRecords.read(issued.value.refId, call)
      if (result.status !== "ok") throw new Error(`Record read failed: ${result.reason}`)
      return result.value
    }
    const sources = async (context: TrustedDomainContext, refs: readonly SourceRef[]) => {
      const checked = await Promise.all(refs.map(async (ref) => await historical.currentSource(ref, context) || await historical.historicalSource(ref, context)))
      return checked.every(Boolean) && await authority.host.revalidate(context)
    }
    const services = createReviewServices({ state: authority.state, host: authority.host, authority: authority.authority, evidence: historical.evidence,
      creationTarget: authority.creationTarget, operationIdentity: business.operationIdentity, requiredAuthority: ["reviews:read"], maxBytes: 2 * 1024 * 1024, now: () => fixture.at,
      selection: { select: async () => selected.projection ? { status: "ok", value: [{ id: "budget", title: "Captured budget", period: selection.period, recordCount: 1, projection: selected.projection }] }
        : { status: "unavailable", reason: "source-not-selected" },
        authorizeSections: (context, sections) => sources(context, sections.flatMap((section) => section.sourceRefs)), revalidate: sources,
        authorizeComments: async (context, values) => values.length === 0 && await authority.host.revalidate(context),
        authorizeDecision: async (context, values) => values.length === 0 && await authority.host.revalidate(context),
        authorizeSensitivity: async (context, values) => values.length === 0 && await authority.host.revalidate(context),
        authorizeOutcome: async (context, values) => values.length === 0 && await authority.host.revalidate(context),
        authorizeOutcomeComparison: async (context, values) => values.length === 0 && await authority.host.revalidate(context),
      } })
    const human = createReviewHumanPort({ state: authority.state, reviews: services.reviews, human: authority.human, ui: authority.ui, creationTarget: authority.creationTarget })
    selected.projection = await project()
    const first = await human.preserve(fixture.request("preserve-v1"), { selectionRef: "selected-v1", sectionRefs: ["budget"] })
    expect(first.status).toBe("ok")
    if (first.status !== "ok") throw new Error(first.reason)
    const original = structuredClone(first.value)
    const rendered = await renderPreservedReview(original, { title: "Budget at v1", format: "docx", sectionRefs: ["budget"] })
    if (!rendered.ok) throw new Error("Report render failed")
    const artifact = await services.artifacts.put({ reviewRef: original.id, sectionRefs: ["budget"], artifact: rendered, format: "docx",
      evidenceRefs: selected.projection.values.flatMap((value) => value.sourceRefs), recordCount: 1 }, call)
    expect(artifact.status).toBe("ok")
    if (artifact.status !== "ok") throw new Error(artifact.reason)
    await persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.opexOwners = [{ id: "owner", name: "Operations", budget: 1800 }]
      return { commit: true, value: undefined }
    })
    selected.projection = await project()
    expect(selected.projection.version).toBeGreaterThan((original.sections[0]!.content as DomainProjection).version)
    expect(await services.reviews.read(original.id, call)).toEqual({ status: "ok", value: original })
    expect((await services.artifacts.download(artifact.value.artifactRef, call)).status).toBe(200)
    const second = await human.preserve(fixture.request("preserve-v2"), { selectionRef: "selected-v2", sectionRefs: ["budget"], previousReviewRef: original.id })
    expect(second.status).toBe("ok")
    if (second.status !== "ok") throw new Error(second.reason)
    const compared = await createReviewComparisonPort({ reviews: services.reviews, host: authority.host }).read(second.value.id, call)
    expect(compared.status).toBe("ok")
    if (compared.status !== "ok") throw new Error(compared.reason)
    expect(compared.value.comparison.state).toBe("compared")
    expect(compared.value.comparison.changes.some((change) => change.kind === "changed" && change.delta === 600)).toBe(true)
    expect(digestSfValue(second.value.sections[0]!.content)).not.toBe(digestSfValue(original.sections[0]!.content))
    fixture.active.value = false
    expect((await services.reviews.read(original.id, call)).status).toBe("denied")
    expect((await services.artifacts.download(artifact.value.artifactRef, call)).status).toBe(403)
    fixture.active.value = true
    await fixture.store.transaction("dashboard", async (snapshot) => {
      const state = snapshot.data.__sfProductV1 as SfProductState
      state.reviews[original.id] = { ...state.reviews[original.id]!, createdAt: "2026-11-13T00:00:00Z" }
      return { commit: true, value: undefined }
    })
    expect((await services.reviews.read(original.id, call)).status).toBe("denied")
    await fixture.store.transaction("dashboard", async (snapshot) => {
      const state = snapshot.data.__sfProductV1 as SfProductState
      state.reviews[original.id] = original
      return { commit: true, value: undefined }
    })
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.opexOwners = []; return { commit: true, value: undefined } })
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.opexOwners = [{ id: "owner", name: "Replacement", budget: 1800 }]; return { commit: true, value: undefined } })
    expect((await services.reviews.read(original.id, call)).status).toBe("denied")
    expect((await services.artifacts.download(artifact.value.artifactRef, call)).status).toBe(403)
  } finally { authority.ui.finish(call); await fixture.dispose() }
})
