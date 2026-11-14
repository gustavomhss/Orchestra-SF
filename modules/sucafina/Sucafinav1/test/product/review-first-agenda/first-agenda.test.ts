import { expect, test } from "bun:test"
import { fileURLToPath } from "node:url"
import type { Browser } from "@playwright/test"
import type { DomainProjection, PreservedReview } from "../../../product/contracts/context.ts"
import type { PortResult } from "../../../product/contracts/ports.ts"
import type { ReviewAgendaCatalog } from "../../../product/reviews/agenda-picker.ts"
import type { ReviewAgendaPreview } from "../../../product/reviews/selection.ts"
import { captureChromiumCleanup } from "../wp07/chromium-cleanup.ts"
import { expectUnchangedDomainState } from "../wp08/domain-state.ts"
import { available } from "../wp08/relations-fixture.ts"
import { createFirstAgendaFixture, responseValue } from "./fixture.ts"

function deferred<T>() {
  let complete!: (value: T) => void
  const promise = new Promise<T>((resolve) => { complete = resolve })
  return { promise, complete }
}

test("first agenda uses three real domains, preserves edits through drift and reload, and fences a late response after revocation", async () => {
  const playwright = await import("@playwright/test")
  const built = await Bun.build({ entrypoints: [fileURLToPath(new URL("./browser-entry.ts", import.meta.url))], target: "browser", format: "esm", sourcemap: "none" })
  expect(built.success).toBe(true)
  const bundle = built.outputs.find((output) => output.kind === "entry-point")
  if (!bundle) throw new Error("First agenda browser bundle unavailable")
  const script = await bundle.text()
  const f = await createFirstAgendaFixture()
  const runtime: { browser?: Browser; close?: () => Promise<void> } = {}
  const transport = { preserve: [] as PortResult<PreservedReview>[], previews: [] as ReviewAgendaPreview[],
    preserveCommands: [] as { key: string; body: string; reviewRef?: string }[], loseNextPreserveBody: false,
    delayed: undefined as { captured: ReturnType<typeof deferred<void>>; release: ReturnType<typeof deferred<void>> } | undefined }
  try {
    expect(await f.storedReviews()).toEqual([])
    const before = await f.snapshots()
    runtime.browser = await playwright.chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"], timeout: 15000 })
    runtime.close = await captureChromiumCleanup(runtime.browser)
    const page = await runtime.browser.newPage()
    const failures: string[] = []
    page.on("pageerror", (error) => failures.push(error.message))
    // No listener or surrogate UI: transport delivers the real HTTP handlers to
    // the real production browser clients from a minimal, isolated host mount.
    await page.route("https://example.test/**", async (route) => {
      const incoming = route.request(), url = new URL(incoming.url())
      if (url.pathname === "/browser-entry.js") return route.fulfill({ status: 200, contentType: "application/javascript", body: script })
      if (!url.searchParams.has("sf")) return route.fulfill({ status: 200, contentType: "text/html", body: '<!doctype html><html><body><main></main><script type="module" src="/browser-entry.js"></script></body></html>' })
      const response = await f.handle(new Request(incoming.url(), { method: incoming.method(), headers: incoming.headers(),
        ...(incoming.postData() === null ? {} : { body: incoming.postData()! }) }))
      const body = await response.text(), mode = url.searchParams.get("sf")
      let loseBody = false
      if (mode === "review-preserve") {
        const result = JSON.parse(body) as PortResult<PreservedReview>
        transport.preserve.push(result)
        transport.preserveCommands.push({ key: incoming.headers()["idempotency-key"] ?? "", body: incoming.postData() ?? "",
          ...(result.status === "ok" ? { reviewRef: result.value.id } : {}) })
        // Drop only the response body after the real human/HTTP handler has
        // committed and reopened its exact durable C08 receipt and C05 body.
        loseBody = result.status === "ok" && transport.loseNextPreserveBody
        if (loseBody) transport.loseNextPreserveBody = false
      }
      if (mode === "review-agenda" && incoming.method() === "POST") {
        const result = JSON.parse(body) as PortResult<ReviewAgendaPreview>
        if (result.status === "ok") transport.previews.push(result.value)
      }
      if (mode === "review-agenda" && incoming.method() === "GET" && transport.delayed) {
        const pending = transport.delayed
        expect(response.status).toBe(200)
        pending.captured.complete()
        await pending.release.promise
        transport.delayed = undefined
      }
      return route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: loseBody ? "{" : body })
    })
    await page.goto("https://example.test/product", { waitUntil: "domcontentloaded" })
    const view = page.locator('section[aria-label="Prepare review"]')
    const chosen = view.getByRole("list", { name: "Selected agenda", exact: true })
    const headings = view.getByRole("heading", { level: 3 })
    const discover = async (labels: readonly string[]) => {
      const pending = page.waitForResponse((response) => response.request().method() === "GET" && new URL(response.url()).searchParams.get("sf") === "review-agenda")
      await view.getByRole("button", { name: "Discover agenda topics", exact: true }).click()
      const response = await pending
      const result = await response.json() as PortResult<ReviewAgendaCatalog>
      expect({ http: response.status(), result }).toMatchObject({ http: 200, result: { status: "ok" } })
      const options = available(result).options
      for (const label of labels) expect(options.map((option) => option.label)).toContain(label)
    }
    await playwright.expect(view.getByRole("button", { name: "Load selection", exact: true })).toBeDisabled()
    const initialTopics = ["Budget Overview", "Portfolio Dashboard", "Hot Topics & Actions", "Forecast · Agenda candidate", "Request · Independent purchase", "OPEX Detail"]
    await discover(initialTopics)
    await playwright.expect(view.getByRole("button", { name: "Add Forecast · Agenda candidate", exact: true })).toBeVisible()
    await playwright.expect(chosen.getByRole("listitem")).toHaveCount(0)
    expect(await f.storedReviews()).toEqual([])
    for (const label of initialTopics) {
      await view.getByRole("button", { name: `Add ${label}`, exact: true }).click()
    }
    await view.getByRole("button", { name: "Remove selected OPEX Detail", exact: true }).click()
    await view.getByRole("button", { name: "Move selected Forecast · Agenda candidate up", exact: true }).click()
    await playwright.expect(chosen.locator(":scope > li > p:first-child")).toHaveText([
      /^Budget · dashboard · 2026-01-01 – 2026-12-31$/, /^Projects · dashboard · 2026-01-01 – 2026-12-31$/,
      /^Forecast · Agenda candidate · forecast-comparison · 2026-01-01 – 2026-12-31$/, /^Hot Topics · dashboard · 2026-01-01 – 2026-12-31$/,
      /^Request · Independent purchase · procurement-request · 2026-01-01 – 2026-12-31$/,
    ])
    await view.getByRole("button", { name: "Load selection", exact: true }).click()
    await playwright.expect(headings).toHaveText(["Budget", "Projects", "Forecast · Agenda candidate · candidate", "Hot Topics", "Request · Independent purchase"])
    const projects = view.locator("li").filter({ has: page.getByRole("heading", { name: "Projects", exact: true }) })
    await playwright.expect(projects).toContainText("2 selected records")
    const projectSection = transport.previews.at(-1)!.sections.find((section) => section.title === "Projects")!
    const projectRefs = transport.previews.at(-1)!.sectionRecordRefs.find((entry) => entry.sectionRef === projectSection.id)!.recordRefs
    const identifiedProjects = await f.readCall((call) => Promise.all(projectRefs.map(async (reference) => ({ reference,
      target: available(await f.business.dashboardRecords.resolve(reference, call)).target }))))
    expect(identifiedProjects.map((entry) => [entry.target.recordType, entry.target.recordId]).sort()).toEqual([["projects", "project"], ["projects", "project-second"]])
    const removedProject = identifiedProjects.find((entry) => entry.target.recordId === "project")!
    const retainedProject = identifiedProjects.find((entry) => entry.target.recordId === "project-second")!
    await projects.getByRole("button", { name: `Remove record ${removedProject.reference}`, exact: true }).click()
    await playwright.expect(projects).toContainText("1 selected records")
    expect(transport.previews.at(-1)!.sectionRecordRefs.find((entry) => entry.sectionRef === projectSection.id)?.recordRefs).toEqual([retainedProject.reference])
    await playwright.expect(projects.getByRole("row").filter({ hasText: "projects[id:project-second].budget" })).toContainText("330")
    await playwright.expect(projects.getByRole("row").filter({ hasText: "projects[id:project].budget" })).toHaveCount(0)
    for (let index = 0; index < 3; index++) await view.getByRole("button", { name: "Move Hot Topics up", exact: true }).click()
    const ordered = ["Hot Topics", "Budget", "Projects", "Forecast · Agenda candidate · candidate", "Request · Independent purchase", "IT Operations"]
    await playwright.expect(headings).toHaveText(ordered.slice(0, 5))

    // Adding a distinct competence after preview invalidates the save while
    // retaining exact record choices and the order already chosen by the human.
    await view.getByLabel("Period end", { exact: true }).fill("2026-01-31")
    await view.getByLabel("Domain", { exact: true }).selectOption("dashboard")
    await discover(["IT Operations"])
    await view.getByRole("button", { name: "Add IT Operations", exact: true }).click()
    await playwright.expect(view.getByRole("table")).toHaveCount(0)
    await playwright.expect(view.getByRole("button", { name: "Preserve this review", exact: true })).toHaveCount(0)
    await view.getByRole("button", { name: "Load selection", exact: true }).click()
    await playwright.expect(headings).toHaveText(ordered)
    const empty = view.locator("li").filter({ has: page.getByRole("heading", { name: "IT Operations", exact: true }) })
    await playwright.expect(empty).toContainText("2026-01-01 – 2026-01-31 · 0 selected records")
    await playwright.expect(empty).toContainText("No selected records in this section.")
    const mixed = transport.previews.at(-1)!
    expect(mixed.sections.map((section) => section.title)).toEqual(ordered)
    expect(mixed.sections.map((section) => section.period)).toEqual([...Array(5).fill(f.period), { start: "2026-01-01", end: "2026-01-31" }])
    expect(mixed.sections.find((section) => section.title === "Projects")?.recordCount).toBe(1)
    expect(new Set(mixed.sections.flatMap((section) => section.projection.context.sourceRefs.map((ref) => ref.surface)))).toEqual(new Set(["dashboard", "planner", "procurement"]))
    for (const section of mixed.sections) {
      const row = view.locator("li").filter({ has: page.getByRole("heading", { name: section.title, exact: true }) })
      const table = row.getByRole("table", { name: `${section.title} · selected source values`, exact: true })
      await playwright.expect(table.getByRole("cell")).toHaveText(section.projection.values.flatMap((value) => [
        value.id, `${value.value === null ? "Unavailable" : String(value.value)} ${value.currency ?? value.unit ?? ""}`.trim(),
        `${value.period.start} – ${value.period.end}`,
      ]))
      await playwright.expect(row.getByText(`${section.period.start} – ${section.period.end} · ${section.recordCount} selected records`, { exact: true })).toBeVisible()
      await playwright.expect(row.getByText(`Section reference: ${section.id}`, { exact: true })).toBeVisible()
      for (const source of section.projection.context.sourceRefs) await playwright.expect(row.getByText(
        `Source: ${source.surface} · ${source.type} · ${source.id} · version ${source.version} · incarnation ${source.incarnation}`, { exact: true })).toBeVisible()
      const records = mixed.sectionRecordRefs.find((entry) => entry.sectionRef === section.id)!.recordRefs
      await playwright.expect(row.getByRole("button", { name: /^Remove record / })).toHaveText(records.map((reference) => `Remove record ${reference}`))
      await row.getByText("Components, evidence and limitations", { exact: true }).click()
      await playwright.expect(row.locator("details")).toHaveAttribute("open", "")
      await playwright.expect(row.locator("details > p")).toHaveText([
        ...section.projection.components.map((component) => `${component.id}: ${component.amount === null ? "Unavailable" : component.amount} ${component.currency} · ${component.period.start} – ${component.period.end} · ${component.evidenceState}`),
        ...section.projection.values.map((value) => `${value.id} · ${value.evidenceState} · Sources: ${value.sourceRefs.map((reference) => reference.refId).join(", ") || "No source reference"}`),
        ...section.projection.missing.map((entry) => `${entry.field}: ${entry.reason}`),
      ])
    }
    const afterSelection = await f.snapshots()
    expect(afterSelection.dashboard.audit.slice(0, before.dashboard.audit.length)).toEqual(before.dashboard.audit)
    // Discovery catalogs both Budget and People pages, whose read-only producers emit two exact audit forms:
    // C9 runtime/dashboard-budget.ts:67–79, blob b64f2f49b42aea2f2d74d6c1da18a3bce4873365, records aggregate access with became:null.
    // C9 runtime/dashboard-people.ts:161–180, blob de499e6d34af826add34bee4125bcfba4e57ddb8, records an individual member-read marker.
    // C9 product/dashboard/port.ts:161–176, blob b5acfaf9b03c4e03a60c375248cf2ecbd1f32811, normalizes its timestamp and commits the audit.
    const reads = afterSelection.dashboard.audit.slice(before.dashboard.audit.length)
    const aggregateRead = { who: "person", at: "2026-11-13T00:00:00.000Z", record: "members:private-member", was: null, became: null }
    const memberRead = { who: "person", at: "2026-11-13T00:00:00.000Z", record: "members:private-member", was: null,
      became: { read: true, member: "private-member" } }
    expect(reads.length).toBeGreaterThan(0)
    expect(reads).toContainEqual(aggregateRead)
    expect(reads).toContainEqual(memberRead)
    for (const entry of reads) expect(entry).toEqual(entry.became === null ? aggregateRead : memberRead)
    expectUnchangedDomainState(before, { ...afterSelection, dashboard: { ...afterSelection.dashboard, audit: before.dashboard.audit } })

    await f.changeCandidate()
    await view.getByRole("button", { name: "Preserve this review", exact: true }).click()
    await playwright.expect(view.getByRole("status")).toContainText("forecast-source-unavailable")
    expect(transport.preserve.at(-1)?.status).toBe("stale")
    expect(await f.storedReviews()).toEqual([])
    await playwright.expect(view.getByRole("table")).toHaveCount(0)
    await playwright.expect(chosen.getByRole("listitem")).toHaveCount(6)
    await playwright.expect(view.getByRole("button", { name: "Preserve this review", exact: true })).toHaveCount(0)
    await view.getByLabel("Period end", { exact: true }).fill("2026-12-31")
    await view.getByLabel("Domain", { exact: true }).selectOption("planner")
    await discover(["Forecast · Agenda candidate"])
    await view.getByRole("button", { name: "Refresh Forecast · Agenda candidate", exact: true }).click()
    expect(await f.storedReviews()).toEqual([])
    await view.getByRole("button", { name: "Load selection", exact: true }).click()
    await playwright.expect(headings).toHaveText(ordered)
    const forecast = view.getByRole("table", { name: "Forecast · Agenda candidate · candidate · selected source values", exact: true })
    await playwright.expect(forecast.getByRole("row").filter({ has: page.getByRole("cell", { name: "license:1:forecast", exact: true }) }).getByRole("cell", { name: "120 USD", exact: true })).toBeVisible()
    await playwright.expect(projects).toContainText("1 selected records")
    const attemptsBeforePreserve = transport.preserveCommands.length
    transport.loseNextPreserveBody = true
    const diagnosticsBeforePreserve = f.preserveDiagnostics.length
    const pendingPreserve = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).searchParams.get("sf") === "review-preserve")
    await view.getByRole("button", { name: "Preserve this review", exact: true }).click()
    const preserveResponse = await pendingPreserve
    const preserved = transport.preserve.at(-1)
    if (preserved?.status !== "ok") {
      const storedReviewIds = await f.storedReviews()
      console.error("First agenda preserve authorization", JSON.stringify({ result: preserved,
        storedReviewCount: storedReviewIds.length, storedReviewIds, gates: f.preserveDiagnostics.slice(diagnosticsBeforePreserve) }))
    }
    expect({ http: preserveResponse.status(), result: preserved }).toMatchObject({ http: 200, result: { status: "ok" } })
    await playwright.expect(view.getByRole("status")).toContainText("review-preserve-unavailable")
    const committedBeforeRetry = available(transport.preserve.at(-1)!)
    expect(await f.storedReviews()).toEqual([committedBeforeRetry.id])
    await playwright.expect(view.getByRole("table")).toHaveCount(0)
    await playwright.expect(view).not.toContainText("120 USD")
    await playwright.expect(chosen.getByRole("listitem")).toHaveCount(6)
    await playwright.expect(view.getByRole("button", { name: "Preserve this review", exact: true })).toHaveCount(0)
    await view.getByRole("button", { name: "Retry preserving this review", exact: true }).click()
    await playwright.expect(view.getByRole("heading", { name: "Preserved review", exact: true })).toBeVisible()
    const saved = available(transport.preserve.at(-1)!)
    expect(transport.preserveCommands).toHaveLength(attemptsBeforePreserve + 2)
    const originalCommand = transport.preserveCommands.at(-2)!, retryCommand = transport.preserveCommands.at(-1)!
    expect(originalCommand.key).not.toBe("")
    expect(retryCommand).toEqual(originalCommand)
    expect(saved).toEqual(committedBeforeRetry)
    expect(retryCommand.reviewRef).toBe(saved.id)
    expect(saved.previousReviewRef).toBeUndefined()
    expect(saved.sections.map((section) => section.title)).toEqual(ordered)
    expect(saved.sections.map((section) => section.count)).toEqual([1, 2, 1, 1, 1, 0])
    expect(saved.sections.map((section) => section.period)).toEqual(mixed.sections.map((section) => section.period))
    const finalPreview = transport.previews.at(-1)!
    expect(saved.sections.map((section) => ({ id: section.id, period: section.period,
      contextPeriod: (section.content as DomainProjection).context.period, sourceRefs: section.sourceRefs,
      contextSourceRefs: (section.content as DomainProjection).context.sourceRefs }))).toEqual(finalPreview.sections.map((section) => ({
      id: section.id, period: section.period, contextPeriod: section.projection.context.period,
      sourceRefs: section.projection.context.sourceRefs, contextSourceRefs: section.projection.context.sourceRefs,
    })))
    expect(await f.storedReviews()).toEqual([saved.id])
    const captured = saved.sections.find((section) => section.title === "Forecast · Agenda candidate · candidate")!.content as DomainProjection
    expect(captured.values.find((value) => value.id === "license:1:forecast")?.value).toBe(120)
    expect(captured.components.reduce((total, component) => total + (component.amount ?? 0), 0)).toBe(1440)
    await f.changeCandidate(130)
    await f.reopen()
    const reloaded = await responseValue<PreservedReview>(await f.request("review-read", undefined, { reviewRef: saved.id }))
    expect(reloaded).toEqual(saved)
    const readMeeting = async (step: string, action: () => Promise<unknown>) => {
      const diagnosticsBeforeRead = f.preserveDiagnostics.length
      const pendingRead = page.waitForResponse((response) => {
        const url = new URL(response.url())
        return response.request().method() === "GET" && url.searchParams.get("sf") === "review-read" && url.searchParams.get("reviewRef") === saved.id
      })
      await action()
      const response = await pendingRead
      const result = await response.json() as PortResult<PreservedReview>
      if (response.status() !== 200 || result.status !== "ok") console.error("First agenda meeting read", JSON.stringify({ step,
        http: response.status(), status: result.status, reason: "reason" in result ? result.reason : undefined,
        gates: f.preserveDiagnostics.slice(diagnosticsBeforeRead), pageErrors: failures }))
      expect({ http: response.status(), result }).toMatchObject({ http: 200, result: { status: "ok" } })
      expect(available(result)).toEqual(saved)
    }
    await readMeeting("open", () => view.getByRole("button", { name: "Open meeting", exact: true }).click())
    const meeting = page.locator('section[aria-label="Preserved review meeting"]')
    await playwright.expect(meeting.getByRole("heading", { name: "Hot Topics", exact: true })).toBeVisible()
    await readMeeting("reload", () => page.reload({ waitUntil: "domcontentloaded" }))
    await playwright.expect(meeting.getByRole("heading", { name: "Hot Topics", exact: true })).toBeVisible()
    for (let index = 0; index < 3; index++) {
      await readMeeting(`topic-${index + 1}`, () => meeting.getByRole("button", { name: "Next topic", exact: true }).click())
      await playwright.expect(meeting.getByRole("heading", { name: ordered[index + 1]!, exact: true })).toBeVisible()
    }
    await playwright.expect(meeting.getByRole("heading", { name: "Forecast · Agenda candidate · candidate", exact: true })).toBeVisible()
    await playwright.expect(meeting.getByRole("listitem").filter({ hasText: /^license:1:forecast: 120 USD · / })).toBeVisible()
    await playwright.expect(meeting.getByRole("listitem").filter({ hasText: /^license:1:forecast: 130 USD · / })).toHaveCount(0)

    // A real authorized response is held in transport, then delivered after
    // revocation. No manufactured projection or timing sleep supplies the race.
    await page.goto("https://example.test/product", { waitUntil: "domcontentloaded" })
    await view.getByLabel("Domain", { exact: true }).selectOption("dashboard")
    await discover(["Talent Review"])
    await view.getByRole("button", { name: "Add Talent Review", exact: true }).click()
    await view.getByRole("button", { name: "Load selection", exact: true }).click()
    await playwright.expect(view).toContainText("PRIVATE_AGENDA_TALENT_NAME")
    await view.getByLabel("Domain", { exact: true }).selectOption("planner")
    const pending = { captured: deferred<void>(), release: deferred<void>() }
    transport.delayed = pending
    await view.getByRole("button", { name: "Discover agenda topics", exact: true }).click()
    await pending.captured.promise
    f.gate.active = false
    await page.evaluate(() => window.dispatchEvent(new Event("sf-access-revoked")))
    await playwright.expect(view).toContainText("Private content and the selection were cleared")
    await playwright.expect(view).not.toContainText("PRIVATE_AGENDA_TALENT")
    pending.release.complete()
    await page.evaluate(async () => { await (window as Window & { firstAgendaDiscovery?: Promise<void> }).firstAgendaDiscovery })
    await playwright.expect(view.getByRole("table")).toHaveCount(0)
    await playwright.expect(view.getByRole("button")).toHaveCount(0)
    await playwright.expect(view.getByRole("list")).toHaveCount(0)
    await playwright.expect(view).not.toContainText("Agenda candidate")
    await playwright.expect(view).not.toContainText("PRIVATE_AGENDA_TALENT")
    const denied = await f.request("review-read", undefined, { reviewRef: saved.id })
    expect(denied.status).toBe(403)
    expect(await denied.text()).not.toContain("Independent purchase")
    expect(await f.storedReviews()).toEqual([saved.id])
    expect(failures).toEqual([])
  } finally {
    transport.delayed?.release.complete()
    if (runtime.close) await runtime.close()
    else await runtime.browser?.close()
    await f.dispose()
  }
}, 240000)

test("discovery is per source, denies forged and private selectors, and keeps independent Procurement periods", async () => {
  const f = await createFirstAgendaFixture()
  try {
    const http = await f.request("review-agenda", undefined, { start: f.period.start, end: f.period.end, domain: "planner" })
    const httpCatalog = await http.json() as PortResult<ReviewAgendaCatalog>
    expect({ http: http.status, result: httpCatalog }).toMatchObject({ http: 200, result: { status: "ok" } })
    expect(available(httpCatalog).options.map((option) => [option.domain, option.label]).sort()).toEqual([
      ["planner", "Forecast · Agenda baseline"], ["planner", "Forecast · Agenda candidate"],
    ])
    const annual = available(await f.discover({ period: f.period }))
    const talent = annual.options.find((option) => option.item.kind === "dashboard" && option.item.topic === "talent-review")
    const request = annual.options.find((option) => option.item.kind === "procurement-request")
    expect(talent).toBeDefined()
    expect(request).toBeDefined()
    if (!talent || talent.item.kind !== "dashboard") throw new Error("Authorized Talent selector missing")
    const privateItem = talent.item
    const month = { start: "2026-01-01", end: "2026-01-31" }
    const monthly = available(await f.discover({ period: month, domain: "procurement" }))
    const monthlyRequest = monthly.options.find((option) => option.item.kind === "procurement-request")
    expect(monthlyRequest).toBeDefined()
    const mixed = available(await f.readCall((call) => f.app.agenda.create([request!.item, monthlyRequest!.item], call)))
    expect(mixed.sections.map((section) => section.period)).toEqual([f.period, month])
    expect(mixed.sections.map((section) => section.projection.context.period)).toEqual([f.period, month])
    expect(mixed.sections.every((section) => section.projection.context.sourceRefs.length === 1 && section.projection.context.sourceRefs[0]?.surface === "procurement")).toBe(true)
    expect(mixed.sections[0]?.projection.context.sourceRefs[0]?.incarnation).not.toBe(mixed.sections[1]?.projection.context.sourceRefs[0]?.incarnation)

    f.control.memberships = ["viewers"]
    const restricted = available(await f.discover({ period: f.period, domain: "dashboard" }))
    expect(restricted.options.some((option) => option.item.kind === "dashboard" && option.item.topic === "projects")).toBe(true)
    expect(restricted.options.some((option) => option.item.kind === "dashboard" && ["talent-review", "headcount", "team-structure"].includes(option.item.topic))).toBe(false)
    expect(JSON.stringify(restricted)).not.toContain("Talent Review")
    expect(JSON.stringify(restricted)).not.toContain("PRIVATE_AGENDA_TALENT")
    const copiedPrivate = await f.readCall((call) => f.app.agenda.create([privateItem], call))
    expect(copiedPrivate.status).toBe("denied")
    expect(JSON.stringify(copiedPrivate)).not.toContain("PRIVATE_AGENDA_TALENT")
    expect(JSON.stringify(copiedPrivate)).not.toContain("recordCount")
    const forged = await f.readCall((call) => f.app.agenda.create([{ ...privateItem, selectionRef: "sf-source:forged:1" }], call))
    expect(forged).toEqual({ status: "denied", reason: "source-unavailable" })
    expect(JSON.stringify(forged)).not.toContain("PRIVATE_AGENDA_TALENT")

    f.control.memberships = ["admins", "buyers"]
    f.gate.procurement = false
    const scoped = available(await f.discover({ period: f.period }))
    expect(scoped.options.some((option) => option.domain === "dashboard")).toBe(true)
    expect(scoped.options.some((option) => option.domain === "planner")).toBe(true)
    expect(scoped.options.some((option) => option.item.kind === "procurement-request" || option.item.kind === "procurement-supplier")).toBe(false)
    expect(JSON.stringify(scoped)).not.toContain("Independent purchase")
    expect(JSON.stringify(scoped)).not.toContain("Same Vendor")
    const copiedRequest = await f.readCall((call) => f.app.agenda.create([request!.item], call))
    expect(copiedRequest.status).toBe("denied")
    expect(JSON.stringify(copiedRequest)).not.toContain("Independent purchase")
    const injected = await f.handle(new Request("https://example.test/product?sf=review-agenda&start=2026-01-01&end=2026-12-31&principalRef=person"))
    expect(injected.status).toBe(400)
    expect(await injected.json()).toEqual({ status: "needs-input", reason: "invalid-agenda-query" })
    expect(await f.storedReviews()).toEqual([])
  } finally { await f.dispose() }
}, 180000)
