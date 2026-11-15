/**
 * N23/U13.complete: ONLY the sourcing/PO approval continuation. The admitted
 * PR approval remains in the protected W13 leaf; 132 composes both.
 * Real authenticated F04 publisher/holder is mandatory; no fake receipts.
 */
import { expect, type Page, type Request } from "@playwright/test"
import { nativeInstalledFixture as test, type InstalledNativeHarness } from "../fixture"

test.describe.configure({ retries: 0 })
test.use({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" })

function required(key: string) {
  const value = process.env[key]
  if (!value?.trim()) throw new Error("U13_REAL_INSTALLED_FIXTURE_REQUIRED:" + key)
  return value
}
const routeRef = (value: string) => "r_" + Buffer.from(value, "utf8").toString("base64url")
const approvalWrite = (request: Request) => {
  const url = new URL(request.url())
  return request.method() === "POST" && url.pathname.endsWith("/procurement") &&
    url.searchParams.get("page") === "My approvals"
}
async function open(page: Page, harness: InstalledNativeHarness, ref: string) {
  const target = harness.manifest.target
  const chapter = new URL(target.chapterHref, target.shellOrigin)
  await page.goto(chapter.href)
  await harness.proveWeb(page.locator('[data-sf-frame="page"]'))
  const destination = new URL("/orchestra/sf-procurement/approvals/" + routeRef(ref) + "/review", target.shellOrigin)
  destination.search = chapter.search
  if (destination.origin !== target.shellOrigin) throw new Error("U13_CROSS_OWNER_ROUTE")
  const pending = page.waitForResponse((response) => response.request().method() === "GET" &&
    new URL(response.url()).pathname.endsWith("/api/ui/pages/CAP26"))
  await page.goto(destination.href)
  const response = await pending
  expect(response.status()).toBe(200)
  const body = await response.json()
  expect(body.status).toBe("ok")
  expect(body.value.capabilityId).toBe("CAP26")
  await expect(page.locator(".sf-u13-remaining-root")).toBeVisible()
  return body
}

test("U13-AC01 approval steps bind frozen producer version, stage, holder and submitted amount", async ({ page, nativeHarness }, info) => {
  info.annotations.push({ type: "criteria-scope", description: "U13-AC01/02; sourcing and PO; held source version" })
  for (const [stage, fixture] of [["src_pending", "SF_NATIVE_U13_SOURCING_REF"], ["po_pending", "SF_NATIVE_U13_PO_REF"]] as const) {
    const ref = required(fixture)
    const writes: Request[] = []
    page.on("request", (request) => { if (approvalWrite(request)) writes.push(request) })
    const source = await open(page, nativeHarness, ref)
    const matches = source.value.data.requests.filter((row: {number: string}) => row.number === ref)
    expect(matches).toHaveLength(1)
    expect(matches[0].status).toBe(stage)
    expect(Number.isSafeInteger(source.value.versions["requests:" + ref]?.version)).toBe(true)
    const approval = stage === "src_pending" ? matches[0].sourcing?.approval : matches[0].po?.approval
    expect(approval?.steps?.filter((step: {status: string}) => step.status === "pending")).toHaveLength(1)
    expect(Number.isFinite(approval?.amount)).toBe(true)
    const root = page.locator(".sf-u13-remaining-root")
    await expect(root.getByText(ref, { exact: true })).toBeVisible()
    await expect(root.getByText(/Submitted amount|Valor submetido/)).toBeVisible()
    await expect(root.getByText(/No financial approval|aprovação financeira|Planner M31/)).toBeVisible()
    expect(writes).toHaveLength(0)
  }
})

test("U13-AC01 rejection requires a reason and a separate user review without immediate POST", async ({ page, nativeHarness }, info) => {
  info.annotations.push({ type: "criteria-scope", description: "U13-AC01/02; reject/resubmit guard, no auto replay" })
  const ref = required("SF_NATIVE_U13_REJECT_REF")
  const writes: Request[] = []
  page.on("request", (request) => { if (approvalWrite(request)) writes.push(request) })
  await open(page, nativeHarness, ref)
  const root = page.locator(".sf-u13-remaining-root")
  const reject = root.getByRole("button", { name: /Reject current step|Rejeitar etapa atual/ })
  await expect(reject).toBeDisabled()
  const reason = root.getByRole("textbox", { name: /Rejection reason|Motivo da rejeição/ })
  await reason.fill("U13 real installed fixture rejection policy review")
  await expect(reject).toBeEnabled()
  await reject.click()
  const review = root.locator('[data-component="sf-change-review"]')
  await expect(review).toBeVisible()
  expect(writes).toHaveLength(0)
  await review.getByRole("button", { name: /Cancel|Cancelar/ }).click()
  await expect(reason).toHaveValue("U13 real installed fixture rejection policy review")
  expect(writes).toHaveLength(0)
})

test("U13-AC01 one admitted PO approval is producer-confirmed and never counted as Planner M31/MI07", async ({ page, nativeHarness }, info) => {
  info.annotations.push({ type: "criteria-scope", description: "U13-AC01; real holder approve; one POST; no invented receipt" })
  const ref = required("SF_NATIVE_U13_APPROVE_REF")
  const writes: Request[] = []
  page.on("request", (request) => { if (approvalWrite(request)) writes.push(request) })
  const source = await open(page, nativeHarness, ref)
  const reviewVersion = source.value.versions["requests:" + ref]?.version
  const root = page.locator(".sf-u13-remaining-root")
  const approve = root.getByRole("button", { name: /Approve current step|Aprovar etapa atual/ })
  await expect(approve).toBeEnabled()
  await approve.click()
  const review = root.locator('[data-component="sf-change-review"]')
  await expect(review).toBeVisible()
  expect(writes).toHaveLength(0)
  const confirm = review.getByRole("button", { name: /Confirm once|Confirmar uma vez/ })
  await expect(confirm).toBeEnabled()
  const responsePending = page.waitForResponse((response) =>
    approvalWrite(response.request()) && response.request().postDataJSON()?.action === "approve")
  await confirm.click()
  const response = await responsePending
  expect(response.status()).toBe(200)
  expect(await response.json()).toMatchObject({ ok: true })
  expect(response.request().postDataJSON()).toMatchObject({
    page:"My approvals",action:"approve",id:ref,version:reviewVersion,
  })
  expect(writes).toHaveLength(1)
  await expect(root.getByText(/producer acknowledged|produtor confirmou/)).toBeVisible()
})

test("U13-AC03 queue controls reflow at five widths and 200% text", async ({ page, nativeHarness }, info) => {
  info.annotations.push({ type: "criteria-scope", description: "U13-AC03; 320/768/1024/1280/1440 and 400% reflow" })
  await open(page, nativeHarness, required("SF_NATIVE_U13_SOURCING_REF"))
  const root = page.locator(".sf-u13-remaining-root")
  for (const width of [320, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(root.getByRole("searchbox")).toBeVisible()
    await expect(root.getByRole("combobox", { name: /Filter queue|Filtrar fila/ })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
    await info.attach("u13-" + width + "px.png", { body: await page.screenshot(), contentType: "image/png" })
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%" })
  await page.setViewportSize({ width: 320, height: 900 })
  await expect(root.getByRole("searchbox")).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
})
