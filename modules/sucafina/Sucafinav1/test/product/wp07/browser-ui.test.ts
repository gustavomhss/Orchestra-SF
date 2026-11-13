import { test } from "bun:test"
import { chmod, mkdir, mkdtemp, realpath, rm } from "node:fs/promises"
import { randomBytes, randomUUID } from "node:crypto"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import type { Browser } from "@playwright/test"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DomainProjection, PreservedReview } from "../../../product/contracts/context.ts"
import type { PortResult } from "../../../product/contracts/ports.ts"
import { createSfProductAuthority } from "../../../product/integration/product-authority.ts"
import { createPlannerPort, projectPlannerSource } from "../../../product/planner/port.ts"
import { createReviewApplication } from "../../../product/reviews/application.ts"
import type { ReviewCompositionInput } from "../../../product/reviews/composition.ts"
import type { ReviewAgendaItem } from "../../../product/reviews/selection.ts"
import { object, rows } from "../../../runtime/contract.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { createOperatorIdentity } from "../../../runtime/operator-identity.ts"

test("Chromium preserves the chosen agenda, recovers a lost response and removes revoked content", async () => {
  const { chromium, expect } = await import("@playwright/test")
  const built = await Bun.build({ entrypoints: [fileURLToPath(new URL("./browser-ui-entry.ts", import.meta.url))], target: "browser", format: "esm", sourcemap: "none" })
  expect(built.success).toBe(true)
  const bundle = built.outputs.find((output) => output.kind === "entry-point")
  if (!bundle) throw new Error("WP07_BROWSER_TEST_BUNDLE_UNAVAILABLE")
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-wp07-browser-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const serverState: { handle?: (request: Request) => Promise<Response> } = {}
  const server = Bun.serve({ hostname: "localhost", port: 0, fetch: async (request) => await serverState.handle?.(request) ?? new Response(null, { status: 503 }) })
  const runtime: { browser?: Browser } = {}
  try {
    const control = { allowed: true, available: true, dropPreserveResponse: false, preserveCalls: [] as { key: string; reviewRef?: string }[] }
    const period = { start: "2027-01-01", end: "2027-12-31" }
    const at = "2026-11-13T08:00:00Z"
    const origin = server.url.origin
    const operator = { installationId: randomUUID(), uid: process.getuid!(), name: "WP07 isolated test operator" }
    const principalRef = `macos:${operator.installationId}:${operator.uid}`
    const identity = createOperatorIdentity({ origin, mount: "/sucafina", operator, secrets: store.secrets, key: randomBytes(32) })
    const authority = createSfProductAuthority({
      identity: () => ({ installationId: operator.installationId, projectId: "wp07-browser", hostId: "isolated-browser-test", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }),
      installationId: operator.installationId, origin, policyVersion: "test-policy", persistence: store,
      authenticate: (request, context) => control.allowed ? identity.authenticate(request, context) : Promise.resolve(null),
      environment: async (request) => ({ at, id: randomUUID, directory: await identity.directory(request) }),
      grants: [{ principalRef, namespaces: ["reviews"], operations: ["sf_review_prepare", "sf_report_prepare", "sf_artifact_get"], humanActions: ["reviews.preserve"] }],
      createId: randomUUID, now: Date.now,
      commandIdentity: async (request, operation) => request.method === "GET" ? randomUUID() : /^[a-f0-9-]{36}$/.test(request.headers.get("idempotency-key") ?? "") ? digestSfValue({ operation, key: request.headers.get("idempotency-key") }) : undefined,
      inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => undefined, authorizeDocument: async () => undefined,
    })
    await store.transaction("planner", async (snapshot) => {
      snapshot.data.versions = [100, 110].map((amount, index) => ({ id: `v${index}`, year: 2027, closed: 0, lines: [{ id: "license", name: "Review license", sec: "opex", el: "licenses", cur: "USD", b: Array(12).fill(100), a: Array(12).fill(null), f: Array(12).fill(amount) }], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }))
      return { commit: true, value: undefined }
    })
    const catalog = new Map<string, Extract<BusinessEvidenceRef, { kind: "record" }>>()
    const planner = createPlannerPort({ host: authority.host, sources: {
      resolveForecastSource: async (versionId, context) => {
        if (!control.available || !["v0", "v1"].includes(versionId) || !await authority.host.revalidate(context)) return { status: "unavailable", reason: "source-unavailable" }
        const ref = await store.transaction<Extract<BusinessEvidenceRef, { kind: "record" }> | undefined>("planner", async (snapshot) => {
          const projection = projectPlannerSource(snapshot, { id: principalRef, roles: ["admin"], canWrite: true, assigned: [], domains: [] }, versionId)
          if (!projection) return { commit: false, value: undefined }
          const reference: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", kind: "record", refId: `forecast:${versionId}:${snapshot.versions[versionId]?.version ?? 1}`, installationId: operator.installationId, projectId: "wp07-browser", refDigest: "", evidenceLevel: "observed", target: { surface: "planner", recordType: "planner-version", recordId: versionId, incarnation: `inc-${versionId}`, version: snapshot.versions[versionId]?.version ?? 1, fields: Object.keys(projection), period, projectionDigest: digestSfValue({ versionId, projection }) } }
          return { commit: false, value: { ...reference, refDigest: digestSfEvidenceRef(reference) } }
        })
        if (!ref) return { status: "unavailable", reason: "source-unavailable" }
        catalog.set(ref.refDigest, ref)
        return { status: "ok", value: { versionId, evidence: ref } }
      },
      resolveForecastCoverage: async () => ({ status: "unavailable", reason: "synthetic-coverage-not-supplied" }),
    } })
    // Synthetic authorized reference history only; this is not C17 tombstone or native execution evidence.
    const revalidateSources: ReviewCompositionInput["access"]["revalidate"] = async (context, sources) => await authority.host.revalidate(context) && sources.every((source) => [...catalog.values()].some((ref) => source.surface === ref.target.surface && source.type === ref.target.recordType && source.id === ref.target.recordId && source.incarnation === ref.target.incarnation && source.version === ref.target.version && digestSfValue(source.period) === digestSfValue(ref.target.period) && digestSfValue([...source.fields].sort()) === digestSfValue([...ref.target.fields].sort())))
    const unavailable = async () => ({ status: "unavailable", reason: "producer-not-selected" } as const)
    const app = createReviewApplication({
      state: authority.state, host: authority.host, authority: authority.authority, ui: authority.ui, humanAuthority: authority.human,
      origin, maxBodyBytes: 100_000, creationTarget: authority.creationTarget,
      operationIdentity: (context) => context.kind === "ui" ? authority.ui.operationIdentity(context) : undefined,
      requiredAuthority: [], maxBytes: 5_000_000, now: () => at,
      evidence: { resolve: async (ref, context) => ({ state: await authority.host.revalidate(context) && catalog.has(ref.refDigest) && digestSfValue(catalog.get(ref.refDigest)) === digestSfValue(ref) ? "historical" : "unavailable", ref, accessRevision: context.binding.accessRevision, checkedAt: at }) },
      access: { revalidate: revalidateSources, authorizeSections: (context, sections) => revalidateSources(context, sections.flatMap((section) => section.sourceRefs)), authorizeOutcomeComparison: async (_context, values) => values.length === 0, authorizeOutcome: async (_context, values) => values.length === 0, authorizeDecision: async (_context, values) => values.length === 0, authorizeSensitivity: async (_context, values) => values.length === 0 },
      collaboration: { threads: { read: unavailable }, history: { readVersion: unavailable }, authorizeSourceMapping: async () => false, maxMessages: 100 },
      ports: { planner, selectDashboardAgenda: unavailable, procurement: { read: unavailable, readSupplier: unavailable, readContract: unavailable } },
    })
    const items: ReviewAgendaItem[] = [
      { id: "first", kind: "forecast-comparison", title: "First forecast", baseRef: "v0", candidateRef: "v1", sides: ["baseline", "candidate"], currency: "USD", period, agendaNote: "Retain this agenda note" },
      { id: "second", kind: "forecast-comparison", title: "Second forecast", baseRef: "v0", candidateRef: "v1", sides: ["candidate"], currency: "USD", period },
      { id: "third", kind: "forecast-comparison", title: "Third forecast", baseRef: "v0", candidateRef: "v1", sides: ["candidate"], currency: "USD", period },
    ]
    serverState.handle = async (request) => {
      const authentication = await identity.handle(request)
      if (authentication) return authentication
      const url = new URL(request.url)
      if (url.pathname === "/sucafina/browser-ui.js") return new Response(bundle, { headers: { "Content-Type": "application/javascript" } })
      if (url.pathname !== "/sucafina/dashboard") return new Response(null, { status: 404 })
      const response = await app.http(request, "dashboard")
      if (response) {
        if (url.searchParams.get("sf") !== "review-preserve") return response
        const result = await response.clone().json() as PortResult<PreservedReview>
        control.preserveCalls.push({ key: request.headers.get("idempotency-key") ?? "", ...(result.status === "ok" ? { reviewRef: result.value.id } : {}) })
        // Lose the body only after the real HTTP handler has durably committed the review.
        if (result.status === "ok" && control.dropPreserveResponse) {
          control.dropPreserveResponse = false
          return new Response("{", { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } })
        }
        return response
      }
      if (!await identity.person(request)) return new Response(null, { status: 403 })
      return new Response(`<!doctype html><html><head><meta charset="utf-8"><title>WP07 browser regression</title></head><body><main></main><script type="application/json">${JSON.stringify(items)}</script><script type="module" src="/sucafina/browser-ui.js"></script></body></html>`, { headers: { "Content-Type": "text/html", "Cache-Control": "no-store" } })
    }
    const changeForecast = (amount: number) => store.transaction("planner", async (snapshot) => {
      const versions = rows(snapshot.data.versions)
      const candidate = versions.find((version) => version.id === "v1")
      if (!candidate) throw new Error("WP07_FORECAST_FIXTURE_UNAVAILABLE")
      candidate.lines = rows(candidate.lines).map((line) => ({ ...line, f: Array(12).fill(amount) }))
      snapshot.data.versions = versions
      snapshot.versions.v1 = { version: (snapshot.versions.v1?.version ?? 1) + 1, by: principalRef }
      return { commit: true, value: undefined }
    })
    const storedReviews = () => store.transaction("dashboard", async (snapshot) => ({ commit: false, value: Object.keys(object(object(snapshot.data.__sfProductV1).reviews)) }))
    runtime.browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"] })
    const page = await runtime.browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const errors: string[] = []
    page.on("pageerror", (error) => { errors.push(error.message) })
    await page.goto(`${origin}/sucafina/auth/local?code=${await identity.enroll()}`)
    const view = page.getByRole("region", { name: "Prepare review", exact: true })
    await expect(view.getByRole("button", { name: "Load selection", exact: true })).toBeEnabled()
    await view.getByRole("button", { name: "Load selection", exact: true }).click()
    await expect(view.getByRole("heading", { level: 3 })).toHaveText(["First forecast · baseline", "First forecast · candidate", "Second forecast · candidate", "Third forecast · candidate"])
    await view.getByRole("button", { name: "Move Second forecast · candidate up", exact: true }).click()
    await view.getByRole("button", { name: "Move Second forecast · candidate up", exact: true }).click()
    await view.getByRole("button", { name: "Remove record first:baseline", exact: true }).click()
    await expect(view.getByRole("heading", { level: 3 })).toHaveText(["Second forecast · candidate", "First forecast · candidate", "Third forecast · candidate"])
    await view.getByRole("button", { name: "Remove Third forecast · candidate", exact: true }).click()
    await expect(view.getByRole("heading", { level: 3 })).toHaveText(["Second forecast · candidate", "First forecast · candidate"])
    await expect(view.getByText("Agenda note: Retain this agenda note", { exact: true })).toBeVisible()
    const forecast = view.getByRole("table", { name: "Second forecast · candidate · selected source values", exact: true }).getByRole("row").filter({ has: page.getByRole("cell", { name: "license:1:forecast", exact: true }) })
    await expect(forecast.getByRole("cell", { name: "110 USD", exact: true })).toBeVisible()
    await changeForecast(120)
    await view.getByRole("button", { name: "Preserve this review", exact: true }).click()
    await expect(view.getByRole("status")).toContainText("agenda-preview-changed")
    await expect(forecast.getByRole("cell", { name: "110 USD", exact: true })).toBeVisible()
    expect(await storedReviews()).toHaveLength(0)
    await view.getByRole("button", { name: "Refresh selection from current data", exact: true }).click()
    await expect(forecast.getByRole("cell", { name: "120 USD", exact: true })).toBeVisible()
    await expect(view.getByRole("heading", { level: 3 })).toHaveText(["Second forecast · candidate", "First forecast · candidate"])
    control.dropPreserveResponse = true
    await view.getByRole("button", { name: "Preserve this review", exact: true }).click()
    await expect(view.getByRole("status")).toContainText("review-preserve-unavailable")
    expect(await storedReviews()).toHaveLength(1)
    // This second action is the explicit lost-response recovery, never an automatic flaky-test retry.
    await view.getByRole("button", { name: "Preserve this review", exact: true }).click()
    await expect(view.getByRole("heading", { name: "Preserved review", exact: true })).toBeVisible()
    const successful = control.preserveCalls.filter((call) => call.reviewRef)
    expect(successful).toHaveLength(2)
    expect(successful[0]!.key).toBe(successful[1]!.key)
    expect(successful[0]!.key).not.toBe("")
    expect(successful[0]!.reviewRef).toBe(successful[1]!.reviewRef)
    expect(await storedReviews()).toEqual([successful[0]!.reviewRef])
    control.available = false
    await view.getByRole("button", { name: "Prepare current data as a new revision", exact: true }).click()
    await expect(view.getByRole("status")).toContainText("forecast-source-unavailable")
    await expect(view.getByRole("heading", { name: "Preserved review", exact: true })).toBeVisible()
    await expect(forecast.getByRole("cell", { name: "120 USD", exact: true })).toBeVisible()
    control.available = true
    await changeForecast(130)
    await view.getByRole("button", { name: "Prepare current data as a new revision", exact: true }).click()
    await expect(forecast.getByRole("cell", { name: "130 USD", exact: true })).toBeVisible()
    await expect(view.getByRole("heading", { level: 3 })).toHaveText(["Second forecast · candidate", "First forecast · candidate"])
    await view.getByRole("button", { name: "Preserve this review", exact: true }).click()
    await expect(view.getByRole("heading", { name: "Preserved review", exact: true })).toBeVisible()
    expect(await storedReviews()).toHaveLength(2)
    const original = await page.request.get(`${origin}/sucafina/dashboard?sf=review-read&reviewRef=${encodeURIComponent(successful[0]!.reviewRef!)}`)
    expect(original.status()).toBe(200)
    const recovered = await original.json() as PortResult<PreservedReview>
    if (recovered.status !== "ok") throw new Error(recovered.reason)
    expect(recovered.value.sections.map((section) => section.id)).toEqual(["second:candidate", "first:candidate"])
    expect((recovered.value.sections[0]!.content as DomainProjection).values.find((value) => value.id === "license:1:forecast")?.value).toBe(120)
    const screenshot = fileURLToPath(new URL("../../../../../../test-ci-evidence/wp07-browser-ui.png", import.meta.url))
    await mkdir(path.dirname(screenshot), { recursive: true })
    await page.screenshot({ path: screenshot })
    control.allowed = false
    await view.getByRole("button", { name: "Prepare current data as a new revision", exact: true }).click()
    await expect(view.getByRole("status")).toContainText("Selection unavailable")
    await expect(view.getByRole("table")).toHaveCount(0)
    await expect(view.getByRole("heading", { level: 3 })).toHaveCount(0)
    await expect(view.getByText("Agenda note: Retain this agenda note", { exact: true })).toHaveCount(0)
    await expect(view.getByRole("button", { name: "Load selection", exact: true })).toBeEnabled()
    expect(await storedReviews()).toHaveLength(2)
    expect(errors).toEqual([])
  } finally {
    await runtime.browser?.close()
    await server.stop(true)
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
}, 120000)
