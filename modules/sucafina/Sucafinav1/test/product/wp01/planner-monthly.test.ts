import { expect, test } from "bun:test"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import type { Response as BrowserResponse } from "@playwright/test"
import { launchBrowserDriver } from "../wp02/browser-driver-fixture.ts"
import { observeNativeResponses } from "../../fixture/native-response-capture.ts"
import { createNativeBrowserAssets } from "../native-ui-browser/browser-assets.ts"
import { createNativeBrowserHost } from "../native-ui-browser/host.ts"
import { enrollNativeBrowser } from "../native-ui-browser/session.ts"
import { object, rows } from "../../../runtime/contract.ts"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomBytes, randomUUID } from "node:crypto"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { contributions, createModule } from "../../../index.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { createOperatorIdentity } from "../../../runtime/operator-identity.ts"
import { createSfProductAuthority } from "../../../product/integration/product-authority.ts"
import { createPlannerMonthlyHost } from "../../../product/planner/monthly-host.ts"
import { createSfWorkbenchHttp } from "../../../product/interface/http.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { SfHostServices } from "../../../product/contracts/host-context.ts"

test("Planner grid previews pasted values and preserves a conflicting draft", async () => {
  expectSpawn(import.meta.path)
  const assets = await createNativeBrowserAssets()
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-planner-grid-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const serverState: { handle?: (request: Request) => Promise<Response | undefined> } = {}
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async (request) => await serverState.handle?.(request) ?? new Response(null, { status: 404 }) })
  const origin = server.url.origin
  const operator = { installationId: randomUUID(), uid: 1000, name: "Test operator" }
  const person = `macos:${operator.installationId}:${operator.uid}`
  const identity = createOperatorIdentity({ origin, mount: "/sucafina", operator, secrets: store.secrets, key: randomBytes(32) })
  const environment = async (request: Request) => ({ at: "2026-11-13T08:00:00Z", id: randomUUID, directory: await identity.directory(request) })
  const binding = { installationId: operator.installationId, projectId: "project", hostId: "host", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
  const authority = createSfProductAuthority({ identity: () => binding, installationId: operator.installationId, origin, policyVersion: "policy", persistence: store, authenticate: identity.authenticate, isAuthenticated: async (request) => Boolean(await identity.person(request)), environment, grants: [{ principalRef: person, namespaces: [], operations: [], humanActions: ["planner.preview", "planner.apply"] }], createId: randomUUID, now: Date.now, commandIdentity: async (request, operation) => request.method === "GET" ? randomUUID() : request.headers.get("idempotency-key") ? digestSfValue({ operation, key: request.headers.get("idempotency-key") }) : undefined, inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => undefined, authorizeDocument: async () => undefined })
  const monthly = createPlannerMonthlyHost({ host: authority.host, humanAuthorize: authority.human.authorize })
  const plannerMonthly: NonNullable<SfHostServices["plannerMonthly"]> = { preview: (context, value) => monthly.preview(value, context), apply: (context, value) => monthly.apply(value, context) }
  const services = { ...authority, plannerMonthly } as SfHostServices
  const product = createSfWorkbenchHttp({ origin, mount: "/sucafina", runtime: () => services })
  const application = { persistence: store, authenticate: identity.authenticate, environment, product, maxJsonBytes: 100000 }
  const app = createModule("/sucafina", application)
  const native = createNativeBrowserHost({ origin, mount: "/sucafina", directory,
    identity: () => binding, application: { ...application, domains: contributions }, authority, services: () => services })
  serverState.handle = async (request) => await identity.handle(request) ?? assets.handle(request, { directory }) ??
    await native.handle(request) ?? await app(request)
  try {
    await store.transaction("planner", async (snapshot) => {
      snapshot.data.versions = [{ id: "v1", name: "FY27", year: 2027, locked: false, closed: 0, lines: [{ id: "line", name: "Planning line", sec: "opex", el: "licenses", cur: "USD", b: Array(12).fill(100), f: [] }], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }]
      return { commit: true, value: undefined }
    })
    const { expect: browserExpect } = await import("@playwright/test")
    const driver = await launchBrowserDriver("planner-monthly")
    const errors: string[] = []
    let primaryFailure: { error: unknown } | undefined
    let disposeResponseCapture: (() => void) | undefined
    try {
      const context = await driver.browser.newContext({ viewport: { width: 1440, height: 1000 } })
      context.setDefaultTimeout(5000)
      context.setDefaultNavigationTimeout(5000)
      await enrollNativeBrowser(context, origin, () => identity.enroll())
      const tab = await context.newPage()
      tab.on("pageerror", (error) => errors.push(error.message))
      await tab.goto(origin + "/orchestra/sf-planner/opex?year=2027&version=v1")
      const grid = tab.getByRole("grid")
      const forecast = grid.locator(".sf-s02-measure").filter({ has: tab.getByText("Forecast", { exact: true }) }).first()
      await browserExpect(forecast).toBeVisible()
      await forecast.click()
      await browserExpect(forecast).toHaveAttribute("data-active", "true")
      const responses = await observeNativeResponses(tab, origin)
      disposeResponseCapture = responses.dispose
      const monthlyResponse = (action: string) => (response: BrowserResponse) =>
        response.request().method() === "POST" && new URL(response.url()).searchParams.get("sf") === "workbench-planner" &&
        object(response.request().postDataJSON()).action === action
      const previewCopy = responses.begin([
        { label: "monthly preview", method: "POST", pathname: "/sucafina/planner", query: { sf: "workbench-planner" } },
      ], 5000)
      const [preview, paste] = await Promise.all([
        tab.waitForResponse(monthlyResponse("preview")),
        // Keep the ClipboardEvent and its DataTransfer in the grid's own frame;
        // no live clipboard object crosses the browser-driver protocol.
        grid.evaluate((element, text) => {
          const clipboardData = new DataTransfer()
          clipboardData.setData("text/plain", text)
          const event = new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData })
          element.dispatchEvent(event)
          return { clipboard: event instanceof ClipboardEvent, text: clipboardData.getData("text/plain"), consumed: event.defaultPrevented }
        }, "42\t99"),
      ])
      expect(paste).toEqual({ clipboard: true, text: "42\t99", consumed: true })
      expect(preview.status()).toBe(200)
      const previewRequest = object(preview.request().postDataJSON())
      expect(previewRequest).toMatchObject({ action: "preview", input: { page: "OPEX", versionId: "v1", drafts: [
        { rowId: "line", revision: 0, cells: [
          { measure: "forecast", month: 1, text: "42" }, { measure: "forecast", month: 2, text: "99" },
        ] },
      ] } })
      const inputProof = await tab.evaluate(async (input) => {
        const asset = "/__sf-native-fixture/client.js"
        const module: unknown = await import(asset)
        if (!module || typeof module !== "object" || !("proveNativeMonthlyDraft" in module) ||
          typeof module.proveNativeMonthlyDraft !== "function") throw new Error("Native monthly input proof unavailable")
        return module.proveNativeMonthlyDraft(input)
      }, previewRequest.input)
      expect(inputProof).toEqual({ browserProxy: true, storeSymbols: true, originalAccepted: true, strictProxyRejected: true,
        snapshotAccepted: true, sameJson: true, extraJsonRejected: true, extraProxyJsonRejected: true })
      const previewBody = object(await previewCopy.json(preview))
      expect(previewBody.status).toBe("ok")
      const reviewed = tab.getByRole("region", { name: "Producer preview by row", exact: true })
      await browserExpect(reviewed.locator('.sf-s02-preview-row[data-result="ready"]')).toHaveCount(1)
      await browserExpect(reviewed.locator("pre")).toHaveText("42\t99")
      await browserExpect(reviewed.locator("code")).toHaveText(["42", "99"])
      previewCopy.finish()
      const before = await store.transaction("planner", async (snapshot) => ({
        commit: false, value: structuredClone(snapshot.data),
      }))
      await store.transaction("planner", async (snapshot) => {
        snapshot.versions["v1:lines:line"] = { version: 1, by: "another" }
        return { commit: true, value: undefined }
      })
      const applyCopy = responses.begin([
        { label: "monthly apply", method: "POST", pathname: "/sucafina/planner", query: { sf: "workbench-planner" } },
      ], 5000)
      const [applied] = await Promise.all([
        tab.waitForResponse(monthlyResponse("apply")),
        reviewed.getByRole("button", { name: "Apply reviewed rows", exact: true }).click(),
      ])
      expect(object(applied.request().postDataJSON())).toEqual({ action: "apply", input: previewRequest.input })
      expect(applied.status()).toBe(200)
      const appliedBody = object(await applyCopy.json(applied))
      expect(appliedBody.status).toBe("ok")
      expect(rows(object(appliedBody.value).rows)).toEqual([
        expect.objectContaining({ draft: expect.objectContaining({ rowId: "line", revision: 0 }),
          result: expect.objectContaining({ ok: false, status: 409 }) }),
      ])
      await browserExpect(reviewed.locator('.sf-s02-preview-row[data-result="conflict"]')).toHaveCount(1)
      await browserExpect(reviewed.locator("pre")).toHaveText("42\t99")
      await browserExpect(reviewed.locator("code")).toHaveText(["42", "99"])
      applyCopy.finish()
      const after = await store.transaction("planner", async (snapshot) => ({
        commit: false, value: { data: structuredClone(snapshot.data), version: snapshot.versions["v1:lines:line"] },
      }))
      expect(after.data).toEqual(before)
      expect(after.version).toEqual({ version: 1, by: "another" })
      expect(errors).toEqual([])
    } catch (error) {
      primaryFailure = { error }
      if (errors.length) console.error("SF_PLANNER_NATIVE_PAGE_ERRORS", JSON.stringify(errors))
      throw error
    } finally {
      disposeResponseCapture?.()
      try { await driver.close() }
      catch (cleanupError) {
        if (primaryFailure)
          throw new AggregateError([primaryFailure.error, cleanupError], "Planner monthly test and browser cleanup failed")
        throw cleanupError
      }
      if (!primaryFailure) driver.report()
    }
  } finally { await server.stop(true); await store.dispose(); await rm(directory, { recursive: true, force: true }) }
}, 60000)
