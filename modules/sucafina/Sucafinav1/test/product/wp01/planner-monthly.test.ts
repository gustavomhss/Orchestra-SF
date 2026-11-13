import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomBytes, randomUUID } from "node:crypto"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { createModule } from "../../../index.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { createOperatorIdentity } from "../../../runtime/operator-identity.ts"
import { createSfProductAuthority } from "../../../product/integration/product-authority.ts"
import { createPlannerMonthlyHost } from "../../../product/planner/monthly-host.ts"
import { createSfWorkbenchHttp } from "../../../product/interface/http.ts"
import { decorateSfProductHtml } from "../../../product/interface/html.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { SfHostServices } from "../../../product/contracts/host-context.ts"
import { handleSfPlannerMonthly } from "../../../product/interface/planner-http.ts"

test("Planner boundary rejects unpublished operations and invalid monthly context before host admission", async () => {
  const service = {} as SfHostServices
  const post = (input: unknown) => handleSfPlannerMonthly(new Request("http://localhost/sucafina/planner?sf=workbench-planner", {
    method: "POST", headers: { origin: "http://localhost", "content-type": "application/json", "idempotency-key": "planner-boundary-1" },
    body: JSON.stringify({ action: "apply", input }),
  }), "http://localhost", service)
  const extended = await post({ page: "OPEX", versionId: "v1", operation: { rowId: "line", revision: 0, kind: "reset" } })
  expect(extended.status).toBe(400)
  expect(await extended.json()).toEqual({ status: "needs-input", reason: "planner-operation-not-published" })
  for (const [rowId, revision, month] of [["", 0, 1], ["line", -1, 1], ["line", 0, 13], ["line", 0, 1.5]]) {
    expect((await post({ page: "OPEX", versionId: "v1", drafts: [{ rowId, revision, cells: [{ measure: "budget", month, text: "2" }] }] })).status).toBe(400)
  }
})

test("Planner grid previews pasted values and preserves a conflicting draft", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-planner-grid-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const serverState: { handle?: (request: Request) => Promise<Response | undefined> } = {}
  const server = Bun.serve({ hostname: "localhost", port: 0, fetch: async (request) => await serverState.handle?.(request) ?? new Response(null, { status: 503 }) })
  const origin = server.url.origin
  const operator = { installationId: randomUUID(), uid: 1000, name: "Test operator" }
  const person = `macos:${operator.installationId}:${operator.uid}`
  const identity = createOperatorIdentity({ origin, mount: "/sucafina", operator, secrets: store.secrets, key: randomBytes(32) })
  const environment = async (request: Request) => ({ at: "2026-11-13T08:00:00Z", id: randomUUID, directory: await identity.directory(request) })
  const authority = createSfProductAuthority({ identity: () => ({ installationId: operator.installationId, projectId: "project", hostId: "host", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }), installationId: operator.installationId, origin, policyVersion: "policy", persistence: store, authenticate: identity.authenticate, environment, grants: [{ principalRef: person, namespaces: [], operations: [], humanActions: ["planner.preview", "planner.apply"] }], createId: randomUUID, now: Date.now, commandIdentity: async (request, operation) => request.method === "GET" ? randomUUID() : request.headers.get("idempotency-key") ? digestSfValue({ operation, key: request.headers.get("idempotency-key") }) : undefined, inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => undefined, authorizeDocument: async () => undefined })
  const monthly = createPlannerMonthlyHost({ host: authority.host, humanAuthorize: authority.human.authorize })
  const plannerMonthly: NonNullable<SfHostServices["plannerMonthly"]> = { preview: (context, value) => monthly.preview(value, context), apply: (context, value) => monthly.apply(value, context) }
  const services = { ...authority, plannerMonthly } as SfHostServices
  const product = createSfWorkbenchHttp({ origin, mount: "/sucafina", runtime: () => services })
  const app = createModule("/sucafina", { persistence: store, authenticate: identity.authenticate, environment, product, productHtml: decorateSfProductHtml, maxJsonBytes: 100000 })
  serverState.handle = async (request) => await identity.handle(request) ?? await app(request)
  try {
    await store.transaction("planner", async (snapshot) => {
      snapshot.data.versions = [{ id: "v1", year: 2027, closed: 0, lines: [{ id: "line", name: "Planning line", sec: "opex", el: "licenses", cur: "USD", b: Array(12).fill(100), f: [] }], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }]
      return { commit: true, value: undefined }
    })
    const { chromium } = await import("@playwright/test")
    const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"] })
    try {
      const tab = await browser.newPage()
      tab.setDefaultTimeout(10_000)
      tab.setDefaultNavigationTimeout(15_000)
      await tab.goto(`${origin}/sucafina/auth/local?code=${await identity.enroll()}`)
      // The bulk editor may only expose cells rendered by the authorized grid.
      await tab.goto(`${origin}/sucafina/planner?page=OPEX&mode=forecast`)
      await tab.getByLabel("Measure", { exact: true }).selectOption("forecast")
      const first = tab.locator('section input[data-row="line"][data-month="1"]')
      expect(await first.isEnabled()).toBe(true)
      await first.dispatchEvent("paste", { clipboardData: await tab.evaluateHandle(() => { const data = new DataTransfer(); data.setData("text/plain", "42\t99"); return data }) })
      expect(await tab.locator('section input[data-row="line"][data-month="2"]').inputValue()).toBe("99")
      await tab.getByRole("button", { name: "Preview changes" }).click()
      await tab.getByText("Preview complete. Review the entries and save when ready.").waitFor()
      await store.transaction("planner", async (snapshot) => { snapshot.versions["v1:lines:line"] = { version: 1, by: "another" }; return { commit: true, value: undefined } })
      await tab.getByRole("button", { name: "Save changes" }).click()
      await tab.getByText(/Changed by another user/).waitFor()
      expect(await first.inputValue()).toBe("42")
      expect(await tab.locator('section input[data-row="line"][data-month="2"]').inputValue()).toBe("99")
    } finally { await browser.close() }
  } finally { await server.stop(true); await store.dispose(); await rm(directory, { recursive: true, force: true }) }
}, 60000)

