import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import { observeSfReportHealth, observeSfReviewReadHealth } from "../../../../../apps/cli/src/sucafina-product/native-ui/report-health.ts"
import { createSfLiveContext } from "../../../../../apps/cli/src/sucafina-product/native-ui/live-context.ts"
import { mountSfNativeProjections } from "../../../../../apps/cli/src/sucafina-product/native-ui/router.ts"
import { createSfReviewsProjectionHandlers } from "../../../../../apps/cli/src/sucafina-product/native-ui/reviews.ts"
import { createSfExtendedBusinessServices } from "../../../../../apps/cli/src/sucafina-product/extended-business-services.ts"
import { createSfDashboardHttp } from "../../../../../apps/cli/src/sucafina-product/dashboard-http.ts"
import { digestSfValue } from "../../product/contracts/canonical.ts"
import { createExportArtifactFixture } from "../product/export-artifact-closure/fixture.ts"
import { financialCompositionFixture } from "../product/wp10/integration/financial-composition-fixture.ts"
import { prepareLocalConfiguration } from "../../runtime/local-configuration.ts"
import { createLocalInstallation } from "../../local/entry.ts"
import type { CreateSfHostRuntime } from "../../product/contracts/host-context.ts"

test("C14 report health uses actual descriptors and original C08 authority without creating an artifact", async () => {
  const f = await createExportArtifactFixture()
  try {
    await f.preserve()
    const original = f.incoming("review-report")
    // F01 admission requires the same read-only atomic three-surface snapshot
    // that the installed host supplies; never infer a role from absent snapshots.
    const admitted = await f.inRoot(() => f.authority.readContextAdmission(original))
    if (admitted.status !== "ok") throw new Error("original context unavailable")
    const before = await f.productState()
    const input = { ui: f.authority.ui, state: f.authority.state, source: f.app }
    const result = await f.inRoot(() => observeSfReportHealth(input, original, admitted.stamp))
    const ids = result.map((item) => String(item.operationId))
    if (Object.hasOwn(SfOperationRegistry, "reviews.report.prepare")) expect(ids).toContain("reviews.report.prepare")
    if (Object.hasOwn(SfOperationRegistry, "files.export.review")) expect(ids).toContain("files.export.review")
    expect(ids).not.toContain("reviews.export.docx")
    expect(ids).not.toContain("reviews.export.pptx")
    expect(await f.productState()).toEqual(before)
    f.sessions.owner!.active = false
    expect(await f.inRoot(() => observeSfReportHealth(input, original, admitted.stamp))).toEqual([])
  } finally { await f.dispose() }
})

test("F01 review reads require each real source, binding, lease and current C08 health", async () => {
  const f = await financialCompositionFixture()
  const extended = createSfExtendedBusinessServices({ authority: f.authority, business: f.business,
    persistence: f.persistence, ...f.guards, origin: "https://example.test" })
  try {
    if (!extended.reviews || !f.store.readSnapshotRoot) throw new Error("real review source unavailable")
    const reviews = extended.reviews
    let recordReads = 0
    let prepares = 0
    const originalRead = reviews.reviews.read
    const originalPreview = reviews.reviews.preview
    reviews.reviews.read = (...args) => { recordReads++; return originalRead.apply(reviews.reviews, args) }
    reviews.reviews.preview = (...args) => { prepares++; return originalPreview.apply(reviews.reviews, args) }
    const projection = createSfReviewsProjectionHandlers({ origin: "https://example.test", mount: "/sucafina",
      authority: f.authority, business: f.business, reviews, persistence: f.persistence })
    const dashboardHttp = createSfDashboardHttp({ origin: "https://example.test", mount: "/sucafina",
      runtime: () => ({ authority: f.authority, dashboard: f.business.dashboardServices, decisions: f.business.dashboardDecisions }) })
    let dispatches = 0
    const productHttp = async (request: Request, surface: string) => { dispatches++; return dashboardHttp(request, surface) }
    const proxy = Object.freeze({ operationId: "projection.review" as const, handle: async (request: Request) => {
      dispatches++
      return projection.handle(request)
    } })
    const handlers = [proxy]
    mountSfNativeProjections({ mount: "/sucafina", context: { handle: async () => new Response() } as never, handlers })
    const binding = Object.freeze({ installationId: "installation", projectId: "project", hostId: "host" })
    const original = new Request("https://example.test/sucafina/api/ui/context?installationId=installation&projectId=project&hostId=host")
    const initialized = await f.authority.state.transaction(original, { namespace: "preferences", expectedStorageVersion: 0,
      targetRef: f.authority.creationTarget.ref, targetIncarnation: f.authority.creationTarget.incarnation,
      idempotencyKey: "review-health-fixture", commandDigest: digestSfValue({ fixture: "review-health" }) },
    async (state) => { state.preferences["review-health-fixture"] = true; return { commit: true, value: true } })
    if (initialized.status !== "ok") throw new Error("C08 fixture initialization failed")
    const readState = () => f.store.transactionAll!(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) }))
    const before = await readState()
    let mounted = true
    let dashboardMounted = true
    let nativeSource = true
    const proof = (id: "dashboard.dashboard-review" | "projection.review", producer: object) => id === "projection.review"
      ? mounted && producer === projection && handlers.includes(proxy) ? proxy : undefined
      : dashboardMounted && producer === productHttp ? productHttp : undefined
    const sources = (id: "dashboard.dashboard-review" | "projection.review") => id === "dashboard.dashboard-review"
      ? { producer: productHttp, dependencies: [f.authority, dashboardHttp, f.business.dashboardServices, f.business.dashboardServices.readReview, f.persistence] }
      : nativeSource ? { producer: projection, dependencies: [f.authority, projection.handle, reviews, reviews.reviews.read, f.persistence] } : undefined
    const input = { ui: f.authority.ui, state: f.authority.state, binding: proof, source: sources }
    const inRoot = <T>(work: () => Promise<T>) => f.store.readSnapshotRoot!(work)
    const admission = await inRoot(() => f.authority.readContextAdmission(original))
    if (admission.status !== "ok") throw new Error("review context admission failed")
    const live = createSfLiveContext({ origin: "https://example.test", mount: "/sucafina", currentBinding: () => binding,
      admit: async (request) => {
        const current = await f.authority.readContextAdmission(request)
        return current.status === "ok" ? { status: "ok", stamp: current.stamp, authMode: "local-operator", destinations: [] } : current
      }, operational: (request, stamp) => observeSfReviewReadHealth(input, request, stamp) })
    const healthy = await inRoot(() => live.readContext(original, binding))
    if (healthy.status !== "ok") throw new Error("review F01 unavailable")
    const operations = healthy.value.availability.flatMap((resource) => resource.operations)
    expect(operations.find((item) => item.operationId === "dashboard.dashboard-review")?.state).toBe("ready")
    expect(operations.find((item) => item.operationId === "projection.review")?.state).toBe("ready")
    expect(dispatches).toBe(0)
    for (const [denied, absent, retained] of [
      ["sf_dashboard_read", "dashboard.dashboard-review", "projection.review"],
      ["sf_review_prepare", "projection.review", "dashboard.dashboard-review"],
    ] as const) {
      const ui = { ...f.authority.ui, admit: async (...args: Parameters<typeof f.authority.ui.admit>) => args[1] === denied
        ? { status: "denied" as const, reason: "fixture-denied" } : f.authority.ui.admit(...args) }
      const result = await inRoot(() => observeSfReviewReadHealth({ ...input, ui }, original, admission.stamp))
      expect(result.map((item) => item.operationId)).not.toContain(absent)
      expect(result.map((item) => item.operationId)).toContain(retained)
    }
    mounted = false
    expect((await inRoot(() => observeSfReviewReadHealth(input, original, admission.stamp))).map((item) => item.operationId)).toEqual(["dashboard.dashboard-review"])
    mounted = true
    dashboardMounted = false
    expect((await inRoot(() => observeSfReviewReadHealth(input, original, admission.stamp))).map((item) => item.operationId)).toEqual(["projection.review"])
    dashboardMounted = true
    expect(await inRoot(() => observeSfReviewReadHealth({ ...input, binding: undefined }, original, admission.stamp))).toEqual([])
    expect(await inRoot(() => observeSfReviewReadHealth({ ...input, binding: () => true as never }, original, admission.stamp))).toEqual([])
    nativeSource = false
    expect((await inRoot(() => observeSfReviewReadHealth(input, original, admission.stamp))).map((item) => item.operationId)).toEqual(["dashboard.dashboard-review"])
    nativeSource = true
    let calls = 0
    const replaced = { ...input, binding: (id: "dashboard.dashboard-review" | "projection.review", producer: object) =>
      id === "projection.review" && ++calls > 1 ? {} : proof(id, producer) }
    expect((await inRoot(() => observeSfReviewReadHealth(replaced, original, admission.stamp))).map((item) => item.operationId)).toEqual(["dashboard.dashboard-review"])
    let sourceReads = 0
    const changedSource = { ...input, source: (id: "dashboard.dashboard-review" | "projection.review") => {
      const source = sources(id)
      return id === "projection.review" && ++sourceReads > 1 && source ? { ...source, dependencies: [...source.dependencies, {}] } : source
    } }
    expect((await inRoot(() => observeSfReviewReadHealth(changedSource, original, admission.stamp))).map((item) => item.operationId)).toEqual(["dashboard.dashboard-review"])
    expect(await inRoot(() => observeSfReviewReadHealth(input, original, { ...admission.stamp, accessRevision: "changed" }))).toEqual([])
    const unavailable = { ...input, state: { ...f.authority.state, read: async () => ({ status: "unavailable" as const, reason: "fixture-unavailable" }) } as typeof f.authority.state }
    expect(await inRoot(() => observeSfReviewReadHealth(unavailable, original, admission.stamp))).toEqual([])
    const revokeRead: typeof f.authority.state.read = async (request, namespace, select) => {
      const result = await f.authority.state.read(request, namespace, select)
      f.active.value = false
      return result
    }
    expect(await inRoot(() => observeSfReviewReadHealth({ ...input, state: { ...f.authority.state, read: revokeRead } }, original, admission.stamp))).toEqual([])
    f.active.value = false
    expect(await inRoot(() => observeSfReviewReadHealth(input, original, admission.stamp))).toEqual([])
    expect(await readState()).toEqual(before)
    expect(dispatches).toBe(0)
    expect(recordReads).toBe(0)
    expect(prepares).toBe(0)
  } finally { extended.dispose(); await f.dispose() }
})

test("local installation supplies only its actual registered review bindings", async () => {
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "sf-review-binding-"))
  try {
    const file = await prepareLocalConfiguration(root)
    const config = await Bun.file(file).json()
    config.tenantId = "d89390a4-9315-466c-ab6d-ece154d4753d"
    config.clientId = "fe8424ba-3458-46d0-9964-e2db1da03742"
    await Bun.write(file, JSON.stringify(config))
    const environment = { ORCHESTRA_DB: path.join(root, "host-data", "orchestra.db"), ORCHESTRA_INHERIT_CREDENTIALS: "0",
      ORCHESTRA_CONFIG_DIR: path.join(root, "host-config"), ORCHESTRA_CREDENTIAL_KEY_FILE: path.join(root, "host-credential.key"),
      TMPDIR: path.join(root, "host-tmp"), XDG_DATA_HOME: path.join(root, "host-data"), XDG_CONFIG_HOME: path.join(root, "host-config"),
      XDG_CACHE_HOME: path.join(root, "host-cache"), XDG_STATE_HOME: path.join(root, "host-state") }
    const projection = { operationId: "projection.review" as const, handle: async () => new Response() }
    const productHttp = async () => undefined
    let services: { nativeReviewProjection: typeof projection; productHttp: typeof productHttp } | undefined = { nativeReviewProjection: projection, productHttp }
    const binding: { value?: Parameters<CreateSfHostRuntime>[0]["nativeReadBinding"] } = {}
    const installation = await createLocalInstallation({ origin: "http://localhost:4110", createHostRuntime: async (input) => {
      binding.value = input.nativeReadBinding
      expect(binding.value?.("projection.review", projection)).toBeUndefined()
      expect(binding.value?.("dashboard.dashboard-review", productHttp)).toBeUndefined()
      return { identity: () => undefined, contributions: [], services: () => services } as never
    } }, file, environment)
    try {
      const registered = binding.value?.("projection.review", projection)
      expect(registered).toMatchObject({ operationId: "projection.review" })
      expect(binding.value?.("projection.review", projection)).toBe(registered)
      const dashboard = binding.value?.("dashboard.dashboard-review", productHttp)
      expect(typeof dashboard).toBe("function")
      expect(binding.value?.("dashboard.dashboard-review", productHttp)).toBe(dashboard)
      expect(binding.value?.("projection.review", {})).toBeUndefined()
      expect(binding.value?.("dashboard.dashboard-review", {})).toBeUndefined()
      services = { nativeReviewProjection: { ...projection }, productHttp: async () => undefined }
      expect(binding.value?.("projection.review", projection)).toBeUndefined()
      expect(binding.value?.("dashboard.dashboard-review", productHttp)).toBeUndefined()
      services = undefined
      expect(binding.value?.("projection.review", projection)).toBeUndefined()
    } finally { await installation.dispose() }
    services = { nativeReviewProjection: projection, productHttp }
    expect(binding.value?.("projection.review", projection)).toBeUndefined()
  } finally { await rm(root, { recursive: true, force: true }) }
})
