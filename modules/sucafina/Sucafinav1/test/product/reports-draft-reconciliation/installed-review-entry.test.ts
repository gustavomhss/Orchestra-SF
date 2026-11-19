import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { object } from "../../../runtime/contract.ts"
import { createSfExtendedAssets } from "../../../../../../apps/cli/src/sucafina-product/extended-assets.ts"
import { sfReviewNavigationUrl } from "../../../../../../apps/cli/src/sucafina-product/extended-review-navigation.ts"
import { createSfExtendedBusinessServices } from "../../../../../../apps/cli/src/sucafina-product/extended-business-services.ts"
import { financialCompositionFixture } from "../wp10/integration/financial-composition-fixture.ts"

/** The existing installed-composition fixture owns its real identity, grants,
 * SQLite store and producers. Faults only interrupt this fixture's real reads;
 * no authority, projection, HTTP status or browser asset is synthesized.
 */
async function installedReportsFixture() {
  const fixture = await financialCompositionFixture()
  const assets = createSfExtendedAssets()
  const fault = { remaining: 0, hits: 0 }
  const hooks: { admitted?: () => void; asset?: () => void } = {}
  const currentSnapshots = fixture.persistence.currentSnapshots
  if (!currentSnapshots) throw new Error("The installed fixture requires real scoped snapshots")
  fixture.persistence.currentSnapshots = () => {
    const current = currentSnapshots.call(fixture.persistence)
    if (fault.remaining > 0) {
      fault.remaining -= 1
      fault.hits += 1
      throw new Error("REPORTS48_INSTALLED_AUTHORITY_READ_INTERRUPTED")
    }
    return current
  }
  const admit = fixture.authority.ui.admit
  fixture.authority.ui.admit = async (...args: Parameters<typeof admit>) => {
    const result = await admit(...args)
    if (result.status === "ok" && args[1] === "sf_review_prepare") hooks.admitted?.()
    return result
  }
  const extended = createSfExtendedBusinessServices({ authority: fixture.authority, business: fixture.business,
    persistence: fixture.persistence, ...fixture.guards, origin: "https://example.test", assets: {
      bi: assets.bi,
      reviews: async () => {
        const script = await assets.reviews()
        hooks.asset?.()
        return script
      },
    } })
  const send = async (query: URLSearchParams, headers?: HeadersInit) => {
    const response = await extended.productHttp(new Request(`https://example.test/dashboard?${query}`, { headers }), "dashboard")
    if (!response) throw new Error("The real installed review entry was not handled")
    return response
  }
  const focus = new URLSearchParams({ sf: "review", page: "Budget Overview", start: "2026-01-01", end: "2026-12-31" })
  return { fixture, extended, fault, hooks, send, focus,
    dispose: async () => {
      fixture.authority.ui.admit = admit
      fixture.persistence.currentSnapshots = currentSnapshots
      extended.dispose(); assets.dispose(); await fixture.dispose()
    },
  }
}

async function expectFailure(response: Response, status: number, result: string) {
  expect(response.status).toBe(status)
  expect(response.headers.get("Content-Type")).toContain("application/json")
  const text = await response.text()
  expect(JSON.parse(text)).toMatchObject({ status: result })
  expect(JSON.parse(text)).not.toHaveProperty("value")
  expect(text).not.toContain("data-sf-review-bootstrap")
  expect(text).not.toContain("data-sf-review-workspace")
}

test("the installed Reports form route mounts its actual review bootstrap and keeps query validation", async () => {
  const f = await installedReportsFixture()
  try {
    // runtime/application.fileControls submits its source page, not the label
    // on the Generate Report button. Reuse the actual production GET contract.
    const query = new URLSearchParams({ page: "Budget Overview", download: "docx", year: "2026", title: "Reports48 actual entry", topic: "Budget Overview" })
    for (const page of ["Budget Overview", "Generate Report"]) {
      query.set("page", page)
      const response = await f.send(query)
      expect(response.status).toBe(200)
      expect(response.headers.get("Content-Type")).toContain("text/html")
      expect(response.headers.has("Content-Disposition")).toBe(false)
      const html = await response.text()
      expect(html).toContain("data-sf-review-workspace")
      expect(html).toContain("data-sf-review-bootstrap")
      expect(html).toContain('"requestedTitle":"Reports48 actual entry"')
      expect(html).toContain('"requestedFormat":"docx"')
      expect(html).toContain('"id":"report:Budget Overview"')
      expect(response.headers.get("X-SF-Access-Revision")).toMatch(/^[a-f0-9]{64}$/)
    }
    query.set("page", "Budget Overview")
    query.append("topic", "Budget Overview")
    const malformed = await f.send(query)
    expect(malformed.status).toBe(400)
    expect(await malformed.json()).toEqual({ status: "needs-input", reason: "invalid-report-selection" })
    const otherExport = new URLSearchParams({ page: "Budget Overview", download: "xlsx", year: "2026" })
    expect(await f.extended.productHttp(new Request(`https://example.test/dashboard?${otherExport}`), "dashboard")).toBeUndefined()
  } finally { await f.dispose() }
}, 60_000)

test("an actual preserved review keeps update and successor focus recoverable when its second read is interrupted", async () => {
  const f = await installedReportsFixture()
  try {
    const entry = await f.send(new URLSearchParams({ page: "Budget Overview", download: "docx", year: "2026", topic: "Budget Overview" }))
    expect(entry.status).toBe(200)
    const html = await entry.text()
    const encoded = /<script type="application\/json" data-sf-review-bootstrap>([\s\S]*?)<\/script>/.exec(html)?.[1]
    if (!encoded) throw new Error("The real installed agenda bootstrap was not rendered")
    const bootstrap = object(JSON.parse(encoded))
    expect(Array.isArray(bootstrap.items)).toBe(true)
    const post = async (mode: string, payload: unknown) => {
      const response = await f.extended.productHttp(new Request(`https://example.test/dashboard?sf=${mode}`, {
        method: "POST", headers: { origin: "https://example.test", "content-type": "application/json" }, body: JSON.stringify(payload),
      }), "dashboard")
      if (!response) throw new Error("The actual installed review command was not mounted")
      expect(response.status).toBe(200)
      const result = object(await response.json())
      expect(result.status).toBe("ok")
      return object(result.value)
    }
    const agenda = await post("review-agenda", { items: bootstrap.items })
    if (typeof agenda.selectionRef !== "string" || !Array.isArray(agenda.sections)) throw new Error("The actual selection was not created")
    const sectionRefs = agenda.sections.map((section) => {
      const id = object(section).id
      if (typeof id !== "string") throw new Error("The actual selected section has no identity")
      return id
    })
    const saved = await post("review-preserve", { selectionRef: agenda.selectionRef, sectionRefs })
    if (typeof saved.id !== "string") throw new Error("The actual review and receipt were not preserved")
    // Navigation leaves the Reports form selection behind and retains only the
    // destination's preserved identity. Each URL still passes the real router.
    const reportsLocation = new URL("https://example.test/dashboard?page=Budget+Overview&download=docx&year=2026&topic=Budget+Overview&topic=Portfolio+Dashboard#old-selection")
    for (const destination of [
      { reviewRef: saved.id },
      { reviewRef: saved.id, sectionId: sectionRefs[0]! },
      { previousReviewRef: saved.id },
    ]) {
      const next = sfReviewNavigationUrl(reportsLocation.href, destination)
      expect(next.origin).toBe(reportsLocation.origin)
      expect(next.pathname).toBe(reportsLocation.pathname)
      expect(next.hash).toBe("")
      expect(Object.fromEntries(next.searchParams)).toEqual({ sf: "review", ...destination })
      expect([...next.searchParams.keys()]).toHaveLength(1 + Object.keys(destination).length)
      expect((await f.send(next.searchParams)).status).toBe(200)
    }
    const reviews = f.extended.reviews
    if (!reviews) throw new Error("The installed canonical review producer is missing")
    const read = reviews.reviews.read
    const routes = [new URLSearchParams({ sf: "review-update", reviewRef: saved.id }),
      new URLSearchParams({ sf: "review", previousReviewRef: saved.id })]
    for (const route of routes) {
      expect((await f.send(route)).status).toBe(200)
      let reads = 0
      reviews.reviews.read = async (...args: Parameters<typeof read>) => {
        reads += 1
        // The second canonical C05 read hits actual authority I/O, then its
        // production wrapper normalizes the interruption into unavailable.
        if (reads === 2) f.fault.remaining = 1
        return read(...args)
      }
      try {
        await expectFailure(await f.send(route), 503, "unavailable")
        expect(reads).toBe(2)
      } finally { reviews.reviews.read = read }
      expect((await f.send(route)).status).toBe(200)
    }
    let reads = 0
    reviews.reviews.read = async (...args: Parameters<typeof read>) => {
      reads += 1
      if (reads === 2) f.fixture.active.value = false
      return read(...args)
    }
    try { await expectFailure(await f.send(routes[0]!), 403, "denied") }
    finally { reviews.reviews.read = read; f.fixture.active.value = true }
    expect((await f.send(routes[0]!)).status).toBe(200)
  } finally { await f.dispose() }
}, 60_000)

test("the Reports focus route preserves real command identity unavailability and still denies a revoked actor", async () => {
  const f = await installedReportsFixture()
  try {
    expect((await f.send(f.focus)).status).toBe(200)
    // financialCompositionFixture resolves command identity from this header.
    // Empty identity is an actual ui.admit unavailable result, not a fake lease.
    const unavailable = await f.send(f.focus, { "x-operation": "" })
    expect(unavailable.status).toBe(503)
    expect(await unavailable.json()).toEqual({ status: "unavailable", reason: "ui-identity-unavailable" })
    expect(f.fixture.active.value).toBe(true)
    expect((await f.send(f.focus)).status).toBe(200)
    f.fixture.active.value = false
    await expectFailure(await f.send(f.focus), 403, "denied")
    f.fixture.active.value = true
    expect((await f.send(f.focus)).status).toBe(200)
  } finally { await f.dispose() }
}, 60_000)

test("installed Reports authorization I/O remains recoverable before consumption and before page delivery", async () => {
  const f = await installedReportsFixture()
  try {
    expect((await f.send(f.focus)).status).toBe(200)
    f.fault.remaining = 1
    await expectFailure(await f.send(f.focus), 503, "unavailable")
    expect(f.fault.hits).toBe(1)
    expect((await f.send(f.focus)).status).toBe(200)

    // Throw once inside the actual validate reauthorization. The catch's
    // revalidation then succeeds, but requestFor is empty until consumption.
    f.hooks.admitted = () => { f.hooks.admitted = undefined; f.fault.remaining = 1 }
    await expectFailure(await f.send(f.focus), 503, "unavailable")
    expect(f.fault.hits).toBe(2)
    expect((await f.send(f.focus)).status).toBe(200)

    f.hooks.asset = () => { f.hooks.asset = undefined; f.fault.remaining = 1 }
    await expectFailure(await f.send(f.focus), 503, "unavailable")
    expect(f.fault.hits).toBe(3)
    expect((await f.send(f.focus)).status).toBe(200)

    // The same final boundary remains a negative when the real actor is gone.
    f.hooks.asset = () => { f.hooks.asset = undefined; f.fixture.active.value = false }
    await expectFailure(await f.send(f.focus), 403, "denied")
    f.fixture.active.value = true
    expect((await f.send(f.focus)).status).toBe(200)

    // This registered sf-read operation uses the fixture's existing sf_work_list
    // and namespaces. No sf_answer_read or human-write grant is introduced.
    const operation = "sf-read:collaboration.storage.version"
    const digest = digestSfValue({})
    const request = f.fixture.request()
    const admitted = await f.fixture.authority.ui.admit(request, operation, digest)
    expect(admitted.status).toBe("ok")
    if (admitted.status !== "ok") throw new Error("The existing registered read grant was not admitted")
    try {
      expect(await f.fixture.authority.ui.validate(admitted.value, operation, digest)).toBe(true)
      f.fault.remaining = 1
      await expect(f.fixture.authority.ui.revalidate(admitted.value)).rejects.toThrow("REPORTS48_INSTALLED_AUTHORITY_READ_INTERRUPTED")
      expect(await f.fixture.authority.ui.revalidate(admitted.value)).toBe(true)
      f.fixture.active.value = false
      expect(await f.fixture.authority.ui.revalidate(admitted.value)).toBe(false)
    } finally { f.fixture.authority.ui.finish(admitted.value) }
    f.fixture.active.value = true

    // host-context's installed admitRead uses this sf-human alias. The existing
    // fixture does not grant that human action: unknown resolver state must not
    // become a fabricated grant or a fabricated revocation. Once the resolver
    // recovers, the actual missing grant must still deny this alias.
    const humanRead = "sf-human:collaboration.storage.version"
    f.fault.remaining = 1
    await expect(f.fixture.authority.ui.admit(f.fixture.request(), humanRead, digest))
      .rejects.toThrow("REPORTS48_INSTALLED_AUTHORITY_READ_INTERRUPTED")
    expect(await f.fixture.authority.ui.admit(f.fixture.request(), humanRead, digest))
      .toEqual({ status: "denied", reason: "ui-authority-unavailable" })
  } finally { await f.dispose() }
}, 60_000)
