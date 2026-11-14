import { test } from "bun:test"
import { AsyncLocalStorage } from "node:async_hooks"
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
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { SfProductStatePort } from "../../../product/contracts/state.ts"
import { createSfProductAuthority } from "../../../product/integration/product-authority.ts"
import { createPlannerPort, projectPlannerSource } from "../../../product/planner/port.ts"
import { createReviewApplication } from "../../../product/reviews/application.ts"
import type { ReviewCompositionInput } from "../../../product/reviews/composition.ts"
import type { ReviewAgendaItem } from "../../../product/reviews/selection.ts"
import { object, rows } from "../../../runtime/contract.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { createOperatorIdentity } from "../../../runtime/operator-identity.ts"
import { captureChromiumCleanup } from "./chromium-cleanup.ts"

test("Chromium preserves the annual agenda, recovers a lost response and removes revoked content", async () => {
  const started = Date.now()
  const checkpoint = (phase: string) => console.info(`WP07 browser: ${phase} +${Date.now() - started}ms`)
  const traces = new AsyncLocalStorage<Map<string, { calls: number; milliseconds: number }>>()
  const record = (name: string, milliseconds: number) => {
    const trace = traces.getStore()
    if (!trace) return
    const previous = trace.get(name) ?? { calls: 0, milliseconds: 0 }
    trace.set(name, { calls: previous.calls + 1, milliseconds: previous.milliseconds + milliseconds })
  }
  const measure = async <T>(name: string, work: () => Promise<T>): Promise<T> => {
    const before = performance.now()
    try { return await work() } finally { record(name, performance.now() - before) }
  }
  const timed = async <T>(phase: string, work: () => Promise<T>, milliseconds = 5000): Promise<T> => {
    checkpoint(`${phase}:start`)
    const deadline = { timer: undefined as ReturnType<typeof setTimeout> | undefined }
    try {
      const value = await Promise.race([work(), new Promise<never>((_, reject) => { deadline.timer = setTimeout(() => reject(new Error(`WP07_BROWSER_PHASE_TIMEOUT:${phase}`)), milliseconds) })])
      checkpoint(`${phase}:done`)
      return value
    } finally { if (deadline.timer) clearTimeout(deadline.timer) }
  }
  const diagnostic = (error: unknown) => new Error((error instanceof Error ? error.stack ?? error.message : String(error)).replace(/([?&]code=)[a-f0-9]{64}/g, "$1[redacted]"))
  const failures: unknown[] = []
  const { chromium, expect } = await timed("playwright-import", () => import("@playwright/test"))
  const built = await timed("browser-build", () => Bun.build({ entrypoints: [fileURLToPath(new URL("./browser-ui-entry.ts", import.meta.url))], target: "browser", format: "esm", sourcemap: "none" }))
  expect(built.success).toBe(true)
  const bundle = built.outputs.find((output) => output.kind === "entry-point")
  if (!bundle) throw new Error("WP07_BROWSER_TEST_BUNDLE_UNAVAILABLE")
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-wp07-browser-"))
  await chmod(directory, 0o700)
  const store = await timed("sqlite-open", () => openLocalStore(directory))
  const snapshotRead = store.currentSnapshots
  if (!snapshotRead) throw new Error("WP07_BROWSER_SNAPSHOT_READER_UNAVAILABLE")
  // Observe the real persistence method without adding a read or changing its
  // result. All durations are inclusive; nested measurements are not additive.
  const observedStore = { ...store, currentSnapshots: () => {
    const before = performance.now()
    try { return snapshotRead.call(store) } finally { record("store.currentSnapshots", performance.now() - before) }
  } }
  const serverState: { handle?: (request: Request) => Promise<Response> } = {}
  const server = Bun.serve({ hostname: "localhost", port: 0, fetch: async (request) => await serverState.handle?.(request) ?? new Response(null, { status: 503 }) })
  checkpoint("server-created")
  const runtime: { browser?: Browser; closeBrowser?: () => Promise<void> } = {}
  try {
    const control = {
      allowed: true, available: true, dropPreserveResponse: false, sourceDestinationAllowed: true,
      preserveCalls: [] as { key: string; reviewRef?: string }[],
      updateChecks: [] as string[], sourceNavigations: [] as { reviewRef: string; refDigest: string }[],
      reviewNavigations: [] as { reviewRef: string; sectionId: string }[],
    }
    // Exercise the complete annual projection from the real Planner through both
    // preserved revisions. This does not substitute for native/C17 producer proof.
    const period = { start: "2027-01-01", end: "2027-12-31" }
    const at = "2026-11-13T08:00:00Z"
    const origin = server.url.origin
    const operator = { installationId: randomUUID(), uid: process.getuid!(), name: "WP07 isolated test operator" }
    const principalRef = `macos:${operator.installationId}:${operator.uid}`
    const commentText = "Owner note: check the renewal timing before deciding."
    const identity = createOperatorIdentity({ origin, mount: "/sucafina", operator, secrets: store.secrets, key: randomBytes(32) })
    checkpoint("authority-create")
    const authority = createSfProductAuthority({
      identity: () => ({ installationId: operator.installationId, projectId: "wp07-browser", hostId: "isolated-browser-test", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }),
      installationId: operator.installationId, origin, policyVersion: "test-policy", persistence: observedStore,
      authenticate: (request, context) => control.allowed ? identity.authenticate(request, context) : Promise.resolve(null),
      environment: async (request) => ({ at, id: randomUUID, directory: await identity.directory(request) }),
      grants: [{ principalRef, namespaces: ["reviews"], operations: ["sf_review_prepare", "sf_report_prepare", "sf_artifact_get"], humanActions: ["reviews.preserve"] }],
      createId: randomUUID, now: Date.now,
      commandIdentity: async (request, operation) => request.method === "GET" ? randomUUID() : /^[a-f0-9-]{36}$/.test(request.headers.get("idempotency-key") ?? "") ? digestSfValue({ operation, key: request.headers.get("idempotency-key") }) : undefined,
      inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => undefined, authorizeDocument: async () => undefined,
    })
    const host: DomainPortHost = {
      ...authority.host,
      revalidate: (context) => measure("host.revalidate", () => authority.host.revalidate(context)),
      authenticate: (request, options) => measure("host.authenticate", () => authority.host.authenticate(request, options)),
      environment: (request) => measure("host.environment", () => authority.host.environment(request)),
    }
    const state: SfProductStatePort = {
      ...authority.state,
      read: (request, namespace, read) => measure("state.read", () => authority.state.read(request, namespace, read)),
      transaction: (request, command, work) => measure("state.transaction", () => authority.state.transaction(request, command, work)),
    }
    await timed("planner-seed", () => store.transaction("planner", async (snapshot) => {
      snapshot.data.versions = [100, 110].map((amount, index) => ({ id: `v${index}`, year: 2027, closed: 0, lines: [{ id: "license", name: "Review license", sec: "opex", el: "licenses", cur: "USD", b: Array(12).fill(100), a: Array(12).fill(null), f: Array(12).fill(amount) }], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }))
      return { commit: true, value: undefined }
    }))
    const catalog = new Map<string, Extract<BusinessEvidenceRef, { kind: "record" }>>()
    const planner = createPlannerPort({ host, sources: {
      resolveForecastSource: async (versionId, context) => {
        if (!control.available || !["v0", "v1"].includes(versionId) || !await host.revalidate(context)) return { status: "unavailable", reason: "source-unavailable" }
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
    const revalidateSources: ReviewCompositionInput["access"]["revalidate"] = (context, sources) => measure("access.sourceRefs", async () => await host.revalidate(context) && sources.every((source) => [...catalog.values()].some((ref) => source.surface === ref.target.surface && source.type === ref.target.recordType && source.id === ref.target.recordId && source.incarnation === ref.target.incarnation && source.version === ref.target.version && digestSfValue(source.period) === digestSfValue(ref.target.period) && digestSfValue([...source.fields].sort()) === digestSfValue([...ref.target.fields].sort()))))
    const unavailable = async () => ({ status: "unavailable", reason: "producer-not-selected" } as const)
    checkpoint("review-application-create")
    const app = createReviewApplication({
      state, host, authority: authority.authority, ui: authority.ui, humanAuthority: authority.human,
      origin, maxBodyBytes: 100_000, creationTarget: authority.creationTarget,
      operationIdentity: (context) => context.kind === "ui" ? authority.ui.operationIdentity(context) : undefined,
      requiredAuthority: [], maxBytes: 5_000_000, now: () => at,
      evidence: { resolve: (ref, context) => measure("evidence.resolve", async () => ({ state: await host.revalidate(context) && catalog.has(ref.refDigest) && digestSfValue(catalog.get(ref.refDigest)) === digestSfValue(ref) ? "historical" as const : "unavailable" as const, ref, accessRevision: context.binding.accessRevision, checkedAt: at })) },
      access: { revalidate: revalidateSources, authorizeSections: (context, sections) => measure("access.sections", () => revalidateSources(context, sections.flatMap((section) => section.sourceRefs))), authorizeOutcomeComparison: async (_context, values) => values.length === 0, authorizeOutcome: async (_context, values) => values.length === 0, authorizeDecision: async (_context, values) => values.length === 0, authorizeSensitivity: async (_context, values) => values.length === 0 },
      collaboration: {
        // Controlled thread producer: captures a real consumer comment without claiming WP08 history.
        threads: { read: (threadId, context) => measure("comments.threadRead", async () => threadId === "browser-comment" && await host.revalidate(context)
          ? { status: "ok", value: { id: threadId, kind: "comment", sourceRef: "fixture-planner-v1", sourceIncarnation: "inc-v1", observedVersion: 1, period, evidenceRefs: [], messages: [{ id: "owner-note", incarnation: "owner-note-inc", version: 1, authorRef: principalRef, body: commentText, createdAt: at }] } } as const
          : { status: "denied", reason: "fixture-thread-unavailable" } as const) },
        history: { readVersion: unavailable },
        authorizeSourceMapping: (thread, sources, context) => measure("comments.sourceMapping", async () => thread.id === "browser-comment" && sources.length === 1 && sources[0]?.id === "v1" && sources[0]?.incarnation === "inc-v1" && await revalidateSources(context, sources)),
        maxMessages: 100,
      },
      ports: { planner: { compareForecast: (request, context) => measure("planner.compareForecast", () => planner.compareForecast(request, context)) }, selectDashboardAgenda: unavailable, procurement: { read: unavailable, readSupplier: unavailable, readContract: unavailable } },
    })
    const items: ReviewAgendaItem[] = [
      { id: "first", kind: "forecast-comparison", title: "First forecast", baseRef: "v0", candidateRef: "v1", sides: ["baseline", "candidate"], currency: "USD", period, agendaNote: "Retain this agenda note" },
      { id: "second", kind: "forecast-comparison", title: "Second forecast", baseRef: "v0", candidateRef: "v1", sides: ["candidate"], currency: "USD", period, threadIds: ["browser-comment"] },
      { id: "third", kind: "forecast-comparison", title: "Third forecast", baseRef: "v0", candidateRef: "v1", sides: ["candidate"], currency: "USD", period },
    ]
    serverState.handle = async (request) => {
      const authentication = await identity.handle(request)
      if (authentication) return authentication
      const url = new URL(request.url)
      if (url.pathname === "/sucafina/browser-ui.js") return new Response(bundle, { headers: { "Content-Type": "application/javascript" } })
      if (url.pathname === "/sucafina/test-review-host") {
        // Explicit fixture adapters for host callbacks; production UI/HTTP/readers remain unmodified.
        const operation = url.searchParams.get("operation")
        const reviewRef = url.searchParams.get("reviewRef") ?? ""
        const denied = () => Response.json({ status: "denied", reason: "test-host-access-unavailable" }, { status: 403 })
        if (request.method !== "GET" || !["check-update", "open-source", "open-review"].includes(operation ?? "") || !reviewRef) return denied()
        const digest = digestSfValue([...url.searchParams.entries()])
        const admitted = await authority.ui.admit(request, "sf_review_prepare", digest)
        if (admitted.status !== "ok") return denied()
        try {
          if (!await authority.ui.validate(admitted.value, "sf_review_prepare", digest) || authority.ui.requestFor(admitted.value) !== request) return denied()
          const review = await app.reviews.read(reviewRef, admitted.value)
          if (review.status !== "ok") return denied()
          if (operation === "check-update") {
            const current = await planner.compareForecast({ baseRef: "v0", candidateRef: "v1", currency: "USD", period }, admitted.value)
            if (current.status !== "ok") return Response.json(current, { status: 503 })
            const available = review.value.sections.some((section) => {
              const projection = section.content as DomainProjection
              const latest = projection.context.sourceRefs[0]?.id === "v0" ? current.value.baseline : current.value.candidate
              return digestSfValue(projection.values) !== digestSfValue(latest.values)
            })
            if (!await authority.host.revalidate(admitted.value)) return denied()
            control.updateChecks.push(reviewRef)
            return Response.json({ status: "ok", value: { available } })
          }
          if (operation === "open-source") {
            const refDigest = url.searchParams.get("refDigest") ?? ""
            const reference = review.value.sections.flatMap((section) => (section.content as DomainProjection).values.flatMap((value) => value.sourceRefs)).find((ref) => ref.refDigest === refDigest)
            const registered = catalog.get(refDigest)
            if (!control.sourceDestinationAllowed || !reference || !registered || digestSfValue(registered) !== digestSfValue(reference) || !await authority.host.revalidate(admitted.value)) return denied()
            control.sourceNavigations.push({ reviewRef, refDigest })
            return Response.json({ status: "ok" })
          }
          const sectionId = url.searchParams.get("sectionId") ?? ""
          if (review.value.sections[0]?.id !== sectionId || !await authority.host.revalidate(admitted.value)) return denied()
          control.reviewNavigations.push({ reviewRef, sectionId })
          return Response.json({ status: "ok" })
        } finally { authority.ui.finish(admitted.value) }
      }
      if (url.pathname !== "/sucafina/dashboard") return new Response(null, { status: 404 })
      const mode = url.searchParams.get("sf")
      if (mode) checkpoint(`http:${mode}:start`)
      const measurements = new Map<string, { calls: number; milliseconds: number }>()
      const before = performance.now()
      const response = await traces.run(measurements, () => app.http(request, "dashboard"))
      if (mode) console.info("WP07 browser profile:", JSON.stringify({ mode, milliseconds: Math.round(performance.now() - before), inclusiveDurations: true, measurements: Object.fromEntries([...measurements].map(([name, value]) => [name, { calls: value.calls, milliseconds: Math.round(value.milliseconds) }])) }))
      if (mode) checkpoint(`http:${mode}:${response?.status ?? "not-handled"}`)
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
    runtime.browser = await timed("chrome-launch", () => chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"], timeout: 15000 }), 20000)
    runtime.closeBrowser = await timed("chrome-ownership", () => captureChromiumCleanup(runtime.browser!))
    const context = await timed("browser-context", () => runtime.browser!.newContext({ viewport: { width: 1440, height: 1000 } }))
    const page = await timed("browser-page", () => context.newPage())
    page.setDefaultTimeout(5000)
    page.setDefaultNavigationTimeout(5000)
    const errors: string[] = []
    page.on("pageerror", (error) => { errors.push(error.message) })
    const code = await timed("operator-enrollment", () => identity.enroll())
    await timed("authenticated-navigation", () => page.goto(`${origin}/sucafina/auth/local?code=${code}`, { waitUntil: "domcontentloaded", timeout: 5000 }))
    const view = page.getByRole("region", { name: "Prepare review", exact: true })
    await expect(view.getByRole("button", { name: "Load selection", exact: true })).toBeEnabled()
    checkpoint("selection-load")
    await view.getByRole("button", { name: "Load selection", exact: true }).click()
    await expect(view.getByRole("heading", { level: 3 })).toHaveText(["First forecast · baseline", "First forecast · candidate", "Second forecast · candidate", "Third forecast · candidate"])
    checkpoint("selection-reorder-remove")
    await view.getByRole("button", { name: "Move Second forecast · candidate up", exact: true }).click()
    await view.getByRole("button", { name: "Move Second forecast · candidate up", exact: true }).click()
    await view.getByRole("button", { name: "Remove record first:baseline", exact: true }).click()
    await expect(view.getByRole("heading", { level: 3 })).toHaveText(["Second forecast · candidate", "First forecast · candidate", "Third forecast · candidate"])
    await view.getByRole("button", { name: "Remove Third forecast · candidate", exact: true }).click()
    await expect(view.getByRole("heading", { level: 3 })).toHaveText(["Second forecast · candidate", "First forecast · candidate"])
    await expect(view.getByText("Agenda note: Retain this agenda note", { exact: true })).toBeVisible()
    const forecast = view.getByRole("table", { name: "Second forecast · candidate · selected source values", exact: true }).getByRole("row").filter({ has: page.getByRole("cell", { name: "license:1:forecast", exact: true }) })
    await expect(forecast.getByRole("cell", { name: "110 USD", exact: true })).toBeVisible()
    const december = view.getByRole("table", { name: "Second forecast · candidate · selected source values", exact: true }).getByRole("row").filter({ has: page.getByRole("cell", { name: "license:12:forecast", exact: true }) })
    await expect(december.getByRole("cell", { name: "110 USD", exact: true })).toBeVisible()
    checkpoint("selection-stale-preserve")
    await changeForecast(120)
    await view.getByRole("button", { name: "Preserve this review", exact: true }).click()
    await expect(view.getByRole("status")).toContainText("agenda-preview-changed")
    await expect(forecast.getByRole("cell", { name: "110 USD", exact: true })).toBeVisible()
    expect(await storedReviews()).toHaveLength(0)
    checkpoint("selection-refresh")
    await view.getByRole("button", { name: "Refresh selection from current data", exact: true }).click()
    await expect(forecast.getByRole("cell", { name: "120 USD", exact: true })).toBeVisible()
    await expect(view.getByRole("heading", { level: 3 })).toHaveText(["Second forecast · candidate", "First forecast · candidate"])
    checkpoint("preserve-lost-response")
    control.dropPreserveResponse = true
    await view.getByRole("button", { name: "Preserve this review", exact: true }).click()
    await expect(view.getByRole("status")).toContainText("review-preserve-unavailable")
    expect(await storedReviews()).toHaveLength(1)
    checkpoint("preserve-explicit-recovery")
    // This second action is the explicit lost-response recovery, never an automatic flaky-test retry.
    await view.getByRole("button", { name: "Preserve this review", exact: true }).click()
    await expect(view.getByRole("heading", { name: "Preserved review", exact: true })).toBeVisible()
    const successful = control.preserveCalls.filter((call) => call.reviewRef)
    expect(successful).toHaveLength(2)
    expect(successful[0]!.key).toBe(successful[1]!.key)
    expect(successful[0]!.key).not.toBe("")
    expect(successful[0]!.reviewRef).toBe(successful[1]!.reviewRef)
    expect(await storedReviews()).toEqual([successful[0]!.reviewRef])
    checkpoint("revision-source-unavailable")
    control.available = false
    await view.getByRole("button", { name: "Prepare current data as a new revision", exact: true }).click()
    await expect(view.getByRole("status")).toContainText("forecast-source-unavailable")
    await expect(view.getByRole("heading", { name: "Preserved review", exact: true })).toBeVisible()
    await expect(forecast.getByRole("cell", { name: "120 USD", exact: true })).toBeVisible()
    checkpoint("revision-new-snapshot")
    control.available = true
    await changeForecast(130)
    await view.getByRole("button", { name: "Prepare current data as a new revision", exact: true }).click()
    await expect(forecast.getByRole("cell", { name: "130 USD", exact: true })).toBeVisible()
    await expect(view.getByRole("heading", { level: 3 })).toHaveText(["Second forecast · candidate", "First forecast · candidate"])
    await view.getByRole("button", { name: "Preserve this review", exact: true }).click()
    await expect(view.getByRole("heading", { name: "Preserved review", exact: true })).toBeVisible()
    expect(await storedReviews()).toHaveLength(2)
    checkpoint("original-snapshot-read")
    const original = await page.request.get(`${origin}/sucafina/dashboard?sf=review-read&reviewRef=${encodeURIComponent(successful[0]!.reviewRef!)}`, { timeout: 5000 })
    expect(original.status()).toBe(200)
    const recovered = await original.json() as PortResult<PreservedReview>
    if (recovered.status !== "ok") throw new Error(recovered.reason)
    expect(recovered.value.sections.map((section) => section.id)).toEqual(["second:candidate", "first:candidate"])
    expect((recovered.value.sections[0]!.content as DomainProjection).values.find((value) => value.id === "license:1:forecast")?.value).toBe(120)
    for (const section of recovered.value.sections) {
      expect(section.period).toEqual(period)
      expect((section.content as DomainProjection).values.filter((value) => /^license:\d+:forecast$/.test(value.id)).map((value) => [value.id, value.value])).toEqual(Array.from({ length: 12 }, (_, index) => [`license:${index + 1}:forecast`, 120]))
    }
    const screenshot = fileURLToPath(new URL("../../../../e2e/test-results/lean-visual/wp07-browser-ui.png", import.meta.url))
    await mkdir(path.dirname(screenshot), { recursive: true })
    await timed("screenshot", () => page.screenshot({ path: screenshot, timeout: 5000 }))
    checkpoint("selection-revoke")
    control.allowed = false
    await view.getByRole("button", { name: "Prepare current data as a new revision", exact: true }).click()
    await expect(view.getByRole("status")).toContainText("Selection unavailable")
    await expect(view.getByRole("table")).toHaveCount(0)
    await expect(view.getByRole("heading", { level: 3 })).toHaveCount(0)
    await expect(view.getByText("Agenda note: Retain this agenda note", { exact: true })).toHaveCount(0)
    await expect(view.getByRole("button", { name: "Load selection", exact: true })).toBeEnabled()
    expect(await storedReviews()).toHaveLength(2)
    checkpoint("meeting-open-preserved")
    control.allowed = true
    const originalRef = successful[0]!.reviewRef!
    const currentRef = (await storedReviews()).find((ref) => ref !== originalRef)
    if (!currentRef) throw new Error("WP07_CURRENT_REVIEW_NOT_PRESERVED")
    const currentUrl = `${origin}/sucafina/dashboard?review=${encodeURIComponent(currentRef)}`
    const originalUrl = `${origin}/sucafina/dashboard?review=${encodeURIComponent(originalRef)}`
    await page.goto(currentUrl, { waitUntil: "domcontentloaded" })
    const meeting = page.getByRole("main")
    await expect(meeting.getByRole("heading", { name: "Second forecast · candidate", exact: true })).toBeVisible()
    const currentValue = meeting.getByRole("listitem").filter({ hasText: /^license:1:forecast: 130 USD · / })
    await expect(currentValue).toBeVisible()
    await expect(meeting.getByRole("heading", { name: "Preserved comments", exact: true })).toBeVisible()
    await expect(meeting.getByText(`${principalRef} · ${at} · v1: ${commentText}`, { exact: true })).toBeVisible()
    checkpoint("meeting-current-conversation")
    await meeting.getByRole("button", { name: "Open current conversation", exact: true }).click()
    const conversation = meeting.getByRole("region", { name: "Current conversation", exact: true })
    await expect(conversation.getByRole("heading", { name: "Current conversation", exact: true })).toBeVisible()
    await expect(conversation.getByRole("listitem")).toHaveText([`${principalRef} · ${at} · v1: ${commentText}`])
    await expect(meeting.getByRole("status")).toHaveText("Current conversation opened; the preserved review is unchanged.")
    await expect(currentValue).toBeVisible()
    const conversationScreenshot = fileURLToPath(new URL("../../../../e2e/test-results/lean-visual/wp07-current-conversation.png", import.meta.url))
    await timed("current-conversation-screenshot", () => page.screenshot({ path: conversationScreenshot, timeout: 5000 }))
    await Bun.write(path.join(path.dirname(conversationScreenshot), "wp07-browser-visual.json"), JSON.stringify({
      schema: "wp07-browser-visual-v1", runId: process.env.GITHUB_RUN_ID ?? "unavailable", runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? "unavailable", workflowSha: process.env.GITHUB_SHA ?? "unavailable", productSha: process.env.WP07_PRODUCT_SHA ?? "parent-maps-workflow-sha-to-product",
      captures: ["wp07-browser-ui.png", "wp07-current-conversation.png"], capturedPhases: ["preserved annual review", "authorized current conversation beside unchanged captured values"],
      fixture: "isolated Chromium, SQLite, real Planner/review/HTTP/browser; controlled historical evidence and C06 thread producer",
      limits: ["Not a production host mount or native Relay/Session/SkillLoadReceipt execution.", "Images record these phases; the run conclusion and later revocation assertions remain in GitHub Actions results."], visualInspection: "pending",
    }, null, 2))
    expect(await storedReviews()).toHaveLength(2)
    await changeForecast(140)
    await meeting.getByRole("button", { name: "Next topic", exact: true }).click()
    await expect(meeting.getByRole("heading", { name: "First forecast · candidate", exact: true })).toBeVisible()
    await expect(currentValue).toBeVisible()
    await meeting.getByRole("button", { name: "Previous topic", exact: true }).click()
    await expect(meeting.getByRole("heading", { name: "Second forecast · candidate", exact: true })).toBeVisible()
    await expect(currentValue).toBeVisible()
    expect(control.updateChecks).toEqual([])
    await expect(meeting.getByRole("button", { name: "Create an updated review", exact: true })).toHaveCount(0)

    checkpoint("meeting-explicit-update-check")
    await meeting.getByRole("button", { name: "Check for updates", exact: true }).click()
    await expect(meeting.getByRole("button", { name: "Create an updated review", exact: true })).toBeVisible()
    await expect(currentValue).toBeVisible()
    expect(control.updateChecks).toEqual([currentRef])
    expect(await storedReviews()).toHaveLength(2)
    await meeting.getByRole("button", { name: "Create an updated review", exact: true }).click()
    await expect(page).toHaveURL(`${origin}/sucafina/dashboard?previousReviewRef=${encodeURIComponent(currentRef)}`)
    await expect(page.getByRole("button", { name: "Load selection", exact: true })).toBeEnabled()
    expect(await storedReviews()).toHaveLength(2)

    checkpoint("meeting-compare-snapshots")
    await page.goto(currentUrl, { waitUntil: "domcontentloaded" })
    await expect(currentValue).toBeVisible()
    await meeting.getByRole("button", { name: "Compare reviews", exact: true }).click()
    await expect(meeting.getByRole("status")).toHaveText("Changes between preserved reviews.")
    const changed = meeting.getByRole("listitem").filter({ hasText: /^section second:candidate · .* · license:1:forecast · changed: 120 → 130 \(Δ 10\) · / })
    await expect(changed).toBeVisible()
    await expect(changed).not.toContainText(commentText)
    await expect(meeting.getByRole("heading", { name: "Preserved comments", exact: true })).toBeVisible()
    await expect(meeting.getByRole("listitem").filter({ hasText: commentText }).locator(":scope > span")).toHaveText([
      `${originalRef} · ${principalRef} · ${at} · v1: ${commentText}`,
      `${currentRef} · ${principalRef} · ${at} · v1: ${commentText}`,
    ])
    await changed.getByRole("button", { name: "Open after item", exact: true }).click()
    await expect(meeting.getByRole("heading", { name: "Second forecast · candidate", exact: true })).toBeVisible()
    await expect(currentValue).toBeVisible()
    await meeting.getByRole("button", { name: "Compare reviews", exact: true }).click()
    await expect(changed).toBeVisible()
    await changed.getByRole("button", { name: "Open before item", exact: true }).click()
    await expect(page).toHaveURL(originalUrl)
    await expect(meeting.getByRole("heading", { name: "Second forecast · candidate", exact: true })).toBeVisible()
    const originalValue = meeting.getByRole("listitem").filter({ hasText: /^license:1:forecast: 120 USD · / })
    await expect(originalValue).toBeVisible()
    expect(control.reviewNavigations).toEqual([{ reviewRef: originalRef, sectionId: "second:candidate" }])

    checkpoint("meeting-first-review")
    await meeting.getByRole("button", { name: "Compare reviews", exact: true }).click()
    await expect(meeting.getByRole("status")).toHaveText("First review; no previous comparison.")
    await expect(meeting.getByRole("button", { name: "Open before item", exact: true })).toHaveCount(0)
    await expect(meeting.getByRole("button", { name: "Open after item", exact: true })).toHaveCount(0)
    await expect(meeting.getByRole("listitem").filter({ hasText: / · (changed|incompatible|added|removed): / })).toHaveCount(0)
    await expect(meeting.getByRole("listitem").filter({ hasText: commentText }).locator(":scope > span")).toHaveText([`${originalRef} · ${principalRef} · ${at} · v1: ${commentText}`])
    await meeting.getByRole("button", { name: "Next topic", exact: true }).click()
    await expect(meeting.getByRole("heading", { name: "First forecast · candidate", exact: true })).toBeVisible()
    await expect(originalValue).toBeVisible()
    await meeting.getByRole("button", { name: "Previous topic", exact: true }).click()
    await expect(meeting.getByRole("heading", { name: "Second forecast · candidate", exact: true })).toBeVisible()
    await expect(originalValue).toBeVisible()

    checkpoint("meeting-source-handoff")
    const source = (recovered.value.sections[0]!.content as DomainProjection).values.find((value) => value.id === "license:1:forecast")?.sourceRefs[0]
    if (!source) throw new Error("WP07_PRESERVED_SOURCE_NOT_AVAILABLE")
    const sourceButton = meeting.getByRole("button", { name: `Open source ${source.refId}`, exact: true })
    await sourceButton.click()
    await expect(meeting.getByRole("status")).toHaveText("Source navigation requested.")
    expect(control.sourceNavigations).toEqual([{ reviewRef: originalRef, refDigest: source.refDigest }])
    await expect(originalValue).toBeVisible()
    control.sourceDestinationAllowed = false
    await sourceButton.click()
    await expect(meeting.getByRole("status")).toHaveText("Source navigation is unavailable under current access.")
    await expect(meeting.getByRole("heading")).toHaveCount(0)
    await expect(meeting.getByRole("listitem")).toHaveCount(0)
    expect(control.sourceNavigations).toHaveLength(1)

    checkpoint("meeting-source-revocation")
    control.sourceDestinationAllowed = true
    await page.goto(originalUrl, { waitUntil: "domcontentloaded" })
    await expect(sourceButton).toBeVisible()
    control.allowed = false
    await sourceButton.click()
    await expect(meeting.getByRole("status")).toHaveText("Source is unavailable or review access has changed.")
    await expect(meeting.getByRole("heading")).toHaveCount(0)
    await expect(meeting.getByRole("listitem")).toHaveCount(0)
    expect(control.sourceNavigations).toHaveLength(1)

    checkpoint("meeting-review-revocation")
    control.allowed = true
    await page.goto(currentUrl, { waitUntil: "domcontentloaded" })
    await expect(currentValue).toBeVisible()
    await meeting.getByRole("button", { name: "Compare reviews", exact: true }).click()
    await expect(changed).toBeVisible()
    control.allowed = false
    await changed.getByRole("button", { name: "Open before item", exact: true }).click()
    await expect(meeting.getByRole("status")).toHaveText("Review item is unavailable or access has changed.")
    await expect(meeting.getByRole("heading")).toHaveCount(0)
    await expect(meeting.getByRole("listitem")).toHaveCount(0)
    await expect(page).toHaveURL(currentUrl)
    expect(control.reviewNavigations).toHaveLength(1)
    expect(await storedReviews()).toHaveLength(2)

    expect(errors).toEqual([])
    checkpoint("body-done")
  } catch (error) {
    const failure = diagnostic(error)
    console.error("WP07 browser: original failure before cleanup", failure.message)
    failures.push(failure)
  } finally {
    const cleanup: { phase: string; close: () => Promise<unknown> }[] = [
      { phase: "server-stop", close: async () => { await server.stop(true) } },
      { phase: "chrome-close", close: async () => {
        if (runtime.closeBrowser) return runtime.closeBrowser()
        if (runtime.browser) {
          await runtime.browser.close()
          throw new Error("WP07_CHROME_OWNERSHIP_WAS_NOT_CAPTURED")
        }
      } },
      { phase: "sqlite-dispose", close: () => store.dispose() },
      { phase: "temporary-files-remove", close: () => rm(directory, { recursive: true, force: true }) },
    ]
    for (const task of cleanup) {
      try { await timed(`cleanup:${task.phase}`, task.close, task.phase === "chrome-close" ? 20000 : 10000) }
      catch (error) {
        const failure = diagnostic(error)
        console.error(`WP07 browser: cleanup failure ${task.phase}`, failure.message)
        failures.push(failure)
      }
    }
  }
  if (failures.length) throw new AggregateError(failures, "WP07 browser regression or cleanup failed")
}, 120000)

