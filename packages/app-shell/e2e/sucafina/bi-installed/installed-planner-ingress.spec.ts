import { expect, test, type Request, type Response } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { encodeSfRouteRef } from "../../../src/orchestra/chapters/sucafina/navigation-state"
import { asRecord } from "../decisions-support/journey"
import { startPlannerInstallation } from "../wp03/installation-fixture"

// R2 stopped before BI: the first Planner save never produced an observable
// response. This probe preserves that exact UI command and captures its HTTP
// outcome. It neither resends an uncertain mutation nor replaces the ingress.
test.use({ trace: "off", video: "off" })
test.describe.configure({ retries: 0 })

test("BI62 installed Planner first save exposes its real HTTP outcome before BI setup", async ({ page }, info) => {
  test.setTimeout(180_000)
  const installation = await startPlannerInstallation(info)
  const observations: Record<string, unknown>[] = []
  const began = Date.now()
  const requests = new Map<Request, number>()
  const responses = new Map<Request, Response>()
  const lifecycle: { outcome?: { state: "finished" | "failed"; request: Request } } = {}
  let commandCount = 0
  let problem: unknown
  const url = "/orchestra/sf-planner/versions/new"
  const sourceUrl = `${installation.origin}/sucafina/api/ui/pages/CAP23`
  const initial: { version?: number } = {}
  const describe = (request: Request) => {
    const target = new URL(request.url())
    if (target.origin !== installation.origin || !target.pathname.startsWith("/sucafina/") || target.pathname.includes("/auth/")) return undefined
    let body: unknown
    try { body = request.postDataJSON() } catch { body = undefined }
    const command = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : undefined
    return { method: request.method(), path: target.pathname, page: target.searchParams.get("page"), mode: target.searchParams.get("sf"),
      action: typeof command?.action === "string" ? command.action : null,
      bodyBytes: request.postDataBuffer()?.byteLength ?? 0,
      contentType: request.headers()["content-type"] ?? null, contentLength: request.headers()["content-length"] ?? null }
  }
  const isFirstSave = (request: Request) => {
    const value = describe(request)
    return value?.method === "POST" && value.path === "/sucafina/planner" && value.page === "Versions" && value.mode === null && value.action === "save"
  }
  page.on("request", (request) => {
    const value = describe(request)
    if (!value) return
    const id = requests.size + 1
    requests.set(request, id)
    if (isFirstSave(request)) commandCount++
    observations.push({ event: "request", id, elapsedMs: Date.now() - began, ...value })
  })
  page.on("response", (response) => {
    const request = response.request(), id = requests.get(request)
    if (id === undefined) return
    responses.set(request, response)
    observations.push({ event: "response-headers", id, elapsedMs: Date.now() - began, status: response.status(),
      contentType: response.headers()["content-type"] ?? null, contentLength: response.headers()["content-length"] ?? null,
      transferEncoding: response.headers()["transfer-encoding"] ?? null })
  })
  page.on("requestfinished", (request) => {
    const id = requests.get(request)
    if (id === undefined) return
    observations.push({ event: "request-finished", id, elapsedMs: Date.now() - began, timing: request.timing() })
    if (isFirstSave(request)) lifecycle.outcome = { state: "finished", request }
  })
  page.on("requestfailed", (request) => {
    const id = requests.get(request)
    if (id === undefined) return
    observations.push({ event: "request-failed", id, elapsedMs: Date.now() - began,
      failure: redact(request.failure()?.errorText ?? "unknown"), timing: request.timing() })
    if (isFirstSave(request)) lifecycle.outcome = { state: "failed", request }
  })
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning")
      observations.push({ event: "browser-console", elapsedMs: Date.now() - began, type: message.type(), message: redact(message.text()) })
  })
  page.on("pageerror", (error) => observations.push({ event: "page-error", elapsedMs: Date.now() - began, message: redact(error.message) }))

  try {
    await page.context().addCookies([installation.cookie])
    await test.step("open the real empty Planner and submit Create first version once", async () => {
      const opened = await page.goto(url)
      expect(opened?.status()).toBe(200)
      await expect(page.getByRole("heading", { name: "Versions", exact: true, level: 1 })).toBeVisible()
      const surface = page.locator('[data-sf-surface="CAP23"]')
      await expect(surface).toHaveCount(1)
      const source = await page.request.get(sourceUrl)
      expect(source.status()).toBe(200)
      const envelope = asRecord(await source.json())
      expect(envelope.status).toBe("ok")
      const projection = asRecord(envelope.value)
      expect(asRecord(projection.data).versions).toEqual([])
      const version = asRecord(asRecord(projection.versions)["versions:first"] ?? {}).version ?? 0
      expect(typeof version).toBe("number")
      expect(Number.isSafeInteger(version) && Number(version) >= 0).toBe(true)
      initial.version = Number(version)
      const button = surface.getByRole("button", { name: "Create first version", exact: true })
      await expect(button).toBeEnabled()
      await button.click()
      const review = surface.locator('[data-component="sf-change-review"]')
      await expect(review).toHaveCount(1)
      await expect(review).toHaveAttribute("data-state", "ready")
      await expect(review.getByRole("heading", { name: "Review changes", exact: true })).toBeVisible()
      expect(commandCount, "Opening a native review must not submit the command").toBe(0)
      const confirm = review.getByRole("button", { name: "Confirm", exact: true })
      await expect(confirm).toBeEnabled()
      await confirm.click()
      // Observe completion or failure of the one confirmed native command;
      // never resend an uncertain mutation.
      try { await expect.poll(() => lifecycle.outcome?.state ?? "pending", { message: "first Planner save finishes or fails at the real HTTP boundary", timeout: 15_000 }).toMatch(/^(finished|failed)$/) }
      catch (error) { problem = error; observations.push({ event: "first-save-outcome-not-observed", elapsedMs: Date.now() - began }) }
      observations.push({ event: "rendered-outcome", commandCount, state: lifecycle.outcome?.state ?? "not-observed",
        notices: (await surface.locator(".sf-u46-alert").allTextContents()).map(redact),
        uncertain: await review.evaluateAll((reviews) => reviews.map((element) => element.getAttribute("data-state"))),
        knownVersionIds: await surface.locator("tr[data-sf-row]").evaluateAll((rows) => rows.map((element) => element.getAttribute("data-sf-row"))) })
    })

    await test.step("read current state without resending the save", async () => {
      try {
        const current = await page.request.get(sourceUrl, { timeout: 10_000 })
        const envelope = asRecord(await current.json())
        const versions = asRecord(asRecord(envelope.value).data).versions
        observations.push({ event: "read-only-current-Planner", status: current.status(), contentType: current.headers()["content-type"] ?? null,
          resultStatus: envelope.status, knownVersionIds: Array.isArray(versions) ? versions.map((version) => asRecord(version).id) : null })
      } catch (error) { observations.push({ event: "read-only-current-Planner-failed", error: redact(String(error)) }) }
      // Personal views uses POST for its read-only list, so this records whether
      // the same real body-bearing ingress also answers its normal read command.
      try {
        const current = await page.request.post(`${installation.origin}/sucafina/planner?sf=workbench-views`, {
          headers: { origin: installation.origin, "idempotency-key": randomUUID() }, data: { action: "list", input: {} }, timeout: 10_000,
        })
        const body: unknown = await current.json()
        const value = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {}
        observations.push({ event: "read-only-personal-views", status: current.status(), contentType: current.headers()["content-type"] ?? null,
          resultStatus: value.status, reason: typeof value.reason === "string" ? redact(value.reason) : null,
          entryCount: Array.isArray(value.value) ? value.value.length : null })
      } catch (error) { observations.push({ event: "read-only-personal-views-failed", error: redact(String(error)) }) }
    })

    expect(commandCount, "The uncertain mutation must not be repeated").toBe(1)
    if (problem) throw problem
    expect(lifecycle.outcome?.state, "The installed first-save request must complete, not fail in browser transport").toBe("finished")
    const response = lifecycle.outcome ? responses.get(lifecycle.outcome.request) : undefined
    expect(response, "The completed first save must have HTTP response headers").toBeDefined()
    const submitted = asRecord(response!.request().postDataJSON())
    expect(submitted).toMatchObject({ page: "Versions", action: "save", version: initial.version, confirmed: true })
    expect(submitted.values).toEqual({})
    expect(submitted.id).toBeUndefined()
    expect(response!.status()).toBe(200)
    expect(response!.headers()["content-type"]).toContain("application/json")
    const body: { ok?: unknown; value?: unknown } = await response!.json()
    observations.push({ event: "first-save-result", ok: body.ok, recordId: typeof body.value === "string" ? body.value : null })
    expect(body.ok).toBe(true)
    expect(typeof body.value).toBe("string")
    expect(String(body.value)).toMatch(/\S+/)
    await expect(page).toHaveURL((current) => current.pathname === "/orchestra/sf-planner/versions/" + encodeSfRouteRef(String(body.value)))
    await expect(page.locator("#sf-u46-name")).toBeEnabled()
    const year = new URL(page.url()).searchParams.get("year")
    expect(year).toMatch(/^\d{4}$/)
    await page.goto("/orchestra/sf-planner/versions?" + new URLSearchParams({ year: String(year) }))
    const row = page.locator('tr[data-sf-row="' + String(body.value) + '"]')
    await expect(row).toHaveCount(1)
    await expect(row).toBeVisible()
  } finally {
    // Preserve transport/UI observations while the live page and host still
    // exist. The unchanged shared fixture then emits its redacted CLI log.
    try {
      await info.attach("bi62-first-save-http.json", { body: JSON.stringify({ snapshot: process.env.GITHUB_SHA ?? null,
        commandCount, observations, boundary: "Real CLI/factory/enrollment/Planner UI; one save attempt; subsequent requests only read current state. No route, body, authority or domain result is replaced." }, null, 2), contentType: "application/json" })
      await info.attach("bi62-first-save.png", { body: await page.screenshot(), contentType: "image/png" })
    } finally { await installation.stop() }
  }
})

function redact(value: string) {
  return value.slice(0, 4000)
    .replace(/([?&](?:code|token|password|secret)=)[^&#\s"'<>]*/gi, "$1[redacted]")
    .replace(/(sucafina_operator_[a-f0-9]{24}=)[^;\s"']*/gi, "$1[redacted]")
    .replace(/((?:authorization|set-cookie|cookie)\s*[:=]\s*)[^\r\n]*/gi, "$1[redacted]")
    .replace(/\b[a-f0-9]{32,}\b/gi, "[redacted-hex]")
}
