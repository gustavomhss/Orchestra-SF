import { test } from "bun:test"
import { expect, type BrowserContext } from "@playwright/test"
import path from "node:path"
import { localBrowser } from "./fixture/local-browser.ts"

test("private operator completes supplier, PR, sourcing and issued PO through browser forms", async () => {
  console.info("browser business: fixture opening")
  const fixture = await localBrowser()
  try {
    console.info("browser business: fixture ready")
    const page = fixture.page
    page.setDefaultTimeout(10000)
    page.setDefaultNavigationTimeout(10000)
    page.on("dialog", async (dialog) => {
      console.info("browser business: accepting dialog", dialog.type())
      await dialog.accept()
      console.info("browser business: dialog accepted")
    })
    const base = "http://localhost:4110/sucafina/procurement"
    const go = async (name: string) => {
      console.info("browser business: go starting", name)
      expect((await page.goto(`${base}?page=${encodeURIComponent(name)}&filter=All`, { timeout: 10000 }))?.status()).toBe(200)
      console.info("browser business: go complete", name)
    }
    const submit = async (form: ReturnType<typeof page.locator>) => {
      console.info("browser business: checking submit control")
      await expect(form).toHaveCount(1)
      await expect(form.locator('button[type="submit"]')).toHaveCount(1)
      await expect(form.locator('button[type="submit"]')).toBeVisible()
      await expect(form.locator('button[type="submit"]')).toBeEnabled()
      const command = { page: await form.getAttribute("data-page"), action: await form.getAttribute("data-command") ?? await form.getAttribute("data-private-upload") }
      console.info("browser business: submit starting", JSON.stringify(command))
      const response = page.waitForResponse((response) => response.request().method() === "POST" && response.url().startsWith(base), { timeout: 10000 })
      await form.locator('button[type="submit"]').click()
      console.info("browser business: submit clicked", JSON.stringify(command))
      const result = await response
      console.info("browser business: submit response", JSON.stringify(command), result.status())
      const payload = await result.json()
      console.info("browser business: submit JSON read", JSON.stringify(command))
      if (result.status() !== 200) console.error("browser acceptance response", JSON.stringify({ ...command, status: result.status(), response: payload }))
      expect(result.status(), `${command.page} / ${command.action}: ${JSON.stringify(payload)}`).toBe(200)
      expect(payload).toMatchObject({ ok: true })
      console.info("browser business: reload starting", JSON.stringify(command))
      await page.reload({ timeout: 10000 })
      console.info("browser business: persisted", JSON.stringify(command))
    }
    await go("Settings")
    console.info("browser business: opening reset settings")
    await page.getByText("Reset settings", { exact: true }).first().click()
    console.info("browser business: reset settings opened")
    await submit(page.locator('form[data-command="reset"]'))
    const settings = page.locator('form[data-command="save"]')
    await settings.locator('[name="currency"]').fill("USD")
    await settings.getByLabel("Block self approval", { exact: true }).uncheck()
    await settings.getByLabel("Require active supplier", { exact: true }).check()
    await settings.getByLabel("Minimum quotations").fill("1")
    await settings.getByLabel("Attachment limit (bytes)", { exact: true }).fill("1048576")
    await settings.locator('[name="levels.0.holderId"]').selectOption(fixture.actorId)
    await settings.locator('[name="levels.1.holderId"]').selectOption(fixture.actorId)
    await submit(settings)
    await expect(settings.getByLabel("Block self approval", { exact: true })).not.toBeChecked()
    await expect(settings.locator('[name="levels.0.holderId"]')).toHaveValue(fixture.actorId)
    // Self approval is deliberately permitted only inside this disposable local profile.
    await go("Suppliers")
    const create = page.locator('form[data-command="create"]')
    for (const [name, value] of Object.entries({ legalName: "Browser acceptance vendor", country: "CH", address: "Temporary test address", taxId: "BROWSER-20261112", contactEmail: "acceptance@example.invalid", paymentTerms: "Net 30", sanctionsDate: "2026-11-12" })) await create.locator(`[name="${name}"]`).fill(value)
    await create.getByLabel("Risk rating").selectOption("Low")
    await create.getByLabel("Due diligence complete").check()
    await submit(create)
    const supplier = page.locator('details[id^="supplier-"]').filter({ hasText: "Browser acceptance vendor" })
    await supplier.locator("summary").click()
    await submit(supplier.locator('form[data-command="save"]'))
    await supplier.locator("summary").click()
    await supplier.locator('form[data-command="change-bank"] [name="bankName"]').fill("Acceptance fixture bank")
    await submit(supplier.locator('form[data-command="change-bank"]'))
    await supplier.locator("summary").click()
    await submit(supplier.locator('form[data-command="activate"]'))
    await expect(page.getByRole("row").filter({ hasText: "Browser acceptance vendor" })).toContainText("active")
    await go("Requests")
    const request = page.locator('form[data-command="create"]')
    for (const [name, value] of Object.entries({ title: "Browser procurement acceptance", description: "Temporary installation service", estAmount: "500", costCenter: "IT", needBy: "2026-12-01", justification: "Browser acceptance only" })) await request.locator(`[name="pr.${name}"]`).fill(value)
    await request.locator('[name="pr.type"]').selectOption("service")
    await request.locator('[name="pr.expenseType"]').selectOption("OPEX")
    await submit(request)
    const id = await page.locator('details[id^="PR-"]').getAttribute("id")
    expect(id).toMatch(/^PR-/)
    const record = page.locator(`details[id="${id}"]`)
    const transition = async (action: string, status: string) => {
      console.info("browser business: transition starting", action, status)
      await record.locator("summary").click()
      await submit(record.locator(`form[data-command="${action}"]`))
      await expect(page.getByRole("row").filter({ hasText: id! }).first()).toContainText(status)
      console.info("browser business: transition verified", action, status)
    }
    await transition("submit_pr", "pr_pending")
    await transition("approve", "sourcing")
    await record.locator("summary").click()
    const sourcing = record.locator('form[data-command="save"]').filter({ has: page.locator('[name="sourcing.evaluator"]') })
    for (const [name, value] of Object.entries({ evaluator: "Local operator", fewQuotesJustification: "Temporary sole source acceptance", selectionJustification: "Meets acceptance", "quotes.0.supplier": "Browser acceptance vendor", "quotes.0.currency": "USD", "quotes.0.total": "500", "quotes.0.qty": "1", "quotes.0.unitPrice": "500" })) await sourcing.locator(`[name="sourcing.${name}"]`).fill(value)
    await sourcing.locator('[name="sourcing.contractStrategy"]').selectOption("new")
    await sourcing.getByLabel("Registered supplier").selectOption({ label: "Browser acceptance vendor" })
    for (const [index, score] of [5, 4, 3, 4, 5].entries())
      await sourcing.locator(`[name="sourcing.quotes.0.scores.${index}"]`).fill(String(score))
    await sourcing.locator('[name="sourcing.quotes.0.cscores.1"]').fill("4")
    await sourcing.locator('[name="sourcing.quotes.0.cscores.2"]').fill("5")
    await expect(sourcing.locator('[name="sourcing.quotes.0.cscores.0"]')).toHaveAttribute("type", "hidden")
    await expect(sourcing.locator('[name="sourcing.quotes.0.cscores.0"]')).toHaveAttribute("data-json", "true")
    const sourcingPost = page.waitForRequest((request) => request.method() === "POST" && request.url().startsWith(base))
    await submit(sourcing)
    const posted = (await sourcingPost).postDataJSON() as { values: { sourcing: { quotes: Record<string, unknown>[] } } }
    expect(posted.values.sourcing.quotes[0]).toMatchObject({
      scores: [5, 4, 3, 4, 5],
      cscores: [0, 4, 5],
    })
    await record.locator("summary").click()
    const assertSourcingRows = async () => {
      await expect(sourcing.locator('[name="sourcing.quotes.0._new"]')).toHaveCount(0)
      await expect(sourcing.locator('[name="sourcing.quotes.0._remove"]')).toHaveCount(1)
      await expect(sourcing.locator('[name="sourcing.quotes.1._new"]')).toHaveValue("true")
      await expect(sourcing.locator('[name="sourcing.quotes.1._remove"]')).toHaveCount(0)
      await expect(sourcing.locator('[name="sourcing.quotes.2._new"]')).toHaveCount(0)
      await expect(sourcing.locator('[name="sourcing.quotes.0.supplier"]')).toHaveValue("Browser acceptance vendor")
      for (const [index, score] of [5, 4, 3, 4, 5].entries())
        await expect(sourcing.locator(`[name="sourcing.quotes.0.scores.${index}"]`)).toHaveValue(String(score))
      for (const [index, score] of [0, 4, 5].entries())
        await expect(sourcing.locator(`[name="sourcing.quotes.0.cscores.${index}"]`)).toHaveValue(String(score))
    }
    await assertSourcingRows()
    await sourcing.locator('[name="sourcing.evaluator"]').fill("Local operator revised")
    await submit(sourcing)
    await record.locator("summary").click()
    await expect(sourcing.locator('[name="sourcing.evaluator"]')).toHaveValue("Local operator revised")
    await assertSourcingRows()
    await record.getByLabel("Winning quote").selectOption({ label: "Browser acceptance vendor · USD 500" })
    await submit(record.locator('form[data-command="select_quote"]'))
    await transition("submit_sourcing", "src_pending")
    await transition("approve", "po_draft")
    await record.locator("summary").click()
    const po = record.locator('form[data-command="save"]').filter({ has: page.locator('[name="po.description"]') })
    for (const [name, value] of Object.entries({ description: "Consulting deliverable", paymentTerms: "Net 30", deliveryDate: "2026-12-20", deliveryConditions: "Remote", contractRef: "BROWSER-C1", "lines.0.desc": "Milestone", "lines.0.qty": "1", "lines.0.unitPrice": "500" })) await po.locator(`[name="po.${name}"]`).fill(value)
    await po.locator('[name="po.expenseType"]').selectOption("OPEX")
    await submit(po)
    await transition("submit_po", "po_pending")
    await transition("approve", "po_approved")
    await transition("issue", "po_issued")
    await record.locator("summary").click()
    await expect(record.locator('[name="po.description"]')).toHaveValue("Consulting deliverable")
    await expect(record.locator('[name="sourcing.quotes.0.total"]')).toHaveValue("500")
    await expect(record.locator('[name="pr.title"]')).toHaveValue("Browser procurement acceptance")
    console.info("browser business: PO download starting")
    const download = page.waitForEvent("download", { timeout: 10000 })
    await record.getByRole("link", { name: "Download purchase order" }).click()
    const artifact = await download
    console.info("browser business: PO download event received")
    expect(await artifact.failure()).toBeNull()
    console.info("browser business: PO download complete; parse starting")
    const html = await Bun.file((await artifact.path())!).text()
    console.info("browser business: PO parse complete")
    expect(html).toContain("po_issued")
    expect(html).toContain("500.00")
    expect(html).toContain("Consulting deliverable")
    console.info("browser business: screenshot starting")
    await page.screenshot({ path: path.join(import.meta.dir, "artifacts/browser-business-issued-po.png"), fullPage: true, timeout: 10000, animations: "disabled" })
    console.info("browser business: assertions complete")
    expect(fixture.errors).toEqual([])
  } catch (error) {
    console.error("browser business: failed before cleanup", error)
    throw error
  } finally {
    console.info("browser business: cleanup starting")
    await fixture.dispose()
    console.info("browser business: cleanup complete")
  }
}, 120000)

test("two browser tabs reject a stale supplier save without overwriting persisted data", async () => {
  console.info("browser business: fixture opening")
  const fixture = await localBrowser()
  const secondary: { context?: BrowserContext } = {}
  try {
    console.info("browser business: fixture ready")
    const page = fixture.page
    page.setDefaultTimeout(10000)
    page.setDefaultNavigationTimeout(10000)
    page.on("dialog", async (dialog) => {
      console.info("browser business: accepting dialog", dialog.type())
      await dialog.accept()
      console.info("browser business: dialog accepted")
    })
    // Copy only this throwaway installation's authenticated session, entirely in memory.
    console.info("browser business: second context opening")
    const context = await fixture.browser.newContext({ storageState: await page.context().storageState() })
    secondary.context = context
    const other = await context.newPage()
    other.setDefaultTimeout(10000)
    other.setDefaultNavigationTimeout(10000)
    other.on("dialog", (dialog) => dialog.accept())
    console.info("browser business: second tab ready")
    other.on("pageerror", (error) => fixture.errors.push(error.message))
    console.info("browser business: stale-tab go Suppliers starting")
    await page.goto("http://localhost:4110/sucafina/procurement?page=Suppliers", { timeout: 10000 })
    console.info("browser business: stale-tab go Suppliers complete")
    await page.locator('form[data-command="create"] [name="legalName"]').fill("Version acceptance vendor")
    console.info("browser business: stale-tab create starting")
    const created = page.waitForResponse((response) => response.request().method() === "POST", { timeout: 10000 })
    await page.getByRole("button", { name: "Create supplier", exact: true }).click()
    const creation = await created
    const creationBody = await creation.json()
    console.info("browser business: stale-tab create response", creation.status())
    if (creation.status() !== 200) console.error("browser acceptance response", JSON.stringify({ page: "Suppliers", action: "create", status: creation.status(), response: creationBody }))
    expect(creation.status(), JSON.stringify(creationBody)).toBe(200)
    expect(creationBody).toMatchObject({ ok: true })
    await page.reload()
    await other.goto(page.url())
    for (const tab of [page, other]) await tab.locator('details[id^="supplier-"] summary').click()
    await other.locator('form[data-command="save"] [name="legalName"]').fill("Stale overwrite forbidden")
    const save = page.locator('form[data-command="save"]')
    await save.locator('[name="legalName"]').fill("Winning supplier revision")
    console.info("browser business: winning revision submit starting")
    const accepted = page.waitForResponse((response) => response.request().method() === "POST", { timeout: 10000 })
    await save.getByRole("button", { name: "Save supplier" }).click()
    const winningResponse = await accepted
    console.info("browser business: winning revision response", winningResponse.status())
    expect(winningResponse.status()).toBe(200)
    console.info("browser business: stale revision submit starting")
    const rejected = other.waitForResponse((response) => response.request().method() === "POST", { timeout: 10000 })
    await other.getByRole("button", { name: "Save supplier", exact: true }).click()
    const staleResponse = await rejected
    console.info("browser business: stale revision response", staleResponse.status())
    expect(staleResponse.status()).toBe(409)
    const verificationDeadline = { timer: undefined as ReturnType<typeof setTimeout> | undefined }
    try {
      await Promise.race([
        (async () => {
          for (const [index, tab] of [page, other].entries()) {
            console.info("browser business: post-conflict reload starting", index)
            const reloaded = await tab.reload({ waitUntil: "domcontentloaded", timeout: 10000 })
            expect(reloaded?.status()).toBe(200)
            console.info("browser business: post-conflict persisted assertions starting", index)
            await expect(tab.getByRole("row").filter({ hasText: "Winning supplier revision" })).toHaveCount(1)
            await expect(tab.getByText("Stale overwrite forbidden", { exact: true })).toHaveCount(0)
            console.info("browser business: post-conflict persisted assertions complete", index)
          }
        })(),
        new Promise<never>((_, reject) => {
          // Leave time for authoritative fixture cleanup before Bun's 45s test deadline.
          verificationDeadline.timer = setTimeout(() => reject(new Error("Post-409 browser persistence verification exceeded 20s")), 20000)
          verificationDeadline.timer.unref()
        }),
      ])
    } finally {
      if (verificationDeadline.timer) clearTimeout(verificationDeadline.timer)
    }
    console.info("browser business: assertions complete")
    expect(fixture.errors).toEqual([])
  } catch (error) {
    console.error("browser business: failed before cleanup", error)
    throw error
  } finally {
    console.info("browser business: cleanup starting")
    fixture.stopServer()
    const closeDeadline = { timer: undefined as ReturnType<typeof setTimeout> | undefined }
    try {
      if (secondary.context) {
        console.info("browser business: second context close starting")
        await Promise.race([
          secondary.context.close().then(() => console.info("browser business: second context closed")),
          new Promise<void>((resolve) => {
            closeDeadline.timer = setTimeout(() => {
              console.info("browser business: second context close pending; fixture must prove OS and transport termination")
              resolve()
            }, 1500)
            closeDeadline.timer.unref()
          }),
        ])
      }
    } finally {
      if (closeDeadline.timer) clearTimeout(closeDeadline.timer)
      await fixture.dispose()
    }
    console.info("browser business: cleanup complete")
  }
}, 45000)
