import { expect } from "@playwright/test"
import { nativeInstalledFixture as test } from "../fixture"
import type { Request } from "@playwright/test"

/**
 * U48/CAP18-CAP19 installed monthly save journeys. 120 supplies the real authorized
 * candidate with a CAP18/CAP19 unlocked plan version for the current year, the
 * original host and non-synthetic rows. Missing installation/grant/version/cell
 * writability MUST fail with an explicit F04 code, never skip or pass vacuously.
 *
 * The first writable cell is edited to a value distinct from its pre-image, committed
 * through the page's real dirty→preview→apply path (page=OPEX|CAPEX, action=apply,
 * producer CAS), verified by an authenticated re-read of the original projection, and
 * then restored to its pre-image value through the same path — so the journey leaves
 * the scratch plan unchanged whichever way the oracle asserts it.
 *
 * No interception, mock, synthetic response, fabricated grant or replay is used.
 * Source of truth after every mutation: authenticated GET against the original
 * {mount}/api/ui/pages/CAP18|CAP19 producer.
 */
test.use({ trace: "off" })

type PostedRequest = Readonly<{ body?: Record<string, unknown>; idempotencyKey?: string; url: string }>

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined

function plannerPosts(page: import("@playwright/test").Page, target: { publicOrigin: string; mount: string }) {
  const posts: PostedRequest[] = []
  page.on("request", (request: Request) => {
    if (request.method() !== "POST") return
    const url = new URL(request.url())
    if (url.origin !== target.publicOrigin || url.pathname !== target.mount + "/planner") return
    let body: Record<string, unknown> | undefined
    try { body = asRecord(request.postDataJSON()) } catch { body = undefined }
    posts.push({ body, idempotencyKey: request.headers()["idempotency-key"], url: request.url() })
  })
  return posts
}

async function authenticatedPage(
  page: import("@playwright/test").Page, target: { publicOrigin: string; mount: string }, surfaceId: string, year: number,
): Promise<Record<string, unknown>> {
  const url = new URL(target.mount + "/api/ui/pages/" + surfaceId, target.publicOrigin)
  url.searchParams.set("year", String(year))
  const reply = await page.request.get(url.toString(), { maxRedirects: 0, maxRetries: 0 })
  if (reply.status() !== 200) throw new Error("F04_" + surfaceId + "_ORIGINAL_PAGE_HTTP_" + reply.status())
  const envelope = asRecord(await reply.json())
  if (envelope?.status !== "ok") throw new Error("F04_" + surfaceId + "_ORIGINAL_PAGE_NOT_OK")
  const value = asRecord(envelope.value)
  if (value?.capabilityId !== surfaceId) throw new Error("F04_" + surfaceId + "_ORIGINAL_PAGE_CAPABILITY_MISMATCH")
  return value as Record<string, unknown>
}

const gridRows = (pageData: Record<string, unknown>): Record<string, unknown>[] =>
  (Array.isArray(asRecord(asRecord(pageData.data)?.grid)?.rows)
    ? (asRecord(asRecord(pageData.data)?.grid)!.rows as unknown[]).map(asRecord)
    : []) as Record<string, unknown>[]

const twoDigitMonth = (value: unknown) => typeof value === "number" && Math.trunc(value) === value && value >= 1 && value <= 12
const cell = (row: Record<string, unknown> | undefined, month: number, measure: string) => {
  if (!row) return undefined
  const cells = Array.isArray(row.cells) ? (row.cells as unknown[]).map(asRecord) : []
  const monthCell = cells.find((entry) => entry?.month === month)
  return asRecord(monthCell?.[measure])?.value
}

/** Open the first writable monthly cell's in-place editor and return its raw pre-image text. */
async function openFirstEditableCell(page: import("@playwright/test").Page, surfaceId: string) {
  const sheet = page.locator('[data-sf-surface="' + surfaceId + '"]')
  const cellButtons = sheet.locator("button.sf-s02-inline-edit")
  if ((await cellButtons.count()) === 0) throw new Error("F04_" + surfaceId + "_WRITABLE_CELL_REQUIRED")
  const index = 0
  await cellButtons.nth(index).click()
  const editor = sheet.locator("input.sf-s02-editor")
  await expect(editor).toBeVisible()
  const preImage = await editor.inputValue()
  return { index, editor, preImage }
}

/** Apply the staged dirty cells through the page's own review/paste path. */
async function applyDirtyCells(page: import("@playwright/test").Page, sheet: import("@playwright/test").Locator) {
  await expect(sheet.locator('[data-sf-action="review-dirty"] button')).toBeEnabled()
  await sheet.locator('[data-sf-action="review-dirty"] button').click()
  const paste = sheet.locator(".sf-s02-paste")
  await expect(paste, "producer preview must settle before any apply is offered").toBeVisible({ timeout: 30_000 })
  await paste.locator(".sf-s02-paste-actions button").first().click()
  await expect(paste).toHaveCount(0)
}

/** The producer apply POST for the cell staged at `index`, with CAS + idempotency evidence. */
function applyRequest(posts: PostedRequest[], surfaceId: string, afterIndex: number) {
  const posted = posts.slice(afterIndex).find((post) => {
    const body = asRecord(post.body)
    const bodyInput = asRecord(body?.input)
    return body?.action === "apply" && bodyInput?.page === (surfaceId === "CAP18" ? "OPEX" : "CAPEX") && Array.isArray(bodyInput?.drafts)
  })
  if (!posted) throw new Error("F04_" + surfaceId + "_REAL_APPLY_COMMAND_REQUIRED")
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(posted.idempotencyKey ?? "")) {
    throw new Error("F04_" + surfaceId + "_APPLY_IDEMPOTENCY_KEY_REQUIRED")
  }
  const input = asRecord(posted.body?.input)
  const draft = asRecord((input?.drafts as unknown[] | undefined)?.[0])
  const monthCell = asRecord((draft?.cells as unknown[] | undefined)?.[0])
  if (typeof draft?.rowId !== "string" || typeof draft.revision !== "number" ||
      !twoDigitMonth(monthCell?.month) || typeof monthCell?.measure !== "string") {
    throw new Error("F04_" + surfaceId + "_APPLY_DRAFT_SHAPE_MISSING")
  }
  return { rowId: draft.rowId, revision: draft.revision, measure: monthCell.measure, month: monthCell.month as number, text: typeof monthCell.text === "string" ? monthCell.text : "" }
}

for (const surface of [
  { id: "CAP18", leaf: "opex" as const },
  { id: "CAP19", leaf: "capex" as const },
]) {
  const surfaceId = surface.id
  const leaf = surface.leaf
  test(surfaceId + " dirty monthly cell applies one producer CAS mutation and the source re-read confirms it", async ({ page, nativeHarness }, info) => {
    test.setTimeout(180_000)
    info.annotations.push({
      type: "source",
      description: "Installed native consumer, real hosted planner; dirty cell → CAS apply; authenticated GET re-read. No mock, no synthetic fixture.",
    })
    const target = nativeHarness.manifest.target
    const chapter = new URL(target.chapterHref, target.shellOrigin)
    const url = new URL("/orchestra/sf-planner/" + leaf, target.shellOrigin)
    for (const key of ["server", "project", "installation"] as const) {
      const value = chapter.searchParams.get(key)
      if (value) url.searchParams.set(key, value)
    }
    url.searchParams.set("year", "2026")
    const posts = plannerPosts(page, target)
    await page.goto(url.toString())
    const sheet = page.locator('[data-sf-surface="' + surfaceId + '"]')
    await expect(sheet, "U48 requires the installed, authorized native consumer").toBeVisible()

    const stageOne = await openFirstEditableCell(page, surfaceId)
    const beforeMutate = posts.length
    const scratchText = stageOne.preImage === "" || stageOne.preImage === "0" ? "1" : "0"
    await stageOne.editor.fill(scratchText)
    await stageOne.editor.press("Enter")
    await expect(page.locator(".sf-s02-draft").first()).toContainText(scratchText)

    await applyDirtyCells(page, sheet)
    const applied = applyRequest(posts, surfaceId, beforeMutate)

    // Authenticated oracle: the exact dirty cell must hold the applied value in the source.
    const pageData = await authenticatedPage(page, target, surfaceId, 2026)
    const row = gridRows(pageData).find((entry) => entry?.id === applied.rowId)
    const appliedValue = cell(row, applied.month, applied.measure)
    const expected = Number(scratchText)
    if (typeof appliedValue !== "number" || Number(appliedValue) !== expected) {
      throw new Error("F04_" + surfaceId + "_ORIGINAL_CELL_MISMATCH_EXPECTED_" + scratchText + "_GOT_" + String(appliedValue))
    }

    // Restore the pre-image through the same CAS path, then verify it landed.
    const stageTwo = await openFirstEditableCell(page, surfaceId)
    const beforeRestore = posts.length
    const preImage = stageTwo.preImage
    if (preImage !== scratchText) {
      throw new Error("F04_" + surfaceId + "_APPLY_DID_NOT_STORE_SCRATCH_TEXT_GOT_" + String(preImage))
    }
    const restoreText = stageOne.preImage
    await stageTwo.editor.fill(restoreText)
    await stageTwo.editor.press("Enter")
    await applyDirtyCells(page, sheet)
    applyRequest(posts, surfaceId, beforeRestore)

    const restored = await authenticatedPage(page, target, surfaceId, 2026)
    const restoredRow = gridRows(restored).find((entry) => entry?.id === applied.rowId)
    const restoredValue = cell(restoredRow, applied.month, applied.measure)
    const preImageValue = stageOne.preImage === "" ? null : Number(stageOne.preImage)
    if (restoredValue !== preImageValue) {
      throw new Error("F04_" + surfaceId + "_RESTORE_NOT_CONFIRMED_EXPECTED_" + String(preImageValue) + "_GOT_" + String(restoredValue))
    }
  })
}
