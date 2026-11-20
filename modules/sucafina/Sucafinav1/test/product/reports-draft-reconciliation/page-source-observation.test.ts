import { expect, test } from "bun:test"
import { object, rows } from "../../../runtime/contract.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../product/contracts/business-context.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import { createSfExtendedBusinessServices } from "../../../../../../apps/cli/src/sucafina-product/extended-business-services.ts"
import { createSfReviewHistory } from "../../../../../../apps/cli/src/sucafina-product/review-history.ts"
import { reportsCorpus } from "../../../../../../packages/app-shell/e2e/sucafina/reports-support/corpus.ts"
import { financialCompositionFixture } from "../wp10/integration/financial-composition-fixture.ts"

type PageRef = Extract<BusinessEvidenceRef, { kind: "record" }>

function projection(value: unknown): DomainProjection {
  if (!value || typeof value !== "object" || !Array.isArray(object(value).values) || !object(value).context)
    throw new Error("The real review did not preserve a domain projection")
  return value as DomainProjection
}

function pageReference(value: DomainProjection, page: string): PageRef {
  const refs = value.values.flatMap((entry) => entry.sourceRefs)
    .filter((ref): ref is PageRef => ref.kind === "record" && ref.target.surface === "dashboard" &&
      ref.target.recordType === "dashboard-page" && ref.target.recordId === page)
  const unique = new Map(refs.map((ref) => [ref.refDigest, ref]))
  if (unique.size !== 1) throw new Error("The preserved page does not have one real evidence identity")
  return structuredClone([...unique.values()][0]!)
}

function withoutClock(value: BusinessEvidenceResolution) {
  const { checkedAt: _checkedAt, ...rest } = value
  return rest
}

test("installed Reports resolves fresh Pages and the real post-capture Budget history through current producers", async () => {
  const fixture = await financialCompositionFixture()
  const corpus = reportsCorpus(fixture.at.slice(0, 10))
  await fixture.persistence.transaction("dashboard", async (snapshot) => {
    Object.assign(snapshot.data, structuredClone(corpus.data))
    return { commit: true, value: undefined }
  })
  const extended = createSfExtendedBusinessServices({ authority: fixture.authority, business: fixture.business,
    persistence: fixture.persistence, ...fixture.guards, origin: "https://example.test" })
  const originalRead = fixture.business.dashboard.read
  const sourceRead = fixture.persistence.readScopedSource
  const reads = { active: false, count: 0 }
  fixture.persistence.readScopedSource = async (...args) => {
    if (reads.active) reads.count++
    return sourceRead(...args)
  }
  const measure = async (stage: string, work: () => Promise<BusinessEvidenceResolution>) => {
    reads.count = 0; reads.active = true
    const started = performance.now()
    try {
      const result = await work()
      const measured = { result, reads: reads.count, milliseconds: performance.now() - started }
      console.info("SF_REPORTS_PAGE_OBSERVATION " + JSON.stringify({ stage, reads: measured.reads,
        milliseconds: Math.round(measured.milliseconds), state: result.state }))
      return measured
    } finally { reads.active = false }
  }
  try {
    const send = async (query: URLSearchParams, payload?: unknown) => {
      const response = await extended.productHttp(new Request("https://example.test/dashboard?" + query, payload === undefined
        ? undefined : { method: "POST", headers: { origin: "https://example.test", "content-type": "application/json" },
          body: JSON.stringify(payload) }), "dashboard")
      if (!response) throw new Error("The installed Reports route was not handled")
      expect(response.status).toBe(200)
      return response
    }
    const entry = await send(new URLSearchParams([
      ["page", "Budget Overview"], ["download", "docx"], ["year", String(corpus.year)],
      ["topic", "Budget Overview"], ["topic", "Portfolio Dashboard"], ["topic", "Hot Topics & Actions"],
    ]))
    const encoded = /<script type="application\/json" data-sf-review-bootstrap>([\s\S]*?)<\/script>/.exec(await entry.text())?.[1]
    if (!encoded) throw new Error("Actual installed Reports bootstrap unavailable")
    const items = object(JSON.parse(encoded)).items
    expect(Array.isArray(items)).toBe(true)
    const previewResponse = await send(new URLSearchParams({ sf: "review-agenda" }), { items })
    const preview = object(object(await previewResponse.json()).value)
    if (typeof preview.selectionRef !== "string" || !Array.isArray(preview.sectionRefs)) throw new Error("Actual Reports selection unavailable")
    const savedResponse = await send(new URLSearchParams({ sf: "review-preserve" }), {
      selectionRef: preview.selectionRef, sectionRefs: preview.sectionRefs,
    })
    const saved = object(object(await savedResponse.json()).value)
    if (typeof saved.id !== "string" || !Array.isArray(saved.sections)) throw new Error("Actual review and C08 receipt unavailable")
    const sections = saved.sections.map(object)
    const projects = sections.find((section) => section.title === "Projects")
    const budget = sections.find((section) => section.title === "Budget")
    if (!projects || !budget) throw new Error("The installed review did not capture its selected pages")
    const projectProjection = projection(projects.content), budgetProjection = projection(budget.content)
    expect(projectProjection.values.filter((value) => value.id.startsWith("projects[") && value.id.endsWith(".name"))).toHaveLength(25)
    expect(projectProjection.values).toHaveLength(325)
    expect(budgetProjection.values.find((value) => value.id === "budget:" + corpus.year + "-01:forecast")?.value).toBe(110)
    const projectRef = pageReference(projectProjection, "Portfolio Dashboard")
    const budgetRef = pageReference(budgetProjection, "Budget Overview")
    const history = createSfReviewHistory({ authority: fixture.authority, persistence: fixture.persistence,
      evidence: fixture.business.context, authorizeCase: fixture.business.authorizeCase })
    const call = await fixture.read()
    const fresh = await measure("fresh-composed", () => history.evidence.resolve(projectRef, call))
    expect(fresh.result.state).toBe("fresh")
    expect(fresh.reads).toBe(4)
    expect(fresh.result.authorizedProjection).toEqual(projectProjection)
    fixture.business.dashboard.read = (...args) => originalRead(...args)
    const legacyFresh = await measure("fresh-legacy", () => history.evidence.resolve(projectRef, call))
    expect(legacyFresh.reads).toBe(7)
    expect(withoutClock(legacyFresh.result)).toEqual(withoutClock(fresh.result))
    fixture.business.dashboard.read = originalRead

    await fixture.persistence.transaction("dashboard", async (snapshot) => {
      const january = rows(snapshot.data.opexEntries).find((entry) => entry.id === "reports-opex-01")
      if (!january) throw new Error("Actual January source missing")
      january.forecast = 190
      return { commit: true, value: undefined }
    })
    const historicalCall = await fixture.read()
    const historical = await measure("historical-composed", () => history.evidence.resolve(budgetRef, historicalCall))
    expect(historical.result.state).toBe("historical")
    expect(historical.result.ref).toEqual(budgetRef)
    expect(historical.result.authorizedProjection).toEqual(budgetProjection)
    const current = historical.result.currentRef
    if (!current || current.kind !== "record") throw new Error("History did not resolve a real current page reference")
    expect(current.target.incarnation).toBe(budgetRef.target.incarnation)
    expect(current.target.version).toBeGreaterThan(budgetRef.target.version)
    expect(current.target.projectionDigest).not.toBe(budgetRef.target.projectionDigest)
    const live = await fixture.business.context.resolve(current, historicalCall)
    expect(live.state).toBe("fresh")
    expect(projection(live.authorizedProjection).values.find((value) => value.id === "budget:" + corpus.year + "-01:forecast")?.value).toBe(190)

    fixture.business.dashboard.read = (...args) => originalRead(...args)
    const legacyHistorical = await measure("historical-legacy", () => history.evidence.resolve(budgetRef, historicalCall))
    expect(withoutClock(legacyHistorical.result)).toEqual(withoutClock(historical.result))
    expect(historical.reads).toBeGreaterThan(fresh.reads)
    expect(legacyHistorical.reads).toBe(historical.reads + 3)
    fixture.business.dashboard.read = originalRead

    fixture.active.value = false
    const revoked = await history.evidence.resolve(budgetRef, historicalCall)
    expect(["fresh", "historical"]).not.toContain(revoked.state)
    expect(revoked).not.toHaveProperty("authorizedProjection")
  } finally {
    fixture.business.dashboard.read = originalRead
    fixture.persistence.readScopedSource = sourceRead
    extended.dispose()
    await fixture.dispose()
  }
}, 120_000)
