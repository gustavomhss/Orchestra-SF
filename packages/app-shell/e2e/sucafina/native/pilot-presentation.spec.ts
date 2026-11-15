/**
 * Q02.pilot / WP10.T02 + WP10.T04 / Q02-P0P1
 *
 * Presentation checks are deliberately downstream of the F04 installed harness.
 * F04's domain seed is NOT an authenticated/installed pilot acceptance. A missing
 * host, actor, producer response or D01 desktop session must FAIL, not skip/pass.
 * No test in this file creates roles, issues fake responses or retries a command.
 */
import { expect } from "@playwright/test"
import type { Page, Request } from "@playwright/test"
import { armLostResponse, nativeInstalledFixture } from "./fixture.ts"
import type { InstalledNativeHarness } from "./fixture.ts"

const test = nativeInstalledFixture
test.use({ viewport: { width: 1280, height: 800 }, serviceWorkers: "block" })

// Both titles come from F04 seedNativeProcurementCorpus (real domain storage).
const pilot = {
  p0: "F04 real domain P0 draft title",
  p1: "F04 real domain P1 submitted PR",
  requests: "/orchestra/sf-procurement/requests",
  approvals: "/orchestra/sf-procurement/approvals",
} as const

function isCommand(request: Request, page: "Requests" | "My approvals") {
  const url = new URL(request.url())
  return request.method() === "POST" &&
    url.pathname.endsWith("/procurement") && url.searchParams.get("page") === page
}

async function requireActor(
  page: Page, harness: InstalledNativeHarness, actor: "requester" | "holder" | "denied",
) {
  const target = harness.manifest.target
  const response = await page.goto(new URL(target.chapterHref, target.shellOrigin).href)
  expect(response?.status(), "F04 must mount the installed native shell, not WP04 HTML").toBe(200)
  const mounted = page.getByRole("main")
  await expect(mounted).toBeVisible()
  const verified = await harness.proveWeb(mounted)
  expect(verified.proofClass).toBe("WEB_INSTALLED_CONTEXT_OBSERVED")
  expect(verified.candidateSha).toBe(harness.manifest.candidateSha)
  expect(verified.principalRef, "An authenticated F04 actor binding is required per case").toBe(harness.manifest.actors[actor])
  return target
}

async function openPilotRecord(page: Page, shellOrigin: string, section: string, title: string) {
  const response = await page.goto(new URL(section, shellOrigin).href)
  expect(response?.status()).toBe(200)
  const link = page.getByRole("link", { name: title, exact: true })
  await expect(link, "Real seeded PR must be available through the installed authorized list").toBeVisible()
  await link.click()
  await expect(page.getByRole("main")).toBeVisible()
}

async function prepareTitleSave(page: Page, title: string) {
  const editor = page.locator('[data-component="sf-request-title-save"]')
  await expect(editor).toBeVisible()
  const field = editor.getByRole("textbox", { name: "Title", exact: true })
  await expect(field).toBeEditable()
  await field.fill(title)
  const review = editor.getByRole("button", { name: /Review title change|Revisar alteração do título/ })
  await expect(review).toBeEnabled()
  await review.click()
  const save = editor.getByRole("button", { name: /^(Save|Salvar)$/ })
  await expect(save).toBeEnabled()
  return { editor, save }
}

test("Q02-P0P1-P0-WEB — real title-only save has source CAS, visible focus and persisted refetch", async ({ page, nativeHarness }) => {
  const target = await requireActor(page, nativeHarness, "requester")
  const reads: string[] = []
  const writes: Request[] = []
  page.on("response", (response) => {
    if (response.request().method() === "GET" && new URL(response.url()).pathname.endsWith("/api/ui/pages/CAP25"))
      reads.push(response.url())
  })
  page.on("request", (request) => { if (isCommand(request, "Requests")) writes.push(request) })
  const firstRead = page.waitForResponse((response) =>
    response.request().method() === "GET" &&
    new URL(response.url()).pathname.endsWith("/api/ui/pages/CAP25") && response.ok())
  await openPilotRecord(page, target.shellOrigin, pilot.requests, pilot.p0)
  const source: unknown = await (await firstRead).json()
  const nextTitle = "Q02 real authorized draft title"
  const { editor, save } = await prepareTitleSave(page, nextTitle)
  await save.focus()
  await expect(save).toBeFocused()
  const committed = page.waitForResponse((response) => isCommand(response.request(), "Requests"))
  await save.click() // ONE irreversible intent; never retried by the test.
  const response = await committed
  expect(response.status()).toBe(200)
  expect(await response.json()).toMatchObject({ ok: true })
  expect(writes).toHaveLength(1)
  const command: unknown = writes[0]!.postDataJSON()
  expect(command).toEqual({
    page: "Requests", action: "save", id: expect.any(String), version: expect.any(Number),
    values: { pr: { title: nextTitle } },
  })
  const body = command as { id: string; version: number }
  if (!source || typeof source !== "object" || !("value" in source) ||
      !source.value || typeof source.value !== "object" || !("versions" in source.value) ||
      !source.value.versions || typeof source.value.versions !== "object")
    throw new Error("Q02_BLOCKED_CONTRACT: CAP25 real authorized version envelope unavailable")
  const versions = source.value.versions as Record<string, { version?: unknown }>
  expect(body.version).toBe(versions["requests:" + body.id]?.version)
  const headers = writes[0]!.headers()
  expect(headers["idempotency-key"]).toMatch(/^[A-Za-z0-9._:-]{8,128}$/)
  expect(headers["x-sf-native-owner"]).toEqual(expect.any(String))
  await expect(editor.getByRole("status")).toContainText(/Changes saved|Alterações salvas/)
  expect(reads.length, "A genuine authorized CAP25 reread must follow the command").toBeGreaterThanOrEqual(2)
  await page.reload()
  await expect(page.locator('[data-component="sf-request-title-save"]').getByRole("textbox", { name: "Title" }))
    .toHaveValue(nextTitle)
  expect(writes, "Reload may not replay a mutation").toHaveLength(1)
})

test("Q02-P0P1-P0-DENIED — distinct real principal sees no protected title and sends no save", async ({ page, nativeHarness }) => {
  const target = await requireActor(page, nativeHarness, "denied")
  const writes: Request[] = []
  page.on("request", (request) => { if (isCommand(request, "Requests")) writes.push(request) })
  await page.goto(new URL(pilot.requests, target.shellOrigin).href)
  await expect(page.getByRole("main")).toBeVisible()
  await expect(page.getByText(pilot.p0, { exact: true })).toHaveCount(0)
  await expect(page.locator('[data-component="sf-request-title-save"]').getByRole("textbox", { name: "Title" }))
    .toHaveCount(0)
  expect(writes).toHaveLength(0)
})

test("Q02-P0P1-P0-LOSS — producer executes once, lost response remains unknown without replay", async ({ page, nativeHarness }) => {
  const target = await requireActor(page, nativeHarness, "requester")
  await openPilotRecord(page, target.shellOrigin, pilot.requests, pilot.p0)
  const commandURL = new URL(target.mount + "/procurement", target.publicOrigin)
  const fault = await armLostResponse(page, { origin: commandURL.origin, pathname: commandURL.pathname, method: "POST" })
  const writes: Request[] = []
  page.on("request", (request) => { if (isCommand(request, "Requests")) writes.push(request) })
  try {
    const { editor, save } = await prepareTitleSave(page, "Q02 original response-loss intent")
    await save.click()
    await expect(editor.getByRole("alert")).toContainText(/response was lost|resposta do salvamento foi perdida/i)
    const observation = fault.observations()
    expect(observation.attempts).toBe(1)
    expect(observation.producerCommit).toBe("UNPROVEN_REQUIRES_ORIGINAL_AUTHORIZED_READ")
    expect(writes).toHaveLength(1)
    const reread = editor.getByRole("button", { name: /Refresh source|Atualizar fonte/ })
    await expect(reread).toBeVisible()
    await reread.click() // Read-only recovery, never a second POST.
    expect(writes).toHaveLength(1)
  } finally {
    await fault.dispose()
  }
})

test("Q02-P0P1-P1-WEB — holder reviews real submitted PR, amount/version and approved refetch", async ({ page, nativeHarness }) => {
  const target = await requireActor(page, nativeHarness, "holder")
  const writes: Request[] = []
  const reads: string[] = []
  page.on("request", (request) => { if (isCommand(request, "My approvals")) writes.push(request) })
  page.on("response", (response) => {
    if (response.request().method() === "GET" && new URL(response.url()).pathname.endsWith("/api/ui/pages/CAP26"))
      reads.push(response.url())
  })
  await openPilotRecord(page, target.shellOrigin, pilot.approvals, pilot.p1)
  // P1 is NOT title-save: it needs a submitted PR, real holder and original amount.
  await expect(page.getByRole("main")).toContainText(pilot.p1)
  await expect(page.getByRole("main")).toContainText(/32,000|32\.000|32000/)
  const review = page.getByRole("button", { name: /Review decision|Revisar decisão/ })
  await expect(review).toBeEnabled()
  await review.click()
  const approve = page.getByRole("button", { name: /^(Approve|Aprovar)$/ })
  await expect(approve).toBeEnabled()
  await approve.focus()
  await expect(approve).toBeFocused()
  const admitted = page.waitForResponse((response) => isCommand(response.request(), "My approvals"))
  await approve.click() // One holder-approved intent, not repeated after any timeout.
  const original = await admitted
  expect(original.status()).toBe(200)
  expect(await original.json()).toMatchObject({ ok: true })
  expect(writes).toHaveLength(1)
  expect(writes[0]!.postDataJSON()).toMatchObject({
    page: "My approvals", action: "approve", id: expect.any(String), version: expect.any(Number),
  })
  expect(writes[0]!.headers()["idempotency-key"]).toMatch(/^[A-Za-z0-9._:-]{8,128}$/)
  expect(writes[0]!.headers()["x-sf-native-owner"]).toEqual(expect.any(String))
  await expect(page.getByRole("main")).toContainText(/Approved|Aprovad/)
  expect(reads.length, "Approval requires original authorized CAP26 refetch").toBeGreaterThanOrEqual(2)
  await page.reload()
  await expect(page.getByRole("main")).toContainText(/Approved|Aprovad/)
  expect(writes).toHaveLength(1)
})

test("Q02-P0P1-P1-DENIED — non-holder cannot approve and has no stale private projection", async ({ page, nativeHarness }) => {
  const target = await requireActor(page, nativeHarness, "denied")
  const writes: Request[] = []
  page.on("request", (request) => { if (isCommand(request, "My approvals")) writes.push(request) })
  await page.goto(new URL(pilot.approvals, target.shellOrigin).href)
  await expect(page.getByRole("main")).toBeVisible()
  await expect(page.getByText(pilot.p1, { exact: true })).toHaveCount(0)
  await expect(page.getByRole("button", { name: /^(Approve|Aprovar)$/ })).toHaveCount(0)
  expect(writes).toHaveLength(0)
})

test("Q02-P0P1-DESKTOP — D01 packaged session is mandatory, web and domain fixtures do not qualify it", async ({ nativeHarness }) => {
  expect(
    String(nativeHarness.desktop),
    "Q02_BLOCKED_INTEGRATION: D01 must expose a real Electron main/preload/session proof; F04 currently has only NOT_RUN",
  ).not.toBe("NOT_RUN_D01_REAL_ELECTRON_REQUIRED")
  // A future D01 public proof contract must independently validate both P0 and
  // P1 on desktop before replacing this fail-closed gate. Never infer desktop
  // acceptance from a web screenshot or a domain seed.
  throw new Error("Q02_BLOCKED_CONTRACT: no frozen F04/D01 desktop pilot proof API exists")
})
